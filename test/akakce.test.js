import test from 'node:test';
import assert from 'node:assert/strict';
import { aramaAdresi, aramaAyikla, urunAdresi, urunAyikla, urunYoluGecerli } from '../src/kaynaklar/akakce.js';
import { aramaSayfasi, bosAramaSayfasi, urunSayfasi } from './yardimci.js';

test('adresler', () => {
  assert.equal(aramaAdresi('iphone 13'), 'https://www.akakce.com/arama/?q=iphone+13');
  assert.equal(aramaAdresi('çay & şeker', 2), 'https://www.akakce.com/arama/?q=%C3%A7ay+%26+%C5%9Feker&p=2');
  assert.equal(urunAdresi('/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html'), 'https://www.akakce.com/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html');
  assert.throws(() => urunAdresi('/r/?pr=1'));
});

test('urunYoluGecerli yalnızca ürün sayfası yollarını kabul eder', () => {
  assert.equal(urunYoluGecerli('/fritoz/en-ucuz-philips-airfryer-5000-serisi-hd9285-96-xxl-connect-fiyati,367256993.html'), true);
  for (const kotu of ['https://kotu.example/a,1.html', '//kotu.example/a,1.html', '/a/b/c,1.html', '/a/b,1.html?x=1', '/a/b,1.html#x', '/a/../b,1.html/..', '/magaza/idefix,1.html', '/arama/?q=x', '', null, 5, '/a/b.html']) {
    assert.equal(urunYoluGecerli(kotu), false, String(kotu));
  }
});

test('arama: gömülü veriden ürünleri okur', () => {
  const s = aramaAyikla(aramaSayfasi());
  assert.equal(s.yontem, 'astro');
  assert.equal(s.toplam, 500);
  assert.equal(s.urunler.length, 7);
  assert.deepEqual(s.kategoriAdlari, { 'cep-telefonu': 'Cep Telefonu', 'sarj-aleti': 'Şarj Aleti', 'telefon-kilifi': 'Telefon Kılıfı' });
  const [a, , , d, ikinci, tek, sarj] = s.urunler;
  assert.deepEqual(a, { kaynak: 'akakce', kod: '1101115595', ad: 'iPhone 13 128 GB', marka: 'Apple', fiyat: 49899, ikinciElFiyat: null, rozet: null, fiyatSayisi: 29, dusus: null, gorsel: 'https://cdn.akakce.com/x/apple/iphone-13.jpg', yol: '/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html', kategori: 'cep-telefonu' });
  assert.equal(d.fiyat, 49132.36);
  assert.equal(d.dusus, 12);
  assert.equal(ikinci.fiyat, null);
  assert.equal(ikinci.ikinciElFiyat, 27810.68);
  assert.equal(ikinci.rozet, 'İkinci el');
  assert.equal(tek.yol, null); // tek mağazalı ürünün karşılaştırma sayfası yok
  assert.equal(tek.marka, null);
  assert.equal(tek.kategori, null);
  assert.equal(sarj.kategori, 'sarj-aleti');
});

test('arama: gömülü veri yoksa HTML listesinden okur', () => {
  const s = aramaAyikla(aramaSayfasi({ astro: false }));
  assert.equal(s.yontem, 'html');
  assert.equal(s.urunler.length, 4);
  assert.deepEqual(s.urunler.map((u) => [u.kod, u.fiyat, u.ikinciElFiyat, u.fiyatSayisi, u.dusus, u.yol !== null]), [
    ['1101115595', 49899, null, 29, null, true],
    ['1377791139', 49132.36, null, 1, 12, true],
    ['1377791189', null, 27810.68, 0, null, true],
    ['1476138212', 2039.15, null, 1, null, false],
  ]);
  assert.equal(s.urunler[0].ad, 'iPhone 13 128 GB');
  assert.equal(s.urunler[0].marka, 'Apple');
  assert.equal(s.urunler[2].rozet, 'İkinci el');
});

test('arama: sonuçsuz sayfa ve alakasız içerik', () => {
  const bos = aramaAyikla(bosAramaSayfasi());
  assert.equal(bos.yontem, 'astro');
  assert.deepEqual(bos.urunler, []);
  const engel = aramaAyikla('<html><body>Erişim engellendi</body></html>');
  assert.equal(engel.yontem, null);
  assert.deepEqual(engel.urunler, []);
  assert.equal(aramaAyikla(aramaSayfasi({ oneri: 'iphone 13 pro' })).oneri, 'iphone 13 pro');
});

test('arama: güvenli olmayan alanlar ayıklanır', () => {
  const s = aramaAyikla(aramaSayfasi({ urunler: [
    { code: 1, name: 'Kötü görsel', price: 10, countOfPrices: 1, mkName: 'X', imageUrl: 'javascript:alert(1)', url: 'https://kotu.example/x,1.html' },
    { code: 2, name: '', price: 10 },
    { code: 3, name: 'Fiyatsız', price: 0 },
    { code: 4, name: 'Protokolsüz görsel', price: 5, imageUrl: '//cdn.akakce.com/x/a.jpg', url: '/a/en-ucuz-b-fiyati,4.html' },
  ] }));
  assert.equal(s.urunler.length, 2);
  assert.equal(s.urunler[0].gorsel, null);
  assert.equal(s.urunler[0].yol, null);
  assert.equal(s.urunler[1].gorsel, 'https://cdn.akakce.com/x/a.jpg');
});

test('ürün: gömülü veriden teklifleri kargo dahil sıralar', () => {
  const s = urunAyikla(urunSayfasi());
  assert.equal(s.yontem, 'astro');
  assert.deepEqual(s.urun, {
    kod: '1377791125', ad: 'iPhone 13 128 GB Yıldız Işığı', marka: 'Apple', kategori: 'Cep Telefonu', kategoriSlug: 'cep-telefonu',
    gorsel: 'https://cdn.akakce.com/z/apple/iphone-13-128-gb-yildiz-isigi.jpg',
    yol: '/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html', enDusuk1Ay: 40000, enDusuk1AyTarih: '2026-10-27',
  });
  assert.equal(s.toplamTeklif, 10);
  // 51.000 + 144,99 kargo = 51.144,99 -> ücretsiz kargolu 51.091,54'ün arkasına düşer
  assert.deepEqual(s.teklifler.map((t) => [t.toplam, t.magaza, t.satici]), [
    [51091.54, 'idefix', 'Cheap Center'], [51144.99, 'Trendyol', null], [51699.06, 'Pazarama', 'ALTINKOZA TEKNOLOJİM'], [51845.11, 'Trendyol', 'Berke Grup'],
  ]);
  const ilk = s.teklifler[0];
  assert.equal(ilk.link, 'https://www.akakce.com/r/?pr=1377791125&vd=13275&pg=1777266314');
  assert.equal(ilk.dogrudan, 'https://www.idefix.com/apple-iphone-13-128-gb-beyaz-apple-turkiye-garantili-p-374820?vendorId=14212');
  assert.equal(ilk.kargo, 0);
  assert.equal(ilk.stok, 2);
  assert.equal(ilk.teslimat, 'Yarın kargoda');
  assert.equal(ilk.rozet, 'Kargo Dahil En Ucuz');
  assert.equal(s.teklifler[1].kargo, 144.99);
  assert.equal(s.teklifler[1].puan, 4.5);
  assert.deepEqual(s.teklifler[2].kampanyalar, [{ type: 'Installment', text: 'Peşin fiyatına 9 taksit' }]);
  assert.equal(s.teklifler[2].slogan, 'Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan');
});

test('ürün: ikinci el listesi ve diğer seçenekler', () => {
  const s = urunAyikla(urunSayfasi());
  assert.deepEqual(s.ikinciEl, [{ fiyat: 26999, kargo: 0, toplam: 26999, magaza: 'Teknosa', baslik: 'Yenilenmiş iPhone 13 128 GB Yıldız Işığı Cep Telefonu (1 Yıl Garantili) - B Kalite', link: 'https://www.akakce.com/r/?pr=1377791125&vd=10402&pg=1800940125' }]);
  assert.deepEqual(s.secenekler, [{ ad: 'iPhone 13 128 GB Gece Yarısı', renk: 'Gece Yarısı', yol: '/cep-telefonu/en-ucuz-iphone-13-128-gb-gece-yarisi-fiyati,1377791122.html' }]);
});

test('ürün: gömülü veri yoksa JSON-LD, o da yoksa HTML', () => {
  const ld = urunAyikla(urunSayfasi({ astro: false, html: false }));
  assert.equal(ld.yontem, 'jsonld');
  assert.deepEqual(ld.teklifler.map((t) => [t.toplam, t.magaza, t.satici, t.link, t.dogrudan !== null]), [
    [51091.54, 'idefix', 'Cheap Center', null, true], [51699.06, 'Pazarama', 'ALTINKOZA TEKNOLOJİM', null, true], [51845.11, 'Trendyol', 'Berke Grup', null, true],
  ]);
  assert.equal(ld.urun.ad, 'iPhone 13 128 GB Yıldız Işığı');
  assert.equal(ld.urun.kategori, 'iPhone');
  assert.equal(ld.urun.marka, 'Apple');
  assert.equal(ld.toplamTeklif, 10);

  const html = urunAyikla(urunSayfasi({ astro: false, ld: false }));
  assert.equal(html.yontem, 'html');
  assert.deepEqual(html.teklifler.map((t) => [t.fiyat, t.kargo, t.magaza, t.satici, t.teslimat, t.rozet]), [
    [51091.54, 0, 'idefix', 'Cheap Center', 'Yarın kargoda', 'Kargo Dahil En Ucuz'], [51699.06, 0, 'Pazarama', 'ALTINKOZA TEKNOLOJİM', '2 iş günü', null],
  ]);
  assert.equal(html.teklifler[1].slogan, 'Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan');
  assert.equal(html.urun.ad, 'iPhone 13 128 GB Yıldız Işığı');
});

test('ürün: okunamayan sayfa boş sonuç verir, bozuk yönlendirme linke dönüşmez', () => {
  const bos = urunAyikla('<html><body>hata</body></html>');
  assert.equal(bos.yontem, null);
  assert.deepEqual(bos.teklifler, []);
  assert.equal(bos.urun.ad, null);

  const kotu = urunAyikla(urunSayfasi({ ld: false, teklifler: [
    { pgCode: 5, vdCode: 6, price: 100, vdName: 'X', shipPrice: 0, params: { f: encodeURIComponent('https://kotu.example/') } },
    { price: 90, vdName: 'Y', params: { f: '%E0%A4%A' } },
    { price: -1, vdName: 'Z' },
  ] }));
  assert.equal(kotu.teklifler.length, 2);
  assert.equal(kotu.teklifler[0].magaza, 'Y');
  assert.equal(kotu.teklifler[0].link, null);
  assert.equal(kotu.teklifler[0].kargo, null);
  assert.equal(kotu.teklifler[1].link, 'https://www.akakce.com/r/?pr=1377791125&vd=6&pg=5'); // kimliklerden yeniden kurulur
});
