import test from 'node:test';
import assert from 'node:assert/strict';
import { getiriciOlustur, KaynakHatasi, VARSAYILAN_AJAN } from '../src/getir.js';
import { sahteAg, sahteSaat, ROBOTS_AKAKCE } from './yardimci.js';

const KOK = 'https://www.akakce.com';
function kur(rotalar, ek = {}) {
  const ag = sahteAg({ [`${KOK}/robots.txt`]: ROBOTS_AKAKCE, ...rotalar });
  const saat = sahteSaat();
  const g = getiriciOlustur({ fetchImpl: ag.fetchImpl, simdi: saat.simdi, bekle: saat.bekle, ...ek });
  return { g, ag, saat };
}

test('kendini tanıtır, robots.txt dosyasını bir kez okur ve yasak yolu hiç istemez', async () => {
  const { g, ag } = kur({ [`${KOK}/arama/?q=a`]: 'A', [`${KOK}/arama/?q=b`]: 'B', [`${KOK}/r/?pr=1&vd=2&pg=3`]: 'X' });
  assert.equal((await g.getir(`${KOK}/arama/?q=a`)).metin, 'A');
  assert.equal((await g.getir(`${KOK}/arama/?q=b`)).metin, 'B');
  await assert.rejects(g.getir(`${KOK}/r/?pr=1&vd=2&pg=3`), (e) => e instanceof KaynakHatasi && e.tur === 'robots');
  assert.deepEqual(ag.cagrilar.map((c) => c.adres), [`${KOK}/robots.txt`, `${KOK}/arama/?q=a`, `${KOK}/arama/?q=b`]);
  assert.equal(ag.cagrilar[1].basliklar['User-Agent'], VARSAYILAN_AJAN);
  assert.match(VARSAYILAN_AJAN, /FiyatAvcisi/);
});

test('aynı siteye istekler arasında bekler', async () => {
  const { g, saat } = kur({ [`${KOK}/arama/?q=*`]: 'ok' });
  const bas = saat.simdi();
  await Promise.all([g.getir(`${KOK}/arama/?q=1`), g.getir(`${KOK}/arama/?q=2`), g.getir(`${KOK}/arama/?q=3`)]);
  // robots + 3 istek: aralarında en az 3 x 1500 ms
  assert.ok(saat.simdi() - bas >= 4500, `geçen süre ${saat.simdi() - bas}`);
});

test('önbellek süresi içinde ağa gitmez, aynı anda gelen aynı isteği tekleştirir', async () => {
  const { g, ag, saat } = kur({ [`${KOK}/arama/?q=a`]: 'A' });
  const [x, y] = await Promise.all([g.getir(`${KOK}/arama/?q=a`, { onbellekSn: 60 }), g.getir(`${KOK}/arama/?q=a`, { onbellekSn: 60 })]);
  assert.equal(x.metin, 'A'); assert.equal(y.metin, 'A');
  assert.equal((await g.getir(`${KOK}/arama/?q=a`, { onbellekSn: 60 })).onbellekten, true);
  assert.equal(ag.cagrilar.filter((c) => c.adres.endsWith('q=a')).length, 1);
  saat.ilerlet(61_000);
  assert.equal((await g.getir(`${KOK}/arama/?q=a`, { onbellekSn: 60 })).onbellekten, false);
  assert.equal(ag.cagrilar.filter((c) => c.adres.endsWith('q=a')).length, 2);
});

test('403 gelince siteye ara verir, süre dolunca yeniden dener, aşmaya çalışmaz', async () => {
  let durum = 403;
  const { g, ag, saat } = kur({ [`${KOK}/arama/?q=a`]: () => ({ durum, metin: durum === 200 ? 'A' : 'engel' }) });
  await assert.rejects(g.getir(`${KOK}/arama/?q=a`), (e) => e.tur === 'engel' && e.durum === 403);
  const once = ag.cagrilar.length;
  await assert.rejects(g.getir(`${KOK}/arama/?q=a`), (e) => e.tur === 'engel');
  assert.equal(ag.cagrilar.length, once, 'ara verilmişken istek atılmamalı');
  assert.equal(g.durum()['www.akakce.com'].engelli, true);
  durum = 200;
  saat.ilerlet(5 * 60_000 + 1000);
  assert.equal((await g.getir(`${KOK}/arama/?q=a`)).metin, 'A');
  assert.equal(g.durum()['www.akakce.com'].engelli, false);
});

test('art arda engelde bekleme süresi uzar', async () => {
  const { g, saat } = kur({ [`${KOK}/arama/?q=a`]: { durum: 429, metin: '' } });
  await assert.rejects(g.getir(`${KOK}/arama/?q=a`));
  saat.ilerlet(5 * 60_000 + 1000);
  await assert.rejects(g.getir(`${KOK}/arama/?q=a`), (e) => e.durum === 429);
  saat.ilerlet(5 * 60_000 + 1000);
  await assert.rejects(g.getir(`${KOK}/arama/?q=a`), (e) => e.tur === 'engel' && e.durum === null, 'ikinci engelde 15 dk beklenmeli');
});

test('ağ hatası, zaman aşımı ve HTTP hataları ayrı türlerle bildirilir', async () => {
  const zaman = new Error('süre doldu'); zaman.name = 'TimeoutError';
  const { g } = kur({ [`${KOK}/arama/?q=ag`]: new Error('ECONNRESET'), [`${KOK}/arama/?q=zaman`]: zaman, [`${KOK}/arama/?q=500`]: { durum: 500, metin: '' } });
  await assert.rejects(g.getir(`${KOK}/arama/?q=ag`), (e) => e.tur === 'ag');
  await assert.rejects(g.getir(`${KOK}/arama/?q=zaman`), (e) => e.tur === 'zaman');
  await assert.rejects(g.getir(`${KOK}/arama/?q=500`), (e) => e.tur === 'http' && e.durum === 500);
  await assert.rejects(g.getir(`${KOK}/arama/?q=yok`), (e) => e.tur === 'http' && e.durum === 404);
  await assert.rejects(g.getir('http://www.akakce.com/'), (e) => e.tur === 'bicim');
});

test('robots.txt yoksa serbest; sunucu hatasında ya da ulaşılamayınca istek atılmaz ve neden doğru bildirilir', async () => {
  const ag1 = sahteAg({ 'https://a.example/x': 'X' });
  const s1 = sahteSaat();
  const g1 = getiriciOlustur({ fetchImpl: ag1.fetchImpl, simdi: s1.simdi, bekle: s1.bekle });
  assert.equal((await g1.getir('https://a.example/x')).metin, 'X');

  const ag2 = sahteAg({ 'https://b.example/robots.txt': { durum: 500, metin: '' }, 'https://b.example/x': 'X' });
  const s2 = sahteSaat();
  const g2 = getiriciOlustur({ fetchImpl: ag2.fetchImpl, simdi: s2.simdi, bekle: s2.bekle });
  await assert.rejects(g2.getir('https://b.example/x'), (e) => e.tur === 'http' && e.durum === 500);
  await assert.rejects(g2.getir('https://b.example/x'), (e) => e.tur === 'http');
  assert.equal(ag2.cagrilar.length, 1, 'kurallar bilinmeden sayfa istenmez, robots.txt de hemen yeniden istenmez');

  let acik = false;
  const ag3 = sahteAg({ 'https://c.example/robots.txt': () => (acik ? 'User-agent: *\nDisallow: /gizli' : new Error('ENOTFOUND')), 'https://c.example/x': 'X' });
  const s3 = sahteSaat();
  const g3 = getiriciOlustur({ fetchImpl: ag3.fetchImpl, simdi: s3.simdi, bekle: s3.bekle });
  await assert.rejects(g3.getir('https://c.example/x'), (e) => e.tur === 'ag' && /ulaşılamadı/.test(e.message));
  acik = true;
  await assert.rejects(g3.getir('https://c.example/x'), (e) => e.tur === 'ag', 'bir dakika dolmadan yeniden denenmez');
  s3.ilerlet(61_000);
  assert.equal((await g3.getir('https://c.example/x')).metin, 'X');
  await assert.rejects(g3.getir('https://c.example/gizli'), (e) => e.tur === 'robots');

  const ag4 = sahteAg({ 'https://d.example/robots.txt': { durum: 429, metin: '' }, 'https://d.example/x': 'X' });
  const s4 = sahteSaat();
  const g4 = getiriciOlustur({ fetchImpl: ag4.fetchImpl, simdi: s4.simdi, bekle: s4.bekle });
  await assert.rejects(g4.getir('https://d.example/x'), (e) => e.tur === 'engel');
  assert.equal(g4.durum()['d.example'].engelli, true);
});

test('POST gövdesi JSON gönderilir ve önbellek anahtarına girer', async () => {
  const ag = sahteAg({ 'https://api.marketfiyati.org.tr/api/v2/search': (a, s) => `yanit:${s.body}` });
  const saat = sahteSaat();
  const g = getiriciOlustur({ fetchImpl: ag.fetchImpl, simdi: saat.simdi, bekle: saat.bekle });
  const adres = 'https://api.marketfiyati.org.tr/api/v2/search';
  const a = await g.getir(adres, { yontem: 'POST', govde: { keywords: 'süt' }, onbellekSn: 60 });
  const b = await g.getir(adres, { yontem: 'POST', govde: { keywords: 'ekmek' }, onbellekSn: 60 });
  assert.equal(a.metin, 'yanit:{"keywords":"süt"}');
  assert.equal(b.metin, 'yanit:{"keywords":"ekmek"}');
  const post = ag.cagrilar.find((c) => c.yontem === 'POST');
  assert.equal(post.basliklar['Content-Type'], 'application/json');
});

test('günlük istek sınırı aşılınca durur', async () => {
  const ag = sahteAg({ 'https://c.example/*': 'ok' });
  const saat = sahteSaat();
  const g = getiriciOlustur({ fetchImpl: ag.fetchImpl, simdi: saat.simdi, bekle: saat.bekle, hostAyar: { 'c.example': { aralikMs: 0, gunlukSinir: 3 } } });
  await g.getir('https://c.example/1'); // robots + 1 = 2 istek
  await g.getir('https://c.example/2'); // 3
  await assert.rejects(g.getir('https://c.example/3'), (e) => e.tur === 'sinir');
  saat.ilerlet(24 * 3600_000);
  assert.equal((await g.getir('https://c.example/3')).metin, 'ok');
});

test('yönlendirme olduysa varılan adres bildirilir, başka siteye yönlendirme reddedilir', async () => {
  const { g } = kur({
    [`${KOK}/arama/?q=a`]: { metin: 'K', adres: `${KOK}/camasir-makinesi/9-kg.html` },
    [`${KOK}/arama/?q=b`]: 'B',
    [`${KOK}/arama/?q=c`]: { metin: 'X', adres: 'https://kotu.example/' },
  });
  assert.equal((await g.getir(`${KOK}/arama/?q=a`)).adres, `${KOK}/camasir-makinesi/9-kg.html`);
  assert.equal((await g.getir(`${KOK}/arama/?q=b`)).adres, `${KOK}/arama/?q=b`);
  await assert.rejects(g.getir(`${KOK}/arama/?q=c`), (e) => e.tur === 'bicim');
});
