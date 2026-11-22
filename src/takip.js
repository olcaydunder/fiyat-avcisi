// Takip listesi: ürünleri düzenli aralıklarla yeniden kontrol eder, fiyat geçmişi tutar,
// indirim olunca bildirim üretir.

import { randomBytes } from 'node:crypto';
import { tlKisa, yuzdeDegisim } from './para.js';
import { KaynakHatasi } from './getir.js';
import { urunYoluGecerli } from './kaynaklar/akakce.js';

const TAKIP_AZAMI = 60;
const GECMIS_AZAMI = 400;
const BEKLEME_SAAT = 6;        // aynı ürüne art arda "düştü" bildirimi için ara
const SESSIZ = { bas: 23, bit: 8 }; // İstanbul saatiyle gece bildirim gönderilmez

const yuvarla = (x) => Math.round(x * 100) / 100;

/** İstanbul'da saat kaç (0-23)? */
export function istanbulSaati(zaman) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date(zaman)));
}

export function sessizSaatMi(zaman) {
  const s = istanbulSaati(zaman);
  return SESSIZ.bas > SESSIZ.bit ? (s >= SESSIZ.bas || s < SESSIZ.bit) : (s >= SESSIZ.bas && s < SESSIZ.bit);
}

function kisalt(metin, uzunluk = 60) {
  const m = String(metin || '').trim();
  return m.length > uzunluk ? `${m.slice(0, uzunluk - 1).trimEnd()}…` : m;
}

function saticiYazisi(k) {
  return [k.magaza, k.satici].filter(Boolean).join(', ');
}

/**
 * Yeni ölçülen fiyata göre kaydı günceller ve gerekiyorsa bildirim döndürür. Kaydı yerinde değiştirir.
 * olcum: { fiyat (kargo dahil toplam) | null, magaza, satici, kargo, link }
 * secenek: { esikYuzde, sessiz }
 * Kurallar:
 *  - hedef: fiyat hedefin altına ilk kez indiğinde (hedefin üstüne çıkınca yeniden kurulur)
 *  - düşüş: son bildirimden (ya da eklenmesinden) beri görülen en yüksek fiyata göre en az esikYuzde düşünce
 *  - yeniden satışta: hiç teklif yokken teklif gelince
 *  - sessiz saatlerde bildirim üretilmez, karşılaştırma noktaları da değişmez; sabah ilk kontrolde bildirilir
 */
export function degerlendir(kayit, olcum, { esikYuzde = 3, sessiz = false } = {}, simdi = Date.now()) {
  const yeni = olcum && Number.isFinite(olcum.fiyat) && olcum.fiyat > 0 ? yuvarla(olcum.fiyat) : null;
  const eski = kayit.fiyat ?? null;
  kayit.sonKontrol = simdi;
  kayit.hata = null;

  if (yeni === null) {
    // Hiç teklif yok: teklif gelince "yeniden satışta" bildirimi için işaretle
    if (eski !== null) { kayit.oncekiFiyat = eski; kayit.degisimTarihi = simdi; }
    kayit.stokYok = true;
    kayit.fiyat = null;
    kayit.magaza = null; kayit.satici = null; kayit.kargo = null; kayit.link = null;
    return null;
  }

  // geçmiş: fiyat değiştiyse ya da son noktadan 12 saat geçtiyse nokta ekle
  const son = kayit.gecmis[kayit.gecmis.length - 1];
  if (!son || son[1] !== yeni || simdi - son[0] > 12 * 3600_000) {
    kayit.gecmis.push([simdi, yeni]);
    if (kayit.gecmis.length > GECMIS_AZAMI) kayit.gecmis.splice(0, kayit.gecmis.length - GECMIS_AZAMI);
  }
  if (eski !== null && eski !== yeni) { kayit.oncekiFiyat = eski; kayit.degisimTarihi = simdi; }
  kayit.fiyat = yeni;
  kayit.magaza = olcum.magaza || null;
  kayit.satici = olcum.satici || null;
  kayit.kargo = olcum.kargo ?? null;
  kayit.link = olcum.link || null;
  if (kayit.ilkFiyat === null || kayit.ilkFiyat === undefined) kayit.ilkFiyat = yeni;
  const oncekiDip = kayit.enDusuk ?? null;
  if (oncekiDip === null || yeni < oncekiDip) { kayit.enDusuk = yeni; kayit.enDusukTarih = simdi; }
  if (kayit.enYuksek === null || kayit.enYuksek === undefined || yeni > kayit.enYuksek) kayit.enYuksek = yeni;

  // hedef fiyatın üstüne çıktıysa hedef bildirimi yeniden kurulur
  if (kayit.hedefFiyat && yeni > kayit.hedefFiyat * 1.005) kayit.hedefBildirildi = false;
  // Karşılaştırma noktası ilk ölçümde kurulur; sessiz saatlerde yerinde kalır
  if (kayit.tepe === null || kayit.tepe === undefined) kayit.tepe = eski ?? yeni;

  if (sessiz) return null;

  const kimden = saticiYazisi(kayit);
  const kargo = kayit.kargo === 0 ? ' Kargo ücretsiz.' : '';
  const ad = kisalt(kayit.ad);
  const bildir = (tur, baslik, govde) => {
    kayit.tepe = yeni;
    kayit.sonBildirim = { zaman: simdi, fiyat: yeni, tur };
    return { tur, baslik, govde };
  };

  if (kayit.stokYok) {
    kayit.stokYok = false;
    if (kayit.hedefFiyat && yeni <= kayit.hedefFiyat) kayit.hedefBildirildi = true;
    return bildir('stok', `Yeniden satışta: ${ad}`, `${tlKisa(yeni)}${kimden ? `, ${kimden}` : ''}.${kargo}`);
  }

  if (kayit.hedefFiyat && yeni <= kayit.hedefFiyat && !kayit.hedefBildirildi) {
    kayit.hedefBildirildi = true;
    return bildir('hedef', `Hedef fiyata indi: ${ad}`, `${tlKisa(yeni)} oldu, hedefin ${tlKisa(kayit.hedefFiyat)}.${kimden ? ` ${kimden}.` : ''}${kargo}`);
  }

  if (yeni > kayit.tepe) kayit.tepe = yeni;
  const esik = Math.max(Number(esikYuzde) || 3, 0.5);
  if (yeni <= kayit.tepe * (1 - esik / 100) && kayit.tepe - yeni >= 1) {
    const sb = kayit.sonBildirim;
    const yakinda = sb && simdi - sb.zaman < BEKLEME_SAAT * 3600_000 && yeni >= sb.fiyat * 0.995;
    if (yakinda) {
      kayit.tepe = yeni; // bu fiyat az önce bildirildi; aynı seviyeyi yeniden haber verme
    } else {
      const eskiTepe = kayit.tepe;
      const oran = Math.abs(yuzdeDegisim(eskiTepe, yeni)).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
      const dip = oncekiDip !== null && yeni < oncekiDip ? ' Takibe aldığından beri en düşük fiyat.' : '';
      return bildir('dusus', `İndirim: ${ad}`, `${tlKisa(eskiTepe)} iken ${tlKisa(yeni)} oldu (%${oran} düştü).${kimden ? ` ${kimden}.` : ''}${kargo}${dip}`);
    }
  }
  return null;
}

export function takipServisi({ depo, arama, bildirim, gunluk = () => {}, simdi = () => Date.now(), rastgele = Math.random }) {
  const liste = () => depo.veri.takip;
  const bul = (id) => liste().find((k) => k.id === id) || null;

  function sonrakiZaman(hataAdedi = 0) {
    if (hataAdedi > 0) return simdi() + Math.min(6 * 60, 15 * 2 ** (hataAdedi - 1)) * 60_000;
    const dk = Math.min(Math.max(Number(depo.veri.ayar.kontrolDakika) || 60, 30), 24 * 60);
    return simdi() + dk * 60_000 * (0.9 + rastgele() * 0.2);
  }

  async function olc(kayit) {
    if (kayit.kaynak === 'market') {
      const u = await arama.marketUrunu(kayit.urunId, kayit.ad);
      if (!u) return { fiyat: null };
      const t = u.teklifler[0];
      return { fiyat: t.fiyat, magaza: t.market, satici: t.sube, kargo: null, link: null };
    }
    const s = await arama.urun(kayit.yol, { taze: true });
    const t = s.teklifler[0];
    if (!t) return { fiyat: null, urun: s.urun };
    return { fiyat: t.toplam, magaza: t.magaza, satici: t.satici, kargo: t.kargo, link: t.link || t.dogrudan || null, urun: s.urun };
  }

  /** Bir kaydı şimdi kontrol eder. { kayit, bildirim } */
  async function kontrolEt(id, { sessizZorla = null } = {}) {
    const kayit = bul(id);
    if (!kayit) return null;
    let uretilen = null;
    try {
      const olcum = await olc(kayit);
      if (olcum.urun) {
        if (olcum.urun.gorsel && !kayit.gorsel) kayit.gorsel = olcum.urun.gorsel;
        if (olcum.urun.enDusuk1Ay) { kayit.enDusuk1Ay = olcum.urun.enDusuk1Ay; kayit.enDusuk1AyTarih = olcum.urun.enDusuk1AyTarih; }
      }
      const sessiz = sessizZorla === null ? sessizSaatMi(simdi()) : sessizZorla;
      uretilen = degerlendir(kayit, olcum, { esikYuzde: depo.veri.ayar.esikYuzde, sessiz }, simdi());
      kayit.hataAdedi = 0;
      kayit.sonrakiKontrol = sonrakiZaman(0);
    } catch (e) {
      kayit.sonKontrol = simdi();
      kayit.hataAdedi = (kayit.hataAdedi || 0) + 1;
      kayit.hata = e instanceof KaynakHatasi ? { tur: e.tur, ileti: e.message } : { tur: 'bilinmiyor', ileti: 'Kontrol sırasında beklenmeyen bir hata oluştu' };
      kayit.sonrakiKontrol = sonrakiZaman(kayit.hataAdedi);
      if (!(e instanceof KaynakHatasi)) gunluk(`Takip kontrolü hata verdi (${kayit.ad}): ${e && e.stack || e}`);
    }
    depo.kaydet();
    if (uretilen) {
      try { await bildirim.gonder({ ...uretilen, takipId: kayit.id }); }
      catch (e) { gunluk(`Bildirim gönderilemedi: ${e && e.message || e}`); }
    }
    return { kayit, bildirim: uretilen };
  }

  /** Takibe alır ve ilk fiyatı hemen ölçer. */
  async function ekle({ kaynak = 'akakce', yol, urunId, ad, gorsel, hedefFiyat }) {
    if (liste().length >= TAKIP_AZAMI) throw new KaynakHatasi('sinir', `En çok ${TAKIP_AZAMI} ürün takip edilebilir`);
    const hedef = Number(hedefFiyat);
    const temel = {
      id: randomBytes(5).toString('hex'), kaynak, ad: String(ad || '').slice(0, 200), gorsel: typeof gorsel === 'string' && /^https:\/\//.test(gorsel) ? gorsel.slice(0, 800) : null,
      eklendi: simdi(), hedefFiyat: Number.isFinite(hedef) && hedef > 0 ? yuvarla(hedef) : null, hedefBildirildi: false, durakladi: false,
      fiyat: null, magaza: null, satici: null, kargo: null, link: null,
      ilkFiyat: null, enDusuk: null, enDusukTarih: null, enYuksek: null, oncekiFiyat: null, degisimTarihi: null,
      tepe: null, gecmis: [], sonKontrol: null, sonrakiKontrol: simdi(), hata: null, hataAdedi: 0, sonBildirim: null, stokYok: false,
    };
    if (kaynak === 'market') {
      if (!urunId || !temel.ad) throw new KaynakHatasi('bicim', 'Market ürünü eksik gönderildi');
      const varolan = liste().find((k) => k.kaynak === 'market' && k.urunId === String(urunId));
      if (varolan) return varolan;
      temel.urunId = String(urunId).slice(0, 40);
    } else if (kaynak === 'akakce') {
      if (!urunYoluGecerli(yol)) throw new KaynakHatasi('bicim', 'Ürün adresi geçersiz');
      const varolan = liste().find((k) => k.kaynak === 'akakce' && k.yol === yol);
      if (varolan) {
        if (temel.hedefFiyat) { varolan.hedefFiyat = temel.hedefFiyat; varolan.hedefBildirildi = false; depo.kaydet(); }
        return varolan;
      }
      temel.yol = yol;
    } else {
      throw new KaynakHatasi('bicim', 'Bilinmeyen kaynak');
    }
    liste().unshift(temel);
    depo.kaydet();
    // İlk ölçüm: bildirim üretmez, yalnızca başlangıç fiyatını yazar
    await kontrolEt(temel.id, { sessizZorla: true });
    const k = bul(temel.id);
    if (k && k.fiyat !== null && k.hedefFiyat && k.fiyat <= k.hedefFiyat) k.hedefBildirildi = true; // zaten hedefin altında
    depo.kaydet();
    return k;
  }

  function guncelle(id, degisiklik) {
    const kayit = bul(id);
    if (!kayit) return null;
    if ('hedefFiyat' in degisiklik) {
      const h = Number(degisiklik.hedefFiyat);
      kayit.hedefFiyat = Number.isFinite(h) && h > 0 ? yuvarla(h) : null;
      kayit.hedefBildirildi = !!(kayit.hedefFiyat && kayit.fiyat !== null && kayit.fiyat <= kayit.hedefFiyat);
    }
    if ('durakladi' in degisiklik) {
      kayit.durakladi = !!degisiklik.durakladi;
      if (!kayit.durakladi) kayit.sonrakiKontrol = simdi();
    }
    depo.kaydet();
    return kayit;
  }

  function sil(id) {
    const once = liste().length;
    depo.veri.takip = liste().filter((k) => k.id !== id);
    if (depo.veri.takip.length !== once) depo.kaydet();
    return depo.veri.takip.length !== once;
  }

  let calisiyor = false;
  /** Zamanı gelen kayıtları sırayla kontrol eder. Dakikada bir çağrılır. */
  async function zamanliTur(azami = 6) {
    if (calisiyor) return 0;
    calisiyor = true;
    let adet = 0;
    try {
      const sirada = liste().filter((k) => !k.durakladi && (k.sonrakiKontrol || 0) <= simdi())
        .sort((a, b) => (a.sonrakiKontrol || 0) - (b.sonrakiKontrol || 0)).slice(0, azami);
      for (const k of sirada) {
        await kontrolEt(k.id);
        adet++;
      }
    } finally { calisiyor = false; }
    return adet;
  }

  return { liste, bul, ekle, guncelle, sil, kontrolEt, zamanliTur };
}
