// Akakçe: Türkiye'deki mağazaların fiyatlarını bir araya getiren karşılaştırma sitesi.
// Arama sayfasından ürün listesini, ürün sayfasından mağaza tekliflerini okur.
// Okuma sırası: sayfaya gömülü yapılandırılmış veri (astro) -> JSON-LD -> düz HTML.

import { adalar, jsonLd } from '../astro.js';
import { fiyatOku, duzMetin, bitisikMetin, varlikCoz, sade } from '../para.js';

export const KIMLIK = 'akakce';
export const AD = 'Akakçe';
export const KOK = 'https://www.akakce.com';

// /kategori/en-ucuz-urun-adi-fiyati,123456.html
const URUN_YOLU = /^\/[a-z0-9_-]+\/[a-z0-9_.%~+-]*,\d+\.html$/;
const YONLENDIRME = /^\/r\/\?pr=\d+&vd=\d+&pg=\d+$/;

const sayi = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);
const yuvarla = (x) => Math.round(x * 100) / 100;
const temiz = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');

export function urunYoluGecerli(yol) {
  return typeof yol === 'string' && yol.length < 400 && URUN_YOLU.test(yol) && !yol.startsWith('/magaza/');
}

export function aramaAdresi(sorgu, sayfa = 1) {
  const q = encodeURIComponent(String(sorgu).trim()).replace(/%20/g, '+');
  return `${KOK}/arama/?q=${q}${sayfa > 1 ? `&p=${sayfa}` : ''}`;
}

export function urunAdresi(yol) {
  if (!urunYoluGecerli(yol)) throw new Error('Geçersiz ürün yolu');
  return KOK + yol;
}

function gorselDuzelt(adres) {
  if (typeof adres !== 'string' || !adres) return null;
  const a = adres.startsWith('//') ? `https:${adres}` : adres;
  return /^https:\/\/[^\s"'<>]+$/.test(a) ? a : null;
}

function kodCikar(yol) {
  const m = /,(\d+)\.html$/.exec(yol || '');
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- arama sayfası

function aramaUrunu(p) {
  if (!p || typeof p !== 'object') return null;
  const ad = temiz(p.name);
  const kod = p.code !== undefined && p.code !== null ? String(p.code) : null;
  if (!ad || !kod) return null;
  const yol = urunYoluGecerli(p.url) ? p.url : null;
  const fiyat = sayi(p.price) > 0 ? yuvarla(p.price) : null;
  const ikinciEl = sayi(p.minOfNonNewPrice) > 0 ? yuvarla(p.minOfNonNewPrice) : null;
  if (fiyat === null && ikinciEl === null) return null;
  return {
    kaynak: KIMLIK,
    kod,
    ad,
    marka: temiz(p.mkName) && p.mkName !== '-' ? temiz(p.mkName) : null,
    fiyat,
    ikinciElFiyat: ikinciEl,
    rozet: temiz(p.badge) || null,
    fiyatSayisi: Number.isFinite(p.countOfPrices) ? p.countOfPrices : null,
    dusus: Number.isFinite(p.dropRatio) && p.dropRatio > 0 ? p.dropRatio : null,
    gorsel: gorselDuzelt(p.imageUrl),
    yol,
    kategori: yol ? yol.split('/')[1] : null,
  };
}

function aramaHtml(tumHtml) {
  const urunler = [];
  // Ana liste aramada APL, kategori sayfasında CPL kimliğini taşır; varsa yalnızca onun içine bak
  const anaListe = /<ul\b[^>]*\bid="(?:APL|CPL)"[^>]*>([\s\S]*?)<\/ul>/.exec(tumHtml);
  const html = anaListe ? anaListe[1] : tumHtml;
  const desen = /<li\b([^>]*\bdata-pr="(\d+)"[^>]*)>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = desen.exec(html))) {
    const [, oz, kod, ic] = m;
    const baslik = /<h3\b[^>]*>([\s\S]*?)<\/h3>/.exec(ic);
    const ad = baslik ? duzMetin(baslik[1]) : '';
    const fiyatBlok = /class="pt_v\d+[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(ic);
    const tutar = fiyatBlok ? fiyatOku(bitisikMetin(fiyatBlok[1])) : null;
    if (!ad || !tutar) continue;
    const baglanti = /<a\b[^>]*\bhref="([^"]+)"/.exec(ic);
    const yol = baglanti && urunYoluGecerli(varlikCoz(baglanti[1])) ? varlikCoz(baglanti[1]) : null;
    const ikinciEl = /qv_badge/.test(ic);
    const marka = /\bdata-mk="([^"]*)"/.exec(oz);
    const adet = /\bdata-cp="(\d+)"/.exec(oz);
    const gorsel = /<img\b[^>]*\bsrc="([^"]+)"/.exec(ic);
    const dusus = /<i>%(\d{1,2})<\/i>/.exec(ic);
    urunler.push({
      kaynak: KIMLIK,
      kod,
      ad,
      marka: marka && marka[1] && marka[1] !== '-' ? varlikCoz(marka[1]) : null,
      fiyat: ikinciEl ? null : tutar,
      ikinciElFiyat: ikinciEl ? tutar : null,
      rozet: ikinciEl ? 'İkinci el' : null,
      fiyatSayisi: adet ? Number(adet[1]) : null,
      dusus: dusus ? Number(dusus[1]) : null,
      gorsel: gorsel ? gorselDuzelt(varlikCoz(gorsel[1])) : null,
      yol,
      kategori: yol ? yol.split('/')[1] : null,
    });
  }
  return urunler;
}

/** Veri ağacında ürün dizisini bulur: { code, name, price | minOfNonNewPrice } nesnelerinden oluşan en uzun dizi. */
function urunDizisiBul(veri) {
  let enIyi = null;
  const gez = (o, derinlik) => {
    if (derinlik > 9 || o === null || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      const ilk = o[0];
      if (ilk && typeof ilk === 'object' && !Array.isArray(ilk) && 'code' in ilk && 'name' in ilk && ('price' in ilk || 'minOfNonNewPrice' in ilk)) {
        if (!enIyi || o.length > enIyi.length) enIyi = o;
        return;
      }
      for (const x of o.slice(0, 60)) gez(x, derinlik + 1);
      return;
    }
    for (const k of Object.keys(o)) gez(o[k], derinlik + 1);
  };
  gez(veri, 0);
  return enIyi;
}

/** Ağaçta adı verilen ilk alanı bulur (türü uyuyorsa). */
function alanBul(veri, ad, tur, derinlik = 0) {
  if (derinlik > 6 || veri === null || typeof veri !== 'object') return undefined;
  if (!Array.isArray(veri) && typeof veri[ad] === tur) return veri[ad];
  for (const k of Array.isArray(veri) ? veri.slice(0, 20) : Object.values(veri)) {
    const bulunan = alanBul(k, ad, tur, derinlik + 1);
    if (bulunan !== undefined) return bulunan;
  }
  return undefined;
}

/** Kategori adlarını toplar: { 'cep-telefonu': 'Cep Telefonu' }. Kaynaklar: gömülü veri ve sayfadaki kategori bağlantıları. */
function kategoriAdlariTopla(veri, html) {
  const adlar = {};
  const gez = (o, derinlik) => {
    if (derinlik > 7 || o === null || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o.slice(0, 80)) gez(x, derinlik + 1); return; }
    const slug = typeof o.ctNameUrlForm === 'string' ? o.ctNameUrlForm : (typeof o.urlForm === 'string' ? o.urlForm : null);
    const ad = temiz(o.ctName) || temiz(o.categoryName) || (o.type === 'c' ? temiz(o.name) : '');
    if (slug && ad && /^[a-z0-9-]+$/.test(slug) && !adlar[slug]) adlar[slug] = ad;
    for (const k of Object.keys(o)) gez(o[k], derinlik + 1);
  };
  if (veri) gez(veri, 0);
  // Gezinti izindeki kategori bağlantıları: <a href="/camasir-makinesi.html">Çamaşır Makinesi</a>
  const desen = /<a\b[^>]*\bhref="(?:https:\/\/www\.akakce\.com)?\/([a-z0-9-]+)\.html"[^>]*>([^<]{2,60})<\/a>/g;
  let m;
  let adet = 0;
  while ((m = desen.exec(html || '')) && adet < 400) {
    adet++;
    if (!adlar[m[1]]) adlar[m[1]] = temiz(varlikCoz(m[2]));
  }
  return adlar;
}

/**
 * Arama sayfasını okur. Akakçe bazı aramaları kategori sayfasına yönlendirir; ikisi de okunur.
 * { urunler, toplam, oneri, kategoriAdlari: { slug: ad }, yontem: 'astro' | 'html' | null }
 */
export function aramaAyikla(html) {
  const ada = adalar(html);
  for (const a of ada) {
    const liste = urunDizisiBul(a.veri);
    if (!liste) continue;
    const urunler = liste.map(aramaUrunu).filter(Boolean);
    const toplam = alanBul(a.veri, 'countOfProducts', 'number');
    const ustVeri = alanBul(a.veri, 'metadata', 'object');
    return {
      urunler,
      toplam: Number.isFinite(toplam) ? Math.max(toplam, urunler.length) : urunler.length,
      oneri: ustVeri && temiz(ustVeri.correction) ? temiz(ustVeri.correction) : null,
      kategoriAdlari: kategoriAdlariTopla(a.veri, html),
      yontem: 'astro',
    };
  }
  // Sonuçsuz arama: arama bileşeni var ama ürün listesi yok
  if (ada.some((a) => a.veri && a.veri.searchData && typeof a.veri.searchData === 'object')) {
    return { urunler: [], toplam: 0, oneri: null, kategoriAdlari: {}, yontem: 'astro' };
  }
  const urunler = aramaHtml(html || '');
  return { urunler, toplam: urunler.length, oneri: null, kategoriAdlari: urunler.length ? kategoriAdlariTopla(null, html) : {}, yontem: urunler.length ? 'html' : null };
}

/** Arama doğrudan bir ürün sayfasına yönlendiyse, o sayfayı tek sonuçlu arama gibi sunar. */
export function urunSayfasindanArama(html, yol) {
  const s = urunAyikla(html);
  if (!s.urun.ad) return null;
  const urunYolu = s.urun.yol || (urunYoluGecerli(yol) ? yol : null);
  const enUcuz = s.teklifler[0] || null;
  const ikinciEl = s.ikinciEl[0] || null;
  if (!enUcuz && !ikinciEl) return null;
  const kategori = s.urun.kategoriSlug || (urunYolu ? urunYolu.split('/')[1] : null);
  return {
    urunler: [{
      kaynak: KIMLIK, kod: s.urun.kod || kodCikar(urunYolu) || '', ad: s.urun.ad, marka: s.urun.marka,
      fiyat: enUcuz ? enUcuz.toplam : null, ikinciElFiyat: ikinciEl ? ikinciEl.toplam : null, rozet: enUcuz ? null : 'İkinci el',
      fiyatSayisi: s.toplamTeklif || null, dusus: null, gorsel: s.urun.gorsel, yol: urunYolu, kategori,
    }],
    toplam: 1, oneri: null, kategoriAdlari: kategori && s.urun.kategori ? { [kategori]: s.urun.kategori } : {}, yontem: s.yontem || 'html',
  };
}

// ---------------------------------------------------------------- ürün sayfası

function yonlendirme(o, urunKodu) {
  let f = o && o.params && typeof o.params.f === 'string' ? o.params.f : null;
  if (f) {
    try { f = decodeURIComponent(f); } catch { f = null; }
  }
  if (f && YONLENDIRME.test(f)) return KOK + f;
  if (o && Number.isFinite(o.pgCode) && Number.isFinite(o.vdCode) && urunKodu) {
    return `${KOK}/r/?pr=${urunKodu}&vd=${o.vdCode}&pg=${o.pgCode}`;
  }
  return null;
}

function teklifCevir(o, urunKodu) {
  if (!o || typeof o !== 'object') return null;
  const fiyat = yuvarla(sayi(o.price));
  if (!(fiyat > 0)) return null;
  const kargo = Number.isFinite(o.shipPrice) ? yuvarla(Math.max(0, o.shipPrice)) : null;
  const magaza = temiz(o.vdName) || 'Mağaza';
  const satici = temiz(o.pgNick);
  return {
    fiyat,
    kargo,
    toplam: yuvarla(fiyat + (kargo ?? 0)),
    magaza,
    satici: satici && sade(satici) !== sade(magaza) ? satici : null,
    baslik: temiz(o.pgName) || null,
    stok: Number.isFinite(o.stock) ? o.stock : null,
    teslimat: temiz(o.deliveryText) || null,
    slogan: temiz(o.sloganText) || null,
    kampanyalar: Array.isArray(o.campaigns) ? o.campaigns.filter((k) => k && typeof k.text === 'string').map((k) => ({ type: String(k.type ?? ''), text: temiz(k.text) })) : [],
    rozet: temiz(o.badge) || null,
    rozetFiyat: sayi(o.badgePrice) > 0 ? yuvarla(o.badgePrice) : null,
    guncelleme: typeof o.lastUpdateTime === 'string' ? o.lastUpdateTime : null,
    puan: Number.isFinite(o.vdRating) ? o.vdRating : null,
    link: yonlendirme(o, urunKodu),
    dogrudan: null,
  };
}

function saticiAyir(ad) {
  const tam = temiz(ad);
  const i = tam.indexOf('/');
  if (i === -1) return { magaza: tam || 'Mağaza', satici: null };
  const magaza = tam.slice(0, i).trim() || 'Mağaza';
  const satici = tam.slice(i + 1).trim();
  return { magaza, satici: satici && sade(satici) !== sade(magaza) ? satici : null };
}

function magazaAdresi(adres) {
  return typeof adres === 'string' && /^https:\/\/[^\s"'<>]+$/.test(adres) && adres.length < 1500 ? adres : null;
}

function ldTeklifleri(ld) {
  const kume = ld && ld.offers;
  const liste = kume && Array.isArray(kume.offers) ? kume.offers : (kume && kume['@type'] === 'Offer' ? [kume] : []);
  const sonuc = [];
  for (const o of liste) {
    const fiyat = yuvarla(fiyatLd(o && o.price));
    if (!(fiyat > 0)) continue;
    if (o.itemCondition && !/NewCondition/i.test(String(o.itemCondition))) continue;
    const { magaza, satici } = saticiAyir(o.seller && o.seller.name);
    sonuc.push({
      fiyat, kargo: null, toplam: fiyat, magaza, satici, baslik: null, stok: null, teslimat: null, slogan: null,
      kampanyalar: [], rozet: null, rozetFiyat: null, guncelleme: null, puan: null, link: null, dogrudan: magazaAdresi(o.url),
    });
  }
  return sonuc;
}

function fiyatLd(x) {
  if (typeof x === 'number') return x;
  if (typeof x !== 'string') return NaN;
  const n = Number(x); // JSON-LD'de nokta ondalık ayırıcıdır: "51091.54"
  return Number.isFinite(n) ? n : NaN;
}

function kargoOku(metin) {
  const m = temiz(metin).toLocaleLowerCase('tr');
  if (!m) return null;
  if (/(ücretsiz|bedava)/.test(m)) return 0;
  const tutar = fiyatOku(m);
  return tutar !== null && /kargo/.test(m) ? tutar : null;
}

function sinifIci(html, sinif) {
  const m = new RegExp(`class="${sinif}_v\\d+[^"]*"[^>]*>([\\s\\S]*?)</(?:span|em|b)>`).exec(html);
  return m ? m[1] : null;
}

function htmlTeklifleri(html) {
  const blok = /<ul\b[^>]*\bid="PL"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  if (!blok) return [];
  const sonuc = [];
  const desen = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = desen.exec(blok[1]))) {
    const ic = m[1];
    const fiyat = fiyatOku(bitisikMetin(sinifIci(ic, 'pt') ?? ''));
    if (!(fiyat > 0)) continue;
    const kargo = kargoOku(duzMetin(sinifIci(ic, 'uk') ?? ''));
    const saticiBlok = /class="v_v\d+[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(ic);
    let magaza = 'Mağaza';
    let satici = null;
    if (saticiBlok) {
      const logo = /<img\b[^>]*\balt="([^"]*)"/.exec(saticiBlok[1]);
      const yazi = duzMetin(saticiBlok[1]).replace(/^Satıcı:\s*/i, '');
      if (logo && temiz(varlikCoz(logo[1]))) {
        magaza = temiz(varlikCoz(logo[1]));
        const kalan = yazi.replace(/^\//, '').trim();
        satici = kalan && sade(kalan) !== sade(magaza) ? kalan : null;
      } else {
        ({ magaza, satici } = saticiAyir(yazi));
      }
    }
    const rozet = /class="bdgv_v\d+[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(ic);
    sonuc.push({
      fiyat, kargo, toplam: yuvarla(fiyat + (kargo ?? 0)), magaza, satici,
      baslik: duzMetin(sinifIci(ic, 'pn') ?? '') || null,
      stok: null,
      teslimat: duzMetin(sinifIci(ic, 'sd') ?? '') || null,
      slogan: duzMetin(sinifIci(ic, 'vds') ?? '') || null,
      kampanyalar: [], rozet: rozet ? duzMetin(rozet[1]) || null : null, rozetFiyat: null, guncelleme: null, puan: null,
      link: null, dogrudan: null,
    });
  }
  return sonuc;
}

function ikinciElListesi(html) {
  const blok = /<ul\b[^>]*\bid="PLI_NN[^"]*"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  if (!blok) return [];
  const sonuc = [];
  const desen = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = desen.exec(blok[1])) && sonuc.length < 20) {
    const ic = m[1];
    const fiyat = fiyatOku(bitisikMetin(sinifIci(ic, 'pt') ?? ''));
    if (!(fiyat > 0)) continue;
    const baslik = /\btitle="([^"]*)"/.exec(ic);
    const logo = /<img\b[^>]*\bclass="vdn_v\d+[^"]*"[^>]*\balt="([^"]*)"/.exec(ic) || /<img\b[^>]*\balt="([^"]*)"[^>]*\bclass="vdn_v\d+/.exec(ic);
    let link = null;
    const param = /\bdata-params="([^"]*)"/.exec(ic);
    if (param) {
      try { link = yonlendirme({ params: JSON.parse(varlikCoz(param[1])) }, null); } catch { link = null; }
    }
    const kargo = kargoOku(duzMetin(sinifIci(ic, 'uk') ?? ''));
    sonuc.push({
      fiyat, kargo, toplam: yuvarla(fiyat + (kargo ?? 0)),
      magaza: logo ? temiz(varlikCoz(logo[1])) || 'Mağaza' : 'Mağaza',
      baslik: baslik ? temiz(varlikCoz(baslik[1])) : null,
      link,
    });
  }
  return sonuc.sort((a, b) => a.toplam - b.toplam);
}

function anahtar(t) {
  return `${t.fiyat.toFixed(2)}|${sade(t.magaza)}|${sade(t.satici || '')}`;
}

/**
 * Ürün sayfasını okur.
 * {
 *   urun: { kod, ad, marka, kategori, kategoriSlug, gorsel, yol, enDusuk1Ay, enDusuk1AyTarih },
 *   teklifler: [...]  (kargo dahil toplama göre ucuzdan pahalıya),
 *   toplamTeklif, ikinciEl: [...], secenekler: [{ ad, renk, yol }], yontem
 * }
 */
export function urunAyikla(html) {
  const ada = adalar(html);
  const listeAda = ada.find((a) => a.veri && Array.isArray(a.veri.initialPgList));
  const spotAda = ada.find((a) => a.veri && a.veri.metadata && typeof a.veri.metadata === 'object' && (a.veri.spotPg !== undefined || a.veri.metadata.code !== undefined));
  const ld = jsonLd(html).find((x) => x && typeof x === 'object' && /^(ProductGroup|Product)$/.test(String(x['@type'])) && x.offers);

  const meta = (spotAda && spotAda.veri.metadata) || (listeAda && listeAda.veri.metadata) || null;
  const baslikEtiketi = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html || '');
  const urun = {
    kod: meta && meta.code !== undefined ? String(meta.code) : (ld && ld.sku ? String(ld.sku) : null),
    ad: (meta && temiz(meta.name)) || (ld && temiz(ld.name)) || (baslikEtiketi ? duzMetin(baslikEtiketi[1]) : '') || null,
    marka: (meta && temiz(meta.mkName) && meta.mkName !== '-' ? temiz(meta.mkName) : null) || (ld && ld.brand && temiz(ld.brand.name)) || null,
    kategori: (meta && temiz(meta.ctName)) || (ld && typeof ld.category === 'string' ? temiz(ld.category.split('>').pop()) : null) || null,
    kategoriSlug: (meta && temiz(meta.ctNameUrlForm)) || null,
    gorsel: gorselDuzelt(meta && meta.imgUrl) || gorselDuzelt(ld && Array.isArray(ld.image) && ld.image[0] && (ld.image[0].contentUrl || ld.image[0])) || null,
    yol: meta && urunYoluGecerli(meta.prUrl) ? meta.prUrl : null,
    enDusuk1Ay: meta && sayi(meta.lowestPrice1M) > 0 ? yuvarla(meta.lowestPrice1M) : null,
    enDusuk1AyTarih: meta && typeof meta.lowestPriceDate1M === 'string' ? meta.lowestPriceDate1M.slice(0, 10) : null,
  };

  let teklifler = [];
  let yontem = null;
  if (listeAda) {
    teklifler = listeAda.veri.initialPgList.map((o) => teklifCevir(o, urun.kod)).filter(Boolean);
    if (spotAda && spotAda.veri.spotPg) {
      const spot = teklifCevir(spotAda.veri.spotPg, urun.kod);
      if (spot && !teklifler.some((t) => anahtar(t) === anahtar(spot))) teklifler.push(spot);
    }
    if (teklifler.length) yontem = 'astro';
  }
  const ldListe = ld ? ldTeklifleri(ld) : [];
  if (!teklifler.length && ldListe.length) { teklifler = ldListe; yontem = 'jsonld'; }
  if (!teklifler.length) {
    teklifler = htmlTeklifleri(html || '');
    if (teklifler.length) yontem = 'html';
  }
  // Mağazanın doğrudan adresi yalnızca JSON-LD'de var: fiyat + satıcı eşleşmesiyle ekle
  if (yontem !== 'jsonld' && ldListe.length) {
    const adresler = new Map();
    for (const t of ldListe) if (t.dogrudan && !adresler.has(anahtar(t))) adresler.set(anahtar(t), t.dogrudan);
    for (const t of teklifler) if (!t.dogrudan && adresler.has(anahtar(t))) t.dogrudan = adresler.get(anahtar(t));
  }
  teklifler.sort((a, b) => a.toplam - b.toplam || a.fiyat - b.fiyat);

  const secenekler = [];
  for (const v of ld && Array.isArray(ld.hasVariant) ? ld.hasVariant : []) {
    if (!v || typeof v.url !== 'string' || !v.url.startsWith(KOK)) continue;
    const yol = v.url.slice(KOK.length);
    if (!urunYoluGecerli(yol) || kodCikar(yol) === urun.kod) continue;
    secenekler.push({ ad: temiz(v.name) || temiz(v.color), renk: temiz(v.color) || null, yol });
    if (secenekler.length >= 24) break;
  }

  const filtre = listeAda && listeAda.veri.initialFilter && listeAda.veri.initialFilter.info;
  const toplamTeklif = (filtre && Number.isFinite(filtre.totalPgCount) && filtre.totalPgCount)
    || (meta && Number.isFinite(meta.countOfPrCode) && meta.countOfPrCode)
    || (ld && ld.offers && Number(ld.offers.offerCount))
    || teklifler.length;

  return {
    urun,
    teklifler,
    toplamTeklif: Math.max(Number(toplamTeklif) || 0, teklifler.length),
    ikinciEl: ikinciElListesi(html || ''),
    secenekler,
    yontem,
  };
}
