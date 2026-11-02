/* ScanSay app (service worker at the site root so login and dashboard stay inside the installed app): notifications + works offline (shows the last loaded screen and an offline notice). */
const V = 'ss-app-1';
const SHELL = ['/app/', '/app/index.html', '/app/live.js', '/app/offline.html', '/app/icons/icon-192.png', '/app/icons/badge-96.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /^\/(api|admin|sign|form|k)\//.test(u.pathname)) return;   // customer data is never cached
  // network first, so updates are seen at once; the saved copy is only used without internet
  e.respondWith(fetch(r).then(res => {
    if (res.ok && (r.mode === 'navigate' || /^\/(app|brand|fonts)\/|\.(css|js|woff2|svg|png)$/.test(u.pathname))) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); }
    return res;
  }).catch(() => caches.match(r).then(hit => hit || (r.mode === 'navigate' ? caches.match('/app/offline.html') : Response.error()))));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'ScanSay', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ScanSay', {
    body: d.body || '', tag: d.tag || 'scansay', renotify: true, requireInteraction: !!d.urgent,
    icon: '/app/icons/icon-192.png', badge: '/app/icons/badge-96.png', vibrate: d.urgent ? [300, 120, 300, 120, 300] : [120],
    data: { url: d.url || '/app/#inbox' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/app/#inbox', location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.includes('/app/')) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
