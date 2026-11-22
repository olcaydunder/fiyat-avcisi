import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { uygulamaKur } from '../server.js';
import { getiriciOlustur } from '../src/getir.js';
import { depoAc } from '../src/depo.js';
import { sahteAg, sahteSaat, aramaSayfasi, urunSayfasi, ROBOTS_AKAKCE, MARKET_YANITI } from './yardimci.js';

const AK = 'https://www.akakce.com';
const MF = 'https://api.marketfiyati.org.tr';
const YOL = '/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html';
const KOD = '482913';

async function kur(ekAyar = {}) {
  const ag = sahteAg({
    [`${AK}/robots.txt`]: ROBOTS_AKAKCE,
    [`${AK}/arama/?q=*`]: aramaSayfasi(),
    [`${AK}/cep-telefonu/*`]: urunSayfasi(),
    [`${MF}/api/v2/nearest`]: JSON.stringify([{ id: 'bim-U751' }]),
    [`${MF}/api/v2/search`]: JSON.stringify(MARKET_YANITI),
  });
  const saat = sahteSaat(Date.now());
  const getirici = getiriciOlustur({ fetchImpl: ag.fetchImpl, bekle: saat.bekle });
  const itilen = [];
  const itici = { generateVAPIDKeys: () => webpush.generateVAPIDKeys(), sendNotification: async (a, g) => { itilen.push({ a, g: JSON.parse(g) }); } };
  const ayar = { port: 0, dinle: '127.0.0.1', alan: 'fiyat.1-2-3-4.sslip.io', girisKodu: KOD, veriDizini: null, ajan: '', apkParmakIzi: [], apkPaket: 'tr.fiyatavcisi.twa', surum: 'test123', ...ekAyar };
  const u = uygulamaKur({ ayar, depo: depoAc(null), getirici, itici, gunluk: () => {} });
  const adres = await u.baslat();
  const kok = `http://127.0.0.1:${adres.port}`;
  const iste = async (yol, { yontem = 'GET', govde, kod = KOD, basliklar = {} } = {}) => {
    const y = await fetch(kok + yol, { method: yontem, headers: { ...(kod ? { 'X-Kod': kod } : {}), ...(govde ? { 'Content-Type': 'application/json' } : {}), ...basliklar }, body: govde ? JSON.stringify(govde) : undefined });
    const metin = await y.text();
    let json = null; try { json = JSON.parse(metin); } catch { /* json değil */ }
    return { durum: y.status, json, metin, basliklar: y.headers };
  };
  return { u, iste, ag, itilen, kapat: () => u.durdur() };
}

test('giriş: kod olmadan API kapalı, doğru kodla açık, yanlış denemeler sınırlanır', async (t) => {
  const s = await kur(); t.after(s.kapat);
  assert.equal((await s.iste('/api/durum', { kod: null })).json.surum, 'test123');
  assert.equal((await s.iste('/api/ara?q=iphone+13', { kod: null })).durum, 401);
  assert.equal((await s.iste('/api/ara?q=iphone+13', { kod: '000000' })).durum, 401);
  assert.equal((await s.iste('/api/giris', { yontem: 'POST', kod: null, govde: { kod: KOD } })).json.tamam, true);
  assert.equal((await s.iste('/api/giris', { yontem: 'POST', kod: null, govde: { kod: '111111' } })).durum, 401);
  let son;
  for (let i = 0; i < 9; i++) son = await s.iste('/api/giris', { yontem: 'POST', kod: null, govde: { kod: '222222' } });
  assert.equal(son.durum, 429);
  assert.equal(son.json.hata.tur, 'sinir');
});

test('arama, ürün ayrıntısı ve takip uçtan uca', async (t) => {
  const s = await kur(); t.after(s.kapat);
  const b = await s.iste('/api/baslangic');
  assert.equal(b.durum, 200);
  assert.equal(b.json.ayar.kontrolDakika, 60);
  assert.match(b.json.pushAnahtar, /^[A-Za-z0-9_-]{80,90}$/);

  const a = await s.iste('/api/ara?q=iphone%2013');
  assert.equal(a.durum, 200);
  assert.equal(a.json.urunler.length, 7);
  assert.equal(a.json.onerilenKategori, 'cep-telefonu');
  assert.equal(a.basliklar.get('cache-control'), 'no-store');

  const u = await s.iste(`/api/urun?yol=${encodeURIComponent(YOL)}`);
  assert.equal(u.json.enUcuz.toplam, 51091.54);
  assert.equal(u.json.takipId, null);
  assert.equal((await s.iste('/api/urun?yol=https://kotu.example/a,1.html')).durum, 400);
  assert.equal((await s.iste('/api/ara?q=a')).json.hata.tur, 'bicim');

  const e = await s.iste('/api/takip', { yontem: 'POST', govde: { yol: YOL, ad: 'iPhone 13 128 GB Yıldız Işığı', hedefFiyat: 50000 } });
  assert.equal(e.durum, 200);
  const id = e.json.kayit.id;
  assert.equal(e.json.kayit.fiyat, 51091.54);
  assert.equal(e.json.kayit.magaza, 'idefix');
  assert.equal(e.json.kayit.link, 'https://www.akakce.com/r/?pr=1377791125&vd=13275&pg=1777266314');
  assert.equal((await s.iste(`/api/urun?yol=${encodeURIComponent(YOL)}`)).json.takipId, id);

  const liste = await s.iste('/api/takip');
  assert.equal(liste.json.takip.length, 1);
  assert.equal(liste.json.takip[0].hedefFiyat, 50000);

  assert.equal((await s.iste(`/api/takip/${id}`, { yontem: 'PATCH', govde: { hedefFiyat: 49000, durakladi: true } })).json.kayit.durakladi, true);
  assert.equal((await s.iste(`/api/takip/${id}/kontrol`, { yontem: 'POST' })).json.kayit.fiyat, 51091.54);
  assert.equal((await s.iste(`/api/takip/${id}`, { yontem: 'DELETE' })).json.tamam, true);
  assert.equal((await s.iste(`/api/takip/${id}`, { yontem: 'DELETE' })).durum, 404);
  assert.equal((await s.iste('/api/olmayan')).durum, 404);
});

test('bildirim aboneliği, deneme ve ayarlar', async (t) => {
  const s = await kur(); t.after(s.kapat);
  const abonelik = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) } };
  assert.equal((await s.iste('/api/push/abone', { yontem: 'POST', govde: { abonelik, cihaz: 'Samsung' } })).json.tamam, true);
  assert.equal((await s.iste('/api/push/abone', { yontem: 'POST', govde: { abonelik: { endpoint: 'https://kotu.example/x', keys: abonelik.keys } } })).durum, 400);
  assert.equal((await s.iste('/api/push/dene', { yontem: 'POST', govde: { endpoint: abonelik.endpoint } })).json.tamam, true);
  assert.equal(s.itilen.length, 1);
  assert.equal(s.itilen[0].g.baslik, 'Bildirimler açık');
  assert.equal((await s.iste('/api/baslangic')).json.aboneSayisi, 1);
  await s.iste('/api/push/cik', { yontem: 'POST', govde: { endpoint: abonelik.endpoint } });
  assert.equal((await s.iste('/api/baslangic')).json.aboneSayisi, 0);

  const a = await s.iste('/api/ayar', { yontem: 'POST', govde: { kontrolDakika: 5, esikYuzde: 99, marketAcik: false, konum: { lat: 39.92, lon: 32.85, ad: 'Ankara' } } });
  assert.deepEqual(a.json.ayar, { kontrolDakika: 30, esikYuzde: 50, marketAcik: false, konum: { lat: 39.92, lon: 32.85, ad: 'Ankara' }, mesafeKm: 5 });
  assert.equal((await s.iste('/api/ayar', { yontem: 'POST', govde: { konum: { lat: 52.5, lon: 13.4 } } })).durum, 400);
  assert.equal((await s.iste('/api/bildirimler')).json.bildirimler.length, 0);
  assert.equal((await s.iste('/api/bildirimler/okundu', { yontem: 'POST' })).json.tamam, true);
  assert.equal((await s.iste('/api/push/abone', { yontem: 'POST', basliklar: { 'Content-Type': 'application/json' }, govde: undefined })).durum, 400);
});

test('tanılama kaynakları dener ve dakikada bir çalışır', async (t) => {
  const s = await kur(); t.after(s.kapat);
  const tani = await s.iste('/api/tani');
  assert.equal(tani.durum, 200);
  assert.deepEqual(tani.json.adimlar.map((a) => [a.ad, a.tamam, a.yontem]), [['Akakçe arama', true, 'astro'], ['Akakçe ürün sayfası', true, 'astro']]);
  assert.equal(tani.json.siteler['www.akakce.com'].engelli, false);
  assert.equal((await s.iste('/api/tani')).durum, 429);
});

test('statik dosyalar, manifest ve güvenlik başlıkları', async (t) => {
  const s = await kur(); t.after(s.kapat);
  const ana = await s.iste('/', { kod: null });
  assert.equal(ana.durum, 200);
  assert.match(ana.basliklar.get('content-type'), /text\/html/);
  assert.match(ana.basliklar.get('content-security-policy'), /default-src 'self'/);
  assert.equal(ana.basliklar.get('x-frame-options'), 'DENY');
  const etag = ana.basliklar.get('etag');
  assert.equal((await s.iste('/', { kod: null, basliklar: { 'If-None-Match': etag } })).durum, 304);

  const sw = await s.iste('/sw.js', { kod: null });
  assert.match(sw.metin, /test123-[0-9a-f]{10}/);
  assert.equal(sw.metin.includes('__KABUK__'), false);

  const m = await s.iste('/manifest.webmanifest?k=482913', { kod: null });
  assert.equal(m.json.start_url, '/#kod=482913');
  assert.equal(m.json.display, 'standalone');
  assert.equal((await s.iste('/manifest.webmanifest?k=<script>', { kod: null })).json.start_url, '/');
  assert.equal((await s.iste('/manifest.webmanifest', { kod: null })).json.start_url, '/');

  assert.equal((await s.iste('/..%2f..%2fpackage.json', { kod: null })).durum, 404);
  assert.equal((await s.iste('/%2e%2e/server.js', { kod: null })).durum, 404);
  assert.equal((await s.iste('/olmayan.png', { kod: null })).durum, 404);
  assert.equal((await s.iste('/%E0%A4%A', { kod: null })).durum, 400);
  assert.equal((await s.iste('/a%00b', { kod: null })).durum, 400);
  assert.equal((await s.iste('/takip', { kod: null })).durum, 200, 'uzantısız yol ana sayfaya düşer');
  assert.equal((await s.iste('/', { yontem: 'POST', kod: null })).durum, 405);
  assert.equal((await s.iste('/saglik', { kod: null })).json.tamam, true);
});

test('assetlinks: depodaki ve ortamdaki parmak izleriyle uygulama bağlantısı yayınlanır', async (t) => {
  const iz = Array.from({ length: 32 }, (_, i) => (i + 16).toString(16).toUpperCase()).join(':');
  const s = await kur({ apkParmakIzi: [iz] }); t.after(s.kapat);
  const a = await s.iste('/.well-known/assetlinks.json', { kod: null });
  assert.equal(a.json.length, 1);
  assert.deepEqual(a.json[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(a.json[0].target.namespace, 'android_app');
  assert.equal(a.json[0].target.package_name, 'tr.fiyatavcisi.twa');
  const izler = a.json[0].target.sha256_cert_fingerprints;
  assert.equal(izler[0], iz);
  // android/parmak-izi.txt içindeki iz de yayınlanır (APK'nın gerçek imzası)
  for (const x of izler) assert.match(x, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  assert.equal(new Set(izler).size, izler.length);
});
