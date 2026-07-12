# 환경 설정 (Environment Setup)

작성: 2026-07-12 · 기준 커밋: codex/source-audit-standalone-apk

## 1. 필수 런타임

| 도구 | 확인된 버전 | 비고 |
|---|---|---|
| Node | 25.2.1 (검증 환경) / `package.json` engines 없음 | 20 LTS 이상 권장 |
| pnpm | 11.7.0 (`packageManager` 고정) | `npx --yes pnpm@11.7.0 <script>` 로 실행 가능 |
| JDK | 17.0.19 | Android Gradle 빌드용 |
| Android SDK | compile 35 / build-tools / platform-tools | `ANDROID_HOME` 또는 기본 경로 |
| Gradle | 8.10.2 (wrapper) | 별도 설치 불필요 |

## 2. 환경변수 (.env.example 기준)

```
NODE_ENV=development
PORT=3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1

DATABASE_URL=postgresql://wooriai:...@localhost:5432/wooriai_dev
REDIS_URL=redis://localhost:6379

S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY

JWT_ACCESS_SECRET=...        # 프로덕션 필수 (미설정 시 기동 실패)
JWT_REFRESH_SECRET=...       # 프로덕션 필수 (미설정 시 기동 실패)
WOORIAI_ADMIN_TOKEN=...      # 관리자 API 토큰 (프로덕션 필수)

OAUTH_KAKAO_CLIENT_ID / OAUTH_APPLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_ID
AFFILIATE_DISCLOSURE_TEXT=...
```

### 프로덕션 시크릿 검증 (이번 세션에서 강화)

- `NODE_ENV`가 명시적으로 `development` 또는 `test`가 **아니면**(스테이징·미설정 포함) `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`WOORIAI_ADMIN_TOKEN`이 **필수**이며, `apps/api/src/main.ts`의 `bootstrap()`에서 **기동 시 fail-fast**한다(요청 시점이 아니라 부팅 시점).
- 검증 명령: `pnpm check:env` (실제 `.env`), `pnpm check:env:example` (플레이스홀더 허용).

## 3. 빌드/실행에 필요한 값이 없을 때

| 값 | 발급처 | 용도 | 없을 때 |
|---|---|---|---|
| `OAUTH_KAKAO/APPLE/GOOGLE_CLIENT_ID` + 시크릿 | 각 OAuth 콘솔 | 실 소셜 로그인 | 프로덕션에서 `oauth-login`이 501 반환(가짜 로그인 차단). dev/test는 결정론적 스텁 유저 |
| `DATABASE_URL` (PostgreSQL) | 운영 인프라 | 영속 저장 | API는 인메모리로 기동(재시작 시 소실) — 스키마/마이그레이션은 `docs/3차/db_api` + `prisma`에 존재하나 런타임 미연결 |
| 릴리즈 keystore | 릴리즈 오너 | 스토어 배포 서명 | debug keystore로 서명(테스트 설치용, 스토어 배포 불가) |
| 실 제휴/커머스 링크 | 제휴사 | 실제 구매 이동 | example.com dev 링크 |

키가 없어도 앱 전체가 기동 실패하지 않도록 기능 경계가 분리되어 있으며, **프로덕션에서는 가짜 성공을 반환하지 않는다**(스텁은 dev/test 한정).

## 4. 표준 명령

```bash
# 의존성
npx --yes pnpm@11.7.0 install --frozen-lockfile

# 정적 검사
npx --yes pnpm@11.7.0 typecheck
npx --yes pnpm@11.7.0 lint

# 테스트
npx --yes pnpm@11.7.0 test
npx --yes pnpm@11.7.0 --filter api test:e2e

# 전체 릴리즈 게이트 (10 게이트)
npx --yes pnpm@11.7.0 release:gate

# 독립 실행형 테스트 APK (EXPO_PUBLIC_TEST_LOGIN=1, Metro 불필요)
npx --yes pnpm@11.7.0 android:build-apk
```
