# CLAUDE.md — 우리아이 (WooriAI)

임신~첫돌 지출 관리 + 시기별 준비물 커머스 앱. pnpm workspace 모노레포(apps/api·mobile·admin, packages/*).

핵심 루프: **지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크** — 이 루프를 흐리는 변경 금지.

## 절대 규칙

- `docs/dev/do-not-change.md`(DNC 계약) 준수. 충돌 시 임의 변경 대신 변경 요청을 문서화.
- 허위 데이터 표시 금지: 추천 점수에 수수료율 반영 금지(DNC-009), 제휴 고지 문구 숨김 금지(DNC-010), 스폰서 구분 표시(DNC-011).
- 테스트 그린 유지. **api 테스트는 실 PostgreSQL 필요** — 먼저 `pnpm db status`로 확인하고 필요하면 `pnpm db start`를 사용한다. Docker 또는 `PGBIN`의 포터블 PostgreSQL을 사용하는 플랫폼 공통 명령이다. 테스트 DB 연결·초기화는 `apps/api/test/global-setup.ts`를 확인하고 운영 DB를 지정하지 않는다.

## 테스트 명령

- `pnpm --filter api test` / `--filter mobile test` / `--filter admin test` (전체 `pnpm test`)
- 릴리즈 게이트: `pnpm release:gate` (현재 단계·순서는 구현이 기준). 같은 소스·입력·환경의 실행을 중복 시작하지 않는다.
- 스모크: `bash scripts/qa/server-smoke.sh` (dev 서버 기동 후), 어드민 E2E: `node scripts/qa/admin-e2e.mjs`

## DB / 시드

- `pnpm db status|start|migrate|seed` (Docker 또는 포터블 PG — `PGBIN` 환경변수, `scripts/db.ts` 참고). `reset`·`restore`는 데이터를 바꾸므로 대상과 승인 범위를 확인한다.
- dev DB: `wooriai_dev` (`postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev`)

## 커밋 컨벤션

한국어 커밋 메시지 + `type(scope): 설명 (티켓ID)` 관례. 예: `fix(mobile): 접근성 소소 2건 (A11Y-101 후속)`.

## 주의점

- `android/`는 gitignore — `expo prebuild`로 생성되며 config plugin(`apps/mobile/plugins/with-wooriai-android-release.js`)이 릴리즈 패치를 자동 적용. 손패치 금지.
- 로컬 `release:gate`와 GitHub CI는 각각 현재 실행 결과를 확인한다. 과거 러너 장애를 현재 검사 생략의 근거로 쓰지 않는다. 지시·문서만 바꾼 작업은 관련 문서 계약·경로·diff를 검사하고 앱을 재배포하지 않는다.
- API base path `/api/v1` 고정. 계약 타입은 `packages/contracts`가 수기 단일 소스(`contracts:generate`는 스텁 — 실제로 아무것도 생성하지 않음).
