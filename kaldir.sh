#!/usr/bin/env bash
# Fiyat Avcısı'nı sunucudan kaldırır. Sunucudaki diğer uygulamalara ve Caddy'nin diğer adreslerine dokunmaz.
# Kullanım:  bash /opt/fiyat-avcisi/kaldir.sh          (takip listesi ve ayarlar sunucuda kalır)
#            bash /opt/fiyat-avcisi/kaldir.sh --veri   (veriler de silinir)
set -euo pipefail

SERVIS="fiyat-avcisi"
CADDY_DOSYA="/etc/caddy/Caddyfile"
CADDY_EK="/etc/caddy/fiyat-avcisi.caddy"

if [ "$(id -u)" -ne 0 ]; then echo "root olarak çalıştır (sudo -i)."; exit 1; fi

systemctl disable --now "$SERVIS-guncelle.timer" >/dev/null 2>&1 || true
systemctl disable --now "$SERVIS.service" >/dev/null 2>&1 || true
rm -f "/etc/systemd/system/$SERVIS.service" "/etc/systemd/system/$SERVIS-guncelle.service" "/etc/systemd/system/$SERVIS-guncelle.timer"
systemctl daemon-reload

if [ -f "$CADDY_DOSYA" ] && grep -qF "import $CADDY_EK" "$CADDY_DOSYA"; then
  grep -vF "import $CADDY_EK" "$CADDY_DOSYA" > "$CADDY_DOSYA.yeni" && mv "$CADDY_DOSYA.yeni" "$CADDY_DOSYA"
  rm -f "$CADDY_EK" "$CADDY_DOSYA.fiyat-avcisi-yedek"
  if command -v caddy >/dev/null 2>&1 && systemctl is-active --quiet caddy; then systemctl reload caddy || true; fi
fi

if [ "${1:-}" = "--veri" ]; then
  rm -rf /var/lib/private/fiyat-avcisi /var/lib/fiyat-avcisi
  echo "Veriler silindi."
fi

echo "Fiyat Avcısı kaldırıldı. Kod klasörü /opt/fiyat-avcisi yerinde; istersen 'rm -rf /opt/fiyat-avcisi' ile silebilirsin."
