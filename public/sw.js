// Professional Service Worker for Image Optimization
// Implements advanced caching strategies for generated images

const CACHE_NAME = 'therai-images-v1';
const STATIC_CACHE = 'therai-static-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Image-specific caching rules
const IMAGE_CACHE_RULES = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEntries: 50,
  strategies: {
    // Generated images: Cache-first with network fallback
    generated: /^https:\/\/api\.therai\.co\/storage\/v1\/object\/public\/generated-images\//,
    // Static assets: Network-first
    static: /^https:\/\/api\.therai\.co\/storage\/v1\/object\/public\/therai-assets\//
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Handle image requests with special caching
  if (IMAGE_CACHE_RULES.strategies.generated.test(event.request.url)) {
    event.respondWith(handleGeneratedImageRequest(event.request));
    return;
  }

  // Handle static assets
  if (IMAGE_CACHE_RULES.strategies.static.test(event.request.url)) {
    event.respondWith(handleStaticAssetRequest(event.request));
    return;
  }

  // Default network-first for other requests
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Cache-first strategy for generated images
async function handleGeneratedImageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Check if cache is still fresh
    const cacheTime = cachedResponse.headers.get('sw-cache-time');
    if (cacheTime && (Date.now() - parseInt(cacheTime)) < IMAGE_CACHE_RULES.maxAge) {
      return cachedResponse;
    }
    // Cache expired, remove it
    await cache.delete(request);
  }

  try {
    // Fetch from network
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone the response for caching
      const responseClone = networkResponse.clone();

      // Add cache metadata
      const responseWithMetadata = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...Object.fromEntries(responseClone.headers),
          'sw-cache-time': Date.now().toString(),
          'sw-cache-strategy': 'generated-image-cache-first'
        }
      });

      // Cache the response
      cache.put(request, responseWithMetadata);

      // Enforce cache size limits
      await enforceCacheSize(cache);
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache as fallback
    const fallbackResponse = await cache.match(request);
    if (fallbackResponse) {
      return fallbackResponse;
    }

    // No cache available, return error response
    return new Response('Network and cache unavailable', { status: 503 });
  }
}

// Network-first strategy for static assets
async function handleStaticAssetRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Enforce cache size limits
async function enforceCacheSize(cache) {
  const keys = await cache.keys();

  if (keys.length > IMAGE_CACHE_RULES.maxEntries) {
    // Remove oldest entries (simple FIFO based on cache time)
    const entriesWithTime = await Promise.all(
      keys.map(async (request) => {
        const response = await cache.match(request);
        const cacheTime = response?.headers.get('sw-cache-time') || '0';
        return { request, cacheTime: parseInt(cacheTime) };
      })
    );

    // Sort by cache time (oldest first)
    entriesWithTime.sort((a, b) => a.cacheTime - b.cacheTime);

    // Remove excess entries
    const toDelete = entriesWithTime.slice(0, keys.length - IMAGE_CACHE_RULES.maxEntries);
    await Promise.all(toDelete.map(entry => cache.delete(entry.request)));
  }
}

// Handle background sync for offline image generation
self.addEventListener('sync', (event) => {
  if (event.tag === 'image-generation-sync') {
    event.waitUntil(syncPendingImages());
  }
});

async function syncPendingImages() {
  // Implementation for syncing pending image generations when back online
  // This would integrate with your existing offline queue system
  console.log('Syncing pending images...');
}
