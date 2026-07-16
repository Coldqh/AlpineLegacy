import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const OFFLINE_CACHE = 'alpine-legacy-0.20.0';

function offlineServiceWorker(): Plugin {
  let base = './';

  return {
    name: 'alpine-offline-service-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base || './';
    },
    generateBundle(_options, bundle) {
      const prefix = base.endsWith('/') ? base : `${base}/`;
      const files = new Set([
        '',
        'index.html',
        'manifest.webmanifest',
        'version.json',
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png',
        'icons/icon-180.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        ...Object.values(bundle)
          .map(output => output.fileName)
          .filter(file => !file.endsWith('.map') && file !== 'sw.js'),
      ]);
      const appShell = [...files].map(file => `${prefix}${file}`);

      const source = `const CACHE_NAME=${JSON.stringify(OFFLINE_CACHE)};
const APP_SHELL=${JSON.stringify(appShell)};
const INDEX_URL=${JSON.stringify(`${prefix}index.html`)};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(INDEX_URL)) || (await caches.match(${JSON.stringify(prefix)})))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
`;

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  base: './',
});
