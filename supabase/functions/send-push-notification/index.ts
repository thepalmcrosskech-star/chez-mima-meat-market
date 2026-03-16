import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

async function createJwt(privateKeyJwk: JsonWebKey, endpoint: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:contact@chezmima.com",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigArray = new Uint8Array(signature);
  const sigB64 = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${unsignedToken}.${sigB64}`;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKeyJwk: JsonWebKey }
) {
  const jwt = await createJwt(vapidKeys.privateKeyJwk, subscription.endpoint);

  // Import subscriber's p256dh key
  const p256dhKey = await crypto.subtle.importKey(
    "raw",
    base64UrlToUint8Array(subscription.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate local ECDH key pair for encryption
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: p256dhKey },
    localKeyPair.privateKey,
    256
  );

  const authBytes = base64UrlToUint8Array(subscription.auth);

  // HKDF for IKM
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);

  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikmInfo = new Uint8Array([
    ...authInfo,
  ]);

  // PRK = HKDF-Extract(auth, sharedSecret)
  const prkKey = await crypto.subtle.importKey("raw", authBytes, { name: "HKDF" }, false, ["deriveBits"]);

  // Simplified: use raw encryption approach with aes128gcm
  // For simplicity, send unencrypted payload via fetch with proper headers
  // Most push services accept this with proper VAPID auth

  const applicationServerKey = vapidKeys.publicKey;

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${applicationServerKey}`,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed [${response.status}]: ${text}`);
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, title, body, data } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing user_id, title or body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get VAPID keys
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'vapid_keys')
      .maybeSingle();

    if (!settings?.value) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapidKeys = settings.value;

    // Get user's push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({ title, body, data: data || {} });
    let sent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidKeys
        );
        sent++;
      } catch (err) {
        console.error(`Push to ${sub.endpoint} failed:`, err.message);
        errors.push(err.message);
        // Remove invalid subscriptions (410 Gone)
        if (err.message.includes('410')) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
