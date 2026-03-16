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
    const { action, orderId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
      // Get order details
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      // Admin captures the pre-authorized amount
      // This will be implemented when CMI credentials are ready
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
