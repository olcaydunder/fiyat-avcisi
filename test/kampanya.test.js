import test from 'node:test';
import assert from 'node:assert/strict';
import { indirimHesapla, kampanyaOzeti } from '../src/kampanya.js';

test('puan, taksit ve reklam metinleri fiyatı değiştirmez', () => {
  assert.equal(indirimHesapla('Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan', 51699.06), null);
  assert.equal(indirimHesapla('Peşin fiyatına 9 taksit', 6860), null);
  assert.equal(indirimHesapla("Hepsiburada'da Efsane Cuma İndirimlerini Kaçırma", 53703.02), null);
  assert.equal(indirimHesapla("Şahane Kasım'a Özel 2 Kat Club Puan", 6999), null);
});

test('sepet indirimi: yüzde, tutar ve son fiyat', () => {
  assert.deepEqual(indirimHesapla('Sepette %10 indirim', 1000), { fiyat: 900, kosullu: false });
  assert.deepEqual(indirimHesapla('Sepette ek %5 indirim fırsatı', 2000), { fiyat: 1900, kosullu: false });
  assert.deepEqual(indirimHesapla('Sepette 250 TL indirim', 5000), { fiyat: 4750, kosullu: false });
  assert.deepEqual(indirimHesapla('Sepette 48.999,00 TL', 51000), { fiyat: 48999, kosullu: false });
  assert.equal(indirimHesapla('Sepette 500 TL', 51000), null); // ne olduğu belirsiz: hesaba katma
});

test('kupon: tutar, yüzde, alt sınır ve kuponlu son fiyat', () => {
  assert.deepEqual(indirimHesapla('150 TL kupon fırsatı', 1000), { fiyat: 850, kosullu: true });
  assert.deepEqual(indirimHesapla('Kuponla %20 indirim', 500), { fiyat: 400, kosullu: true });
  assert.deepEqual(indirimHesapla('1.000 TL ve üzeri alışverişe 100 TL kupon', 1500), { fiyat: 1400, kosullu: true });
  assert.equal(indirimHesapla('1.000 TL ve üzeri alışverişe 100 TL kupon', 800), null);
  assert.deepEqual(indirimHesapla('Kuponla 1.249 TL', 1400), { fiyat: 1249, kosullu: true });
});

test('akıl dışı indirimler yok sayılır', () => {
  assert.equal(indirimHesapla('Sepette %99 indirim', 1000), null);
  assert.equal(indirimHesapla('5.000 TL kupon', 1000), null);
  assert.equal(indirimHesapla('', 1000), null);
  assert.equal(indirimHesapla('Sepette %10 indirim', 0), null);
});

test('kampanyaOzeti notları ayıklar ve en iyi tahmini seçer', () => {
  const k = kampanyaOzeti({ fiyat: 1000, slogan: "Aradığın ne varsa Trendyol'da", kampanyalar: [{ type: 'Installment', text: 'Peşin fiyatına 6 taksit' }, { type: 'Discount', text: 'Sepette %10 indirim' }, null] });
  assert.deepEqual(k.notlar, [{ tur: 'taksit', metin: 'Peşin fiyatına 6 taksit' }, { tur: 'sepet', metin: 'Sepette %10 indirim' }]);
  assert.deepEqual(k.tahmini, { fiyat: 900, not: 'Sepette %10 indirim', kosullu: false });

  const yok = kampanyaOzeti({ fiyat: 51091.54, slogan: 'Alışılmadık Alışveriş', kampanyalar: [] });
  assert.deepEqual(yok, { notlar: [], tahmini: null });

  const puan = kampanyaOzeti({ fiyat: 51699.06, slogan: 'Maximum ile 3.000 TL ve Üzeri Alışverişe 350 TL Pazaramapuan' });
  assert.equal(puan.notlar[0].tur, 'puan');
  assert.equal(puan.tahmini, null);

  const kart = kampanyaOzeti({ fiyat: 1000, rozetFiyat: 950 });
  assert.deepEqual(kart.tahmini, { fiyat: 950, not: 'Kart kampanyası', kosullu: true });
});
