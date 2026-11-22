// Fiyat Avcısı servis çalışanı: telefona gelen bildirimi gösterir, uygulama kabuğunu çevrimdışı açar.
// __KABUK__ sunucuda sürüm kimliğiyle değiştirilir; kabuk değişince telefonlar yeni sürümü alır.

const KABUK = '__KABUK__';
const ONBELLEK = `fa-${KABUK}`;
const DOSYALAR = [
  '/', '/stil.css', '/uygulama.js', '/ikon/ikon-192.png',
  '/fonts/sofia-sans-latin.woff2', '/fonts/sofia-sans-latin-ext.woff2',
  '/fonts/sofia-sans-dar-latin.woff2', '/fonts/sofia-sans-dar-latin-ext.woff2',
];

self.addEventListener('install', (olay) => {
  olay.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(DOSYALAR)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a.startsWith('fa-') && a !== ONBELLEK).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (olay) => {
  const istek = olay.request;
  const u = new URL(istek.url);
  if (istek.method !== 'GET' || u.origin !== self.location.origin) return;
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.well-known/') || u.pathname === '/manifest.webmanifest' || u.pathname === '/saglik') return;
  // Önce ağ (güncel sürüm), ağ yoksa önbellek (çevrimdışı açılış)
  olay.respondWith(
    fetch(istek)
      .then((yanit) => {
        if (yanit.ok) {
          const kopya = yanit.clone();
          caches.open(ONBELLEK).then((c) => c.put(istek, kopya)).catch(() => {});
        }
        return yanit;
      })
      .catch(() => caches.match(istek, { ignoreSearch: true }).then((y) => y || caches.match('/'))),
  );
});

self.addEventListener('push', (olay) => {
  let v = {};
  try { v = olay.data ? olay.data.json() : {}; } catch { v = { govde: olay.data ? olay.data.text() : '' }; }
  const secenek = {
    body: v.govde || '',
    icon: '/ikon/ikon-192.png',
    badge: '/ikon/rozet-96.png',
    lang: 'tr',
    data: { adres: typeof v.adres === 'string' && v.adres.startsWith('/') ? v.adres : '/' },
  };
  if (v.etiket) { secenek.tag = String(v.etiket); secenek.renotify = true; }
  olay.waitUntil(self.registration.showNotification(v.baslik || 'Fiyat Avcısı', secenek));
});

self.addEventListener('notificationclick', (olay) => {
  olay.notification.close();
  const adres = (olay.notification.data && olay.notification.data.adres) || '/';
  olay.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((pencereler) => {
      for (const p of pencereler) {
        if ('focus' in p) {
          p.postMessage({ tur: 'git', adres });
          return p.focus();
        }
      }
      return self.clients.openWindow(adres);
    }),
  );
});
