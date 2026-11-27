import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderConfirmationEmail } from "../_shared/order-confirmation-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, user_id, subtotal, delivery_fee, total_price, delivery_address_snapshot")
      .eq("id", orderId)
      .eq("user_id", claimsData.claims.sub)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: items }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", order.user_id).single(),
      admin.from("order_items").select("product_name, quantity, line_total").eq("order_id", order.id).neq("item_status", "removed"),
    ]);
    if (!profile?.email || !items?.length) {
      return new Response(JSON.stringify({ success: false, error: "Order details unavailable" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
    const snapshot = (order.delivery_address_snapshot ?? {}) as Record<string, unknown>;
    const deliveryAddress = [snapshot.full_address ?? snapshot.address ?? snapshot.label, snapshot.city]
      .filter((part) => typeof part === "string" && part.trim()).join(", ") || "Retrait en boutique";
    const subject = "Confirmation de votre commande - Chez Mima";
    const html = getOrderConfirmationEmail({
      customerName: profile.name || "Client",
      orderId: order.id,
      items: items.map((item) => ({ name: item.product_name, quantity: String(item.quantity ?? ""), price: Number(item.line_total) })),
      total: Number(order.total_price),
      deliveryAddress,
    });

    // Always use fixed from address — never allow caller override
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Chez Mima <contact@chezmima.app>",
        to: [profile.email],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Order confirmation sent successfully");

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
