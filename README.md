# 우리아이 (WooriAI)

임신부터 첫돌까지, 아이 관련 지출을 기록·관리하고 시기별 준비물을 확인해 구매까지 잇는 육아 지출 관리 + 커머스 내비게이션 앱.

제품의 핵심 루프: **지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크**. 이 루프를 흐리는 변경은 하지 않습니다(→ [Do Not Change 계약](docs/dev/do-not-change.md)).

## 모노레포 구조

pnpm workspace + turbo 기반 모노레포입니다.

| 경로 | 내용 |
| --- | --- |
| `apps/api` | NestJS + Prisma(PostgreSQL) API 서버. base path `/api/v1` |
| `apps/mobile` | Expo(React Native) 앱. expo-router, TanStack Query + Zustand |
| `apps/admin` | Next.js 어드민 콘솔 (기본 포트 3001) |
| `packages/contracts` | OpenAPI 기반 DTO/타입 계약 (`pnpm contracts:generate`) |
| `packages/domain` | 공유 도메인 로직 |
| `packages/config`, `packages/ui`, `packages/test-utils` | 공통 설정 / UI / 테스트 유틸 |
| `scripts/` | DB 운영(`db.ts`), 릴리즈 게이트, QA, 픽셀 락, 배포 스크립트 |
| `infra/` | docker compose·Dockerfile(`infra/docker/`), 법무 정적 페이지(`infra/legal/`), 지원 사이트(`infra/site/`) |
| `docs/` | 기획(1~4차)·라운드5(5차)·QA·스토어·운영 문서. 아래 [문서 지도](#문서-지도) 참고 |

## 빠른 시작

```bash
pnpm install

# 1) PostgreSQL 준비 — docker compose 또는 포터블 PG 자동 감지
#    (Docker가 없으면 PGBIN 환경변수 또는 .toolcache/pg16 사용, scripts/db.ts 주석 참고)
pnpm db start
pnpm db migrate   # prisma migrate deploy
pnpm db seed      # 시드 데이터

# 2) API 데브 서버 (기본 포트 3000, PORT로 변경 가능)
DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev \
  pnpm --filter api start:dev

# 3) 모바일 (Expo) — 백엔드 없이 데모를 보려면 EXPO_PUBLIC_TEST_LOGIN=1
pnpm --filter mobile start
EXPO_PUBLIC_TEST_LOGIN=1 pnpm --filter mobile start   # 데모(테스트 로그인) 모드

# 4) 어드민 (Next.js, 포트 3001) — API 프록시 대상 지정
ADMIN_API_PROXY_TARGET=http://localhost:3000 pnpm --filter admin dev
```

환경변수 점검: `pnpm check:env` (루트 `.env.example` 참고).

## 테스트

- 패키지별: `pnpm --filter api test`, `pnpm --filter mobile test`, `pnpm --filter admin test` 등 (전체: `pnpm test`)
- **api 테스트는 실 PostgreSQL 필수** — 기본 DB는 `wooriai_test` (vitest globalSetup이 연결 확인·마이그레이션·시드까지 수행, `DATABASE_URL`로 덮어쓰기 가능)
- 릴리즈 게이트(설치→env→prisma→lint→typecheck→테스트→빌드 일괄): `pnpm release:gate` — evidence는 `docs/qa/evidence/`에 기록
- 실서버 스모크(31검사 — 근거: `grep -c '^chk ' scripts/qa/server-smoke.sh`): dev 서버 기동 후 `SMOKE_BASE_URL=<베이스> bash scripts/qa/server-smoke.sh` (기본 `http://localhost:3400/api/v1`, `jq` 필요)
- 어드민 브라우저 E2E: `node scripts/qa/admin-e2e.mjs` — 전제조건: API(3400)·어드민(3100) dev 서버 기동, 시드된 dev 어드민 계정(`admin@wooriai.local`), playwright-core + Chromium (자세한 전제는 스크립트 상단 주석)

## 배포

- Oracle Cloud Free Tier: [docs/5차/oracle-free-deploy-runbook.md](docs/5차/oracle-free-deploy-runbook.md) (부트스트랩: `scripts/deploy/oracle-bootstrap.sh`)
- Day 1 배포(Fly.io 등): [docs/5차/day1-deploy-runbook.md](docs/5차/day1-deploy-runbook.md)
- 루트 `fly.toml` + `infra/docker/api.Dockerfile`, 운영 compose는 `infra/docker/docker-compose.prod.yml`
- 정적 지원 사이트(랜딩·FAQ·지원/법무 페이지) Cloudflare Pages 배포: [infra/site/README.md](infra/site/README.md)
- 운영 헬스 엔드포인트: `GET /api/v1/health/ready`(DB 포함), `/health/worker`(워커 잡 상태), `/health/push`(FCM 푸시 상태 — `PUSH_ENABLED`/`FCM_SERVICE_ACCOUNT_PATH` 미주입 시 `enabled=false` no-op)

## 문서 지도

- **설계/기능 리뷰**: [docs/5차/round5b-feature-review-and-sellable-design.md](docs/5차/round5b-feature-review-and-sellable-design.md)
- **출시**: [docs/5차/launch-72h-plan.md](docs/5차/launch-72h-plan.md), [docs/5차/launch-readiness-status.md](docs/5차/launch-readiness-status.md)
- **스토어 제출**: [docs/store/](docs/store/) (Play 리스팅, 데이터 안전, 제출 체크리스트)
- **핵심 원칙(필독)**: [docs/dev/do-not-change.md](docs/dev/do-not-change.md) — DNC-001~ 계약. 소스 락은 [docs/dev/source-lock.md](docs/dev/source-lock.md)
- **QA/운영**: [docs/qa/](docs/qa/), [docs/operations/](docs/operations/)
- 기획 원본은 `docs/0_원본아이디어` ~ `docs/4차`에 단계별로 보존

## 구현 원칙

- 기능 구현 전 `docs/dev/do-not-change.md` 계약을 확인하고, 충돌 시 임의 변경 대신 변경 요청을 문서화합니다.
- API 계약은 `/api/v1` + OpenAPI 기반 타입 생성(`pnpm contracts:generate`)을 유지합니다.
- 과거 Codex 실행 패키지 시절의 이력 문서는 `codex/`에 보존되어 있습니다(현행 작업 기준 아님).
