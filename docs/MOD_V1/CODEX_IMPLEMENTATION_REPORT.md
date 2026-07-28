# WooriAI MOD_V1 구현 보고서

## 2026-07-19 추천 준비물 카테고리명 후속 수정

- 테스트 fixture의 상품명 `네이처러브 기저귀 팬티형`, `베이비 아기띠 힙시트`, `도담도담 원목 블록 세트`가 추천 카드로 전달되던 경계를 수정했다.
- 추천 preview와 item-template fixture는 `기저귀`, `아기띠`, `블록 세트` 같은 품목 카테고리명만 사용한다. 상품 판매처/제휴 링크 데이터는 별도 상세 계약에 유지한다.
- 회귀 2 files / 25 tests와 mobile typecheck가 통과했다. 최종 source snapshot `306E95F606459277796BBEC1B59E00070F6139A84B56432C1E0DC89095E384C4`로 x86_64 standalone APK를 clean rebuild/install했다.
- 설치 증거는 `docs/MOD_V1/evidence/android/43-category-only-starter-items.{png,xml}`이다. 이전 11/11 release gate는 이 후속 변경 전 실행이므로 새 snapshot의 full-gate 결과로 재사용하지 않는다.

## 1. 실행 기준선

- Workspace: `F:\WooriAI`
- Branch / HEAD: `codex/sprint2-catalog-payments` / `db7a7a455afec892b8fa1205e477dbe507a5931d`
- 시작 dirty 항목: 577개, 종료 확인 시 596개. 기존 변경과 생성물을 보존했다.
- 금지 작업: reset, checkout, stage, commit, push, deploy를 실행하지 않았다.
- Runtime: Node 20.20.2, Corepack pnpm 10.28.1, PostgreSQL 41 migrations, Android 15/API 35 x86_64 AVD.

## 2. 근거 충돌과 결정

- 기존 AGENTS/Pixel Lock 4탭 reference보다 최신 MOD_V1 v2의 5탭 `홈/기록/준비템/리포트/프로필`을 우선했다.
- 기존 6단계 표현은 3개 가시 단계 `아이 정보/준비 현황/월 예산`으로 통합했다. 임신/출생/직접선택은 1단계 내부 form이고 review는 3/3 확인 상태다.
- primary/canvas/text canonical token은 `#C94627/#FFFDFC/#211E1C`이다.
- prototype local state/snackbar는 성공 근거로 사용하지 않았다. 서버/provider가 없는 Apple login과 export는 비활성 또는 한계 문구로 표시했다.
- 구 4탭 Pixel Lock numeric score는 새 5탭 IA와 의미가 충돌하므로 MOD_V1 PASS 근거에서 제외했다. 설치 Android screencap/XML을 새 근거로 사용했다.

## 3. 구현 완료 요약

### Design system와 navigation

- color/type/elevation/motion/breakpoint token을 정리하고 `TopAppBar`, `BudgetSummary`, `MoneyField`, `CheckCard`, `PreparationItemCard`, `ItemStatusControl`, `BottomSheet`, `AccessibleDataTable`을 공용화했다.
- 48dp touch target, role/state/label, MoneyText tabular figures, 720dp content max, compact 320~479dp 정책을 적용했다.
- 프로필을 실제 다섯 번째 탭으로 노출하고 5탭 순서·label을 고정했다.

### 온보딩

- schema v3 draft, 기본 예산 500,000원, explicit skip/null, legacy migration, KST date-only, 공용 readiness/payload builder를 단일 계약으로 유지했다.
- 준비물은 393dp 세로 AVD에서 3열, 480dp 이상/가로에서 4열이며 12개 안정 code/icon registry와 전체 선택/해제·없음·나중에를 지원한다.
- Android는 native `DateTimePickerAndroid.open`만 사용하며 cancel/dismiss가 기존 값을 보존한다.
- 최종 완료는 response parse, cache/selected child/progress, replace navigation, draft 정리 순서와 persisted idempotency key/single-flight를 유지한다.
- 설치 런타임에서 추가 발견한 restart defect를 수정했다. 원인은 `app/index.tsx`가 persisted `currentStep`을 무시하고 항상 ONB-001로 redirect한 것이며 `routeForDraftCurrentStep()`에 연결했다.

### HOME, 기록, 준비템, 리포트

- HOME을 실 query 기반 child/budget/quick actions/nudge/recent/sync 구조로 정리했다.
- 기록은 search/filter/month/date grouping/FAB를 유지하고 create/edit가 공용 validation과 attribution field를 사용하도록 했다.
- 준비템은 `맞춤/전체/내 준비함`, 3/4열 grid, 8상태 `알아보기/예정/주문/보유/대여/선물/교체/종료`, 실제 mutation/invalidation sheet를 사용한다.
- 리포트는 월/분기/연간, future disable, maturity gate, 동일 `displayRows`에서 chart와 접근성 표를 렌더한다.
- 설치 런타임에서 추가 발견한 raw category UUID 노출을 수정했다. local report adapter가 공용 category resolver의 한글 label을 반환하도록 했고 production fixture-import boundary를 유지했다.

### 프로필과 API

- 프로필 허브를 실 child/member/budget/notification query와 sync/logout/version으로 구성했다.
- family role chip과 기본 `기록 가능`, 초대 TTL 24시간, budget RBAC, notification 즉시 optimistic save/rollback을 적용했다.
- marketing opt-in timestamp 필드를 추가하고 account deletion을 7일 유예/취소/기한 후 활성화 모델로 변경했다.
- current deletion 응답을 `{ deletion: object|null }` shared runtime schema로 통일했다.
- Apple provider와 export API는 실제 구현이 없어 성공을 가장하지 않는다.

## 4. 변경 파일 목록

주요 변경 경로는 다음과 같다. 시작부터 dirty worktree였으므로 전체 `git diff`에는 이 작업 이전 변경도 포함된다.

- Mobile routes: `apps/mobile/app/index.tsx`, `(auth)/login.tsx`, `(onboarding)/*`, `(tabs)/{_layout,index,records,reports,more}.tsx`, `budget.tsx`, `notification-preferences.tsx`, `settings/privacy.tsx`, `family/*`, `expenses/{new,[expenseId]}.tsx`.
- Mobile domain/UI: `apps/mobile/src/theme.ts`, `design-system/tokens/*`, `design-system/components/ModV1Primitives.tsx`, `onboarding/*`, `preparation/Release4PreparationScreen.tsx`, `expenses/*`, `offline/*`, `categories.ts`, `api/{client,local-backend}.ts`, 관련 tests.
- Shared contracts/domain: `packages/contracts/src/*`, `packages/domain/src/*`의 onboarding/date/privacy/report 연동 계약과 tests.
- API: `apps/api/src/onboarding/*`, `privacy/*`, `trust/*`, `households/household-runtime.service.ts`, Prisma schema 및 migration `000041_mod_v1_notification_marketing_opt_in`, 관련 E2E tests.
- Evidence: `docs/MOD_V1/*`, `docs/MOD_V1/evidence/android/*`, `docs/qa/evidence/onboarding-hardening-20260718-*`, `release5v-*`, `latest-release-gate.*`.

## 5. 검증 결과

| 검증 | 결과 |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS, 8/8 |
| Domain | PASS, 12 files / 78 tests |
| Contracts | PASS, 5 files / 41 tests |
| Mobile final | PASS, 76 files / 424 tests |
| API full | PASS, 65 files / 292 tests |
| API E2E | PASS, 22 files / 122 tests |
| PostgreSQL migrations | PASS, 41 migrations |
| `pnpm ux:contract --strict` | PASS, 51 routes / DS 100% / raw color 0 / unicode icon 0 |
| `pnpm mobile:source-quality` | PASS, 14 files / 0 findings |
| `pnpm release:gate` | PASS, 11/11, generated `2026-07-18T22:42:42.694Z` |
| standalone APK clean build/audit | PASS, source-bound/internal-test |

최종 release gate는 frozen install, env 44개, Prisma validate/generate, DB start, lint, typecheck, all tests, API E2E, all production builds, strict peer install을 포함한다. 종료 후 Docker PostgreSQL을 중지했다.

## 6. 시각·접근성 증거

- Evidence root: `docs/MOD_V1/evidence/android`.
- Final fresh flow: `35-final-fresh-launch`, `36-final-onboarding-1`, `37-final-child-ready`, `38-final-all-selected`, `39-final-budget-none`, `40-final-fresh-resume`, `41-final-fresh-home`.
- Android picker cancel/reopen/set: `06-date-picker`, `07-date-cancelled`, `08-child-ready`.
- 8-state sheet: `19-item-status-sheet`.
- Chart/table label parity: `32-final-report-labels`; 한글 label 3개가 chart/table에 동일하게 보이며 raw UUID는 없다.
- Profile: `33-profile`.
- Font scale 1.5: `34-font-scale-1.5-home`; HOME과 5탭 tree 유지 후 1.0 복원.
- TalkBack: `42-talkback-smoke`; service bound, HOME present, focused node present. 서비스는 종료 후 disabled/null로 복원했다.
- Category-only starter labels: `43-category-only-starter-items`; `기저귀/아기띠/블록 세트`가 보이고 상품명 token은 없다.

TalkBack 결과는 bound-service/focus/tree smoke다. 한국어 음성 발화의 인간 청취 품질과 전체 순차 탐색은 NOT_RUN이다.

## 7. Android provenance

- Source snapshot: `306E95F606459277796BBEC1B59E00070F6139A84B56432C1E0DC89095E384C4`, 878 files, native-explicit 82.
- APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`, SHA-256 `6173BBE234DE1D21DB18D6B294B7DBBB5612F90F8CD0F7C6E61AA7B1C8FD6FCB`, 69,527,638 bytes.
- Hermes: 2,696,716 bytes, SHA-256 `1433EA0B82D01F17C141D7A321E9653264193A23B26C0BF49EA63A773169A010`; generated/embedded hash 동일.
- Package: `com.anonymous.wooriai`, version `0.0.0`/code 1, Android 15/API 35, x86_64, 1080x2340/440dpi.
- Signer: Android Debug certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Audit: non-debuggable, allowBackup false, cleartext false, forbidden storage/media permission 0.
- Qualification: `INTERNAL_TEST`, debug signing/test login/local fixtures. Production/store candidate가 아니다.

## 8. 남은 미완료·위험

- Apple login provider/native/server 구현은 없다. Apple CTA는 unavailable로 표시한다.
- xlsx import는 실제 경로가 있지만 export API/파일 생성은 없다. export는 unavailable이다.
- create/edit expense는 validator와 attribution field를 공유하지만 완전히 하나의 form/sheet component로 통합되지는 않았다.
- child edit은 날짜/단계 계약을 공유하지만 onboarding 전체 form UI를 그대로 재사용하지 않는다.
- production signing, real production API URL, store identity/version, deploy, production catalog publish는 수행하지 않았다.
- 구 `pixel:android` 4탭 numeric reference는 최신 5탭 명세와 충돌한다. MOD_V1용 새 reference crop/numeric threshold gate가 별도로 필요하다.
- human auditory TalkBack pass와 320/480/840dp 각각의 실제 device screenshot은 남아 있다. 320dp/font 1.5는 render contract, 393dp/font 1.5는 installed evidence로 검증했다.

## 9. Git 상태

- 종료 확인 dirty 항목: 기본 porcelain 596개(추적 178, 미추적 entry/directory 418), `-uall` 전체 파일 전개 694개(추적 178, 미추적 file 516).
- 저장소 전체 tracked diff: 178 files, +10,992 / -2,518. 시작 전 공유 변경을 포함한다.
- destructive Git, stage, commit, push, deploy 없음.
- `git diff --stat`은 작업 시작 전 변경을 포함하므로 MOD_V1 단독 patch 크기로 해석하면 안 된다.
