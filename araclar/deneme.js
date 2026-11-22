// Yerel deneme sunucusu: gerçek sitelere hiç gitmeden, örnek verilerle uygulamayı çalıştırır.
// Kullanım: node araclar/deneme.js   ->  http://127.0.0.1:3199/#kod=123456
// Arayüzü denemek ve ekran görüntüsü almak içindir; fiyatlar gerçek değildir.

import webpush from 'web-push';
import { uygulamaKur } from '../server.js';
import { getiriciOlustur } from '../src/getir.js';
import { depoAc } from '../src/depo.js';
import { ada, sahteAg, ROBOTS_AKAKCE, MARKET_YANITI } from '../test/yardimci.js';

const AK = 'https://www.akakce.com';
const MF = 'https://api.marketfiyati.org.tr';
const yol = (kategori, ad, kod) => `/${kategori}/en-ucuz-${ad}-fiyati,${kod}.html`;

const URUNLER = [
  { code: 1101115595, price: 49899, countOfPrices: 29, mkName: 'Apple', name: 'iPhone 13 128 GB', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13.jpg', url: yol('cep-telefonu', 'iphone-13', 1101115595) },
  { code: 1377791125, price: 49899, countOfPrices: 10, mkName: 'Apple', name: 'iPhone 13 128 GB Yıldız Işığı', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-128-gb-yildiz-isigi.jpg', url: yol('cep-telefonu', 'iphone-13-128-gb-yildiz-isigi', 1377791125) },
  { code: 1377791122, price: 49899, countOfPrices: 17, mkName: 'Apple', name: 'iPhone 13 128 GB Gece Yarısı', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-128-gb-gece-yarisi.jpg', url: yol('cep-telefonu', 'iphone-13-128-gb-gece-yarisi', 1377791122) },
  { code: 1101115604, price: 80509.03, countOfPrices: 4, mkName: 'Apple', name: 'iPhone 13 Pro 128 GB', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-pro.jpg', url: yol('cep-telefonu', 'iphone-13-pro', 1101115604) },
  { code: 1377791139, price: 49132.36, countOfPrices: 1, dropRatio: 12, mkName: 'Apple', name: 'iPhone 13 256 GB', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-256-gb.jpg', url: yol('cep-telefonu', 'iphone-13-256-gb', 1377791139) },
  { code: 1715101010, price: 65000, countOfPrices: 2, mkName: 'Apple', name: 'iPhone 13 128 GB Yeşil', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-128-gb-yesil.jpg', url: yol('cep-telefonu', 'iphone-13-128-gb-yesil', 1715101010) },
  { badge: 'İkinci el', code: 1377791189, countOfPrices: 0, minOfNonNewPrice: 27810.68, mkName: 'Apple', name: 'iPhone 13 256 GB Gece Yarısı', price: 0, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-256-gb-gece-yarisi.jpg', url: yol('cep-telefonu', 'iphone-13-256-gb-gece-yarisi', 1377791189) },
  { code: 1476138212, countOfPrices: 1, mkName: '-', name: 'Apple Uyumlu iPhone 13 Batarya 3510 mAh', price: 2039.15, imageUrl: 'https://cdn.akakce.com/x/batarya.jpg' },
  { code: 1584108550, countOfPrices: 2, mkName: 'Spigen', name: 'Spigen iPhone 13 Kılıf Ultra Hybrid Şeffaf', price: 1308.61, imageUrl: 'https://cdn.akakce.com/x/kilif.jpg', url: yol('telefon-kilifi', 'spigen-iphone-13-kilif-ultra-hybrid', 1584108550) },
  { code: 1584108551, countOfPrices: 6, mkName: 'Apple', name: 'Apple iPhone 13 Silikon Kılıf MagSafe', price: 1899, imageUrl: 'https://cdn.akakce.com/x/kilif2.jpg', url: yol('telefon-kilifi', 'apple-iphone-13-silikon-kilif-magsafe', 1584108551) },
  { code: 1615116589, countOfPrices: 3, dropRatio: 27, mkName: '-', name: 'Apple Orjinal Güç Adaptörü 20W iPhone 13 İçin Hızlı Şarj', price: 290, imageUrl: 'https://cdn.akakce.com/x/sarj.jpg', url: yol('sarj-aleti', 'apple-orjinal-guc-adaptoru-20w', 1615116589) },
  { code: 1377810245, price: 80509.03, countOfPrices: 2, mkName: 'Apple', name: 'iPhone 13 Pro 128 GB Grafit', imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-pro-grafit.jpg', url: yol('cep-telefonu', 'iphone-13-pro-128-gb-grafit', 1377810245) },
];

function aramaSayfasi(q, urunler = URUNLER) {
  const veri = {
    searchData: {
      metadata: { title: q, status: 200, robots: 'noindex' },
      productList: { countOfProducts: urunler.length, products: urunler },
      relatedCategories: [{ ctName: 'Cep Telefonu', ctNameUrlForm: 'cep-telefonu' }, { ctName: 'Telefon Kılıfı', ctNameUrlForm: 'telefon-kilifi' }, { ctName: 'Şarj Aleti', ctNameUrlForm: 'sarj-aleti' }],
    },
    pageParams: { phrase: q, page: 1, sort: 1 },
  };
  return `<!DOCTYPE html><html lang="tr"><head><title>${q}</title></head><body>${ada('SearchWrapper', 'search/SearchWrapper.js', veri)}<ul id="APL"></ul></astro-island></body></html>`;
}

const f = (pr, vd, pg) => encodeURIComponent(`/r/?pr=${pr}&vd=${vd}&pg=${pg}`);
function urunSayfasi(yolu, indirim = 0) {
  const kod = Number(/,(\d+)\.html$/.exec(yolu)[1]);
  const urun = URUNLER.find((u) => u.code === kod) || URUNLER[0];
  const taban = (urun.price || urun.minOfNonNewPrice || 1000) + 1192.54 - indirim;
  const t = (i, carpan, magaza, satici, ek = {}) => ({
    pgCode: 1777000000 + i, price: Math.round(taban * carpan * 100) / 100, pgName: urun.name, vdCode: 10000 + i, vdName: magaza, pgNick: satici, shipPrice: 0, badgePrice: 0,
    sloganText: '', lastUpdateTime: new Date().toISOString(), deliveryText: 'Yarın kargoda', stock: 10,
    params: { f: f(kod, 10000 + i, 1777000000 + i) }, ...ek,
  });
  const teklifler = urun.price ? [
    t(1, 1, 'idefix', 'Cheap Center', { stock: 2, badge: 'Kargo Dahil En Ucuz', sloganText: 'Alışılmadık Alışveriş' }),
    t(2, 1.0119, 'Pazarama', 'ALTINKOZA TEKNOLOJİM', { deliveryText: '2 iş günü', sloganText: 'Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan', campaigns: [{ type: 'Installment', text: 'Peşin fiyatına 9 taksit' }] }),
    t(3, 1.0147, 'Trendyol', 'Berke Grup', { sloganText: "Aradığın ne varsa Trendyol'da", stock: null }),
    t(4, 1.0005, 'Trendyol', 'BURAKTECH', { shipPrice: 144.99, sloganText: "Aradığın ne varsa Trendyol'da" }),
    t(5, 1.0511, 'Hepsiburada', 'BERKEGRUP', { sloganText: 'Sepette %5 indirim' }),
    t(6, 1.0765, 'Teknosa', null, { stock: 1 }),
    t(7, 1.1028, 'MediaMarkt', null, { sloganText: "Şahane Kasım'a Özel 2 Kat Club Puan" }),
  ] : [];
  const meta = { name: urun.name, code: kod, mkName: urun.mkName, prUrl: yolu, ctName: 'Cep Telefonu', ctNameUrlForm: yolu.split('/')[1], countOfPrCode: teklifler.length ? 23 : 0, lowestPrice1M: Math.round(taban * 0.93), lowestPriceDate1M: '2026-10-27T00:00:00', imgUrl: urun.imageUrl };
  const ld = { '@context': 'https://schema.org/', '@type': 'ProductGroup', name: urun.name, sku: String(kod), offers: { '@type': 'AggregateOffer', offerCount: '23', offers: [] },
    hasVariant: URUNLER.filter((u) => u.url && u.code !== kod && /128 GB /.test(u.name) && u.price).map((u) => ({ '@type': 'Product', name: u.name, color: u.name.replace(/^.*128 GB /, ''), url: AK + u.url })) };
  const ikinciEl = `<ul id="PLI_NN_83_1"><li><span data-params="{&quot;f&quot;:&quot;${f(kod, 10402, 1800940125)}&quot;}" class="iC xt_v8" title="Yenilenmiş ${urun.name} (1 Yıl Garantili) - B Kalite"><img src="https://cdn.akakce.com/x/y.jpg" alt="Yenilenmiş"><b class="hl pn_v8">Yenilenmiş</b><span class="w_v8"><img class="vdn_v9" src="https://cdn.akakce.com/im/m6/10402.svg" alt="Teknosa"><span class="pb_v8"><span class="pt_v8"> 26.999<i>,00 TL </i></span><em class="uk_v8">Ücretsiz kargo </em></span></span></span></li></ul>`;
  return `<!DOCTYPE html><html lang="tr"><head><title>${urun.name}</title></head><body><h1>${urun.name}</h1>${ada('SpotComponent', 'product/SpotComponent.js', { spotPg: teklifler[0] || null, metadata: meta })}</astro-island>${ada('PgViewContent', 'product/PgViewContent.js', { initialPgList: teklifler, metadata: meta, initialFilter: { info: { prCode: kod, totalPgCount: teklifler.length ? 23 : 0 } } })}</astro-island>${ikinciEl}<script type="application/ld+json">${JSON.stringify(ld)}</script></body></html>`;
}

let indirim = 0; // "fiyat düştü" denemesi için: /deneme/indirim adresi çağrılınca fiyatlar 2.500 TL iner
const ag = sahteAg({
  [`${AK}/robots.txt`]: ROBOTS_AKAKCE,
  [`${AK}/arama/?q=*`]: (adres) => {
    const q = decodeURIComponent(new URL(adres).searchParams.get('q') || '');
    if (/^(yok|asdf|süt)/i.test(q)) return aramaSayfasi(q, []);
    if (/hata/i.test(q)) return { durum: 403, metin: 'engel' };
    return aramaSayfasi(q);
  },
  [`${AK}/*`]: (adres) => urunSayfasi(new URL(adres).pathname, indirim),
  [`${MF}/api/v2/nearest`]: JSON.stringify([{ id: 'bim-U751' }, { id: 'migros-4453' }]),
  [`${MF}/api/v2/search`]: JSON.stringify(MARKET_YANITI),
});

const depo = depoAc(null);
const SAAT = 3600_000;
const simdi = Date.now();
// Dolu görünsün diye: geçmişi olan iki takip kaydı ve bir bildirim
depo.veri.takip.push({
  id: 'a1b2c3d4e5', kaynak: 'akakce', yol: URUNLER[0].url, ad: 'iPhone 13 128 GB', gorsel: URUNLER[0].imageUrl, eklendi: simdi - 9 * 24 * SAAT, hedefFiyat: 48000, hedefBildirildi: false, durakladi: false,
  fiyat: 51091.54, magaza: 'idefix', satici: 'Cheap Center', kargo: 0, link: `${AK}/r/?pr=1101115595&vd=10001&pg=1777000001`,
  ilkFiyat: 54250, enDusuk: 51091.54, enDusukTarih: simdi - 5 * SAAT, enYuksek: 54999, oncekiFiyat: 53703.02, degisimTarihi: simdi - 5 * SAAT, tepe: 51091.54,
  gecmis: [[simdi - 9 * 24 * SAAT, 54250], [simdi - 7 * 24 * SAAT, 54999], [simdi - 5 * 24 * SAAT, 53990], [simdi - 3 * 24 * SAAT, 53703.02], [simdi - 5 * SAAT, 51091.54]],
  sonKontrol: simdi - 12 * 60_000, sonrakiKontrol: simdi + 48 * 60_000, hata: null, hataAdedi: 0, sonBildirim: { zaman: simdi - 5 * SAAT, fiyat: 51091.54, tur: 'dusus' }, stokYok: false, enDusuk1Ay: 47500, enDusuk1AyTarih: '2026-10-27',
}, {
  id: 'f6e5d4c3b2', kaynak: 'akakce', yol: URUNLER[9].url, ad: 'Apple iPhone 13 Silikon Kılıf MagSafe', gorsel: URUNLER[9].imageUrl, eklendi: simdi - 3 * 24 * SAAT, hedefFiyat: null, hedefBildirildi: false, durakladi: false,
  fiyat: 3091.54, magaza: 'Hepsiburada', satici: null, kargo: 0, link: null, ilkFiyat: 2990, enDusuk: 2990, enDusukTarih: simdi - 3 * 24 * SAAT, enYuksek: 3091.54, oncekiFiyat: 2990, degisimTarihi: simdi - 20 * SAAT, tepe: 3091.54,
  gecmis: [[simdi - 3 * 24 * SAAT, 2990], [simdi - 20 * SAAT, 3091.54]], sonKontrol: simdi - 40 * 60_000, sonrakiKontrol: simdi + 20 * 60_000, hata: null, hataAdedi: 0, sonBildirim: null, stokYok: false,
});
depo.veri.bildirimler.push(
  { id: 'b1', zaman: simdi - 5 * SAAT, tur: 'dusus', baslik: 'İndirim: iPhone 13 128 GB', govde: '53.703,02 TL iken 51.091,54 TL oldu (%4,9 düştü). idefix, Cheap Center. Kargo ücretsiz. Takibe aldığından beri en düşük fiyat.', takipId: 'a1b2c3d4e5', okundu: false },
  { id: 'b2', zaman: simdi - 3 * 24 * SAAT, tur: 'stok', baslik: 'Yeniden satışta: Apple iPhone 13 Silikon Kılıf MagSafe', govde: '2.990 TL, Hepsiburada. Kargo ücretsiz.', takipId: 'f6e5d4c3b2', okundu: true },
);
depo.veri.aramalar.push('iphone 13', 'airfryer', 'süt 1 lt', 'dyson v15');

const getirici = getiriciOlustur({ fetchImpl: ag.fetchImpl, hostAyar: { 'www.akakce.com': { aralikMs: 250 }, 'api.marketfiyati.org.tr': { aralikMs: 50 } } });
const itici = { generateVAPIDKeys: () => webpush.generateVAPIDKeys(), sendNotification: async () => { const e = new Error('Deneme sunucusu bildirim göndermez'); e.statusCode = 503; throw e; } };
const u = uygulamaKur({
  ayar: { port: Number(process.env.PORT || 3199), dinle: '127.0.0.1', alan: '', girisKodu: '123456', veriDizini: null, ajan: '', apkParmakIzi: [], apkPaket: 'tr.fiyatavcisi.twa', surum: 'deneme' },
  depo, getirici, itici,
});
u.sunucu.on('request', (istek) => { if (istek.url === '/deneme/indirim') indirim = 2500; });
u.baslat().then((adres) => console.log(`Deneme sunucusu: http://127.0.0.1:${adres.port}/#kod=123456 (örnek veriler, gerçek fiyat değil)`));
