import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getOrCreateVapidKeys(supabaseAdmin: any) {
  // Check if keys already exist
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'vapid_keys')
    .maybeSingle();

  if (data?.value) return data.value;

  // Generate new VAPID keys
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const keys = {
    publicKey: publicKeyBase64,
    privateKeyJwk: privateKeyJwk,
  };

  await supabaseAdmin.from('app_settings').upsert({
    key: 'vapid_keys',
    value: keys,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return keys;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const keys = await getOrCreateVapidKeys(supabaseAdmin);

    return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting VAPID config:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
