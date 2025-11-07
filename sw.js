// sw.js - Service Worker

// This is a basic service worker for handling push notifications.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  // Skip waiting to activate the new service worker immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  // Take control of all clients as soon as the service worker is activated.
  event.waitUntil(self.clients.claim());
});

// Listener for push events (from a push service)
// In our app, we simulate this by calling registration.showNotification() from the client.
// This listener ensures that if a real push service were used, it would be handled correctly.
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  
  // The data sent from a push service would be in event.data
  let data = {
    title: 'Aura Reminder',
    body: 'You have an upcoming event.',
    tag: 'default'
  };
  if (event.data) {
    try {
      // Some push payloads may be empty or malformed; guard against JSON errors
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = parsed;
      }
    } catch (err) {
      // Log and continue with a safe default payload
      console.error('Service Worker: Failed to parse push event data as JSON:', err);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      tag: data.tag || 'default-tag'
    })
  );
});

// Listener for when a user clicks on the notification
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification Click Received.');

  event.notification.close();

  // This code attempts to focus on an already open tab of the app, or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});