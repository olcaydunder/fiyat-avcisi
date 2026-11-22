import test from 'node:test';
import assert from 'node:assert/strict';
import { adalar, etiketOku, jsonLd, propsCoz } from '../src/astro.js';
import { ada, astroKodla } from './yardimci.js';

test('propsCoz iç içe ikilileri düz nesneye çevirir', () => {
  const ham = JSON.stringify({ a: astroKodla({ b: [1, { c: 'x' }], d: null, e: 1.5, f: true }) });
  assert.deepEqual(propsCoz(ham), { a: { b: [1, { c: 'x' }], d: null, e: 1.5, f: true } });
  assert.equal(propsCoz('bozuk'), null);
  assert.equal(propsCoz('[1,2]'), null);
});

test('adalar props özniteliğini bulur ve çözer', () => {
  const html = `<div>${ada('SearchWrapper', 'search/SearchWrapper.js', { searchData: { productList: { products: [{ name: 'A & "B" <C>', price: 10 }] } } })}içerik</astro-island><astro-island uid="x" props="bozuk"></astro-island></div>`;
  const liste = adalar(html);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].ad, 'SearchWrapper');
  assert.equal(liste[0].dosya, 'SearchWrapper.js');
  assert.equal(liste[0].veri.searchData.productList.products[0].name, 'A & "B" <C>');
});

test('etiketOku tırnak içindeki > karakterine takılmaz', () => {
  const html = '<astro-island a="1>2" b=\'x "y"\' c=duz d>';
  const { oznitelik, son } = etiketOku(html, 0);
  assert.deepEqual(oznitelik, { a: '1>2', b: 'x "y"', c: 'duz', d: '' });
  assert.equal(son, html.length);
});

test('jsonLd blokları okur, bozuk olanı atlar', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"X"}</script><script type="application/ld+json">{bozuk</script><script type=\'application/ld+json\'>[{"@type":"A"},{"@type":"B"}]</script>';
  assert.deepEqual(jsonLd(html).map((x) => x['@type']), ['Product', 'A', 'B']);
});
