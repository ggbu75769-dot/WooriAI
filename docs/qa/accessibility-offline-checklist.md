# Accessibility And Offline Checklist

Batch: 15 - 라운드 33~64 신설 화면 반영 · 갱신 2026-08-28 (라운드 64 트랙 F / GAP-064 #10)
직전 갱신: 라운드 63 트랙 F / GAP-063 #10 · 그 앞: 라운드 62 트랙 C / GAP-062 #10 ·
그 앞: 라운드 61 트랙 E / GAP-061 #8
직전 배치: Batch 14 - 라운드 33~63 신설 화면 반영

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
>
> **2026-08-28(GAP-061 #8) 갱신.** 그렇게 두 번 나오던 줄이 둘 있었다 — A-2 #4(정기 지출)와
> A-2 #10(달력 날짜 픽커). 두 화면은 라벨·역할·상태가 이미 소스에 배선돼 있었는데도 "스윕 밖"
> 이라는 이유로 C절에도 적혀 있었고, 그래서 ① 릴리즈마다 사람이 코드가 이미 붙들고 있는 것을
> 다시 보고, ② 정작 라벨이나 role이 빠져도 **아무 테스트도 빨개지지 않았다.** 이번 라운드에
> `a11y-contract.test.ts`의 `GAP-061 #8` 스윕이 그 **존재**를 계약으로 가져갔다. C절에는 코드로
> 증명할 수 없는 것만 남는다 — 낭독 **순서**(C-5)와 **제스처 충돌**(C-6)이 그것이고, 그 두 줄은
> 이제 라벨 유무를 묻지 않는다. A절 전체가 다시 "사람이 볼 필요 없는 항목"이 됐다.
>
> **2026-08-28(GAP-062 #10) 갱신.** 라운드 61이 신설한 UI 둘(가구 전환 Alert · 동기화 상태 화면의
> 저장소 상태 줄)과 라운드 62 트랙 C의 단계 라벨이 A절 표 밖에 있었다 — 새 A-3 표의
> #18·#19·#20으로 들인다(번호는 A-2에서 이어 붙인다). 셋 다 **소리로만 앱을 쓰는 사람에게
> 사실이 도달하는가**가 쟁점이라 A절 항목이다:
> RN Alert의 버튼에는 라벨도 상태도 걸 수 없어 낭독되는 것이 버튼 글자와 본문뿐이고(#18),
> 저장소를 못 연 사실은 색이나 배지 톤이 아니라 문장으로만 전달되며(#19), 프로필 카드의 단계는
> 보이는 배지와 낭독 문장이 **같은 한 값**이어야 한다(#20).
>
> **2026-08-28(GAP-063 #10) 갱신.** 그 A-3에도 라운드 62가 새로 낭독하게 만든 문장 둘이 빠져
> 있었다 — 누적 카드의 대기 고지와 알림함 탭의 아이 전환 안내다. 둘 다 **화면 전환 없이 늘거나
> 사라지는 한 줄**이라 눈으로는 보이지만 귀로는 announce/라벨 조립을 지나지 않으면 도달하지
> 않는다. A-3의 #21·#22로 들인다(라운드 63 트랙 A가 그 고지를 세 자리로 늘렸으므로 #21은
> 그 세 자리를 함께 진다). 라운드 63 자신의 신설 UI 넷은 새 **A-4** 표(#23~#26)로 이어 붙인다.
>
> **2026-08-28(GAP-064 #10) 갱신.** 라운드 64분은 새 **A-5** 표(#27~#29)다. 앞의 둘은 A절의
> 익숙한 모양이지만(사실이 소리로 도달하는가 — 전폭 구매 CTA가 여는 곳 · 앱 밖으로 나가는 링크의
> 고지), **#29는 이 문서에서 성격이 다른 첫 A절 항목이다**: 낭독이 아니라 **손가락이 닿는가**다.
> A-1의 `Touch targets` 줄이 문서가 생긴 이래 "코드 계약 없음"이라고 적혀 있었고 실제로도 그랬다 —
> `a11y-contract.test.ts`가 라벨·역할·상태를 촘촘히 붙들면서 **치수를 보는 단언은 0건**이었다
> (라운드 64 정찰이 이 파일의 사각으로 지목한 그 빈칸이다). 이번 라운드에 "(요소 높이 + 2×세로
> hitSlop) ≥ `theme.touchTarget`"이 소스 계약이 되면서 그 줄의 근거가 바뀐다.
>
> 다만 **C-1은 지우지 않는다.** GAP-061 #8이 A-2 #4·#10을 C절에서 걷어낸 근거는 "코드가 이미
> 증명한다"였는데, 터치 타깃은 그 조건을 절반만 만족한다 — 코드가 아는 것은 스타일 상수와
> `hitSlop`의 합이지, 부모 clip·패딩이 그 히트 영역을 실제로 잘라 내는지가 아니다(C-1이 처음부터
> 적어 둔 이유가 정확히 그것이다). A절과 C절에 같은 항목이 남는 이 문서의 유일한 자리이고,
> 두 줄이 서로 다른 것을 말한다: A-5 #29는 **계산**, C-1은 **실측**이다.

## A절. 코드로 고정된 접근성 계약

### A-1. Batch 11 이전부터의 공통 규칙

| Area | Check | Expected | 근거 |
| --- | --- | --- | --- |
| Touch targets | Buttons, toggles, and row actions are at least 44px high/wide. **2026-08-28(GAP-064 #6) 정정**: 이 앱의 기준은 44가 아니라 저장소 자신의 토큰 `theme.touchTarget` = **48**이다(더 엄하다). 요소가 그보다 낮으면 세로 `hitSlop`으로 갚되, 가로는 이웃과의 간격을 넘지 않는다. | No primary action is smaller than 44px. 히트 영역까지 합쳐 48을 채운다: (요소 높이 + 2×세로 hitSlop) ≥ `theme.touchTarget`. | `a11y-contract.test.ts` GAP-064 #6(입력 보조 칩 4자리 + 커머스 크롬 2자리 — 값을 테스트에 다시 박지 않고 소스의 상수·높이를 읽어 더한다) + `items/link-marker.test.ts`(라운드 64 #6). **실측은 여전히 C-1**(코드는 계산만 안다 — 부모 clip·패딩이 그 영역을 자르는지는 기기 확인) |
| Contrast | Primary text, secondary text, warnings, and danger actions are readable on the configured surfaces. | No critical copy relies on low contrast alone. | `a11y-contract.test.ts` A11Y-117(작은 coral 텍스트 coral[700] 스윕) — 나머지 조합은 C절 |
| Screen-reader labels | Icon-only or terse actions have accessible labels in production UI passes. | Login, expense save, delete, purchase CTA, import confirm, settings delete are understandable. | `a11y-contract.test.ts` A11Y-101/115 |
| Numeric alternatives | Report totals, budget amounts, and chart-like summaries have visible numeric text. | Users can understand totals without color or graph interpretation. | `a11y-contract.test.ts`(라인차트 기하 요약 라벨) |
| Error text | Validation and network failures provide direct action guidance. | Users know whether to retry, edit input, or contact support. | `a11y-contract.test.ts`(로그인 오류 카드·날짜 입력 오류 live region) |
| Destructive actions | Child delete, household leave, account delete use preview and second-step confirmation. 라운드 62 신설 2건도 같은 규칙 아래 둔다: **동기화 대기 행 "버리기"**(#3)와 가족 화면의 **"이 가구에서 나가기"**(#4). **라운드 63 #2 — 그 규칙에 "대상을 말한다"가 더해졌다**: 아이 삭제는 카드 한 줄과 **확인 Alert 제목** 두 자리에서 어느 아이인지를 말한다(가구 탈퇴가 이미 서 있던 자리의 짝). | User sees impact scope before confirming. 버리기 Alert 본문은 지금 어디에만 있는지와 되돌릴 수 없다는 사실을 함께 말하고(그 버튼은 서버가 아직 모르는 생성 대기 행에만 서므로 그 단언이 참이다), 나가기는 진입점이 가리키는 가구를 탈퇴 화면의 대상 라벨이 그대로 이어받는다 — 어느 가구를 나가는지 낭독으로도 갈린다. 아이 삭제도 같다: 다자녀 계정에서 "○○ 프로필을 삭제해요." / "○○ 프로필을 삭제할까요?"가 서고, 이름을 못 풀거나 1아이면 **종전 문구 그대로**다(모르면 지어내지 않는다 — SET-004 픽셀락). | `a11y-contract.test.ts`(알림 모두 지우기 Alert · GAP-063 #10 아이 삭제 대상) + `settings-flow.test.ts` + `offline/pending-row-actions.test.ts`(버리기 Alert·문구 계약) + `family/household-scope.test.ts`(`HOUSEHOLD_SCOPE_LEAVE_LABEL`·탈퇴 대상 · `childScopeDeleteNotice`·`childScopeDeleteConfirmTitle`). 실기기 확인은 `runtime-verification-required.md` §1-1 #37·#40·#45 |
| 내부 ID 누출 | `accessibilityLabel`에 화면 내부 ID가 새지 않는다. | 낭독에 uuid/스크린 ID가 들리지 않음. | `a11y-contract.test.ts` A11Y-115 전 컴포넌트 스윕 |
| 장식 글리프 | ♡ · › · ▣ 같은 장식 문자는 접근성 트리에서 숨긴다. | 낭독에 의미 없는 기호가 끼지 않음. | `a11y-contract.test.ts` A11Y-115 |

### A-2. 라운드 33~58 신설 화면 (2026-08-28 추가)

| # | 화면 | Check | Expected | 근거 |
| --- | --- | --- | --- | --- |
| 1 | 잠금 오버레이 (`src/security/AppLockOverlay.tsx`) | 잠금 중 배경(Stack)의 금액·품목이 접근성 트리에서 잘리는가. | 잠금 상태에서 TalkBack이 뒤쪽 화면 내용을 읽지 못한다. | `a11y-contract.test.ts` GAP-059 #3(라운드 59 트랙 C가 붙였다) — 방패가 `<Stack>`·구매 확인 카드만 감싸고 잠금 오버레이는 밖에 두는 것, 잠금 중에만 `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`가 걸리는 것, 잠금을 켜지 않은 사용자·픽셀락 빌드에는 노드가 생기지 않는 것까지 고정. 오버레이 안쪽 PIN 도트 숨김·안내 live region은 종전대로 `app-lock-gate-contract.test.ts`. **낭독 실측은 여전히 C-3** |
| 2 | 잠금 오버레이 | PIN 입력칸 라벨 + 오입력/대기 안내가 live region으로 낭독되는가. | 대기 안내가 `accessibilityLiveRegion="polite"` + `role="alert"`로 자동 낭독. | `AppLockOverlay.tsx`(고정) + `src/security/app-lock-gate-contract.test.ts` |
| 3 | 설정 > 앱 잠금 (`app/settings/app-lock.tsx`) | "지금 잠그기" 등 아이콘/짧은 액션에 라벨이 있는가. | `APP_LOCK_LOCK_NOW_A11Y_LABEL` 상수로 고정. | `app-lock-gate-contract.test.ts` |
| 4 | 정기 지출 (`app/expenses/recurring.tsx`) | 입력칸 4종(품목·금액·결제일·판매처)에 한국어 라벨, 알림 토글에 switch 역할·checked 상태, 행 액션(기록/수정/삭제)에 **품목명이 포함된** 라벨이 있는가. | 목록에서 어느 템플릿의 버튼인지 소리만으로 구분된다. | `a11y-contract.test.ts` GAP-061 #8(스윕 편입 — 라벨 4종·switch role·checked 상태·행 액션 3종의 품목명). 기록 버튼 문구는 `recurring-template.ts`의 `recurringRecordAccessibilityLabel`이 단일 소스이고 `recurring-template.test.ts`가 핀한다. **낭독 순서만 C-5** |
| 5 | 정기 지출 | 저장 실패 문구가 live region인가. | 오류가 자동 낭독된다(`accessibilityLiveRegion="polite"` + `role="alert"`). | `app/expenses/recurring.tsx`(고정) |
| 6 | 동기화 상태 (`app/sync-status.tsx`) | 충돌 해결의 "내 값/서버 값" 선택이 선택 상태를 알리는가. | `accessibilityRole="button"` + `accessibilityState={{ selected }}`. | `app/sync-status.tsx`(고정) |
| 7 | 기록 탭 동기화 칩 | 대기/실패 칩이 라벨 있는 버튼으로 낭독되는가. | 칩이 "무엇이 몇 건인지"를 말하고 누를 수 있음을 알린다. | `a11y-contract.test.ts` A11Y-101 |
| 8 | 가져오기 검수 (`app/import/[importJobId].tsx`) | 행이 checkbox 역할 + checked/disabled 상태로 낭독되고, 잠긴 행은 **왜 못 고르는지**가 라벨에 들어가는가. | 미리보기 장식은 TalkBack에서 숨고 검수 안내는 보이는 텍스트로 남는다. | `a11y-contract.test.ts` A11Y-115/117 |
| 9 | 가져오기 검수 | 일괄 선택/해제 컨트롤에 라벨이 있는가. | `IMPORT_BULK_CANCEL_A11Y_LABEL` 등 상수로 고정. | `app/import/[importJobId].tsx`(고정) |
| 10 | 달력 날짜 픽커 (`src/expenses/ExpenseDatePicker.tsx`) | 날짜 셀이 button 역할 + selected 상태 + 사람이 읽는 날짜 라벨을 갖는가. 고를 수 없는 날은 **왜** 못 고르는지가 라벨에 들어가는가. 월 이동 한계에서 화살표가 비활성으로 낭독되는가. | 미래 날짜 셀은 누를 수 없는 요소로 남고 라벨이 "아직 오지 않은 날이라 고를 수 없어요"를 싣는다(가져오기 검수의 잠긴 행과 같은 관례). 월 이동 화살표는 한계에서 `accessibilityState.disabled`가 참. | `a11y-contract.test.ts` GAP-061 #8(스윕 편입) + `date-picker-month.test.ts`(라벨 문구 판정). **2026-08-28 정정**: 이 줄은 종전에 "선택 불가한 날은 `accessibilityState.disabled`가 참"이라고 적고 있었지만 **셀에는 그 상태가 없다** — 셀은 Pressable이 아니라 이유를 실은 `accessible` View다. `disabled` 상태를 갖는 것은 월 이동 화살표 쪽이다. **제스처·스와이프만 C-6** |
| 11 | 리포트 도넛 범례 (`src/ui.tsx`) | 범례 한 줄이 "카테고리, 퍼센트, 금액"을 한 번에 낭독하고, 누를 수 있으면 **어디로 가는지**를 힌트로 먼저 말하는가. | 색만으로 구분하지 않는다(DNC 수치 병기). 드릴다운 힌트는 누르기 전에 들린다. | `src/reports/category-drilldown.test.ts`(`categoryDrilldownHint`) + `src/ui.tsx`(고정) |
| 12 | 리포트 기간 이동 | 기간 라벨이 새 기간을 알리고, 현재 기간 앞으로는 이동 화살표가 비활성인가. | "다음 달" 화살표가 미래로 넘어가지 않는다. | `a11y-contract.test.ts` A11Y-117 |
| 13 | 리포트 추세/인사이트 | 라인차트가 하나의 요약 라벨로 낭독되고 프리뷰 전용 델타는 거기서 빠지는가. | 그래프를 못 봐도 추세를 문장으로 듣는다. | `a11y-contract.test.ts` A11Y-117 |
| 14 | 구매 확인 프롬프트 | 프롬프트가 나타날 때 낭독되는가. | 화면 전환 없이 뜨는 요소라 announce 필요. | `a11y-contract.test.ts` A11Y-115 |
| 15 | 로딩 스켈레톤 | 스켈레톤 컨테이너가 "불러오는 중"으로 낭독되는가. | 빈 화면이 침묵하지 않는다. | `a11y-contract.test.ts` A11Y-115 + `loading-skeleton-contract.test.ts` |
| 16 | 런치 애니메이션 | reduce-motion에서 애니메이션을 건너뛰고 항상 "건너뛰기"를 제공하는가. | 모션 민감 사용자가 막히지 않는다. | `a11y-contract.test.ts` A11Y-117 |
| 17 | 알림함 | "알림 모두 지우기"가 Alert 2단계 확인을 거치는가. | 파괴적 동작 관례(A-1 Destructive actions)와 같은 모양. | `a11y-contract.test.ts` A11Y-117 |

### A-3. 라운드 61~62 신설 UI (2026-08-28 추가 — GAP-062 #10 · #21·#22는 GAP-063 #10 보강)

| # | 화면 | Check | Expected | 근거 |
| --- | --- | --- | --- | --- |
| 18 | 가구 전환 Alert (`app/family/index.tsx`, 라운드 61 #1) | 후보 버튼 글자가 사람이 아는 말인가(내부 id가 아니라), 지금 보고 있는 가구가 그 사실을 달고 나오는가, 상한에 밀려 못 고르는 후보가 생기면 **본문이 그 사실을 말하는가**. 닫기 버튼이 빠질 때 닫을 다른 길이 있는가. | RN Alert 버튼에는 `accessibilityLabel`·`accessibilityState`를 걸 수 없다 — 낭독되는 것은 제목·본문·버튼 글자뿐이라, 현재 가구 표기는 `(보는 중)` 문자열이, 초과 사실은 본문 한 줄이 진다. 닫기가 빠지면 `cancelable`이 참이 되어 바깥 탭/뒤로가기로 닫힌다. | `a11y-contract.test.ts` GAP-062 #10(순수 모듈 `householdSwitchPrompt` 산출 + 화면 소스 계약) + `family/household-scope.test.ts`(버튼 구성 판정). **3가구 이상 계정의 실기기 확인은 `runtime-verification-required.md` §1-1 #31** |
| 19 | 동기화 상태 (`app/sync-status.tsx`, 라운드 61 #6) | 저장소를 열지 못한 상태가 **보이는 문장**으로 전달되는가(색·배지 톤만이 아니라). 그 문장이 화면에 다시 적히지 않고 단일 소스에서 오는가. | 빈 상태 카드의 **제목**이 `OFFLINE_STORAGE_UNAVAILABLE_NOTICE`로 바뀐다 — "모든 기록이 동기화됐어요."라는 확인할 수 없는 단언 대신 모른다는 사실을 말한다. 카드의 액션은 라벨 있는 버튼(닫기)이다. | `a11y-contract.test.ts` GAP-062 #10 + `offline/store-open-gate.test.ts`(배선) + `offline/messages.test.ts`(문구 속성) |
| 20 | 더보기 "프로필" 카드 (`app/(tabs)/more.tsx`, 라운드 62 #6) | 단계 배지의 글자와 카드 낭독 문장이 **같은 한 값**인가. 예정일이 유예를 넘긴 임신 프로필에서 이 카드가 홈 헤더와 다른 문장을 말하지 않는가. | 카드는 `accessibilityLabel`을 따로 조립하므로(닉네임·가구 수·단계·목적지) 배지와 값이 갈리면 눈과 귀가 다른 말을 듣는다. 둘 다 `sessionStageLabel` 하나를 쓴다. 비로그인 미리보기 카드는 종전 그대로(SET-001). | `a11y-contract.test.ts` GAP-062 #6 + `home/stage-display-label.test.ts`(판정 문구) |
| 21 | 누적 금액 카드의 대기 고지 (홈 누적 카드 · 홈 마일스톤 카드 부제 · 리포트 탭 누적 카드 — 라운드 62 #9 + 라운드 63 #1) | 서버 집계가 아직 모르는 대기 기록이 있을 때 그 사실이 **문장으로** 도달하는가. 세 자리가 **같은 한 문장**을 쓰는가. 카드 낭독이 금액 뒤에 그 줄까지 이어 읽는가. | 숫자를 고칠 수 없는 자리(전 기간 합계는 클라이언트에 재조정할 모집단이 없다)라 정직성은 문장으로만 지켜진다. 문구·건수 규칙은 `cumulativeTotalPendingNotice` 한 벌이고 세 화면이 그것을 부른다 — 카드가 바뀌었다는 이유로 사용자가 다른 말을 듣지 않는다. 낭독 순서는 **제목 → 부제 → 고지**로 눈으로 읽는 순서와 같다. 대기 0건이면 `null`이라 세 카드가 종전과 한 줄도 다르지 않다(HOME-001·REP-001). | `home/cumulative-total.test.ts`(GAP-062 #9 카드 산출·`accessibilityLabel` 조립 + GAP-063 세 자리가 같은 값을 낸다·리포트 배선·카드 안 읽기 순서) + `home/milestone-countdown.test.ts`(GAP-063 부제에 붙는 조건 + 홈 배선) + `reports/pending-scope-notice.test.ts`(문장 조각 원본). 실기기 확인은 `runtime-verification-required.md` §1-1 #38·#48 |
| 22 | 알림함 탭의 아이 전환 안내 (`app/notifications.tsx`, 라운드 62 #2) | 다른 아이의 알림을 눌러 **선택 아이가 바뀔 때** 그 사실이 낭독되는가. 같은 아이의 알림에서는 아무 말도 하지 않는가. | 화면 전환과 동시에 전역 상태가 바뀌는 자리라, 말하지 않으면 소리로만 쓰는 사람은 착지한 예산·기록 화면이 **누구의 것인지** 알 수 없다. 문구는 헤더 전환 시트와 같은 한 벌(`applyChildSwitch`의 `announcement` — "○○(으)로 전환했어요.")이고 이 화면이 새로 짓지 않는다. 같은 아이 탭은 no-op이라 announce도 없다(소음 금지). | `a11y-contract.test.ts` GAP-063 #10 + `children/child-switch.test.ts`(announcement 단일 소스) + `notifications/notification-route.test.ts`(`resolveNotificationTapChild`). 실기기 확인은 `runtime-verification-required.md` §1-1 #39 |

### A-4. 라운드 63 신설 UI (2026-08-28 추가 — GAP-063 #10)

넷 다 **눈으로는 보이지만 귀로는 따로 실어야 도달하는** 자리다. 화면 파일은 트랙 A·B·C의
소유였으므로(F는 문서·스윕만 진다) 판정은 순수 모듈의 산출로 붙들고 화면 쪽은 최소 소스 계약만 둔다.

| # | 화면 | Check | Expected | 근거 |
| --- | --- | --- | --- | --- |
| 23 | 기록 탭 달력 칸 (`app/(tabs)/records.tsx`, 라운드 63 #8) | 이 라운드부터 **기록 없는 칸의 대다수가 눌린다**("그날로 기록"). 그러면 누를 수 있는 칸과 없는 칸이 소리로 갈리는가. 범례가 새 동작을 말하는가. | 미래 칸 라벨이 이유를 싣는다 — "8월 30일, 지출 없음, **아직 오지 않은 날이라 기록할 수 없어요**"(날짜 픽커가 A-2 #10에서 고정한 관례를 그대로 적용). 픽커의 문장을 그대로 쓰지 않는 이유는 두 화면이 말하는 것이 실제로 다르기 때문이다(고를 수 없다 ↔ 기록할 수 없다) — 미래를 막는 **규칙**은 여전히 한 벌이다(DNC-013). 누를 수 없는 칸은 `disabled` 버튼이 아니라 라벨만 있는 비대화형 자리다("버튼, 비활성"으로 읽히면 '왜 못 누르지'가 남는다). 범례 한 줄이 두 목적지를 함께 말한다. | `a11y-contract.test.ts` GAP-063 #10(`CALENDAR_FUTURE_HINT` 배선·범례) + `expenses/records-calendar.test.ts`(라벨·범례 문구 판정). **낭독 순서·스와이프 제스처는 C-6과 같은 자리** |
| 24 | 약관 및 개인정보 > 아이 삭제 카드 (`app/settings/privacy.tsx`, 라운드 63 #2) | 되돌릴 수 없는 동작이 **어느 아이를** 지우는지 소리로 갈리는가. 확인 Alert 제목도 같은 대상을 말하는가. | 카드에 "○○ 프로필을 삭제해요." 한 줄, Alert 제목이 "○○ 프로필을 삭제할까요?"다. RN Alert 제목·본문은 낭독되는 몇 안 되는 문자열이라(A-3 #18과 같은 제약) 마지막 확인이 대상을 말하지 않으면 화면을 떠난 뒤에는 알 길이 없다. 이름을 못 풀면(1아이·캐시 없음) 두 자리 모두 **종전 문구 그대로** — 지어내지 않는다. | `a11y-contract.test.ts` GAP-063 #10(순수 모듈 산출 + 화면 배선) + `family/household-scope.test.ts`(`childScopeDeleteNotice`·`childScopeDeleteConfirmTitle`) + `children/child-switch.test.ts`(`resolveChildScopeLabel` 다자녀 문턱). A-1 파괴 액션 규칙과 같은 건 |
| 25 | 가족 화면 "이 가구에 아이 추가하기" (`app/family/index.tsx`, 라운드 63 #7) | 진입점이 라벨 있는 버튼으로 낭독되는가. **어느 가구로** 데려가는지가 누르기 전에 들리는가. | 라벨은 "이 가구에 아이 추가하기"이고, 어느 가구인지는 힌트가 바로 위 관리 표기(`householdScopeManageNotice` — "○○의 가구를 관리하고 있어요.")를 그대로 물어 온다. 이름을 여기서 한 번 더 지어내지 않으므로 눈에 보이는 줄과 귀에 들리는 힌트가 갈릴 자리가 없다(리포트 범례 드릴다운 힌트와 같은 관례 — A-2 #11). 전환하지 않은 계정에서는 노드 자체가 없다(FAM-001). | `a11y-contract.test.ts` GAP-063 #10 + `family/household-scope.test.ts`(`HOUSEHOLD_SCOPE_ADD_CHILD_LABEL`·`addChildScreenHref`) |
| 26 | 아이 관리 추가 성공 안내 (`app/settings/children.tsx`, 라운드 63 #7) | 추가 성공이 **전역 선택 아이를 바꾼다**는 사실이 낭독되는가. 전환해 들어오지 않은 흐름에서는 종전과 같은가. | 토스트와 announce가 같은 사실을 말한다 — "○○를 추가하고 선택했어요. **지금부터 이 아이 화면으로 바뀌어요.**" 화면 전환 없이 앱 전체의 대상이 바뀌는 자리라 announce가 필요하다(구매 확인 프롬프트 A-2 #14와 같은 근거). 가구 파라미터가 없는 계정(1가구 포함)에서는 뒷문장이 붙지 않아 종전 문구 그대로다(SET-005). | `a11y-contract.test.ts` GAP-063 #10 + `family/household-scope.test.ts`(`HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE`). 실기기 확인은 `runtime-verification-required.md` §1-1 #47 |

### A-5. 라운드 64 신설 UI (2026-08-28 추가 — GAP-064 #10)

앞의 둘(#27·#28)은 A절의 익숙한 쟁점이다 — **사실이 소리로도 도달하는가**. #29는 성격이 다르다:
낭독이 아니라 **손가락이 닿는가**이고, A-1의 `Touch targets` 줄이 이 문서가 생긴 이래 처음으로
코드 계약을 갖게 된 자리다(위 갱신 노트 참고 — 그래도 C-1 실측은 남는다).

화면 파일은 트랙 A의 소유였으므로(F는 문서·스윕과 `hitSlop` 값만 진다) 판정은 순수 모듈의 산출로
붙들고 화면 쪽은 최소 소스 계약만 둔다 — GAP-062 #10이 세운 관례 그대로다.

| # | 화면 | Check | Expected | 근거 |
| --- | --- | --- | --- | --- |
| 27 | 준비템 상세의 전폭 구매 CTA (`app/items/[itemTemplateId].tsx`, 라운드 64 #1) | 화면에서 **가장 강조된 버튼**이 무엇을 여는가. 그 버튼에는 `accessibilityLabel`이 없어 **보이는 라벨이 곧 낭독 문장**인데("바로 구매하기"), 그 문장 뒤에 광고가 걸려 있으면 표시와 사실이 갈린다. 스폰서만 남은 품목에서 버튼이 사라질 때 구매 경로까지 조용히 닫히지는 않는가. | 버튼이 여는 링크는 판매처 행의 채움과 **같은 한 판정**(`primaryPurchaseLinkIndex` — 첫 비스폰서 링크)이다. 전부 스폰서면(-1) 버튼을 **렌더하지 않는다** — 비활성으로 남기면 "버튼, 비활성"으로 읽히고 왜 못 누르는지가 남는다(달력 미래 칸 A-4 #23과 같은 규율). 그 링크는 판매처 행에 스폰서 배지 + "광고/스폰서" 캡션을 단 채 남고, 그 행의 버튼은 "○○에서 구매하기"로 낭독된다 — 광고를 광고라고 말한 자리에서만 누르게 되는 것이 DNC-011의 취지다. 비세션 프리뷰는 판정이 0이라 종전 렌더 그대로(ITEM-002). | `a11y-contract.test.ts` GAP-064 #1(라벨이 곧 낭독 문장·게이트·판매처 행의 스폰서 표기) + `items/link-marker.test.ts`(라운드 64 #1 — `primaryPurchaseLinkIndex` 값 계약). A-1 `Screen-reader labels`의 purchase CTA와 같은 건. 실기기 확인은 `runtime-verification-required.md` §1-1 #49 |
| 28 | 앱 밖으로 나가는 구매 링크 (`app/items/[itemTemplateId].tsx` "링크 공유하기", 라운드 64 #5ⓐ) | DNC-010은 "구매 CTA **인접** 위치의 제휴 고지를 숨기지 않는다"인데, 링크가 카카오톡으로 건너가는 순간 **인접이라 부를 자리 자체가 없다**. 그러면 고지가 도달하는 길이 남아 있는가. | 문장을 링크와 **함께** 보내는 것 말고는 방법이 없으므로 그렇게 한다: 제휴 링크는 수수료 문장이, 스폰서 링크는 광고 사실이 URL **앞줄**에 붙는다(`purchaseLinkShareMessage`). 문구는 새로 짓지 않고 화면의 `AffiliateDisclosure`와 **같은 판정**(`productLinksDisclosureText`)이 그 링크 하나에 그대로 돈다 — 두 경로가 다른 말을 할 자리가 없다. 일반 링크는 종전 그대로 URL 한 줄이다(없는 고지를 지어내지 않는다 — 라운드 43 M-1과 같은 근거). 운영이 어드민에서 편집한 문구가 앱 기본값보다 앞서되, 수수료를 말하지 않는 커스텀 문구가 제휴 고지를 지우지는 않는다(N-2). | `items/link-marker.test.ts`(라운드 64 #5ⓐ — 종별 문구·우선순위·화면이 조립기만 쓴다) + `items/link-marker.test.ts` 라운드 44 N-2(수수료 규율). 실기기 확인은 `runtime-verification-required.md` §1-1 #50 |
| 29 | 입력 보조 칩의 터치 타깃 (`app/expenses/new.tsx` · `app/expenses/[expenseId].tsx`, 라운드 64 #6) | 매일 누르는 칩 넷(최근 품목 · 품목 자동완성 · 판매처 자동완성 ×2)이 저장소 자신의 최소 터치 타깃을 채우는가. 넓히면서 **옆 칩을 침범하지는 않는가**. 그리고 **렌더가 바뀌지 않았는가**. | 칩 높이는 38이라 48에 10 모자라고, 그 10을 **세로 `hitSlop`으로만** 갚는다(38 + 5×2 = 48). 가로를 올리지 않는 이유는 칩 사이 간격이 8이기 때문이다 — 좌우로 5씩 늘리면 이웃과 겹쳐(5+5 > 8) 하나를 고치려다 "옆 칩이 눌리는" 오탭을 새로 만든다. 종전 3은 줄이지도 않는다(3+3 < 8이라 겹치지 않고, 0으로 지우면 히트 영역만 좁아진다). `hitSlop`은 레이아웃 속성이 아니라 **렌더는 한 픽셀도 바뀌지 않는다**(EXP-001 픽셀락 기준선 불변 — 커머스 크롬에 라운드 64 A가 적은 근거와 같다). 같은 규칙을 준비템 상세의 플로팅 크롬도 지난다(34 + 7×2 = 48). | `a11y-contract.test.ts` GAP-064 #6(세로 합 ≥ `theme.touchTarget` · 가로 합 < gap 8 · 레이아웃 속성 불변 — 값을 테스트에 다시 박지 않고 소스의 상수와 높이를 읽어 더한다) + `items/link-marker.test.ts`(라운드 64 #6 — 크롬 2자리). A-1 `Touch targets`가 이 라운드부터 가리키는 그 계약이다. **실측은 C-1, 실기기 확인은 `runtime-verification-required.md` §1-1 #52** |

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
| C-1 | 터치 영역 실측 (버튼·토글·행 액션·달력 날짜 셀 · 입력 보조 칩) — 기준은 `theme.touchTarget` = **48dp**다(44가 아니다) | 스타일 상수와 실제 히트 영역이 다를 수 있다(패딩·부모 clip). **2026-08-28(GAP-064 #6)**: 계산은 이제 코드가 붙든다(A-5 #29 — 높이 + 2×세로 hitSlop ≥ 48). 여기 남는 것은 그 계산이 기기에서도 참인가, 그리고 **가로를 올리지 않은 판단이 실제로 옳았는가**(옆 칩이 대신 눌리지 않는가)다 — 둘 다 손가락으로만 안다. |
| C-2 | 대비 실측 (본문/보조/경고/위험 + 다크 모드 강제 기기) | 앱은 light 고정 선언이라 OS 강제 다크에서 무슨 색이 나오는지 화면으로만 확인된다. |
| C-3 | **잠금 오버레이 TalkBack 투과** — 잠금 중 뒤쪽 화면의 금액·품목이 낭독되는가 | Stack과 오버레이가 형제라 접근성 트리가 z-order로 잘리지 않는다 — **코드 구조상 확정된 투과이고, 실기기 낭독으로 실측한 적은 없다**(라운드 59 통합리뷰 P2-4 표기 정정). 라운드 59 트랙 C가 방패(A-2 #1)로 잘라 냈고 소스 계약도 붙었지만, 실제로 읽히지 않는지는 기기에서만 안다. |
| C-4 | 잠금 오버레이 진입/해제 시 포커스가 PIN 입력으로 가는가 | 포커스 이동은 런타임 동작이라 소스로 못 본다. |
| C-5 | 정기 지출 목록의 낭독 **순서** (템플릿명 → 상태 → 행 액션)와 중복 낭독 | 라벨·역할·상태의 **존재**는 이제 코드가 붙든다(A-2 #4 / `a11y-contract.test.ts` GAP-061 #8). 여기 남은 것은 순서와 중복뿐이고, 그건 접근성 트리를 실제로 훑어 봐야 안다. |
| C-6 | 달력 날짜 픽커의 스와이프/월 이동 **제스처** 충돌 | 라벨·역할·상태·"왜 못 고르는지"는 코드 계약이다(A-2 #10). TalkBack 제스처가 달력 스와이프와 부딪히는지는 실기기 전용. |
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
