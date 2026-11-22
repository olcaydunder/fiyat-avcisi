// Kaynak sitelere nazik erişim katmanı:
// - kendini açıkça tanıtan User-Agent
// - robots.txt'e uyum (yasak yol hiç istenmez)
// - site başına sıra + istekler arası bekleme
// - kısa süreli önbellek, aynı anda aynı isteği tekleştirme
// - 403/429 gelirse o siteye bir süre hiç gitmeme (engeli aşmaya çalışmaz)

import { robotsOku, robotsIzinli } from './robots.js';

export const AJAN_ADI = 'FiyatAvcisi';
export const VARSAYILAN_AJAN = `Mozilla/5.0 (compatible; ${AJAN_ADI}/1.0; kisisel fiyat takibi)`;

export class KaynakHatasi extends Error {
  /** tur: 'robots' | 'engel' | 'http' | 'ag' | 'zaman' | 'bicim' | 'sinir' */
  constructor(tur, ileti, durum = null) {
    super(ileti);
    this.name = 'KaynakHatasi';
    this.tur = tur;
    this.durum = durum;
  }
}

const VARSAYILAN_HOST = { aralikMs: 1000, gunlukSinir: 3000 };
const HOST_AYAR = {
  'www.akakce.com': { aralikMs: 1500, gunlukSinir: 2500 },
  'api.marketfiyati.org.tr': { aralikMs: 300, gunlukSinir: 3000 },
};
const ENGEL_DAKIKA = [5, 15, 45, 60];
const ROBOTS_OMRU_MS = 24 * 3600 * 1000;
const ONBELLEK_AZAMI = 60; // sayfalar 200 KB dolayında; bellek birkaç MB'ı geçmesin

export function getiriciOlustur({
  fetchImpl = globalThis.fetch,
  ajan = VARSAYILAN_AJAN,
  simdi = () => Date.now(),
  bekle = (ms) => new Promise((r) => setTimeout(r, ms)),
  hostAyar = HOST_AYAR,
  gunluk = (msg) => {},
} = {}) {
  const hostlar = new Map();
  const onbellek = new Map();
  const ucusta = new Map();

  function hostDurumu(host) {
    let h = hostlar.get(host);
    if (!h) {
      h = { kuyruk: Promise.resolve(), sonIstek: 0, engelBitis: 0, ardArda: 0, sonBasari: 0, sonHata: null, robots: null, gun: '', sayac: 0, toplam: 0 };
      hostlar.set(host, h);
    }
    return h;
  }

  const ayarOku = (host) => ({ ...VARSAYILAN_HOST, ...(hostAyar[host] || {}) });

  /** Aynı siteye istekleri sıraya dizer ve aralarında bekletir. */
  function sirayaAl(host, is) {
    const h = hostDurumu(host);
    const calis = async () => {
      const kalan = h.sonIstek + ayarOku(host).aralikMs - simdi();
      if (kalan > 0) await bekle(kalan);
      try { return await is(); } finally { h.sonIstek = simdi(); }
    };
    const sonuc = h.kuyruk.then(calis, calis);
    h.kuyruk = sonuc.then(() => {}, () => {});
    return sonuc;
  }

  async function hamIstek(adres, { yontem = 'GET', basliklar = {}, govde = null, zamanAsimiMs = 15000, azamiBayt = 4_000_000 } = {}) {
    const u = new URL(adres);
    const h = hostDurumu(u.host);
    const gun = new Date(simdi()).toISOString().slice(0, 10);
    if (h.gun !== gun) { h.gun = gun; h.sayac = 0; }
    if (h.sayac >= ayarOku(u.host).gunlukSinir) throw new KaynakHatasi('sinir', `${u.host} için günlük istek sınırı doldu`);
    h.sayac++; h.toplam++;

    const istekBasliklari = {
      'User-Agent': ajan,
      'Accept': govde ? 'application/json' : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
      ...(govde ? { 'Content-Type': 'application/json' } : {}),
      ...basliklar,
    };
    let yanit;
    let metin;
    try {
      yanit = await fetchImpl(adres, {
        method: yontem,
        headers: istekBasliklari,
        body: govde ? JSON.stringify(govde) : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(zamanAsimiMs),
      });
      metin = await yanit.text();
    } catch (e) {
      const zaman = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      h.sonHata = { zaman: simdi(), tur: zaman ? 'zaman' : 'ag', ileti: String(e && e.message || e).slice(0, 200) };
      throw new KaynakHatasi(zaman ? 'zaman' : 'ag', zaman ? `${u.host} zamanında yanıt vermedi` : `${u.host} adresine ulaşılamadı`);
    }
    if (metin.length > azamiBayt) throw new KaynakHatasi('bicim', `${u.host} beklenenden büyük yanıt verdi`);
    try {
      if (yanit.url && new URL(yanit.url).host !== u.host) {
        throw new KaynakHatasi('bicim', `${u.host} başka bir siteye yönlendirdi`);
      }
    } catch (e) { if (e instanceof KaynakHatasi) throw e; }
    return { durum: yanit.status, metin, adres: yanit.url || adres };
  }

  function engelle(host, durum) {
    const h = hostDurumu(host);
    h.ardArda++;
    const dk = ENGEL_DAKIKA[Math.min(h.ardArda, ENGEL_DAKIKA.length) - 1];
    h.engelBitis = simdi() + dk * 60_000;
    h.sonHata = { zaman: simdi(), tur: 'engel', ileti: `HTTP ${durum}; ${dk} dk beklenecek` };
    gunluk(`${host}: HTTP ${durum}, ${dk} dakika ara veriliyor`);
  }

  /** Sitenin robots.txt kurallarını getirir (24 saat saklar). Dosyaya ulaşılamazsa nedenini bildiren hata fırlatır. */
  async function robotsGetir(u) {
    const h = hostDurumu(u.host);
    if (h.robots && h.robots.bitis > simdi()) {
      if (h.robots.hata) throw h.robots.hata;
      return h.robots.gruplar;
    }
    if (h.robotsBekleyen) return h.robotsBekleyen;
    h.robotsBekleyen = (async () => {
      try {
        let yanit;
        try {
          yanit = await sirayaAl(u.host, () => hamIstek(`${u.origin}/robots.txt`, { zamanAsimiMs: 10000, azamiBayt: 600_000 }));
        } catch (e) {
          // Siteye ulaşılamadı: kısa süre sonra yeniden denenir; "yasak" sayılmaz, olduğu gibi bildirilir
          const hata = e instanceof KaynakHatasi ? e : new KaynakHatasi('ag', `${u.host} adresine ulaşılamadı`);
          h.robots = { gruplar: [], hata, bitis: simdi() + 60_000 };
          throw hata;
        }
        const { durum, metin } = yanit;
        if (durum >= 200 && durum < 300) {
          h.robots = { gruplar: robotsOku(metin), bitis: simdi() + ROBOTS_OMRU_MS };
        } else if (durum === 429) {
          engelle(u.host, durum);
          throw new KaynakHatasi('engel', `${u.host} isteği geri çevirdi (HTTP ${durum})`, durum);
        } else if (durum >= 400 && durum < 500) {
          h.robots = { gruplar: [], bitis: simdi() + ROBOTS_OMRU_MS }; // dosya yok: kısıt yok (RFC 9309)
        } else {
          // Sunucu hatası: kurallar bilinmeden istek atılmaz; 10 dakika sonra yeniden denenir
          const hata = new KaynakHatasi('http', `${u.host} şu an yanıt veremiyor (HTTP ${durum})`, durum);
          h.robots = { gruplar: [], hata, bitis: simdi() + 10 * 60_000 };
          throw hata;
        }
        return h.robots.gruplar;
      } finally {
        h.robotsBekleyen = null;
      }
    })();
    return h.robotsBekleyen;
  }

  async function robotsSerbest(adres) {
    const u = new URL(adres);
    const gruplar = await robotsGetir(u);
    return robotsIzinli(gruplar, AJAN_ADI, u.pathname + u.search);
  }

  /**
   * Bir adresi getirir. { durum, metin, adres, onbellekten }
   * secenek: { yontem, govde (JSON olarak gönderilir), onbellekSn, robots (varsayılan true), zamanAsimiMs }
   */
  async function getir(adres, secenek = {}) {
    const { yontem = 'GET', govde = null, onbellekSn = 0, robots = true } = secenek;
    const u = new URL(adres);
    if (u.protocol !== 'https:') throw new KaynakHatasi('bicim', 'Yalnızca https adresleri istenir');
    const h = hostDurumu(u.host);
    const anahtar = `${yontem} ${adres} ${govde ? JSON.stringify(govde) : ''}`;

    if (onbellekSn > 0) {
      const kayit = onbellek.get(anahtar);
      if (kayit && kayit.bitis > simdi()) return { ...kayit.deger, onbellekten: true };
    }
    if (ucusta.has(anahtar)) return ucusta.get(anahtar);

    const is = (async () => {
      if (h.engelBitis > simdi()) {
        const dk = Math.ceil((h.engelBitis - simdi()) / 60_000);
        throw new KaynakHatasi('engel', `${u.host} bu sunucuyu geçici olarak geri çevirdi; ${dk} dk sonra yeniden denenecek`);
      }
      if (robots && !(await robotsSerbest(adres))) {
        throw new KaynakHatasi('robots', `${u.host} bu sayfaya otomatik erişime izin vermiyor`);
      }
      const { durum, metin, adres: sonAdres } = await sirayaAl(u.host, () => {
        if (h.engelBitis > simdi()) throw new KaynakHatasi('engel', `${u.host} geçici olarak geri çevirdi`);
        return hamIstek(adres, secenek);
      });
      if (durum === 403 || durum === 429 || durum === 503) {
        engelle(u.host, durum);
        throw new KaynakHatasi('engel', `${u.host} isteği geri çevirdi (HTTP ${durum})`, durum);
      }
      if (durum < 200 || durum >= 300) {
        h.sonHata = { zaman: simdi(), tur: 'http', ileti: `HTTP ${durum}` };
        throw new KaynakHatasi('http', `${u.host} HTTP ${durum} döndürdü`, durum);
      }
      h.ardArda = 0;
      h.sonBasari = simdi();
      const deger = { durum, metin, adres: sonAdres }; // adres: yönlendirme olduysa varılan sayfa
      if (onbellekSn > 0) {
        for (const [k, kayit] of onbellek) if (kayit.bitis <= simdi()) onbellek.delete(k); // süresi dolanları at
        while (onbellek.size >= ONBELLEK_AZAMI) onbellek.delete(onbellek.keys().next().value);
        onbellek.set(anahtar, { bitis: simdi() + onbellekSn * 1000, deger });
      }
      return { ...deger, onbellekten: false };
    })();
    ucusta.set(anahtar, is);
    try { return await is; } finally { ucusta.delete(anahtar); }
  }

  /** Tanılama için site bazında durum. */
  function durum() {
    const sonuc = {};
    for (const [host, h] of hostlar) {
      sonuc[host] = {
        sonBasari: h.sonBasari || null,
        sonHata: h.sonHata,
        engelli: h.engelBitis > simdi(),
        engelBitis: h.engelBitis > simdi() ? h.engelBitis : null,
        bugunIstek: h.sayac,
        toplamIstek: h.toplam,
      };
    }
    return sonuc;
  }

  function onbellekTemizle() { onbellek.clear(); }

  return { getir, durum, robotsSerbest, onbellekTemizle };
}
