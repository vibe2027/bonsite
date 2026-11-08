/**
 * VIBE PWA Service Worker
 * Offline support, caching strategy, background sync
 */

const CACHE_NAME = 'vibe-v1.1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin-dashboard-ui.html',
  '/co-founder-dashboard.html',
  '/css/style.css',
  '/js/salons.js',
  '/js/ui-salons.js',
  '/js/salon-effects.js',
  '/js/haptic.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - network first
  if (request.url.includes('/api/') || request.url.includes('/auth/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first
  if (
    request.url.endsWith('.js') ||
    request.url.endsWith('.css') ||
    request.url.endsWith('.png') ||
    request.url.endsWith('.jpg') ||
    request.url.endsWith('.svg')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - network first
  if (request.url.endsWith('.html') || request.url.endsWith('/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (!response || response.status !== 200) return response;

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.error('Cache first failed:', err);
    throw err;
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Background sync for messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  try {
    const db = await openIndexedDB();
    const pending = await getPendingMessages(db);

    for (const msg of pending) {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg)
        });

        await removePendingMessage(db, msg.id);
      } catch (err) {
        console.error('Failed to sync message:', err);
      }
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vibe-offline', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      event.target.result.createObjectStore('pending-messages', { keyPath: 'id' });
    };
  });
}

function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-messages', 'readonly');
    const store = tx.objectStore('pending-messages');
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function removePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-messages', 'readwrite');
    const store = tx.objectStore('pending-messages');
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === '/' && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
