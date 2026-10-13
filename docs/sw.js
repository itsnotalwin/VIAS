const DB_NAME = 'VIAS_ShareTarget';
const STORE_NAME = 'shared_items';
const CACHE_NAME = 'vias-v9';

function scopeUrl(path) {
  try {
    const u = new URL(path);
    return u.toString();
  } catch (e) {
    return new URL(path, self.registration.scope).toString();
  }
}

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './logo.svg',
  './manifest.json',
  './icon-1024.jpg'
];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    store.add(item);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const mapped = ASSETS_TO_CACHE.map((p) => scopeUrl(p));
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(mapped);
      } catch (err) {
        console.error('SW install cache.addAll failed:', err);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const title = formData.get('title');
        const text = formData.get('text');
        const shareUrl = formData.get('url');
        const files = formData.getAll('images');

        await saveSharedItem({
          title: title || '',
          text: text || '',
          url: shareUrl || '',
          files: files && files.length ? files : [],
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Share Target Error:', err);
      }
      const targetUrl = new URL('?shared=1', self.registration.scope).toString();
      return Response.redirect(targetUrl, 303);
    })());
    return;
  }

  if (event.request.method === 'GET') {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            try {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            } catch (e) {}
            return networkResponse;
          })
          .catch(() => {
            return caches.match(event.request).then((response) => response || caches.match(scopeUrl('index.html')) || caches.match(scopeUrl('./'));
          })
      );
      return;
    }

    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;

        return fetch(event.request).then((networkResponse) => {
          const isFont = url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com';
          const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2)$/);

          if (networkResponse && networkResponse.ok && (isFont || isStaticAsset) && !url.pathname.includes('/api/')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        }).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(scopeUrl('index.html')) || caches.match(scopeUrl('./'));
          }
        });
      })
    );
  }
});
