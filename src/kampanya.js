// Mağaza kampanya metinlerini (sepet indirimi, kupon, puan, taksit) okur.
// Yalnızca açıkça yazan indirimleri hesaba katar; emin olunamayan metin not olarak gösterilir.

import { fiyatOku } from './para.js';

const ILGILI = /(indirim|kupon|puan|taksit|hediye|kampanya|f[ıi]rsat|bedava|[üu]cretsiz|sepette|\bkod|%|\d)/i;
const TUTAR = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)';

function tur(metin) {
  const m = metin.toLocaleLowerCase('tr');
  if (/sepette/.test(m)) return 'sepet';
  if (/kupon|indirim kodu|\bkod/.test(m)) return 'kupon';
  if (/havale|\beft\b|nakit/.test(m) && /indirim/.test(m)) return 'odeme';
  if (/taksit/.test(m)) return 'taksit';
  if (/puan|bonus|club|chip-?para|worldpuan|maxipuan/.test(m)) return 'puan';
  if (/kargo|teslimat/.test(m)) return 'kargo';
  return 'genel';
}

/**
 * Bir kampanya metninden, fiyata uygulanabilecek açık bir indirim çıkarır.
 * { fiyat, kosullu } ya da null döner. Puan ve taksit metinleri fiyatı değiştirmez.
 */
export function indirimHesapla(metin, fiyat) {
  if (!metin || !Number.isFinite(fiyat) || fiyat <= 0) return null;
  const m = metin.toLocaleLowerCase('tr').replace(/\s+/g, ' ');
  const t = tur(metin);
  if (t === 'puan' || t === 'taksit' || t === 'kargo' || t === 'genel') return null;
  // Belirli bir kart, banka ya da üyelik isteyen indirimler koşullu sayılır
  const kosulVar = /(visa|master|troy|\bkart|banka|bonus|world|maximum|axess|paraf|ilk alışveriş|üye|premium|prime|club)/.test(m);

  // "3.000 TL ve üzeri" gibi alt sınır varsa ve fiyat altında kalıyorsa indirim uygulanmaz
  const altSinir = m.match(new RegExp(`${TUTAR}\\s*tl\\s*(?:ve\\s*)?(?:üzeri|uzeri|üstü|ustu)`));
  if (altSinir) {
    const sinir = fiyatOku(altSinir[1]);
    if (sinir && fiyat < sinir) return null;
  }
  const kalan = altSinir ? m.replace(altSinir[0], ' ') : m;
  const sonuc = (yeni, kosullu) => {
    const f = Math.round(yeni * 100) / 100;
    return f > 0 && f < fiyat && f >= fiyat * 0.3 ? { fiyat: f, kosullu } : null;
  };

  if (t === 'sepet') {
    let e = kalan.match(/sepette[^%\d]{0,25}%\s*(\d{1,2})(?:[.,]\d+)?/) || kalan.match(/%\s*(\d{1,2})(?:[.,]\d+)?[^%\d]{0,25}sepette/);
    if (e) return sonuc(fiyat * (1 - Number(e[1]) / 100), kosulVar);
    e = kalan.match(new RegExp(`sepette[^\\d%]{0,25}${TUTAR}\\s*tl[^\\d]{0,12}indirim`));
    if (e) return sonuc(fiyat - fiyatOku(e[1]), kosulVar);
    // "Sepette 48.999 TL": sepetteki son fiyat. Küçük bir tutarsa ne olduğu belirsizdir, hesaba katılmaz.
    e = kalan.match(new RegExp(`sepette[^\\d%]{0,12}${TUTAR}\\s*tl`));
    if (e) {
      const tutar = fiyatOku(e[1]);
      return tutar >= fiyat * 0.5 ? sonuc(tutar, kosulVar) : null;
    }
    return null;
  }

  if (t === 'odeme') {
    // "Havale ile ödemede %5 indirim": yalnızca o ödeme yöntemiyle geçerli
    const e = kalan.match(/%\s*(\d{1,2})(?:[.,]\d+)?[^%\d]{0,12}indirim/);
    return e ? sonuc(fiyat * (1 - Number(e[1]) / 100), true) : null;
  }

  // kupon ya da indirim kodu
  let e = kalan.match(/%\s*(\d{1,2})[^%\d]{0,20}kupon/) || kalan.match(/kupon[^%\d]{0,25}%\s*(\d{1,2})/) || kalan.match(/%\s*(\d{1,2})[^%\d]{0,12}indirim/);
  if (e) return sonuc(fiyat * (1 - Number(e[1]) / 100), true);
  // "Pasaj500 koduyla ilk alışverişe özel 500 TL indirim"
  e = kalan.match(new RegExp(`${TUTAR}\\s*tl[^\\d]{0,12}indirim`));
  if (e) return sonuc(fiyat - fiyatOku(e[1]), true);
  e = kalan.match(new RegExp(`${TUTAR}\\s*tl[^\\d]{0,25}kupon`)) || kalan.match(new RegExp(`kupon[^\\d%]{0,25}${TUTAR}\\s*tl`));
  if (e) {
    // "150 TL kupon": indirim tutarı. "Kuponla 1.249 TL": kuponlu son fiyat.
    const tutar = fiyatOku(e[1]);
    return tutar >= fiyat * 0.5 ? sonuc(tutar, true) : sonuc(fiyat - tutar, true);
  }
  return null;
}

/**
 * Bir teklifin kampanya bilgisini toplar.
 * girdi: { fiyat, slogan, kampanyalar: [{ type, text }], rozetFiyat }
 * çıktı: { notlar: [{ tur, metin }], tahmini: { fiyat, not, kosullu } | null }
 */
export function kampanyaOzeti({ fiyat, slogan, kampanyalar, rozetFiyat }) {
  const notlar = [];
  const gorulen = new Set();
  const ekle = (metin, zorunluTur) => {
    const duz = String(metin ?? '').replace(/\s+/g, ' ').trim();
    if (!duz || gorulen.has(duz)) return;
    gorulen.add(duz);
    notlar.push({ tur: zorunluTur || tur(duz), metin: duz });
  };
  // Mağaza sloganlarından yalnızca somut bir şey söyleyenler not olur ("... fırsatları kaçırma" gibi reklam cümleleri atılır)
  if (slogan && ILGILI.test(slogan)) {
    const sloganTuru = tur(slogan);
    if (sloganTuru !== 'genel' || /%\s*\d|\d\s*tl\b/i.test(slogan)) ekle(slogan);
  }
  for (const k of Array.isArray(kampanyalar) ? kampanyalar : []) {
    if (!k) continue;
    const metin = typeof k === 'string' ? k : k.text;
    const tip = typeof k === 'object' && /install/i.test(String(k.type ?? '')) ? 'taksit' : undefined;
    ekle(metin, tip);
  }

  let tahmini = null;
  for (const n of notlar) {
    const h = indirimHesapla(n.metin, fiyat);
    if (h && (!tahmini || h.fiyat < tahmini.fiyat)) tahmini = { fiyat: h.fiyat, not: n.metin, kosullu: h.kosullu };
  }
  if (Number.isFinite(rozetFiyat) && rozetFiyat > 0 && rozetFiyat < fiyat && rozetFiyat >= fiyat * 0.3) {
    if (!tahmini || rozetFiyat < tahmini.fiyat) tahmini = { fiyat: rozetFiyat, not: 'Kart kampanyası', kosullu: true };
  }
  return { notlar, tahmini };
}
