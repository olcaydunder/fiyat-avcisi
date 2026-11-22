// Astro ile üretilmiş sayfalardaki <astro-island props="..."> verisini okur.
// Astro, bileşen verisini [tür, değer] ikilileriyle yazar; burada düz nesneye çevrilir.

import { varlikCoz } from './para.js';

function ikiliCoz(ham) {
  if (!Array.isArray(ham) || ham.length !== 2 || typeof ham[0] !== 'number') return ham;
  const [tur, deger] = ham;
  switch (tur) {
    case 0: return nesneCoz(deger);
    case 1: return Array.isArray(deger) ? deger.map(ikiliCoz) : [];
    case 3: return typeof deger === 'string' ? deger : null; // tarih: metin olarak bırak
    case 4: return Array.isArray(deger) ? deger.map(ikiliCoz) : []; // Map -> [anahtar, değer] dizisi
    case 5: return Array.isArray(deger) ? deger.map(ikiliCoz) : []; // Set -> dizi
    case 6: return typeof deger === 'string' ? Number(deger) : deger; // BigInt
    case 11: return Infinity * deger;
    default: return deger; // RegExp, URL, tipli diziler: ham hâliyle
  }
}

function nesneCoz(ham) {
  if (ham === null || typeof ham !== 'object' || Array.isArray(ham)) return ham;
  const sonuc = {};
  for (const anahtar of Object.keys(ham)) sonuc[anahtar] = ikiliCoz(ham[anahtar]);
  return sonuc;
}

/** props özniteliğindeki JSON metnini düz nesneye çevirir. Bozuksa null. */
export function propsCoz(jsonMetni) {
  let ham;
  try { ham = JSON.parse(jsonMetni); } catch { return null; }
  if (ham === null || typeof ham !== 'object' || Array.isArray(ham)) return null;
  return nesneCoz(ham);
}

/**
 * Bir açılış etiketinin özniteliklerini okur. `bas`, '<' karakterinin yeridir.
 * Tırnak içindeki '>' karakterlerine takılmaz. { oznitelik, son } döner.
 */
export function etiketOku(html, bas) {
  const oznitelik = {};
  let i = bas + 1;
  const n = html.length;
  while (i < n && !/[\s/>]/.test(html[i])) i++; // etiket adı
  while (i < n) {
    while (i < n && /\s/.test(html[i])) i++;
    if (i >= n) break;
    if (html[i] === '>') return { oznitelik, son: i + 1 };
    if (html[i] === '/') { i++; continue; }
    let adBas = i;
    while (i < n && !/[\s=/>]/.test(html[i])) i++;
    const ad = html.slice(adBas, i).toLowerCase();
    while (i < n && /\s/.test(html[i])) i++;
    let deger = '';
    if (html[i] === '=') {
      i++;
      while (i < n && /\s/.test(html[i])) i++;
      const tirnak = html[i];
      if (tirnak === '"' || tirnak === "'") {
        const kapanis = html.indexOf(tirnak, i + 1);
        if (kapanis === -1) break;
        deger = html.slice(i + 1, kapanis);
        i = kapanis + 1;
      } else {
        const b = i;
        while (i < n && !/[\s>]/.test(html[i])) i++;
        deger = html.slice(b, i);
      }
    }
    if (ad) oznitelik[ad] = deger;
  }
  return { oznitelik, son: n };
}

/**
 * Sayfadaki bütün astro adalarını verir: [{ ad, dosya, veri }]
 * `veri` çözülmüş props nesnesidir (çözülemezse ada atlanır).
 */
export function adalar(html) {
  const sonuc = [];
  if (!html) return sonuc;
  let konum = 0;
  for (;;) {
    const bas = html.indexOf('<astro-island', konum);
    if (bas === -1) break;
    const { oznitelik, son } = etiketOku(html, bas);
    konum = son;
    if (!oznitelik.props) continue;
    const veri = propsCoz(varlikCoz(oznitelik.props));
    if (!veri) continue;
    sonuc.push({
      ad: oznitelik['component-export'] || '',
      dosya: (oznitelik['component-url'] || '').split('/').pop() || '',
      veri,
    });
  }
  return sonuc;
}

/** Sayfadaki JSON-LD bloklarını (çözülebilenleri) verir. */
export function jsonLd(html) {
  const sonuc = [];
  if (!html) return sonuc;
  const desen = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = desen.exec(html))) {
    try {
      const veri = JSON.parse(m[1]);
      if (Array.isArray(veri)) sonuc.push(...veri); else sonuc.push(veri);
    } catch { /* bozuk blok: atla */ }
  }
  return sonuc;
}
