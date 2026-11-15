import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOP_LAT = 31.6295;
const SHOP_LNG = -8.0083;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.slice(7));
    const callerId = claimsData?.claims?.sub;
    const isServiceRole = claimsData?.claims?.role === "service_role";
    if (claimsError || (typeof callerId !== "string" && !isServiceRole)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const order_id = payload?.order_id;
    if (typeof order_id !== "string" || !/^[0-9a-f-]{36}$/i.test(order_id)) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isAdmin = isServiceRole;
    let driverId: string | null = null;
    if (!isServiceRole && callerId) {
      const [{ data: adminResult }, { data: driver }] = await Promise.all([
        supabase.rpc("has_admin_role", { user_id: callerId }),
        supabase.from("driver_profiles").select("id").eq("user_id", callerId).maybeSingle(),
      ]);
      isAdmin = adminResult === true;
      driverId = driver?.id ?? null;
    }

    if (!isAdmin) {
      if (!driverId || !["accepted", "rejected", "expired"].includes(payload?.response)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: responseResult, error: responseError } = await supabase.rpc("respond_to_driver_assignment", {
        _order_id: order_id,
        _response: payload.response,
      });
      if (responseError) {
        return new Response(JSON.stringify({ error: responseError.message }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (responseResult === "accepted") {
        return new Response(JSON.stringify({ status: responseResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, delivery_address_snapshot")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.delivery_mode === "pickup" || !["ready", "delivering"].includes(order.status)) {
      return new Response(JSON.stringify({ error: "Order is not eligible for driver assignment" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max attempts
    const currentAttempts = order.assignment_attempts || 0;
    if (!isAdmin && !isServiceRole && callerId) {
      const { data: retryAssignment } = await supabase
        .from("delivery_assignments")
        .select("id")
        .eq("order_id", order_id)
        .eq("driver_id", driverId)
        .in("status", ["rejected", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!retryAssignment) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (currentAttempts >= 5) {
      await supabase.from("orders").update({ assignment_status: "failed" }).eq("id", order_id);

      // Notify admins
      const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
      if (admins) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            user_id: admin.id,
            title: "❌ Aucun livreur disponible",
            message: `Impossible de trouver un livreur pour la commande après 5 tentatives.`,
            order_id,
          });
        }
      }

      return new Response(JSON.stringify({ status: "failed", message: "Max attempts reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get available drivers
    const { data: drivers } = await supabase
      .from("driver_profiles")
      .select("id, latitude, longitude, user_id")
      .eq("status", "available")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (!drivers || drivers.length === 0) {
      await supabase.from("orders").update({
        assignment_status: "failed",
        assignment_attempts: currentAttempts + 1,
      }).eq("id", order_id);

      return new Response(JSON.stringify({ status: "no_drivers", message: "No available drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get previous rejections/expirations for this order
    const { data: previousAttempts } = await supabase
      .from("delivery_assignments")
      .select("driver_id")
      .eq("order_id", order_id)
      .in("status", ["rejected", "expired"]);

    const excludedIds = previousAttempts?.map((a) => a.driver_id) || [];

    // Calculate distance and sort by proximity to shop
    const eligibleDrivers = drivers
      .filter((d) => !excludedIds.includes(d.id))
      .map((d) => ({
        ...d,
        distance: haversineDistance(SHOP_LAT, SHOP_LNG, Number(d.latitude), Number(d.longitude)),
      }))
      .filter((d) => d.distance <= 10)
      .sort((a, b) => a.distance - b.distance);

    if (eligibleDrivers.length === 0) {
      await supabase.from("orders").update({
        assignment_status: "failed",
        assignment_attempts: currentAttempts + 1,
      }).eq("id", order_id);

      return new Response(JSON.stringify({ status: "no_eligible_drivers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chosen = eligibleDrivers[0];

    // Calculate estimated duration (rough: 3 min/km)
    const destSnapshot = order.delivery_address_snapshot as any;
    let estimatedDuration: number | null = null;
    if (destSnapshot?.latitude && destSnapshot?.longitude) {
      const deliveryDistance = haversineDistance(SHOP_LAT, SHOP_LNG, destSnapshot.latitude, destSnapshot.longitude);
      estimatedDuration = Math.ceil((chosen.distance + deliveryDistance) * 3);
    }

    // Create assignment
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await supabase.from("delivery_assignments").insert({
      order_id,
      driver_id: chosen.id,
      status: "pending",
      expires_at: expiresAt,
      distance_to_shop: chosen.distance,
      estimated_duration: estimatedDuration,
    });

    await supabase.from("orders").update({
      assignment_status: "searching",
      assignment_attempts: currentAttempts + 1,
    }).eq("id", order_id);

    // Get driver's profile (email, name) for notifications
    const { data: driverProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", chosen.user_id)
      .single();

    // Get order client name
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", order.user_id)
      .single();

    const clientName = clientProfile?.name || "Client";
    const orderTotal = order.total_price;
    const deliveryAddress = (order.delivery_address_snapshot as any)?.full_address || "Adresse non disponible";

    // Send push notification to driver
    if (driverProfile) {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: chosen.user_id,
          title: "🚚 Nouvelle livraison !",
          body: `Commande de ${clientName} — ${orderTotal.toFixed(2)} MAD • ${chosen.distance.toFixed(1)} km`,
          data: { order_id, type: "delivery_request" },
        },
      }).catch((err: any) => console.error("Push to driver failed:", err));
    }

    // Send email notification to driver
    if (driverProfile?.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const driverName = escapeHtml(driverProfile.name || "Livreur");
        const safeClientName = escapeHtml(clientName);
        const safeAddress = escapeHtml(deliveryAddress);
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #D3111A 0%, #b30f16 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🚚 Nouvelle Livraison !</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none;">
              <p style="font-size: 16px;">Bonjour <strong>${driverName}</strong>,</p>
              <p>Une nouvelle commande vous a été attribuée. Vous avez <strong>60 secondes</strong> pour accepter.</p>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #D3111A;">📦 Détails</h3>
                <p style="margin: 5px 0;"><strong>Client :</strong> ${safeClientName}</p>
                <p style="margin: 5px 0;"><strong>Total :</strong> ${orderTotal.toFixed(2)} MAD</p>
                <p style="margin: 5px 0;"><strong>Distance boutique :</strong> ${chosen.distance.toFixed(1)} km</p>
                ${estimatedDuration ? `<p style="margin: 5px 0;"><strong>Durée estimée :</strong> ~${estimatedDuration} min</p>` : ""}
                <p style="margin: 5px 0;"><strong>Adresse :</strong> ${safeAddress}</p>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://chezmima.lovable.app/driver" style="background: #D3111A; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Ouvrir l'application livreur</a>
              </div>
              <p style="color: #666; font-size: 13px; text-align: center;">⏱️ Cette demande expire dans 60 secondes</p>
            </div>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e5e5; border-top: none;">
              <p style="margin: 0; color: #666; font-size: 12px;">© 2024 Chez Mima - Tous droits réservés</p>
            </div>
          </body>
          </html>
        `;

        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Chez Mima <contact@chezmima.app>",
            to: [driverProfile.email],
            subject: `🚚 Nouvelle livraison — ${clientName.replace(/[\r\n]/g, " ").slice(0, 80)} (${orderTotal.toFixed(2)} MAD)`,
            html: emailHtml,
          }),
        }).catch((err: any) => console.error("Email to driver failed:", err));
      }
    }

    return new Response(JSON.stringify({
      status: "assigned",
      driver_id: chosen.id,
      distance: chosen.distance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
