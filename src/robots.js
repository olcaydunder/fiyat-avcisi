// robots.txt okuyucu (RFC 9309): bir adresin otomatik erişime açık olup olmadığını söyler.
// Uygulama, sitelerin yasakladığı yolları hiç istemez.

function desenDerle(desen) {
  // '*' herhangi bir dizi, sondaki '$' adres sonu; kalan her şey harfi harfine, baştan eşleşir.
  let d = desen;
  let sonaBagli = false;
  if (d.endsWith('$')) { sonaBagli = true; d = d.slice(0, -1); }
  const kaynak = d.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${kaynak}${sonaBagli ? '$' : ''}`);
}

/** robots.txt metnini gruplara ayırır: [{ ajanlar: [..], kurallar: [{ izin, desen, ifade }] }] */
export function robotsOku(metin) {
  const gruplar = [];
  let grup = null;
  let kuralBasladi = false;
  for (const hamSatir of String(metin ?? '').split(/\r?\n/)) {
    const satir = hamSatir.replace(/#.*$/, '').trim();
    if (!satir) continue;
    const iki = satir.indexOf(':');
    if (iki === -1) continue;
    const alan = satir.slice(0, iki).trim().toLowerCase();
    const deger = satir.slice(iki + 1).trim();
    if (alan === 'user-agent') {
      // Art arda gelen User-agent satırları aynı grubu paylaşır
      if (!grup || kuralBasladi) { grup = { ajanlar: [], kurallar: [] }; gruplar.push(grup); kuralBasladi = false; }
      grup.ajanlar.push(deger.toLowerCase());
    } else if (alan === 'allow' || alan === 'disallow') {
      if (!grup) continue;
      kuralBasladi = true;
      if (deger === '' || deger.length > 500) continue; // boş Disallow: her şey serbest
      try { grup.kurallar.push({ izin: alan === 'allow', desen: deger, ifade: desenDerle(deger) }); } catch { /* derlenemeyen kural: atla */ }
    }
  }
  return gruplar;
}

/**
 * `ajan` (ürün adı, ör. "fiyatavcisi") için `yol` (path + ?query) serbest mi?
 * En uzun eşleşen kural geçerlidir; eşitlikte izin kazanır. Kural yoksa serbest.
 */
export function robotsIzinli(gruplar, ajan, yol) {
  const a = String(ajan || '').toLowerCase();
  let secilen = gruplar.filter((g) => g.ajanlar.some((x) => x && x !== '*' && a.includes(x)));
  if (!secilen.length) secilen = gruplar.filter((g) => g.ajanlar.includes('*'));
  let enIyi = null;
  for (const g of secilen) {
    for (const k of g.kurallar) {
      if (!k.ifade.test(yol)) continue;
      const uzunluk = k.desen.length;
      if (!enIyi || uzunluk > enIyi.uzunluk || (uzunluk === enIyi.uzunluk && k.izin && !enIyi.izin)) {
        enIyi = { uzunluk, izin: k.izin };
      }
    }
  }
  return enIyi ? enIyi.izin : true;
}
