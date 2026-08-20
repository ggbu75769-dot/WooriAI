# 기능 추적 매트릭스 (Feature Traceability Matrix)

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk

> **⚠️ 2026-08-14 갱신 주의**: 이 매트릭스는 라운드 4 이전 시점 기준이며 일부 행이 stale합니다.
> 특히 ADM 행의 "PARTIAL(토큰 인증, 인메모리)"은 현행과 다릅니다 — 라운드 4에서 PostgreSQL/Prisma로
> 전환됐고, 라운드 5A에서 관리자 인증이 세션 쿠키 + CSRF + TOTP MFA로 교체됐으며(레거시 x-admin-token은
> dev/test 전용 fail-closed), Round 5B에서 관리자 계정 관리 API/UI(ADM-006)가 추가됐습니다.
> 현행 전체 기능 상태는 `docs/5차/round5b-feature-review-and-sellable-design.md` §1을 기준으로 보십시오.

상태 범례: **COMPLETE**(실저장·예외처리 완료) / **PARTIAL**(일부 동작) / **STUB**(의도된 개발 스텁) / **DEMO**(픽셀락 고정 데모 데이터). 검증: APK(에뮬레이터 런타임) / TEST(자동) / SRC(소스) / UNVERIFIED.

| 기능 ID | 화면 | 요구사항 | 구현 파일 | API | DB/저장 | 테스트 | 상태 | 검증 | 외부 의존 |
|---|---|---|---|---|---|---|---|---|---|
| SPL-001 | 스플래시 | 실행 애니메이션→로그인 | `app/launch-animation.tsx`, `app/index.tsx` | — | — | pixel-lock-flow | COMPLETE | APK | — |
| AUTH-001 | 로그인 | 동의 후 로그인, 세션 저장 | `app/(auth)/login.tsx` | `auth/*` | session persist | test-login-flow | COMPLETE(테스트 로그인) | APK | 실 OAuth |
| ONB-001~004 | 온보딩 | 아이/단계/준비/예산 | `app/(onboarding)/*` | `onboarding/*` | local/서버 | onboarding-flow | COMPLETE | TEST | — |
| HOME-001 | 홈 | 누적·이번달·예산·잔여·준비템·최근 | `app/(tabs)/index.tsx` | `getHome` | expensesForChild 집계 | real-session-data-integrity | COMPLETE | APK | — |
| EXP-001 | 빠른 지출 | 10초 기록, 카테고리, 연타 방지 | `app/expenses/new.tsx` | `createExpense` | expenses | android-native-ui-quality | COMPLETE(카테고리 고유 id·빈값 가드 수정) | APK재검증 | — |
| EXP-003 | 지출 상세 | 수정, soft delete 2단계 | `app/expenses/[expenseId].tsx` | `updateExpense`/`deleteExpense` | soft delete + audit | expense-home-report e2e | COMPLETE | APK | — |
| EXP-004 | 기록 목록 | 이번 달 합계·목록 | `app/(tabs)/records.tsx` | `listExpenses` | 현재 월(Seoul) | — | COMPLETE(2026-07 하드코딩 제거) | APK재검증 | — |
| BUD-001 | 예산 | 설정/수정, 미설정 상태 | `app/budget.tsx` | `getBudget`/`upsertBudget` | budgets(현재 월) | — | COMPLETE | SRC/TEST | — |
| ITEM-001 | 준비템 목록 | 단계별·상태 탭 | `app/(tabs)/items.tsx` | `listItems` | itemStatuses | items-commerce-flow | COMPLETE(연령칩 실필터·죽은버튼 제거) | APK재검증 | — |
| ITEM-002~004 | 상품 상세 | 필수도·이유·제휴 고지·링크 | `app/items/[itemTemplateId].tsx` | `getItemDetail`/`clickProductLink` | 클릭 로그(API) | items-commerce e2e | COMPLETE(허위 평점/가격 실세션 제거) | APK재검증 | 실 커머스 링크 |
| REP-001/002 | 리포트 | 월/분기/연/누적/카테고리 | `app/(tabs)/reports.tsx` | `getMonthlyReport`/`getYearlyReport`/`getCategoryReport` | 동일 집계 헬퍼 | expense-home-report e2e | COMPLETE(카테고리 한국어명·현재월) | APK재검증 | — |
| FAM-001~003 | 가족 | 초대·역할·멤버 삭제 | `app/family/*` | `households/*` | 멤버·초대 | family-invite e2e | COMPLETE(owner 삭제·RBAC) | TEST/APK | 카카오 공유 |
| IMP-001~003 | 엑셀 업로드/미리보기 | 승인 전 미저장 | `app/import/index.tsx` | `createExcelImport` | — | import-excel e2e | DEMO(픽셀락) + STUB(파싱) | APK/TEST | AI 분석 키 |
| IMP-004 | 임포트 검수 | 신뢰도·중복·승인 | `app/import/[importJobId].tsx` | `confirmImport` | 원자적 저장 | import-excel e2e | COMPLETE | TEST | — |
| SET-001/002 | 설정 | 메뉴·프로필 | `app/settings/index.tsx`, `app/(tabs)/more.tsx` | `settings/*` | — | — | PARTIAL(라벨-동작 불일치 P2) | APK | — |
| SET-003/004 | 개인정보 | 로그아웃·삭제·탈퇴 2단계 | `app/settings/privacy.tsx` | `settings/*` | soft delete + 로컬 정리 | — | COMPLETE(삭제 후 라우팅·로컬 리셋 수정) | APK재검증 | — |
| ADM-001~004 | 관리자 | 준비템·링크·제휴 관리 | `apps/admin` + `apps/api/src/admin/*` | `admin/*` | 인메모리 | admin-settings e2e | PARTIAL(토큰 인증, timing-safe 수정) | TEST | 관리 UI 확장 |
| ERR-001 | 오류/빈/오프라인 | 로딩·에러·재시도·빈 상태 | 전 화면 공통 `src/ui.tsx` | — | — | — | COMPLETE | APK/SRC | — |

## 보안·정합성 교차 요구사항

| 요구 | 구현 | 검증 |
|---|---|---|
| 서버/DB 레벨 권한 | `requireChildAccess`/`assertOwner`/`canEdit` (서비스 계층) | TEST(e2e) |
| IDOR 차단(타 가구 id) | 전 조회·수정·삭제 경로 접근 검사 | TEST(e2e) |
| soft delete 집계 제외 | 단일 `expensesForChild` 헬퍼 `!deletedAt` | APK/TEST |
| 선물 지출 제외 | `expenseType === "expense"` 필터 | TEST |
| 승인 전 임포트 미저장 | confirm에서만 createExpense | TEST(e2e) |
| 제휴 고지 CTA 인접 | 상품 상세 구매 버튼 위 `AffiliateDisclosure` | APK |
| 프로덕션 시크릿 fail-fast | `main.ts` 부팅 검증 | TEST |
| 프로덕션 OAuth 차단 | `auth.service.ts` 501 | TEST |
