# Accessibility And Offline Checklist

Batch: 12 - 라운드 33~58 신설 화면 반영 · 갱신 2026-08-28 (라운드 59 트랙 D / GAP-059 #10)
직전: Batch 11 - QA Release Hardening

> **이 문서를 읽는 법.** 항목은 세 절로 나뉜다.
> - **A절 — 코드로 고정된 계약**: 소스 스윕 테스트(주로 `apps/mobile/src/a11y-contract.test.ts`)가
>   그 계약을 붙들고 있어 회귀하면 `pnpm --filter mobile test`가 빨개진다. 릴리즈마다 사람이
>   다시 볼 필요가 없는 항목이다.
> - **B절 — 오프라인·오류 상태**: 네트워크를 끊고 손으로 밟아야 하는 흐름.
> - **C절 — 실기기 전용**: 소스로는 증명할 수 없는 것(실제 TalkBack 낭독 순서, 실측 터치 영역,
>   대비 실측, 시스템 글꼴 확대). 여기 있는 항목은 **코드 그린과 무관하게 미확인**이다.
>
> A절에 "코드 계약 없음"으로 적힌 줄은 화면은 있는데 스윕이 아직 안 붙은 자리다 — 그 줄은
> C절에서 한 번 더 나온다(사람이 봐야 하므로).

## A절. 코드로 고정된 접근성 계약

### A-1. Batch 11 이전부터의 공통 규칙

| Area | Check | Expected | 근거 |
| --- | --- | --- | --- |
| Touch targets | Buttons, toggles, and row actions are at least 44px high/wide. | No primary action is smaller than 44px. | 코드 계약 없음(치수는 스타일 상수 — C절에서 실측) |
| Contrast | Primary text, secondary text, warnings, and danger actions are readable on the configured surfaces. | No critical copy relies on low contrast alone. | `a11y-contract.test.ts` A11Y-117(작은 coral 텍스트 coral[700] 스윕) — 나머지 조합은 C절 |
| Screen-reader labels | Icon-only or terse actions have accessible labels in production UI passes. | Login, expense save, delete, purchase CTA, import confirm, settings delete are understandable. | `a11y-contract.test.ts` A11Y-101/115 |
| Numeric alternatives | Report totals, budget amounts, and chart-like summaries have visible numeric text. | Users can understand totals without color or graph interpretation. | `a11y-contract.test.ts`(라인차트 기하 요약 라벨) |
| Error text | Validation and network failures provide direct action guidance. | Users know whether to retry, edit input, or contact support. | `a11y-contract.test.ts`(로그인 오류 카드·날짜 입력 오류 live region) |
| Destructive actions | Child delete, household leave, account delete use preview and second-step confirmation. | User sees impact scope before confirming. | `a11y-contract.test.ts`(알림 모두 지우기 Alert) + `settings-flow.test.ts` |
| 내부 ID 누출 | `accessibilityLabel`에 화면 내부 ID가 새지 않는다. | 낭독에 uuid/스크린 ID가 들리지 않음. | `a11y-contract.test.ts` A11Y-115 전 컴포넌트 스윕 |
| 장식 글리프 | ♡ · › · ▣ 같은 장식 문자는 접근성 트리에서 숨긴다. | 낭독에 의미 없는 기호가 끼지 않음. | `a11y-contract.test.ts` A11Y-115 |

### A-2. 라운드 33~58 신설 화면 (2026-08-28 추가)

| # | 화면 | Check | Expected | 근거 |
| --- | --- | --- | --- | --- |
| 1 | 잠금 오버레이 (`src/security/AppLockOverlay.tsx`) | 잠금 중 배경(Stack)의 금액·품목이 접근성 트리에서 잘리는가. | 잠금 상태에서 TalkBack이 뒤쪽 화면 내용을 읽지 못한다. | `a11y-contract.test.ts` GAP-059 #3(라운드 59 트랙 C가 붙였다) — 방패가 `<Stack>`·구매 확인 카드만 감싸고 잠금 오버레이는 밖에 두는 것, 잠금 중에만 `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`가 걸리는 것, 잠금을 켜지 않은 사용자·픽셀락 빌드에는 노드가 생기지 않는 것까지 고정. 오버레이 안쪽 PIN 도트 숨김·안내 live region은 종전대로 `app-lock-gate-contract.test.ts`. **낭독 실측은 여전히 C-3** |
| 2 | 잠금 오버레이 | PIN 입력칸 라벨 + 오입력/대기 안내가 live region으로 낭독되는가. | 대기 안내가 `accessibilityLiveRegion="polite"` + `role="alert"`로 자동 낭독. | `AppLockOverlay.tsx`(고정) + `src/security/app-lock-gate-contract.test.ts` |
| 3 | 설정 > 앱 잠금 (`app/settings/app-lock.tsx`) | "지금 잠그기" 등 아이콘/짧은 액션에 라벨이 있는가. | `APP_LOCK_LOCK_NOW_A11Y_LABEL` 상수로 고정. | `app-lock-gate-contract.test.ts` |
| 4 | 정기 지출 (`app/expenses/recurring.tsx`) | 입력칸 4종(품목·금액·결제일·판매처)에 한국어 라벨, 알림 토글에 switch 역할·checked 상태, 행 액션(기록/수정/삭제)에 **품목명이 포함된** 라벨이 있는가. | 목록에서 어느 템플릿의 버튼인지 소리만으로 구분된다. | 화면에 배선돼 있으나 **a11y-contract 스윕 밖** — `recurring-flow.test.ts`가 문구를 고정. C절에서 낭독 순서 확인 |
| 5 | 정기 지출 | 저장 실패 문구가 live region인가. | 오류가 자동 낭독된다(`accessibilityLiveRegion="polite"` + `role="alert"`). | `app/expenses/recurring.tsx`(고정) |
| 6 | 동기화 상태 (`app/sync-status.tsx`) | 충돌 해결의 "내 값/서버 값" 선택이 선택 상태를 알리는가. | `accessibilityRole="button"` + `accessibilityState={{ selected }}`. | `app/sync-status.tsx`(고정) |
| 7 | 기록 탭 동기화 칩 | 대기/실패 칩이 라벨 있는 버튼으로 낭독되는가. | 칩이 "무엇이 몇 건인지"를 말하고 누를 수 있음을 알린다. | `a11y-contract.test.ts` A11Y-101 |
| 8 | 가져오기 검수 (`app/import/[importJobId].tsx`) | 행이 checkbox 역할 + checked/disabled 상태로 낭독되고, 잠긴 행은 **왜 못 고르는지**가 라벨에 들어가는가. | 미리보기 장식은 TalkBack에서 숨고 검수 안내는 보이는 텍스트로 남는다. | `a11y-contract.test.ts` A11Y-115/117 |
| 9 | 가져오기 검수 | 일괄 선택/해제 컨트롤에 라벨이 있는가. | `IMPORT_BULK_CANCEL_A11Y_LABEL` 등 상수로 고정. | `app/import/[importJobId].tsx`(고정) |
| 10 | 달력 날짜 픽커 (`src/expenses/ExpenseDatePicker.tsx`) | 날짜 셀이 button 역할 + selected 상태 + 사람이 읽는 날짜 라벨을 갖는가. 선택 불가한 날은 비활성으로 낭독되는가. | 미래 날짜/월 이동 한계에서 `accessibilityState.disabled`가 참. | `ExpenseDatePicker.tsx`(고정) + `date-picker-month.test.ts`(판정) — **a11y-contract 스윕 밖** |
| 11 | 리포트 도넛 범례 (`src/ui.tsx`) | 범례 한 줄이 "카테고리, 퍼센트, 금액"을 한 번에 낭독하고, 누를 수 있으면 **어디로 가는지**를 힌트로 먼저 말하는가. | 색만으로 구분하지 않는다(DNC 수치 병기). 드릴다운 힌트는 누르기 전에 들린다. | `src/reports/category-drilldown.test.ts`(`categoryDrilldownHint`) + `src/ui.tsx`(고정) |
| 12 | 리포트 기간 이동 | 기간 라벨이 새 기간을 알리고, 현재 기간 앞으로는 이동 화살표가 비활성인가. | "다음 달" 화살표가 미래로 넘어가지 않는다. | `a11y-contract.test.ts` A11Y-117 |
| 13 | 리포트 추세/인사이트 | 라인차트가 하나의 요약 라벨로 낭독되고 프리뷰 전용 델타는 거기서 빠지는가. | 그래프를 못 봐도 추세를 문장으로 듣는다. | `a11y-contract.test.ts` A11Y-117 |
| 14 | 구매 확인 프롬프트 | 프롬프트가 나타날 때 낭독되는가. | 화면 전환 없이 뜨는 요소라 announce 필요. | `a11y-contract.test.ts` A11Y-115 |
| 15 | 로딩 스켈레톤 | 스켈레톤 컨테이너가 "불러오는 중"으로 낭독되는가. | 빈 화면이 침묵하지 않는다. | `a11y-contract.test.ts` A11Y-115 + `loading-skeleton-contract.test.ts` |
| 16 | 런치 애니메이션 | reduce-motion에서 애니메이션을 건너뛰고 항상 "건너뛰기"를 제공하는가. | 모션 민감 사용자가 막히지 않는다. | `a11y-contract.test.ts` A11Y-117 |
| 17 | 알림함 | "알림 모두 지우기"가 Alert 2단계 확인을 거치는가. | 파괴적 동작 관례(A-1 Destructive actions)와 같은 모양. | `a11y-contract.test.ts` A11Y-117 |

## B절. 오프라인 및 오류 상태

| Area | Check | Expected |
| --- | --- | --- |
| Home | Disable network after loading home. | Cached data remains or a clear retry state appears. |
| Expense entry | Disable network before save. | Input is not silently lost; retry or error state appears. |
| Item detail | Disable network before product-link click. | User sees failure and purchase CTA disclosure is not hidden. |
| Import | Force upload/confirm failure. | Preview rows stay outside expenses until confirm succeeds. |
| Settings | Force delete-confirm failure. | Preview state remains and account/child is not deleted. |
| Admin CMS | Force admin write failure. | Admin surface shows failure; app runtime keeps prior item/link/disclosure value. |
| 동기화 상태 화면 | 비행기 모드로 대기 행을 만든 뒤 연결 복구. | 대기 → 반영으로 넘어가고, 4xx로 떨어진 행은 "재시도"가 아니라 **사유 안내**로 남는다(403은 재시도 불가). |
| 정기 지출 카드 | 오프라인에서 정기 지출을 기록. | "기록됨" 판정이 대기 행을 기록으로 세지 않는지(영구 실패 행이 카드를 끄지 않는지). |
| 가져오기 이어보기 | 검수 중 앱 이탈 후 복귀. | "검토하던 가져오기로 돌아가기"가 같은 잡으로 복귀시키고, 확정/폐기 뒤에는 사라진다. |
| 잠금 오버레이 | 잠금 중 네트워크 끊김·앱 강제 종료. | PIN 저장소 읽기 실패 시 잠금이 **열리지 않는다**(`recovery`로 닫힘). |

## C절. 실기기에서만 확인 가능 (수동 — 코드 그린과 무관하게 미확인)

소스·vitest로는 증명할 수 없는 항목이다. 관련 기능 목록은
`docs/qa/runtime-verification-required.md` §1-1과 함께 본다.

| # | 확인 항목 | 왜 기기가 필요한가 |
| --- | --- | --- |
| C-1 | 터치 영역 44dp 실측 (버튼·토글·행 액션·달력 날짜 셀) | 스타일 상수와 실제 히트 영역이 다를 수 있다(패딩·부모 clip). |
| C-2 | 대비 실측 (본문/보조/경고/위험 + 다크 모드 강제 기기) | 앱은 light 고정 선언이라 OS 강제 다크에서 무슨 색이 나오는지 화면으로만 확인된다. |
| C-3 | **잠금 오버레이 TalkBack 투과** — 잠금 중 뒤쪽 화면의 금액·품목이 낭독되는가 | Stack과 오버레이가 형제라 접근성 트리가 z-order로 잘리지 않는다 — **코드 구조상 확정된 투과이고, 실기기 낭독으로 실측한 적은 없다**(라운드 59 통합리뷰 P2-4 표기 정정). 라운드 59 트랙 C가 방패(A-2 #1)로 잘라 냈고 소스 계약도 붙었지만, 실제로 읽히지 않는지는 기기에서만 안다. |
| C-4 | 잠금 오버레이 진입/해제 시 포커스가 PIN 입력으로 가는가 | 포커스 이동은 런타임 동작이라 소스로 못 본다. |
| C-5 | 정기 지출 목록의 낭독 순서 (템플릿명 → 상태 → 행 액션) | 라벨 존재는 코드가 보장하지만 순서·중복 낭독은 기기 문제다. |
| C-6 | 달력 날짜 픽커의 스와이프/월 이동 제스처와 낭독 | TalkBack 제스처 충돌은 실기기 전용. |
| C-7 | 리포트 도넛 범례 드릴다운 — 힌트 낭독 후 실제 이동 | 힌트 문구는 고정돼 있으나 "두 번 누르기"가 실제로 이동시키는지는 기기 확인. |
| C-8 | 가져오기 검수 대량 행(수십~수백)에서의 낭독 성능·초점 유실 | 목록 가상화와 접근성 트리의 상호작용. |
| C-9 | 시스템 글꼴 최대 확대에서의 글자 잘림 (모든 신설 화면) | 폰트 스케일은 OS 설정. |
| C-10 | 키보드가 입력 필드를 가리는지 (정기 지출·달력 픽커 시트) | 키보드 높이는 기기별. |
| C-11 | 오프라인 흐름 전체(B절)의 기기 재현 | 비행기 모드 토글이 필요하다. |

## 수동 증거 (Manual Evidence Required)

- `QR-13` 오프라인 동작의 기기 스크린샷 또는 영상 (B절).
- `QR-14` 접근성 감사 노트 또는 기기 스크린샷 (C절 — 특히 C-1·C-2·C-3).
- 파괴적 설정 흐름이 일반 설정/프로필 편집과 분리돼 있다는 확인.
- **C-3(잠금 오버레이 투과)은 릴리즈 전 필수 확인 항목이다** — 잠금이 켜져 있는데 금액이
  낭독되면 앱 잠금 기능 자체가 약속을 지키지 못한 것이 된다. (코드 계약은 A-2 #1로 붙었다.
  남은 것은 **실기기 낭독 확인**이고, 그것은 코드 그린으로 대체되지 않는다.)
