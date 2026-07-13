// Service Worker for VYDRA CORE - Offline Support & PWA Features
const CACHE_NAME = 'biomentor-v1'
const RUNTIME_CACHE = 'biomentor-runtime'
const DOCUMENTS_CACHE = 'biomentor-documents'
const API_CACHE = 'biomentor-api'

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/_app.js',
  '/_document.js',
  '/favicon.ico',
  '/manifest.json'
]

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching app shell')
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets could not be cached:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...')
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== DOCUMENTS_CACHE && name !== API_CACHE)
          .map(name => {
            console.log('Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - Network first, then cache
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // For documents - cache first
  if (url.pathname.includes('/api/documents/') && url.pathname.includes('/file')) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response
        }
        return fetch(request).then(response => {
          // Only cache successful document responses
          if (response.ok && response.status === 200) {
            const responseClone = response.clone()
            caches.open(DOCUMENTS_CACHE).then(cache => {
              cache.put(request, responseClone)
            })
          }
          return response
        }).catch(err => {
          console.error('Fetch failed:', err)
          // Return a generic offline page if available
          return caches.match('/offline.html').catch(() => {
            return new Response('Offline - Document not available', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
        })
      })
    )
    return
  }

  // For API calls - network first, then cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(API_CACHE).then(cache => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(err => {
          console.log('API call failed, trying cache:', url.pathname)
          return caches.match(request).then(response => {
            if (response) {
              return response
            }
            // Return offline response
            return new Response(JSON.stringify({ 
              offline: true,
              message: 'You are offline. Some features may not be available.'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          })
        })
    )
    return
  }

  // For static assets - cache first
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response
      }
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const responseClone = response.clone()
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(request, responseClone)
        })
        return response
      }).catch(err => {
        // Return offline fallback
        console.log('Network request failed:', err)
        return caches.match('/offline.html').catch(() => {
          return new Response('offline', { status: 503 })
        })
      })
    })
  )
})

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(DOCUMENTS_CACHE).then(() => {
      console.log('Documents cache cleared')
    })
  }
})

console.log('Service Worker loaded')
