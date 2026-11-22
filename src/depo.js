// Kalıcı veri: tek bir JSON dosyası (takip listesi, fiyat geçmişi, bildirim aboneleri, ayarlar).
// Yazma işlemi önce geçici dosyaya yapılır, sonra yer değiştirilir; yarım kalmış dosya oluşmaz.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const VARSAYILAN_AYAR = {
  kontrolDakika: 60,          // takipteki ürünler kaç dakikada bir kontrol edilsin
  esikYuzde: 3,               // en az yüzde kaç düşüşte bildirim gitsin
  marketAcik: true,           // market (BİM, A101, ŞOK, Migros...) fiyatları da aransın
  konum: { lat: 41.0082, lon: 28.9784, ad: 'İstanbul' },
  mesafeKm: 5,
};

function bos() {
  return { surum: 1, ayar: { ...VARSAYILAN_AYAR }, vapid: null, takip: [], aboneler: [], bildirimler: [], aramalar: [] };
}

function onar(veri) {
  const temel = bos();
  if (!veri || typeof veri !== 'object') return temel;
  const sonuc = { ...temel, ...veri };
  sonuc.ayar = { ...VARSAYILAN_AYAR, ...(veri.ayar && typeof veri.ayar === 'object' ? veri.ayar : {}) };
  if (!sonuc.ayar.konum || typeof sonuc.ayar.konum !== 'object') sonuc.ayar.konum = { ...VARSAYILAN_AYAR.konum };
  for (const alan of ['takip', 'aboneler', 'bildirimler', 'aramalar']) if (!Array.isArray(sonuc[alan])) sonuc[alan] = [];
  return sonuc;
}

/**
 * dizin: veri klasörü. null verilirse yalnızca bellekte tutar (testler için).
 * { veri, kaydet(), hemenKaydet() }
 */
export function depoAc(dizin) {
  const dosya = dizin ? path.join(dizin, 'veri.json') : null;
  let veri = bos();
  if (dosya) {
    mkdirSync(dizin, { recursive: true });
    if (existsSync(dosya)) {
      try {
        veri = onar(JSON.parse(readFileSync(dosya, 'utf8')));
      } catch {
        // Bozuk dosyayı silmeden kenara al, temiz başla
        try { renameSync(dosya, `${dosya}.bozuk-${Date.now()}`); } catch { /* yok say */ }
        veri = bos();
      }
    }
  }

  let zamanlayici = null;
  function hemenKaydet() {
    if (zamanlayici) { clearTimeout(zamanlayici); zamanlayici = null; }
    if (!dosya) return;
    const gecici = `${dosya}.yeni`;
    writeFileSync(gecici, JSON.stringify(veri), { mode: 0o600 });
    renameSync(gecici, dosya);
  }
  function kaydet() {
    if (!dosya || zamanlayici) return;
    zamanlayici = setTimeout(() => {
      zamanlayici = null;
      try { hemenKaydet(); } catch (e) { console.error('Veri kaydedilemedi:', e.message); }
    }, 400);
    if (zamanlayici.unref) zamanlayici.unref();
  }

  return { get veri() { return veri; }, kaydet, hemenKaydet };
}
