import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { bildirimServisi, servisIzinli, abonelikGecerli } from '../src/bildirim.js';
import { depoAc } from '../src/depo.js';

const anahtar = (uzunluk) => 'A'.repeat(uzunluk);
const abonelik = (endpoint) => ({ endpoint, keys: { p256dh: anahtar(87), auth: anahtar(22) } });
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';
const APPLE = 'https://web.push.apple.com/QGuQyavXutnMH';

function kur() {
  const depo = depoAc(null);
  const gonderilen = [];
  const sahte = {
    generateVAPIDKeys: () => webpush.generateVAPIDKeys(),
    sendNotification: async (abone, govde, secenek) => {
      gonderilen.push({ abone, govde: JSON.parse(govde), secenek });
      if (abone.endpoint.includes('iptal')) { const e = new Error('Gone'); e.statusCode = 410; throw e; }
      if (abone.endpoint.includes('hata')) { const e = new Error('Sunucu'); e.statusCode = 500; throw e; }
      return { statusCode: 201 };
    },
  };
  const servis = bildirimServisi({ depo, alan: 'fiyat.1-2-3-4.sslip.io', webpush: sahte, simdi: () => 1000 });
  return { servis, depo, gonderilen };
}

test('yalnızca bilinen bildirim servisleri kabul edilir', () => {
  assert.equal(servisIzinli(FCM), true);
  assert.equal(servisIzinli(APPLE), true);
  assert.equal(servisIzinli('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  for (const kotu of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.kotu.example/x', 'https://127.0.0.1/x', 'https://kotu.example/fcm.googleapis.com', 'https://kullanici@fcm.googleapis.com/x', 'bozuk', '']) {
    assert.equal(servisIzinli(kotu), false, kotu);
  }
  assert.equal(abonelikGecerli(abonelik(FCM)), true);
  assert.equal(abonelikGecerli({ endpoint: FCM, keys: { p256dh: 'kısa', auth: anahtar(22) } }), false);
  assert.equal(abonelikGecerli(abonelik('https://kotu.example/x')), false);
  assert.equal(abonelikGecerli(null), false);
});

test('VAPID anahtarı bir kez üretilir ve saklanır', () => {
  const { servis, depo } = kur();
  const a = servis.acikAnahtar();
  assert.match(a, /^[A-Za-z0-9_-]{80,90}$/);
  assert.equal(servis.acikAnahtar(), a);
  assert.equal(depo.veri.vapid.publicKey, a);
});

test('abone ekleme tekrarı tek kayıt tutar; gonder kutuya yazar ve herkese iletir', async () => {
  const { servis, depo, gonderilen } = kur();
  assert.equal(servis.aboneEkle(abonelik(FCM), 'Samsung'), true);
  assert.equal(servis.aboneEkle(abonelik(FCM), 'Samsung'), true);
  assert.equal(servis.aboneEkle(abonelik(APPLE), 'iPhone'), true);
  assert.equal(servis.aboneEkle(abonelik('https://kotu.example/x')), false);
  assert.equal(servis.aboneSayisi(), 2);

  const s = await servis.gonder({ tur: 'dusus', baslik: 'İndirim: X', govde: '100 TL iken 90 TL oldu', takipId: 'abc123' });
  assert.equal(s.gonderilen, 2);
  assert.equal(gonderilen.length, 2);
  assert.deepEqual(gonderilen[0].govde, { baslik: 'İndirim: X', govde: '100 TL iken 90 TL oldu', adres: '/#takip/abc123', etiket: 'takip-abc123' });
  assert.equal(gonderilen[0].secenek.vapidDetails.subject, 'https://fiyat.1-2-3-4.sslip.io');
  assert.equal(gonderilen[0].secenek.urgency, 'high');
  assert.equal(depo.veri.bildirimler.length, 1);
  assert.equal(depo.veri.bildirimler[0].okundu, false);
  assert.equal(depo.veri.aboneler[0].sonBasari, 1000);
  servis.okunduYap();
  assert.equal(servis.kutu()[0].okundu, true);
});

test('iptal edilmiş abonelik silinir, geçici hata aboneyi silmez; abonesiz de kutuya yazılır', async () => {
  const { servis, depo } = kur();
  servis.aboneEkle(abonelik('https://fcm.googleapis.com/fcm/send/iptal'));
  servis.aboneEkle(abonelik('https://fcm.googleapis.com/fcm/send/hata'));
  const s = await servis.gonder({ baslik: 'a', govde: 'b' });
  assert.equal(s.gonderilen, 0);
  assert.deepEqual(depo.veri.aboneler.map((a) => a.endpoint), ['https://fcm.googleapis.com/fcm/send/hata']);
  assert.equal(depo.veri.aboneler[0].hata, 1);

  const bos = kur();
  const t = await bos.servis.gonder({ baslik: 'a', govde: 'b' });
  assert.equal(t.abone, 0);
  assert.equal(bos.depo.veri.bildirimler.length, 1);
});

test('dene yalnızca o cihaza gönderir; kutu 100 kayıtla sınırlı', async () => {
  const { servis, depo, gonderilen } = kur();
  servis.aboneEkle(abonelik(FCM));
  servis.aboneEkle(abonelik(APPLE));
  assert.deepEqual(await servis.dene(APPLE), { tamam: true });
  assert.equal(gonderilen.length, 1);
  assert.equal(gonderilen[0].abone.endpoint, APPLE);
  assert.deepEqual(await servis.dene('https://fcm.googleapis.com/yok'), { tamam: false, neden: 'abone-yok' });
  assert.equal(depo.veri.bildirimler.length, 0, 'deneme bildirimi kutuya yazılmaz');
  depo.veri.aboneler = [];
  for (let i = 0; i < 105; i++) await servis.gonder({ baslik: `b${i}`, govde: 'x' });
  assert.equal(depo.veri.bildirimler.length, 100);
  assert.equal(depo.veri.bildirimler[0].baslik, 'b104');
});

test('gerçek web-push kitaplığı üretilen anahtarlarla geçerli bir istek kurabiliyor', () => {
  const v = webpush.generateVAPIDKeys();
  const alici = webpush.generateVAPIDKeys(); // p256dh için geçerli bir eğri noktası
  const istek = webpush.generateRequestDetails(
    { endpoint: FCM, keys: { p256dh: alici.publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' } },
    JSON.stringify({ baslik: 'Deneme', govde: 'İçerik' }),
    { vapidDetails: { subject: 'https://fiyat.1-2-3-4.sslip.io', publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 60, urgency: 'high' },
  );
  assert.equal(istek.method, 'POST');
  assert.equal(istek.headers['Content-Encoding'], 'aes128gcm');
  assert.match(istek.headers.Authorization, /^vapid t=.+, k=.+$/);
  assert.equal(istek.headers.Urgency, 'high');
  assert.ok(istek.body.length > 50);
});
