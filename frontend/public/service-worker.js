/* eslint-disable no-restricted-globals */

// AirYatra Service Worker for Offline Mode + Map Tile Caching
const CACHE_NAME = 'airyatra-cache-v3';
const MAP_CACHE_NAME = 'airyatra-map-tiles-v1';
const OFFLINE_URL = '/offline.html';

// Map tile cache configuration
const MAP_TILE_CONFIG = {
  maxTiles: 2000,          // Max tiles to cache (~50MB at ~25KB/tile)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  tileProviders: [
    'tile.openstreetmap.org',
    'a.tile.openstreetmap.org',
    'b.tile.openstreetmap.org', 
    'c.tile.openstreetmap.org',
    'tiles.stadiamaps.com',
    'cartodb-basemaps-a.global.ssl.fastly.net',
    'cartodb-basemaps-b.global.ssl.fastly.net',
    'cartodb-basemaps-c.global.ssl.fastly.net'
  ]
};

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

// API routes to cache with network-first strategy
const API_CACHE_ROUTES = [
  '/api/content/fleet',
  '/api/content/testimonials',
  '/api/content/blog',
  '/api/exchange/listings',
  '/api/operations/map/live'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.log('[ServiceWorker] Failed to cache some assets:', err);
        });
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // MAP TILE CACHING - Cache first for offline maps
  if (isMapTileRequest(url)) {
    event.respondWith(handleMapTileRequest(request, url));
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone();
          
          // Cache successful API responses
          if (response.ok && API_CACHE_ROUTES.some(route => url.pathname.includes(route))) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline JSON response
            return new Response(
              JSON.stringify({ error: 'offline', message: 'You are offline' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets - Cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone and cache the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Network failed and not in cache
            if (request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// ============ MAP TILE CACHING FUNCTIONS ============

// Check if request is for a map tile
function isMapTileRequest(url) {
  return MAP_TILE_CONFIG.tileProviders.some(provider => url.hostname.includes(provider)) ||
         url.pathname.match(/\/\d+\/\d+\/\d+\.(png|jpg|webp)$/);
}

// Handle map tile requests with cache-first strategy
async function handleMapTileRequest(request, url) {
  try {
    // Try cache first
    const cache = await caches.open(MAP_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cached tile is still fresh
      const cachedDate = cachedResponse.headers.get('sw-cached-date');
      if (cachedDate) {
        const age = Date.now() - parseInt(cachedDate);
        if (age < MAP_TILE_CONFIG.maxAge) {
          console.log('[MapCache] Serving from cache:', url.pathname);
          return cachedResponse;
        }
      } else {
        // No date header, serve anyway
        return cachedResponse;
      }
    }

    // Not in cache or expired, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache with timestamp
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      
      const cachedResponseWithDate = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // Cache the tile (with LRU cleanup if needed)
      cacheTileWithLimit(cache, request, cachedResponseWithDate);
      
      console.log('[MapCache] Cached new tile:', url.pathname);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, return cached tile even if expired
    const cache = await caches.open(MAP_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[MapCache] Offline - serving stale tile:', url.pathname);
      return cachedResponse;
    }
    
    // Return a placeholder tile for offline mode
    return createOfflineTileResponse();
  }
}

// Cache tile with LRU-style cleanup when limit reached
async function cacheTileWithLimit(cache, request, response) {
  try {
    const keys = await cache.keys();
    
    // If at limit, delete oldest 10%
    if (keys.length >= MAP_TILE_CONFIG.maxTiles) {
      const deleteCount = Math.floor(MAP_TILE_CONFIG.maxTiles * 0.1);
      console.log(`[MapCache] Cache full (${keys.length}), deleting ${deleteCount} oldest tiles`);
      
      for (let i = 0; i < deleteCount && i < keys.length; i++) {
        await cache.delete(keys[i]);
      }
    }
    
    await cache.put(request, response);
  } catch (error) {
    console.error('[MapCache] Error caching tile:', error);
  }
}

// Create a simple gray placeholder tile for offline mode
function createOfflineTileResponse() {
  // 1x1 gray PNG pixel (base64)
  const grayPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const blob = Uint8Array.from(atob(grayPixel), c => c.charCodeAt(0));
  
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Offline-Tile': 'true'
    }
  });
}

// Get map cache stats (can be called from main thread via postMessage)
async function getMapCacheStats() {
  try {
    const cache = await caches.open(MAP_CACHE_NAME);
    const keys = await cache.keys();
    
    let totalSize = 0;
    for (const request of keys.slice(0, 100)) { // Sample first 100
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
    
    const avgSize = keys.length > 0 ? totalSize / Math.min(keys.length, 100) : 0;
    const estimatedTotal = avgSize * keys.length;
    
    return {
      tileCount: keys.length,
      maxTiles: MAP_TILE_CONFIG.maxTiles,
      estimatedSizeMB: (estimatedTotal / (1024 * 1024)).toFixed(2),
      maxSizeMB: ((MAP_TILE_CONFIG.maxTiles * 25 * 1024) / (1024 * 1024)).toFixed(0)
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Clear map cache
async function clearMapCache() {
  try {
    await caches.delete(MAP_CACHE_NAME);
    console.log('[MapCache] Cache cleared');
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// Pre-cache tiles for a specific region (India major cities)
async function preCacheRegion(bounds, zoomLevels = [8, 10, 12]) {
  const cache = await caches.open(MAP_CACHE_NAME);
  let cached = 0;
  
  for (const zoom of zoomLevels) {
    const tiles = getTilesInBounds(bounds, zoom);
    
    for (const tile of tiles) {
      if (cached >= 500) break; // Limit pre-caching
      
      const url = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;
      const request = new Request(url);
      
      const existing = await cache.match(request);
      if (!existing) {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response);
            cached++;
          }
        } catch (e) {
          // Ignore individual tile failures
        }
      }
    }
  }
  
  return { cached };
}

// Calculate tile coordinates for a bounding box
function getTilesInBounds(bounds, zoom) {
  const tiles = [];
  const { north, south, east, west } = bounds;
  
  const minX = lon2tile(west, zoom);
  const maxX = lon2tile(east, zoom);
  const minY = lat2tile(north, zoom);
  const maxY = lat2tile(south, zoom);
  
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
}

function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'GET_MAP_CACHE_STATS':
      const stats = await getMapCacheStats();
      event.ports[0].postMessage(stats);
      break;
      
    case 'CLEAR_MAP_CACHE':
      const clearResult = await clearMapCache();
      event.ports[0].postMessage(clearResult);
      break;
      
    case 'PRE_CACHE_REGION':
      const cacheResult = await preCacheRegion(data.bounds, data.zoomLevels);
      event.ports[0].postMessage(cacheResult);
      break;
      
    default:
      console.log('[ServiceWorker] Unknown message type:', type);
  }
});

// Background sync for offline bookings
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);
  
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncOfflineBookings());
  }
});

// Sync offline bookings when back online
async function syncOfflineBookings() {
  try {
    const db = await openOfflineDB();
    const bookings = await getOfflineBookings(db);
    
    for (const booking of bookings) {
      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(booking.data)
        });
        
        if (response.ok) {
          await removeOfflineBooking(db, booking.id);
          console.log('[ServiceWorker] Synced booking:', booking.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync booking:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// IndexedDB helpers for offline data
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('airyatra-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-bookings')) {
        db.createObjectStore('offline-bookings', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getOfflineBookings(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-bookings'], 'readonly');
    const store = transaction.objectStore('offline-bookings');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeOfflineBooking(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-bookings'], 'readwrite');
    const store = transaction.objectStore('offline-bookings');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AirYatra';
  const options = {
    body: data.body || 'New notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});
