import test from 'node:test';
import assert from 'node:assert/strict';
import { degerlendir, takipServisi, sessizSaatMi, istanbulSaati } from '../src/takip.js';
import { depoAc } from '../src/depo.js';
import { KaynakHatasi } from '../src/getir.js';

const SAAT = 3600_000;
const T0 = Date.UTC(2026, 10, 22, 9, 0, 0); // İstanbul 12:00

function kayit(ek = {}) {
  return { id: 'k1', ad: 'iPhone 13 128 GB', fiyat: null, hedefFiyat: null, hedefBildirildi: false, ilkFiyat: null, enDusuk: null, enYuksek: null, tepe: null, gecmis: [], sonBildirim: null, stokYok: false, ...ek };
}
const olcum = (fiyat, ek = {}) => ({ fiyat, magaza: 'idefix', satici: 'Cheap Center', kargo: 0, link: 'https://www.akakce.com/r/?pr=1&vd=2&pg=3', ...ek });

test('sessiz saat İstanbul saatine göre hesaplanır', () => {
  assert.equal(istanbulSaati(T0), 12);
  assert.equal(sessizSaatMi(T0), false);
  assert.equal(sessizSaatMi(Date.UTC(2026, 10, 22, 20, 30)), true);  // 23:30
  assert.equal(sessizSaatMi(Date.UTC(2026, 10, 22, 4, 59)), true);   // 07:59
  assert.equal(sessizSaatMi(Date.UTC(2026, 10, 22, 5, 0)), false);   // 08:00
});

test('ilk ölçüm başlangıç değerlerini yazar, bildirim üretmez', () => {
  const k = kayit();
  assert.equal(degerlendir(k, olcum(51091.54), { sessiz: true }, T0), null);
  assert.equal(k.fiyat, 51091.54);
  assert.equal(k.ilkFiyat, 51091.54);
  assert.equal(k.enDusuk, 51091.54);
  assert.equal(k.magaza, 'idefix');
  assert.deepEqual(k.gecmis, [[T0, 51091.54]]);
  assert.equal(k.tepe, 51091.54);
});

test('eşiğin altındaki düşüş bildirilmez, eşiği geçen düşüş bildirilir', () => {
  const k = kayit();
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  assert.equal(degerlendir(k, olcum(980), { esikYuzde: 3 }, T0 + SAAT), null); // %2
  const b = degerlendir(k, olcum(960), { esikYuzde: 3 }, T0 + 2 * SAAT);       // tepeye göre %4
  assert.equal(b.tur, 'dusus');
  assert.equal(b.baslik, 'İndirim: iPhone 13 128 GB');
  assert.equal(b.govde, '1.000 TL iken 960 TL oldu (%4 düştü). idefix, Cheap Center. Kargo ücretsiz. Takibe aldığından beri en düşük fiyat.');
  assert.equal(k.tepe, 960);
  assert.equal(k.oncekiFiyat, 980);
  assert.deepEqual(k.sonBildirim, { zaman: T0 + 2 * SAAT, fiyat: 960, tur: 'dusus' });
  assert.equal(degerlendir(k, olcum(960), { esikYuzde: 3 }, T0 + 3 * SAAT), null); // aynı fiyat yeniden bildirilmez
});

test('yavaş yavaş inen fiyat da en yüksek noktaya göre yakalanır', () => {
  const k = kayit();
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  assert.equal(degerlendir(k, olcum(985), {}, T0 + SAAT), null);
  assert.equal(degerlendir(k, olcum(975), {}, T0 + 2 * SAAT), null);
  const b = degerlendir(k, olcum(968), {}, T0 + 3 * SAAT);
  assert.equal(b.tur, 'dusus');
  assert.match(b.govde, /^1\.000 TL iken 968 TL oldu \(%3,2 düştü\)/);
});

test('gidip gelen fiyat 6 saat içinde aynı seviyeyi yeniden bildirmez, daha ucuzunu bildirir', () => {
  const k = kayit();
  degerlendir(k, olcum(100), { sessiz: true }, T0);
  assert.equal(degerlendir(k, olcum(96), {}, T0 + SAAT).tur, 'dusus');
  assert.equal(degerlendir(k, olcum(100), {}, T0 + 2 * SAAT), null);
  assert.equal(degerlendir(k, olcum(96), {}, T0 + 3 * SAAT), null, 'az önce bildirilen seviye');
  assert.equal(degerlendir(k, olcum(100), {}, T0 + 4 * SAAT), null);
  const dahaUcuz = degerlendir(k, olcum(90), {}, T0 + 5 * SAAT);
  assert.equal(dahaUcuz.tur, 'dusus');
  assert.match(dahaUcuz.govde, /^100 TL iken 90 TL oldu \(%10 düştü\)/);
  // 6 saat geçtikten sonra aynı seviyeye yeni bir iniş yeniden haber verilir
  assert.equal(degerlendir(k, olcum(100), {}, T0 + 12 * SAAT), null);
  assert.equal(degerlendir(k, olcum(90), {}, T0 + 13 * SAAT).tur, 'dusus');
});

test('hedef fiyat: altına ilk inişte bir kez, üstüne çıkıp yeniden inince tekrar', () => {
  const k = kayit({ hedefFiyat: 950 });
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  const b = degerlendir(k, olcum(949), { esikYuzde: 10 }, T0 + SAAT);
  assert.equal(b.tur, 'hedef');
  assert.equal(b.baslik, 'Hedef fiyata indi: iPhone 13 128 GB');
  assert.equal(b.govde, '949 TL oldu, hedefin 950 TL. idefix, Cheap Center. Kargo ücretsiz.');
  assert.equal(degerlendir(k, olcum(940), { esikYuzde: 10 }, T0 + 2 * SAAT), null);
  assert.equal(degerlendir(k, olcum(1000), { esikYuzde: 10 }, T0 + 3 * SAAT), null);
  assert.equal(k.hedefBildirildi, false);
  assert.equal(degerlendir(k, olcum(945), { esikYuzde: 10 }, T0 + 4 * SAAT).tur, 'hedef');
});

test('sessiz saatte bildirim üretilmez, sabah ilk kontrolde bildirilir', () => {
  const k = kayit();
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  assert.equal(degerlendir(k, olcum(900), { sessiz: true }, T0 + 12 * SAAT), null);
  assert.equal(k.fiyat, 900);
  assert.equal(k.tepe, 1000, 'gece karşılaştırma noktası değişmez');
  const b = degerlendir(k, olcum(900), {}, T0 + 21 * SAAT);
  assert.equal(b.tur, 'dusus');
  assert.match(b.govde, /^1\.000 TL iken 900 TL oldu/);
});

test('gece yükselip sabah eski fiyatına dönen ürün indirim sayılmaz', () => {
  const k = kayit();
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  degerlendir(k, olcum(1100), { sessiz: true }, T0 + 12 * SAAT);
  assert.equal(degerlendir(k, olcum(1000), {}, T0 + 21 * SAAT), null);
});

test('teklif kalmayınca fiyat boşalır, yeniden gelince haber verilir', () => {
  const k = kayit();
  degerlendir(k, olcum(1000), { sessiz: true }, T0);
  assert.equal(degerlendir(k, { fiyat: null }, {}, T0 + SAAT), null);
  assert.equal(k.fiyat, null);
  assert.equal(k.magaza, null);
  assert.equal(k.stokYok, true);
  assert.equal(degerlendir(k, olcum(990), { sessiz: true }, T0 + 2 * SAAT), null); // gece: sabaha kalır
  const b = degerlendir(k, olcum(990), {}, T0 + 3 * SAAT);
  assert.equal(b.tur, 'stok');
  assert.equal(b.govde, '990 TL, idefix, Cheap Center. Kargo ücretsiz.');
  assert.equal(k.stokYok, false);
});

test('fiyat geçmişi: değişince ya da 12 saatte bir nokta eklenir', () => {
  const k = kayit();
  degerlendir(k, olcum(100), { sessiz: true }, T0);
  degerlendir(k, olcum(100), {}, T0 + SAAT);
  degerlendir(k, olcum(100), {}, T0 + 13 * SAAT);
  degerlendir(k, olcum(101), {}, T0 + 14 * SAAT);
  assert.deepEqual(k.gecmis, [[T0, 100], [T0 + 13 * SAAT, 100], [T0 + 14 * SAAT, 101]]);
  assert.equal(k.enYuksek, 101);
});

function servisKur({ teklifler = [{ toplam: 1000, magaza: 'idefix', satici: null, kargo: 0, link: 'L' }], simdi = () => T0 } = {}) {
  const depo = depoAc(null);
  const durum = { teklifler, hata: null, gonderilen: [], urunCagri: 0 };
  const arama = {
    urun: async (yol, sec) => {
      durum.urunCagri++;
      assert.equal(sec.taze, true);
      if (durum.hata) throw durum.hata;
      return { urun: { gorsel: 'https://cdn.akakce.com/z/a.jpg', enDusuk1Ay: 900, enDusuk1AyTarih: '2026-10-27' }, teklifler: durum.teklifler };
    },
    marketUrunu: async (id) => (durum.market ? { id, teklifler: durum.market } : null),
  };
  const bildirim = { gonder: async (b) => { durum.gonderilen.push(b); } };
  const servis = takipServisi({ depo, arama, bildirim, simdi, rastgele: () => 0.5 });
  return { servis, depo, durum };
}
const YOL = '/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html';

test('ekle: ilk fiyatı ölçer, aynı ürünü ikinci kez eklemez, hedefi günceller', async () => {
  const { servis, depo, durum } = servisKur();
  const k = await servis.ekle({ yol: YOL, ad: 'iPhone 13 128 GB', hedefFiyat: '950' });
  assert.equal(k.fiyat, 1000);
  assert.equal(k.ilkFiyat, 1000);
  assert.equal(k.hedefFiyat, 950);
  assert.equal(k.gorsel, 'https://cdn.akakce.com/z/a.jpg');
  assert.equal(k.enDusuk1Ay, 900);
  assert.equal(k.sonrakiKontrol, T0 + 60 * 60_000);
  assert.deepEqual(durum.gonderilen, []);
  const ayni = await servis.ekle({ yol: YOL, ad: 'iPhone 13 128 GB', hedefFiyat: 900 });
  assert.equal(ayni.id, k.id);
  assert.equal(ayni.hedefFiyat, 900);
  assert.equal(depo.veri.takip.length, 1);
  await assert.rejects(servis.ekle({ yol: 'https://kotu.example/a,1.html', ad: 'x' }), (e) => e instanceof KaynakHatasi && e.tur === 'bicim');
});

test('ekle: zaten hedefin altındaysa hedef bildirimi kurulmuş sayılır', async () => {
  const { servis } = servisKur();
  const k = await servis.ekle({ yol: YOL, ad: 'x', hedefFiyat: 1200 });
  assert.equal(k.hedefBildirildi, true);
});

test('kontrolEt: indirimde bildirim gönderir, hata olursa geri çekilerek yeniden dener', async () => {
  let t = T0;
  const { servis, durum } = servisKur({ simdi: () => t });
  const k = await servis.ekle({ yol: YOL, ad: 'iPhone 13 128 GB' });
  t += SAAT;
  durum.teklifler = [{ toplam: 900, magaza: 'Trendyol', satici: 'Berke Grup', kargo: 0, link: 'L2' }];
  const s = await servis.kontrolEt(k.id);
  assert.equal(s.bildirim.tur, 'dusus');
  assert.equal(durum.gonderilen.length, 1);
  assert.equal(durum.gonderilen[0].takipId, k.id);
  assert.equal(s.kayit.magaza, 'Trendyol');

  durum.hata = new KaynakHatasi('engel', 'www.akakce.com isteği geri çevirdi (HTTP 403)', 403);
  t += SAAT;
  const h1 = await servis.kontrolEt(k.id);
  assert.deepEqual(h1.kayit.hata, { tur: 'engel', ileti: 'www.akakce.com isteği geri çevirdi (HTTP 403)' });
  assert.equal(h1.kayit.fiyat, 900, 'hata eski fiyatı silmez');
  assert.equal(h1.kayit.sonrakiKontrol, t + 15 * 60_000);
  const h2 = await servis.kontrolEt(k.id);
  assert.equal(h2.kayit.sonrakiKontrol, t + 30 * 60_000);
  durum.hata = null;
  const tamam = await servis.kontrolEt(k.id);
  assert.equal(tamam.kayit.hata, null);
  assert.equal(tamam.kayit.hataAdedi, 0);
});

test('zamanliTur: yalnızca zamanı gelen ve duraklatılmamış kayıtları kontrol eder', async () => {
  let t = T0;
  const { servis, durum } = servisKur({ simdi: () => t });
  const a = await servis.ekle({ yol: YOL, ad: 'A' });
  const b = await servis.ekle({ yol: '/x/en-ucuz-b-fiyati,2.html', ad: 'B' });
  durum.urunCagri = 0;
  assert.equal(await servis.zamanliTur(), 0);
  servis.guncelle(b.id, { durakladi: true });
  t += 61 * 60_000;
  assert.equal(await servis.zamanliTur(), 1);
  assert.equal(durum.urunCagri, 1);
  assert.equal(servis.bul(a.id).sonKontrol, t);
  servis.guncelle(b.id, { durakladi: false });
  assert.equal(await servis.zamanliTur(), 1);
});

test('guncelle ve sil', async () => {
  const { servis, depo } = servisKur();
  const k = await servis.ekle({ yol: YOL, ad: 'A' });
  assert.equal(servis.guncelle(k.id, { hedefFiyat: 1100 }).hedefBildirildi, true);
  assert.equal(servis.guncelle(k.id, { hedefFiyat: 800 }).hedefBildirildi, false);
  assert.equal(servis.guncelle(k.id, { hedefFiyat: '' }).hedefFiyat, null);
  assert.equal(servis.guncelle('yok', {}), null);
  assert.equal(servis.sil(k.id), true);
  assert.equal(servis.sil(k.id), false);
  assert.equal(depo.veri.takip.length, 0);
});

test('market ürünü takibi', async () => {
  const { servis, durum } = servisKur();
  durum.market = [{ market: 'BİM', sube: 'Çemberlitaş', fiyat: 44.5 }];
  const k = await servis.ekle({ kaynak: 'market', urunId: '2ABC', ad: 'Sek Süt 1 Lt' });
  assert.equal(k.fiyat, 44.5);
  assert.equal(k.magaza, 'BİM');
  assert.equal(k.satici, 'Çemberlitaş');
  durum.market = null; // ürün artık listede yok
  const s = await servis.kontrolEt(k.id);
  assert.equal(s.kayit.fiyat, null);
  assert.equal(s.kayit.stokYok, true);
});
