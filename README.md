# Fiyat Avcısı

Ürün adını yazarsın; Türkiye'deki mağazaların fiyatlarını yan yana getirir, kargo dahil en ucuzunu en üste koyar. Takibe aldığın ürün ucuzlayınca telefonuna bildirim gönderir. Android'de APK olarak, iPhone'da ana ekrana eklenerek kullanılır.

Yapay zekâ ya da ücretli bir servis kullanmaz: çalışırken token ya da kontör harcamaz.

## Ne yapar

- **Arama**: mağaza fiyatlarını Akakçe'den (Trendyol, Hepsiburada, Amazon, n11, Pazarama, Teknosa, MediaMarkt, idefix ve yüzlerce mağaza), market raf fiyatlarını Market Fiyatı'ndan (TÜBİTAK; BİM, A101, ŞOK, Migros, CarrefourSA, Tarım Kredi, Hakmar) okur.
- **En ucuzu bulma**: sonuçları aramayla en ilgili kategoride toplar ("iphone 13" yazınca kılıflar değil telefonlar gelir), listenin başındaki ürünlerin tekliflerini mağaza mağaza doğrular ve kargo dahil toplam fiyata göre sıralar.
- **Kampanya ve kupon**: mağazanın yazdığı kampanya metinlerini (sepette indirim, kupon, puan, taksit) teklifin altında gösterir. Tutarı açıkça yazan sepet indirimi ve kuponlar için "bu kampanyayla yaklaşık şu kadar" hesabını ayrıca verir; sıralamayı yalnızca görünen fiyat belirler. Mağaza hesabına özel kuponlar (giriş yapınca görünenler) okunamaz.
- **Takip ve bildirim**: takipteki ürünlere düzenli aralıklarla bakar, fiyat geçmişi tutar. Bildirim gönderdiği durumlar:
  - fiyat, son bildirimden beri gördüğü en yüksek seviyeye göre ayarlanan yüzde kadar (varsayılan %3) düşünce,
  - belirlediğin hedef fiyatın altına inince,
  - hiç satan kalmamış ürün yeniden satışa çıkınca.
  Aynı fiyat seviyesi 6 saat içinde ikinci kez bildirilmez. Gece 23.00 ile 08.00 arasında bildirim gönderilmez; indirim sürüyorsa sabah ilk kontrolde haber verilir.
- **Başka sitelerde de bak**: aynı aramayı Trendyol, Hepsiburada, Amazon, n11, Cimri ve Google Alışveriş'te tek dokunuşla açar.

## Sunucu kurulumu (tek satır)

Ubuntu/Debian sunucuda root olarak:

```bash
curl -fsSL https://raw.githubusercontent.com/olcaydunder/fiyat-avcisi/main/kur.sh | bash
```

Kurulum Node.js'i ve (yoksa) Caddy'yi kurar, servisi başlatır ve sonunda telefonda açılacak bağlantıyı ve giriş kodunu yazar.

- Sunucuda Caddy ile çalışan başka bir uygulama varsa (ör. Herkes Piste) ona dokunmaz; Caddy ayarına yalnızca kendi adresini (`fiyat.<ip>.sslip.io`) ekler. Caddy yeniden yüklenirken diğer uygulamanın açık bağlantıları birkaç saniyeliğine kopup geri gelebilir.
- 80/443 portlarını Caddy dışında bir web sunucusu kullanıyorsa kurulum hiçbir şeye dokunmadan durur.
- Sunucu 2 dakikada bir bu depodan güncellemeleri çeker.
- Kaldırmak için: `bash /opt/fiyat-avcisi/kaldir.sh`

Ayarlar `/opt/fiyat-avcisi/.env` dosyasındadır: `PORT`, `ALAN` (adres), `GIRIS_KODU`. Kendi alan adını kullanmak için kurulumu `FIYAT_ALAN=fiyat.ornek.com` ile çalıştır.

## Telefona kurulum

Kurulumun yazdığı bağlantıyı (`https://…/#kod=…`) telefonda aç.

- **iPhone**: Safari'de Paylaş simgesine, sonra "Ana Ekrana Ekle"ye dokun. Uygulamayı ana ekrandaki simgeden aç ve Ayarlar'dan bildirimleri aç (iOS 16.4 ve üstü).
- **Android**: Ayarlar'daki "APK indir" ile kur ya da Chrome menüsünden "Uygulamayı yükle"ye dokun. Sonra Ayarlar'dan bildirimleri aç.

Giriş kodu her telefonda bir kez sorulur.

## Kaynaklara erişim kuralları

Uygulama kişisel kullanım için, sitelere yük bindirmeyecek biçimde yazıldı:

- Kendini açıkça tanıtır (`FiyatAvcisi` adıyla); tarayıcı taklidi yapmaz.
- Her sitenin `robots.txt` dosyasına uyar; yasak yolları hiç istemez.
- Aynı siteye istekleri sıraya dizer, aralarında bekler; arama sonuçlarını 10, ürün sayfalarını 5 dakika önbellekte tutar; günlük istek sınırı vardır.
- Site isteği geri çevirirse (403/429) o siteye bir süre hiç gitmez; engeli aşmaya çalışmaz, doğrulama ekranı çözmez.
- "Mağazaya git" bağlantıları Akakçe'nin kendi yönlendirme adresidir.

Akakçe ve Market Fiyatı'nın kullanım koşulları otomatik erişimi kısıtlayabilir. Uygulamayı başkalarına açmadan ya da ticari amaçla kullanmadan önce bu sitelerden izin almak gerekir.

Bu sunucudan kaynaklara erişilip erişilemediğini görmek için uygulamada Ayarlar > "Kaynakları dene", ya da sunucuda:

```bash
cd /opt/fiyat-avcisi && npm run tani -- "iphone 15"
```

## Geliştirme

```bash
npm install
npm test                  # birim ve uçtan uca testler (ağa çıkmaz)
node araclar/deneme.js    # örnek verilerle yerel deneme: http://127.0.0.1:3199/#kod=123456
npm start                 # gerçek sunucu (yerelde giriş kodunu konsola yazar)
```

Klasörler:

- `server.js` — HTTP sunucusu ve API
- `src/kaynaklar/` — Akakçe ve Market Fiyatı okuyucuları
- `src/getir.js`, `src/robots.js` — nazik erişim katmanı
- `src/arama.js`, `src/kampanya.js` — eşleştirme, kategori seçimi, kampanya okuma
- `src/takip.js`, `src/bildirim.js` — takip, bildirim kuralları, Web Push
- `public/` — telefon arayüzü (çerçevesiz, tek sayfa)
- `android/` — Android uygulaması (web uygulamasını tam ekran açan ince kabuk)
- `test/` — testler; Akakçe sayfa yapısının örnekleri `test/yardimci.js` içinde

Akakçe sayfa yapısını değiştirirse okuyucu sırayla üç yolu dener: sayfaya gömülü veri, JSON-LD, düz HTML. Üçü de boş dönerse Ayarlar > "Kaynakları dene" hangi adımın çalışmadığını gösterir.

## Android APK

`android/alan.txt` dosyasına sunucu adresi yazılınca GitHub Actions APK'yı derler ve deponun "apk" sürümüne yükler. İmza anahtarı deponun gizli değerlerinde (`APK_ANAHTAR_B64`, `APK_ANAHTAR_PAROLASI`) durur; parmak izi `android/parmak-izi.txt` içindedir ve sunucu bunu `/.well-known/assetlinks.json` adresinde yayınlar (uygulamanın adres çubuğu olmadan tam ekran açılması için).

Yazı tipi: Sofia Sans (SIL Open Font License), `public/fonts/` içinde.
