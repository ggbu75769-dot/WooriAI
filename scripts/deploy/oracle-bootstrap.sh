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
# 재실행해도 안전(멱등)하도록 작성했습니다. 시드는 기존 관리자 계정의 비밀번호/활성
# 상태를 절대 되돌리지 않으며(ADM-007), 첫 시드 성공 후 ADMIN_SEED_PASSWORD 평문은
# .env.production에서 자동 제거(주석 처리)됩니다. 생성된 관리자 임시 비밀번호는
# 마지막에 1회 출력됩니다.
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-ggbu75769-dot/WooriAI}"
APP_DIR="${APP_DIR:-/opt/wooriai}"
ENV_FILE="$APP_DIR/.env.production"
COMPOSE_FILE="infra/docker/docker-compose.prod.yml"
CADDY_FILE="infra/docker/docker-compose.caddy.yml"
DUCKDNS_CONF_DIR="/etc/wooriai"
DUCKDNS_CURLCONF="$DUCKDNS_CONF_DIR/duckdns.curlconf"
DUCKDNS_HELPER="/usr/local/sbin/wooriai-duckdns-update"

log() { echo -e "\n[wooriai] $*"; }

[ "$(id -u)" = "0" ] || { echo "sudo로 실행하세요"; exit 1; }

# ── 0. 도메인 결정 + 입력 검증 (상태 변경 전에 검사) ───────────
if [ -n "${DUCKDNS_SUBDOMAIN:-}" ]; then
  [ -n "${DUCKDNS_TOKEN:-}" ] || { echo "DUCKDNS_TOKEN이 필요합니다"; exit 1; }
  [[ "$DUCKDNS_SUBDOMAIN" =~ ^[A-Za-z0-9-]+$ ]] \
    || { echo "DUCKDNS_SUBDOMAIN 형식이 올바르지 않습니다 (영문·숫자·하이픈만 허용): ${DUCKDNS_SUBDOMAIN}"; exit 1; }
  DOMAIN="${DUCKDNS_SUBDOMAIN}.duckdns.org"
fi
[ -n "${DOMAIN:-}" ] || { echo "DOMAIN 또는 DUCKDNS_SUBDOMAIN/DUCKDNS_TOKEN을 지정하세요 (HTTPS 필수 — 앱이 cleartext 차단)"; exit 1; }
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] \
  || { echo "DOMAIN 형식이 올바르지 않습니다 (영문·숫자·점·하이픈만 허용): ${DOMAIN}"; exit 1; }

# ── 1. 패키지: docker, compose, git ────────────────────────────
log "docker/git 설치"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git jq >/dev/null
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null

# caddy 오버레이의 `ports: !reset` 문법은 Compose v2.24 이상이 필요하다.
# (우분투 apt 기본 저장소의 docker-compose-plugin은 이보다 오래된 버전일 수 있음)
compose_version_ok() {
  local v major minor
  v="$(docker compose version --short 2>/dev/null || true)"
  v="${v#v}"
  major="${v%%.*}"
  minor="${v#*.}"; minor="${minor%%.*}"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || return 1
  [ "$major" -gt 2 ] && return 0
  [ "$major" -eq 2 ] && [ "$minor" -ge 24 ] && return 0
  return 1
}
if ! compose_version_ok; then
  log "docker compose 버전이 2.24 미만이거나 확인 불가 — get.docker.com 경로로 업그레이드"
  curl -fsSL https://get.docker.com | sh
fi
if ! compose_version_ok; then
  echo "[wooriai] docker compose 버전이 여전히 2.24 미만입니다 (현재: $(docker compose version --short 2>/dev/null || echo '확인 불가'))."
  echo "[wooriai] caddy 오버레이(docker-compose.caddy.yml)의 'ports: !reset' 문법은 Compose v2.24+가 필요합니다."
  echo "[wooriai] docker 공식 apt 저장소(https://docs.docker.com/engine/install/ubuntu/)에서 docker-compose-plugin을 수동 업그레이드한 뒤 이 스크립트를 다시 실행하세요."
  exit 1
fi

# ── 2. 방화벽: Oracle 우분투 이미지는 OS iptables도 막혀 있음 ──
log "포트 80/443 개방 (OS iptables — Oracle 콘솔 Security List의 80/443 인그레스도 별도로 열어야 함)"
for p in 80 443; do
  # 규칙이 4개 미만인 체인에서는 위치 5 삽입이 실패하므로 맨 앞(1) 삽입으로 폴백
  iptables -C INPUT -m state --state NEW -p tcp --dport "$p" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -m state --state NEW -p tcp --dport "$p" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -m state --state NEW -p tcp --dport "$p" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then netfilter-persistent save || true; fi

# ── 3. DuckDNS: 현재 공인 IP 등록 + 갱신 크론 ──────────────────
# 토큰이 argv(/proc에서 노출)나 월드리더블 크론 파일에 남지 않도록:
#   - 갱신 URL은 root 전용(600) curl 설정 파일에만 저장
#   - 크론/최초 등록 모두 root 전용(700) 헬퍼 스크립트를 통해 실행
if [ -n "${DUCKDNS_SUBDOMAIN:-}" ]; then
  log "DuckDNS ${DOMAIN} → 이 VM IP 등록"
  install -d -m 700 "$DUCKDNS_CONF_DIR"
  cat > "$DUCKDNS_CURLCONF" <<EOF
url = "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip="
EOF
  chmod 600 "$DUCKDNS_CURLCONF"
  cat > "$DUCKDNS_HELPER" <<EOF
#!/usr/bin/env bash
# 우리아이 DuckDNS IP 갱신 헬퍼 — 토큰은 ${DUCKDNS_CURLCONF}(600)에만 존재
set -euo pipefail
exec curl -fsS -K "${DUCKDNS_CURLCONF}"
EOF
  chmod 700 "$DUCKDNS_HELPER"
  "$DUCKDNS_HELPER" | grep -q OK \
    || { echo "DuckDNS 등록 실패 — 서브도메인/토큰 확인"; exit 1; }
  cat > /etc/cron.d/duckdns <<EOF
*/10 * * * * root ${DUCKDNS_HELPER} >/dev/null 2>&1
EOF
fi

# ── 4. 저장소 클론/갱신 ────────────────────────────────────────
# GITHUB_TOKEN은 URL/origin에 절대 넣지 않는다(디스크·argv·오류 출력에 토큰이 남는
# 것 방지). 클론과 풀 모두 extraheader(Authorization: basic base64(x-access-token:TOKEN))
# 로 인증하고, origin은 항상 토큰 없는 URL을 유지한다.
log "저장소 준비: $REPO_SLUG → $APP_DIR"
GIT_AUTH=()
if [ -n "${GITHUB_TOKEN:-}" ]; then
  GIT_AUTH=(-c "http.https://github.com/.extraheader=AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)")
fi
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" "${GIT_AUTH[@]}" pull --ff-only
else
  git "${GIT_AUTH[@]}" clone "https://github.com/${REPO_SLUG}.git" "$APP_DIR"
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
TRUST_PROXY=1
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
# 시드는 기존 관리자 계정의 비밀번호/활성 상태를 절대 덮어쓰지 않는다(ADM-007).
log "시드 실행"
docker compose -f "$COMPOSE_FILE" -f "$CADDY_FILE" --env-file "$ENV_FILE" exec -T api pnpm --filter api seed

# 첫 시드 성공 후에는 평문 관리자 초기 비밀번호를 디스크에 남기지 않는다:
# ADMIN_SEED_PASSWORD 줄을 주석 마커로 치환 (시드가 기존 계정을 건드리지 않으므로
# 이후 재실행에 이 값은 더 이상 필요 없음).
if grep -q '^ADMIN_SEED_PASSWORD=' "$ENV_FILE"; then
  sed -i 's/^ADMIN_SEED_PASSWORD=.*/# ADMIN_SEED_PASSWORD= (첫 시드 완료 후 평문 제거됨 — 재시드해도 기존 계정 비밀번호는 바뀌지 않음)/' "$ENV_FILE"
  log "ADMIN_SEED_PASSWORD 평문을 .env.production에서 제거(주석 처리)했습니다."
  echo "[wooriai] 비밀번호를 분실했다면: 어드민의 다른 관리자 계정으로 재발급하거나, DB에서 해당 admin_users 행 삭제 후 ADMIN_SEED_PASSWORD를 새로 설정하고 시드를 재실행하세요."
fi

# ── 9. 결과 출력 (헬스체크보다 먼저 — 실패해도 비밀번호는 반드시 출력) ──
log "완료 ✅  API: https://${DOMAIN}/api/v1"
if [ -n "${ADMIN_SEED_PASSWORD_GEN}" ]; then
  echo "[wooriai] 관리자 초기 계정 (지금 로그인해서 즉시 비밀번호 변경 + MFA 등록하세요):"
  echo "[wooriai]   email:    $(grep '^ADMIN_SEED_EMAIL=' "$ENV_FILE" | cut -d= -f2)"
  echo "[wooriai]   password: ${ADMIN_SEED_PASSWORD_GEN}   ← 이 출력 외에는 다시 볼 수 없음 (.env.production에서도 제거됨)"
fi

# ── 10. 헬스체크 (실패해도 중단하지 않음 — Security List/인증서 발급 지연 가능) ──
log "헬스체크"
HEALTH_OK=0
for _ in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/v1/health/ready" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
  sleep 5
done
if [ "$HEALTH_OK" = "1" ]; then
  curl -fsS "https://${DOMAIN}/api/v1/health/ready" && echo
  log "헬스체크 성공"
else
  log "경고: https://${DOMAIN}/api/v1/health/ready 가 아직 응답하지 않습니다 (배포 자체는 완료)."
  echo "[wooriai] 흔한 원인: ① Oracle 콘솔 VCN Security List에 TCP 80/443 인그레스 미개방 ② Let's Encrypt 인증서 발급 지연(수 분)."
  echo "[wooriai] 잠시 후 직접 확인: curl -fsS https://${DOMAIN}/api/v1/health/ready"
  echo "[wooriai] 로그 확인: cd ${APP_DIR} && sudo docker compose -f ${COMPOSE_FILE} -f ${CADDY_FILE} --env-file .env.production logs --tail 100 caddy api"
  echo "[wooriai] 이 스크립트는 멱등이므로 원인 해결 후 같은 명령으로 재실행해도 안전합니다."
fi
