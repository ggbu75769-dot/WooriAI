# 관리자 CMS 접근·권한

라운드 4부터 관리자 인증은 이메일+비밀번호 로그인 + 역할 기반 권한(RBAC)이다. SEC-101/SEC-102(라운드 5)에서 **MFA(TOTP) 강제 등록 + HttpOnly 쿠키 세션 + CSRF**로 강화됐고, ADM-006/ADM-007에서 계정 관리 API가 완성됐다. (두 시점 표기: 아래 "종전:" 문장은 라운드 4 시점 기록을 보존한 것.)

## 인증

- 로그인 1단계: `POST /api/v1/admin/auth/login` `{ email, password }`.
  - MFA 미등록 계정: 즉시 세션 발급 — 단, 아래 "MFA 강제 등록" 게이트에 걸려 등록 전에는 대부분의 라우트가 403.
  - MFA 등록 계정: `{ mfaRequired: true, mfaToken }` 반환 → 2단계로.
- 로그인 2단계(MFA): `POST /api/v1/admin/auth/mfa/verify-login` `{ mfaToken, code }` — code는 TOTP 6자리 또는 복구 코드(XXXXX-XXXXX).
- 세션: **HttpOnly `admin_session` 쿠키(12시간, SameSite=Lax) + CSRF 토큰 쿠키**. 어드민 화면(apps/admin)은 Next.js rewrites로 `/api/v1/*`를 API에 same-origin 프록시하므로 브라우저에 교차 출처 쿠키 설정이 필요 없다(SEC-102, `apps/admin/next.config.js` 참조).
  - 종전(라운드 4): "관리자 JWT(1시간) 발급, `Authorization: Bearer`로 전송" — 쿠키 세션으로 대체됨.
- 비밀번호는 scrypt 해시로 저장(`admin_users.password_hash`), 원문은 어디에도 저장·로그되지 않는다.
- brute-force 방어: email+IP당 15분에 5회 실패 초과 시 429. MFA 코드도 별도로 15분/5회 잠금(SEC-101 §10).
- 로그인 성공/실패, MFA 이벤트는 audit_logs에 기록된다.
- 비밀번호 변경: `POST /api/v1/admin/auth/change-password` `{ currentPassword, newPassword }` (ADM-007 — 임시 비밀번호를 받은 새 관리자가 MFA 등록 전에 먼저 돌릴 수 있게 MFA 게이트 면제).

### MFA 강제 등록 흐름 (SEC-101)

MFA 미등록 계정은 로그인 후에도 등록 전까지 `ADMIN_MFA_SETUP_REQUIRED`(403)로 대부분의 라우트가 막힌다(면제: me/logout/change-password/mfa setup). 등록 절차:

1. `POST /api/v1/admin/auth/mfa/setup/start` → TOTP secret + otpauth URL(어드민 화면이 QR로 표시).
2. 인증 앱(예: Google Authenticator)에 등록 후 `POST /api/v1/admin/auth/mfa/setup/verify` `{ code }` → 성공 시 **복구 코드 10장**(1회만 표시) 발급.
3. 이후 로그인은 항상 비밀번호 + TOTP 2단계. TOTP 분실 시 복구 코드로 로그인(1장당 1회 소진 — 로그인 응답의 `mfaRecoveryCodesRemaining`으로 잔량 확인).
4. 해제는 `POST /api/v1/admin/auth/mfa/disable` `{ code }` — 해제하면 다시 강제 등록 게이트에 걸린다.

### 레거시 `x-admin-token`

`WOORIAI_ADMIN_TOKEN` 공용 토큰은 **NODE_ENV=development/test에서만** 동작한다. production에서는 어떤 값이 설정돼 있어도 403. NODE_ENV 미설정 환경도 production으로 취급된다.

## 역할

| 역할 | 권한 |
|---|---|
| `admin` | 전체 (조회·수정·관리자 계정 관리) |
| `editor` | 준비템·상품 링크·고지 생성·수정 + 조회 |
| `analyst` | 조회·클릭 통계만 (모든 수정 403) |

권한은 서버 라우트 가드(`@RequireAdminRoles`)에서 강제한다. 화면 숨김은 보조 수단일 뿐이다.

## 관리자 계정 생성·관리

- 시드(첫 계정): `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` 환경변수 설정 후 `pnpm db seed`. role은 admin.
- 개발 기본값(env 미설정 + development 한정): `admin@wooriai.local` / `wooriai-dev-admin`.
- production에서 env 미설정 시 admin 시드는 생성되지 않는다(경고만 출력). 운영 첫 계정은 반드시 강한 비밀번호로 env를 지정해 시드하라. 재시드해도 기존 관리자의 비밀번호·활성 상태는 되돌리지 않는다(ADM-007).
  - ⚠️ **두 시점(라운드 107 트랙 E)**: ADM-007의 이 배려는 오랫동안 `admin_users` **하나에만** 있었고 **그때는 그것이 사실이었다** — 콘텐츠 다섯 표(`categories`·`item_templates`·`item_template_stages`·`disclosures`·`product_links`)는 재시드가 **어드민에서 고친 값을 시드 값으로 되돌렸다**. 오늘은 다섯 표도 같은 규율을 따른다: **시드는 없는 행을 만들 뿐, 있는 행의 콘텐츠를 고치지 않는다**(`apps/api/prisma/seed.ts:33`, 경계 표 `:42~49`, 회귀 고정 `apps/api/test/seed-boundary.db.test.ts`). 그래서 이 콘솔에서 고친 값은 다음 배포의 시드를 살아남는다. 되돌리는 길은 명시적 opt-in `SEED_OVERWRITE_CONTENT=1`뿐이고 배포 경로는 그 값을 설정하지 않는다.
- **추가 계정/역할 변경: 관리자 계정 관리 API·화면 완성(ADM-006)** — admin 역할 전용.
  - `GET /api/v1/admin/users` 목록 · `POST /api/v1/admin/users` 생성(임시 비밀번호를 응답에서 **딱 한 번** 반환) · `PATCH /api/v1/admin/users/:id` role/active 변경(본인 강등·비활성화는 차단).
  - 어드민 화면 **관리자 계정** 메뉴(`/users`)에서 동일 작업 가능. 새 관리자는 임시 비밀번호로 첫 로그인 → 비밀번호 변경 → MFA 등록 순.
  - 종전(라운드 4): "추가 계정/역할 변경은 현재 DB 직접 조작(관리자 계정 관리 API는 후속): `UPDATE admin_users SET role='editor' WHERE email='...';`" — API·화면 완성으로 대체됨. DB 직접 조작은 더 이상 권장하지 않는다(감사 로그가 남지 않음).

## 운영 접근 경로 (LP-D)

어드민 웹은 프로덕션 compose 기본 구성(`docker-compose.prod.yml`)에 **포함되어 있지 않다**. 접근 경로는 두 가지:

### ⓐ 운영자 로컬 프록시 — 기본 권장

운영자 PC에서 어드민 dev 서버를 띄우고 `/api/v1/*`를 운영 API로 프록시한다. VM에 아무것도 추가 배포하지 않아 공격면이 늘지 않고, 어드민 UI 버전도 로컬 체크아웃으로 즉시 최신화된다.

```bash
# 저장소 루트에서 (pnpm install 완료 상태)
ADMIN_API_PROXY_TARGET=https://<도메인> pnpm --filter admin dev
# → http://localhost:3001 접속 후 로그인 (쿠키는 localhost same-origin으로 동작)
```

`<도메인>`은 운영 API의 origin(예: `https://wooriai.duckdns.org`). 브라우저는 localhost를 secure context로 취급하므로 production API가 붙이는 `Secure` 쿠키도 정상 동작한다.

### ⓑ VM 오버레이 배포 — 선택

어드민을 API와 같은 VM에 컨테이너로 올린다. `infra/docker/docker-compose.admin.yml` 오버레이 사용:

```bash
cd /opt/wooriai
sudo docker compose -f infra/docker/docker-compose.prod.yml \
  -f infra/docker/docker-compose.caddy.yml \
  -f infra/docker/docker-compose.admin.yml \
  --env-file .env.production up -d --build admin
```

기본은 **외부 미노출**(VM 루프백 127.0.0.1:3001 바인딩). 운영자는 SSH 터널로 접속한다:

```bash
ssh -N -L 3001:127.0.0.1:3001 ubuntu@<VM IP>
# → 브라우저에서 http://localhost:3001
```

- 이미지는 `infra/docker/admin.Dockerfile`(Next.js standalone, node:22-slim 2단계 빌드). rewrites의 API 프록시 타깃은 **빌드 타임에 구워지며** 기본값이 compose 내부 주소 `http://api:3000`이라 오버레이에서는 추가 설정이 필요 없다.
- 공개 HTTPS 노출이 정말 필요하면 Caddyfile에 어드민 서브도메인 블록(`reverse_proxy admin:3001`)을 추가한다 — 오버레이 파일 머리 주석 참조. 노출 전 admin 계정 전원의 MFA 등록을 확인할 것.
- `oracle-bootstrap.sh`는 어드민을 배포하지 않는다(의도적 — 기본 경로는 ⓐ). 위 명령을 VM에서 직접 실행하는 것이 추가 가동 절차의 전부다.

## 감사 로그

준비템·상품링크·고지의 생성·수정, 관리자 로그인/MFA 이벤트, 관리자 계정 생성·변경(ADM-006)이 `audit_logs`에 actor·before/after·timestamp와 함께 기록된다. admin 역할은 어드민 화면 **감사 로그** 메뉴에서 조회할 수 있다.

⚠️ **before/after 봉투에 들어가는 것은 정해져 있다** — 이 화면(과 그 화면의 CSV)이 내미는 값이므로 여기 적어 둔다. 봉투를 하나라도 다는 action의 **전수 대장**은 `apps/api/test/audit-envelope-fields.test.ts`(before·after 둘 다 다는 자리 **열넷** · after만 다는 자리 **열아홉**)이고, 그 파일이 `apps/api/src/**`를 스윕해 대장과 정확히 일치하는지를 계약으로 문다 — 아래 두 줄은 그 대장의 **사본**이고 원본은 그 테스트 파일이다.
- **이용자가 직접 적은 자유 문자열은 봉투에 실리지 않는다.** 지출 봉투(`expense.update`·`expense.delete`)는 전용 스냅샷(`toExpenseAuditSnapshot`)의 키 열뿐이고 품목명·판매처·메모는 `changed`의 **축 이름으로만** 남는다(라운드 107 트랙 A). 가구 봉투(`household.member.remove`·`household.invite.cancel`)도 전용 스냅샷이라 닉네임 원문과 계정 연결값이 봉투 안에 없다(라운드 108 트랙 B) — 사람을 지목하는 값은 봉투 **밖**의 `actor_user_id`·`target_id`가 참조로만 들고, 그 둘은 파기 잡이 실제로 지운다. ⚠️ **두 시점**: 라운드 107 이전의 옛 **지출** 봉투에는 그 셋이 실제로 실려 있었고, 그 옛 행은 파기 잡 **12단계**(`expenseSnapshotScrub`)가 지우며 `snapshotScrubbedAt` 표식을 남긴다.
  - ⚠️ **두 시점(이 이월은 갚았다)**: 종전 이 자리는 *"가구 봉투 쪽은 **쓰기 경로만** 고쳐졌고 12단계의 action·키 목록에는 그 둘이 아직 없다"* 고 적었고 **그때는 참이었다**. → 이제 12단계가 `household.member.remove`·`household.invite.cancel`도 함께 씻는다: action 목록에 그 둘, 키 목록에 `displayName`·`userId`·`invitedByUserId`가 들어갔다(`apps/api/src/worker/jobs/data-retention-purge.job.ts`의 `LEGACY_SNAPSHOT_ACTIONS`·`LEGACY_SNAPSHOT_SCRUB_KEYS`). 지출 봉투와 **똑같이** `snapshotScrubbedAt` 표식이 붙고, `id`·`householdId`는 남는다(감사 행의 `target_id`·`household_id`가 이미 같은 값을 든다). 실측(2026-09-07, 로컬 `wooriai_test`): 옛 모양 24행(두 action 각 12행) → 잡을 돌린 뒤 **0행**, 두 번째 틱은 0건(선택 술어가 곧 *"아직 그 키를 들고 있다"* 라 멱등·자기 종료). 계약은 `apps/api/test/legacy-audit-snapshot-scrub.db.test.ts`가 진다.
    - **확인 필요(남은 몫)**: 운영 DB에 옛 행이 몇 건인지는 이 문서가 알지 못한다(운영에서 세어야 하는 값이다). 12단계는 배치당 `DEFAULT_PURGE_BATCH_SIZE`만 집으므로, 백로그가 크면 **여러 틱에 걸쳐** 0으로 수렴한다 — 잡 요약의 `expenseSnapshotsScrubbed`가 0이 될 때까지가 그 창이다.
    - ⚠️ **이름 주의**: 12단계의 phase id(`expenseSnapshotScrub`)와 요약 키(`expenseSnapshotsScrubbed`)의 `expense…` 철자는 **역사적 이름**이다(대상은 지출 둘 + 가구 둘). 운영 로그·런북 상호 참조를 끊지 않으려고 그대로 두었고, 근거는 그 상수의 머리말에 있다.
    - ⚠️ **이월(이 트랙 밖)**: `apps/api/test/audit-envelope-fields.test.ts:312~319`의 주석은 아직 *"12단계에 그 둘이 없다"* 고 적혀 있다 — 그 파일은 이 변경을 만든 트랙의 소유 밖이라 손대지 않았다. **오늘 그 문장은 거짓**이고, 그 파일을 다음에 만지는 사람이 위 두 시점으로 갱신해야 한다(그 주석은 단언이 아니라 서술이므로 테스트는 초록 그대로다).
- **`admin.*` 봉투는 다르다** — 어드민이 스스로 적은 카탈로그·고지 문자열이라 원문이 그대로 남는다(이 화면을 볼 자격이 있는 사람에게는 새 노출면이 아니다).
