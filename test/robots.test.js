import test from 'node:test';
import assert from 'node:assert/strict';
import { robotsOku, robotsIzinli } from '../src/robots.js';
import { ROBOTS_AKAKCE } from './yardimci.js';

const g = robotsOku(ROBOTS_AKAKCE);
const izin = (yol, ajan = 'FiyatAvcisi') => robotsIzinli(g, ajan, yol);

test('Akakçe: arama ve ürün sayfaları serbest', () => {
  assert.equal(izin('/arama/?q=iphone+13'), true);
  assert.equal(izin('/arama/?q=iphone+13&p=2'), true);
  assert.equal(izin('/cep-telefonu/en-ucuz-iphone-13-fiyati,1101115595.html'), true);
  assert.equal(izin('/'), true);
});

test('Akakçe: yönlendirme, sıralama ve filtre adresleri yasak', () => {
  assert.equal(izin('/r/?pr=1&vd=2&pg=3'), false);
  assert.equal(izin('/c/?x=1'), false);
  assert.equal(izin('/arama/?q=iphone&s=2'), false);
  assert.equal(izin('/cep-telefonu.html?s=2'), false);
  assert.equal(izin('/x.html?g=1'), false); // '/' ile başlamayan desen
  assert.equal(izin('/magaza/idefix,1.html'), false);
  assert.equal(izin('/urunler-100-tl'), false); // $ ile biten desen
  assert.equal(izin('/urunler-100-tl/devam'), true);
});

test('adıyla yasaklanan robot tümden yasaklıdır, diğerleri * grubuna uyar', () => {
  assert.equal(izin('/arama/?q=x', 'PerplexityBot/1.0'), false);
  assert.equal(izin('/arama/?q=x', 'BaskaRobot'), true);
});

test('en uzun kural kazanır, eşitlikte izin kazanır, boş dosya her şeye izin verir', () => {
  const r = robotsOku('User-agent: *\nDisallow: /ozel/\nAllow: /ozel/acik/\nDisallow: /esit\nAllow: /esit\n# yorum\nDisallow:\n');
  assert.equal(robotsIzinli(r, 'x', '/ozel/gizli'), false);
  assert.equal(robotsIzinli(r, 'x', '/ozel/acik/sayfa'), true);
  assert.equal(robotsIzinli(r, 'x', '/esit'), true);
  assert.equal(robotsIzinli(robotsOku(''), 'x', '/her/sey'), true);
});
