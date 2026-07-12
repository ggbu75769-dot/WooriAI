# 릴리즈 런북 (Release Runbook)

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk

## 1. 배포 전 체크리스트

- [ ] `npx --yes pnpm@11.7.0 install --frozen-lockfile` 성공
- [ ] `npx --yes pnpm@11.7.0 release:gate` 10/10 PASS
- [ ] 프로덕션 env 설정: `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WOORIAI_ADMIN_TOKEN`, `DATABASE_URL`, OAuth client id/secret, `EXPO_PUBLIC_API_BASE_URL`(https)
- [ ] `pnpm check:env` 통과 (누락 시 API 부팅 실패)
- [ ] DB 마이그레이션: `prisma migrate deploy` (인메모리 → PostgreSQL 전환 시)
- [ ] seed: 카테고리·초기 준비템 카탈로그 (`docs/3차/db_api/wooriai_phase3_schema_v0_3.sql` §5 SEED CATEGORIES)
- [ ] 관리자 계정/토큰 발급 및 안전 보관(`WOORIAI_ADMIN_TOKEN`)
- [ ] 릴리즈 keystore 준비 + Gradle signingConfig 연결 (스토어 배포 시)
- [ ] applicationId를 실제 패키지명으로 변경 (현재 `com.anonymous.wooriai`)
- [ ] 개인정보처리방침·이용약관·제휴 고지 접근 경로 확인(설정 → 개인정보)
- [ ] 로그·오류 추적(Sentry 등) 연결 지점 확인

## 2. 빌드 산출물

```bash
# 독립 실행형 테스트 APK (EXPO_PUBLIC_TEST_LOGIN=1, 온디바이스 로컬 백엔드)
npx --yes pnpm@11.7.0 android:build-apk
# → artifacts/android/wooriai-0.0.0-release.apk (+ .json 리포트)

# 실서버 연동 릴리즈 빌드 (TEST_LOGIN=0, EXPO_PUBLIC_API_BASE_URL=https 서버)
#   릴리즈 매니페스트는 cleartext HTTP 차단 → API는 반드시 https
cd apps/mobile/android && ./gradlew assembleRelease   # 또는 bundleRelease (AAB)
```

## 3. 배포 절차

1. API 배포: env 검증 → `NODE_ENV=production`으로 기동(시크릿 미설정 시 fail-fast). 헬스체크 `GET /api/v1/health` 200 확인.
2. DB: 마이그레이션 적용 후 seed. 롤백은 `docs/qa/rollback-plan.md` 참조.
3. 모바일: 서명된 AAB를 Play Console 내부 테스트 트랙 → 단계적 확대.
4. 배포 후 스모크: 로그인 → 온보딩 → 지출 기록 → 홈/리포트 일치 → 준비템 → 설정 로그아웃.

## 4. 롤백

- API: 이전 이미지/태그로 재배포. 인메모리 프로토타입은 상태 없음. DB 전환 후에는 마이그레이션 down 또는 백업 복원(`docs/qa/rollback-plan.md`).
- 모바일: Play Console에서 이전 릴리즈로 롤백 또는 단계적 출시 중단.

## 5. 장애 대응

| 증상 | 점검 |
|---|---|
| API 부팅 실패 | 필수 시크릿 env 누락(`main.ts` fail-fast 메시지 확인) |
| 로그인 501 | 프로덕션에서 OAuth 실검증 미구현(`auth.service.ts`) — 실 OAuth 연동 필요 |
| cleartext 차단 오류 | `EXPO_PUBLIC_API_BASE_URL`이 http — https로 변경 |
| 홈/리포트 금액 불일치 | 집계 헬퍼 단일화 확인(`expensesForChild`) — 회귀 시 e2e `expense-home-report` |
| 데이터 재시작 소실 | 인메모리 상태 — DB 전환 필요 |

## 6. 알려진 외부 의존성

[known-limitations.md](known-limitations.md) 참조 — 실 OAuth, PostgreSQL, 릴리즈 keystore, 실 제휴 링크, 모니터링 SDK.
