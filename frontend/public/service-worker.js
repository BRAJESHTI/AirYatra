// Service Worker for AirYatra - Offline Support, Push Notifications & Caching
const CACHE_NAME = 'airyatra-v2';
const STATIC_CACHE = 'airyatra-static-v2';
const API_CACHE = 'airyatra-api-v2';
const PILOT_CACHE = 'airyatra-pilot-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/pilot-portal'
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

// Pilot Portal specific APIs to cache for offline
const PILOT_CACHEABLE_API = [
  '/api/pilot/mobile/dashboard',
  '/api/pilot/documents',
  '/api/pilot/flight-logs'
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

  // Pilot Portal APIs - Cache for offline access
  if (PILOT_CACHEABLE_API.some(path => url.pathname.includes(path))) {
    event.respondWith(networkFirstWithPilotCache(request));
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

// Pilot-specific caching with longer TTL and offline support
async function networkFirstWithPilotCache(request) {
  const cache = await caches.open(PILOT_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache response
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // Offline - serve from cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Serving pilot data from offline cache');
      return cachedResponse;
    }
    
    // Return offline error response
    return new Response(JSON.stringify({
      offline: true,
      message: 'You are offline. Showing cached data.',
      cached_at: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
  
  // Cache pilot data on demand
  if (event.data.type === 'CACHE_PILOT_DATA') {
    cachePilotData(event.data.data);
  }
});

// Cache pilot dashboard data manually
async function cachePilotData(data) {
  const cache = await caches.open(PILOT_CACHE);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put('/api/pilot/mobile/dashboard', response);
  console.log('Pilot dashboard data cached for offline');
}

// ==================== PUSH NOTIFICATIONS ====================

// Handle push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'AirYatra Notification',
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'airyatra-notification'
  };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    tag: data.tag || 'airyatra-notification',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/pilot-portal',
      ...data.data
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/pilot-portal';
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
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

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
