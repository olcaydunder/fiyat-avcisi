#!/usr/bin/env bash
# Fiyat Avcısı — tek satırlık sunucu kurulumu (Ubuntu / Debian)
# Kullanım:  curl -fsSL https://raw.githubusercontent.com/olcaydunder/fiyat-avcisi/main/kur.sh | bash
#
# Sunucuda başka bir uygulama (ör. Herkes Piste) Caddy ile çalışıyorsa ona dokunmaz:
# Caddy ayarına yalnızca kendi adresini ekler, başka web sunucusunu durdurmaz.
# Yeniden çalıştırmak güvenlidir; giriş kodu ve veriler korunur.
set -euo pipefail

DEPO="${FIYAT_DEPO:-https://github.com/olcaydunder/fiyat-avcisi.git}"
DAL="${FIYAT_DAL:-main}"
DIZIN="/opt/fiyat-avcisi"
SERVIS="fiyat-avcisi"
CADDY_DOSYA="/etc/caddy/Caddyfile"
export DEBIAN_FRONTEND=noninteractive
umask 022 # servis ayrı bir kullanıcıyla çalışır; kod dosyaları herkesçe okunabilir olmalı

if [ "$(id -u)" -ne 0 ]; then echo "Bu kurulum root olarak çalışmalı (sudo -i)."; exit 1; fi
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
dur() { printf '\n\033[1;31mKurulum durdu: %s\033[0m\n' "$*"; exit 1; }

say "Paketler hazırlanıyor"
apt-get update -y -qq
apt-get install -y -qq curl git ca-certificates iproute2 >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  say "Node.js 22 kuruluyor"
  apt-get install -y -qq gnupg >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

port_dinleniyor() { ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"; }

# Caddy yoksa ve 80/443'ü başka bir web sunucusu tutuyorsa hiçbir şeye dokunmadan dur
if ! command -v caddy >/dev/null 2>&1; then
  if port_dinleniyor 80 || port_dinleniyor 443; then
    dur "Bu sunucuda 80/443 portlarını başka bir web sunucusu kullanıyor ve Caddy kurulu değil. Çalışan sitelere zarar vermemek için kurulum yapılmadı. Fiyat Avcısı'nı Herkes Piste'nin çalıştığı sunucuya kur."
  fi
  say "Caddy (HTTPS) kuruluyor"
  apt-get install -y -qq gnupg debian-keyring debian-archive-keyring apt-transport-https >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y -qq
  apt-get install -y -qq caddy >/dev/null
  # Paketle gelen örnek karşılama sayfası 80'i tutmasın
  if grep -q '^:80' "$CADDY_DOSYA" 2>/dev/null && ! grep -q 'reverse_proxy' "$CADDY_DOSYA"; then : > "$CADDY_DOSYA"; fi
fi

say "Uygulama indiriliyor"
if [ -d "$DIZIN/.git" ]; then
  git -C "$DIZIN" fetch -q origin "$DAL"
  git -C "$DIZIN" checkout -q "$DAL" 2>/dev/null || git -C "$DIZIN" checkout -q -b "$DAL" "origin/$DAL"
  git -C "$DIZIN" reset -q --hard "origin/$DAL"
else
  git clone -q --branch "$DAL" "$DEPO" "$DIZIN"
fi
cd "$DIZIN"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error

# ---------------------------------------------------------------- ayarlar
ENV="$DIZIN/.env"
oku() { [ -f "$ENV" ] && sed -n "s/^$1=//p" "$ENV" | head -n1 || true; }

PORT="$(oku PORT)"
if [ -z "$PORT" ]; then
  PORT=3100
  while port_dinleniyor "$PORT"; do PORT=$((PORT + 1)); [ "$PORT" -gt 3150 ] && dur "3100-3150 arasında boş port bulunamadı."; done
fi

KOD="$(oku GIRIS_KODU)"
if [ -z "$KOD" ]; then KOD="$(node -e "console.log(require('node:crypto').randomInt(100000, 1000000))")"; fi

ALAN="${FIYAT_ALAN:-$(oku ALAN)}"
if [ -z "$ALAN" ]; then
  IP="$(curl -4 -fsS --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')"
  [ -n "$IP" ] || dur "Sunucunun IP adresi bulunamadı."
  ALAN="fiyat.$(echo "$IP" | tr '.' '-').sslip.io"
fi

# Elle eklenmiş başka ayar satırları varsa korunur
DIGER=""
if [ -f "$ENV" ]; then DIGER="$(grep -vE '^(PORT|ALAN|GIRIS_KODU)=' "$ENV" || true)"; fi
umask 077
{
  printf 'PORT=%s\nALAN=%s\nGIRIS_KODU=%s\n' "$PORT" "$ALAN" "$KOD"
  if [ -n "$DIGER" ]; then printf '%s\n' "$DIGER"; fi
} > "$ENV.yeni"
mv "$ENV.yeni" "$ENV"
chmod 600 "$ENV"
umask 022

# ---------------------------------------------------------------- servis
say "Servis kuruluyor"
cat > "/etc/systemd/system/$SERVIS.service" <<EOF
[Unit]
Description=Fiyat Avcısı (fiyat arama ve takip)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIZIN
EnvironmentFile=$ENV
ExecStart=/usr/bin/env node server.js
Restart=always
RestartSec=3
DynamicUser=yes
StateDirectory=$SERVIS
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
MemoryMax=400M

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/$SERVIS-guncelle.service" <<EOF
[Unit]
Description=Fiyat Avcısı GitHub'dan güncelleme

[Service]
Type=oneshot
ExecStart=/bin/bash $DIZIN/guncelle.sh
EOF

cat > "/etc/systemd/system/$SERVIS-guncelle.timer" <<EOF
[Unit]
Description=Fiyat Avcısı'nı 2 dakikada bir güncelle

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable "$SERVIS.service" >/dev/null 2>&1
systemctl restart "$SERVIS.service"
systemctl enable --now "$SERVIS-guncelle.timer" >/dev/null 2>&1

# ---------------------------------------------------------------- HTTPS adresi
say "HTTPS adresi ayarlanıyor"
bash "$DIZIN/guncelle.sh" --caddy || dur "Caddy ayarı doğrulanamadı; var olan ayar olduğu gibi bırakıldı. 'journalctl -u caddy -n 30' ile bakılabilir."

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

DURUM="başlatılıyor"
for _ in 1 2 3 4 5 6 7 8; do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/saglik" >/dev/null 2>&1; then DURUM="çalışıyor"; break; fi
  sleep 1
done

printf '\n\033[1;32m================================================================\033[0m\n'
printf '\033[1;32m  HAZIR! Fiyat Avcısı %s\033[0m\n' "$DURUM"
printf '  Telefonda aç  : https://%s/#kod=%s\n' "$ALAN" "$KOD"
printf '  Giriş kodu    : %s\n' "$KOD"
printf '  (İlk açılışta HTTPS sertifikasının alınması bir dakika sürebilir.)\n'
printf '\033[1;32m================================================================\033[0m\n\n'
