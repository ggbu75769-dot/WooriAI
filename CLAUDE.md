# CLAUDE.md — 우리아이 (WooriAI)

임신~첫돌 지출 관리 + 시기별 준비물 커머스 앱. pnpm workspace 모노레포(apps/api·mobile·admin, packages/*).

핵심 루프: **지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크** — 이 루프를 흐리는 변경 금지.

## 절대 규칙

- `docs/dev/do-not-change.md`(DNC 계약) 준수. 충돌 시 임의 변경 대신 변경 요청을 문서화.
- 허위 데이터 표시 금지: 추천 점수에 수수료율 반영 금지(DNC-009), 제휴 고지 문구 숨김 금지(DNC-010), 스폰서 구분 표시(DNC-011).
- 테스트 그린 유지. **api 테스트는 실 PostgreSQL 필요** — 이 환경에서는 `service postgresql start` 후 `wooriai_test` DB 사용(vitest globalSetup이 기본 URL 주입·마이그레이션·시드 수행).

## 테스트 명령

- `pnpm --filter api test` / `--filter mobile test` / `--filter admin test` (전체 `pnpm test`)
- 릴리즈 게이트: `pnpm release:gate` (install→env→prisma→lint→typecheck→test→build)
- 스모크: `bash scripts/qa/server-smoke.sh` (dev 서버 기동 후), 어드민 E2E: `node scripts/qa/admin-e2e.mjs`

## DB / 시드

- `pnpm db start|migrate|seed|reset` (docker 또는 포터블 PG — PGBIN 환경변수, `scripts/db.ts` 참고)
- dev DB: `wooriai_dev` (`postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev`)

## 커밋 컨벤션

한국어 커밋 메시지 + `type(scope): 설명 (티켓ID)` 관례. 예: `fix(mobile): 접근성 소소 2건 (A11Y-101 후속)`.

## 주의점

- `android/`는 gitignore — `expo prebuild`로 생성되며 config plugin(`apps/mobile/plugins/with-wooriai-android-release.js`)이 릴리즈 패치를 자동 적용. 손패치 금지.
- GitHub Actions 러너 문제로 **로컬 검증(release:gate)이 기준** (docs/5차/launch-72h-plan.md 참고).
- API base path `/api/v1` 고정, 타입은 `pnpm contracts:generate`로 생성.
