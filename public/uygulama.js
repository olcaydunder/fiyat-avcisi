// Fiyat Avcısı — telefon arayüzü. Çerçeve kullanmaz; bütün içerik DOM ile kurulur (HTML birleştirme yok).

const D = document;
const kok = D.getElementById('uygulama');

// ---------------------------------------------------------------- küçük yardımcılar
function h(etiket, oz, ...cocuklar) {
  const e = D.createElement(etiket);
  for (const [k, v] of Object.entries(oz || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  ekle(e, cocuklar);
  return e;
}
function ekle(e, cocuklar) {
  for (const c of cocuklar.flat(3)) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : D.createTextNode(String(c)));
  }
}
const NS = 'http://www.w3.org/2000/svg';
function svg(etiket, oz, ...cocuklar) {
  const e = D.createElementNS(NS, etiket);
  for (const [k, v] of Object.entries(oz || {})) e.setAttribute(k, v);
  for (const c of cocuklar) e.append(c);
  return e;
}
const SIMGE = {
  ara: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  takip: ['M6 4h12v16l-6-4-6 4z'],
  zil: ['M6 16V11a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  ayar: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M16 5v4', 'M10 15v4'],
  geri: ['M15 5l-7 7 7 7'],
};
function simge(ad) {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ...SIMGE[ad].map((d) => svg('path', { d })));
}

const TL = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TAM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const tl = (n) => `${TL.format(n)} TL`;
const tlKisa = (n) => `${Number.isInteger(n) ? TAM.format(n) : TL.format(n)} TL`;
const yuzde = (n) => `%${Math.abs(n).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;

/** Raf etiketi gibi fiyat: tam kısım büyük, kuruş küçük ve yukarıda. */
function etiket(tutar, { sari = false, boyut = '', ustuCizili = false } = {}) {
  const [tam, kurus] = TL.format(tutar).split(',');
  return h('span', { class: `etiket ${boyut} ${sari ? 'sari' : ''} ${ustuCizili ? 'ustu-cizili' : ''}`.replace(/\s+/g, ' ').trim() },
    h('span', { class: 'gizli-yazi' }, sari ? `En ucuz: ${tl(tutar)}` : tl(tutar)),
    h('span', { class: 'tam', 'aria-hidden': 'true' }, tam),
    h('span', { class: 'kurus', 'aria-hidden': 'true' }, `,${kurus}`),
    h('span', { class: 'tl', 'aria-hidden': 'true' }, 'TL'));
}

function gorsel(adres, ad) {
  const kutu = h('span', { class: 'gorsel' });
  if (!adres) { kutu.classList.add('yok'); return kutu; }
  const img = h('img', { src: adres, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => { img.remove(); kutu.classList.add('yok'); });
  kutu.append(img);
  return kutu;
}

function zamanOnce(ms) {
  if (!ms) return '';
  const dk = Math.round((Date.now() - ms) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} saat önce`;
  const gun = Math.round(sa / 24);
  return gun === 1 ? 'dün' : `${gun} gün önce`;
}
const tarih = (ms) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const tarihSaat = (ms) => new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

let iletiZamani = null;
function ileti(metin) {
  D.querySelectorAll('.ileti').forEach((e) => e.remove());
  const e = h('div', { class: 'ileti', role: 'status' }, metin);
  D.body.append(e);
  clearTimeout(iletiZamani);
  iletiZamani = setTimeout(() => e.remove(), 4200);
}

// ---------------------------------------------------------------- durum
const sakla = {
  al: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  yaz: (k, v) => { try { localStorage.setItem(k, v); } catch { /* özel sekmede saklanamayabilir */ } },
  sil: (k) => { try { localStorage.removeItem(k); } catch { /* yok say */ } },
};

const durum = {
  kod: sakla.al('fa_kod') || '',
  gorunum: 'ara',
  baslangic: null,
  arama: { q: '', yukleniyor: false, sonuc: null, hata: null, kategori: null, ikinciEl: false, sira: 'ucuz', ayrinti: new Map(), sayi: 0, dahaYukleniyor: false },
  takip: { liste: null, hata: null },
  bildirimler: null,
  okunmamis: 0,
  push: { destek: false, izin: 'default', abone: null, mesgul: false },
  tani: null,
};

class ApiHatasi extends Error {
  constructor(tur, mesaj) { super(mesaj); this.tur = tur; }
}

async function api(yol, { yontem = 'GET', govde } = {}) {
  let yanit;
  try {
    yanit = await fetch(yol, {
      method: yontem,
      headers: { 'X-Kod': durum.kod, ...(govde ? { 'Content-Type': 'application/json' } : {}) },
      body: govde ? JSON.stringify(govde) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiHatasi('ag', 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
  }
  let j = null;
  try { j = await yanit.json(); } catch { /* gövde yok */ }
  if (yanit.status === 401 && yol !== '/api/giris') {
    cikis(false);
    throw new ApiHatasi('giris', 'Giriş kodu gerekli');
  }
  if (!yanit.ok) throw new ApiHatasi((j && j.hata && j.hata.tur) || 'sunucu', (j && j.hata && j.hata.ileti) || 'Sunucu beklenmeyen bir yanıt verdi');
  return j;
}

// ---------------------------------------------------------------- giriş
function manifestiAyarla() {
  const m = D.getElementById('manifest');
  if (m && durum.kod) m.setAttribute('href', `/manifest.webmanifest?k=${encodeURIComponent(durum.kod)}`);
}

function cikis(bilerek) {
  durum.kod = '';
  sakla.sil('fa_kod');
  girisCiz(bilerek ? '' : 'Giriş kodu geçersiz. Yeniden yaz.');
}

async function girisDene(kod) {
  await api('/api/giris', { yontem: 'POST', govde: { kod } });
  durum.kod = kod;
  sakla.yaz('fa_kod', kod);
  manifestiAyarla();
}

function girisCiz(hataMetni = '') {
  const hata = h('p', { class: 'hata', role: 'alert' }, hataMetni);
  const alan = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '32', 'aria-label': 'Giriş kodu', required: true });
  const dugme = h('button', { type: 'submit' }, 'Giriş yap');
  const form = h('form', {
    onsubmit: async (o) => {
      o.preventDefault();
      const kod = alan.value.trim();
      if (!kod) return;
      dugme.disabled = true;
      hata.textContent = '';
      try { await girisDene(kod); await basla(); }
      catch (e) { hata.textContent = e.tur === 'giris' ? 'Giriş kodu yanlış.' : e.message; dugme.disabled = false; alan.select(); }
    },
  }, alan, dugme, hata);
  kok.replaceChildren(h('div', { class: 'giris' },
    h('h1', null, 'Fiyat Avcısı'),
    h('p', null, 'Kurulumda verilen giriş kodunu yaz. Bu telefonda bir kez sorulur.'),
    form));
  alan.focus();
}

// ---------------------------------------------------------------- iskelet
let icerik; let ustForm; let altNav; let sayfaEl; let sayfaGovde; let sayfaBaslik;

function kabukCiz() {
  const alan = h('input', { type: 'search', name: 'q', placeholder: 'Ürün adı, örneğin iphone 13', enterkeyhint: 'search', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Ürün adı', maxlength: '120' });
  ustForm = h('form', {
    class: 'ara-formu', role: 'search',
    onsubmit: (o) => { o.preventDefault(); alan.blur(); araBaslat(alan.value); },
  }, alan, h('button', { type: 'submit' }, 'Ara'));
  ustForm.alan = alan;

  const sekme = (ad, yazi, simgeAdi) => h('button', { type: 'button', 'data-gorunum': ad, onclick: () => git(ad) }, simge(simgeAdi), h('span', null, yazi));
  altNav = h('nav', { class: 'alt', 'aria-label': 'Bölümler' }, sekme('ara', 'Ara', 'ara'), sekme('takip', 'Takip', 'takip'), sekme('bildirimler', 'Bildirimler', 'zil'), sekme('ayarlar', 'Ayarlar', 'ayar'));

  icerik = h('main', { id: 'icerik' });
  sayfaBaslik = h('span', { class: 'baslik' });
  sayfaGovde = h('div', { class: 'sayfa-govde' });
  sayfaEl = h('section', { class: 'sayfa', 'aria-hidden': 'true' },
    h('div', { class: 'sayfa-ust' }, h('button', { type: 'button', onclick: () => history.back() }, simge('geri'), 'Geri'), sayfaBaslik),
    sayfaGovde);

  kok.replaceChildren(
    h('header', { class: 'ust' }, h('div', { class: 'marka' }, h('span', null, 'Fiyat Avcısı'), h('small', { id: 'ust-not' })), ustForm),
    icerik, altNav, sayfaEl);
}

function git(gorunum, gecmiseYaz = true) {
  durum.gorunum = gorunum;
  if (gecmiseYaz && location.hash !== `#${gorunum}`) history.replaceState(null, '', `#${gorunum}`);
  ciz();
  window.scrollTo(0, 0);
  if (gorunum === 'takip') takipYukle();
  if (gorunum === 'bildirimler') bildirimlerYukle();
}

function ciz() {
  for (const b of altNav.children) {
    if (b.dataset.gorunum === durum.gorunum) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    b.querySelectorAll('.sayi').forEach((e) => e.remove());
    if (b.dataset.gorunum === 'bildirimler' && durum.okunmamis > 0) b.append(h('span', { class: 'sayi', 'aria-label': `${durum.okunmamis} yeni bildirim` }, String(Math.min(durum.okunmamis, 99))));
  }
  ustForm.hidden = durum.gorunum !== 'ara';
  D.getElementById('ust-not').textContent = { ara: '', takip: 'Takip listesi', bildirimler: 'Bildirimler', ayarlar: 'Ayarlar' }[durum.gorunum];
  const cizici = { ara: araCiz, takip: takipCiz, bildirimler: bildirimlerCiz, ayarlar: ayarlarCiz }[durum.gorunum];
  icerik.replaceChildren(...[cizici()].flat().filter(Boolean));
}

// ---------------------------------------------------------------- ayrıntı sayfası (alttan açılan)
let sayfaAcik = false;
function sayfaAc(baslik, govde) {
  sayfaBaslik.textContent = baslik || '';
  sayfaGovde.replaceChildren(...[govde].flat().filter(Boolean));
  sayfaGovde.scrollTop = 0;
  if (!sayfaAcik) {
    sayfaAcik = true;
    history.pushState({ sayfa: true }, '');
    sayfaEl.classList.add('acik');
    sayfaEl.setAttribute('aria-hidden', 'false');
    D.body.style.overflow = 'hidden';
  }
}
function sayfaKapat() {
  if (!sayfaAcik) return;
  sayfaAcik = false;
  sayfaEl.classList.remove('acik');
  sayfaEl.setAttribute('aria-hidden', 'true');
  D.body.style.overflow = '';
  if (durum.gorunum === 'ara') araListesiniYenile();
}
window.addEventListener('popstate', () => { if (sayfaAcik) sayfaKapat(); });

// ---------------------------------------------------------------- arama
const DIGER_SITELER = [
  ['Trendyol', (q) => `https://www.trendyol.com/sr?q=${q}`],
  ['Hepsiburada', (q) => `https://www.hepsiburada.com/ara?q=${q}`],
  ['Amazon', (q) => `https://www.amazon.com.tr/s?k=${q}`],
  ['n11', (q) => `https://www.n11.com/arama?q=${q}`],
  ['Cimri', (q) => `https://www.cimri.com/arama?q=${q}`],
  ['Google Alışveriş', (q) => `https://www.google.com/search?tbm=shop&q=${q}`],
];

async function araBaslat(metin) {
  const q = String(metin || '').replace(/\s+/g, ' ').trim();
  if (q.length < 2) { ileti('Aramak için en az 2 harf yaz.'); return; }
  const a = durum.arama;
  a.q = q; a.yukleniyor = true; a.sonuc = null; a.hata = null; a.kategori = null; a.ayrinti = new Map(); a.dogrulamaBitti = false;
  const sayi = ++a.sayi;
  ustForm.alan.value = q;
  if (durum.gorunum !== 'ara') git('ara'); else ciz();
  try {
    const s = await api(`/api/ara?q=${encodeURIComponent(q)}`);
    if (sayi !== a.sayi) return;
    a.sonuc = s;
    a.kategori = s.onerilenKategori;
    if (durum.baslangic) durum.baslangic.aramalar = [q, ...durum.baslangic.aramalar.filter((x) => x.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'))].slice(0, 12);
  } catch (e) {
    if (sayi !== a.sayi) return;
    a.hata = e;
  }
  a.yukleniyor = false;
  if (durum.gorunum === 'ara') ciz();
  ilkSaticilariGetir(sayi);
}

function gorunenUrunler() {
  const a = durum.arama;
  if (!a.sonuc) return [];
  let liste = a.sonuc.urunler.filter((u) => (a.ikinciEl ? true : u.fiyat !== null));
  if (a.kategori) liste = liste.filter((u) => (u.kategori || 'diger') === a.kategori);
  const fiyat = (u) => {
    const d = u.yol ? a.ayrinti.get(u.yol) : null;
    if (d && d.veri && d.veri.enUcuz && u.fiyat !== null) return d.veri.enUcuz.toplam;
    return u.fiyat !== null ? u.fiyat : u.ikinciElFiyat;
  };
  liste = liste.map((u) => ({ ...u, goster: fiyat(u), ikinci: u.fiyat === null }));
  if (a.sira === 'ucuz') {
    // Önce sorguya tam uyanlar, kendi içinde ucuzdan pahalıya; yeni ürünler ikinci elden önce
    liste.sort((x, y) => (y.uyum >= 0.999) - (x.uyum >= 0.999) || x.ikinci - y.ikinci || x.goster - y.goster);
  } else {
    liste.sort((x, y) => x.sira - y.sira);
  }
  return liste;
}

/**
 * Listenin başındaki ürünlerin gerçek tekliflerini sorar. Arama sayfasındaki fiyat eski kalmış olabildiği için
 * en üstteki üç satır doğrulanana kadar sürer (en çok altı istek); satırlar geldikçe yeniden sıralanır.
 */
async function ilkSaticilariGetir(sayi) {
  const a = durum.arama;
  a.dogrulamaBitti = false;
  let butce = 6;
  while (butce > 0 && sayi === a.sayi) {
    const aday = gorunenUrunler().slice(0, 3).find((u) => u.yol && !u.ikinci && !a.ayrinti.has(u.yol));
    if (!aday) break;
    butce--;
    a.ayrinti.set(aday.yol, { yukleniyor: true });
    if (durum.gorunum === 'ara' && !sayfaAcik) araListesiniYenile();
    let dur = false;
    try {
      const veri = await api(`/api/urun?yol=${encodeURIComponent(aday.yol)}`);
      if (sayi !== a.sayi) return;
      a.ayrinti.set(aday.yol, { veri });
    } catch (e) {
      if (sayi !== a.sayi) return;
      a.ayrinti.set(aday.yol, { hata: e });
      dur = e.tur === 'engel' || e.tur === 'sinir' || e.tur === 'giris';
    }
    if (durum.gorunum === 'ara' && !sayfaAcik) araListesiniYenile();
    if (dur) break;
  }
  if (sayi !== a.sayi) return;
  a.dogrulamaBitti = true;
  if (durum.gorunum === 'ara' && !sayfaAcik) araListesiniYenile();
}

function saticiYazisi(t) { return [t.magaza, t.satici].filter(Boolean).join(', '); }
function kargoYazisi(t) {
  if (t.kargo === 0) return 'Kargo ücretsiz';
  if (t.kargo > 0) return `${tl(t.kargo)} kargo dahil`;
  return 'Kargo ücreti mağazada yazıyor';
}

function urunSatiri(u, enUcuzMu) {
  const a = durum.arama;
  const d = u.yol ? a.ayrinti.get(u.yol) : null;
  const isaretler = [];
  if (u.ikinci) isaretler.push(h('span', { class: 'isaret' }, 'İkinci el'));
  if (u.dusus && !u.ikinci) isaretler.push(h('span', { class: 'isaret indirim' }, `${yuzde(u.dusus)} düştü`));
  if (u.uyum < 0.999) isaretler.push(h('span', { class: 'isaret' }, 'Benzer ürün'));

  let alt;
  if (d && d.veri && d.veri.enUcuz && !u.ikinci) {
    alt = h('p', { class: 'alt-yazi' }, h('b', null, saticiYazisi(d.veri.enUcuz)), `. ${kargoYazisi(d.veri.enUcuz)}.`);
  } else if (d && d.yukleniyor) {
    alt = h('p', { class: 'alt-yazi' }, 'En ucuz satıcı soruluyor…');
  } else if (!u.yol) {
    alt = h('p', { class: 'alt-yazi' }, 'Tek satıcıda var');
  } else if (u.fiyatSayisi > 1) {
    alt = h('p', { class: 'alt-yazi' }, `${u.fiyatSayisi} satıcı`);
  } else {
    alt = h('p', { class: 'alt-yazi' }, u.ikinci ? 'İkinci el ve yenilenmiş teklifler' : 'Tek satıcı');
  }

  const govde = [
    gorsel(u.gorsel, u.ad),
    h('span', null, h('span', { class: 'ad' }, u.ad), alt, isaretler.length ? h('span', { class: 'isaretler' }, isaretler) : null),
    h('span', { class: 'sag' }, etiket(u.goster, { sari: enUcuzMu })),
  ];
  if (!u.yol) {
    return h('li', null, h('a', { class: 'satir', href: `https://www.akakce.com/arama/?q=${encodeURIComponent(u.ad)}`, target: '_blank', rel: 'noopener noreferrer' }, govde));
  }
  return h('li', null, h('button', { type: 'button', class: 'satir', onclick: () => urunAc(u.yol, u.ad) }, govde));
}

function marketSatiri(u) {
  const ilk = u.teklifler[0];
  const diger = u.teklifler.slice(1, 4).map((t) => `${t.market} ${tlKisa(t.fiyat)}`).join(', ');
  return h('li', null, h('button', { type: 'button', class: 'satir', onclick: () => marketAc(u) },
    gorsel(u.gorsel, u.ad),
    h('span', null,
      h('span', { class: 'ad' }, u.ad),
      h('p', { class: 'alt-yazi' }, h('b', null, ilk.market), ilk.sube ? `, ${ilk.sube}` : '', diger ? `. Diğerleri: ${diger}` : ''),
      ilk.indirimli || ilk.promosyon ? h('span', { class: 'isaretler' }, h('span', { class: 'isaret indirim' }, ilk.promosyon || 'İndirimde')) : null),
    h('span', { class: 'sag' }, etiket(u.fiyat))));
}

let listeYuvasi = null;
function araListesiniYenile() {
  if (!listeYuvasi || !listeYuvasi.isConnected) return;
  const liste = gorunenUrunler();
  // Sarı etiket, sorguya tam uyan en ucuz yeni ürüne verilir; fiyatı mağazalardan doğrulanana kadar beklenir
  let sariSira = liste.findIndex((u) => !u.ikinci && u.uyum >= 0.999);
  if (sariSira >= 0 && !durum.arama.dogrulamaBitti) {
    const d = liste[sariSira].yol ? durum.arama.ayrinti.get(liste[sariSira].yol) : null;
    if (!(d && d.veri)) sariSira = -1;
  }
  listeYuvasi.replaceChildren(...liste.map((u, i) => urunSatiri(u, i === sariSira)));
}

async function dahaFazla() {
  const a = durum.arama;
  if (a.dahaYukleniyor || !a.sonuc) return;
  a.dahaYukleniyor = true; ciz();
  try {
    const s = await api(`/api/ara?q=${encodeURIComponent(a.q)}&sayfa=${a.sonuc.sayfa + 1}`);
    const varolan = new Set(a.sonuc.urunler.map((u) => u.kod));
    const taban = a.sonuc.urunler.length;
    const yeni = s.urunler.filter((u) => !varolan.has(u.kod)).map((u, i) => ({ ...u, sira: taban + i }));
    a.sonuc.urunler.push(...yeni);
    a.sonuc.sayfa = s.sayfa;
    if (!yeni.length) a.sonuc.toplam = a.sonuc.urunler.length;
    const sayac = new Map();
    for (const u of a.sonuc.urunler) sayac.set(u.kategori || 'diger', (sayac.get(u.kategori || 'diger') || 0) + 1);
    const adlar = new Map([...a.sonuc.kategoriler, ...s.kategoriler].map((k) => [k.slug, k.ad]));
    a.sonuc.kategoriler = [...sayac].map(([slug, adet]) => ({ slug, ad: adlar.get(slug) || slug, adet }));
  } catch (e) { ileti(e.message); }
  a.dahaYukleniyor = false; ciz();
}

function digerSiteler(q) {
  return h('div', { class: 'bolum' },
    h('h2', { class: 'bolum-basligi' }, 'Başka sitelerde de bak'),
    h('p', { class: 'aciklama' }, 'Aynı aramayı o sitede açar.'),
    h('div', { class: 'cipler sar' }, DIGER_SITELER.map(([ad, adres]) => h('a', { class: 'cip', href: adres(encodeURIComponent(q)), target: '_blank', rel: 'noopener noreferrer' }, ad))));
}

function araCiz() {
  const a = durum.arama;
  if (a.yukleniyor) {
    return h('div', { class: 'bolum', 'aria-busy': 'true' },
      h('p', { class: 'bekleme', role: 'status' }, `“${a.q}” için mağazalar taranıyor…`),
      Array.from({ length: 5 }, () => h('div', { class: 'iskelet' }, h('i'), h('div', null, h('i'), h('i')), h('i'))));
  }
  if (a.hata) {
    return h('div', { class: 'uyari-kutusu hata', role: 'alert' },
      h('p', null, h('b', null, 'Arama yapılamadı. '), a.hata.message),
      h('button', { class: 'dugme', type: 'button', onclick: () => araBaslat(a.q) }, 'Yeniden dene'));
  }
  if (!a.sonuc) {
    const son = (durum.baslangic && durum.baslangic.aramalar) || [];
    return [
      h('div', { class: 'bos' },
        h('h2', null, 'Ne arıyorsun?'),
        h('p', null, 'Ürünün adını yaz. Türkiye\'deki mağazaların fiyatlarını yan yana getirip en ucuzunu en üste koyarım.')),
      son.length ? h('div', { class: 'bolum' }, h('h2', { class: 'bolum-basligi' }, 'Son aramalar'),
        h('div', { class: 'cipler sar' }, son.map((q) => h('button', { type: 'button', class: 'cip', onclick: () => araBaslat(q) }, q)))) : null,
    ];
  }

  const s = a.sonuc;
  const parcalar = [];
  const ak = s.kaynaklar.akakce;
  if (ak && !ak.tamam) {
    parcalar.push(h('div', { class: 'uyari-kutusu hata', role: 'alert' },
      h('p', null, h('b', null, 'Mağaza fiyatları şu an alınamadı. '), ak.ileti || ''),
      h('button', { class: 'dugme ikincil', type: 'button', onclick: () => araBaslat(a.q) }, 'Yeniden dene')));
  }

  const liste = gorunenUrunler();
  if (s.urunler.length) {
    const ikinciElVar = s.urunler.some((u) => u.fiyat === null);
    const kategoriler = s.kategoriler.filter((k) => k.adet > 0);
    listeYuvasi = h('ul', { class: 'raf' });
    parcalar.push(h('div', { class: 'bolum' },
      kategoriler.length > 1 ? h('div', { class: 'cipler', role: 'group', 'aria-label': 'Kategori' },
        h('button', { type: 'button', class: 'cip', 'aria-pressed': String(a.kategori === null), onclick: () => { a.kategori = null; ciz(); } }, 'Hepsi', h('span', { class: 'adet' }, String(s.urunler.length))),
        kategoriler.slice(0, 8).map((k) => h('button', { type: 'button', class: 'cip', 'aria-pressed': String(a.kategori === k.slug), onclick: () => { a.kategori = k.slug; ciz(); ilkSaticilariGetir(a.sayi); } }, k.ad, h('span', { class: 'adet' }, String(k.adet))))) : null,
      h('div', { class: 'arac' },
        h('label', null, 'Sıralama', h('select', { onchange: (o) => { a.sira = o.target.value; ciz(); } },
          h('option', { value: 'ucuz', selected: a.sira === 'ucuz' }, 'En ucuz üstte'),
          h('option', { value: 'populer', selected: a.sira === 'populer' }, 'En çok bakılan üstte'))),
        ikinciElVar ? h('label', null, h('input', { type: 'checkbox', checked: a.ikinciEl, onchange: (o) => { a.ikinciEl = o.target.checked; ciz(); } }), 'İkinci el de göster') : null),
      liste.length ? listeYuvasi : h('p', { class: 'bekleme' }, 'Bu kategoride gösterilecek ürün yok.'),
      s.urunler.length < s.toplam && s.sayfa < 5 ? h('div', { class: 'dolgu' }, h('button', { class: 'dugme ikincil genis', type: 'button', disabled: a.dahaYukleniyor, onclick: dahaFazla }, a.dahaYukleniyor ? 'Yükleniyor…' : 'Daha fazla ürün getir')) : null));
    araListesiniYenile();
  } else if (ak && ak.tamam && !s.market.length) {
    parcalar.push(h('div', { class: 'bos' },
      h('h2', null, 'Bu adla ürün çıkmadı'),
      h('p', null, s.oneri ? 'Yazımı biraz değiştirip yeniden dene.' : 'Marka ve modeli daha kısa yazıp yeniden dene; örneğin yalnızca “airfryer” ya da “iphone 13”.'),
      s.oneri ? h('div', { class: 'cipler sar' }, h('button', { type: 'button', class: 'cip', onclick: () => araBaslat(s.oneri) }, s.oneri)) : null));
  }

  if (s.market.length) {
    parcalar.push(h('div', { class: 'bolum' },
      h('h2', { class: 'bolum-basligi' }, 'Market rafında'),
      h('p', { class: 'aciklama' }, `${(durum.baslangic && durum.baslangic.ayar.konum.ad) || 'Konumun'} çevresindeki şubeler. Fiyatlar raf fiyatıdır.`),
      h('ul', { class: 'raf' }, s.market.map(marketSatiri))));
  } else if (s.kaynaklar.market && !s.kaynaklar.market.tamam && !s.urunler.length) {
    parcalar.push(h('div', { class: 'uyari-kutusu' }, h('p', null, 'Market fiyatları şu an alınamadı.')));
  }
  parcalar.push(digerSiteler(a.q));
  return parcalar;
}

// ---------------------------------------------------------------- ürün ayrıntısı
function teklifSatiri(t, sari) {
  const adres = t.link || t.dogrudan;
  const altlar = [kargoYazisi(t)];
  if (t.teslimat) altlar.push(t.teslimat);
  if (t.stok !== null && t.stok > 0 && t.stok <= 5) altlar.push(`son ${t.stok} adet`);
  const govde = [
    h('span', { class: 'magaza' }, t.magaza, t.satici ? h('span', { class: 'satici' }, `, ${t.satici}`) : null),
    etiket(t.toplam, { sari, boyut: sari ? '' : 'kucuk' }),
    h('span', { class: 'alt-yazi' }, `${altlar.join(', ')}.`),
    t.notlar && t.notlar.length ? h('span', { class: 'notlar' }, t.notlar.map((n) => h('span', null, n.metin))) : null,
    t.tahmini ? h('span', { class: 'notlar' }, h('span', null, `Bu kampanyayla yaklaşık ${tl(t.tahmini.toplam)}${t.tahmini.kosullu ? ' (kuponu alman ya da koşulu sağlaman gerekebilir)' : ''}.`)) : null,
    adres ? h('span', { class: 'git' }, 'Mağazaya git') : null,
  ];
  return adres
    ? h('a', { class: 'teklif', href: adres, target: '_blank', rel: 'noopener noreferrer' }, govde)
    : h('div', { class: 'teklif' }, govde);
}

function takipKutusu(veri, yol) {
  const kutu = h('div', { class: 'bolum dolgu' });
  const ciz2 = () => {
    if (veri.takipId) {
      kutu.replaceChildren(
        h('p', { class: 'bilgi-satiri' }, h('b', null, 'Takip listende. '), 'Fiyat düşünce bildirim gelecek.'),
        h('div', { class: 'dugmeler ub-12' },
          h('button', { class: 'dugme ikincil', type: 'button', onclick: () => { sayfaKapatVeGit('takip'); } }, 'Takip listesini aç')));
      return;
    }
    const hedef = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Örneğin 45000', autocomplete: 'off' });
    const dugme = h('button', { class: 'dugme', type: 'button' }, 'Takibe al');
    dugme.addEventListener('click', async () => {
      const girilen = hedef.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
      dugme.disabled = true; dugme.textContent = 'Ekleniyor…';
      try {
        const s = await api('/api/takip', { yontem: 'POST', govde: { kaynak: 'akakce', yol, ad: veri.urun.ad, gorsel: veri.urun.gorsel, hedefFiyat: girilen ? Number(girilen) : null } });
        veri.takipId = s.kayit.id;
        durum.takip.liste = null;
        ileti(durum.push.abone ? 'Takibe alındı. Ucuzlayınca bildirim gelecek.' : 'Takibe alındı. Bildirim için Ayarlar\'dan bildirimleri aç.');
        ciz2();
      } catch (e) { ileti(e.message); dugme.disabled = false; dugme.textContent = 'Takibe al'; }
    });
    kutu.replaceChildren(
      h('h3', { class: 'ic-baslik' }, 'Ucuzlayınca haber ver'),
      h('div', { class: 'yan-yana' }, h('label', { class: 'alan' }, 'Hedef fiyat (istersen)', hedef), dugme));
  };
  ciz2();
  return kutu;
}

function sayfaKapatVeGit(gorunum) {
  if (sayfaAcik) history.back();
  setTimeout(() => git(gorunum), 0);
}

async function urunAc(yol, ad) {
  sayfaAc(ad, h('p', { class: 'bekleme', role: 'status' }, 'Mağazalar soruluyor…'));
  let veri;
  const onceki = durum.arama.ayrinti.get(yol);
  try {
    veri = onceki && onceki.veri ? onceki.veri : await api(`/api/urun?yol=${encodeURIComponent(yol)}`);
    durum.arama.ayrinti.set(yol, { veri });
  } catch (e) {
    if (!sayfaAcik) return;
    sayfaGovde.replaceChildren(h('div', { class: 'uyari-kutusu hata', role: 'alert' },
      h('p', null, h('b', null, 'Teklifler alınamadı. '), e.message),
      h('button', { class: 'dugme', type: 'button', onclick: () => urunAc(yol, ad) }, 'Yeniden dene')));
    return;
  }
  if (!sayfaAcik) return;
  const u = veri.urun;
  const en = veri.enUcuz;
  const parcalar = [h('div', { class: 'urun-basi' }, gorsel(u.gorsel, u.ad), h('div', null, h('h2', null, u.ad || ad), u.kategori ? h('p', { class: 'aciklama' }, u.kategori) : null))];

  if (en) {
    const adres = en.link || en.dogrudan;
    parcalar.push(h('div', { class: 'en-iyi' },
      h('div', null, etiket(en.toplam, { sari: true, boyut: 'buyuk' })),
      h('div', null, h('p', { class: 'kimden' }, saticiYazisi(en)), h('p', { class: 'ayrinti' }, `${[kargoYazisi(en), en.teslimat].filter(Boolean).join(', ')}.`)),
      adres ? h('a', { class: 'dugme genis', href: adres, target: '_blank', rel: 'noopener noreferrer' }, 'Mağazaya git') : null,
      veri.kampanyaliEnUcuz ? h('p', { class: 'bilgi-satiri' }, h('b', null, 'Kampanyayla daha ucuz olabilir: '), `${saticiYazisi(veri.kampanyaliEnUcuz)}, “${veri.kampanyaliEnUcuz.tahmini.not}” ile yaklaşık ${tl(veri.kampanyaliEnUcuz.tahmini.toplam)}.`) : null,
      u.enDusuk1Ay ? h('p', { class: 'bilgi-satiri' }, 'Son bir ayda görülen en düşük fiyat ', h('b', null, tl(u.enDusuk1Ay)), u.enDusuk1AyTarih ? ` (${tarih(Date.parse(u.enDusuk1AyTarih))}).` : '.') : null));
    parcalar.push(takipKutusu(veri, yol));
    const kalan = veri.teklifler.slice(1);
    if (kalan.length) {
      parcalar.push(h('div', { class: 'bolum' },
        h('h3', { class: 'bolum-basligi' }, 'Diğer teklifler'),
        h('p', { class: 'aciklama' }, veri.toplamTeklif > veri.teklifler.length ? `Toplam ${veri.toplamTeklif} tekliften en ucuz ${veri.teklifler.length} tanesi. Fiyatlara kargo dahil.` : 'Fiyatlara kargo dahil.'),
        kalan.map((t) => teklifSatiri(t, false))));
    }
    // en ucuz teklifin kampanya notları varsa onları da göster
    if (en.notlar && en.notlar.length) {
      parcalar.splice(2, 0, h('div', { class: 'bolum dolgu' }, h('p', { class: 'bilgi-satiri' }, h('b', null, `${en.magaza} kampanyası: `), en.notlar.map((n) => n.metin).join(' / '))));
    }
  } else {
    parcalar.push(h('div', { class: 'uyari-kutusu' }, h('p', null, h('b', null, 'Şu an sıfır ürün satan mağaza görünmüyor. '), 'Takibe alırsan yeniden satışa çıkınca haber veririm.')));
    parcalar.push(takipKutusu(veri, yol));
  }

  if (veri.secenekler.length) {
    parcalar.push(h('div', { class: 'bolum' }, h('h3', { class: 'bolum-basligi' }, 'Diğer seçenekler'),
      h('div', { class: 'cipler sar' }, veri.secenekler.map((s) => h('button', { type: 'button', class: 'cip', onclick: () => urunAc(s.yol, s.ad) }, s.renk || s.ad)))));
  }
  if (veri.ikinciEl.length) {
    parcalar.push(h('div', { class: 'bolum' }, h('h3', { class: 'bolum-basligi' }, 'İkinci el ve yenilenmiş'),
      veri.ikinciEl.slice(0, 8).map((t) => {
        const govde = [h('span', { class: 'magaza' }, t.magaza), etiket(t.toplam, { boyut: 'kucuk' }), h('span', { class: 'alt-yazi' }, t.baslik || ''), t.link ? h('span', { class: 'git' }, 'Mağazaya git') : null];
        return t.link ? h('a', { class: 'teklif', href: t.link, target: '_blank', rel: 'noopener noreferrer' }, govde) : h('div', { class: 'teklif' }, govde);
      })));
  }
  parcalar.push(h('div', { class: 'dolgu' },
    h('a', { class: 'dugme ikincil genis', href: u.akakce, target: '_blank', rel: 'noopener noreferrer' }, 'Bu ürünü Akakçe\'de aç'),
    h('p', { class: 'aciklama ub-12' }, 'Fiyatlar Akakçe\'nin mağazalardan topladığı verilerdir; son fiyatı mağaza sayfasında doğrula.')));
  sayfaGovde.replaceChildren(...parcalar);
}

function marketAc(u) {
  const takipte = (durum.takip.liste || []).find((k) => k.kaynak === 'market' && k.ad === u.ad);
  const dugme = h('button', { class: 'dugme genis', type: 'button', disabled: !!takipte }, takipte ? 'Takip listende' : 'Takibe al');
  dugme.addEventListener('click', async () => {
    dugme.disabled = true; dugme.textContent = 'Ekleniyor…';
    try {
      await api('/api/takip', { yontem: 'POST', govde: { kaynak: 'market', urunId: u.id, ad: u.ad, gorsel: u.gorsel } });
      durum.takip.liste = null;
      dugme.textContent = 'Takip listende';
      ileti('Takibe alındı.');
    } catch (e) { ileti(e.message); dugme.disabled = false; dugme.textContent = 'Takibe al'; }
  });
  sayfaAc(u.ad, [
    h('div', { class: 'urun-basi' }, gorsel(u.gorsel, u.ad), h('div', null, h('h2', null, u.ad), h('p', { class: 'aciklama' }, [u.marka, u.miktar].filter(Boolean).join(', ')))),
    h('div', { class: 'en-iyi' },
      h('div', null, etiket(u.fiyat, { sari: true, boyut: 'buyuk' })),
      h('div', null, h('p', { class: 'kimden' }, u.teklifler[0].market), h('p', { class: 'ayrinti' }, [u.teklifler[0].sube, u.teklifler[0].birimFiyat].filter(Boolean).join(', '))),
      dugme),
    u.teklifler.length > 1 ? h('div', { class: 'bolum' }, h('h3', { class: 'bolum-basligi' }, 'Diğer marketler'),
      u.teklifler.slice(1).map((t) => h('div', { class: 'teklif' },
        h('span', { class: 'magaza' }, t.market), etiket(t.fiyat, { boyut: 'kucuk' }),
        h('span', { class: 'alt-yazi' }, [t.sube, t.birimFiyat, t.promosyon].filter(Boolean).join(', '))))) : null,
    h('p', { class: 'aciklama dolgu' }, `Kaynak: Market Fiyatı (TÜBİTAK). ${u.teklifler[0].tarih ? `Son güncelleme ${u.teklifler[0].tarih}.` : ''}`),
  ]);
}

// ---------------------------------------------------------------- takip listesi
async function takipYukle() {
  try {
    const s = await api('/api/takip');
    durum.takip.liste = s.takip;
    durum.takip.hata = null;
  } catch (e) { durum.takip.hata = e; }
  if (durum.gorunum === 'takip') ciz();
}

function grafik(gecmis, sinif) {
  const n = gecmis.filter((p) => Array.isArray(p) && Number.isFinite(p[1]));
  if (n.length < 2) return null;
  const sonNokta = n[n.length - 1];
  if (Date.now() > sonNokta[0]) n.push([Date.now(), sonNokta[1]]); // son fiyat bugüne kadar geçerli
  const G = 100; const Y = 30;
  const t0 = n[0][0]; const t1 = n[n.length - 1][0];
  const fiyatlar = n.map((p) => p[1]);
  const alt = Math.min(...fiyatlar); const ust = Math.max(...fiyatlar);
  const x = (t) => (t1 === t0 ? G : ((t - t0) / (t1 - t0)) * G);
  const y = (f) => (ust === alt ? Y / 2 : 3 + (1 - (f - alt) / (ust - alt)) * (Y - 6));
  // basamaklı çizgi: fiyat bir sonraki ölçüme kadar aynı kalır
  const noktalar = [];
  n.forEach((p, i) => {
    if (i > 0) noktalar.push(`${x(p[0]).toFixed(1)},${y(n[i - 1][1]).toFixed(1)}`);
    noktalar.push(`${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
  });
  return svg('svg', { class: `grafik ${sinif || ''}`, viewBox: `0 0 ${G} ${Y}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `Fiyat ${tlKisa(alt)} ile ${tlKisa(ust)} arasında değişti` },
    svg('polyline', { points: noktalar.join(' ') }));
}

function degisimIsareti(k) {
  if (k.fiyat === null || !k.ilkFiyat || k.fiyat === k.ilkFiyat) return null;
  const oran = ((k.fiyat - k.ilkFiyat) / k.ilkFiyat) * 100;
  if (Math.abs(oran) < 0.1) return null;
  return h('span', { class: `isaret ${oran < 0 ? 'indirim' : 'artis'}` }, `${yuzde(oran)} ${oran < 0 ? 'düştü' : 'arttı'}`);
}

function takipSatiri(k) {
  const isaretler = [degisimIsareti(k)];
  if (k.hedefFiyat) isaretler.push(h('span', { class: 'isaret' }, `Hedef ${tlKisa(k.hedefFiyat)}`));
  if (k.durakladi) isaretler.push(h('span', { class: 'isaret' }, 'Duraklatıldı'));
  if (k.hata) isaretler.push(h('span', { class: 'isaret uyari' }, 'Son kontrol başarısız'));
  const alt = k.fiyat !== null
    ? h('p', { class: 'alt-yazi' }, h('b', null, [k.magaza, k.satici].filter(Boolean).join(', ')), k.sonKontrol ? `. ${zamanOnce(k.sonKontrol)} bakıldı.` : '')
    : h('p', { class: 'alt-yazi' }, k.sonKontrol ? 'Şu an satan mağaza yok.' : 'İlk fiyat alınıyor…');
  return h('li', null, h('button', { type: 'button', class: 'satir', onclick: () => takipAc(k.id) },
    gorsel(k.gorsel, k.ad),
    h('span', null, h('span', { class: 'ad' }, k.ad), alt, isaretler.some(Boolean) ? h('span', { class: 'isaretler' }, isaretler) : null),
    h('span', { class: 'sag' }, k.fiyat !== null ? etiket(k.fiyat) : null, grafik(k.gecmis, 'kucuk-grafik'))));
}

function bildirimCagrisi() {
  const p = durum.push;
  if (p.abone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const kurulu = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!p.destek) {
    return h('div', { class: 'uyari-kutusu' }, ios && !kurulu
      ? h('p', null, h('b', null, 'iPhone\'da bildirim için önce ana ekrana ekle. '), 'Safari\'de alttaki Paylaş simgesine, sonra “Ana Ekrana Ekle”ye dokun. Uygulamayı ana ekrandaki simgeden açınca bildirimleri açabilirsin.')
      : h('p', null, h('b', null, 'Bu tarayıcı bildirim gönderemiyor. '), 'Android\'de Chrome ile, iPhone\'da ana ekrana ekleyerek kullan.'));
  }
  if (p.izin === 'denied') {
    return h('div', { class: 'uyari-kutusu' }, h('p', null, h('b', null, 'Bildirim izni kapalı. '), 'Telefonun ayarlarından Fiyat Avcısı için bildirimlere izin ver, sonra bu sayfayı yeniden aç.'));
  }
  return h('div', { class: 'uyari-kutusu' },
    h('p', null, h('b', null, 'İndirim olunca telefonuna haber gelsin. '), 'Bu telefonda bildirimler henüz açık değil.'),
    h('button', { class: 'dugme', type: 'button', disabled: p.mesgul, onclick: bildirimleriAc }, p.mesgul ? 'Açılıyor…' : 'Bildirimleri aç'));
}

function takipCiz() {
  const t = durum.takip;
  if (t.hata && !t.liste) return h('div', { class: 'uyari-kutusu hata', role: 'alert' }, h('p', null, h('b', null, 'Takip listesi alınamadı. '), t.hata.message), h('button', { class: 'dugme', type: 'button', onclick: takipYukle }, 'Yeniden dene'));
  if (!t.liste) return h('p', { class: 'bekleme', role: 'status' }, 'Takip listesi yükleniyor…');
  if (!t.liste.length) {
    return [bildirimCagrisi(), h('div', { class: 'bos' },
      h('h2', null, 'Takipte ürün yok'),
      h('p', null, 'Bir ürün ara, ürünü aç ve “Takibe al”a dokun. Fiyatı düşünce bildirim gönderirim.'),
      h('div', { class: 'ub-16' }, h('button', { class: 'dugme', type: 'button', onclick: () => git('ara') }, 'Ürün ara')))];
  }
  const dakika = (durum.baslangic && durum.baslangic.ayar.kontrolDakika) || 60;
  return [bildirimCagrisi(), h('div', { class: 'bolum' },
    h('p', { class: 'bekleme' }, `${t.liste.length} ürün takipte. Fiyatlara ${dakika >= 60 ? `${dakika / 60} saatte` : `${dakika} dakikada`} bir bakılıyor; gece 23.00 ile 08.00 arası bildirim gönderilmez.`),
    h('ul', { class: 'raf' }, t.liste.map(takipSatiri)))];
}

function takipAc(id) {
  const k = (durum.takip.liste || []).find((x) => x.id === id);
  if (!k) return;
  const yenile = (kayit) => {
    const i = durum.takip.liste.findIndex((x) => x.id === id);
    if (i >= 0) durum.takip.liste[i] = kayit;
    takipAc(id);
    if (durum.gorunum === 'takip') ciz();
  };
  const hedef = h('input', { type: 'text', inputmode: 'decimal', value: k.hedefFiyat ? String(k.hedefFiyat).replace('.', ',') : '', placeholder: 'Hedef yok', autocomplete: 'off' });
  const islem = (dugme, metin, is) => dugme.addEventListener('click', async () => {
    const eski = dugme.textContent; dugme.disabled = true; dugme.textContent = metin;
    try { await is(); } catch (e) { ileti(e.message); dugme.disabled = false; dugme.textContent = eski; }
  });
  const kaydet = h('button', { class: 'dugme', type: 'button' }, 'Kaydet');
  islem(kaydet, 'Kaydediliyor…', async () => {
    const girilen = hedef.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const s = await api(`/api/takip/${id}`, { yontem: 'PATCH', govde: { hedefFiyat: girilen ? Number(girilen) : null } });
    ileti(s.kayit.hedefFiyat ? `Hedef ${tlKisa(s.kayit.hedefFiyat)} olarak kaydedildi.` : 'Hedef fiyat kaldırıldı.');
    yenile(s.kayit);
  });
  const kontrol = h('button', { class: 'dugme ikincil', type: 'button' }, 'Şimdi kontrol et');
  islem(kontrol, 'Bakılıyor…', async () => {
    const s = await api(`/api/takip/${id}/kontrol`, { yontem: 'POST' });
    ileti(s.kayit.hata ? s.kayit.hata.ileti : (s.kayit.fiyat !== null ? `Güncel fiyat ${tl(s.kayit.fiyat)}.` : 'Şu an satan mağaza yok.'));
    yenile(s.kayit);
  });
  const duraklat = h('button', { class: 'dugme ikincil', type: 'button' }, k.durakladi ? 'Takibi sürdür' : 'Takibi duraklat');
  islem(duraklat, 'Kaydediliyor…', async () => {
    const s = await api(`/api/takip/${id}`, { yontem: 'PATCH', govde: { durakladi: !k.durakladi } });
    yenile(s.kayit);
  });
  const cikar = h('button', { class: 'dugme tehlike', type: 'button' }, 'Takipten çıkar');
  islem(cikar, 'Çıkarılıyor…', async () => {
    await api(`/api/takip/${id}`, { yontem: 'DELETE' });
    durum.takip.liste = durum.takip.liste.filter((x) => x.id !== id);
    for (const d of durum.arama.ayrinti.values()) if (d.veri && d.veri.takipId === id) d.veri.takipId = null;
    ileti('Takipten çıkarıldı.');
    history.back();
    if (durum.gorunum === 'takip') ciz();
  });

  const bilgiler = [];
  if (k.ilkFiyat) bilgiler.push(h('p', { class: 'bilgi-satiri' }, 'Takibe aldığında ', h('b', null, tl(k.ilkFiyat)), ` idi (${tarih(k.eklendi)}).`));
  if (k.enDusuk && k.enDusukTarih && k.enDusuk !== k.ilkFiyat) bilgiler.push(h('p', { class: 'bilgi-satiri' }, 'Takipten beri en düşük ', h('b', null, tl(k.enDusuk)), ` (${tarih(k.enDusukTarih)}).`));
  if (k.enDusuk1Ay) bilgiler.push(h('p', { class: 'bilgi-satiri' }, 'Piyasada son bir ayın en düşüğü ', h('b', null, tl(k.enDusuk1Ay)), '.'));
  if (k.sonKontrol) bilgiler.push(h('p', { class: 'bilgi-satiri' }, `Son kontrol ${tarihSaat(k.sonKontrol)}.`));
  if (k.hata) bilgiler.push(h('p', { class: 'bilgi-satiri' }, h('b', null, 'Son kontrol başarısız oldu: '), k.hata.ileti));

  const cizim = grafik(k.gecmis);
  sayfaAc(k.ad, [
    h('div', { class: 'urun-basi' }, gorsel(k.gorsel, k.ad), h('div', null, h('h2', null, k.ad))),
    h('div', { class: 'en-iyi' },
      k.fiyat !== null ? h('div', null, etiket(k.fiyat, { sari: true, boyut: 'buyuk' })) : h('p', { class: 'kimden' }, 'Şu an satan mağaza yok'),
      k.fiyat !== null ? h('div', null, h('p', { class: 'kimden' }, [k.magaza, k.satici].filter(Boolean).join(', ')), h('p', { class: 'ayrinti' }, k.kargo === 0 ? 'Kargo ücretsiz.' : (k.kargo > 0 ? `${tl(k.kargo)} kargo dahil.` : ''))) : null,
      k.link && k.fiyat !== null ? h('a', { class: 'dugme genis', href: k.link, target: '_blank', rel: 'noopener noreferrer' }, 'Mağazaya git') : null,
      bilgiler),
    cizim ? h('div', { class: 'bolum dolgu' }, h('p', { class: 'aciklama' }, 'Takipten beri fiyat'), cizim) : null,
    h('div', { class: 'bolum dolgu' }, h('div', { class: 'yan-yana' }, h('label', { class: 'alan' }, 'Hedef fiyat', hedef), kaydet),
      h('p', { class: 'aciklama ub-8' }, 'Fiyat bu tutarın altına inince ayrıca haber veririm.')),
    h('div', { class: 'dolgu dugmeler' },
      k.yol ? h('button', { class: 'dugme ikincil', type: 'button', onclick: () => urunAc(k.yol, k.ad) }, 'Bütün teklifleri gör') : null,
      kontrol, duraklat, cikar),
  ]);
}

// ---------------------------------------------------------------- bildirim kutusu
async function bildirimlerYukle() {
  try {
    const s = await api('/api/bildirimler');
    durum.bildirimler = s.bildirimler;
    if (durum.okunmamis > 0) { api('/api/bildirimler/okundu', { yontem: 'POST' }).catch(() => {}); }
  } catch (e) { durum.bildirimler = durum.bildirimler || []; ileti(e.message); }
  if (durum.gorunum === 'bildirimler') ciz();
  durum.okunmamis = 0;
}

function bildirimlerCiz() {
  if (!durum.bildirimler) return h('p', { class: 'bekleme', role: 'status' }, 'Bildirimler yükleniyor…');
  if (!durum.bildirimler.length) {
    return [bildirimCagrisi(), h('div', { class: 'bos' }, h('h2', null, 'Henüz bildirim yok'), h('p', null, 'Takipteki bir ürün ucuzlayınca, hedef fiyata inince ya da yeniden satışa çıkınca burada görürsün.'))];
  }
  return [bildirimCagrisi(), h('div', { class: 'bolum' }, durum.bildirimler.map((b) => h('button', {
    type: 'button', class: `bildirim-ogesi ${b.okundu ? '' : 'yeni'}`.trim(),
    onclick: async () => { if (!b.takipId) return; if (!durum.takip.liste) await takipYukle(); if ((durum.takip.liste || []).some((k) => k.id === b.takipId)) takipAc(b.takipId); else ileti('Bu ürün artık takip listende değil.'); },
  }, h('span', { class: 'baslik' }, b.baslik), h('span', null, b.govde), h('span', { class: 'zaman' }, tarihSaat(b.zaman)))))];
}

// ---------------------------------------------------------------- telefona bildirim (web push)
function b64Dizi(b64) {
  const dolgu = '='.repeat((4 - (b64.length % 4)) % 4);
  const ham = atob((b64 + dolgu).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(ham, (c) => c.charCodeAt(0));
}
function cihazAdi() {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? 'Android telefon' : 'Android tablet';
  return 'Bilgisayar';
}

async function pushHazirla() {
  const p = durum.push;
  p.destek = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!('serviceWorker' in navigator)) return;
  try {
    const kayit = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    navigator.serviceWorker.addEventListener('message', (o) => { if (o.data && o.data.tur === 'git') adreseGit(o.data.adres); });
    if (!p.destek) return;
    p.izin = Notification.permission;
    const abonelik = await kayit.pushManager.getSubscription();
    if (abonelik && p.izin === 'granted') {
      p.abone = abonelik.endpoint;
      // Sunucu aboneliği unutmuş olabilir: sessizce yeniden bildir
      api('/api/push/abone', { yontem: 'POST', govde: { abonelik: abonelik.toJSON(), cihaz: cihazAdi() } }).catch(() => {});
    }
  } catch { /* servis çalışanı kurulamadı: bildirim olmadan devam */ }
}

async function bildirimleriAc() {
  const p = durum.push;
  if (!p.destek || p.mesgul) return;
  p.mesgul = true; ciz();
  try {
    const izin = await Notification.requestPermission();
    p.izin = izin;
    if (izin !== 'granted') { ileti('Bildirim izni verilmedi.'); return; }
    const kayit = await navigator.serviceWorker.ready;
    let abonelik = await kayit.pushManager.getSubscription();
    if (!abonelik) abonelik = await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64Dizi(durum.baslangic.pushAnahtar) });
    await api('/api/push/abone', { yontem: 'POST', govde: { abonelik: abonelik.toJSON(), cihaz: cihazAdi() } });
    p.abone = abonelik.endpoint;
    const d = await api('/api/push/dene', { yontem: 'POST', govde: { endpoint: abonelik.endpoint } });
    ileti(d.tamam ? 'Bildirimler açıldı. Deneme bildirimi gönderdim.' : 'Bildirimler açıldı ama deneme bildirimi gönderilemedi.');
  } catch (e) {
    ileti(e instanceof ApiHatasi ? e.message : 'Bildirimler açılamadı. Tarayıcı izin vermedi ya da bağlantı kesildi.');
  } finally { p.mesgul = false; ciz(); }
}

async function bildirimleriKapat() {
  const p = durum.push;
  try {
    const kayit = await navigator.serviceWorker.ready;
    const abonelik = await kayit.pushManager.getSubscription();
    if (abonelik) {
      await api('/api/push/cik', { yontem: 'POST', govde: { endpoint: abonelik.endpoint } }).catch(() => {});
      await abonelik.unsubscribe();
    }
    p.abone = null;
    ileti('Bu telefonda bildirimler kapatıldı.');
  } catch { ileti('Bildirimler kapatılamadı.'); }
  ciz();
}

// ---------------------------------------------------------------- ayarlar
async function ayarKaydet(degisiklik) {
  try {
    const s = await api('/api/ayar', { yontem: 'POST', govde: degisiklik });
    durum.baslangic.ayar = s.ayar;
    ileti('Kaydedildi.');
  } catch (e) { ileti(e.message); }
  ciz();
}

function secim(deger, secenekler, degisince) {
  return h('select', { onchange: (o) => degisince(o.target.value) }, secenekler.map(([d, yazi]) => h('option', { value: String(d), selected: String(d) === String(deger) }, yazi)));
}

async function taniCalistir(dugme) {
  dugme.disabled = true; dugme.textContent = 'Deneniyor…';
  try { durum.tani = await api('/api/tani'); } catch (e) { ileti(e.message); }
  ciz();
}

function ayarlarCiz() {
  const b = durum.baslangic;
  if (!b) return h('p', { class: 'bekleme' }, 'Yükleniyor…');
  const a = b.ayar;
  const p = durum.push;
  const android = /android/i.test(navigator.userAgent);
  const kurulu = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const bildirimBolumu = h('div', { class: 'bolum' },
    h('h2', { class: 'bolum-basligi' }, 'Bildirimler'),
    p.abone
      ? [h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Bu telefonda açık'), h('p', { class: 'aciklama' }, 'İndirim olunca haber gelir.')),
          h('button', { class: 'dugme ikincil', type: 'button', onclick: async (o) => { o.target.disabled = true; try { const d = await api('/api/push/dene', { yontem: 'POST', govde: { endpoint: p.abone } }); ileti(d.tamam ? 'Deneme bildirimi gönderildi.' : 'Deneme bildirimi gönderilemedi.'); } catch (e) { ileti(e.message); } o.target.disabled = false; } }, 'Deneme gönder')),
        h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Bu telefonda kapat')), h('button', { class: 'dugme ikincil', type: 'button', onclick: bildirimleriKapat }, 'Kapat'))]
      : bildirimCagrisi(),
    h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Ne kadar düşünce haber verilsin'), h('p', { class: 'aciklama' }, 'Küçük oynamalar bildirilmez.')),
      secim(a.esikYuzde, [[1, 'En az %1'], [2, 'En az %2'], [3, 'En az %3'], [5, 'En az %5'], [10, 'En az %10']], (v) => ayarKaydet({ esikYuzde: Number(v) }))),
    h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Fiyatlara ne sıklıkla bakılsın')),
      secim(a.kontrolDakika, [[30, '30 dakikada bir'], [60, 'Saatte bir'], [120, '2 saatte bir'], [360, '6 saatte bir'], [720, '12 saatte bir']], (v) => ayarKaydet({ kontrolDakika: Number(v) }))));

  const konumDugmesi = h('button', { class: 'dugme ikincil', type: 'button' }, 'Konumumu kullan');
  konumDugmesi.addEventListener('click', () => {
    if (!navigator.geolocation) { ileti('Bu tarayıcı konum veremiyor.'); return; }
    konumDugmesi.disabled = true; konumDugmesi.textContent = 'Konum alınıyor…';
    navigator.geolocation.getCurrentPosition(
      (k) => ayarKaydet({ konum: { lat: k.coords.latitude, lon: k.coords.longitude, ad: 'Konumum' } }),
      () => { ileti('Konum alınamadı. Konum iznini kontrol et.'); ciz(); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
  const marketBolumu = h('div', { class: 'bolum' },
    h('h2', { class: 'bolum-basligi' }, 'Market fiyatları'),
    h('div', { class: 'ayar-satiri' }, h('label', { for: 'market-acik' }, h('p', { class: 'baslik' }, 'Aramada marketlere de bak'), h('p', { class: 'aciklama' }, 'BİM, A101, ŞOK, Migros, CarrefourSA, Tarım Kredi, Hakmar')),
      h('input', { type: 'checkbox', id: 'market-acik', checked: a.marketAcik, onchange: (o) => ayarKaydet({ marketAcik: o.target.checked }) })),
    a.marketAcik ? h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, `Şubeler: ${a.konum.ad}`), h('p', { class: 'aciklama' }, `${a.mesafeKm} km çevresindeki şubelerin fiyatı gösterilir.`)), konumDugmesi) : null);

  const taniDugmesi = h('button', { class: 'dugme ikincil', type: 'button' }, 'Kaynakları dene');
  taniDugmesi.addEventListener('click', () => taniCalistir(taniDugmesi));
  const taniSatirlari = durum.tani ? [
    ...durum.tani.adimlar.map((x) => h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, x.ad), h('p', { class: 'aciklama' }, x.tamam ? `${x.adet} sonuç, ${(x.sureMs / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn` : x.ileti)), h('span', { class: `isaret ${x.tamam ? '' : 'uyari'}` }, x.tamam ? 'Çalışıyor' : 'Çalışmıyor'))),
    durum.tani.market ? h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Market Fiyatı'), h('p', { class: 'aciklama' }, durum.tani.market.tamam ? 'Yanıt veriyor' : durum.tani.market.ileti)), h('span', { class: `isaret ${durum.tani.market.tamam ? '' : 'uyari'}` }, durum.tani.market.tamam ? 'Çalışıyor' : 'Çalışmıyor')) : null,
  ] : null;
  const kaynakBolumu = h('div', { class: 'bolum' },
    h('h2', { class: 'bolum-basligi' }, 'Fiyat kaynakları'),
    h('p', { class: 'aciklama' }, 'Mağaza fiyatları Akakçe\'den, market fiyatları Market Fiyatı\'ndan (TÜBİTAK) okunur. Yapay zekâ ya da ücretli servis kullanılmaz.'),
    h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Sunucudan erişimi sına')), taniDugmesi),
    taniSatirlari);

  const uygulamaBolumu = h('div', { class: 'bolum' },
    h('h2', { class: 'bolum-basligi' }, 'Uygulama'),
    android && !kurulu && b.apk ? h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Android uygulaması'), h('p', { class: 'aciklama' }, 'APK dosyasını indirip kur.')), h('a', { class: 'dugme ikincil', href: b.apk.adres, rel: 'noopener' }, 'APK indir')) : null,
    !kurulu ? h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Ana ekrana ekle'), h('p', { class: 'aciklama' }, android ? 'Chrome menüsünden “Ana ekrana ekle” ya da “Uygulamayı yükle”ye dokun.' : 'Safari\'de Paylaş simgesine, sonra “Ana Ekrana Ekle”ye dokun.'))) : null,
    h('div', { class: 'ayar-satiri' }, h('div', null, h('p', { class: 'baslik' }, 'Bu telefondan çıkış yap'), h('p', { class: 'aciklama' }, 'Giriş kodu yeniden sorulur.')), h('button', { class: 'dugme ikincil', type: 'button', onclick: () => cikis(true) }, 'Çıkış yap')),
    h('p', { class: 'aciklama dolgu' }, `Sürüm ${b.surum || 'yerel'}`));

  return [bildirimBolumu, marketBolumu, kaynakBolumu, uygulamaBolumu];
}

// ---------------------------------------------------------------- başlangıç
async function adreseGit(adres) {
  const m = /#takip\/([a-f0-9]+)/.exec(adres || '');
  if (m) {
    git('takip');
    await takipYukle();
    if ((durum.takip.liste || []).some((k) => k.id === m[1])) takipAc(m[1]);
    return;
  }
  const g = /#(ara|takip|bildirimler|ayarlar)\b/.exec(adres || '');
  git(g ? g[1] : 'ara');
}

async function basla() {
  manifestiAyarla();
  kabukCiz();
  ciz();
  try {
    durum.baslangic = await api('/api/baslangic');
    durum.okunmamis = durum.baslangic.okunmamis;
  } catch (e) {
    if (e.tur === 'giris') return;
    icerik.replaceChildren(h('div', { class: 'uyari-kutusu hata', role: 'alert' }, h('p', null, h('b', null, 'Sunucuya bağlanılamadı. '), e.message), h('button', { class: 'dugme', type: 'button', onclick: () => location.reload() }, 'Yeniden dene')));
    return;
  }
  await pushHazirla();
  await adreseGit(location.hash);
}

(async function ac() {
  // Kurulum bağlantısındaki kod (#kod=...) ya da ana ekran kısayolundaki kod
  const m = /[#&]kod=([0-9A-Za-z]{4,32})/.exec(location.hash);
  if (m) {
    history.replaceState(null, '', location.pathname);
    if (m[1] !== durum.kod) {
      try { await girisDene(m[1]); } catch { /* geçersiz kod: aşağıda sorulur */ }
    }
  }
  if (!durum.kod) { girisCiz(); return; }
  await basla();
}());
