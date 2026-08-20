# Day 1 서버 배포 런북 (72시간 출시 계획 §2 실행판)

작성일: 2026-08-20 · 선행: PR #3 머지 완료(1697e6c). 이 런북의 배포 자산: `infra/docker/api.Dockerfile`, `fly.toml`, `infra/docker/docker-compose.prod.yml`

두 경로 중 하나를 고르세요. **추천은 A(Fly.io)** — 카드 등록만으로 1시간 내 가동, 도쿄 리전.

---

## A. Fly.io 경로 (추천)

### A-1. 준비 (5분)
```bash
curl -L https://fly.io/install.sh | sh     # flyctl 설치
fly auth signup                             # 또는 fly auth login (카드 등록 필요)
```

### A-2. Postgres 생성 (5분)
```bash
fly postgres create --name wooriai-db --region nrt --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 3
# 출력되는 접속 문자열은 보관하지 않아도 됨 — 아래 attach가 DATABASE_URL을 자동 주입
```

### A-3. 앱 생성·시크릿 (10분)
저장소 루트에서:
```bash
fly launch --no-deploy --copy-config --name <원하는-앱이름>   # fly.toml 사용, 앱 이름만 본인 것으로
fly postgres attach wooriai-db                                 # DATABASE_URL 시크릿 자동 설정

# 시크릿 생성·주입 (한 줄씩)
fly secrets set \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  WOORIAI_ADMIN_TOKEN="$(openssl rand -base64 32)" \
  AFFILIATE_CLICK_IP_SALT="$(openssl rand -base64 32)" \
  ANALYTICS_ANON_SALT="$(openssl rand -base64 32)" \
  AFFILIATE_ALLOWED_DOMAINS="coupang.com,link.coupang.com,naver.com,smartstore.naver.com" \
  AFFILIATE_DISCLOSURE_TEXT="이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다." \
  OAUTH_KAKAO_CLIENT_ID="<카카오 REST API 키>" \
  OAUTH_KAKAO_CLIENT_SECRET="<카카오 Client Secret>" \
  OAUTH_KAKAO_REDIRECT_URIS="wooriai://oauth/kakao" \
  INVITE_LINK_BASE_URL="https://<확정 도메인>" \
  ADMIN_SEED_EMAIL="<운영 관리자 이메일>" \
  ADMIN_SEED_PASSWORD="$(openssl rand -base64 24)"
```
`ADMIN_SEED_PASSWORD` 출력값을 임시 보관하세요(A-5에서 로그인 후 즉시 교체).

### A-4. 배포 (10~15분)
```bash
fly deploy          # 이미지 빌드 → release_command(prisma:deploy, 마이그레이션 10개) → 기동
fly status          # 머신 1대 started 확인
curl -s https://<앱이름>.fly.dev/api/v1/health/ready   # {"status":"ok"...} 확인
```

### A-5. 시드·관리자 부트스트랩 (10분)
```bash
fly ssh console -C "pnpm --filter api seed"   # 카테고리 12·준비템 86·상품링크 58 + ADMIN_SEED_* 관리자
```
어드민 콘솔 접속 → `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` 로그인 → **즉시 비밀번호 변경**(ADM-007) → MFA(TOTP) 등록(강제 흐름).
필요하면 /users에서 팀원 계정 발급.

### A-6. 도메인 연결 (선택이지만 권장, 15분)
```bash
fly certs add api.<확정 도메인>       # 출력되는 CNAME/A 레코드를 DNS에 등록
```
이후 모바일 빌드의 `EXPO_PUBLIC_API_BASE_URL=https://api.<도메인>/api/v1`.
도메인 준비 전에는 `https://<앱이름>.fly.dev/api/v1`로 진행해도 됩니다.

---

## B. 셀프호스트 경로 (자체 VM, docker compose)

```bash
cp .env.example .env.production            # 실값 채우기: JWT/salt 4종(openssl rand), 카카오 2종,
                                           # AFFILIATE 2종, INVITE_LINK_BASE_URL, ADMIN_SEED_*,
                                           # POSTGRES_PASSWORD 추가
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f infra/docker/docker-compose.prod.yml exec api pnpm --filter api seed
```
HTTPS는 앞단에 Caddy/nginx + certbot을 두세요(80/443 → api:3000).

---

## C. 배포 직후 스모크 테스트 (공통, 10분)

```bash
BASE=https://<호스트>/api/v1
curl -s $BASE/health          # ok
curl -s $BASE/health/ready    # DB 연결 포함 ok
# 카카오 OIDC prepare가 실키로 동작하는지 (redirectUri는 등록값과 동일해야 함)
curl -s -X POST $BASE/auth/kakao/prepare -H 'content-type: application/json' \
  -d '{"redirectUri":"wooriai://oauth/kakao"}'   # state/nonce/transactionId 반환 확인
# 미인증 제휴 리다이렉트 (시드 링크가 example.com이라 404가 정상 — allowlist 차단 확인)
curl -si $BASE/../r/AAAAAAAAAAAA | head -1
```
어드민: 로그인→MFA→준비템/링크 목록 로드 확인. 링크 헬스체크를 켤 거면 `LINK_HEALTH_ENABLED=1` 시크릿 추가(실링크 투입 후 권장).

## D. 체크리스트 요약

- [ ] Postgres 가동·마이그레이션 10개 적용
- [ ] 시크릿 13종 주입 (부트 필수 6종 — JWT 2·WOORIAI_ADMIN_TOKEN·AFFILIATE_ALLOWED_DOMAINS·salt 2 — 은 `assertRequiredSecretsConfigured`가 누락 시 부트 실패로 알려줌)
- [ ] `health/ready` 200
- [ ] 시드 + 관리자 로그인 → 비밀번호 교체 + MFA 등록
- [ ] (도메인 있으면) HTTPS 커스텀 도메인 + `INVITE_LINK_BASE_URL` 일치
- [ ] 카카오 콘솔에 `wooriai://oauth/kakao` redirect 등록 (서버 allowlist와 동일 값)

## E. 주의

- `WORKER_ENABLED=1`은 **머신 1대일 때만**. 수평 확장 시 워커 전용 머신 1대에만 켜세요(중복 실행 방지).
- Dockerfile은 이 저장소의 tsx 구동 방식에 맞춘 것으로, 로컬 검증 환경에 Docker 데몬이 없어 **이미지 빌드는 `fly deploy` 시점에 처음 검증됩니다** — 빌드 오류가 나면 로그를 그대로 전달해 주세요.
- 시드의 상품링크 58개는 example.com 플레이스홀더 — 출시 전 admin CSV 도구로 교체(72h 계획 §5).
