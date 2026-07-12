# 관리자 CMS 접근·권한

라운드 4부터 관리자 인증은 이메일+비밀번호 로그인 + 역할 기반 권한(RBAC)이다.

## 인증

- 로그인: `POST /api/v1/admin/auth/login` `{ email, password }` → 관리자 JWT(1시간) 발급.
- 관리자 화면(apps/admin)은 로그인 폼에서 JWT를 받아 `Authorization: Bearer`로 전송한다.
- 비밀번호는 scrypt 해시로 저장(`admin_users.password_hash`), 원문은 어디에도 저장·로그되지 않는다.
- brute-force 방어: email+IP당 15분에 5회 실패 초과 시 429.
- 로그인 성공/실패는 audit_logs에 기록된다.

### 레거시 `x-admin-token`

`WOORIAI_ADMIN_TOKEN` 공용 토큰은 **NODE_ENV=development/test에서만** 동작한다. production에서는 어떤 값이 설정돼 있어도 403. NODE_ENV 미설정 환경도 production으로 취급된다.

## 역할

| 역할 | 권한 |
|---|---|
| `admin` | 전체 (조회·수정·향후 관리자 계정 관리) |
| `editor` | 준비템·상품 링크·고지 생성·수정 + 조회 |
| `analyst` | 조회·클릭 통계만 (모든 수정 403) |

권한은 서버 라우트 가드(`@RequireAdminRoles`)에서 강제한다. 화면 숨김은 보조 수단일 뿐이다.

## 관리자 계정 생성

- 시드: `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` 환경변수 설정 후 `pnpm db seed`. role은 admin.
- 개발 기본값(env 미설정 + development 한정): `admin@wooriai.local` / `wooriai-dev-admin`.
- production에서 env 미설정 시 admin 시드는 생성되지 않는다(경고만 출력). 운영 첫 계정은 반드시 강한 비밀번호로 env를 지정해 시드하라.
- 추가 계정/역할 변경은 현재 DB 직접 조작(관리자 계정 관리 API는 후속): `UPDATE admin_users SET role='editor' WHERE email='...';`

## 감사 로그

준비템·상품링크·고지의 생성·수정과 관리자 로그인 이벤트가 `audit_logs`에 actor·before/after·timestamp와 함께 기록된다.
