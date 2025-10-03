/* ShopSignals SW v2: App shell + snapshot cache + API fallback + scan queue */
const APP_SHELL = [
  '/', '/index.html',
];
const CACHE_APP = 'ss-app-v2';
const CACHE_SNAPSHOTS = 'ss-snapshots-v2';
const CACHE_FONTS = 'ss-fonts-v2';
const SNAPSHOT_PREFIX = '/storage/v1/object/public/snapshots/';
const API_PREFIX = '/functions/v1/';
const OFFLINE_FALLBACK_HTML = '/index.html';

// Simple in-SW queue for scans when offline
const SCAN_QUEUE_KEY = 'ss-scan-queue';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    await cache.addAll(APP_SHELL);
    console.log('[SW] App shell cached');
    
    // Notify clients that an update is available
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'SW_UPDATE_AVAILABLE' }));
    });
    
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (![CACHE_APP, CACHE_SNAPSHOTS, CACHE_FONTS].includes(k)) {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }
    }));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
      console.log('[SW] Navigation preload enabled');
    }
    
    // Flush any queued scans (iOS fallback)
    if (navigator.onLine) {
      await flushScanQueue();
    }
    
    self.clients.claim();
    console.log('[SW] Service worker activated');
  })());
});

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  if (event.tag === 'scan-queue') {
    event.waitUntil(flushScanQueue());
  }
});

async function flushScanQueue() {
  console.log('[SW] Flushing scan queue...');
  const queue = await readQueue();
  const remaining = [];
  for (const item of queue) {
    try {
      await fetch(item.url, { method: 'POST', headers: item.headers, body: item.body });
      console.log('[SW] Queued scan sent:', item.url);
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  console.log('[SW] Queue flushed. Remaining:', remaining.length);
}

async function readQueue() {
  const cache = await caches.open(CACHE_APP);
  const res = await cache.match(SCAN_QUEUE_KEY);
  if (!res) return [];
  try { return await res.json(); } catch { return []; }
}

async function writeQueue(items) {
  const cache = await caches.open(CACHE_APP);
  await cache.put(SCAN_QUEUE_KEY, new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } }));
}

async function enqueueScan(req) {
  const body = await req.clone().text();
  const item = { url: req.url, headers: Object.fromEntries(req.headers.entries()), body };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  console.log('[SW] Scan enqueued:', item.url);
  if ('sync' in self.registration) {
    try { 
      await self.registration.sync.register('scan-queue');
      console.log('[SW] Background sync registered');
    } catch {}
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Don't cache /scan page (camera/MediaStream must be fresh)
  if (url.pathname === '/scan' || url.pathname.startsWith('/scan/')) {
    event.respondWith(fetch(request));
    return;
  }

  // App navigation: Network-first with fallback to shell
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const res = await fetch(request);
        return res;
      } catch {
        console.log('[SW] Navigate offline, using fallback');
        const cache = await caches.open(CACHE_APP);
        const cached = await cache.match(OFFLINE_FALLBACK_HTML);
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Cache fonts
  if (url.origin === location.origin && url.pathname.endsWith('.woff2')) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // Snapshots: cache-first, revalidate in background
  if (url.pathname.startsWith(SNAPSHOT_PREFIX) || url.pathname.endsWith('/latest.json')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_SNAPSHOTS));
    return;
  }

  // API: network-first, fallback to cached; queue scans when offline
  if (url.pathname.startsWith(API_PREFIX)) {
    const isScan = url.pathname.includes('/resolve-barcode') && request.method === 'POST';
    if (isScan) {
      event.respondWith((async () => {
        try {
          const res = await fetch(request.clone());
          return res;
        } catch {
          console.log('[SW] Scan offline, queueing...');
          await enqueueScan(request);
          return new Response(JSON.stringify({
            success: false,
            queued: true,
            error: 'offline',
            message: 'Scan queued; will retry when online.'
          }), { status: 202, headers: { 'Content-Type': 'application/json' } });
        }
      })());
      return;
    }

    if (request.method === 'GET') {
      event.respondWith(networkFirst(request, CACHE_APP));
      return;
    }
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) {
    fetch(request).then((res) => res.ok && cache.put(request, res.clone())).catch(() => {});
    return hit;
  }
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const net = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res.clone();
  }).catch(() => null);
  return hit || net || new Response('Offline', { status: 503 });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response('Offline', { status: 503 });
  }
}

// Push notification handlers
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  const data = event.data?.json() ?? {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ShopSignals', {
      body: data.body || 'New update available',
      icon: data.icon || '/placeholder.svg',
      badge: data.badge || '/favicon.ico',
      data: data.data || {},
      tag: data.tag || 'default',
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const brandId = event.notification.data?.brand_id;
  const url = brandId ? `/brand/${brandId}` : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Flush scan queue on activation (iOS fallback)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (![CACHE_APP, CACHE_SNAPSHOTS, CACHE_FONTS].includes(k)) {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }
    }));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
      console.log('[SW] Navigation preload enabled');
    }
    
    // Flush any queued scans (iOS fallback)
    if (navigator.onLine) {
      await flushScanQueue();
    }
    
    self.clients.claim();
    console.log('[SW] Service worker activated');
  })());
});
