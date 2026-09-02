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
