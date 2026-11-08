const CACHE = 'vibe-v7-live';
const SHELL = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  '/js/salons.js',
  '/js/vibe-fix.js',
  '/js/vibe-fixes.js',
  '/js/stripe-config.js',
  '/js/vibe-live.js',
  '/js/vibe-security.js',
  '/js/haptic.js',
  '/js/hq-qg.js',
  '/robots.txt',
  '/sitemap.xml'
];
const INJECT =
  '<script src="/js/stripe-config.js?v=6"><\/script>' +
  '<script src="/js/vibe-fixes.js?v=6" defer><\/script>' +
  '<script src="/js/vibe-live.js?v=6" defer><\/script>' +
  '<script src="/js/vibe-security.js?v=6" defer><\/script>';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function injectFixes(html) {
  if (!html || html.indexOf('vibe-security.js') !== -1) return html;
  if (html.indexOf('</head>') !== -1) return html.replace('</head>', INJECT + '\n</head>');
  if (html.indexOf('</body>') !== -1) return html.replace('</body>', INJECT + '\n</body>');
  return html + INJECT;
}


// ── Montre / notifications : actions du Mode Ange ──
self.addEventListener('notificationclick', (e) => {
  const action = e.action;
  e.notification.close();
  if (action === 'ok') return;
  if (action === 'sos') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        if (list.length) {
          list[0].postMessage({ type: 'vibe-sos' });
          return list[0].focus && list[0].focus();
        }
        // Aucune fenêtre ouverte : on ouvre l'app, qui demandera confirmation avant d'envoyer le SOS.
        return self.clients.openWindow('/#sos-montre');
      })
    );
    return;
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length && list[0].focus) return list[0].focus();
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHTML) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) {
            const cached = await caches.match(e.request);
            if (cached) {
              return new Response(injectFixes(await cached.text()), {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            }
            return res;
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('text/html') && !ct.includes('text/plain')) return res;
          const text = await res.text();
          const headers = new Headers(res.headers);
          headers.set('Content-Type', 'text/html; charset=utf-8');
          headers.set('Cache-Control', 'no-cache');
          return new Response(injectFixes(text), {
            status: res.status,
            statusText: res.statusText,
            headers: headers
          });
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          if (cached) {
            return new Response(injectFixes(await cached.text()), {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
          return caches.match('/index.html');
        })
    );
    return;
  }

  if (url.pathname.indexOf('/js/') === 0) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
