/**
 * Mission Control Service Worker
 * Handles offline support, caching, and background sync
 * Phase 5D: Mobile & PWA Support
 */

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `mission-control-static-${CACHE_VERSION}`,
  dynamic: `mission-control-dynamic-${CACHE_VERSION}`,
  images: `mission-control-images-${CACHE_VERSION}`,
};

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/globals.css',
  '/offline.html', // Fallback for offline state (Phase 5D)
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.static);
        await staticCache.addAll(STATIC_ASSETS);
        console.log('[Service Worker] Static assets cached');
        self.skipWaiting();
      } catch (error) {
        console.error('[Service Worker] Install error:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => !Object.values(CACHE_NAMES).includes(name))
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
        self.clients.claim();
        console.log('[Service Worker] Activated');
      } catch (error) {
        console.error('[Service Worker] Activate error:', error);
      }
    })()
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - network first with fallback to cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Image assets - cache first with network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.images));
    return;
  }

  // HTML, CSS, JS - stale while revalidate
  if (
    request.destination === 'document' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.dynamic);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Network request failed, using cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page for navigation requests (Phase 5D)
    if (request.mode === 'navigate') {
      const offlineCache = await caches.open(CACHE_NAMES.static);
      const offlinePage = await offlineCache.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    // Fallback text response
    return new Response('Offline - Please check your connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
    });
  }
}

/**
 * Cache First Strategy
 * Return from cache if available, otherwise fetch from network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Cache first strategy failed:', error);
    return new Response('Offline - Resource unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Stale While Revalidate Strategy
 * Return cached version immediately, update cache in background
 */
async function staleWhileRevalidateStrategy(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAMES.static);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  });

  return cached || fetchPromise;
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[Service Worker] All caches cleared');
    })();
  }
});

// Periodic background sync (for task updates, notifications, etc.)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

/**
 * Sync tasks with server when connection is restored
 */
async function syncTasks() {
  try {
    console.log('[Service Worker] Syncing tasks...');
    // Implementation would fetch pending updates from IndexedDB and sync with server
    return true;
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error;
  }
}
