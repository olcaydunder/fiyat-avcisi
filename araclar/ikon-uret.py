#!/usr/bin/env python3
"""Uygulama simgelerini üretir: lacivert zemin üzerinde sarı raf etiketi ve TL işareti.

Kullanım: python3 araclar/ikon-uret.py
Çıktılar public/ikon/ ve android/app/src/main/res/ altına yazılır.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LACIVERT = (15, 32, 68, 255)
SARI = (255, 214, 10, 255)
YAZI_TIPI = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def etiket(boyut, olcek=1.0, zemin=LACIVERT, etiket_rengi=SARI, isaret_rengi=LACIVERT):
    """boyut x boyut kare simge. olcek: etiketin kareye oranı (maskeli simgede küçültülür)."""
    b = boyut * 4  # kenar yumuşatma için 4 kat büyük çiz
    kare = Image.new('RGBA', (b, b), zemin)
    kat = Image.new('RGBA', (b, b), (0, 0, 0, 0))
    c = ImageDraw.Draw(kat)
    g = b * 0.62 * olcek   # etiket genişliği
    y = b * 0.46 * olcek   # etiket yüksekliği
    x0, y0 = (b - g) / 2, (b - y) / 2
    x1, y1 = x0 + g, y0 + y
    kes = y * 0.30         # kırpılmış sol köşeler
    r = y * 0.10
    # gövde: sol tarafı sivrilen etiket
    c.polygon([(x0 + kes, y0), (x1 - r, y0), (x1, y0 + r), (x1, y1 - r), (x1 - r, y1), (x0 + kes, y1), (x0, y1 - kes), (x0, y0 + kes)], fill=etiket_rengi)
    c.pieslice([x1 - 2 * r, y0, x1, y0 + 2 * r], 270, 360, fill=etiket_rengi)
    c.pieslice([x1 - 2 * r, y1 - 2 * r, x1, y1], 0, 90, fill=etiket_rengi)
    # ip deliği
    d = y * 0.085
    dx, dy = x0 + kes * 0.95, (y0 + y1) / 2
    c.ellipse([dx - d, dy - d, dx + d, dy + d], fill=zemin if zemin[3] else (0, 0, 0, 0))
    # TL işareti
    yazi = ImageFont.truetype(YAZI_TIPI, int(y * 0.80))
    kutu = c.textbbox((0, 0), '₺', font=yazi)
    yw, yh = kutu[2] - kutu[0], kutu[3] - kutu[1]
    mx = x0 + kes + (g - kes) / 2 + y * 0.02
    c.text((mx - yw / 2 - kutu[0], (y0 + y1) / 2 - yh / 2 - kutu[1]), '₺', font=yazi, fill=isaret_rengi)
    kat = kat.rotate(14, resample=Image.BICUBIC, center=(b / 2, b / 2))
    kare.alpha_composite(kat)
    return kare.resize((boyut, boyut), Image.LANCZOS)


def yuvarlak_kose(resim, oran=0.22):
    b = resim.size[0] * 4
    maske = Image.new('L', (b, b), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, b - 1, b - 1], radius=int(b * oran), fill=255)
    maske = maske.resize(resim.size, Image.LANCZOS)
    sonuc = Image.new('RGBA', resim.size, (0, 0, 0, 0))
    sonuc.paste(resim, (0, 0), maske)
    return sonuc


def yaz(resim, *parcalar):
    yol = os.path.join(KOK, *parcalar)
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    resim.save(yol, optimize=True)
    print(os.path.relpath(yol, KOK), resim.size)


def main():
    yaz(etiket(192), 'public', 'ikon', 'ikon-192.png')
    yaz(etiket(512), 'public', 'ikon', 'ikon-512.png')
    yaz(etiket(512, olcek=0.80), 'public', 'ikon', 'maske-512.png')   # güvenli alan içinde
    yaz(etiket(180), 'public', 'ikon', 'apple-180.png')               # iOS köşeleri kendi yuvarlar
    yaz(yuvarlak_kose(etiket(64)), 'public', 'ikon', 'favicon-64.png')
    # Bildirim rozeti: Android yalnızca saydamlık kanalını kullanır (tek renk)
    rozet = etiket(96, olcek=1.35, zemin=(0, 0, 0, 0), etiket_rengi=(255, 255, 255, 255), isaret_rengi=(0, 0, 0, 0))
    yaz(rozet, 'public', 'ikon', 'rozet-96.png')

    # Android başlatıcı simgeleri
    res = ('android', 'app', 'src', 'main', 'res')
    for ad, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        yaz(yuvarlak_kose(etiket(px), 0.5), *res, f'mipmap-{ad}', 'ic_launcher.png')
    # Uyarlanabilir simgenin ön katmanı: 108dp tuval, etiket ortadaki güvenli alanda, zemin saydam
    for ad, px in (('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)):
        yaz(etiket(px, olcek=0.80, zemin=(0, 0, 0, 0)), *res, f'mipmap-{ad}', 'ic_launcher_on.png')
    for ad, px in (('mdpi', 24), ('hdpi', 36), ('xhdpi', 48), ('xxhdpi', 72), ('xxxhdpi', 96)):
        yaz(etiket(px, olcek=1.35, zemin=(0, 0, 0, 0), etiket_rengi=(255, 255, 255, 255), isaret_rengi=(0, 0, 0, 0)), *res, f'drawable-{ad}', 'ic_notification_icon.png')
    for ad, px in (('mdpi', 300), ('hdpi', 450), ('xhdpi', 600), ('xxhdpi', 900), ('xxxhdpi', 1200)):
        yaz(etiket(px, olcek=0.70), *res, f'drawable-{ad}', 'splash.png')


if __name__ == '__main__':
    main()
