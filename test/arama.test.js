import test from 'node:test';
import assert from 'node:assert/strict';
import { aramaServisi, uyumPuani, kategoriOzeti, anaSozcuklerTutar } from '../src/arama.js';
import { getiriciOlustur, KaynakHatasi } from '../src/getir.js';
import { depoAc } from '../src/depo.js';
import { sozcukler } from '../src/para.js';
import { sahteAg, sahteSaat, aramaSayfasi, urunSayfasi, ROBOTS_AKAKCE, MARKET_YANITI, TEKLIFLER } from './yardimci.js';

const AK = 'https://www.akakce.com';
const MF = 'https://api.marketfiyati.org.tr';

function kur(rotalar = {}) {
  const ag = sahteAg({
    [`${AK}/robots.txt`]: ROBOTS_AKAKCE,
    [`${AK}/arama/?q=iphone+13`]: aramaSayfasi(),
    [`${AK}/arama/?q=iPhone+13`]: aramaSayfasi(),
    [`${AK}/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html`]: urunSayfasi(),
    [`${MF}/api/v2/nearest`]: JSON.stringify([{ id: 'bim-U751' }, { id: 'migros-4453' }]),
    [`${MF}/api/v2/search`]: JSON.stringify(MARKET_YANITI),
    ...rotalar,
  });
  const saat = sahteSaat();
  const getirici = getiriciOlustur({ fetchImpl: ag.fetchImpl, simdi: saat.simdi, bekle: saat.bekle });
  const depo = depoAc(null);
  return { servis: aramaServisi({ getirici, depo }), ag, depo, saat };
}

test('uyumPuani: sayılar birebir, sözcükler ek toleranslı eşleşir', () => {
  const p = (q, b) => uyumPuani(sozcukler(q), b);
  assert.equal(p('iphone 13', 'Apple iPhone 13 128 GB'), 1);
  assert.equal(p('iphone 13', 'iPhone 130 Kılıf'), 0.5);
  assert.equal(p('telefon kılıf', 'Telefonu Kılıfı Silikon'), 1);
  assert.equal(p('kulaklığı', 'Bluetooth Kulaklık'), 1);
  assert.equal(p('128gb', 'iPhone 13 128 GB'), 1);
  assert.equal(p('kitap', 'Kitabı Okuyorum'), 1);
  assert.equal(p('kılıf', 'Kılıç Seti'), 0);
  assert.equal(p('süt', 'Sütaş Ayran'), 0); // üç harfli sözcükte ek toleransı yok
  assert.equal(p('galaxy', 'Galata Kulesi Maketi'), 0);
  assert.equal(p('', 'x'), 0);
});

test('anaSozcuklerTutar: sayı ve birim dışındaki sözcüklerin hepsi geçmeli', () => {
  const a = (q, b) => anaSozcuklerTutar(sozcukler(q), b);
  assert.equal(a('süt 1 lt', 'İçim Süt 1 Lt'), true);
  assert.equal(a('süt 1 lt', 'Çamaşır Suyu 1 Lt'), false);
  assert.equal(a('1 lt', 'Çamaşır Suyu 1 Lt'), true);
  assert.equal(a('iphone 13', 'Hakmar 13 lü Yumurta'), false);
});

test('kategoriOzeti: çok satıcılı ve üst sıradaki ürünlerin kategorisi önerilir', () => {
  const urunler = [
    { kategori: 'cep-telefonu', uyum: 1, fiyat: 49899, fiyatSayisi: 29 },
    { kategori: 'telefon-kilifi', uyum: 1, fiyat: 99, fiyatSayisi: 1 },
    { kategori: 'telefon-kilifi', uyum: 1, fiyat: 120, fiyatSayisi: 1 },
    { kategori: 'telefon-kilifi', uyum: 1, fiyat: 140, fiyatSayisi: 2 },
    { kategori: 'cep-telefonu', uyum: 1, fiyat: 51000, fiyatSayisi: 10 },
    { kategori: null, uyum: 1, fiyat: 2039, fiyatSayisi: 1 },
  ];
  const { kategoriler, onerilen } = kategoriOzeti(urunler, { 'cep-telefonu': 'Cep Telefonu' });
  assert.equal(onerilen, 'cep-telefonu');
  assert.deepEqual(kategoriler.map((k) => [k.slug, k.ad, k.adet]), [['cep-telefonu', 'Cep Telefonu', 2], ['telefon-kilifi', 'Telefon kilifi', 3], ['diger', 'Diğer', 1]]);
  assert.equal(kategoriOzeti([], {}).onerilen, null);
});

test('ara: Akakçe ürünleri uyum puanıyla, market ürünleri süzülerek döner', async () => {
  const { servis, depo } = kur();
  const s = await servis.ara('  iPhone   13 ');
  assert.equal(s.sorgu, 'iPhone 13');
  assert.equal(s.urunler.length, 7);
  assert.equal(s.urunler[0].uyum, 1);
  assert.equal(s.urunler[0].sira, 0);
  assert.equal(s.onerilenKategori, 'cep-telefonu');
  assert.equal(s.kaynaklar.akakce.tamam, true);
  assert.equal(s.kaynaklar.akakce.yontem, 'astro');
  assert.deepEqual(s.market, []); // süt sonuçları "iphone 13" ile ilgisiz
  assert.equal(s.kaynaklar.market.tamam, true);
  assert.deepEqual(depo.veri.aramalar, ['iPhone 13']);
});

test('ara: market sonuçları ilgili olduğunda gösterilir, yakın şubeler gönderilir', async () => {
  const { servis, ag } = kur({ [`${AK}/arama/?q=s%C3%BCt+1+lt`]: aramaSayfasi({ urunler: [] }) });
  const s = await servis.ara('süt 1 lt');
  assert.deepEqual(s.market.map((u) => u.ad), ['Sek Tam Yağlı Pastörize Süt 1 Lt', 'İçim Süt 1 Lt']);
  assert.equal(s.market[0].fiyat, 44.5);
  const arama = ag.cagrilar.find((c) => c.adres.endsWith('/api/v2/search'));
  assert.deepEqual(JSON.parse(arama.govde).depots, ['bim-U751', 'migros-4453']);
});

test('ara: market kapalıysa hiç sorulmaz; bir kaynak düşse diğeri gösterilir', async () => {
  const a = kur();
  a.depo.veri.ayar.marketAcik = false;
  const s1 = await a.servis.ara('iphone 13');
  assert.equal('market' in s1.kaynaklar, false);
  assert.equal(a.ag.cagrilar.some((c) => c.adres.startsWith(MF)), false);

  const b = kur({ [`${AK}/arama/?q=iphone+13`]: { durum: 403, metin: 'engel' } });
  const s2 = await b.servis.ara('iphone 13');
  assert.deepEqual(s2.urunler, []);
  assert.equal(s2.kaynaklar.akakce.tamam, false);
  assert.equal(s2.kaynaklar.akakce.tur, 'engel');
  assert.equal(s2.kaynaklar.market.tamam, true);
  assert.deepEqual(b.depo.veri.aramalar, []);

  const c = kur({ [`${AK}/arama/?q=iphone+13`]: '<html><body>Bakımdayız</body></html>' });
  const s3 = await c.servis.ara('iphone 13');
  assert.equal(s3.kaynaklar.akakce.tur, 'bicim');
});

test('ara: geçersiz sorgu reddedilir', async () => {
  const { servis } = kur();
  await assert.rejects(servis.ara('a'), (e) => e instanceof KaynakHatasi && e.tur === 'bicim');
  await assert.rejects(servis.ara('x'.repeat(121)), (e) => e.tur === 'bicim');
  await assert.rejects(servis.ara('!!!'), (e) => e.tur === 'bicim');
});

test('urun: teklifler, kampanya notları ve en ucuz', async () => {
  const { servis } = kur();
  const u = await servis.urun('/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html');
  assert.equal(u.enUcuz.toplam, 51091.54);
  assert.equal(u.enUcuz.magaza, 'idefix');
  assert.deepEqual(u.enUcuz.notlar, []); // "Alışılmadık Alışveriş" reklam cümlesi, not değil
  assert.equal('slogan' in u.enUcuz, false);
  const pazarama = u.teklifler.find((t) => t.magaza === 'Pazarama');
  assert.deepEqual(pazarama.notlar.map((n) => n.tur), ['puan', 'taksit']);
  assert.equal(pazarama.tahmini, null);
  assert.equal(u.kampanyaliEnUcuz, null);
  assert.equal(u.urun.akakce, 'https://www.akakce.com/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html');
  await assert.rejects(servis.urun('https://kotu.example/a,1.html'), (e) => e.tur === 'bicim');
});

test('urun: açık sepet indirimi olan teklif ayrıca gösterilir ama sıralamayı değiştirmez', async () => {
  const teklifler = TEKLIFLER.map((t) => ({ ...t }));
  teklifler[1] = { ...teklifler[1], sloganText: 'Sepette %5 indirim', campaigns: [] }; // 51.699,06 -> 49.114,11
  const { servis } = kur({ [`${AK}/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html`]: urunSayfasi({ teklifler }) });
  const u = await servis.urun('/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html');
  assert.equal(u.enUcuz.magaza, 'idefix');
  assert.equal(u.kampanyaliEnUcuz.magaza, 'Pazarama');
  assert.equal(u.kampanyaliEnUcuz.tahmini.toplam, 49114.11);
  assert.equal(u.kampanyaliEnUcuz.tahmini.kosullu, false);
});

test('urun: taze istek önbelleği atlar', async () => {
  const { servis, ag } = kur();
  const yol = '/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html';
  await servis.urun(yol); await servis.urun(yol);
  assert.equal(ag.cagrilar.filter((c) => c.adres.endsWith('1377791125.html')).length, 1);
  await servis.urun(yol, { taze: true });
  assert.equal(ag.cagrilar.filter((c) => c.adres.endsWith('1377791125.html')).length, 2);
});
