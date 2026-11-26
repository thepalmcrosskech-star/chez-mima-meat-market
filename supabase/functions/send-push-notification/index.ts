import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";
import { canNotifyOrderOwner, orderStatusNotification } from "../_shared/notification-policy.ts";


async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKeyJwk: JsonWebKey }
) {
  const privateKeyBase64Url = vapidKeys.privateKeyJwk.d;
  if (!privateKeyBase64Url) throw new Error("VAPID private key missing");
  webpush.setVapidDetails("mailto:contact@chezmima.app", vapidKeys.publicKey, privateKeyBase64Url);
  try {
    // web-push encrypts the payload with aes128gcm (RFC 8291) and signs the VAPID JWT.
    return await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      { TTL: 86400 },
    );
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    const body = (error as { body?: string }).body ?? (error instanceof Error ? error.message : String(error));
    throw new Error(`Push failed [${status ?? "unknown"}]: ${body}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Server configuration missing');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, title, body, data } = await req.json();

    if (typeof user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
      return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const isInternal = token === serviceRoleKey;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = isInternal
      ? { data: null, error: null }
      : await supabaseAuth.auth.getClaims(token);
    const claims = claimsData?.claims;
    if (!isInternal && (claimsError || !claims)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isInternal) {
      const callerId = typeof claims?.sub === 'string' ? claims.sub : null;
      const orderId = data?.order_id;
      const { data: isStaff } = callerId
        ? await supabaseAdmin.rpc('has_staff_access', { user_id: callerId })
        : { data: false };
      if (!isStaff || typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: order, error: orderError } = await supabaseAdmin.from('orders')
        .select('id, user_id, status, delivery_mode').eq('id', orderId).maybeSingle();
      if (orderError || !order || !canNotifyOrderOwner(callerId, isStaff === true, order.user_id, user_id)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let notification = orderStatusNotification(order);
      if (data?.latest_notification === true) {
        // Article retiré/remplacé : renvoie la dernière notification enregistrée par le serveur pour cette commande
        const { data: latest } = await supabaseAdmin.from('notifications')
          .select('title, message, created_at').eq('order_id', order.id).eq('user_id', order.user_id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        notification = latest && Date.now() - new Date(latest.created_at).getTime() < 5 * 60 * 1000
          ? { title: latest.title, body: latest.message, data: { order_id: order.id } }
          : null;
      }
      if (!notification) {
        return new Response(JSON.stringify({ error: 'Order status cannot be notified' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      ({ title, body, data } = notification);
    }
    if (typeof title !== 'string' || title.length > 120 || typeof body !== 'string' || body.length > 1000) {
      return new Response(JSON.stringify({ error: 'Invalid notification content' }), {
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
