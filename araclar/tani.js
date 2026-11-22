// Kaynak denemesi: bu makineden fiyat kaynaklarına erişilebiliyor mu, sayfalar okunabiliyor mu?
// Kullanım (sunucuda):  cd /opt/fiyat-avcisi && npm run tani -- "iphone 15"
// Gerçek sitelere birkaç istek atar; sonuçları ekrana yazar.

import { getiriciOlustur, KaynakHatasi, VARSAYILAN_AJAN } from '../src/getir.js';
import { aramaServisi } from '../src/arama.js';
import { depoAc } from '../src/depo.js';
import { tl } from '../src/para.js';

const sorgu = process.argv.slice(2).join(' ').trim() || 'iphone 15';
const getirici = getiriciOlustur({ ajan: process.env.KULLANICI_AJANI || VARSAYILAN_AJAN, gunluk: (m) => console.log('  ·', m) });
const servis = aramaServisi({ getirici, depo: depoAc(null) });

const yaz = (ok, metin) => console.log(`${ok ? '✔' : '✖'} ${metin}`);
let basarisiz = false;

console.log(`Kimlik: ${process.env.KULLANICI_AJANI || VARSAYILAN_AJAN}`);
console.log(`Arama : "${sorgu}"\n`);

try {
  const s = await servis.ara(sorgu);
  const ak = s.kaynaklar.akakce;
  if (ak.tamam) {
    yaz(true, `Akakçe arama: ${ak.adet} ürün, okuma yolu ${ak.yontem}, ${ak.sureMs} ms`);
    for (const u of s.urunler.slice(0, 5)) console.log(`    ${String(u.fiyat !== null ? tl(u.fiyat) : `${tl(u.ikinciElFiyat)} (ikinci el)`).padStart(16)}  ${u.ad}`);
    console.log(`    önerilen kategori: ${s.onerilenKategori || '-'}`);
    const ilk = s.urunler.find((u) => u.yol && u.fiyat !== null);
    if (ilk) {
      try {
        const u = await servis.urun(ilk.yol);
        yaz(true, `Akakçe ürün sayfası: ${u.teklifler.length} teklif, okuma yolu ${u.yontem} (${u.urun.ad})`);
        for (const t of u.teklifler.slice(0, 5)) console.log(`    ${tl(t.toplam).padStart(16)}  ${[t.magaza, t.satici].filter(Boolean).join(', ')}${t.kargo ? ` (+${tl(t.kargo)} kargo dahil)` : ''}`);
        if (!u.teklifler.length) basarisiz = true;
      } catch (e) { basarisiz = true; yaz(false, `Akakçe ürün sayfası: ${e instanceof KaynakHatasi ? `${e.tur}: ${e.message}` : e.stack}`); }
    }
  } else {
    basarisiz = true;
    yaz(false, `Akakçe arama: ${ak.tur}: ${ak.ileti}`);
  }
  const m = s.kaynaklar.market;
  if (m) yaz(m.tamam, m.tamam ? `Market Fiyatı: yanıt verdi, bu aramayla ilgili ${m.adet} ürün, ${m.sureMs} ms` : `Market Fiyatı: ${m.tur}: ${m.ileti}`);
} catch (e) {
  basarisiz = true;
  yaz(false, e instanceof KaynakHatasi ? `${e.tur}: ${e.message}` : e.stack);
}

console.log('\nSite durumu:');
for (const [host, d] of Object.entries(getirici.durum())) {
  console.log(`  ${host}: ${d.toplamIstek} istek${d.engelli ? ', GEÇİCİ OLARAK GERİ ÇEVRİLDİ' : ''}${d.sonHata ? `, son hata: ${d.sonHata.ileti}` : ''}`);
}
process.exit(basarisiz ? 1 : 0);
