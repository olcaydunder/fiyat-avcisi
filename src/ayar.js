// Ortam ayarları (.env dosyası ya da systemd EnvironmentFile) ve sürüm bilgisi.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function envYukle(dosya) {
  let icerik = '';
  try { icerik = readFileSync(dosya, 'utf8'); } catch { return; } // servis altında değerler systemd'den gelir
  for (const satir of icerik.split(/\r?\n/)) {
    const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** GitHub'dan çekilen sürümün kısa kimliği (sunucunun güncellenip güncellenmediğini görmek için). */
export function surumOku(kok = KOK) {
  try {
    let h = readFileSync(path.join(kok, '.git', 'HEAD'), 'utf8').trim();
    if (h.startsWith('ref: ')) {
      const ref = h.slice(5);
      try { h = readFileSync(path.join(kok, '.git', ref), 'utf8').trim(); }
      catch { h = (readFileSync(path.join(kok, '.git', 'packed-refs'), 'utf8').split('\n').find((x) => x.endsWith(` ${ref}`)) || '').split(' ')[0]; }
    }
    return h.slice(0, 7);
  } catch { return ''; }
}

export function ayarOku() {
  envYukle(path.join(KOK, '.env'));
  const alan = String(process.env.ALAN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return {
    port: Number(process.env.PORT || 3100),
    dinle: String(process.env.DINLE || '127.0.0.1'),
    alan: /^[a-z0-9.-]+$/.test(alan) ? alan : '',
    girisKodu: String(process.env.GIRIS_KODU || '').trim(),
    veriDizini: process.env.VERI_DIZINI || process.env.STATE_DIRECTORY || path.join(KOK, 'veri'),
    ajan: String(process.env.KULLANICI_AJANI || '').trim(),
    // Android uygulamasının imza parmak izi (assetlinks.json için); virgülle birden çok olabilir
    apkParmakIzi: String(process.env.APK_PARMAK_IZI || '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x)),
    apkPaket: String(process.env.APK_PAKET || 'tr.fiyatavcisi.twa').trim(),
    surum: surumOku(),
  };
}
