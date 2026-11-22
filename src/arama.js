// Arama: kaynakları birlikte sorgular, sonuçları sorguyla eşleştirir, kategorilere ayırır.
// Ürün ayrıntısı: bir ürünün bütün mağaza tekliflerini ucuzdan pahalıya verir.

import * as akakce from './kaynaklar/akakce.js';
import * as market from './kaynaklar/marketfiyati.js';
import { sozcukler } from './para.js';
import { kampanyaOzeti } from './kampanya.js';
import { KaynakHatasi } from './getir.js';

const ARAMA_ONBELLEK_SN = 600;
const URUN_ONBELLEK_SN = 300;

// Ünsüz yumuşaması: kitap -> kitabı, kulaklık -> kulaklığı, kanat -> kanadı
const YUMUSAMA = { p: 'b', t: 'd', k: 'g' };

/** Biri diğerinin ek almış hâli mi? ("telefon" ~ "telefonu", "kulaklik" ~ "kulakligi") */
function ekliHali(a, b) {
  const [kisa, uzun] = a.length <= b.length ? [a, b] : [b, a];
  if (kisa.length < 4 || uzun.length - kisa.length > 3) return false;
  if (uzun.startsWith(kisa)) return true;
  const govde = kisa.slice(0, -1);
  return uzun.length > kisa.length && uzun.startsWith(govde) && YUMUSAMA[kisa[kisa.length - 1]] === uzun[govde.length];
}

function sozcukEslesir(q, baslikKumesi, baslikListesi) {
  if (baslikKumesi.has(q)) return true;
  if (/\d/.test(q)) return false; // sayı içeren sözcükler birebir tutmalı: "13" ile "130" aynı değil
  for (const t of baslikListesi) {
    if (!/\d/.test(t) && ekliHali(q, t)) return true;
  }
  return false;
}

/** Sorgu sözcüklerinin ne kadarı başlıkta geçiyor: 0..1 */
export function uyumPuani(sorguSozcukleri, baslik) {
  if (!sorguSozcukleri.length) return 0;
  const liste = sozcukler(baslik);
  const kume = new Set(liste);
  let tutan = 0;
  for (const q of sorguSozcukleri) if (sozcukEslesir(q, kume, liste)) tutan++;
  return tutan / sorguSozcukleri.length;
}

// Ölçü birimleri ürünü tanımlamaz: "süt 1 lt" aramasında asıl sözcük "süt"tür
const BIRIM = new Set(['lt', 'l', 'ml', 'cl', 'kg', 'g', 'gr', 'mg', 'adet', 'li', 'lu', 'paket', 'cm', 'mm', 'm', 'x', 'gb', 'tb', 'mb', 'w', 'kw', 'v', 'mah', 'inc']);

/** Sorgudaki asıl sözcüklerin (sayı ve birim olmayanların) hepsi başlıkta geçiyor mu? */
export function anaSozcuklerTutar(sorguSozcukleri, baslik) {
  const ana = sorguSozcukleri.filter((x) => !/^\d+$/.test(x) && !BIRIM.has(x));
  if (!ana.length) return uyumPuani(sorguSozcukleri, baslik) === 1;
  return uyumPuani(ana, baslik) === 1;
}

function kategoriAdi(slug, adlar) {
  if (adlar && adlar[slug]) return adlar[slug];
  const s = String(slug).replace(/[-_]+/g, ' ').trim();
  return s ? s[0].toLocaleUpperCase('tr') + s.slice(1) : 'Diğer';
}

// Asıl ürünün yanında çıkan yan ürün kategorileri (kılıf, yedek parça, şarj aleti...)
const YAN_URUN = new Set(['yedek', 'parca', 'aksesuar', 'aksesuarlari', 'kilif', 'kilifi', 'kapak', 'kapagi', 'koruyucu', 'kablo', 'kablosu', 'sarj', 'adaptor', 'adaptoru',
  'filtre', 'filtresi', 'torba', 'torbasi', 'batarya', 'pil', 'stand', 'standi', 'tutucu', 'kordon', 'kayis', 'canta', 'cantasi', 'kagidi', 'baslik', 'basligi', 'kartus', 'toner', 'kumanda', 'aparat', 'aparati']);

/** Kategori bir yan ürün kategorisi mi? Kullanıcı o sözcüğü kendisi yazdıysa ("iphone 13 kılıf") sayılmaz. */
function yanUrunKategorisi(slug, sorguSozcukleri) {
  const parcalar = String(slug).split('-');
  if (!parcalar.some((p) => YAN_URUN.has(p))) return false;
  return !sorguSozcukleri.some((q) => parcalar.some((p) => p === q || ekliHali(q, p)));
}

/**
 * Ürünleri kategorilere ayırır ve aramayla en ilgili kategoriyi seçer.
 * Üst sıralarda çıkan ve çok satıcısı olan ürünlerin kategorisi ağır basar; yan ürün kategorileri
 * (kılıf, yedek parça...) geri planda tutulur. Böylece "iphone 13" aramasında kılıflar değil telefonlar,
 * "dyson v15" aramasında yedek parçalar değil süpürge öne gelir.
 * Sorguya tam uyan ürün yoksa kategori önerilmez.
 */
export function kategoriOzeti(urunler, adlar = {}, sorguSozcukleri = []) {
  const kume = new Map();
  const tamUyanVar = urunler.some((u) => u.uyum >= 0.999);
  urunler.forEach((u, sira) => {
    const slug = u.kategori || 'diger';
    let k = kume.get(slug);
    if (!k) { k = { slug, ad: slug === 'diger' ? 'Diğer' : kategoriAdi(slug, adlar), adet: 0, agirlik: 0 }; kume.set(slug, k); }
    k.adet++;
    if (tamUyanVar && u.uyum >= 0.999 && u.fiyat !== null) {
      const carpan = yanUrunKategorisi(slug, sorguSozcukleri) ? 0.2 : 1;
      k.agirlik += carpan * (1 / (1 + sira * 0.15)) * (1 + Math.log2(1 + (u.fiyatSayisi || 1)));
    }
  });
  const kategoriler = [...kume.values()].sort((a, b) => b.agirlik - a.agirlik || b.adet - a.adet);
  const onerilen = kategoriler.length && kategoriler[0].agirlik > 0 && kategoriler[0].slug !== 'diger' ? kategoriler[0].slug : null;
  return { kategoriler: kategoriler.map(({ slug, ad, adet }) => ({ slug, ad, adet })), onerilen };
}

function hataOzeti(e) {
  if (e instanceof KaynakHatasi) return { tur: e.tur, ileti: e.message };
  return { tur: 'bilinmiyor', ileti: 'Beklenmeyen bir hata oluştu' };
}

export function aramaServisi({ getirici, depo, gunluk = () => {} }) {
  const ayar = () => depo.veri.ayar;

  async function akakceAra(q, sayfa) {
    const bas = Date.now();
    const { metin, adres } = await getirici.getir(akakce.aramaAdresi(q, sayfa), { onbellekSn: ARAMA_ONBELLEK_SN });
    // Akakçe aramayı bazen bir kategori sayfasına, tam eşleşmede doğrudan ürün sayfasına yönlendirir
    let varilanYol = null;
    try { varilanYol = new URL(adres).pathname; } catch { /* adres yoksa arama sayfası say */ }
    let sonuc = null;
    if (varilanYol && akakce.urunYoluGecerli(varilanYol)) sonuc = akakce.urunSayfasindanArama(metin, varilanYol);
    if (!sonuc) sonuc = akakce.aramaAyikla(metin);
    if (!sonuc.yontem && !/astro-island|id="(?:APL|CPL)"/.test(metin)) {
      throw new KaynakHatasi('bicim', 'Akakçe arama sayfası beklenen biçimde gelmedi');
    }
    return { ...sonuc, sureMs: Date.now() - bas };
  }

  async function marketAra(q) {
    const bas = Date.now();
    const konum = ayar().konum;
    if (!market.konumGecerli(konum)) throw new KaynakHatasi('bicim', 'Market araması için konum ayarlı değil');
    const mesafe = Math.min(Math.max(Number(ayar().mesafeKm) || 5, 1), 20);
    const yakin = market.yakinIstegi(konum, mesafe);
    let depolar = [];
    try {
      const y = await getirici.getir(yakin.adres, { yontem: 'POST', govde: yakin.govde, onbellekSn: 24 * 3600 });
      depolar = market.yakinAyikla(JSON.parse(y.metin));
    } catch (e) {
      // Yakın şube listesi alınamazsa arama şubesiz de çalışır; engel ve yasakta ise hiç devam etme
      if (!(e instanceof SyntaxError) && !(e instanceof KaynakHatasi)) throw e;
      if (e instanceof KaynakHatasi && ['engel', 'robots', 'sinir'].includes(e.tur)) throw e;
    }
    const istek = market.aramaIstegi(q, konum, depolar, mesafe);
    const { metin } = await getirici.getir(istek.adres, { yontem: 'POST', govde: istek.govde, onbellekSn: ARAMA_ONBELLEK_SN });
    let json;
    try { json = JSON.parse(metin); } catch { throw new KaynakHatasi('bicim', 'Market Fiyatı beklenen biçimde yanıt vermedi'); }
    return { urunler: market.aramaAyikla(json), sureMs: Date.now() - bas };
  }

  function aramayiHatirla(q) {
    const liste = depo.veri.aramalar.filter((x) => x.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'));
    liste.unshift(q);
    depo.veri.aramalar = liste.slice(0, 12);
    depo.kaydet();
  }

  /** Ürün adıyla arar. */
  async function ara(sorgu, { sayfa = 1 } = {}) {
    const q = String(sorgu ?? '').replace(/\s+/g, ' ').trim();
    if (q.length < 2) throw new KaynakHatasi('bicim', 'Aramak için en az 2 harf yaz');
    if (q.length > 120) throw new KaynakHatasi('bicim', 'Arama metni çok uzun');
    const soz = sozcukler(q);
    if (!soz.length) throw new KaynakHatasi('bicim', 'Aramak için bir ürün adı yaz');
    const s = Math.min(Math.max(Number(sayfa) || 1, 1), 5);
    const marketIstendi = ayar().marketAcik !== false && s === 1;

    const [a, m] = await Promise.allSettled([akakceAra(q, s), marketIstendi ? marketAra(q) : Promise.resolve(null)]);

    const kaynaklar = {};
    let urunler = [];
    let toplam = 0;
    let oneri = null;
    let adlar = {};
    if (a.status === 'fulfilled') {
      urunler = a.value.urunler.map((u, sira) => ({ ...u, sira, uyum: Math.round(uyumPuani(soz, `${u.marka || ''} ${u.ad}`) * 100) / 100 }));
      toplam = a.value.toplam;
      oneri = a.value.oneri;
      adlar = a.value.kategoriAdlari;
      kaynaklar.akakce = { tamam: true, adet: urunler.length, yontem: a.value.yontem, sureMs: a.value.sureMs };
    } else {
      kaynaklar.akakce = { tamam: false, ...hataOzeti(a.reason) };
      if (!(a.reason instanceof KaynakHatasi)) gunluk(`Akakçe araması hata verdi: ${a.reason && a.reason.stack || a.reason}`);
    }

    let marketUrunleri = [];
    if (marketIstendi) {
      if (m.status === 'fulfilled' && m.value) {
        marketUrunleri = m.value.urunler
          .map((u) => ({ ...u, uyum: Math.round(uyumPuani(soz, `${u.marka || ''} ${u.ad} ${u.miktar || ''}`) * 100) / 100 }))
          .filter((u) => u.uyum >= 0.6 && anaSozcuklerTutar(soz, `${u.marka || ''} ${u.ad}`))
          .sort((x, y) => y.uyum - x.uyum || x.fiyat - y.fiyat)
          .slice(0, 24);
        kaynaklar.market = { tamam: true, adet: marketUrunleri.length, sureMs: m.value.sureMs };
      } else if (m.status === 'rejected') {
        kaynaklar.market = { tamam: false, ...hataOzeti(m.reason) };
        if (!(m.reason instanceof KaynakHatasi)) gunluk(`Market araması hata verdi: ${m.reason && m.reason.stack || m.reason}`);
      }
    }

    const { kategoriler, onerilen } = kategoriOzeti(urunler, adlar, soz);
    if (a.status === 'fulfilled' && s === 1 && (urunler.length || marketUrunleri.length)) aramayiHatirla(q);

    return {
      sorgu: q, sayfa: s, urunler, toplam, oneri: oneri && oneri.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr') ? oneri : null,
      kategoriler, onerilenKategori: onerilen, market: marketUrunleri, kaynaklar,
    };
  }

  /** Bir Akakçe ürününün bütün mağaza tekliflerini getirir. taze=true önbelleği atlar. */
  async function urun(yol, { taze = false } = {}) {
    if (!akakce.urunYoluGecerli(yol)) throw new KaynakHatasi('bicim', 'Ürün adresi geçersiz');
    const { metin } = await getirici.getir(akakce.urunAdresi(yol), { onbellekSn: taze ? 0 : URUN_ONBELLEK_SN });
    const sonuc = akakce.urunAyikla(metin);
    if (!sonuc.yontem && !sonuc.urun.ad) throw new KaynakHatasi('bicim', 'Akakçe ürün sayfası beklenen biçimde gelmedi');
    sonuc.urun.yol = sonuc.urun.yol || yol;
    sonuc.urun.akakce = akakce.urunAdresi(sonuc.urun.yol);
    for (const t of sonuc.teklifler) {
      const k = kampanyaOzeti({ fiyat: t.fiyat, slogan: t.slogan, kampanyalar: t.kampanyalar, rozetFiyat: t.rozetFiyat });
      t.notlar = k.notlar;
      t.tahmini = k.tahmini ? { ...k.tahmini, toplam: Math.round((k.tahmini.fiyat + (t.kargo ?? 0)) * 100) / 100 } : null;
      delete t.slogan; delete t.kampanyalar; delete t.rozetFiyat;
    }
    sonuc.enUcuz = sonuc.teklifler[0] || null;
    let kampanyali = null;
    for (const t of sonuc.teklifler) {
      if (t.tahmini && (!kampanyali || t.tahmini.toplam < kampanyali.tahmini.toplam)) kampanyali = t;
    }
    sonuc.kampanyaliEnUcuz = kampanyali && sonuc.enUcuz && kampanyali.tahmini.toplam < sonuc.enUcuz.toplam ? kampanyali : null;
    return sonuc;
  }

  /** Market ürününün güncel en ucuz fiyatını bulur (takip için). */
  async function marketUrunu(id, ad) {
    const { urunler } = await marketAra(ad);
    return urunler.find((u) => u.id === id) || null;
  }

  return { ara, urun, marketUrunu };
}
