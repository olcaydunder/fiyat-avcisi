// Para ve metin yardımcıları: Türkçe fiyat okuma/yazma, arama için sadeleştirme.

const TL_BICIM = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TL_TAM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

/** 51091.54 -> "51.091,54 TL" */
export function tl(sayi) {
  if (sayi === null || sayi === undefined || !Number.isFinite(Number(sayi))) return '';
  return `${TL_BICIM.format(Number(sayi))} TL`;
}

/** Bildirim gibi dar yerler için: kuruş yoksa yazmaz. 51091 -> "51.091 TL" */
export function tlKisa(sayi) {
  if (sayi === null || sayi === undefined || !Number.isFinite(Number(sayi))) return '';
  const n = Number(sayi);
  return `${Number.isInteger(n) ? TL_TAM.format(n) : TL_BICIM.format(n)} TL`;
}

/**
 * Türkçe yazılmış bir tutarı sayıya çevirir.
 * "51.091,54 TL" -> 51091.54, "54.999 TL" -> 54999, "290,00" -> 290, "1.308,61₺" -> 1308.61
 * Tutarı bulamazsa null döner.
 */
export function fiyatOku(metin) {
  if (typeof metin === 'number') return Number.isFinite(metin) ? metin : null;
  if (!metin) return null;
  const m = String(metin).replace(/ /g, ' ').match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  if (!m) return null;
  const tam = m[1].replace(/\./g, '');
  const kurus = m[2] ? m[2].padEnd(2, '0') : '00';
  const n = Number(`${tam}.${kurus}`);
  return Number.isFinite(n) ? n : null;
}

const HARF = { 'ı': 'i', 'İ': 'i', 'I': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', 'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u' };

/** Karşılaştırma için sadeleştirir: küçük harf, Türkçe harfler düz, noktalama boşluk. */
export function sade(metin) {
  return String(metin ?? '')
    .replace(/[ıİIşŞğĞüÜöÖçÇâÂîÎûÛ]/g, (h) => HARF[h])
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Arama sözcükleri. Harf-rakam sınırında da böler: "128gb" -> ["128","gb"], "hd9285/96" -> ["hd","9285","96"].
 */
export function sozcukler(metin) {
  const s = sade(metin).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
  return s ? s.split(/\s+/) : [];
}

/** HTML varlıklarını çözer (öznitelik ve metin için yeterli küme). */
export function varlikCoz(metin) {
  if (!metin || metin.indexOf('&') === -1) return metin ?? '';
  const AD = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
  return metin.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tum, v) => {
    if (v[0] === '#') {
      const kod = v[1] === 'x' || v[1] === 'X' ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10);
      return Number.isFinite(kod) && kod > 0 && kod < 0x110000 ? String.fromCodePoint(kod) : tum;
    }
    const k = v.toLowerCase();
    return Object.prototype.hasOwnProperty.call(AD, k) ? AD[k] : tum;
  });
}

/** Etiketleri ve yorumları atıp düz metin verir. */
export function duzMetin(html) {
  return varlikCoz(String(html ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Etiketleri araya boşluk koymadan atar. Fiyat gibi parçalı yazılan metinler için:
 * "51.091<i>,54 TL</i>" -> "51.091,54 TL"
 */
export function bitisikMetin(html) {
  return varlikCoz(String(html ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Yüzde değişim: (yeni - eski) / eski * 100, bir ondalık. */
export function yuzdeDegisim(eski, yeni) {
  if (!eski || !Number.isFinite(eski) || !Number.isFinite(yeni)) return 0;
  return Math.round(((yeni - eski) / eski) * 1000) / 10;
}
