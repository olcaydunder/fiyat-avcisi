import test from 'node:test';
import assert from 'node:assert/strict';
import { aramaAyikla, aramaIstegi, yakinIstegi, yakinAyikla, konumGecerli, zincirAdi } from '../src/kaynaklar/marketfiyati.js';
import { MARKET_YANITI } from './yardimci.js';

test('aramaAyikla zincir başına en ucuz şubeyi tutar ve ucuzdan sıralar', () => {
  const u = aramaAyikla(MARKET_YANITI);
  assert.equal(u.length, 3);
  assert.equal(u[0].ad, 'İçim Süt 1 Lt');
  assert.equal(u[0].miktar, '1 LT');
  assert.deepEqual(u[0].teklifler.map((t) => [t.market, t.fiyat, t.sube]), [['Migros', 70.5, 'Mjet Cağaloğlu Istanbul'], ['CarrefourSA', 70.95, 'Istanbul Karaköy Mını']]);
  assert.equal(u[0].fiyat, 70.5);
  assert.equal(u[1].teklifler[0].market, 'BİM');
  assert.equal(u[1].teklifler[0].indirimli, true);
  assert.equal(u[1].teklifler[0].promosyon, 'Haftanın fırsatı');
  assert.equal(u[2].gorsel, null);
});

test('bozuk ya da boş yanıt boş liste verir', () => {
  assert.deepEqual(aramaAyikla(null), []);
  assert.deepEqual(aramaAyikla({ content: [{ title: 'x', productDepotInfoList: [] }, null, { title: '', productDepotInfoList: [{ price: 1 }] }] }), []);
});

test('istek gövdeleri ve konum denetimi', () => {
  const konum = { lat: 41.0082, lon: 28.9784 };
  assert.deepEqual(yakinIstegi(konum, 5), { adres: 'https://api.marketfiyati.org.tr/api/v2/nearest', govde: { latitude: 41.0082, longitude: 28.9784, distance: 5 } });
  const a = aramaIstegi(' süt 1 l ', konum, ['bim-1'], 5);
  assert.equal(a.adres, 'https://api.marketfiyati.org.tr/api/v2/search');
  assert.deepEqual(a.govde, { keywords: 'süt 1 l', pages: 0, size: 24, latitude: 41.0082, longitude: 28.9784, distance: 5, depots: ['bim-1'] });
  assert.equal('depots' in aramaIstegi('x', konum, []).govde, false);
  assert.deepEqual(yakinAyikla([{ id: 'sok-7101' }, { id: 5 }, null]), ['sok-7101']);
  assert.equal(konumGecerli(konum), true);
  assert.equal(konumGecerli({ lat: 52.5, lon: 13.4 }), false);
  assert.equal(konumGecerli(null), false);
  assert.equal(zincirAdi('tarim_kredi'), 'Tarım Kredi');
  assert.equal(zincirAdi('yeni_market'), 'Yeni market');
});
