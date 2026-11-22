// Market Fiyatı (marketfiyati.org.tr): TÜBİTAK BİLGEM'in zincir market fiyat karşılaştırma hizmeti.
// Konuma yakın şubelerdeki raf fiyatlarını verir (BİM, A101, ŞOK, Migros, CarrefourSA, Tarım Kredi, Hakmar).

export const KIMLIK = 'market';
export const AD = 'Market Fiyatı';
export const KOK = 'https://api.marketfiyati.org.tr';

const ZINCIR = {
  bim: 'BİM', a101: 'A101', sok: 'ŞOK', migros: 'Migros', carrefour: 'CarrefourSA',
  tarim_kredi: 'Tarım Kredi', hakmar: 'Hakmar',
};

const temiz = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');

export function zincirAdi(kod) {
  const k = String(kod ?? '').toLowerCase();
  if (ZINCIR[k]) return ZINCIR[k];
  return k ? k.replace(/_/g, ' ').replace(/^./, (h) => h.toLocaleUpperCase('tr')) : 'Market';
}

export function konumGecerli(konum) {
  return !!konum && Number.isFinite(konum.lat) && Number.isFinite(konum.lon)
    && konum.lat >= 35 && konum.lat <= 43 && konum.lon >= 25 && konum.lon <= 45.5;
}

export function yakinIstegi(konum, mesafeKm = 5) {
  return { adres: `${KOK}/api/v2/nearest`, govde: { latitude: konum.lat, longitude: konum.lon, distance: mesafeKm } };
}

export function yakinAyikla(json) {
  if (!Array.isArray(json)) return [];
  return json.filter((d) => d && typeof d.id === 'string').slice(0, 80).map((d) => d.id);
}

export function aramaIstegi(sorgu, konum, depolar, mesafeKm = 5, adet = 24) {
  const govde = { keywords: String(sorgu).trim(), pages: 0, size: adet, latitude: konum.lat, longitude: konum.lon, distance: mesafeKm };
  if (Array.isArray(depolar) && depolar.length) govde.depots = depolar;
  return { adres: `${KOK}/api/v2/search`, govde };
}

function gorselDuzelt(adres) {
  return typeof adres === 'string' && /^https:\/\/[^\s"'<>]+$/.test(adres) ? adres : null;
}

/**
 * Arama yanıtını okur. Her ürün için zincir başına en ucuz şube tutulur.
 * [{ kaynak, id, ad, marka, miktar, gorsel, kategori, teklifler: [{ market, sube, fiyat, birimFiyat, indirimli, promosyon, tarih }], fiyat }]
 */
export function aramaAyikla(json) {
  const icerik = json && Array.isArray(json.content) ? json.content : [];
  const sonuc = [];
  for (const u of icerik) {
    if (!u || typeof u !== 'object') continue;
    const ad = temiz(u.title);
    const depolar = Array.isArray(u.productDepotInfoList) ? u.productDepotInfoList : [];
    if (!ad || !depolar.length) continue;
    const zincirler = new Map();
    for (const d of depolar) {
      if (!d || !(typeof d.price === 'number' && d.price > 0)) continue;
      const kod = String(d.marketAdi ?? '').toLowerCase();
      const eski = zincirler.get(kod);
      if (eski && eski.fiyat <= d.price) continue;
      zincirler.set(kod, {
        market: zincirAdi(kod),
        sube: temiz(d.depotName) || null,
        fiyat: d.price,
        birimFiyat: temiz(d.unitPrice) || null,
        indirimli: d.discount === true,
        promosyon: temiz(d.promotionText) || null,
        tarih: temiz(d.indexTime) || null,
      });
    }
    const teklifler = [...zincirler.values()].sort((a, b) => a.fiyat - b.fiyat);
    if (!teklifler.length) continue;
    sonuc.push({
      kaynak: KIMLIK,
      id: String(u.id ?? ''),
      ad,
      marka: temiz(u.brand) || null,
      miktar: temiz(u.refinedVolumeOrWeight) || temiz(u.refinedQuantityUnit) || null,
      gorsel: gorselDuzelt(u.imageUrl),
      kategori: temiz(u.main_category) || (Array.isArray(u.categories) && temiz(u.categories[0])) || null,
      teklifler,
      fiyat: teklifler[0].fiyat,
    });
  }
  return sonuc;
}
