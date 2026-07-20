# WooriAI MOD_V1 Codex Gap Matrix

## 감사 기준선

- 작업 루트: `F:\WooriAI`
- 브랜치 / HEAD: `codex/sprint2-catalog-payments` / `db7a7a455afec892b8fa1205e477dbe507a5931d`
- 감사 시작 시 dirty 항목: 577개. 기존 변경을 보존하며 reset, checkout, stage, commit, push, deploy를 하지 않는다.
- 제품 진실 소스: 실제 React Native 화면, Zustand/React Query 상태, 모바일 API client, Nest API, Prisma/PostgreSQL 계약.
- 프로토타입의 로컬 state, fixture 숫자, `noop`, 가짜 Snackbar 성공은 화면 구조/카피 참고용이며 제품 구현 근거로 사용하지 않는다.

## 문서 충돌과 결정

| 충돌 | 낮은 우선순위 근거 | v2 결정 | 적용 |
|---|---|---|---|
| 하단 탭 수 | 기존 AGENTS/Pixel Lock과 디자인 시스템 readme는 4탭 | 기능정의서·화면정의서 v2의 5탭 `홈/기록/준비템/리포트/프로필`이 우선 | 프로필을 가장 오른쪽의 실제 탭으로 노출. 기존 4탭 reference 점수는 별도 회귀 위험으로 보고 |
| 온보딩 단계 | 기존 native 흐름과 `_ds_bundle.js`는 6/4단계 | v2의 3개 가시 단계 `아이 정보/준비 현황/월 예산` | 세부 임신/출생 분기는 1단계 내부 폼으로 유지하고 review는 제출 확인 상태로 합침 |
| 브랜드 색 | legacy coral `#EF6644/#DB4F2E` | token CSS의 Seed `#C94627` | primary/action/active tab의 canonical token으로 매핑, legacy key는 alias로만 보존 |
| 배경 | 기존 cream `#FFF8F1` | token CSS `#FFFDFC` | canvas token을 `#FFFDFC`로 통일 |
| 상태 enum | 생성 번들은 제한된 sync/item 상태 | v2 + 실제 domain 상태가 우선 | sync 5상태와 item 8상태를 라벨과 함께 지원 |
| prototype 성공 | 하이파이 HTML은 예산/알림/내보내기를 local state와 snackbar로 성공 처리 | 실제 mutation/응답 전에는 성공 금지 | 실 API가 없는 기능은 비활성/정직한 한계 표기 |

## 화면·기능 Gap Matrix

| ID / 기능 | 현재 파일 | 감사 시작 상태 | MOD_V1 목표 | 차이 / 근본 원인 | 수정 대상 | 검증 | 상태 |
|---|---|---|---|---|---|---|---|
| DS / tokens | `apps/mobile/src/theme.ts`, `src/design-system/tokens/*` | legacy coral/cream과 신규 token이 이중화 | Seed, canvas, surface, text, semantic, spacing/radius/type/motion 단일 계약 | primary `#C94627`, canvas `#FFFDFC`, text `#211E1C` 불일치 | theme + native tokens + DS tests | token/hex/size contract test | 완료 |
| DS / common components | `src/design-system/*` | 일부 공통 primitive 존재, manifest 32종 중 이름/계약 누락 | native inventory를 재사용 가능하게 확장 | BudgetSummary, MoneyField, TopAppBar, CheckCard 등 화면 계약이 분산 | DS index/components | direct-render + a11y tests | 완료 |
| DS / accessibility | `AppScreen`, scaffold, controls | 48dp 일부 적용, safe area/keyboard 존재 | 48dp, font scale 1.5, role/state/label, reduce motion, 320~840dp | 화면별 inline style와 고정 보정 존재 | common scaffold/primitives | render/style contract + installed 1.5/TalkBack smoke | 완료 |
| NAV / 5 tabs | `app/(tabs)/_layout.tsx`, `more.tsx` | `more` route가 `href:null`로 숨겨져 실제 4탭 | 5탭, 프로필 우측, 어느 탭에서든 1탭 | tab table은 5개이나 fifth screen 숨김 | tabs layout + route tests | 5 labels/order/a11y + installed XML | 완료 |
| AUTH-01 | `app/(auth)/login.tsx`, `src/auth/*`, API auth | 필수 약관 fail-closed와 카카오 실제 OIDC 있음. Apple 서버/native 구현 없음 | 카카오·Apple, 필수 동의 전 CTA disabled | Apple은 client type 문자열 외 실제 provider가 없음 | login + auth capability copy/test; Apple은 실 provider 없으면 비활성으로 정직하게 표시 | consent gate/provider availability | 부분 충족 |
| ONB-01~03 | `app/onboarding/*`, `src/onboarding/*`, draft store/domain | 안전한 draft v3/기본 50만원/atomic completion은 구현, UI는 6단계 + 별도 review | 3개 가시 단계, 복원, 12품목, 기본 500,000원 실저장 | 기존 path 선택/상세/review가 별도 step으로 노출 | onboarding screens/resume/steps/tests | restart/date/grid/submit tests + final fresh flow | 완료 |
| HOME-01 | `app/(tabs)/index.tsx`, `/home` API | 실 query와 empty/error 존재. quick action은 spec 순서/구조와 다르고 sync bar 없음 | child+notification, warm copy, solid BudgetSummary, 4 actions, real nudge, recent 3, sync | legacy HeroSummary/자주기록 중심, profile 상단 중복 | home + common BudgetSummary/SyncStatus | query/render/empty/over-budget + installed restart | 완료 |
| REC-01/02 | `records.tsx`, `expenses/new.tsx`, offline engine | 실 expense query/mutation/offline queue 존재 | 검색/필터/date group/FAB/bottom sheet, create/edit validation parity | 생성/수정은 공용 validator와 attribution field를 공유하지만 완전한 단일 form component는 아님 | records/new/detail/form helper | create/edit/offline/draft tests + installed create | 부분 충족 |
| ITEM-01/02 | `items.tsx`, `items/[id].tsx`, catalog/item-plan API | 실 published-only catalog와 item plans 존재 | 맞춤/전체/내 준비함, 8상태, detail CTA disclosure | 상태 표현과 3열 visual 계약 부분 불일치 | item screens + status components | status/filter/disclosure tests + installed 8-state sheet | 완료 |
| REP-01 | `reports.tsx`, report v2/v3 API | 실 source-bound report와 접근성 데이터 경로 있음 | month/quarter/year, maturity gates, chart+same-source table | fixture Report V3가 raw category UUID를 label로 반환하던 런타임 결함 추가 발견 | reports + DS chart/table + local report adapter | maturity/source parity + installed chart/table | 완료 |
| PF-01 | `more.tsx`, `profile.tsx`, home/children/member/budget queries | hidden more hub + separate account profile, child only summary | family summary + 4 sections + sync + logout | 설정 진입점 분산, family/member/budget/notification summary 미조합 | visible profile tab/hub | hub real-query/loading/error/a11y + installed profile | 완료 |
| PF-02 | `children/[id].tsx`, onboarding form helpers | 실 수정 API/단계 계산 있음 | onboarding child form 재사용, 저장 후 hub 복귀 | 날짜/단계 계약은 공유하지만 onboarding 전체 폼 component 재사용은 아님 | child edit/shared form | update/date/stage invalidation | 부분 충족 |
| PF-03 | `family/index.tsx`, `family/invite.tsx`, household API | 실 members/RBAC/invite 있음. API TTL 7일 | role chips, 초대 24시간, 마지막 admin 보호 | `INVITE_TTL_MS`가 7일 | household runtime/family UI/tests | TTL/expired/last-owner | 완료 |
| PF-04 | `budget.tsx`, budget API | 실 upsert와 query 있음 | 0 금지, current month, 즉시 home/report 반영 | invalidation/role/copy 대조 필요 | budget screen/query invalidation | mutation/cache/rollback | 완료 |
| PF-05 | `notification-preferences.tsx`, notification API | 5종 + 별도 저장, test session read-only | v2 4종, toggle 즉시 저장, marketing opt-in timestamp, failure rollback | UI/contract 불일치, query key household scope 없음 | notification screen/API contract if supported | optimistic rollback/summary | 완료 |
| PF-09 | `import/*`, API import | xlsx/csv import preview-confirm 있음. export 제품 경로 없음 | xlsx import+export와 실패행 report | import는 충족 가능, export는 실 API/파일 생성 경로 미확인 | profile routing/report limitation | format/preview/confirm | 부분 충족 |
| PF-10 logout/legal/version | `profile.tsx`, `settings/privacy.tsx` | 실제 logout/consent/privacy/version 진입 존재 | hub 하위 실제 접근 + confirm | 별도 account screen으로 분산 | profile hub/routes | navigation/logout | 완료 |
| PF-10 account deletion | settings/privacy + PrivacyService | 요청 즉시 token/device/membership/user 접근 철회 및 delete job enqueue | 7일 유예, 삭제 안내, 유예 중 취소 | dueAt 미사용, cancel endpoint/UI 없음 | PrivacyService/controller/mobile client/privacy UI/tests | request/due/cancel/job-before-due | 완료 |
| Sync 상태 | offline engine + `AsyncState.SyncStatusBar` | label/tone only, domain normalization 없음 | synced/syncing/offline/pending/conflict 정확 표시 | 공통 상태 enum/label/icon mapping 부재 | offline mapper + DS | five-state matrix | 완료 |
| Visual qualification | `pixel:android`, MOD reference HTML | 기존 9-screen reference는 구 IA/색상 | MOD reference와 installed Android 390dp 비교, 320~840 responsive | 구 4탭 numeric reference는 v2 5탭과 구조 충돌 | test harness/artifacts/report | final source-bound adb screencap/XML, font 1.5, TalkBack smoke | 부분 충족 |

## 완료 판정 규칙

- `완료`는 코드, 관련 테스트, 실행 증거가 모두 있을 때만 사용한다.
- `부분 충족`은 실제 제품 경로 중 일부만 존재하거나 외부 provider/서버 기능이 없는 경우다.
- production catalog는 published-only/fail-closed를 유지하며 fixture 시각 증거를 production 성공으로 보고하지 않는다.
- 기존 Pixel Lock 4탭 reference와 v2 5탭의 충돌은 새 명세를 훼손해 점수를 맞추지 않고 별도 결과로 보고한다.

## 최종 실행 근거

- 2026-07-18 full-gate 소스 snapshot: `90BB15D798922EB2376EE460249C9A4AA06FDC99AABC2A3E380B61CD266DED80`, 878 files / native-explicit 82.
- 2026-07-19 카테고리명 후속 snapshot: `306E95F606459277796BBEC1B59E00070F6139A84B56432C1E0DC89095E384C4`, 878 files / native-explicit 82. 후속 변경은 targeted 25 tests/typecheck/설치 Android로 검증했고 full release gate는 재실행하지 않았다.
- 최종 `release:gate`: 11/11 PASS (`2026-07-18T22:42:42.694Z`).
- Mobile: 76 files / 424 tests PASS. API E2E: 22 files / 122 tests PASS. Domain: 12/78, contracts: 5/41 PASS.
- Strict UX: 51 routes, design-system/scaffold 100%, raw color 0, unicode icon 0. Source quality: 14 files / finding 0.
- 현재 standalone APK: SHA-256 `6173BBE234DE1D21DB18D6B294B7DBBB5612F90F8CD0F7C6E61AA7B1C8FD6FCB`, source binding `BOUND`, x86_64, debug-internal-only.
- Installed Android: final fresh install, 3단계 온보딩, picker, 전체 선택/해제, 없음, 500,000원, restart 복원, 완료, HOME/5탭, item 8상태, expense/report 표, profile, font 1.5, TalkBack bound-service/focus smoke.
- 숫자 기반 기존 `pixel:android` 9-screen score는 4탭 reference와 v2 5탭의 의미 충돌 때문에 MOD_V1 통과 근거로 사용하지 않았다.
