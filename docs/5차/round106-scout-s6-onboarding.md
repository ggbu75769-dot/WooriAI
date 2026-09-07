# 라운드 106 정찰 S6 — 온보딩·첫 사용 여정 감사

- 범위: `apps/mobile/app/launch-animation.tsx` · `app/(auth)/login.tsx` · `app/(onboarding)/**` · `app/index.tsx` · `app/(tabs)/**` · 그 화면들이 부르는 순수 모듈.
- **읽기 전용 정찰.** 소스 0바이트 변경. 이 문서가 유일한 산출물이다.
- 인용은 전부 **2026-09-07에 읽은 시점**의 파일 내용이다(다른 에이전트 20개가 동시 편집 중 — 착수 전 해당 줄을 다시 확인할 것).
- 라운드 35가 다룬 "가입 첫 10분" 이후 늘어난 기능 넷(커스텀 품목 R100 · 카테고리 예산 R102 · 커스텀 분류 R103 · 전 기간 검색 R101/104)이 **첫 사용을 무겁게 만들었는가**가 이 정찰의 핵심 질문이다.
  → **결론: 온보딩 자체에는 한 방울도 새지 않았다(값으로 확인 · §값 1·2·6).** 무거워진 곳은 딱 한 자리, **기록 탭의 0건 화면**이다(발견 1).

---

## 요약 표

| # | 한 줄 | 영향 | 크기 | 즉시 착수 |
|---|---|---|---|---|
| 1 | 기록 탭은 기록 0건인 첫 사용자에게도 검색칸·카테고리 칩·정렬 토글을 전량 펼친다 — 거를 것이 없는 필터 장치 | 상 | M | ✅ (픽셀락 밖) |
| 2 | ONB-003이 **아이가 이미 태어난 사용자에게도** "출산 준비물 / 이미 준비한 물건이 있나요?"라고 말한다 | 중 | S | ✅ |
| 3 | 온보딩 네 화면 전부 **뒤로 가기 어포던스가 0개**다(`ScreenHeader`의 `onBack` 슬롯 미사용 — 다른 14개 화면은 전부 쓴다) | 중 | S | ✅ |
| 4 | ONB-001의 "단계를 직접 선택할게요" 설명이 "**나중에** 골라주세요"라고 하는데, 실제로는 **바로 다음 화면**에서 고르게 한다 | 중 | S | ✅ |
| 5 | ONB-002의 이름 칸이 stageMode와 무관하게 "태명 / 별명 · 예) 튼튼이" 고정 — 바로 아래 날짜 칸은 stageMode로 갈리는데 이름 칸만 안 갈린다 | 하 | S | ✅ |
| 6 | 빈 알림함의 CTA [알림 설정 보기]가 **영구 비활성 토글**로 데려간다(스토어 빌드는 `EXPO_PUBLIC_PUSH_ENABLED` 미설정 = 푸시 불가) | 하 | S | ✅ |
| 7 | 설정 > 지출 분류(R103)로 만든 분류를 **지출 입력 화면에서 고를 수 없는데**, 그 화면이 그 사실을 한 글자도 말하지 않는다 | 중 | S | ✅ |
| 8 | 스토어 빌드에는 **로그인 전에 볼 수 있는 것이 0개**다(데모·미리보기 전부 개발/픽셀락 플래그 뒤) | 중 | L | ❌ (제품 결정) |

---

## 발견 상세

### 1. 기록 0건인 첫 사용자에게 검색·필터·정렬 장치를 전량 펼친다 — 영향 상 / 크기 M

**사용자가 겪는 일.** 온보딩을 마치고 홈에서 첫 지출을 기록한 직후(또는 기록하기 전에) 기록 탭을 눌러 본다. 화면에는 아래가 **조건 없이 순서대로** 선다: 제목·부제 → [빠른 지출 기록] → 아이 전환 줄 → 월 이동 컨트롤(‹ 2026년 9월 ›) → 월 합계 카드 → 목록/달력 세그먼트 → **검색 입력칸** → **카테고리 칩 스트립(전체 + N개)** → **최신순/금액 큰 순 세그먼트** → 그 아래 "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요." 빈 카드. 아직 아무것도 없는 사람에게 **걸 것이 없는 필터 세 벌**이 먼저 보인다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/(tabs)/records.tsx:2308-2329` — 검색 `TextInput`. 앞뒤에 조건 분기가 없다(바로 위 `:2301`이 헤더 블록을 닫고, 바로 아래 `:2339`의 최근 검색어 줄만 조건부다).
- `apps/mobile/app/(tabs)/records.tsx:2376-2386` — `<ScrollView horizontal>` 안의 `CategoryChip` "전체" + `categoryChips.map(...)`. 조건 없음.
- `apps/mobile/app/(tabs)/records.tsx:2396` — `isRecordsSortToggleVisible({ isCalendarView, isFullSearchScope })`.
  판정은 `apps/mobile/src/expenses/records-sort.ts:78-83`: `return !input.isCalendarView && !input.isFullSearchScope;` — **"보여 줄 행이 있는가"를 보지 않는다.**
- 이 셋은 `listHeader`(`records.tsx:2017`) 안에 있고, 빈 상태 카드는 `ListEmptyComponent`(`records.tsx:2581`, 카드는 `:2514-2540`)라 **헤더가 항상 먼저 그려진다**.
- 대조군(잘 돼 있는 자리): 홈은 정확히 이 규율을 지킨다 — `apps/mobile/src/home/first-run-guide.ts:8-16`("빈 홈에 CTA를 두 개 세우면 '어디부터?'라는 질문이 하나 더 생겨서 루프가 오히려 흐려진다")·`:232-258`이 카드를 **하나 또는 null**로 잠근다.

**얼마나 자주.** 모든 신규 사용자가 기록 탭을 처음 여는 1회 + 이번 달 기록이 0건인 매달 1~2일. 기록 탭은 하단 탭 두 번째 자리라(`app/(tabs)/_layout.tsx:76`) 첫 10분 안에 눌릴 확률이 높다.

**고치는 크기.** M. 판정 한 개(순수 모듈, 예: `hasAnythingToFilter = 이번 달 행 > 0 || 검색어 있음 || 필터 걸림`)를 만들고 위 세 자리를 그 값으로 감싼다. 문구 신규 0건.

**막는 것.** 없음 — **기록 탭은 픽셀락 대상이 아니다**(`scripts/pixel-lock/pixel-lock-screens.json`의 아홉: SPL-001·HOME-001·EXP-001·ITEM-001·ITEM-002·REP-001·FAM-001·IMP-003·SET-001). 다만 `records-calendar.test.ts`가 "이 화면의 `ScrollView`는 카테고리 칩 스트립 하나로 고정"을 문다고 `records.tsx:2388-2390` 주석이 적어 두었으므로, 스트립을 **지우는** 게 아니라 **감싸는** 방향이어야 그 계약이 산다. `a11y-contract`가 칩 줄 수·간격을 실측한다는 주석도 같은 자리에 있다.

---

### 2. ONB-003이 출생 후 사용자에게도 "출산 준비물"이라고 말한다 — 영향 중 / 크기 S

**사용자가 겪는 일.** ONB-001에서 "아이가 태어났어요"를 고르고 두 돌 아이의 생일을 넣은 사람이 세 번째 화면에서 **"출산 준비물 / 이미 준비한 물건이 있나요?"** 라는 머리말 아래 유아용 물건 목록을 본다. "단계를 직접 선택할게요 → 초등학생"을 고른 사람도 같은 문장을 읽는다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/(onboarding)/prepared-items.tsx:221-225` (본 경로) 와 `:151-155` (아이 없는 탈출구 경로) — 두 자리 모두 `eyebrow="출산 준비물"`, `title="이미 준비한 물건이 있나요?"` **리터럴 고정**. 이 화면은 `stageMode`를 읽지 않는다(파일 전체에 `stageMode` 참조 0건).
- 그런데 **목록은 시기별로 정확히 갈린다**: `prepared-items.tsx:68` `listItems(authToken!, selectedChildId!, "now")` → 서버가 아이의 지금 stageCode로 거른다.
- 출생 후 밴드에 실제 항목이 넉넉히 있다(`apps/api/prisma/seed-data.ts`의 `stageCodes` 집계): `newborn_0_3` 18 · `toddler_1_3` 17 · `infant_7_12` 17 · `infant_4_6` 14 · `kid_4_7` 11 · `elementary` 9. 즉 **빈 화면으로 도망가지 않고 반드시 이 문장 아래 그 목록이 그려진다.**
- 대조군: 같은 온보딩의 바로 앞 화면은 stageMode로 라벨을 가른다 — `apps/mobile/src/children/child-form.ts:57-61` `requiredDateFieldLabel()`("출산 예정일" / "출생일" / null). 기계는 이미 있고 이 화면만 안 쓴다.

**얼마나 자주.** 출생 후 가입자 + manual 가입자 전원 × 1회. ONB-001의 세 선택지 중 둘이 여기로 온다(`child-status.tsx:42-55`).

**고치는 크기.** S. `requiredDateFieldLabel`과 같은 모양의 순수 함수 하나(stageMode → {eyebrow, title})를 `src/onboarding/`에 두고 두 자리(`:151-155`·`:221-225`)가 읽게 한다. 문장 셋(임신/출생/직접선택) 신규.

**막는 것.** 없음. 온보딩은 픽셀락 아홉 밖이다(`child-status.tsx:20`의 머리말이 "온보딩은 픽셀락 목록 밖"이라고 이미 값으로 적어 두었고, `pixel-lock-screens.json` 키 목록이 그것을 확인한다).

---

### 3. 온보딩 네 화면 전부 뒤로 가기 어포던스가 0개 — 영향 중 / 크기 S

**사용자가 겪는 일.** ONB-002에서 예정일을 잘못 친 것을 ONB-003에서 깨닫는다. 화면에 **되돌아갈 컨트롤이 없다.** 안드로이드 하드웨어 백은 (`router.push`로 쌓였으므로) 동작하지만 눈에 보이는 길이 없고, 낭독으로는 존재 자체가 전달되지 않는다.

**근거(2026-09-07 읽음).**
- `apps/mobile/src/ui.tsx:199-233` — `ScreenHeader`는 `onBack` 슬롯을 갖고 있고, 넘기면 `accessibilityLabel="뒤로가기"` 44dp 타깃(`:238-245`)을 그린다.
- 저장소에서 그 슬롯을 쓰는 화면 **14개**: `app/sync-status.tsx:944` · `app/expenses/recurring.tsx:349` · `app/expenses/[expenseId].tsx:950` · `app/settings/app-lock.tsx:256` · `app/settings/categories.tsx:369` · `app/settings/amount-presets.tsx:90` · `app/settings/children.tsx:707` · `app/settings/privacy.tsx:772` · `app/settings/index.tsx:284` · `app/settings/notifications.tsx:218` · `app/budget.tsx:518` · `app/family/invite.tsx:210` · `app/import/[importJobId].tsx:1105` · `app/notifications.tsx:306`.
- **온보딩 다섯 화면은 하나도 쓰지 않는다**: `(onboarding)/child-status.tsx:89-93` · `child-profile.tsx:187` · `prepared-items.tsx:221-225`·`:151-155` · `budget.tsx:107-111` · `resume.tsx:117-121` — 전부 `onBack` 없는 `ScreenHeader`.
- 루트 `Stack`은 `headerShown: false`다(`app/_layout.tsx:166`) — 시스템 헤더의 백 버튼도 없다.

**얼마나 자주.** 온보딩을 통과하는 전원. 되돌아가고 싶은 순간은 그중 일부지만, **어포던스 부재는 전원이 겪는다.**

**고치는 크기.** S. ONB-002·003·004에 `onBack={() => router.back()}` 한 줄씩(ONB-001은 스택 첫 화면이라 대상이 아니고, ONB-006은 되돌아갈 앞 화면이 없다).

**막는 것.** ONB-002로 돌아가도 **이미 만든 아이를 고칠 수는 없다** — 화면은 폼을 비운 채 다시 열리고 경고 카드만 세운다(`prepared-items` 방향의 되돌림에서 `child-profile.tsx:191-204`, 문구는 `src/onboarding/local-progress.ts:222-226` "이 기기에는 이미 등록한 아이가 있어요. 여기서 계속하면 아이가 하나 더 생겨요." + [등록한 아이로 계속하기]). 즉 백 버튼을 다는 것과 "온보딩 안에서 아이 정보를 고치게 하는 것"은 다른 두 결정이고, 이 발견은 **앞의 것만** 권한다(뒤의 것은 §값 5 참고 — 저장소는 그 자리를 의도적으로 설정 화면에 두었고 ONB-002가 그 사실을 사용자에게 말한다).

---

### 4. ONB-001의 세 번째 선택지가 "나중에"라고 하고 바로 다음 화면에서 묻는다 — 영향 중 / 크기 S

**사용자가 겪는 일.** 예정일도 생일도 지금 적기 싫은 사람이 "단계를 직접 선택할게요 / **지금 상황에 맞는 단계를 나중에 골라주세요**"를 고른다. 그런데 다음 화면에서 곧바로 단계 칩 10개가 뜨고, 고르지 않으면 [다음]이 잠긴다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/(onboarding)/child-status.tsx:49-55` — `{ mode: "manual", title: "단계를 직접 선택할게요", description: "지금 상황에 맞는 단계를 나중에 골라주세요." }`
- `apps/mobile/app/(onboarding)/child-profile.tsx:322-341` — `draft.stageMode === "manual"`이면 그 자리에서 "아이 단계 선택" + `CHILD_STAGE_CODES.map(...)` 칩 10개(`src/children/child-form.ts:25-36`).
- 저장 가드가 그것을 필수로 만든다: `child-profile.tsx:114-118` `canSave = !manualStageError && ...`, `:125-127` `if (draft.stageMode === "manual" && !manualStage) throw`.

**얼마나 자주.** manual을 고른 사용자 전원 × 1회. (그 갈래는 **날짜 칸 자체가 없는** 유일한 갈래라 — `requiredDateFieldLabel`이 null — "날짜를 안 적고 싶은 사람"이 정확히 이리로 온다.)

**고치는 크기.** S. 설명 한 줄 교체(예: "지금 시기를 목록에서 직접 고를게요."). 문구 1건, 로직 0건.

**막는 것.** 없음.

---

### 5. ONB-002의 이름 칸이 stageMode를 안 본다 — 영향 하 / 크기 S

**사용자가 겪는 일.** 두 돌 아이를 등록하는 사람이 **"태명 / 별명"** 라벨과 **"예) 튼튼이"** 자리표시자를 읽는다. 태명은 태어나기 전의 이름이다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/(onboarding)/child-profile.tsx:208-210` 라벨 `태명 / 별명` (리터럴) · `:212` `accessibilityLabel="태명 또는 별명 입력"` · `:218` `placeholder="예) 튼튼이"`.
- 같은 카드의 **바로 아래 줄**은 stageMode로 갈린다: `:236-240`의 `dateLabel` ← `requiredDateFieldLabel(draft.stageMode)`(`src/children/child-form.ts:57-61`).
- 부제는 두 갈래에 다 성립한다: `:187` "태명이나 별명을 알려주시면 앞으로 이렇게 부를게요." — 즉 **틀린 것은 칸 라벨과 예시 하나뿐**이다.

**얼마나 자주.** 출생 후·manual 가입자 전원 × 1회.

**고치는 크기.** S. `requiredDateFieldLabel`의 형제 함수 하나(`nicknameFieldLabel(stageMode)` + 예시)로 두 리터럴을 교체. 발견 2와 **같은 모듈**에 두면 온보딩 stageMode 문구가 한 자리에 모인다.

**막는 것.** 없음.

---

### 6. 빈 알림함의 CTA가 영구 비활성 토글로 데려간다 — 영향 하 / 크기 S

**사용자가 겪는 일.** 홈의 알림 벨을 눌러 빈 알림함을 본다. "아직 알림이 없어요 / 예산과 아이 성장, 구매 확인 소식이 여기에 따뜻하게 모일 거예요." 아래 [알림 설정 보기]를 누른다. 도착한 화면에서 마스터 토글은 꺼진 채 잠겨 있고 **"지금 앱 버전에서는 푸시 알림을 받을 수 없어요. 앱 업데이트 후 사용할 수 있어요."** 만 있다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/notifications.tsx:322-331` — 빈 상태 카드 + `actionLabel="알림 설정 보기"` → `/settings/notifications`.
- `apps/mobile/app/settings/notifications.tsx:88` `const [pushSupported] = useState(() => isPushSupported());` · `:137-138` `masterToggleDisabled = !pushSupported || ...` · `:287-291` 위 문장.
- `pushSupported`가 오늘 빌드에서 거짓인 이유 둘 다 실재: (ㄱ) `apps/mobile/src/notifications/push-token-source.ts:42-44` `isPushEnabled()`는 `EXPO_PUBLIC_PUSH_ENABLED === "1"`만 참, (ㄴ) 같은 파일 `:5-7` "`expo-notifications` is intentionally NOT a dependency yet".
- 다만 **막다른 길은 아니다**: 알림함은 서버 푸시가 아니라 앱이 스스로 만드는 후보로 찬다(`src/notifications/generators.ts:22-40` — 예산 80/100%·단계 전환·주간 요약·월말 정리·구매 확인). 즉 카드의 약속("여기에 모일 거예요")은 참이고, **CTA만 참이 아니다.**

**얼마나 자주.** 알림함을 처음 여는 사용자 중 CTA를 누르는 비율. 벨은 홈 상단이라 첫 10분 도달 가능.

**고치는 크기.** S. `isPushSupported()`가 거짓이면 CTA를 내리거나(카드는 설명 두 줄로 충분히 선다) 목적지를 바꾼다. 판정 함수는 이미 있고 읽기만 하면 된다.

**막는 것.** 없음(알림함은 픽셀락 밖). 새 npm 의존성은 **필요 없다** — 이 발견은 `expo-notifications`를 설치하자는 제안이 아니라 **없는 상태를 정직하게 그리자**는 제안이다.

---

### 7. R103 커스텀 분류를 만든 사람이 그것을 지출 입력에서 못 찾는다 — 영향 중 / 크기 S

**사용자가 겪는 일.** 설정 > 지출 분류에서 "산후도우미"를 추가한다("우리 가족이 쓰는 분류를 직접 더할 수 있어요."). 다음 지출을 기록하려고 입력 화면을 열면 **바로 기록 8타일에도, 분류별 빠른 품목 아코디언에도 그 분류가 없다.** 저장한 뒤 그 기록을 다시 열어 수정 화면에서만 고를 수 있다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/expenses/new.tsx:183` `const quickExpenseCategories = categoryCatalog;` — 정적 8타일. 이 파일에서 `customCategor`·서버 목록 참조는 0건(`:22`가 `categoryCatalog`만 import).
- 설계가 그 경계를 **의도적으로** 그었다: `docs/5차/round103-custom-expense-category-design.md:29`("입력 8타일: `app/expenses/new.tsx`는 **정적 `categoryCatalog` 8개만** 그린다") · `:311`("v1은 '빠른 기록은 8타일, 분류 조정은 수정 화면'") · `:321`("입력 8타일 / '분류별 빠른 품목' 아코디언 — **0접촉**").
- **그런데 관리 화면이 그 경계를 사용자에게 말하지 않는다**: `apps/mobile/src/categories/custom-category-form.ts:299-311` `customCategoryScreenCopy()`의 문자열 전부(`title: "지출 분류"` · `subtitle: "우리 가족이 쓰는 분류를 직접 더할 수 있어요."` · `addPlaceholder: "예: 산후도우미"` · `addButtonLabel: "분류 추가"` …)에 **"어디서 쓸 수 있는가"를 말하는 문장이 0건**이다.

**얼마나 자주.** 커스텀 분류를 만드는 사용자 전원 × 첫 사용 시 1회. (첫 10분 안에 도달 가능한 경로: 더보기 → 설정 → 지출 분류 관리 — `app/settings/index.tsx:365-367`.)

**고치는 크기.** S. `customCategoryScreenCopy()`에 사실 한 줄 추가(예: 기록은 저장한 뒤 그 기록을 열어 이 분류로 바꿀 수 있다는 사실 + 리포트·예산·CSV에는 자동 반영된다는 사실). 8타일 격자는 **건드리지 않는다** — 그것을 여는 것은 EXP-001 픽셀락 재캡처 + `categoryColors` 색 규칙 재설계 + 자동 분류 추천과 한 묶음이고(같은 설계 문서 `:439-440`), 이 정찰은 그것을 권하지 않는다.

**막는 것.** 없음(설정 하위 화면은 픽셀락 밖 — SET-001은 설정 **첫** 화면이다).

---

### 8. 스토어 빌드에는 로그인 전에 볼 수 있는 것이 0개 — 영향 중 / 크기 L / 즉시 착수 ❌

**사용자가 겪는 일.** 앱을 처음 켠다 → 성장 애니메이션(약 2.2초) → [시작하기] 또는 [건너뛰기] → **로그인 화면.** 여기서 카카오로 로그인하지 않으면 앱의 어떤 화면도 볼 수 없다. "둘러보기"·"체험"·"미리보기" 진입점은 스토어 빌드에 존재하지 않는다.

**근거(2026-09-07 읽음).**
- `apps/mobile/app/index.tsx:394-402` — 토큰도 테스트 세션도 없으면 `/launch-animation`(또는 만료 시 `/login`)으로만 간다.
- `apps/mobile/app/launch-animation.tsx:171` `const finish = () => router.replace("/login");` — [시작하기](`:267`)와 [건너뛰기](`:270`) 둘 다 같은 곳으로.
- `apps/mobile/app/(tabs)/_layout.tsx:41-46` — `isPixelLockMode`가 아니면 세션 없이는 탭에 들어갈 수 없다. 즉 "비세션 미리보기"는 **픽셀락 캡처 경로 전용**이다.
- 데모 세션도 스토어 빌드에는 없다: `app/(auth)/login.tsx:31` `isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1"`, 그리고 `apps/mobile/src/auth/login-copy.ts:6-8`이 "Play 업로드 AAB·production APK는 `EXPO_PUBLIC_TEST_LOGIN="0"`이다 — `scripts/build-android-aab.ts` · `scripts/build-android-apk.ts`"라고 값으로 적어 둔다.
- **데모 데이터의 운명은 정직하게 말한다**(테스트 빌드 한정): `login-copy.ts:63` `TEST_LOGIN_FOOTNOTE = "기록은 이 기기에만 저장되며 실제 카카오 로그인이 아니에요."` — 이 문장이 실사용자 빌드로 새지 않게 하는 갈래·이유가 같은 파일 `:1-13`·`:58-62`에 값으로 잠겨 있다.

**얼마나 자주.** 앱을 설치한 전원.

**고치는 크기.** L. 로그인 전 읽기 전용 프리뷰를 만드는 것은 세션 게이트(`Boolean(authToken && childId)`)를 지나는 모든 화면에 새 갈래를 여는 일이다.

**막는 것.** 제품 결정이고 이 정찰의 권고에 넣지 않는다 — **다만 지금이 정직하다**는 것은 값으로 적어 둔다: 로그인 화면이 하는 약속("카카오로 로그인하면 아이 정보부터 차근차근 시작해요. 입력을 마치면 바로 기록할 수 있어요." — `login-copy.ts:21-22`)이 실제 여정과 정확히 일치한다.

---

## 축별 답

### 축 1 — 첫 실행 → 첫 지출 기록까지의 최소 탭 수

콜드 스타트(세션 없음)에서 세어 본 **최소 12탭**(키보드 입력 제외 · 카카오 외부 동의를 1탭으로 후하게 셈):

| # | 화면 | 탭 | 근거 |
|---|---|---|---|
| — | `app/index.tsx` | 0 (자동 리다이렉트) | `index.tsx:401` |
| 1 | SPL 성장 애니메이션 | [건너뛰기] 또는 [시작하기] | `launch-animation.tsx:267,270` — 자동 전환 타이머 없음(`:157-158`), 인트로 300ms + 6단계×320ms ≈ **2.2초** 후 [시작하기] 등장(`:18,25-26`) |
| 2–4 | AUTH-001 로그인 | 이용약관 + 개인정보 + [카카오로 시작하기] = **3탭** | `login.tsx:374-388`(필수 둘, **"모두 동의" 행 없음** — 저장소 전체 grep 0건) · `:401-425` |
| 5 | 카카오 OIDC | ≥1 (외부) | `login.tsx:331` `void login()` |
| 6 | ONB-001 상태 선택 | 타일 1탭(선택 즉시 push) | `child-status.tsx:76-83` |
| 7 | ONB-002 아이 프로필 | [다음] 1탭 + **키보드 필수** (태명, 날짜) | `child-profile.tsx:370-374`. 날짜는 손타이핑 10자 또는 달력 **+2~3탭**(`:275-311`, 월 점프 시트 있음 — `src/expenses/ExpenseDatePicker.tsx:372,409-410`) |
| 8 | ONB-003 준비물 | [저장하고 계속] / [건너뛰고 계속] 1탭 | `prepared-items.tsx:319-323` |
| 9 | ONB-004 예산 | [나중에 설정할게요] 1탭 | `budget.tsx:161` |
| 10 | HOME 첫 실행 카드 | [지출 기록하기] 1탭 | `src/home/first-run-guide.ts:186-187` → `/expenses/new` |
| 11–12 | EXP-001 | 분류 타일 1탭(품목명 자동 채움 + **커서가 금액으로 이동**) + [저장하기] 1탭 | `app/expenses/new.tsx:2122-2133`(`amountInputRef.focus()`) · `:2805-2816` |

**= 12탭.** 현실적으로는 달력 사용(+2~3)과 카카오 2화면(+1)까지 **14~16탭**.

**막다른 자리 / 되돌아가기 불가 자리**는 발견 3 하나로 모인다. 그 외에 **탈출구가 이미 값으로 세워진 자리**가 셋 있다(§값 3~5).

### 축 2 — stageMode 분기가 첫 화면부터 정직한가

정직하지 **않은** 자리 셋: 발견 2(ONB-003 머리말) · 발견 4(ONB-001 manual 설명) · 발견 5(ONB-002 이름 칸). 셋 다 **문구층**이고 판정층은 건강하다.

정직한 자리(값으로 확인):
- 날짜 칸 라벨·달력 방향이 stageMode로 갈린다 — `src/children/child-form.ts:57-61` · `child-profile.tsx:300` `childDatePickerDirection(draft.stageMode)`.
- 홈 카운터는 세 갈래를 정확히 가른다 — `src/home/baby-counter.ts:147-165`: pregnant는 D-N/예정일 당일/유예 내, born은 "함께한 지 N일"(태어난 날 = 1일차), **manual과 알 수 없는 값은 `null`을 돌려주고 아무 말도 하지 않는다**.
- 예정일이 14일 넘게 지난 임신 프로필에서 "임신 42주차" 고착을 표시층이 막는다 — `src/home/stage-display-label.ts:47,65-71`(`PREGNANCY_OVERDUE_STAGE_LABEL = "예정일이 지났어요"`), 그리고 그 판정을 홈·더보기·이어하기 세 화면이 **같은 함수로** 지난다(`(onboarding)/resume.tsx:72-79`).
- 100일 카운트다운은 출생 전에 아예 만들어지지 않는다 — `src/home/milestone-countdown.ts:41`.

### 축 3 — 빈 상태: "없어요"만 말하고 다음 행동을 안 주는 자리

**한 자리도 없다.** 확인한 빈 상태 전부가 행동을 준다:

| 화면 | 문장 | 행동 | 근거 |
|---|---|---|---|
| 홈(기록 0건) | "첫 지출을 기록해 보세요 / 10초면 돼요…" | [지출 기록하기] → `/expenses/new` | `src/home/first-run-guide.ts:179-192` |
| 홈(보기 전용 세션) | 사실 두 줄 | **버튼 없음(의도)** — 약속을 지울 수 없어 사실만 남긴다 | 같은 파일 `:194-214` |
| 기록 탭(현재 달 0건) | "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요." | [기록하기] | `src/expenses/records-list-view.ts:622-624` |
| 기록 탭(끝난 달 0건) | "{달}에는 기록이 없어요." | 달력 보기 / 이번 달 보기 | 같은 파일 `:629-631` |
| 기록 탭(필터로 비었을 때) | 필터 프레이밍 문장 | 필터 해제 + 지난달 검색 + 월 점프 + **전 기간 검색** 넷 | `app/(tabs)/records.tsx:2500-2513` |
| 준비템(찜 0건) | "아직 찜한 준비템이 없어요." | [준비템 목록 보기] | `app/(tabs)/items.tsx:1337-1341` |
| 준비템(필터로 비었을 때) | "검색·필터에 맞는 준비템이 없어요." | [필터 초기화](찜 칩까지 함께 푼다) | 같은 파일 `:1342-1355` |
| 준비템(진짜 0건) | "아직 볼 수 있는 준비템이 없어요." | [홈으로 가기] + 바로 아래 [직접 추가하기] | `:1356-1362` · `:1468-1477` |
| 리포트(끝난 기간 0건) | 기간 라벨 + "기록이 없어요." | 이번 달/분기/올해 보기 — **`/expenses/new`로 보내지 않는다**(날짜를 지어내지 않기 위해) | `src/reports/empty-period-card.ts:41-48,85-89` |
| 알림함 | "아직 알림이 없어요" + 설명 | [알림 설정 보기] ← **발견 6** | `app/notifications.tsx:322-331` |

유일한 흠이 발견 6(행동은 있는데 그 행동이 오늘 빌드에서 아무 일도 못 한다)이다.

### 축 4 — 온보딩에서 잘못 입력한 값을 나중에 고칠 수 있는가 / 그 경로가 발견 가능한가

**고칠 수 있고, 앱이 그 사실을 먼저 말한다.**

- ONB-002가 입력 **당시에** 두 번 말한다: 날짜 칸 도움말 `child-profile.tsx:315-317` "시기에 맞는 준비물과 리포트를 보여드리는 데 써요. **나중에 설정에서 바꿀 수 있어요.**", 그리고 카드 하단 안심 문구 두 줄 `src/children/child-form.ts:233-236` — "아이 정보는 함께 기록하는 가족에게만 보여요. 밖에 공개되지 않아요." / "저장한 아이 정보는 설정에서 언제든지 바꾸거나 삭제할 수 있어요."
- 그 문장이 참이다: `app/settings/children.tsx:249`(편집 폼이 `stageMode`에 따라 `dueDate`/`birthDate`를 채운다) · `:457` `updateChild(...)` · `:771-775` 행마다 [편집] · `:852` [아이 추가] · `:469-475` 임신→출생 전환.
- **발견 경로 2단계**: 더보기 탭의 아이 프로필 카드가 곧바로 `/settings/children`으로 간다(`app/(tabs)/more.tsx:396-410` — 라운드 41이 이 카드의 목적지를 `/family`에서 여기로 고친 이유가 주석에 있다). 설정 목록에도 별도 행이 있다(`app/settings/index.tsx:316-318` "아이 관리 / 아이를 전환하거나 정보를 수정해요").
- 예산도 같다: ONB-004가 "언제든 바꿀 수 있어요."라고 말하고(`budget.tsx:110`), 설정에 [예산 수정] 행이 있다(`settings/index.tsx:334-336`).
- 준비물 체크도 같다: ONB-003이 "나중에 준비템 탭에서 언제든 다시 체크할 수 있어요."(`prepared-items.tsx:313-315`)라고 말하고 그 탭이 실재한다.

**남는 한 가지 마찰**: 고치는 자리가 **온보딩 안에 없다**. ONB-002를 다시 열어도 폼은 비어 있고 경고 카드만 선다(발견 3의 "막는 것" 문단). 저장소는 그것을 알고 대신 **온보딩 안에서 "설정에서 고칠 수 있다"고 말하는 쪽**을 골랐고, 그 선택은 값으로 문서화돼 있다(`src/children/child-form.ts:216-231` 머리말). 이 정찰은 그 선택을 뒤집자고 권하지 않는다.

### 축 5 — 로그인 없이 볼 수 있는 것과 로그인 후의 낙차 / 데모 데이터

발견 8 참조. 요약: **스토어 빌드에 로그인 전 화면은 0개**이므로 "낙차"라는 개념이 성립하지 않는다. 데모(테스트 로그인)는 개발/테스트 APK 전용이고, 그 빌드에서는 데이터의 운명을 정직하게 말한다(`login-copy.ts:63`). 그리고 데모도 **실가입과 같은 여정**을 탄다 — 예전에는 온보딩을 통째로 건너뛰고 데이터가 심어진 탭으로 들어갔는데 그 예외가 제거됐다(`login.tsx:320-329` · `app/(tabs)/_layout.tsx:48-49` · `app/index.tsx:491-494`의 세 주석이 같은 사실을 값으로 적는다).

### 축 6 — 권한 요청 타이밍

**모범적이다. 첫 화면에서도, 온보딩 어디에서도 알림 권한을 묻지 않는다.**

- 부팅 등록 훅은 **권한을 요청하지 않는다**: `src/notifications/usePushDeviceRegistration.ts:118` `getToken: () => getPushToken()` — 옵션 없이 부른다. 같은 파일 `:78-82`가 그 사실을 값으로 적어 둔다("부팅 훅은 권한을 묻지 않으므로 … 권한을 묻는 자리는 화면의 토글 하나뿐이다").
- 요청은 `requestPermission: true`가 붙은 **단 한 자리**에서만 난다: `app/settings/notifications.tsx:112` `await getPushToken({ requestPermission: true })`. 저장소 전체에서 그 옵션을 넘기는 호출부는 이 한 줄뿐이다.
- 판정 자체: `src/notifications/push-token-source.ts:99-101` — `getPermissionsAsync()`로 먼저 보고, `options.requestPermission`일 때만 `requestPermissionsAsync()`.
- 오늘 스토어 빌드에서는 그 토글마저 잠겨 있다(발견 6) — 즉 **실사용자에게 OS 권한 팝업이 뜨는 경로가 현재 0건**이다.

---

## 값으로 적어 두는 것 — 이미 잘 돼 있는 자리

1. **늘어난 기능 넷이 온보딩에 새지 않았다.** ONB-004는 여전히 금액 칸 하나 + [나중에 설정할게요]다(`(onboarding)/budget.tsx:128-162`) — R102의 카테고리 예산 UI는 `app/budget.tsx:369-372,396-431,649,703`에만 있고 온보딩 화면에는 `categoryBudget` 참조가 0건이다. R101/104의 전 기간 검색도 사용자가 검색을 시작한 뒤에만 열린다(`app/(tabs)/records.tsx:887-894`).
2. **ONB-003의 후보가 최대 6개로 잠겨 있다** — `src/onboarding/prepared-items-selection.ts:28` `PREPARED_ITEM_OPTION_LIMIT = 6`, 필수 우선 정렬(`:41-63`), 기본값은 **전체 해제**(`prepared-items.tsx:46`). "아무것도 안 눌러도 준비 완료로 선언되던" 라운드 45 이전의 허위 성공이 값으로 봉인돼 있다.
3. **ONB-003에 오프라인 탈출구가 있다** — 저장 실패 + 체크 0건일 때만 열리는 [나중에 체크할게요](`prepared-items.tsx:192,324-331` · 판정 `src/onboarding/local-progress.ts:185,195`). 체크한 항목이 있으면 열리지 않는다(로컬 통과가 저장한 척하지 않게).
4. **ONB-003에 아이 없이 들어온 진입의 탈출구가 있다** — `prepared-items.tsx:146-171`, 문구·라벨·목적지 전부 `local-progress.ts:247-259`. 종전에는 "건너뛰어도 괜찮아요"라 말하면서 버튼이 영구 비활성인 막다른 화면이었다.
5. **"처음부터 시작"이 아이를 복제할 수 없다** — 서버가 게이트를 진다: `apps/api/src/onboarding/onboarding-core.service.ts:354-357,413`("once a child has been created for the household, '처음부터'는 더 이상 제공되지 않는다"). 모바일은 그 값을 읽기만 한다(`(onboarding)/resume.tsx:153` `{canRestart ? <SecondaryButton label="처음부터 시작" .../> : null}`).
6. **ONB-006 이어하기가 과거를 과장하지 않는다** — `resume.tsx:109-120`: 종전 `지난번에는 "{단계}"까지 진행했어요`가 **아직 가지 않은 단계**를 말하고 있었고, `이번에는 "{단계}"부터 이어가요.`로 고쳐졌다. 준비물 0개도 "0개 저장됨" 대신 "체크한 준비물은 아직 없어요"로 말한다(`:129-138`).
7. **콜드 스타트에 흰 화면이 없다** — `app/index.tsx:389-392,431-435,466-472`의 세 대기 자리가 전부 `ColdStartHoldView`(제목+설명+스켈레톤 두 장, `:70-83`)를 그리고, 판정은 순수 모듈 한 곳(`src/onboarding/cold-start-hold.ts`)에서 온다. 하이드레이션(`:185`)과 진행도 조회(`:281`) 양쪽에 3초 안전 밸브가 있다.
8. **첫 실행 안내는 홈에 언제나 한 장뿐이다** — `src/home/first-run-guide.ts:232-258`이 배열이 아니라 단일 값/`null`을 돌려주고, "모르면 띄우지 않는다"가 세 곳에서 강제된다(`:234,244,248`).
9. **온보딩 진행 표시가 실제 흐름에서 파생된다** — `src/onboarding/step-ui.tsx:34-37`이 `onboardingSteps`(`src/onboarding/steps.ts:1-6`, ONB-001~004)에서 단계 수를 세므로 "3/4"가 실제 흐름과 어긋날 수 없고, `accessibilityRole="progressbar"` + `온보딩 4단계 중 N단계` 낭독(`:41-42`)이 붙는다.
10. **성장 애니메이션이 reduce-motion을 존중하고 상시 탈출구를 준다** — `launch-animation.tsx:116-131`(reduce-motion이면 마지막 단계로 즉시 점프) · `:268-270`([건너뛰기]가 인트로 홀드 동안에도 상시 노출).
11. **ONB-002의 아이 생성이 중복될 수 없다** — 멱등키를 **본문 지문에 묶는다**(`child-profile.tsx:139` `getOrCreateChildCreateIdempotencyKey(childCreateBodyFingerprint(body))`), 그리고 동의 미저장(403 `CONSENT_REQUIRED`)으로 막힌 저장을 **한 번만** 자동 복구한다(`:159` `saveWithConsentRecovery(...)` — 그 규칙이 없던 시절 온보딩이 막다른 길이었다는 근거가 `:145-157`에 있다).

---

## 권고 (4건)

### 권고 A — 기록 탭 0건 화면에서 필터 장치 세 벌을 접는다 (발견 1)
순수 판정 하나(`이번 달 표시 행 > 0 || 검색어 있음 || 카테고리 필터 걸림 || 전 기간 스코프`)를 만들고, 검색 입력(`records.tsx:2308`)·카테고리 칩 스트립(`:2376`)·정렬 토글(`:2396`)을 그 값으로 감싼다. **스트립을 지우지 말고 감싼다**(`records-calendar.test.ts`의 "ScrollView 1개" 계약과 `a11y-contract`의 칩 줄 실측이 그 노드를 문다 — `records.tsx:2388-2395` 주석). 문구 신규 0건. 픽셀락 무관.

### 권고 B — 온보딩 문구를 stageMode로 가르고, 뒤로 가기를 단다 (발견 2·3·4·5)
`src/onboarding/`에 stageMode → 문구 순수 모듈 하나를 새로 두고(기존 `src/children/child-form.ts:57-61`의 `requiredDateFieldLabel`과 같은 모양) ONB-003의 머리말 두 자리(`prepared-items.tsx:151-155`·`:221-225`)와 ONB-002의 이름 칸 라벨·예시(`child-profile.tsx:208-218`)가 그 함수를 읽게 한다. 같은 트랙에서 ONB-001의 manual 설명 한 줄(`child-status.tsx:53`)을 사실에 맞게 고치고, ONB-002·003·004의 `ScreenHeader`에 `onBack={() => router.back()}` 한 줄씩 단다(ONB-001·ONB-006 제외 — 각각 스택 첫 화면 / 되돌아갈 앞 화면 없음). **온보딩 안에서 아이 정보를 고치게 하는 것은 이 권고에 넣지 않는다**(축 4 참고 — 저장소가 그 자리를 의도적으로 설정 화면에 두었고 ONB-002가 사용자에게 그 사실을 말한다).

### 권고 C — 커스텀 분류 관리 화면이 "어디서 쓸 수 있는지"를 말한다 (발견 7)
`customCategoryScreenCopy()`(`src/categories/custom-category-form.ts:299-311`)에 사실 한 줄을 더하고 화면(`app/settings/categories.tsx`)이 그리게 한다. **입력 8타일은 열지 않는다** — EXP-001 픽셀락 격자 + `categoryColors` 색 규칙 + 자동 분류 추천이 한 결정으로 묶여 있다(`docs/5차/round103-custom-expense-category-design.md:311,439-440`). ⚠️ 8타일을 여는 안은 **픽셀락 재캡처(실기기 — 지금 불가)** 대상이므로 이 라운드의 권고가 아니다.

### 권고 D — 빈 알림함의 CTA를 오늘의 사실에 맞춘다 (발견 6)
`app/notifications.tsx:322-331`의 빈 상태에서 `isPushSupported()`(`src/notifications/push-token-source.ts:73`)가 거짓이면 [알림 설정 보기]를 내리거나 다른 곳을 가리킨다. ⚠️ **새 npm 의존성 필요 없음** — 이 권고는 `expo-notifications`를 설치하자는 것이 아니라 없는 상태를 정직하게 그리자는 것이다. (설치는 `push-token-source.ts:9-19`의 4단계 활성 절차 + Firebase 자격 + **승인 필요**한 별개 결정이다.)

---

## 교집합 없는 소유 파일 목록

| 권고 | 소유 파일 (쓰기) | 읽기만 |
|---|---|---|
| **A** | `apps/mobile/app/(tabs)/records.tsx`<br>`apps/mobile/src/expenses/records-empty-chrome.ts` (신규)<br>`apps/mobile/src/expenses/records-empty-chrome.test.ts` (신규) | `src/expenses/records-sort.ts` · `src/expenses/records-list-view.ts` |
| **B** | `apps/mobile/app/(onboarding)/child-status.tsx`<br>`apps/mobile/app/(onboarding)/child-profile.tsx`<br>`apps/mobile/app/(onboarding)/prepared-items.tsx`<br>`apps/mobile/app/(onboarding)/budget.tsx`<br>`apps/mobile/src/onboarding/onboarding-stage-copy.ts` (신규)<br>`apps/mobile/src/onboarding/onboarding-stage-copy.test.ts` (신규) | `src/children/child-form.ts` · `src/ui.tsx` · `src/onboarding/local-progress.ts` · `src/onboarding/steps.ts` |
| **C** | `apps/mobile/src/categories/custom-category-form.ts`<br>`apps/mobile/src/categories/custom-category-form.test.ts`<br>`apps/mobile/app/settings/categories.tsx` | `app/expenses/new.tsx` · `src/categories.ts` · `docs/5차/round103-custom-expense-category-design.md` |
| **D** | `apps/mobile/app/notifications.tsx` | `src/notifications/push-token-source.ts` · `app/settings/notifications.tsx` |

네 권고의 쓰기 대상은 서로 겹치지 않는다. `app/(onboarding)/**`는 **B가 전부 소유**하고(A·C·D는 손대지 않는다), `app/(tabs)/records.tsx`는 **A만**, `src/categories/**`·`app/settings/categories.tsx`는 **C만**, `app/notifications.tsx`는 **D만** 만진다.

> 참고: `apps/mobile/app/onboarding/*.tsx` 다섯은 `(onboarding)` 대응 파일을 **한 줄로 재수출**하는 별칭이다(예: `app/onboarding/budget.tsx` 전체가 `export { default } from "../(onboarding)/budget";`). 라우터는 `/onboarding/...` 경로를 쓰므로 지우지 말 것 — B는 그 다섯 파일을 건드리지 않는다.

## 픽셀락 영향

이 문서의 권고 넷 중 **픽셀락 재캡처가 필요한 것은 0건**이다. 잠긴 아홉은 `SPL-001 · HOME-001 · EXP-001 · ITEM-001 · ITEM-002 · REP-001 · FAM-001 · IMP-003 · SET-001`(`scripts/pixel-lock/pixel-lock-screens.json`, 2026-09-07 읽음)이고, 권고가 만지는 화면(온보딩 5 · 기록 탭 · 알림함 · 설정 하위 "지출 분류")은 전부 그 목록 밖이다. ⚠️ **재캡처가 필요한 안**은 권고 C의 문단에서 명시적으로 제외한 "커스텀 분류를 입력 8타일에 편입" 하나뿐이며, 그것은 실기기가 필요해 지금 불가하다.
