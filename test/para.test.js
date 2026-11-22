import test from 'node:test';
import assert from 'node:assert/strict';
import { fiyatOku, tl, tlKisa, sade, sozcukler, varlikCoz, duzMetin, bitisikMetin, yuzdeDegisim } from '../src/para.js';

test('fiyatOku Türkçe yazımı okur', () => {
  assert.equal(fiyatOku('51.091,54 TL'), 51091.54);
  assert.equal(fiyatOku('54.999 TL'), 54999);
  assert.equal(fiyatOku('290,00 TL'), 290);
  assert.equal(fiyatOku(' 2.039,15 TL TEK FİYAT'), 2039.15);
  assert.equal(fiyatOku('1.308,6₺'), 1308.6);
  assert.equal(fiyatOku('70,50 ₺/Lt'), 70.5);
  assert.equal(fiyatOku('+ 44,99 TL kargo'), 44.99);
  assert.equal(fiyatOku('fiyat yok'), null);
  assert.equal(fiyatOku(''), null);
  assert.equal(fiyatOku(1234.5), 1234.5);
});

test('tl ve tlKisa Türkçe biçimler', () => {
  assert.equal(tl(51091.54), '51.091,54 TL');
  assert.equal(tl(290), '290,00 TL');
  assert.equal(tlKisa(49899), '49.899 TL');
  assert.equal(tlKisa(49132.36), '49.132,36 TL');
  assert.equal(tl(null), '');
});

test('sade Türkçe harfleri düzleştirir', () => {
  assert.equal(sade('Yıldız IŞIĞI Çöp-Öğütücü'), 'yildiz isigi cop ogutucu');
  assert.equal(sade('İPHONE 13'), 'iphone 13');
});

test('sozcukler harf-rakam sınırında böler', () => {
  assert.deepEqual(sozcukler('iPhone13 128GB'), ['iphone', '13', '128', 'gb']);
  assert.deepEqual(sozcukler('Philips HD9285/96 XXL'), ['philips', 'hd', '9285', '96', 'xxl']);
  assert.deepEqual(sozcukler('  '), []);
});

test('varlikCoz ve metin temizleme', () => {
  assert.equal(varlikCoz('{&quot;a&quot;:&quot;b &amp; c&quot;}'), '{"a":"b & c"}');
  assert.equal(varlikCoz('&#39;x&#x27; &lt;y&gt; &bilinmeyen;'), "'x' <y> &bilinmeyen;");
  assert.equal(duzMetin('<b>Ürüne Git <!-- -->(+28)</b>'), 'Ürüne Git (+28)');
  assert.equal(bitisikMetin(' <!-- -->49.132<i>,<!-- -->36<!-- --> TL </i>'), '49.132,36 TL');
  assert.equal(fiyatOku(bitisikMetin('51.091<i>,54 TL</i>')), 51091.54);
});

test('yuzdeDegisim', () => {
  assert.equal(yuzdeDegisim(100, 97), -3);
  assert.equal(yuzdeDegisim(51091.54, 49899), -2.3);
  assert.equal(yuzdeDegisim(0, 10), 0);
});
