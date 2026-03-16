// Push notification service worker handler
// This file is loaded by the PWA service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [],
      tag: data.data?.order_id || 'default',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Chez Mima', options)
    );
  } catch (e) {
    console.error('Push event error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const orderId = event.notification.data?.order_id;
  const url = orderId ? `/order-tracking/${orderId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
