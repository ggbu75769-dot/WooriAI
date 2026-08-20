#!/usr/bin/env bash
# 우리아이 API — Oracle Cloud Always Free VM 원샷 부트스트랩 (REL-010)
# 사용법(우분투 22.04/24.04 VM에서, 자세한 절차: docs/5차/oracle-free-deploy-runbook.md):
#
#   sudo GITHUB_TOKEN=<repo 읽기 PAT> \
#        DUCKDNS_SUBDOMAIN=<원하는이름> DUCKDNS_TOKEN=<duckdns 토큰> \
#        bash oracle-bootstrap.sh
#
#   - GITHUB_TOKEN: 비공개 저장소 클론용 (repo read 권한 fine-grained PAT)
#   - 도메인 둘 중 하나:
#       DUCKDNS_SUBDOMAIN + DUCKDNS_TOKEN  → <이름>.duckdns.org 무료 도메인 + 자동 HTTPS
#       DOMAIN=<보유 도메인>               → 해당 도메인으로 HTTPS (DNS A레코드를 VM IP로 미리 지정)
#   - 카카오 키는 나중에 넣어도 부팅됩니다: /opt/wooriai/.env.production 수정 후
#       docker compose ... up -d api 로 재기동 (런북 §5)
#
# 재실행해도 안전(멱등)하도록 작성했습니다. 생성된 관리자 임시 비밀번호는 마지막에 1회 출력됩니다.
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-ggbu75769-dot/WooriAI}"
APP_DIR="${APP_DIR:-/opt/wooriai}"
ENV_FILE="$APP_DIR/.env.production"
COMPOSE_FILE="infra/docker/docker-compose.prod.yml"
CADDY_FILE="infra/docker/docker-compose.caddy.yml"

log() { echo -e "\n[wooriai] $*"; }

[ "$(id -u)" = "0" ] || { echo "sudo로 실행하세요"; exit 1; }

# ── 0. 도메인 결정 ─────────────────────────────────────────────
if [ -n "${DUCKDNS_SUBDOMAIN:-}" ]; then
  [ -n "${DUCKDNS_TOKEN:-}" ] || { echo "DUCKDNS_TOKEN이 필요합니다"; exit 1; }
  DOMAIN="${DUCKDNS_SUBDOMAIN}.duckdns.org"
fi
[ -n "${DOMAIN:-}" ] || { echo "DOMAIN 또는 DUCKDNS_SUBDOMAIN/DUCKDNS_TOKEN을 지정하세요 (HTTPS 필수 — 앱이 cleartext 차단)"; exit 1; }

# ── 1. 패키지: docker, compose, git ────────────────────────────
log "docker/git 설치"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git jq >/dev/null
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null

# ── 2. 방화벽: Oracle 우분투 이미지는 OS iptables도 막혀 있음 ──
log "포트 80/443 개방 (OS iptables — Oracle 콘솔 Security List의 80/443 인그레스도 별도로 열어야 함)"
for p in 80 443; do
  iptables -C INPUT -m state --state NEW -p tcp --dport "$p" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -m state --state NEW -p tcp --dport "$p" -j ACCEPT
done
command -v netfilter-persistent >/dev/null && netfilter-persistent save || true

# ── 3. DuckDNS: 현재 공인 IP 등록 + 갱신 크론 ──────────────────
if [ -n "${DUCKDNS_SUBDOMAIN:-}" ]; then
  log "DuckDNS ${DOMAIN} → 이 VM IP 등록"
  curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" | grep -q OK \
    || { echo "DuckDNS 등록 실패 — 서브도메인/토큰 확인"; exit 1; }
  cat > /etc/cron.d/duckdns <<EOF
*/10 * * * * root curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" >/dev/null 2>&1
EOF
fi

# ── 4. 저장소 클론/갱신 ────────────────────────────────────────
log "저장소 준비: $REPO_SLUG → $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git" "$APP_DIR"
    git -C "$APP_DIR" remote set-url origin "https://github.com/${REPO_SLUG}.git"  # 토큰을 디스크에 남기지 않음
  else
    git clone "https://github.com/${REPO_SLUG}.git" "$APP_DIR"
  fi
fi
cd "$APP_DIR"

# ── 5. .env.production 생성 (있으면 보존) ──────────────────────
if [ ! -f "$ENV_FILE" ]; then
  log ".env.production 생성 (시크릿 자동 생성)"
  ADMIN_SEED_PASSWORD_GEN="$(openssl rand -base64 18)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
WOORIAI_ADMIN_TOKEN=$(openssl rand -base64 32)
AFFILIATE_CLICK_IP_SALT=$(openssl rand -base64 32)
ANALYTICS_ANON_SALT=$(openssl rand -base64 32)
AFFILIATE_ALLOWED_DOMAINS=coupang.com,link.coupang.com,naver.com,smartstore.naver.com
AFFILIATE_DISCLOSURE_TEXT=이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
INVITE_LINK_BASE_URL=https://${DOMAIN}
WORKER_ENABLED=1
ADMIN_SEED_EMAIL=${ADMIN_SEED_EMAIL:-admin@${DOMAIN}}
ADMIN_SEED_PASSWORD=${ADMIN_SEED_PASSWORD_GEN}
# 카카오 실연동 시 채우고 api 재기동 (docs/5차/day1-deploy-runbook.md):
#OAUTH_KAKAO_CLIENT_ID=
#OAUTH_KAKAO_CLIENT_SECRET=
#OAUTH_KAKAO_REDIRECT_URIS=wooriai://oauth/kakao
EOF
  chmod 600 "$ENV_FILE"
else
  log ".env.production 기존 파일 유지"
  ADMIN_SEED_PASSWORD_GEN=""
fi

# ── 6. Caddy(HTTPS) Caddyfile ──────────────────────────────────
mkdir -p infra/docker/caddy
cat > infra/docker/caddy/Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy api:3000
    encode gzip
}
EOF

# ── 7. 기동: postgres → migrate → api → caddy ─────────────────
log "빌드·기동 (첫 빌드는 수 분 소요)"
docker compose -f "$COMPOSE_FILE" -f "$CADDY_FILE" --env-file "$ENV_FILE" up -d --build

# ── 8. 시드 (카테고리·준비템·관리자) — 멱등 upsert ─────────────
log "시드 실행"
docker compose -f "$COMPOSE_FILE" -f "$CADDY_FILE" --env-file "$ENV_FILE" exec -T api pnpm --filter api seed

# ── 9. 헬스체크 ────────────────────────────────────────────────
log "헬스체크"
for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/v1/health/ready" >/dev/null 2>&1; then break; fi
  sleep 5
done
curl -fsS "https://${DOMAIN}/api/v1/health/ready" && echo

log "완료 ✅  API: https://${DOMAIN}/api/v1"
if [ -n "${ADMIN_SEED_PASSWORD_GEN}" ]; then
  echo "[wooriai] 관리자 초기 계정 (지금 로그인해서 즉시 비밀번호 변경 + MFA 등록하세요):"
  echo "[wooriai]   email:    $(grep '^ADMIN_SEED_EMAIL=' "$ENV_FILE" | cut -d= -f2)"
  echo "[wooriai]   password: ${ADMIN_SEED_PASSWORD_GEN}   ← 이 출력 외에는 다시 볼 수 없음"
fi
