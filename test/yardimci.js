// Test yardımcıları: Akakçe sayfalarının gerçek yapısını (22.11.2026'da incelenen hâliyle) taklit eden örnekler.
// Veriler gerçek sayfalardan alınmış birkaç satırdır; sayfanın tamamı kopyalanmamıştır.

/** Düz nesneyi Astro'nun [tür, değer] biçimine çevirir (src/astro.js'in tersi). */
export function astroKodla(deger) {
  if (Array.isArray(deger)) return [1, deger.map(astroKodla)];
  if (deger && typeof deger === 'object') {
    const o = {};
    for (const k of Object.keys(deger)) o[k] = astroKodla(deger[k]);
    return [0, o];
  }
  return [0, deger];
}

const kacis = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ada(ad, dosya, veri) {
  const props = {};
  for (const k of Object.keys(veri)) props[k] = astroKodla(veri[k]);
  return `<astro-island uid="Z1vYCLj" prefix="r9" component-url="https://st.akakce.com/build/${dosya}" component-export="${ad}" renderer-url="https://st.akakce.com/build/search/client.CJ2mfJId.js" props="${kacis(JSON.stringify(props))}" ssr="" client="visible" opts="{&quot;name&quot;:&quot;${ad}&quot;,&quot;value&quot;:true}" await-children="">`;
}

export const ARAMA_URUNLERI = [
  { code: 1101115595, price: 49899, unit: 'adet', rating: 3, countOfPrices: 29, followCount: 8360, mkName: 'Apple', name: 'iPhone 13 128 GB', hasLogo: false, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13.jpg', url: '/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html', hasGraph: true, colorVariants: ['Siyah', 'Kırmızı'], hasSpotCampaign: false },
  { code: 1377791125, price: 49899, unit: 'adet', countOfPrices: 10, mkName: 'Apple', name: 'iPhone 13 128 GB Yıldız Işığı', hasLogo: false, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-128-gb-yildiz-isigi.jpg', url: '/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html', hasGraph: true },
  { code: 1101115604, price: 80509.03, unit: 'adet', countOfPrices: 4, mkName: 'Apple', name: 'iPhone 13 Pro 128 GB', hasLogo: false, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-pro.jpg', url: '/cep-telefonu/en-ucuz-iphone-13-pro-fiyati,1101115604.html', hasGraph: true },
  { code: 1377791139, price: 49132.36, unit: 'adet', countOfPrices: 1, dropRatio: 12, mkName: 'Apple', name: 'iPhone 13 256 GB', hasLogo: false, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-256-gb.jpg', url: '/cep-telefonu/en-ucuz-iphone-13-256-gb-fiyati,1377791139.html', hasGraph: true },
  { badge: 'İkinci el', code: 1377791189, countOfPrices: 0, hasGraph: false, hasLogo: false, imageUrl: 'https://cdn.akakce.com/x/apple/iphone-13-256-gb-gece-yarisi.jpg', minOfNonNewPrice: 27810.68, mkName: 'Apple', name: 'iPhone 13 256 GB Gece Yarısı', price: 0, unit: 'adet', url: '/cep-telefonu/en-ucuz-iphone-13-256-gb-gece-yarisi-fiyati,1377791189.html' },
  { code: 1476138212, countOfPrices: 1, hasGraph: false, hasLogo: false, imageUrl: 'https://iis-akakce.akamaized.net/p.x?https%3a%2f%2fn11scdn.akamaized.net%2fa1%2f1024%2fIMG-8416700472515177798.jpg', mkName: '-', name: 'Apple Uyumlu iPhone 13  Batarya Mucize Batarya Deji 3510mah', price: 2039.15, unit: 'adet' },
  { code: 1615116589, countOfPrices: 3, dropRatio: 27, hasGraph: true, hasLogo: false, hasSpotCampaign: false, imageUrl: 'https://iis-akakce.akamaized.net/p.x?https%3a%2f%2fproductimages.hepsiburada.net%2fs%2f777%2f600%2f110000937411175.jpg', mkName: '-', name: 'Apple Orjinal Güç Adaptörü 20W iPhone 13 İçin Hızlı Şarj Uyumlu Type-C', price: 290, unit: 'adet', url: '/sarj-aleti/en-ucuz-apple-orjinal-guc-adaptoru-20w-iphone-13-icin-hizli-sarj-uyumlu-type-c-fiyati,1615116589.html' },
];

const ARAMA_LISTE_HTML = `<ul id="APL" class="pl_v9 qv_v9"><li data-pr="1101115595" data-mk="Apple" data-cp="29" data-g="1" data-fc="5.000"><span class="pw_v8"><figure><img loading="lazy" src="https://cdn.akakce.com/x/apple/iphone-13.jpg" alt="iPhone 13 128 GB"></figure><span class="w_v8"><a href="/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html" title="iPhone 13 128 GB" class="iC"><h3 class="pn_v8">iPhone 13 128 GB</h3></a><span class="sc_v9" data-sc="12"></span><span class="db_v9 no-badge">En Ucuz</span><span class="pb_v8"><span class="pt_v9"> <!-- -->49.899<i>,<!-- -->00<!-- --> TL </i><span>+28 FİYAT </span></span></span><span class="prv_inline_v9"><span class="c_bx_v8 siyah" title="Siyah"></span><span>+3</span></span><span class="bt_v8"><b>Ürüne Git <!-- -->(+28)</b></span></span></span></li><li data-pr="1377791139" data-mk="Apple" data-cp="1" data-g="1" data-fc="1.000"><span class="pw_v8"><figure><img loading="lazy" src="https://cdn.akakce.com/x/apple/iphone-13-256-gb.jpg" alt="iPhone 13 256 GB"></figure><span class="w_v8"><a href="/cep-telefonu/en-ucuz-iphone-13-256-gb-fiyati,1377791139.html" title="iPhone 13 256 GB" class="iC"><h3 class="pn_v8">iPhone 13 256 GB</h3></a><span class="sc_v9" data-sc="8"></span><span class="db_v9">En Ucuz <i>%12</i></span><span class="pb_v8"><span class="pt_v9"> <!-- -->49.132<i>,<!-- -->36<!-- --> TL </i><span>TEK FİYAT </span></span></span><span class="bt_v8"><b>Ürüne Git </b></span></span></span></li><li data-pr="1377791189" data-mk="Apple" data-cp="0" data-fc="500"><span class="pw_v8"><figure><img loading="lazy" src="https://cdn.akakce.com/x/apple/iphone-13-256-gb-gece-yarisi.jpg" alt="iPhone 13 256 GB Gece Yarısı"></figure><span class="w_v8"><a href="/cep-telefonu/en-ucuz-iphone-13-256-gb-gece-yarisi-fiyati,1377791189.html" title="iPhone 13 256 GB Gece Yarısı" class="iC"><h3 class="pn_v8">iPhone 13 256 GB Gece Yarısı</h3></a><span class="db_v9 no-badge">En Ucuz</span><span class="qv_v9 qv_badge">İkinci el</span><span class="pb_v8"><span class="pt_v9"> <!-- -->27.810<i>,<!-- -->68<!-- --> TL </i><span></span></span></span><span class="bt_v8"><b>Ürüne Git </b></span></span></span></li><li data-pr="1476138212" data-mk="-" data-cp="1"><span class="pw_v8"><figure><img loading="lazy" src="https://iis-akakce.akamaized.net/p.x?https%3a%2f%2fn11scdn.akamaized.net%2fa1%2f1024%2fIMG-8416700472515177798.jpg" alt="Apple Uyumlu iPhone 13  Batarya Mucize Batarya Deji 3510mah"></figure><span class="w_v8"><h3 class="pn_v8">Apple Uyumlu iPhone 13  Batarya Mucize Batarya Deji 3510mah</h3><span class="db_v9 no-badge">En Ucuz</span><span class="pb_v8"><span class="pt_v9"> <!-- -->2.039<i>,<!-- -->15<!-- --> TL </i><span>TEK FİYAT </span></span></span></span></span></li></ul>`;

/** Arama sayfası. astro=false verilirse gömülü veri olmadan yalnızca HTML listesi döner. */
export function aramaSayfasi({ urunler = ARAMA_URUNLERI, astro = true, oneri = null } = {}) {
  const veri = {
    searchData: {
      metadata: { title: 'iPhone 13', status: 200, shareUrl: 'https://www.akakce.com/arama/?q=iphone+13', robots: 'noindex', hasLowQualityMatches: false, ...(oneri ? { correction: oneri } : {}) },
      productList: { countOfProducts: 500, userAction: { type: 0, enabledActions: ['fav', 'alert'] }, products: urunler },
      relatedCategories: [{ ctName: 'Cep Telefonu', ctNameUrlForm: 'cep-telefonu' }, { ctName: 'Şarj Aleti', ctNameUrlForm: 'sarj-aleti' }, { ctName: 'Telefon Kılıfı', ctNameUrlForm: 'telefon-kilifi' }],
    },
    pageParams: { phrase: 'iphone 13', page: 1, sort: 1, ctCode: null },
  };
  return `<!DOCTYPE html><html lang="tr"> <head><meta charset="utf-8"><title>iPhone 13 Fiyatları | En Ucuzu Akakçe</title><meta name="robots" content="noindex, max-image-preview:large"></head><body><h1>iPhone 13</h1>${astro ? ada('SearchWrapper', 'search/SearchWrapper.BNksb1I6.js', veri) : ''}<div class="rw_v8 search_v8">${ARAMA_LISTE_HTML}</div>${astro ? '</astro-island>' : ''}<p class="pager_v9"><span class="a">1</span><a title="Sayfa 2" href="/arama/?q=iphone 13&amp;p=2">2</a></p></body></html>`;
}

/**
 * Kategori sayfası: Akakçe "çamaşır makinesi 9 kg" gibi aramaları buraya yönlendirir.
 * Ürünler başka bir iskelette (initialData.components[].data[].products) ve CPL kimlikli listede durur.
 */
export function kategoriSayfasi({ astro = true } = {}) {
  const urunler = [
    { code: 1144641132, mkName: 'Bosch', name: 'Bosch WGA242X3TR 9 kg 1200 Devir Çamaşır Makinesi', price: 27676.8, imageUrl: 'https://cdn.akakce.com/x/bosch/bosch-wga242x3tr-9-kg-1200-devir.jpg', countOfPrices: 60, url: '/camasir-makinesi/en-ucuz-bosch-wga242x3tr-9-kg-1200-devir-fiyati,1144641132.html', hasGraph: true, followCount: 100, hasSpotCampaign: false, descriptiveText: '9 kg' },
    { code: 1148261927, mkName: 'Profilo', name: 'Profilo CGA242X3TR 1200 Devir 9 kg Çamaşır Makinesi', price: 24199.004, imageUrl: 'https://cdn.akakce.com/x/profilo/profilo-cga242x3tr.jpg', countOfPrices: 35, url: '/camasir-makinesi/en-ucuz-profilo-cga242x3tr-1200-devir-9-kg-fiyati,1148261927.html', hasGraph: true },
  ];
  const veri = {
    initialData: {
      components: [
        { type: 'quickFilters', data: [{ topFilters: [{ name: '9 kg', id: 34267 }] }] },
        { type: 'productList', data: [{ products: urunler }] },
        { type: 'filters', data: [{ filterGroups: [] }] },
      ],
      categoryCode: 5034, categoryName: 'Çamaşır Makinesi', countOfProducts: 214, urlForm: 'camasir-makinesi', pageType: 'c',
      metadata: { type: 'c', name: 'Çamaşır Makinesi', code: 5034, status: 200, ctNameUrlForm: 'camasir-makinesi', h1: '9 kg Çamaşır Makinesi' },
    },
  };
  const liste = `<ul id="CPL" class="pl_v9 qv_v9"><li data-pr="1144641132" data-mk="Bosch" data-cp="60" data-g="1" data-fc="100"><span class="pw_v8"><figure><img loading="lazy" src="https://cdn.akakce.com/x/bosch/bosch-wga242x3tr-9-kg-1200-devir.jpg" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';" alt="Bosch WGA242X3TR 9 kg 1200 Devir Çamaşır Makinesi"></figure><span class="w_v8"><a href="/camasir-makinesi/en-ucuz-bosch-wga242x3tr-9-kg-1200-devir-fiyati,1144641132.html" title="Bosch WGA242X3TR 9 kg 1200 Devir Çamaşır Makinesi" class="iC"><h3 class="pn_v8">Bosch WGA242X3TR 9 kg 1200 Devir Çamaşır Makinesi</h3></a> <span class="db_v9 no-badge">En Ucuz</span><span class="pb_v8"><span class="pt_v9"> 27.676<i>,80 TL </i><span>+59 FİYAT</span></span> <!-- --> </span> <!-- --> <span class="bt_v8"><b>Ürüne Git (+59)</b></span></span></span></li></ul><ul id="PL_22"><li data-pr="999" data-mk="Baska" data-cp="3"><h3 class="pn_v8">Başka listedeki ürün</h3><span class="pt_v9">1.000<i>,00 TL</i></span></li></ul>`;
  return `<!DOCTYPE html><html lang="tr"><head><title>9 kg Çamaşır Makinesi Fiyatları | En Ucuzu Akakçe</title></head><body><ol id="BC_v8"><li><a href="https://www.akakce.com/beyaz-esya.html">Beyaz Eşya</a></li><li><a href="https://www.akakce.com/camasir-makinesi.html">Çamaşır Makinesi</a></li></ol><h1>9 kg Çamaşır Makinesi</h1>${astro ? ada('default', 'category/CategoryPageView.BE5-N-UH.js', veri) : ''}${liste}${astro ? '</astro-island>' : ''}</body></html>`;
}

/** Sonuçsuz arama: gömülü veride ürün listesi hiç yoktur. */
export function bosAramaSayfasi() {
  const veri = { searchData: { metadata: { title: 'asdqwe', robots: 'noindex' } }, pageParams: { phrase: 'asdqwe', page: 1, sort: 1 } };
  return `<!DOCTYPE html><html lang="tr"><head><title>asdqwe Fiyatları | En Ucuzu Akakçe</title></head><body><h1>asdqwe</h1>${ada('SearchWrapper', 'search/SearchWrapper.BNksb1I6.js', veri)}</astro-island></body></html>`;
}

const f = (pr, vd, pg) => encodeURIComponent(`/r/?pr=${pr}&vd=${vd}&pg=${pg}`).replace(/%[0-9A-F]{2}/g, (x) => x.toLowerCase());

export const TEKLIFLER = [
  { pgCode: 1777266314, price: 51091.54, pgName: 'Apple iPhone 13 128 Gb Beyaz (Apple Türkiye Garantili)', vdCode: 13275, vdName: 'idefix', hasLogo: true, imageUrl: 'https://iis-akakce.akamaized.net/p.x?x', shipPrice: 0, url: '#/111/?s=1', badgePrice: 0, pgNick: 'Cheap Center', sloganText: 'Alışılmadık Alışveriş', stock: 2, badgeId: 1, badge: 'Kargo Dahil En Ucuz', lastUpdateTime: '2026-11-22T21:50:00+03:00', deliveryText: 'Yarın kargoda', lastUpdateText: '4 dakika önce', staleAfterHours: 24, params: { s: 1, v: 13275, p: 1377791125, c: 23112, g: 1777266314, f: f(1377791125, 13275, 1777266314) } },
  { pgCode: 1827785910, price: 51699.06, pgName: 'iPhone 13 128 GB Beyaz', vdCode: 10694, vdName: 'Pazarama', hasLogo: true, shipPrice: 0, badgePrice: 0, pgNick: 'ALTINKOZA TEKNOLOJİM', sloganText: 'Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan', stock: 10, lastUpdateTime: '2026-11-22T21:50:00+03:00', deliveryText: '2 iş günü', campaigns: [{ cardId: 5, type: 'Installment', text: 'Peşin fiyatına 9 taksit' }], params: { s: 2, v: 10694, p: 1377791125, c: 21533, g: 1827785910, f: f(1377791125, 10694, 1827785910) } },
  { pgCode: 1900000001, price: 51845.11, pgName: 'Apple iPhone 13 128 GB Yıldız Işığı Cep Telefonu', vdCode: 11707, vdName: 'Trendyol', hasLogo: true, shipPrice: 0, badgePrice: 0, pgNick: 'Berke Grup', sloganText: "Aradığın ne varsa Trendyol'da", lastUpdateTime: '2026-11-22T21:50:00+03:00', deliveryText: 'Yarın kargoda', params: { s: 3, v: 11707, p: 1377791125, c: 1, g: 1900000001, f: f(1377791125, 11707, 1900000001) } },
  { pgCode: 1900000002, price: 51000, pgName: 'iPhone 13 128 GB', vdCode: 11707, vdName: 'Trendyol', hasLogo: true, shipPrice: 144.99, badgePrice: 0, pgNick: 'Trendyol', sloganText: "Aradığın ne varsa Trendyol'da", lastUpdateTime: '2026-11-22T21:50:00+03:00', deliveryText: 'Yarın kargoda', vdRating: 4.5, params: { s: 4, v: 11707, p: 1377791125, c: 1, g: 1900000002, f: f(1377791125, 11707, 1900000002) } },
];

export const URUN_META = {
  filtersEnabled: true, mkName: 'Apple', name: 'iPhone 13 128 GB Yıldız Işığı', code: 1377791125, h1: 'iPhone 13 128 GB Yıldız Işığı',
  prUrl: '/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html', ctName: 'Cep Telefonu', ctNameUrlForm: 'cep-telefonu', ctCode: 4003,
  countOfPrCode: 10, minOfSortPrice: 49899, minOfNonNewPrice: 26999, maxOfSortPrice: 57999, lowestPrice1M: 40000, lowestPriceDate1M: '2026-10-27T00:00:00',
  imgUrl: 'https://cdn.akakce.com/z/apple/iphone-13-128-gb-yildiz-isigi.jpg',
};

const LD = {
  '@context': 'https://schema.org/', '@type': 'ProductGroup', productGroupID: '1377791125', name: 'iPhone 13 128 GB Yıldız Işığı', sku: '1377791125',
  category: 'Elektronik > Telefon Ürünleri ve Aksesuarları > Cep Telefonu > iPhone', brand: { '@type': 'Brand', name: 'Apple' },
  image: [{ '@type': 'ImageObject', contentUrl: 'https://cdn.akakce.com/z/apple/iphone-13-128-gb-yildiz-isigi.jpg' }],
  offers: {
    '@type': 'AggregateOffer', availability: 'https://schema.org/InStock', offerCount: '10', lowPrice: '49899.00', highPrice: '57999.00', priceCurrency: 'TRY',
    offers: [
      { '@type': 'Offer', availability: 'https://schema.org/InStock', price: '51091.54', url: 'https://www.idefix.com/apple-iphone-13-128-gb-beyaz-apple-turkiye-garantili-p-374820?vendorId=14212', seller: { '@type': 'Organization', name: 'idefix/Cheap Center' }, itemCondition: 'https://schema.org/NewCondition', priceCurrency: 'TRY' },
      { '@type': 'Offer', availability: 'https://schema.org/InStock', price: '51699.06', url: 'https://www.pazarama.com/iphone-13-128-gb-beyaz-p-651651651651651651', seller: { '@type': 'Organization', name: 'Pazarama/ALTINKOZA TEKNOLOJİM' }, itemCondition: 'https://schema.org/NewCondition', priceCurrency: 'TRY' },
      { '@type': 'Offer', availability: 'https://schema.org/InStock', price: '51845.11', url: 'https://www.trendyol.com/apple/iphone-13-128-gb-yildiz-isigi-cep-telefonu-p-150059024', seller: { '@type': 'Organization', name: 'Trendyol/Berke Grup' }, itemCondition: 'https://schema.org/NewCondition', priceCurrency: 'TRY' },
    ],
  },
  hasVariant: [
    { '@type': 'Product', name: 'iPhone 13 128 GB Gece Yarısı', sku: '1377791122', color: 'Gece Yarısı', url: 'https://www.akakce.com/cep-telefonu/en-ucuz-iphone-13-128-gb-gece-yarisi-fiyati,1377791122.html' },
    { '@type': 'Product', name: 'iPhone 13 128 GB Yıldız Işığı', sku: '1377791125', color: 'Yıldız Işığı', url: 'https://www.akakce.com/cep-telefonu/en-ucuz-iphone-13-128-gb-yildiz-isigi-fiyati,1377791125.html' },
  ],
};

const TEKLIF_HTML = `<ul id="PL" class="pl_v9 pg_v9"><li class="c"><span><span class="pb_v8"><span class="bdgv_v8"><i>Kargo Dahil En Ucuz</i> </span><span class="pt_v8 ">51.091<i>,54 TL</i></span> <em class="uk_v8">Ücretsiz kargo</em> </span><span class="bt_v8"><b>Satıcıya Git</b> </span><span class="w_v8"><span class="pn_v8">Apple iPhone 13 128 Gb Beyaz (Apple Türkiye Garantili)</span> <span class="vds_v8">Alışılmadık Alışveriş</span> </span><span class="w_v8"><span class="stock_v8">Stokta  2 adet</span> <span class="sd_v8" title="Gönderi Süresi">Yarın kargoda</span> <span class="bd_v8" style="opacity:0;">Son güncelleme: <i>4 dakika önce</i> </span></span><span class="w_v8"><span class="v_v8"><img alt="idefix" src="https://cdn.akakce.com/im/m6/13275.svg?27102026" style="background: none; opacity: 1;" loading="lazy">/Cheap Center</span> </span></span></li><li><span><span class="pb_v8"><span class="pt_v8 ">51.699<i>,06 TL</i></span> <em class="uk_v8">Ücretsiz kargo</em> </span><span class="bt_v8"><b>Satıcıya Git</b> </span><span class="w_v8"><span class="pn_v8">iPhone 13 128 GB Beyaz</span> <span class="vds_v8">Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan</span> </span><span class="w_v8"><span class="stock_v8">Stokta  10 adet</span> <span class="sd_v8" title="Gönderi Süresi">2 iş günü</span> </span><span class="w_v8"><span class="v_v8"><img alt="Pazarama" src="https://cdn.akakce.com/im/m6/10694.svg?27102026" loading="lazy">/ALTINKOZA TEKNOLOJİM</span> </span></span></li></ul>`;

const IKINCI_EL_HTML = `<section class="pl_v9 hpl_v9 rw_v8 wnl_v8 bn_hpl"><h2 class="non_new_title" id="non_new_title"> Yenilenmiş ve İkinci El iPhone 13 128 GB Yıldız Işığı Fiyatları </h2><ul id="PLI_NN_83_1633"><li><span data-params="{&quot;z&quot;:143,&quot;s&quot;:1,&quot;v&quot;:10402,&quot;p&quot;:1377791125,&quot;c&quot;:21681,&quot;g&quot;:1800940125,&quot;f&quot;:&quot;%2fr%2f%3fpr%3d1377791125%26vd%3d10402%26pg%3d1800940125&quot;}" onclick="window.RC(115, 'w1001')" class="iC xt_v8" title="Yenilenmiş iPhone 13 128 GB Yıldız Işığı Cep Telefonu (1 Yıl Garantili) - B Kalite"><img loading="lazy" src="https://iis-akakce.akamaized.net/p.x?https%3a%2f%2freimg-teknosa-cloud-prod.mncdn.com%2fa.jpg" alt="Yenilenmiş iPhone 13 128 GB Yıldız Işığı Cep Telefonu (1 Yıl Garantili) - B Kalite"><b class="hl pn_v8"> Yenilenmiş iPhone 13 128 GB Yıldız Işığı Cep Telefonu (1 Yıl Garantili) - B Kalite </b><span class="w_v8"><img loading="lazy" class="vdn_v9" src="https://cdn.akakce.com/im/m6/10402.svg?27102026" alt="Teknosa"><span class="pb_v8"><span class="pt_v8"> 26.999<i>,00 TL </i></span><em class="uk_v8">Ücretsiz kargo </em></span></span></span></li></ul></section>`;

/** Ürün sayfası. Parçalar tek tek kapatılabilir (yedek okuma yollarını denemek için). */
export function urunSayfasi({ astro = true, ld = true, html = true, teklifler = TEKLIFLER, meta = URUN_META } = {}) {
  const spot = astro ? `${ada('SpotComponent', 'product/SpotComponent.C-4LFk6Y.js', { spotPg: { ...teklifler[0], campaigns: null }, spotAlternativePg: null, showNonNewBox: true, metadata: meta })}<div class="bb_w"><span class="pb_v8"><span class="pt_v8 ">51.091<i>,54 TL</i></span></span></div></astro-island>` : '';
  const liste = astro ? `${ada('PgViewContent', 'product/PgViewContent.Dv_IxWg-.js', { initialPgList: teklifler, metadata: meta, on_appakce: false, initialFilter: { filters: [{ count: 0, id: 'hasVdc', label: 'Kredi Kartı Kampanyalı' }], info: { prCode: meta.code, totalPgCount: 10 } } })}${html ? TEKLIF_HTML : ''}</astro-island>` : (html ? TEKLIF_HTML : '');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>iPhone 13 128 GB Yıldız Işığı Fiyatları, Özellikleri ve Yorumları | En Ucuzu Akakçe</title></head><body><h1>iPhone 13 128 GB Yıldız Işığı</h1>${spot}${liste}${IKINCI_EL_HTML}${ld ? `<script type="application/ld+json">${JSON.stringify(LD)}</script>` : ''}</body></html>`;
}

export const ROBOTS_AKAKCE = `User-agent:*
User-agent: AdsBot-Google
User-agent: Googlebot

Allow: /

Disallow: /m/
Disallow: /c/
Disallow: /r/
Disallow: /*nmr=*
Disallow: /*&r=*
Disallow: /*?d=*
Disallow: /*ref=*
Disallow: /akakcem/*
Disallow:*?g=*
Disallow:*.html/*,*
Disallow: /*?s=*
Disallow: /*&s=*
Disallow: /*?c=*
Disallow: /*&c=*
Disallow: /*?f=*
Disallow: /*&f=*
Disallow: /*tl$
Disallow: /*?p1=*
Disallow: /*&p1=*
Disallow: /magaza/*,*.html

User-agent: PerplexityBot
Disallow: /
`;

export const MARKET_YANITI = {
  numberOfFound: 654, searchResultType: 1,
  content: [
    { id: '1T9S', title: 'İçim Süt 1 Lt', brand: 'İçim', imageUrl: 'https://cdn.marketfiyati.org.tr/migros/11013025.jpg', refinedVolumeOrWeight: '1 LT', categories: ['Uzun Ömürlü Süt', 'Gıda'], main_category: 'Süt', menu_category: 'Süt Ürünleri ve Kahvaltılık', productDepotInfoList: [
      { depotId: 'migros-4453', depotName: 'Mjet Cağaloğlu Istanbul', price: 70.5, unitPrice: '70,50 ₺/Lt', unitPriceValue: 70.5, marketAdi: 'migros', percentage: 0, longitude: 28.9752, latitude: 41.01202, indexTime: '22.11.2026 07:52', discount: false, discountRatio: null, promotionText: null },
      { depotId: 'carrefour-5027', depotName: 'Istanbul Karaköy Mını', price: 70.95, unitPrice: '70,95 ₺/Lt', unitPriceValue: 70.95, marketAdi: 'carrefour', percentage: 0.6382935, longitude: 28.977488, latitude: 41.02409, indexTime: '22.11.2026 07:52', discount: false, discountRatio: null, promotionText: null },
      { depotId: 'migros-9999', depotName: 'Migros Sirkeci', price: 72.5, unitPrice: '72,50 ₺/Lt', marketAdi: 'migros', indexTime: '22.11.2026 07:52', discount: false },
    ] },
    { id: '2ABC', title: 'Sek Tam Yağlı Pastörize Süt 1 Lt', brand: 'Sek', imageUrl: 'https://cdn.marketfiyati.org.tr/bim/1.jpg', refinedVolumeOrWeight: '1 LT', categories: ['Süt'], main_category: 'Süt', productDepotInfoList: [
      { depotId: 'bim-U751', depotName: 'Çemberlitaş', price: 44.5, unitPrice: '44,50 ₺/Lt', marketAdi: 'bim', indexTime: '22.11.2026 07:52', discount: true, discountRatio: 10, promotionText: 'Haftanın fırsatı' },
    ] },
    { id: '3XYZ', title: 'Çamaşır Suyu 1 Lt', brand: 'Marka', imageUrl: null, refinedVolumeOrWeight: '1 LT', categories: [], productDepotInfoList: [{ depotId: 'a101-1', depotName: 'Eminönü', price: 30, marketAdi: 'a101' }] },
  ],
  facetMap: {},
};

/**
 * Sahte ağ: adres -> yanıt eşlemesiyle çalışan fetch. Yapılan istekleri `cagrilar` içinde tutar.
 * rota değeri: metin | { durum, metin } | (adres, secenek) => bunlardan biri
 */
export function sahteAg(rotalar) {
  const cagrilar = [];
  const fetchImpl = async (adres, secenek = {}) => {
    cagrilar.push({ adres: String(adres), yontem: secenek.method || 'GET', govde: secenek.body || null, basliklar: secenek.headers || {} });
    let r = rotalar[String(adres)];
    if (r === undefined) {
      const anahtar = Object.keys(rotalar).find((k) => k.endsWith('*') && String(adres).startsWith(k.slice(0, -1)));
      r = anahtar ? rotalar[anahtar] : undefined;
    }
    if (typeof r === 'function') r = await r(String(adres), secenek);
    if (r === undefined) r = { durum: 404, metin: 'yok' };
    if (r instanceof Error) throw r;
    const durum = typeof r === 'string' ? 200 : (r.durum ?? 200);
    const metin = typeof r === 'string' ? r : (r.metin ?? '');
    return { status: durum, url: (typeof r === 'object' && r.adres) || String(adres), text: async () => metin };
  };
  return { fetchImpl, cagrilar };
}

/** Elle ilerletilen saat: bekle() gerçek zaman harcamaz, saati ileri alır. */
export function sahteSaat(baslangic = Date.UTC(2026, 10, 22, 12, 0, 0)) {
  let t = baslangic;
  return { simdi: () => t, bekle: async (ms) => { t += ms; }, ilerlet: (ms) => { t += ms; } };
}
