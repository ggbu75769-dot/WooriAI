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

> **푸시 알림(PUSH-113, 선택)**: FCM 실발송을 켜려면 `PUSH_ENABLED=1`과 `FCM_SERVICE_ACCOUNT_PATH=<Firebase 서비스 계정 JSON 경로>` 두 값이 추가로 필요합니다(.env.example 참고). 미설정 시 push 모듈은 안전한 no-op — **출시 비차단**. 단 `FCM_SERVICE_ACCOUNT_PATH`는 "파일 경로"라서 Fly에서는 secret 문자열만으로는 안 되고 JSON 파일을 머신에 넣어야 합니다(JSON 내용·private key를 로그/코드에 넣지 말 것 — DNC-019). 켠 뒤에는 `GET /api/v1/health/push`로 상태 확인.

### A-4. 배포 (10~15분)
```bash
fly deploy          # 이미지 빌드 → release_command(prisma:deploy = 미적용분 전부) → 기동
fly status          # 머신 1대 started 확인
curl -s https://<앱이름>.fly.dev/api/v1/health/ready   # {"status":"ok"...} 확인
```

⚠️ **마이그레이션 개수는 이 런북이 세지 않는다**(라운드 106 F5 정정). `release_command`는
`pnpm --filter api prisma:deploy` = `prisma migrate deploy`이고, 그 명령은 **`_prisma_migrations`에
없는 것을 전부** 적용할 뿐 개수를 인자로 받지 않는다. 네 배포 경로가 전부 같은 명령이다 —
`fly.toml`의 `release_command`(경로 A) · `infra/docker/docker-compose.prod.yml`의 `migrate`
서비스(경로 B, `api`가 그 완료에 의존) · `.github/workflows/ci.yml`의 PR 검증 · 로컬 게이트가
쓰는 `apps/api/test/global-setup.ts`. 그래서 **적용 개수가 아니라 적용 여부를 확인한다**:

```bash
fly ssh console -C "pnpm --filter api exec prisma migrate status"   # "up to date"면 통과
```

⚠️ **두 시점(낡은 값을 지우지 않고 남긴다)**: 이 자리는 2026-08-21(라운드 13, DOC-114)까지
"마이그레이션 **13개**"라고 적었고 **그때는 참이었다**(당시 `apps/api/prisma/migrations/`가
`000001`~`000013`). 오늘(2026-09-07) 그 디렉터리는 `000001`~`000025`로 **25개**다. 손으로 적은
수는 마이그레이션을 더할 때마다 낡으므로 다시 적지 않는다 — **개수의 단일 소스는
`apps/api/prisma/migrations/` 디렉터리 자신**이고, 배포가 묻는 것은 그 수가 아니라 위
`migrate status`의 답이다.

### A-5. 시드·관리자 부트스트랩 (10분)
```bash
fly ssh console -C "pnpm --filter api seed"   # 카테고리 12·준비템 62·상품링크 67 + ADMIN_SEED_* 관리자
```
상품링크 수는 손으로 적지 않는다(근거: `grep -c '^    url:' apps/api/prisma/seed-data.ts` → **67**건 ·
전부 실 쿠팡 검색 링크 — 근거: `grep -c 'url: "https://www.coupang.com/np/search' apps/api/prisma/seed-data.ts` → **67**건 ·
example.com URL 잔존 근거: `grep -c 'https://example.com' apps/api/prisma/seed-data.ts` → **0**곳 ·
제휴 URL은 쿠팡 파트너스 승인 전이라 근거: `grep -c 'affiliateUrl: "https' apps/api/prisma/seed-data.ts` → **0**건).
세 시점: 라운드 82 B 이후 **62건 / 81곳** → 라운드 83 A 이후 **67건 / 86곳**(전부 example.com
플레이스홀더) → 출시 트랙 LP-A(72h 계획 §5 **플랜 B**)가 86곳 전부를 비제휴 쿠팡 검색 링크로
교체(활성 62 + 비활성 스폰서 슬롯 5 · 제휴/스폰서 표시 0건 · 플랜 A 전환은 아래 E절).
어드민 콘솔 접속은 운영자 로컬 프록시가 기본 경로다(어드민 웹은 서버에 배포되지 않음 — LP-D, 상세는 `docs/operations/admin-access.md` §운영 접근 경로):
```bash
ADMIN_API_PROXY_TARGET=https://<API 도메인> pnpm --filter admin dev   # → http://localhost:3001
```
접속 → `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` 로그인 → **즉시 비밀번호 변경**(ADM-007) → MFA(TOTP) 등록(강제 흐름).
필요하면 /users에서 팀원 계정 발급.

> 참고: 시드는 멱등이며 관리자 자격증명은 **생성 시 1회만** 적용됩니다 — 시드를 재실행해도 기존 계정의 비밀번호(교체한 값)나 활성 상태는 절대 되돌아가지 않습니다. 비밀번호 교체 후에는 `ADMIN_SEED_PASSWORD` 시크릿을 폐기해도 됩니다.

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
리버스 프록시(Caddy/nginx) 뒤에서는 `.env.production`에 `TRUST_PROXY=1`을 반드시 넣으세요 — 없으면 모든 요청이 프록시 IP로 집계되어 per-IP rate limit이 전역 버킷 하나로 무력화됩니다(프록시 없이 직접 노출 시에는 설정하지 마세요).
시드는 재실행해도 기존 관리자 계정의 비밀번호/활성 상태를 덮어쓰지 않습니다(생성 시 1회만, ADM-007).

---

## C. 배포 직후 스모크 테스트 (공통, 10분)

```bash
BASE=https://<호스트>/api/v1
curl -s $BASE/health          # ok
curl -s $BASE/health/ready    # DB 연결 포함 ok
curl -s $BASE/health/worker   # 워커 상태 (enabled/stale/jobs)
curl -s $BASE/health/push     # 푸시 상태 — FCM 키 미주입이면 enabled=false가 정상

# 카카오 OIDC prepare가 실키로 동작하는지 (redirectUri는 등록값과 동일해야 함)
curl -s -X POST $BASE/auth/kakao/prepare -H 'content-type: application/json' \
  -d '{"redirectUri":"wooriai://oauth/kakao"}'   # state/nonce/transactionId 반환 확인
# 미인증 제휴 리다이렉트 (임의 코드라 404가 정상 — 미존재 코드/차단 도메인이 같은 404인지 확인.
# 실코드 확인은 admin 링크 목록의 redirectCode로: 시드 링크는 쿠팡 검색 URL이라 302가 정상)
curl -si $BASE/../r/AAAAAAAAAAAA | head -1
```
⚠️ **전체 스모크는 프로덕션 서버에서 돌지 않는다**(라운드 106 F5 정정). `scripts/qa/server-smoke.sh`는
**dev 모드 서버 전용**이다 — 그 스크립트의 1번 검사가 `POST /auth/oauth-login`인데, 그 엔드포인트는
`NODE_ENV`가 정확히 `development`/`test`가 아니면 **항상 501**(`OAUTH_LOGIN_NOT_IMPLEMENTED`,
`apps/api/src/auth/auth.service.ts`의 `isDevOrTestEnv()` 가드)이다. 프로덕션은 `NODE_ENV=production`
(`fly.toml [env]` · compose)이므로 토큰이 비고, 그 뒤의 검사가 전부 인증 없이 돌아 **연쇄 FAIL**한다.

- **dev 모드 서버**(로컬·스테이징)에서만: `SMOKE_BASE_URL=$BASE bash scripts/qa/server-smoke.sh`
  (근거: `grep -c '^chk ' scripts/qa/server-smoke.sh` → **37**검사). 테스트 사용자·지출 데이터를
  실제로 만드므로 대상 DB를 감안하세요.
- **프로덕션 배포 직후에 실제로 돌릴 수 있는 것은 위 `curl` 묶음이 전부다** — health 4종 + 카카오
  OIDC prepare + 리다이렉트 404. 그 너머(기록→총액→준비템 루프)는 **실계정 로그인이 필요하므로
  ⚠️ 앱에서 손으로 확인**한다(카카오 실키·실기기가 필요한 대목이라 자동화 밖이다).

⚠️ **두 시점**: 이 줄은 종전에 "단, 테스트 사용자·지출 데이터를 실제로 생성하므로 실서버에서는
감안하고 실행하세요"라고만 적어 **"돌긴 돈다"를 전제**했다. 검사 수(37)는 그때도 오늘도 참이지만,
그 37이 프로덕션에서 전부 FAIL한다는 사실이 빠져 있었다. `docs/5차/launch-readiness-status.md`의
"실서버 스모크 37/37"도 같은 이유로 **dev 모드 서버에 대한 사실**이다.
어드민: 로그인→MFA→준비템/링크 목록 로드 확인 (admin 역할이면 **감사 로그** 메뉴도 로드 확인). 링크 헬스체크를 켤 거면 `LINK_HEALTH_ENABLED=1` 시크릿 추가(실링크 투입 후 권장).

## D. 체크리스트 요약

- [ ] Postgres 가동 + **마이그레이션 적용 여부 확인** — `prisma migrate status`가 "up to date"인가
      (A-4 참고). ⚠️ **개수를 세지 않는다**: 종전 이 칸은 "마이그레이션 **13개** 적용"이라 적었고
      2026-08-21(라운드 13)에는 참이었으나 오늘은 25개다. 네 배포 경로 전부가 개수를 받지 않는
      `prisma migrate deploy`이므로, 이 칸이 묻는 것은 **`release_command`가 조용히 실패하지
      않았는가** 하나다(개수를 맞춰 세는 절차가 아니다).
- [ ] 시크릿 13종 주입 (부트 필수 6종 — JWT 2·WOORIAI_ADMIN_TOKEN·AFFILIATE_ALLOWED_DOMAINS·salt 2 — 은 `assertRequiredSecretsConfigured`가 누락 시 부트 실패로 알려줌)
- [ ] (푸시를 켤 경우) `PUSH_ENABLED=1` + `FCM_SERVICE_ACCOUNT_PATH` 설정 → `GET /api/v1/health/push`로 확인 (A-3의 푸시 참고 — 기본은 꺼짐/no-op이라 출시 비차단)
- [ ] `health/ready` 200
- [ ] 시드 + 관리자 로그인 → 비밀번호 교체 + MFA 등록
- [ ] (도메인 있으면) HTTPS 커스텀 도메인 + `INVITE_LINK_BASE_URL` 일치
  - `INVITE_LINK_BASE_URL`은 **부트 필수 6종에 들어 있지 않다** — 미설정이어도 서버는 그냥 뜨고, 대신 그 값에서 나오는 **공유 URL 소비자 셋**이 조용히 `https://wooriai.local`로 발급된다: ⓐ 가족 초대 링크(`household-runtime.service.ts`), ⓑ 어드민이 복사해 뿌리는 공개 공유 URL, ⓒ 앱이 밖으로 내보내는 구매 링크(`items-catalog.service.ts`의 `publicRedirectShareUrl` — 라운드 67 #4). 셋 다 **받는 사람 쪽에서만** 죽은 링크로 드러나므로 배포 스모크에서는 보이지 않는다. `pnpm check:env`가 REQUIRED로 잡고 있으니 배포 전에 한 번 돌려 확인하세요 — 단 **아래 ⚠️의 조건**을 먼저 읽으세요.
- [ ] 카카오 콘솔에 `wooriai://oauth/kakao` redirect 등록 (서버 allowlist와 동일 값)

## E. 주의

- `WORKER_ENABLED=1`은 **머신 1대일 때만**. 수평 확장 시 워커 전용 머신 1대에만 켜세요(중복 실행 방지).
- `TRUST_PROXY=1`은 `fly.toml [env]`에 이미 포함(Fly 엣지 프록시 1홉 뒤 실 클라이언트 IP 인식 — per-IP rate limit 필수 조건). 셀프호스트(B)도 리버스 프록시 뒤라면 동일하게 설정하세요.
- Dockerfile은 이 저장소의 tsx 구동 방식에 맞춘 것으로, 로컬 검증 환경에 Docker 데몬이 없어 **이미지 빌드는 `fly deploy` 시점에 처음 검증됩니다** — 빌드 오류가 나면 로그를 그대로 전달해 주세요.
- 시드의 상품링크 **67개**(수를 세는 자리는 위 A-5의 실행되는 인용이다)는 출시 트랙 LP-A(**플랜 B**, 72h 계획 §5)가 전부 **일반(비제휴) 쿠팡 검색 링크**로 교체했다 — 계정·키 없이 동작하는 실 링크라 죽은 CTA(리뷰 M-7 · 확인의 표 `#140` ⓕ / `#143` ⓖ)는 이 시점에 해소됐고, 제휴 고지·스폰서 배지는 비제휴 실태에 맞게 0건이다(스폰서 예시 다섯은 비활성 슬롯로 보존).
  ⚠️ 역사(교체 전): 라운드 82 B 이후 58 → 62 · 라운드 83 A 이후 62 → 67, 전부 example.com 플레이스홀더 = 죽은 CTA였다 — 그중 둘(`pregnancy_vitamin`·`diaper_stock`)은 `essential`이라 홈 추천 카드의 머리에 섰다.
  **플랜 A 전환**(쿠팡 파트너스 승인 후): `docs/5차/plan-a-affiliate-links-template.csv`의 `affiliateUrl` 칸을 파트너스 딥링크로 채워 admin 링크 페이지의 CSV 일괄 교체(미리보기 → 적용)에 업로드하면 무중단 전환된다(도구가 `isAffiliate=true`와 제휴 고지를 함께 세운다 · 도메인 allowlist 검증 자동).
  ⚠️ 시드 upsert 키(itemTemplateId·platform·title)가 교체로 바뀌었으므로 **기존 dev/test DB는 재시드 대신 `pnpm db reset`**(옛 example.com 행이 남는 것 방지). 운영 신규 DB는 해당 없음.
