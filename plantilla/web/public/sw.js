// Avisos y arranque sin red. Nunca guarda datos de la API: solo la cáscara de la app.
const CACHE = 'oficina-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
	const u = new URL(e.request.url);
	if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
	e.respondWith(fetch(e.request).then(r => {
		if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
		return r;
	}).catch(() => caches.match(e.request).then(r => r ?? caches.match('/'))));
});
self.addEventListener('push', e => {
	const a = e.data ? e.data.json() : {};
	// Siempre se enseña: iOS retira los avisos a quien recibe push y no muestra nada.
	e.waitUntil(self.registration.showNotification(a.titulo || 'La Oficina', { body: a.cuerpo || '', icon: '/iconos/192.png', data: { url: a.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
	e.notification.close();
	const url = e.notification.data?.url || '/';
	e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
		if (cs[0]) { cs[0].focus(); return cs[0].navigate(url); }
		return self.clients.openWindow(url);
	}));
});
