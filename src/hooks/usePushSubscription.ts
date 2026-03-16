import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushSubscription() {
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;

    const subscribe = async () => {
      try {
        // Check support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.log('Push notifications not supported');
          return;
        }

        // Check auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        // Get VAPID public key
        const { data: config, error: configError } = await supabase.functions.invoke('push-config');
        if (configError || !config?.publicKey) {
          console.error('Failed to get push config:', configError);
          return;
        }

        // Wait for service worker
        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          });
        }

        const subscriptionJson = subscription.toJSON();

        // Save to database
        await supabase.from('push_subscriptions').upsert({
          user_id: session.user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh!,
          auth: subscriptionJson.keys!.auth!,
        }, { onConflict: 'user_id,endpoint' });

        console.log('Push subscription saved');
      } catch (err) {
        console.error('Push subscription error:', err);
      }
    };

    subscribe();
  }, []);
}
