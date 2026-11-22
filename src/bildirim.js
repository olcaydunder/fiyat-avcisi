// Bildirimler: uygulama içi kutu + telefona anlık bildirim (Web Push, VAPID).
// Android'de Chrome/APK, iPhone'da ana ekrana eklenmiş uygulama üzerinden çalışır.

import { randomBytes } from 'node:crypto';

// Yalnızca bilinen bildirim servislerine istek atılır (abonelik adresi istemciden geldiği için)
const IZINLI_SERVIS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/,
];
const KUTU_AZAMI = 100;
const ABONE_AZAMI = 20;

export function servisIzinli(adres) {
  try {
    const u = new URL(adres);
    return u.protocol === 'https:' && !u.username && IZINLI_SERVIS.some((d) => d.test(u.hostname));
  } catch { return false; }
}

export function abonelikGecerli(a) {
  return !!a && typeof a.endpoint === 'string' && a.endpoint.length < 1000 && servisIzinli(a.endpoint)
    && a.keys && typeof a.keys.p256dh === 'string' && typeof a.keys.auth === 'string'
    && /^[A-Za-z0-9_-]{20,200}$/.test(a.keys.p256dh) && /^[A-Za-z0-9_-]{10,100}$/.test(a.keys.auth);
}

export function bildirimServisi({ depo, alan = '', webpush, gunluk = () => {}, simdi = () => Date.now() }) {
  function vapid() {
    if (!depo.veri.vapid || !depo.veri.vapid.publicKey || !depo.veri.vapid.privateKey) {
      depo.veri.vapid = webpush.generateVAPIDKeys();
      depo.hemenKaydet();
    }
    return depo.veri.vapid;
  }
  // Apple, "sub" alanında gerçek bir adres ister; uygulamanın kendi adresi kullanılır
  const konu = () => (alan ? `https://${alan}` : 'https://fiyat-avcisi.example');

  function acikAnahtar() { return vapid().publicKey; }

  function aboneEkle(abonelik, cihaz = '') {
    if (!abonelikGecerli(abonelik)) return false;
    const liste = depo.veri.aboneler.filter((a) => a.endpoint !== abonelik.endpoint);
    liste.push({
      id: randomBytes(5).toString('hex'),
      endpoint: abonelik.endpoint,
      keys: { p256dh: abonelik.keys.p256dh, auth: abonelik.keys.auth },
      cihaz: String(cihaz || '').slice(0, 60),
      eklendi: simdi(),
      sonBasari: null,
      hata: 0,
    });
    depo.veri.aboneler = liste.slice(-ABONE_AZAMI);
    depo.kaydet();
    return true;
  }

  function aboneSil(endpoint) {
    const once = depo.veri.aboneler.length;
    depo.veri.aboneler = depo.veri.aboneler.filter((a) => a.endpoint !== endpoint);
    if (depo.veri.aboneler.length !== once) depo.kaydet();
    return depo.veri.aboneler.length !== once;
  }

  async function it(abone, icerik) {
    const v = vapid();
    try {
      await webpush.sendNotification(
        { endpoint: abone.endpoint, keys: abone.keys },
        JSON.stringify(icerik),
        { vapidDetails: { subject: konu(), publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 12 * 3600, urgency: 'high', timeout: 10000 },
      );
      abone.sonBasari = simdi();
      abone.hata = 0;
      return { tamam: true };
    } catch (e) {
      const durum = e && e.statusCode;
      if (durum === 404 || durum === 410) {
        aboneSil(abone.endpoint); // abonelik iptal edilmiş
        return { tamam: false, silindi: true, durum };
      }
      abone.hata = (abone.hata || 0) + 1;
      if (abone.hata >= 30) aboneSil(abone.endpoint);
      gunluk(`Bildirim gönderilemedi (${durum || (e && e.message) || 'hata'})`);
      return { tamam: false, durum: durum || null };
    }
  }

  /**
   * Bildirimi kutuya yazar ve bütün abone cihazlara gönderir.
   * icerik: { tur, baslik, govde, takipId }
   */
  async function gonder({ tur = 'bilgi', baslik, govde, takipId = null }) {
    const kayit = { id: randomBytes(6).toString('hex'), zaman: simdi(), tur, baslik, govde, takipId, okundu: false };
    depo.veri.bildirimler.unshift(kayit);
    depo.veri.bildirimler = depo.veri.bildirimler.slice(0, KUTU_AZAMI);
    depo.kaydet();
    const icerik = { baslik, govde, adres: takipId ? `/#takip/${takipId}` : '/#bildirimler', etiket: takipId ? `takip-${takipId}` : `bilgi-${kayit.id}` };
    const sonuclar = await Promise.all(depo.veri.aboneler.slice().map((a) => it(a, icerik)));
    depo.kaydet();
    return { kayit, gonderilen: sonuclar.filter((s) => s.tamam).length, abone: sonuclar.length };
  }

  /** Tek bir cihaza deneme bildirimi. */
  async function dene(endpoint) {
    const abone = depo.veri.aboneler.find((a) => a.endpoint === endpoint);
    if (!abone) return { tamam: false, neden: 'abone-yok' };
    const s = await it(abone, { baslik: 'Bildirimler açık', govde: 'Takipteki bir ürün ucuzlayınca buraya haber gelecek.', adres: '/#takip', etiket: 'deneme' });
    depo.kaydet();
    return s;
  }

  function kutu() { return depo.veri.bildirimler; }
  function okunduYap() {
    let degisti = false;
    for (const b of depo.veri.bildirimler) if (!b.okundu) { b.okundu = true; degisti = true; }
    if (degisti) depo.kaydet();
  }

  return { acikAnahtar, aboneEkle, aboneSil, gonder, dene, kutu, okunduYap, aboneSayisi: () => depo.veri.aboneler.length };
}
