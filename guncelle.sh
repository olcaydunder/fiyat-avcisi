#!/usr/bin/env bash
# GitHub'daki son sürümü çeker; değişiklik varsa kurup servisi yeniden başlatır.
# Caddy ayarındaki adres satırı silinmişse (ör. başka bir kurulum Caddyfile'ı baştan yazdıysa) geri ekler.
# "--caddy" ile çağrılırsa yalnızca Caddy ayarını yapar ve doğrulama başarısızsa hata koduyla çıkar.
set -euo pipefail
umask 022

DIZIN="/opt/fiyat-avcisi"
SERVIS="fiyat-avcisi"
CADDY_DOSYA="/etc/caddy/Caddyfile"
CADDY_EK="/etc/caddy/fiyat-avcisi.caddy"
ENV="$DIZIN/.env"

caddy_ayarla() {
  command -v caddy >/dev/null 2>&1 || return 0
  [ -f "$ENV" ] || return 0
  local port alan icerik yedek
  port="$(sed -n 's/^PORT=//p' "$ENV" | head -n1)"
  alan="$(sed -n 's/^ALAN=//p' "$ENV" | head -n1)"
  [ -n "$port" ] && [ -n "$alan" ] || return 0

  icerik="$(printf '%s {\n\tencode gzip\n\treverse_proxy 127.0.0.1:%s\n}\n' "$alan" "$port")"
  local degisti=0
  if [ ! -f "$CADDY_EK" ] || [ "$(cat "$CADDY_EK")" != "$icerik" ]; then
    printf '%s\n' "$icerik" > "$CADDY_EK"
    degisti=1
  fi
  touch "$CADDY_DOSYA"
  if ! grep -qF "import $CADDY_EK" "$CADDY_DOSYA"; then
    yedek="$CADDY_DOSYA.fiyat-avcisi-yedek"
    cp -p "$CADDY_DOSYA" "$yedek"
    printf '\nimport %s\n' "$CADDY_EK" >> "$CADDY_DOSYA"
    if ! caddy validate --config "$CADDY_DOSYA" --adapter caddyfile >/dev/null 2>&1; then
      cp -p "$yedek" "$CADDY_DOSYA" # çalışan ayarı bozma
      echo "Caddy ayarı doğrulanamadı; eski ayar geri yüklendi."
      return 1
    fi
    degisti=1
  fi
  if [ "$degisti" -eq 1 ]; then
    systemctl enable caddy >/dev/null 2>&1 || true
    if systemctl is-active --quiet caddy; then systemctl reload caddy; else systemctl restart caddy; fi
    echo "Caddy ayarı güncellendi: https://$alan"
  fi
}

if [ "${1:-}" = "--caddy" ]; then
  caddy_ayarla
  exit $?
fi

cd "$DIZIN"
DAL="$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin "$DAL"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$DAL")" ]; then
  git reset -q --hard "origin/$DAL"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
  systemctl restart "$SERVIS.service"
  echo "Güncellendi: $(git rev-parse --short HEAD)"
fi

caddy_ayarla || true
