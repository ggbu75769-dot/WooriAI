# 라운드 106 정찰 S9 — 운영·배포 준비 감사

읽은 시점: **2026-09-07**, 라운드 106 정찰 세션. 다른 에이전트 20개가 동시 편집 중이므로 아래 모든
`파일:줄` 인용은 **그 시점의 파일 상태**다. 읽기 전용 감사 — 소스·설정을 하나도 고치지 않았다.

이 문서는 **판정과 근거만** 적는다. 고치는 것은 이 문서의 일이 아니다.

---

## 0. 먼저, 값으로 답할 수 있는 축 (실행되는 인용)

| 물음 | 오늘의 값 | 세는 명령 |
|---|---|---|
| 마이그레이션 수 | **25** (`000001`~`000025`) | `ls apps/api/prisma/migrations \| grep -c '^0'` |
| 릴리즈 게이트 단계 | **11** | `grep -c '    label: "' scripts/release-gate.ts` |
| CI 잡의 실행 스텝(체크아웃·툴셋 제외) | **9** | `.github/workflows/ci.yml:57~84` 눈으로 |
| `check-env.ts` REQUIRED / OPTIONAL | **22 / 41** | `awk '/^const REQUIRED_SPECS/,/^\];/' scripts/check-env.ts \| grep -c 'key: "'` (OPTIONAL도 동형) |
| `.env.example` 키 수 | **63** (= 22+41, 드리프트 0) | `grep -cE '^[A-Z0-9_]+=' .env.example` |
| `apps/api/src`가 실제로 읽는 env 이름 | **36** | 아래 §2 참조 |
| 서버 스모크 검사 수 | **37** | `grep -c '^chk ' scripts/qa/server-smoke.sh` |
| 시드 상품링크 / 쿠팡검색 / example.com / 제휴URL | **67 / 67 / 0 / 0** | `grep -c '^    url:' apps/api/prisma/seed-data.ts` 외 |

**축 1의 핵심 답을 먼저 적는다: 런북의 migrate 단계는 000024·000025를 자동으로 짊어진다.** 근거는
명령의 성질이다 — 네 경로 전부가 `prisma migrate deploy`(= "pending 전부")이지 특정 개수를 세지
않는다: `fly.toml:11`(`release_command`), `infra/docker/docker-compose.prod.yml:33~44`(`migrate`
서비스, `api`가 `service_completed_successfully`에 의존), `.github/workflows/ci.yml:63~64`,
`scripts/deploy/oracle-bootstrap.sh:183`(`up -d --build`이 migrate 서비스를 다시 돌린다).
로컬 게이트도 `apps/api/test/global-setup.ts:49`의 `deployMigrations()`로 같은 것을 적용한다.
`docs/5차/launch-readiness-status.md:29`의 각주가 같은 사실을 이미 적고 있고, 그 문장은 맞다.

**틀린 것은 개수를 손으로 적은 자리들이다** — 발견 9번.

---

## 1. 요약 표

| # | 한 줄 | 심각도 | 크기 |
|---|---|---|---|
| 1 | `pnpm db backup`은 `DATABASE_URL`을 **무시**하고 `pnpm db reset`은 **따른다** — 백업·복구 문서의 검증 절차를 운영 셸에서 그대로 따르면 dev를 백업하고 **운영을 지운다** | **P0** | 중 |
| 2 | 추천 배포 경로 A(Fly)에 백업·복구 절차가 **0건** — 자동 백업 크론·복구 부록은 경로 B(Oracle)에만 있다 | **P1** | 중(문서) |
| 3 | `server-smoke.sh` 37검사는 **프로덕션에서 1번 검사부터 501**이라 실서버에서 돌 수 없다 — 런북 §C는 "데이터가 생기니 감안하라"고만 적는다 | **P1** | 소(문서) |
| 4 | `pnpm check:env`는 **존재만** 증명한다 — `.env.example`을 복사하면 `wooriai.local`·`localhost`·`dev-admin-token`이 전부 통과한다. 런북은 이 명령을 그 이상으로 인용한다 | **P1** | 소~중 |
| 5 | check-env의 **소스 방향** 가드는 `EXPO_PUBLIC_*`만 훑는다 — 서버가 새로 읽는 env 키는 카탈로그·예시 파일 어디에도 없어도 아무도 모른다 | **P1** | 중 |
| 6 | REQUIRED 22 중 **8개**는 오늘 코드가 읽지 않거나 프로덕션에서 무력 — 그 결과 **런북대로 배포한 Fly 머신에서 `pnpm check:env`는 반드시 실패한다** | **P1** | 소(문서)/중(카탈로그) |
| 7 | **거짓 초록**: DB가 죽어 있어도 API는 부팅하고 `/health`는 200을 준다. `environment-setup.md:45`는 정확히 반대를 적는다 | **P2** | 소(문서)/중(코드) |
| 8 | **거짓 초록**: 워커의 `stale`·`degraded`는 **프로세스 단위** — 크래시 루프면 둘 다 영원히 false다. 런북 §3.2의 모니터 둘이 조용하다 | **P2** | 소(문서) |
| 9 | 런북의 숫자 드리프트: "마이그레이션 **13개**"(실제 25), `database-migrations.md`의 표는 `000002`에서 멈춰 있다 | **P1** | 소 |
| 10 | 롤백 안전지대가 없는 마이그레이션은 **000024 하나가 아니다** — 000007·000010·000018도 같은 성질이다. `rollback.md`는 "라운드 4 … additive 위주"에서 멈춰 있다 | **P1** | 중(문서) |
| 11 | `docker-compose.prod.yml`이 `api:3000`을 **0.0.0.0에 게시**한 채 `TRUST_PROXY=1`을 쓴다 — 프록시를 우회한 요청이 `X-Forwarded-For`를 위조해 per-IP 레이트리밋을 통째로 무력화한다. day1 §B가 caddy 오버레이 없이 안내한다 | **P2** | 소 |
| 12 | 게이트 ↔ CI 차집합: **게이트만 잡는 것은 `pnpm peers check`와 `prisma:validate` 둘뿐**이고, 오히려 **빈 DB 마이그레이션 순서 검증은 CI만** 한다 | **P2** | 소 |
| 13 | APK/AAB 워크플로는 **앱 코드가 바뀌어도 절대 돌지 않는다**(수동 + 워크플로 파일 push만) — config plugin 회귀의 그물은 순수함수 테스트 3종뿐이다 | **P2** | 소 |
| 14 | `release-runbook.md:116`의 "로그인 501 → 실 OAuth 연동 필요" 진단이 오늘 틀렸다 — 카카오 OIDC는 구현돼 있고, 실제 원인은 **빌드 플래그**다 | **P2** | 소 |
| 15 | config plugin이 **짊어지지 않는 패치 둘**: `googleServicesFile`과 `expo-notifications` — 푸시를 켜는 날 `app.json` 편집과 의존성 설치가 필요하다(설계된 사용자 몫) | P3 | 사용자 |
| 16 | `known-limitations.md:49`의 제휴 링크 실측이 스테일 — "example.com **86곳**"이라 적혀 있으나 실제는 **0곳** | P3 | 소 |

---

## 2. 발견 상세

### 1. `db backup`은 DATABASE_URL을 무시하고 `db reset`은 따른다 — 백업·복구 절차가 운영을 지울 수 있다 (P0)

**배포 시 무슨 일이 벌어지는가.**
`docs/operations/database-backup-restore.md:20~27`은 "릴리즈 전 **필수**" 검증 절차로 이 순서를 지시한다:
`pnpm db backup` → `pnpm db reset` → `pnpm db restore <파일>`. 운영자는 배포 작업 중이므로 셸에
운영 `DATABASE_URL`이 export돼 있을 가능성이 높다(day1 런북 A-2가 Fly attach로, B가 `.env.production`으로
그 값을 만들게 하고, `incident-response.md:30`은 사고 중에 `pnpm db status`를 부른다).

그 셸에서 저 세 줄은 **서로 다른 DB를 본다**:

- `backup`(`scripts/db.ts:232~260`)과 `restore`(`:262~291`)는 `DATABASE_URL`을 **한 번도 읽지 않는다**.
  `dbUser`/`dbPassword`/`dbName`이 파일 상단에 리터럴로 박혀 있고(`scripts/db.ts:26~28` —
  `wooriai` / `wooriai_dev_password` / `wooriai_dev`), docker 경로는 `compose exec postgres`,
  포터블 경로는 `localhost:5432`로 간다.
- `reset`(`scripts/db.ts:228~231`)은 `pnpmApi()`를 거치고, 그 함수는
  `DATABASE_URL: process.env.DATABASE_URL ?? <로컬 기본값>`(`scripts/db.ts:79~82`)로 **환경을 그대로
  물려준다**. Prisma는 `apps/api/prisma/schema.prisma:7`의 `url = env("DATABASE_URL")`을 따르므로
  `prisma migrate reset --force`가 **그 URL이 가리키는 DB**를 지운다.

즉 **2단계는 dev를 백업하고, 3단계는 운영을 지우고, 4단계는 dev에 복원한다.** 세 명령 모두 성공
종료하며, 어느 줄도 "무엇을 대상으로 하는지"를 출력하지 않는다(`backup`은 파일 경로만, `reset`은
Prisma의 출력만). `CLAUDE.md`가 "`reset`·`restore`는 데이터를 바꾸므로 대상과 승인 범위를 확인한다"고
경고하지만, **경고가 가리키는 위험은 "reset이 위험하다"이지 "backup과 reset이 서로 다른 DB를 본다"가
아니다.** 비대칭 자체가 어디에도 적혀 있지 않다.

**근거.** `scripts/db.ts:26~28`, `:79~82`, `:228~231`, `:232~260`, `:262~291`;
`apps/api/prisma/schema.prisma:5~8`; `docs/operations/database-backup-restore.md:20~27`;
`CLAUDE.md` "DB / 시드" 절.

**고치는 크기.** 중. 세 갈래가 있고 어느 쪽을 고를지는 설계 판단이다 — ⓐ `backup`/`restore`도
`DATABASE_URL`을 존중하게 만든다(그러면 셋이 같은 DB를 보지만, 운영을 지우는 `reset`의 위험은 그대로),
ⓑ `reset`이 `DATABASE_URL`이 로컬 dev가 **아니면** 거부한다(가장 좁고 안전), ⓒ 세 명령 모두 시작 시
대상 host/db를 한 줄 출력한다. ⓑ+ⓒ가 30줄 안쪽이고, 문서 §검증 절차에 "이 절차는 로컬 dev 전용"
한 줄이 따라야 한다.

**사람이 해야 하는 일인가.** 아니다 — 전부 저장소 안이다.

---

### 2. 추천 경로 A(Fly)에 백업·복구 절차가 0건 (P1)

**배포 시 무슨 일이 벌어지는가.** day1 런북은 "**추천은 A(Fly.io)**"(`docs/5차/day1-deploy-runbook.md:5`)로
시작한다. 그 A절(`:9~81`)과 D절 체크리스트(`:119~128`) 어디에도 백업이라는 단어가 없다. 반면 경로
B(자체 VM)는 `scripts/deploy/oracle-bootstrap.sh:199~247`이 일일 백업 스크립트와 크론을 **자동 등록**하고
(임시파일 → `gunzip -t` 무결성 → 최소 크기 → 원자적 `mv`, 실패 시 기존 백업 보존),
`docs/5차/oracle-free-deploy-runbook.md:69~106`이 드릴과 실서버 복구 절차를 부록으로 갖는다.
`scripts/qa/backup-restore-drill.sh`까지 있다.

그래서 **추천 경로를 고른 운영자는 백업 없이 출시한다.** `database-backup-restore.md:32`가 "운영 DB는
관리형 서비스의 자동 스냅샷"이라고 적지만, Fly Postgres의 스냅샷 정책·보존 기간·복원 명령은 어느
문서에도 없고, `pnpm db backup`은 발견 1번대로 Fly를 향할 수 없다. 사고 시
`incident-response.md:44~49`가 "백업 복원이 유일한 경로"라고 말하는데 그 백업이 존재하지 않는다.

**근거.** `docs/5차/day1-deploy-runbook.md:5`, `:9~81`, `:119~128`;
`scripts/deploy/oracle-bootstrap.sh:199~247`; `docs/5차/oracle-free-deploy-runbook.md:64`, `:69~106`;
`docs/operations/database-backup-restore.md:32`; `docs/operations/incident-response.md:44~49`.

**고치는 크기.** 중(문서). A절에 백업 소절을 더한다 — Fly 볼륨 스냅샷 확인 방법, `fly postgres`
덤프를 뽑는 한 줄, 그 파일을 로컬에서 검증하는 드릴 연결. 코드 변경은 필요 없다.

**사람이 해야 하는 일인가.** ⚠️ **일부는 그렇다** — 스냅샷 보존 기간 설정·오프사이트 보관 위치는
**Fly 계정 소유자만** 할 수 있다. 절차 문서화는 저장소 안이다.

---

### 3. 실서버 스모크 37검사는 프로덕션에서 첫 검사부터 죽는다 (P1)

**배포 시 무슨 일이 벌어지는가.** `docs/5차/day1-deploy-runbook.md:116`은 "전체 스모크(37검사)를
돌리려면: `SMOKE_BASE_URL=$BASE bash scripts/qa/server-smoke.sh` — 단, 테스트 사용자·지출 데이터를
실제로 생성하므로 **실서버에서는 감안하고 실행**하세요"라고 적는다. 그 문장은 "돌긴 돈다"를 전제한다.

돌지 않는다. 스크립트의 1번 검사가 `POST /auth/oauth-login`이고(`scripts/qa/server-smoke.sh:11~15`),
그 엔드포인트는 프로덕션에서 **항상 501**이다:

```
apps/api/src/auth/auth.service.ts:25~32
  async oauthLogin(input) {
    if (!isDevOrTestEnv()) {
      throw new NotImplementedException({ code: "OAUTH_LOGIN_NOT_IMPLEMENTED", … });
```

`isDevOrTestEnv()`는 `NODE_ENV`가 정확히 `"development"`/`"test"`일 때만 참이다
(`apps/api/src/common/config/require-secret.ts:6~9`). 토큰이 비므로 이후 36검사가 전부 인증 없이
돌아 연쇄 FAIL한다. 즉 **런북의 이 줄은 프로덕션에서 "37/37"이 아니라 "37/37 FAIL"을 만든다.**

곁가지로, `docs/5차/launch-readiness-status.md:20`의 "실서버 검증 | HTTP 스모크 37/37"은 그래서
**dev 모드 서버**에 대한 사실이지 프로덕션 배포에 대한 사실이 아니다. 그 칸의 문구가 그 구분을 하지 않는다.

**근거.** `scripts/qa/server-smoke.sh:1~2`(사용법 주석), `:11~15`(1번 검사);
`apps/api/src/auth/auth.service.ts:25~32`; `apps/api/src/common/config/require-secret.ts:6~9`;
`docs/5차/day1-deploy-runbook.md:116`; `docs/5차/launch-readiness-status.md:20`.

**고치는 크기.** 소(문서)면 "이 스크립트는 dev 모드 서버 전용" 한 줄 + 프로덕션용으로는 §C의
`curl` 넷(`:104~114`)이 전부라는 사실을 명시. 중(코드)이면 스모크에 카카오 OIDC prepare 경로나
실계정 로그인 경로를 더해야 하는데, 그건 실서버에 실사용자를 만드는 일이라 별개 판단이다.

**사람이 해야 하는 일인가.** 아니다(문서 갈래). 코드 갈래는 실 카카오 키가 필요하므로 ⚠️ **사용자 몫**이 섞인다.

---

### 4. `pnpm check:env`는 "값이 맞다"를 증명하지 않는다 — 런북은 그 이상으로 인용한다 (P1)

**배포 시 무슨 일이 벌어지는가.** `docs/5차/day1-deploy-runbook.md:88`은 경로 B에서
`cp .env.example .env.production`을 지시한다. `:127`은 `INVITE_LINK_BASE_URL`을 두고 "`pnpm check:env`가
REQUIRED로 잡고 있으니 배포 전에 한 번 돌려 확인하세요"라고 적는다. `release-runbook.md:10`도
"`pnpm check:env` 통과 (누락 시 API 부팅 실패)"를 체크 칸으로 둔다.

그 명령이 실제로 하는 검사는 둘뿐이다 — **존재**(`scripts/check-env.ts:239`)와 **좁은 플레이스홀더 정규식**
(`:242` — `/change-me|dev-.*client-id/`). 그래서 `.env.example`을 그대로 복사하면 다음이 **전부 통과**한다:

| 키 | `.env.example`의 값 | 통과하는 이유 | 배포 시 결과 |
|---|---|---|---|
| `INVITE_LINK_BASE_URL` | `https://wooriai.local` (`.env.example:111`) | 정규식에 안 걸림 | 초대 링크·어드민 공유 URL·앱이 내보내는 구매 링크 셋이 **받는 사람 쪽에서만** 죽는다 (런북 `:127`이 스스로 적은 그 실패) |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:3000/api/v1` (`:8`) | 같음 | 카탈로그 주석(`check-env.ts:57~60`)이 예고한 "기기에서 전부 실패" |
| `DATABASE_URL` | 로컬 dev DSN (`:21`) | 같음 | compose가 덮어쓰므로 B경로는 무해, 그 외 경로는 조용히 dev를 가리킨다 |
| `WOORIAI_ADMIN_TOKEN` | `dev-admin-token` (`:124`) | `dev-.*client-id`는 이 문자열과 안 맞는다 | 실해는 **없다** — `AdminTokenGuard`가 프로덕션에서 무조건 403이다(아래) |
| `NODE_ENV` | `development` (`:1`) | 존재하므로 통과 | compose(`docker-compose.prod.yml:55`)와 fly(`fly.toml:14`)가 덮어쓴다 |

`WOORIAI_ADMIN_TOKEN`이 사고로 이어지지 **않는** 근거는 값이 아니라 가드다:
`apps/api/src/admin/admin-token.guard.ts:26~28`이 `!isDevOrTestEnv()`면 토큰을 **읽기도 전에** 403을
던진다. 그 설계 덕에 "공개된 dev 토큰이 운영 어드민을 연다"는 최악은 닫혀 있다 — 이 부분은 잘 되어 있다.

남는 진짜 위험은 표의 위 두 줄이다. 그리고 그 둘은 **배포 스모크에서 보이지 않는다**(런북 `:127`이
스스로 그렇게 적는다). 문제는 그 문장이 뒤이어 `check:env`를 안전망으로 지목한다는 것이다.

**근거.** `scripts/check-env.ts:239`, `:242`; `.env.example:1`, `:8`, `:21`, `:111`, `:124`;
`apps/api/src/admin/admin-token.guard.ts:26~28`; `docs/5차/day1-deploy-runbook.md:88`, `:127`;
`docs/operations/release-runbook.md:10`.

**고치는 크기.** 소~중. ⓐ 문서 쪽: 두 런북에서 `check:env`가 증명하는 것("키가 비어 있지 않다")과
증명하지 않는 것("값이 이 배포에 맞다")을 한 줄로 가른다. ⓑ 코드 쪽(선택): `.env.example`의 값과
**글자 단위로 같으면** 거부하는 규칙을 더하면 위 다섯 줄이 전부 잡힌다 — 정규식을 늘리는 것보다
정확하고, `--allow-placeholders`가 이미 예시 파일 자신을 면제하고 있다(`scripts/check-env.ts:218`).

**사람이 해야 하는 일인가.** 아니다.

---

### 5. 소스 방향 드리프트 가드가 `EXPO_PUBLIC_*`만 본다 — 서버 env는 사각이다 (P1)

**배포 시 무슨 일이 벌어지는가.** `check-env.ts`는 세 방향을 검사한다고 스스로 적는다
(`scripts/check-env.ts:257~262`, `:304~317`): ① 카탈로그→예시, ② 예시→카탈로그, ③ 소스→카탈로그.
그런데 ③의 모집단이 `MOBILE_SOURCE_ROOTS = ["apps/mobile/app", "apps/mobile/src"]`이고
패턴이 `/process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g`다(`:318~320`). 이유도 적혀 있다 — "서버 키는
미주입이 부팅·요청 실패로 드러난다"(`:313~315`).

**그 이유는 오늘의 코드에 대해 참이 아니다.** 서버가 읽는 키 36개(`apps/api/src` 전수) 중 미주입이
부팅 실패로 드러나는 것은 `assertRequiredSecretsConfigured`가 무는 6개뿐이고
(`apps/api/src/common/config/require-secret.ts:39~48`), 나머지는 **조용히 기본값으로 간다**:
`INVITE_LINK_BASE_URL`은 `?? "https://wooriai.local"`(`apps/api/src/households/household-runtime.service.ts:383`),
`WORKER_ENABLED`는 `!== "1"`이면 워커가 통째로 안 돈다(`apps/api/src/worker/scheduler.service.ts:69`),
보존 기간 7종은 전부 `Number(env.X)` → 기본값 폴백(`apps/api/src/worker/jobs/data-retention-purge.job.ts:1824~1854`),
레이트리밋 6종은 `process.env[name]` **동적 인덱싱**이라 이름 문자열이 리터럴로도 안 나온다
(`apps/api/src/common/security/rate-limit.middleware.ts:127~132`).

결과: **누군가 api에 새 env 키를 더하고 카탈로그·예시 파일 등록을 잊으면, 세 방향 가드 중 어느 것도
그것을 보지 못한다.** 모바일에는 그물이 있고 서버에는 없다. (오늘 실제로 새는 키가 있는지 전수 대조한
결과는 **0건**이다 — 36개 전부 카탈로그 안이거나 `INTENTIONALLY_UNCATALOGUED`(`:159~164`)에 있다.
즉 이것은 오늘의 버그가 아니라 **내일 조용히 열릴 문**이다.)

**근거.** `scripts/check-env.ts:304~320`, `:159~164`;
`apps/api/src/common/config/require-secret.ts:39~48`;
`apps/api/src/households/household-runtime.service.ts:383`;
`apps/api/src/worker/scheduler.service.ts:69`;
`apps/api/src/worker/jobs/data-retention-purge.job.ts:1824~1854`;
`apps/api/src/common/security/rate-limit.middleware.ts:127~132`.

**고치는 크기.** 중. ③의 모집단에 `apps/api/src`를 더하고 패턴을 `process.env.X` / `env.X` /
`requireSecret("X")` 셋으로 넓히면 된다(동적 `process.env[name]`은 원리상 못 잡으므로 그 자리 둘은
주석이나 허용 목록으로 명시해야 한다). 40~60줄. 넓히는 순간 §6의 죽은 키 8개가 반대 방향으로 드러나므로
6번과 함께 판단하는 편이 낫다.

**사람이 해야 하는 일인가.** 아니다.

---

### 6. REQUIRED 22 중 8개가 죽은 키 — 그래서 런북대로 배포하면 `check:env`가 반드시 실패한다 (P1)

**배포 시 무슨 일이 벌어지는가.** `check-env.ts`의 REQUIRED 22개 중 **8개**는 파일 스스로가 "현재 앱
코드는 직접 읽지 않음"이라고 적고 있다(`scripts/check-env.ts:61~80`): `REDIS_URL`, `S3_ENDPOINT`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `AFFILIATE_DISCLOSURE_TEXT`,
`OAUTH_APPLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_ID`. 여기에 `WOORIAI_ADMIN_TOKEN`을 더하면 아홉인데,
그것은 부팅에서 강제되지만 프로덕션에서 **어떤 요청도 열지 못한다**(발견 4번의 가드).

그 사실이 런북과 정면으로 부딪힌다. day1 A-3(`docs/5차/day1-deploy-runbook.md:30~43`)이 주입하는
시크릿은 **13종**이고 D절이 그 수를 그대로 적는다(`:122`). `fly.toml:13~19`가 `NODE_ENV`·`PORT`·
`TRUST_PROXY`·`WORKER_ENABLED` 넷을 더하고, `fly postgres attach`가 `DATABASE_URL`을 넣는다.
합쳐도 REQUIRED 22 중 **`REDIS_URL`·`S3_×4`·`OAUTH_APPLE_CLIENT_ID`·`OAUTH_GOOGLE_CLIENT_ID`·
`EXPO_PUBLIC_API_BASE_URL` 8개가 비어 있다.**

그런데 `release-runbook.md:10`은 배포 전 체크 칸으로 "`pnpm check:env` 통과"를 요구한다. 정상적으로,
런북대로, 완벽하게 배포된 Fly 머신에서 그 명령은 **8개 누락으로 exit 1**이다. `--scope=api`
필터가 있어 `EXPO_PUBLIC_*` 하나는 뺄 수 있지만(`scripts/check-env.ts:219~231`), **런북 어디에도
`--scope`가 나오지 않는다.** 게다가 API는 `dotenv`를 쓰지 않으므로(`apps/api` 전체에 참조 0건)
이 명령은 "운영자 셸의 env"를 볼 뿐이고, Fly 시크릿을 보려면 `fly ssh console -C`로 컨테이너 안에서
돌려야 하는데 그 방법도 적혀 있지 않다.

결과는 둘 중 하나다: 운영자가 **의미 없는 값 8개를 지어내 주입하거나**(그러면 게이트는 초록이지만
아무것도 검증하지 않은 것이다), **명령을 건너뛴다**(그러면 §4의 진짜 위험도 함께 건너뛴다).
어느 쪽이든 게이트가 신호를 잃는다.

**근거.** `scripts/check-env.ts:61~80`, `:219~231`, `:239`;
`docs/5차/day1-deploy-runbook.md:30~43`, `:122`; `fly.toml:13~19`;
`docs/operations/release-runbook.md:10`; `apps/api/src/admin/admin-token.guard.ts:26~28`.

**고치는 크기.** 소(문서)면 런북에 `pnpm check:env --scope=api`와 "컨테이너 안에서 돌린다"를 적고
죽은 키 8개를 어떻게 다룰지 명시. 중(카탈로그)이면 8개를 REQUIRED에서 내리는 일인데,
`check-env.ts:65`가 스스로 "게이트 무회귀를 위해 required로 유지한다 — 제거는 인프라/제휴 담당 확인 후
별도 변경 요청"이라고 적어 두었다. **그 변경 요청이 바로 이 항목이다.**

**사람이 해야 하는 일인가.** ⚠️ **판단은 사람 몫이다** — S3/Redis를 쓸 계획이 있는지, Apple/Google
로그인을 언제 붙일지는 제품 결정이다. 결정 후 코드 변경은 저장소 안.

---

### 7. 거짓 초록 ①: DB가 죽어도 API는 부팅하고 `/health`는 200이다 (P2)

**배포 시 무슨 일이 벌어지는가.** `PrismaService.onModuleInit`은 연결 실패를 **삼킨다**:

```
apps/api/src/prisma/prisma.service.ts:55~68
  private async tryConnect() {
    try { await this.$connect(); … }
    catch (error) {
      this.connected = false;
      this.logger.warn(`Database connection failed at boot; continuing without it
        (in-memory domain features are unaffected). …`);
```

그 주석의 전제 — "나머지 API는 아직 인메모리"(`:7~8`) — 는 **라운드 4에 사라졌다**
(`docs/operations/known-limitations.md:11`: "전 도메인 Prisma 전환 완료", `environment-setup.md:45`:
"인메모리 폴백 없음"). 그래서 오늘 이 폴백이 지키는 기능은 **하나도 없다**. 대신 이렇게 된다:
프로세스는 뜨고, 포트는 열리고, `GET /api/v1/health`는 `{"status":"ok"}`를 준다
(`apps/api/src/health/health.controller.ts:18~21` — 무조건 200), 그리고 **모든 사용자 요청이 500이다.**

`environment-setup.md:45`는 정확히 반대를 적는다 — "`DATABASE_URL`(PostgreSQL) … 없을 때: **API가
부팅하지 못한다**". 사고 중에 그 표를 읽은 운영자는 "프로세스가 살아 있으니 DB는 괜찮다"고 잘못 읽는다.

**완화되어 있는 것은 인정한다.** 배포 판정에 `/health/ready`를 쓰라는 규율이 세 문서에 있고
(`release-runbook.md:44~57`, `incident-response.md:13~19`), `fly.toml:28~33`과
`docker-compose.prod.yml:65~69`가 실제로 그 경로를 본다. `/health/ready`는 매 호출마다
`SELECT 1`을 실제로 던지므로(`apps/api/src/prisma/prisma.service.ts:43~53`) 스테일 플래그가 아니다 —
이 설계는 정확하다. 남은 사각은 ⓐ 문서의 반대 진술, ⓑ compose의 `healthcheck`는 **unhealthy를
표시만 하고 컨테이너를 재시작하지 않는다**(docker의 성질), 그래서 Caddy는 계속 그 컨테이너로 프록시한다.

**근거.** `apps/api/src/prisma/prisma.service.ts:4~14`(스테일 주석), `:21~23`, `:43~53`, `:55~68`;
`apps/api/src/health/health.controller.ts:18~21`; `docs/operations/environment-setup.md:45`;
`docs/operations/known-limitations.md:11`; `fly.toml:28~33`; `infra/docker/docker-compose.prod.yml:65~69`.

**고치는 크기.** 소(문서)가 우선 — `environment-setup.md`의 그 칸을 사실로 바꾸고, 스테일 주석
(`prisma.service.ts:7~8`)을 정정한다. 중(코드)은 별도 판단: 부팅을 fail-fast로 바꾸면 DB가 늦게 뜨는
compose 순서 문제와 부딪히므로(현재는 `depends_on: service_healthy`로 이미 막혀 있다) 서두를 이유가 없다.

**사람이 해야 하는 일인가.** 아니다.

---

### 8. 거짓 초록 ②: 크래시 루프는 `stale`도 `degraded`도 만들지 않는다 (P2)

**배포 시 무슨 일이 벌어지는가.** `release-runbook.md:64~92`는 워커 관측을 **본문 키워드 모니터 둘**로
설계한다 — `"stale":true`와 `"degraded":true`. 그 설계는 옳고, "상태코드로 알면 영원히 안 울린다"는
경고까지 적혀 있다. 하지만 두 플래그의 상태가 **프로세스 메모리에만 있다**:

- `stale`의 기준선은 `trackingSince = new Date()` — **서비스 인스턴스 생성 시각**
  (`apps/api/src/worker/worker-status.service.ts:100`, 판정은 `:165~166`).
- `degraded`의 카운터 `jobStates`도 인메모리 Map이다(`:104`, `:128~138`). 파일 스스로
  "State is per-process and resets on restart — exactly what we want"라고 적는다(`:90~91`).

그래서 **프로세스가 인터벌의 3배(기본 3분)보다 자주 재시작되면 `stale`은 영원히 false다.** 워커가
매 틱 죽어 프로세스를 끌어내리는 장애, OOM 루프, Fly의 헬스체크 실패 후 재시작 루프가 전부 여기 해당한다.
`degraded`도 마찬가지로 카운터가 매번 0으로 돌아가 임계 3에 도달하지 못한다. **두 모니터가 모두 조용한
채로 파기·정리 잡이 무한히 진행되지 않는다.**

`incident-response.md:62~63`이 "`stale=true`면 재기동으로 되살린다 / 상태는 프로세스 단위라 재기동 시
초기화된다"고 적어 성질 자체는 알려져 있다. 알려져 있지 않은 것은 **그 성질이 특정 장애 모드에서
모니터를 무력화한다**는 귀결이다. 어느 문서도 그것을 적지 않는다.

**근거.** `apps/api/src/worker/worker-status.service.ts:90~91`, `:100`, `:104`, `:128~138`, `:165~166`;
`apps/api/src/health/health.controller.ts:29~35`; `docs/operations/release-runbook.md:64~92`;
`docs/operations/incident-response.md:62~63`.

**고치는 크기.** 소(문서)가 정직하다 — 런북 §3.2에 "이 두 모니터는 **프로세스가 살아 있는 동안의**
장애를 잡는다. 재시작 루프는 잡지 못하므로 업타임 체커의 기본 가용성 모니터(`/health/ready`)를
반드시 함께 둔다" 한 문단. 코드로 닫으려면 재시작 횟수를 DB에 남겨야 하는데, 그건 새 표라 범위가 다르다.

**사람이 해야 하는 일인가.** ⚠️ **모니터 등록 자체는 사용자 몫이다**(UptimeRobot 등 외부 계정).
문서는 저장소 안.

---

### 9. 런북의 마이그레이션 개수가 13에서 멈춰 있다 (P1)

**배포 시 무슨 일이 벌어지는가.** 실제 25개인데 세 자리가 13이라고 적는다:

- `docs/5차/day1-deploy-runbook.md:51` — "`fly deploy` … release_command(prisma:deploy, **마이그레이션 13개**)"
- `docs/5차/day1-deploy-runbook.md:121` — "- [ ] Postgres 가동·**마이그레이션 13개** 적용"
- `docs/5차/launch-72h-plan.md:40` — "(**마이그레이션 13개**, 시드: …)"

그리고 `docs/operations/database-migrations.md:7~11`의 "현재 마이그레이션" 표는 `000001`·`000002`만
적고 나머지를 "(이후)"로 뭉갠다.

**실해는 "13개가 적용됐는지 세다가 25개를 보고 당황한다"가 아니다.** 진짜 실해는 이것이다 — 배포 후
검증 체크 칸(`:121`)이 **틀린 수를 세라고 지시하므로**, 운영자가 `_prisma_migrations` 행 수를 실제로
세어 확인하는 대신 그 칸을 그냥 체크한다. 그러면 "migrate가 실제로 돌았는가"를 확인하는 절차가
체크리스트에서 사실상 사라진다. 명령 자체는 pending 전부를 짊어지므로(§0) 대개 무해하지만,
`release_command`가 조용히 실패한 배포를 잡아낼 마지막 칸이 이것이었다.

**근거.** `ls apps/api/prisma/migrations | grep -c '^0'` → **25**;
`docs/5차/day1-deploy-runbook.md:51`, `:121`; `docs/5차/launch-72h-plan.md:40`;
`docs/operations/database-migrations.md:7~11`.

**고치는 크기.** 소. 이 저장소의 관례대로 **세는 명령을 인용으로 박으면**(day1 A-5가 시드 링크 수에
대해 이미 그렇게 한다 — `:60~63`) 다음 라운드가 마이그레이션을 더해도 드리프트가 생기지 않는다.
`database-migrations.md`의 표는 최신 몇 개만 적고 "전체 목록은 디렉터리가 단일 소스"로 바꾸는 편이 낫다.

**사람이 해야 하는 일인가.** 아니다.

---

### 10. 롤백 안전지대가 없는 마이그레이션은 000024 하나가 아니다 (P1)

과제가 물은 것이 이것이다 — "000024는 이미 문서화됐다. **다른 것들은?**" 25개를 전수로 읽었다.
판정 기준은 둘이다: **ⓐ 코드만 되돌려도 안전한가**(구 빌드 + 신 스키마), **ⓑ DB를 되돌릴 수 있는가**.

| 마이그레이션 | ⓐ 코드만 롤백 | ⓑ DB 롤백 | 판정 |
|---|---|---|---|
| `000003`·`000006`·`000009`·`000020`·`000022`·`000023` (컬럼·표 추가) | 안전(구 코드는 새 칸을 모른다) | 표/컬럼 드롭 = 그 기능의 사용자 데이터 소실(커스텀 품목·카테고리 예산) | 코드 롤백 OK |
| `000011`·`000012`·`000014`~`000017`·`000021`·`000025` (색인만) | 안전 | 안전(색인 드롭) | **완전 가역** |
| `000005` (`import_rows.validation_status` 타입 확장) | 안전 | 좁히면 절단 위험 | 코드 롤백 OK |
| `000019` (`refresh_tokens.family_started_at` + backfill) | 안전 | 컬럼 드롭 = 패밀리 만료 기준 소실(SEC-131) | 코드 롤백 OK |
| **`000007`** (`product_links.redirect_code` backfill → NOT NULL + UNIQUE) | 안전 | ⚠️ **불가** | **아래** |
| **`000008`** (`affiliate_clicks.user_id/household_id/child_id` DROP NOT NULL) | ⚠️ **불안전** | ⚠️ 불가 | **아래** |
| **`000010`** (중복 `user_devices` **DELETE** 후 유니크 인덱스) | 안전 | ⚠️ **불가**(지운 행은 없다) | **아래** |
| **`000018`** (`categories.selectable` + 별칭 9행 false) | ⚠️ **불안전** | 가능하나 무의미 | **아래** |
| **`000024`** (`categories.household_id`) | ⚠️ **불안전** | ⚠️ **더 나쁘다** | 이미 문서화됨 |

**`000007` — 밖으로 나간 코드는 되돌릴 수 없다.**
`apps/api/prisma/migrations/000007_round5_cms_oauth_analytics/migration.sql:71~80`이
`redirect_code`를 난수로 backfill하고 UNIQUE를 건다. 그 코드는 **공개 리다이렉트 URL의 일부**로
앱과 어드민 공유 링크를 통해 밖으로 나간다(`/api/v1/r/:code`, `docs/5차/day1-deploy-runbook.md:112~114`).
컬럼을 드롭하고 다시 만들면 난수가 바뀌므로 **이미 배포된 모든 구매 링크가 영구히 404가 된다.**
000024와 같은 성질(밖으로 나간 뒤에는 되돌릴 수 없다)인데 어디에도 적혀 있지 않다.

**`000008` — 코드만 되돌리는 것이 안전하지 않은 자리.**
`.../000008_affiliate_clicks_nullable_actor/migration.sql:7~9`가 세 FK 칸의 NOT NULL을 **푼다**.
비로그인 클릭이 한 건이라도 쌓인 뒤에 구 코드로 되돌리면, 구 Prisma 클라이언트는 그 칸들을
non-nullable로 타이핑하므로 집계·어드민 조회가 null을 만나 깨진다. DB 롤백(NOT NULL 재부착)은
그 행들 때문에 **실패한다**. 이것이 `rollback.md`가 말하는 "additive 위주라 대체로 안전"의 반례다.

**`000010` — 유일하게 데이터를 지우는 마이그레이션.**
`.../000010_user_devices_unique_token/migration.sql:12~20`의 `DELETE FROM user_devices a USING …`.
빈 운영 DB에는 무해하지만, **이미 데이터가 있는 DB에 처음 적용하는 순간 중복 기기 행이 사라진다.**
되돌릴 방법은 없다. 신규 배포에는 해당 없고, 기존 dev/스테이징 DB를 승격하는 시나리오에서만 문다.

**`000018` — 응답 축소라 구 클라이언트에 하위 호환이 아니다.**
`known-limitations.md:65`가 이미 "**배포 결합 주의(R26 리뷰)**: 필드 추가가 아니라 기본 응답 행
축소(21→12)라 구클라이언트에 하위 호환이 아니다"라고 적는다. 그 사실은 **`rollback.md`에는 없다**.
그런데 롤백 판단을 하는 사람이 읽는 문서는 `rollback.md`다.

**그 문서가 멈춰 있는 자리.** `docs/operations/rollback.md:6`은 "**라운드 4 마이그레이션**은
additive(테이블·컬럼 추가) 위주라 코드만 롤백해도 대체로 안전하다"고 적는다. 라운드 4는 `000002`~`000005`다.
그 뒤 20개에 대해 이 문서는 아무 말도 하지 않는다. `release-runbook.md:97~99`가 같은 문장을 반복한다.

**고치는 크기.** 중(문서). `rollback.md`에 위 표를 넣고, "라운드 4"라는 시점 표현을 지운다. 앞으로의
규율로 **마이그레이션 헤더에 롤백 성질을 한 줄 적는 관례**를 세우는 편이 낫다 — 000024가 이미 그렇게
하고 있고(`:19~25`), 그 관례가 나머지에 없었을 뿐이다.

**사람이 해야 하는 일인가.** 아니다.

---

### 11. `api:3000`이 외부에 열린 채 `TRUST_PROXY=1`이면 레이트리밋이 무력화된다 (P2)

**배포 시 무슨 일이 벌어지는가.** `infra/docker/docker-compose.prod.yml:58~59`가 `"3000:3000"`을
게시한다(모든 인터페이스). day1 §B(`docs/5차/day1-deploy-runbook.md:91`)는 **caddy 오버레이 없이**
`-f docker-compose.prod.yml` 하나만 쓰라고 하고, 바로 다음 두 줄에서 "HTTPS는 앞단에 Caddy/nginx를
두세요"와 "`TRUST_PROXY=1`을 **반드시** 넣으세요"를 지시한다(`:94~95`).

그 조합이 만드는 상태는 이렇다 — 프록시는 443에 있지만 **3000도 여전히 열려 있고**,
`TRUST_PROXY=1`이면 Express가 `X-Forwarded-For`의 마지막 홉을 `req.ip`로 채택한다
(`apps/api/src/bootstrap.ts:77~79`). 레이트리밋 버킷의 키가 곧 그 값이다
(`apps/api/src/common/security/rate-limit.middleware.ts:134~136`, `:211~213`). 따라서 **3000에 직접
접속해 `X-Forwarded-For`를 매 요청 다르게 위조하면 버킷이 매번 새로 생겨 전역·auth·redirect·analytics
상한이 전부 무의미해진다.** 무차별 로그인 시도와 `affiliate_clicks` 대량 삽입이 둘 다 열린다.

`bootstrap.ts:74~76`의 주석은 이 조건을 정확히 알고 있다 — "Default OFF: directly-exposed deployments
must keep ignoring the spoofable header." 코드는 맞다. **틀린 것은 런북이 그 둘을 동시에 지시한다는 것**이다.

이 저장소에 정답이 이미 있다: `infra/docker/docker-compose.caddy.yml:26~28`의 `api: ports: !reset []`.
`scripts/deploy/oracle-bootstrap.sh:183`은 그 오버레이를 **항상** 함께 쓴다. 즉 원샷 스크립트 경로는
안전하고, **런북의 손 절차만 새어 있다.**

**근거.** `infra/docker/docker-compose.prod.yml:58~59`; `infra/docker/docker-compose.caddy.yml:26~28`;
`docs/5차/day1-deploy-runbook.md:91`, `:94~95`; `apps/api/src/bootstrap.ts:71~88`;
`apps/api/src/common/security/rate-limit.middleware.ts:134~136`, `:211~213`;
`scripts/deploy/oracle-bootstrap.sh:183`.

**고치는 크기.** 소. day1 §B의 명령을 caddy 오버레이를 포함한 형태로 바꾸거나, "직접 프록시를 두는
경우 `ports`를 `127.0.0.1:3000:3000`으로 바꾸라"를 명시. 한 줄~세 줄.

**사람이 해야 하는 일인가.** 아니다(문서). ⚠️ VM 방화벽 규칙 자체는 사용자 몫.

---

### 12. 게이트 ↔ CI 차집합 — 그리고 **방향이 예상과 반대다** (P2)

과제가 물은 것은 "게이트만 잡고 CI는 못 잡는 것"이다. 전수 대조 결과:

**게이트만 있는 것 (`scripts/release-gate.ts`):**
1. **`pnpm peers check`** (`:85~91`) — 락파일의 미충족 peer 의존성. CI에 없다. `pnpm@11.7.0`의 실제
   서브커맨드임을 확인했다(`pnpm peers check --help` 정상 응답). **이것이 유일하게 진짜 CI 사각이다.**
2. **`prisma:validate`** (`:23~30`) — CI에는 `prisma:deploy`+`prisma:generate`가 있어 스키마 문법 오류는
   거기서도 대부분 드러난다. 실질 차이는 작다.
3. `pnpm test --concurrency=1` (`:67~69`) — 직렬 실행. 자원 경합 성격이고 검사 대상은 같다.
4. `pnpm db start` (`:39~46`) — 검사가 아니라 환경 준비.
5. `pnpm --filter api test:e2e` (`:71~77`) — **차집합이 아니다.** `apps/api/package.json:10`의
   `test`가 `vitest run`이고 vitest 기본 include가 `**/*.test.ts`라 `test/*.e2e.test.ts` 14개를 이미
   전부 돈다. 게이트의 이 단계는 같은 파일을 두 번 도는 중복이다.

**CI만 있는 것 (`.github/workflows/ci.yml`) — 여기가 뒤집힌 자리다:**
6. **빈 DB에 `prisma migrate deploy`** (`:63~64`). 서비스 컨테이너가 매번 새 postgres이므로
   **"마이그레이션은 빈 DB에 처음부터 순서대로 적용 가능해야 한다"**(`database-migrations.md:33`, 규칙 2)를
   실제로 증명하는 것은 **CI뿐이다**. 게이트에는 migrate 단계 자체가 없고, api 테스트의
   `global-setup`(`apps/api/test/global-setup.ts:49`)은 **이미 존재하는** `wooriai_test`에 pending만
   얹는다. 즉 **"이전 마이그레이션이 이미 적용된 DB에서만 성공하는 마이그레이션"은 로컬 게이트를
   11/11로 통과한다.**
7. **`pnpm --filter api seed`** 독립 실행 (`:69~70`).

**둘 다 못 잡는 것:** 서버 스모크(`scripts/qa/server-smoke.sh`), 어드민 브라우저 E2E
(`scripts/qa/admin-e2e.mjs`), APK/AAB 빌드(발견 13), 픽셀락, docker 이미지 빌드
(`day1-deploy-runbook.md:134`가 "이미지 빌드는 `fly deploy` 시점에 처음 검증됩니다"라고 스스로 적는다),
실 env 검증(`pnpm check:env` — §6), 구 클라이언트 호환(§10의 000018).

**고치는 크기.** 소. CI에 `pnpm peers check` 한 스텝을 더하면 게이트-전용 사각이 사실상 사라진다.
게이트 쪽은 `test:e2e` 중복을 빼고 그 자리에 "빈 DB 마이그레이션" 검증을 넣는 것이 더 값지지만,
로컬에서 DB를 매번 새로 만드는 비용이 있어 판단이 필요하다.

**사람이 해야 하는 일인가.** 아니다.

---

### 13. 안드로이드 빌드는 앱 코드 변경으로 절대 돌지 않는다 (P2)

**배포 시 무슨 일이 벌어지는가.** 두 워크플로의 트리거를 보면:

- `android-apk.yml:14~20` — `workflow_dispatch` + `push: paths: [".github/workflows/android-apk.yml"]`.
  즉 **그 워크플로 파일 자신이 바뀔 때만** 자동 실행된다.
- `android-release.yml:26~36` — `workflow_dispatch` 전용.

그래서 `apps/mobile/**`나 `apps/mobile/plugins/with-wooriai-android-release.js`가 바뀌어도 어떤 빌드도
자동으로 돌지 않는다. 컨테이너 개발 환경에서 `dl.google.com`이 막혀 로컬 gradle 빌드가 불가능하다는
사실(두 워크플로 헤더 주석이 적는다)을 감안하면, **prebuild+gradle이 실제로 성공하는지를 아무도
자동으로 확인하지 않는다.**

**축 7의 답: 플러그인이 오늘 짊어지는 패치는 셋이고, 그물은 순수함수 테스트다.**
`apps/mobile/plugins/with-wooriai-android-release.js:148~150`이 합성하는 것은 ①
`extraPackagerArgs`(모노레포 entry 경로, `:101~117`), ② `network_security_config.xml` 생성 + 매니페스트
속성(`:126~146`), ③ 업로드 keystore signingConfig 주입(`:65~89`). 앵커를 못 찾으면 **조용히 넘어가지 않고
throw한다**(`:67~78`, `:104~110`) — 이 설계는 정확하다. expo/RN 템플릿이 바뀌면 빌드가 실패로 드러난다.
그 함수들은 `apps/mobile/src/android-release-aab.test.ts`·`android-standalone-apk.test.ts`가
문자열 단위로 문다(`:151~156`이 그 목적의 export). 그래서 CI의 `pnpm test`는 **주입 로직의 회귀는 잡는다.**

**잡지 못하는 것은 "오늘의 템플릿이 그 앵커를 여전히 갖는가"다** — 그건 실제 `expo prebuild` 산출물에
대해서만 알 수 있고, 그것을 도는 유일한 경로가 위 두 워크플로다. expo/RN 버전을 올리는 라운드에서
누군가 수동으로 `android-apk`를 돌리지 않으면, **출시 직전 AAB 빌드에서 처음 터진다.**

**근거.** `.github/workflows/android-apk.yml:14~20`, `:36~45`;
`.github/workflows/android-release.yml:26~36`, `:110~137`;
`apps/mobile/plugins/with-wooriai-android-release.js:65~89`, `:101~117`, `:126~156`;
`apps/mobile/src/android-release-aab.test.ts` · `apps/mobile/src/android-standalone-apk.test.ts`(존재 확인).

**고치는 크기.** 소. `android-apk.yml`의 `push.paths`에 `apps/mobile/**`와
`scripts/build-android-*.ts`를 더하거나, `pull_request` 트리거를 붙인다(45분 timeout이라 비용은 든다).
데모 APK 경로는 비밀값이 전혀 필요 없으므로(워크플로 헤더가 그렇게 적는다) fork PR에서도 안전하다.

**사람이 해야 하는 일인가.** 아니다. ⚠️ 단, **AAB 서명 시크릿 4종·변수 5종 등록은 사용자만** 할 수 있다
(`android-release.yml:10~19`가 그 목록을 적는다 — GitHub Settings → Secrets/Variables).

---

### 14. `release-runbook.md`의 "로그인 501" 진단이 오늘 틀렸다 (P2)

**배포 시 무슨 일이 벌어지는가.** `docs/operations/release-runbook.md:116`의 장애 대응 표:

> | 로그인 501 | 프로덕션에서 OAuth 실검증 미구현(`auth.service.ts`) — 실 OAuth 연동 필요 |

카카오 OIDC는 **구현돼 있다**(`apps/api/src/auth/kakao/` 전체 — prepare/exchange, JWKS 서명·iss/aud/exp·
nonce 검증). 501을 던지는 것은 **dev 스텁 경로 하나**뿐이다(`apps/api/src/auth/auth.service.ts:25~32`,
`POST /auth/oauth-login`). 프로덕션에서 사용자가 501을 받았다면 원인은 "OAuth가 미구현이라서"가 아니라
**앱 빌드가 `EXPO_PUBLIC_KAKAO_ENABLED=1` 없이 만들어져 스텁 경로를 부르고 있어서**다.

그 원인을 막는 그물이 이미 있다 — `scripts/build-android-aab.ts:66~93`, `:138~142`가 그 플래그를
fail-closed로 물고, 거부 메시지가 정확히 이 증상을 적는다("실사용자는 서버의
501(OAUTH_LOGIN_NOT_IMPLEMENTED)만 받고 첫 화면에서 가입 자체를 못 합니다"). 그래서 **`pnpm android:build-aab`로
만든 AAB는 이 증상이 날 수 없다.** 501이 실제로 났다면 그 APK는 다른 경로로 만들어진 것이다
(`android-apk.yml`의 standalone 데모 APK, 또는 손 gradle 빌드). 런북이 그 갈래를 가리키지 않는다.

**근거.** `docs/operations/release-runbook.md:116`; `apps/api/src/auth/auth.service.ts:25~32`;
`apps/api/src/auth/kakao/kakao-oidc-client.http.ts:26~28`, `:74`;
`scripts/build-android-aab.ts:66~93`, `:138~142`; `.github/workflows/android-apk.yml:1~6`.

**고치는 크기.** 소. 그 행의 점검 칸을 "앱 빌드의 `EXPO_PUBLIC_KAKAO_ENABLED`·`EXPO_PUBLIC_KAKAO_CLIENT_ID`
확인 → 데모 APK를 실사용자에게 배포하지 않았는지 확인"으로 바꾼다.

**사람이 해야 하는 일인가.** 아니다.

---

### 15. config plugin이 짊어지지 않는 것 둘 — 설계된 사용자 몫 (P3)

축 7의 나머지 답이다. 푸시를 켜는 날 필요한 패치 중 **플러그인 밖에 있는 것**이 둘이다:

1. `expo-notifications` 의존성 — `apps/mobile/package.json`에 없다(`expo-secure-store`만 있다).
   코드는 동적 `require` try/catch로 이미 준비돼 있어 미설치 상태에서도 빌드가 통과한다
   (`apps/mobile/src/notifications/push-token-source.ts:28~35`, `:58~62`).
2. `google-services.json` + `app.json`의 `googleServicesFile` — 둘 다 없다.

**이것은 결함이 아니라 명시된 계약이다.** `push-token-source.ts:1~21`이 활성 4단계를 값으로 적고,
`known-limitations.md:51`이 "남은 것은 자산 3종뿐"이라고 적는다. 플러그인이 이 둘을 짊어지지 않는 것도
옳다 — `google-services.json`은 저장소에 두면 안 되는 자산이고, 의존성 추가는 락파일 변경이다.

곁가지 하나: `scripts/build-android-aab.ts`의 필수/선택 목록(`:66~109`)에 `EXPO_PUBLIC_PUSH_ENABLED`가
없다. 오늘은 옳다(꺼짐이 정상). 푸시를 켜는 날 그 목록에 넣지 않으면, **서버는 `PUSH_ENABLED=1`인데
앱 빌드에는 플래그가 없어 토큰이 한 건도 등록되지 않는** 조용한 반쪽 활성이 가능하다. 지금 적어 둔다.

**사람이 해야 하는 일인가.** ⚠️ **그렇다** — Firebase 계정·서비스 계정 키·`google-services.json`은
**사용자만** 만들 수 있다.

---

### 16. `known-limitations.md`의 제휴 링크 실측이 스테일 (P3)

`docs/operations/known-limitations.md:49`는 "시드는 비제휴 dev 샘플(`https://example.com/dev/...` **86곳**)"이라고
적는다. 실측은 **0곳**이다:

```
grep -c 'https://example.com' apps/api/prisma/seed-data.ts        → 0
grep -c '^    url:' apps/api/prisma/seed-data.ts                  → 67
grep -c 'url: "https://www.coupang.com/np/search' …               → 67
```

출시 트랙 LP-A가 전부 교체했고 `day1-deploy-runbook.md:60~66`·`:135~136`이 그 사실과 세는 명령을
정확히 적는다. 같은 줄(`known-limitations.md:49`)이 스스로 "⚠️ 이 수를 **세는 자리**는
`day1-deploy-runbook.md` A-5의 실행되는 인용이다 — 여기 적힌 것은 그 답의 **사본**이다"라고 밝히므로,
**사본이 원본과 어긋난 것이 확인된 셈이다.** `environment-setup.md:47`도 "example.com dev 링크"로 스테일.

**고치는 크기.** 소(두 문서 각 한 줄). **사람 몫 아님.**

---

## 3. 권고 (4개)

1. **`scripts/db.ts`의 대상 비대칭을 먼저 닫는다** (발견 1). 출시 주간에 운영 DB를 지울 수 있는
   문서화된 절차가 살아 있는 것이 이 감사에서 가장 큰 위험이다. 최소 조치는 두 줄이다 — `reset`이
   `DATABASE_URL`의 host/db가 로컬 dev가 아니면 거부하고, 세 명령이 시작 시 대상을 출력한다.
   그 다음 `database-backup-restore.md:20~27`에 "이 절차는 로컬 dev 전용" 한 줄.

2. **런북의 "증명"과 "체크 칸"을 실제 명령에 맞춘다** (발견 3·4·6·9). 오늘 런북은 돌지 않는 스모크,
   값을 검사하지 않는 `check:env`, 반드시 실패하는 `check:env`, 틀린 마이그레이션 수를 체크 칸으로 갖는다.
   **네 칸 모두 "체크했다"가 아무것도 뜻하지 않는 상태**라 체크리스트 전체의 신뢰가 깎인다.
   숫자는 이 저장소의 관례대로 **세는 명령을 인용으로 박는다**(day1 A-5가 이미 하는 방식).

3. **`rollback.md`를 "라운드 4"에서 오늘로 끌어온다** (발견 10). 000024만 특별한 것이 아니라
   **000007·000008·000010·000018도 되돌릴 수 없거나 코드만 되돌리면 위험하다**. 표 하나면 된다.
   앞으로는 000024가 이미 하고 있는 대로 **마이그레이션 헤더에 롤백 성질 한 줄**을 관례로 세운다.

4. **추천 배포 경로에 백업을 붙이고, 거짓 초록 둘에 각주를 단다** (발견 2·7·8). Fly 경로에 백업 소절,
   `environment-setup.md:45`의 반대 진술 정정, 런북 §3.2에 "재시작 루프는 두 모니터가 잡지 못한다" 한 문단.
   전부 문서이고 코드 변경이 없다.

**⚠️ 사용자만 할 수 있는 일 (이 감사가 코드로 닫을 수 없는 것):**
Fly/Oracle 계정과 서버 VM · Fly Postgres 스냅샷 정책과 오프사이트 보관 · 카카오 개발자 콘솔 키와
redirect 등록 · Firebase 서비스 계정과 `google-services.json` · GitHub Actions Secrets 4종·Variables 5종
(`android-release.yml:10~19`) · 업로드 keystore · UptimeRobot 등 업타임 체커 모니터 2개 등록 ·
Play Console 업로드와 단계적 출시 · Cloudflare Pages(정적 지원 사이트) · Sentry 등 크래시 파이프라인.

---

## 4. 교집합 없는 소유 파일 목록

이 정찰이 **쓰기를 주장하는 파일은 아래 하나뿐**이다.

```
docs/5차/round106-scout-s9-ops.md      ← 이 문서 (S9 단독 소유)
```

후속 작업이 손댈 파일을 **다른 트랙과 겹치지 않게** 미리 갈라 둔다(제안이며, 이 라운드에서 아무것도
고치지 않았다). 축별로 파일이 겹치지 않도록 묶었다:

| 묶음 | 파일 | 겹칠 수 있는 상대 |
|---|---|---|
| **S9-a 백업/DB 도구** | `scripts/db.ts` · `docs/operations/database-backup-restore.md` | 없음(DB 도구는 이 라운드에서 다른 축이 안 만짐) |
| **S9-b 배포 런북** | `docs/5차/day1-deploy-runbook.md` · `docs/operations/release-runbook.md` | ⚠️ 출시 트랙과 겹칠 수 있음 — 같은 파일을 두 트랙이 동시에 만지지 않도록 조율 필요 |
| **S9-c 롤백/마이그레이션 문서** | `docs/operations/rollback.md` · `docs/operations/database-migrations.md` | 없음 |
| **S9-d 관측 문서** | `docs/operations/incident-response.md` · `docs/operations/environment-setup.md` · `docs/operations/known-limitations.md` | ⚠️ `known-limitations.md`는 여러 트랙이 갱신하는 파일 — **줄 단위로** 겹치지 않게(49번 줄 하나) |
| **S9-e env 게이트** | `scripts/check-env.ts` · `.env.example` | ⚠️ 새 기능이 env를 더하는 트랙과 겹침 — 카탈로그 배열은 append-only로 |
| **S9-f CI/워크플로** | `.github/workflows/ci.yml` · `.github/workflows/android-apk.yml` | 없음 |
| **S9-g compose 포트** | `infra/docker/docker-compose.prod.yml` | 없음 |

**만지지 않을 것**(이 감사의 판정 대상이었지만 고칠 이유가 없었다):
`apps/api/prisma/migrations/**`(규칙 1: 적용된 SQL은 수정 금지) ·
`apps/mobile/plugins/with-wooriai-android-release.js`(오늘의 세 패치를 정확히 짊어지고 있다) ·
`scripts/deploy/oracle-bootstrap.sh`(경로 B는 백업·복구·포트·HTTPS가 전부 옳다) ·
`infra/docker/docker-compose.caddy.yml`(§11의 정답이 이미 여기 있다) ·
`apps/api/src/health/health.controller.ts`(계약이 주석에 정확히 적혀 있다).
