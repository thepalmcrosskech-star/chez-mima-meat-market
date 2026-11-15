import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, orderId } = await req.json();

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check CMI credentials are configured
    const cmiMerchantId = Deno.env.get("CMI_MERCHANT_ID");
    const cmiStoreKey = Deno.env.get("CMI_STORE_KEY");
    const cmiGatewayUrl = Deno.env.get("CMI_GATEWAY_URL");

    if (!cmiMerchantId || !cmiStoreKey || !cmiGatewayUrl) {
      return new Response(
        JSON.stringify({
          error: "CMI payment not configured yet",
          message: "Le paiement par carte n'est pas encore disponible.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "initiate") {
      if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) {
        return new Response(JSON.stringify({ error: "Invalid orderId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("user_id", userId)
        .single();

      if (orderErr || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count: itemCount, error: itemsError } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);
      if (itemsError || !itemCount || order.payment_method !== "card" || order.payment_status !== "pending" || order.total_price <= 0) {
        return new Response(JSON.stringify({ error: "Order is not eligible for card payment" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate CMI form data with HMAC signature
      const amount = order.total_price.toFixed(2);
      const currency = "504"; // MAD currency code
      const oid = `ORDER-${order.id.slice(0, 8).toUpperCase()}`;

      // Build hash string per CMI spec
      const hashData = [
        cmiMerchantId,
        oid,
        amount,
        currency,
        "1", // rnd
        "PreAuth", // trantype - pre-authorization
      ].join("|");

      // HMAC-SHA512 signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(cmiStoreKey),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(hashData)
      );
      const hash = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Update order with CMI reference
      await supabase
        .from("orders")
        .update({
          cmi_order_id: oid,
          payment_status: "pending",
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({
          gatewayUrl: cmiGatewayUrl,
          formData: {
            clientid: cmiMerchantId,
            oid,
            amount,
            currency,
            TranType: "PreAuth",
            hash,
            okUrl: `${supabaseUrl}/functions/v1/cmi-payment/callback?status=ok`,
            failUrl: `${supabaseUrl}/functions/v1/cmi-payment/callback?status=fail`,
            callbackUrl: `${supabaseUrl}/functions/v1/cmi-payment/callback`,
            lang: "fr",
            encoding: "UTF-8",
            storetype: "3D_PAY_HOSTING",
            refreshtime: "5",
            rnd: "1",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "capture") {
      const { data: isAdmin, error: roleError } = await supabase.rpc("has_admin_role", { user_id: userId });
      if (roleError || !isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ message: "Capture not yet implemented" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
