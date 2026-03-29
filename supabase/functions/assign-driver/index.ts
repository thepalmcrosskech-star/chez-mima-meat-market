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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Check max attempts
    const currentAttempts = order.assignment_attempts || 0;
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
