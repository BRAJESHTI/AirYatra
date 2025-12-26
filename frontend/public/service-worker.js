// Service Worker for AirYatra - Offline Support & Caching
const CACHE_NAME = 'airyatra-v1';
const STATIC_CACHE = 'airyatra-static-v1';
const API_CACHE = 'airyatra-api-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json'
];

// API endpoints to cache
const CACHEABLE_API = [
  '/api/landing/points',
  '/api/fleet/aircraft-types',
  '/api/routes/locations',
  '/api/knowledge/categories',
  '/api/knowledge/faqs',
  '/api/settings/public'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.some(path => url.pathname.startsWith(path))) {
      event.respondWith(networkFirstStrategy(request, API_CACHE, 300)); // 5 min TTL
    }
    return;
  }

  // Static assets - Cache first, network fallback
  event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
});

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Refresh cache in background
    fetchAndCache(request, cache);
    return cachedResponse;
  }
  
  return fetchAndCache(request, cache);
}

// Network-first strategy (for API calls)
async function networkFirstStrategy(request, cacheName, ttlSeconds) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache response with timestamp
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Fetch and cache helper
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
