# 라운드 106 정찰 S2 — 접근성 감사 (대장 밖의 축)

**읽은 시점: 2026-09-07 08:12~08:25 UTC.** 소스는 한 줄도 고치지 않았다(읽기 전용).
⚠️ **동시 편집 경고**: 이 세션 중에 `app/family/index.tsx`·`app/expenses/new.tsx`가 다른
에이전트에 의해 움직였다(family는 08:12→08:22 사이 줄 번호가 23~35줄 밀렸다: 514→537 ·
666→701). 아래 인용의 줄 번호는 **08:22 UTC 재확인분**이고, 내용 문자열을 함께 적어 두었으니
줄이 또 밀리면 문자열로 찾으면 된다.

## 이 문서가 세지 않는 것

`src/a11y-contract.test.ts`(8,353줄 · describe 45개)가 이미 무는 축은 여기서 다시 세지 않는다:
저장 실패 문장의 낭독 출구(GAP-079), 뮤테이션 방아쇠에서 파생한 낭독(GAP-080), 라벨↔onPress
짝, 선택 상태 이중 낭독 금지(GAP-095), 그리고 **열거된 터치 타깃 자리들**(GAP-064 #6 ·
GAP-065 #7 · GAP-069 #5). 이 문서는 그 대장의 **모집단 밖**만 본다.

---

## 요약 표

| # | 한 줄 | 영향 | 크기 | 픽셀락 |
|---|---|---|---|---|
| 1 | 글자 줄만 감싼 트리거 **18자리**가 48dp 미달(최악 18dp) — 대장은 이 모집단을 세지 않는다 | 상 | M | 아니오(해당 노드는 캡처 밖) |
| 2 | 공유 프리미티브 두 자리가 `minHeight: 44` — `theme.touchTarget`(48) 단일 소스 밖에 산다 | 중 | S | 1자리만 ⚠️(EXP-001) |
| 3 | placeholder 글자 대비 **1.32:1**(gray300) · **2.62:1**(textDisabled) — 실측 7자리 | 상 | S | 아니오 |
| 4 | 공용 `ScreenHeader`의 제목에 `accessibilityRole="header"`가 없다 — **24자리 / 22파일** | 상 | S | 아니오 |
| 5 | 조회 실패 낭독의 모집단 = **17자리 / 15화면**(대장이 일부러 열지 않은 축) | 중 | M~L | 아니오 |
| 6 | 고정 상자 + 배율되는 글리프 — fontScale 1.3~1.5에서 체크 표시·배지 숫자가 잘린다(6자리) | 중 | S | 일부 ⚠️(EXP-001) |
| 7 | `adaptiveTabBarHeight`는 테스트만 있고 **호출부 0** — 탭바는 배율을 따라가지 않는다 | 중 | M | ⚠️(TAB-001) |
| 8 | 탭 **활성** 라벨 색 coral[500] = 흰 배경 **3.43:1**(10px 글자) — 대장의 정규식이 못 무는 자리 | 중 | S | ⚠️(TAB-001 등 전 캡처) |

**이미 잘 돼 있는 축(값으로)**: reduce motion · 아이콘 버튼 라벨 · 선택/체크 상태 ·
아이콘의 접근성 트리 은폐 · 준비 카드 잉크/틴트 대비 — 아래 「이미 통과한 축」에 값으로 적었다.

---

## 발견 1 — 글자 줄만 감싼 트리거 18자리가 48dp 미달

**누가 못 쓰는가.** 손떨림·저시력·큰 손가락으로 앱을 쓰는 사람. 화면에서 사라지는 것이 아니라
**눌러도 반응이 없다** — 이 저장소가 두 번 고쳤던 바로 그 실패 모양이다(GAP-066 M-2의
"감싸기만 한 버튼의 몸은 글자 줄 하나다", `app/(tabs)/items.tsx:1150`의 "텍스트 한 줄(≈17dp) +
hitSlop 8로는 ≈33dp라 48dp 최소 타깃에 못 미쳤다").

**대장이 못 보는 이유(값).** `GAP-064 #6`은 경로를 손으로 적은 배열이 모집단이다 —
입력 보조 칩 4 · 상세 플로팅 크롬 2 · 달 점프 트리거 2. `GAP-065 #7`은 공유 프리미티브
3종(CategoryChip · SegmentedControl · 벨/검색 정사각). **합쳐도 11자리**이고, 아래 18자리는
그 어느 목록에도 이름이 없다. `src/a11y-contract.test.ts`에서 `touchTarget`이라는 낱말이
나오는 곳은 18군데뿐이고 전부 그 열거된 자리다(08:22 UTC 실측).

**모집단을 어떻게 세었는가.** `app/**`·`src/**`의 비테스트 `.tsx`를 전수 파싱해
`<Pressable>` **158자리**를 뽑고, 자식이 `<Text>`뿐인 것만 남긴 뒤, 태그의 인라인 style과
이름 붙은 style 선언(같은 파일의 `const …Style = { … }`)을 해석해
`세로 히트 = 상자 높이 + 2×hitSlop`을 계산했다. 상자 높이는 명시 `lineHeight`가 있으면 그
값, 없으면 **소스가 보증하는 하한**(`fontSize × 1.25`)이다 — 대장이 세그먼트 탭에서 쓴
"줄 상자 ≥ fontSize" 규율과 같은 방향이고, 실제 한글 줄 상자는 1.3~1.4배라 아래 숫자는
**하한**이다(그래도 ≤35dp 무리는 1.4배로 계산해도 48에 못 미친다).

| 파일:줄 (08:22 UTC) | 무엇 | 세로 히트 | 근거 |
|---|---|---|---|
| `app/family/index.tsx:701` | `대기 중인 초대 다시 불러오기` | **≈18dp** | `familyInviteErrorStyle` 12/18, `hitSlop` **없음** |
| `app/sync-status.tsx:180` | 충돌 병합 "내 값" 칩 | ≈31dp | 12px + `paddingVertical: 8`, hitSlop 없음 |
| `app/sync-status.tsx:204` | 충돌 병합 "다른 기기 값" 칩 | ≈31dp | 위와 같은 상자 |
| `app/import/[importJobId].tsx:211` | 검수 행 분류 편집 토글 | ≈31dp | `rowCategoryEditStyle` 12px + hitSlop 8 |
| `app/expenses/recurring.tsx:568` | 정기 지출 `삭제` | ≈32dp | `deleteLinkStyle` 13px + hitSlop 8 |
| `app/family/index.tsx:671` | 구성원 `삭제` | ≈32dp | `familyMemberDeleteStyle` 13px + hitSlop 8 |
| `app/family/index.tsx:725` | 대기 초대 `취소` | ≈32dp | 같은 스타일 |
| `app/settings/children.tsx:769` | 아이 `편집`/`닫기` | ≈32dp | `editLinkStyle` 13px + hitSlop 8 |
| `app/family/index.tsx:537` | 가구 전환 입구 | **34dp(정확)** | `familyHouseholdSwitchStyle` 12**/18** + hitSlop 8 |
| `app/family/index.tsx:564` | 아이 추가 입구 | **34dp(정확)** | `familyHouseholdAddChildStyle` 12/18 + hitSlop 8 |
| `app/family/index.tsx:586` | 가구 탈퇴 입구 | **34dp(정확)** | `familyHouseholdLeaveStyle` 12/18 + hitSlop 8 |
| `app/notifications.tsx:309` | `모두 지우기` | ≈39dp | 12px + hitSlop 12 |
| `app/(tabs)/index.tsx:2726` | 최근 지출 `전체 보기` | ≈39dp | 12px + hitSlop 12 |
| `app/(tabs)/index.tsx:2515` | 시기 회고 카드 닫기 | **42dp(정확)** | 12/18 + hitSlop 12 |
| `app/(tabs)/index.tsx:2974` | 첫 기록 축하 카드 닫기 | **42dp(정확)** | 12/18 + hitSlop 12 |
| `app/expenses/[expenseId].tsx:1370` | 날짜 직접 입력 토글 | ≈43dp | 12px + hitSlop 14 |
| `app/expenses/new.tsx:2049` | 날짜 직접 입력 토글 | ≈43dp | 12px + hitSlop 14 |
| `app/(tabs)/reports.tsx:1266` | 리포트 제목=아이 전환 트리거 | **46dp(정확)** | 제목 22**/30** + hitSlop 8 |

가장 나쁜 자리(`family/index.tsx:701`)의 실제 코드 — hitSlop도 minHeight도 없다:

```tsx
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="대기 중인 초대 다시 불러오기"
                onPress={() => pendingInvites.refetch()}
                style={familyPressedTextFeedback}   // = ({pressed}) => ({ opacity: pressed ? 0.6 : 1 })
              >
                <Text style={familyInviteErrorStyle}>{pendingInviteLoadErrorText}</Text>   // 12/18
              </Pressable>
```

**고치는 크기: M.** 고침은 이 저장소가 이미 두 번 쓴 그 한 줄이다 —
`minHeight: theme.touchTarget` + `justifyContent: "center"`(`GAP-066 #2`의 달 점프 트리거,
`app/(tabs)/items.tsx:1141`). `paddingVertical`로 벌지 않는다(줄 높이가 바뀐다).
`hitSlop`으로 벌 수 없는 자리가 둘 있다: **sync-status의 두 칩**은 `flexDirection: "row"`로
맞붙어 있어 가로는 0이어야 하고(세로는 이웃이 없어 자유), **family의 세 링크**는 세로로 이어져
있으므로 hitSlop을 8→15로 올리면 서로 겹친다 → 높이로 갚아야 한다.

**픽셀락에 걸리는가: 아니오.** 세 무리 전부 캡처 밖이라는 **근거가 소스에 값으로 있다**:
family의 세 입구는 `householdSwitchOptions.length >= 2` / `switchedHouseholdId` 게이트 뒤에
있고 화면 주석이 *"1가구 계정과 비로그인 미리보기 FAM-001에서는 이 노드가 그려지지 않는다"* 로
못박고 있다. reports 제목 트리거도 *"비세션 미리보기(REP-001 픽셀락 캡처)에서는 …
canSwitch가 false라 … 종전의 `<Text>리포트</Text>` 그대로다"*. sync-status·notifications·
recurring·import 검수·settings/children은 캡처 목록에 화면 자체가 없다.
⚠️ 예외 하나 — `app/(tabs)/index.tsx:2515·2726·2974`는 홈이므로 **세션 렌더**다.
HOME-001은 비세션 캡처라 그래도 밖이지만, 42dp→48dp는 6dp 줄이 늘어나는 **눈에 보이는 변화**라
승인 대조가 필요하다(비세션 캡처 자체는 불변).

---

## 발견 2 — 공유 프리미티브 두 자리가 `minHeight: 44`

이 저장소의 최소 터치 타깃 단일 소스는 `src/theme.ts`의 `touchTarget: 48`이고, 대장은 그
값으로 계산한다. 그런데 두 자리가 44로 산다.

**ⓐ `src/ui.tsx:1338` — 도넛 범례 드릴다운 줄** (08:22 UTC)

```tsx
                style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 6, minHeight: 44, opacity: pressed ? 0.76 : 1 })}
```

바로 위 주석(`src/ui.tsx:1249`)이 스스로 값을 적어 뒀다: *"선택 가능한 줄만 44dp 터치
타깃으로 키운다 — 캡션 한 줄 높이의 버튼은 손가락으로 정확히 누를 수 없고, hitSlop으로 늘리면
이웃 줄의 영역과 겹친다."* 줄 사이 간격은 `gap: onSelect ? 0 : 5`라 **눌리는 분기에서는 0**
이므로 hitSlop 판단은 옳다. 남은 답은 44→48 한 글자다.

**픽셀락: 아니오.** 같은 함수의 주석이 *"비세션 장식 분기는 어느 쪽이든 한 글자도 닿지
않는다(REP-001 픽셀락)"* 라고 값으로 적어 뒀고, 44는 `segments`가 있는 세션 분기에만 산다.

**ⓑ `app/expenses/new.tsx:2634` — 하단 요약바의 품목명 수정 버튼**
```tsx
                  gap: 6,
                  minHeight: 44,
```
⚠️ **픽셀락에 걸린다.** 같은 요약바 바로 아래 주석이 *"비세션(EXP-001)에도 렌더되는 변화라
기준 이미지 재캡처가 같이 간다"* 라고 적고 있다 → **실기기가 필요해 지금 불가능**.

**ⓒ 덤(같은 성격, Pressable이 아니라 입력칸)**: `app/expenses/new.tsx:2078` 날짜 직접 입력
`TextInput`이 `minHeight: 44`다. 입력칸도 터치 타깃이다.

**고치는 크기: S**(ⓐ는 한 글자, ⓑ는 캡처 대기).

---

## 발견 3 — placeholder 글자의 실측 대비 1.32:1

**계산 근거.** `src/theme.ts`(08:12 UTC 읽음)와 `src/design-system/tokens/color.ts`의 값을
WCAG 2.x 상대휘도 공식으로 계산했다(추측 아님, 계산기 스크립트로 산출).

| 앞색 | 뒷배경 | 대비 | 판정 |
|---|---|---|---|
| `gray300` **#E5DFDB** | `white` **#FFFFFF** | **1.32:1** | ✗ (4.5:1 필요) |
| `semanticColors.textDisabled` **#A99E97** | `#FFFFFF` | **2.62:1** | ✗ |
| `gray600` #5F5854 | #FFFFFF | 6.98:1 | ✓ |

**실제로 그 색이 placeholder인 자리(전수, 08:20 UTC):**

- `app/settings/categories.tsx:306` · `:446` — `placeholderTextColor={theme.colors.gray300}`,
  배경은 `inputStyle.backgroundColor = theme.colors.white`(`app/settings/categories.tsx:506`),
  글자 15px. 문장은 `copy.addPlaceholder`(분류 이름을 어떻게 적으라는 **안내문**).
- `app/settings/amount-presets.tsx:108` — 같은 색, `amountInputStyle` 배경 white
  (`:162`), 15px, 문구 `"금액을 입력해 주세요"`.
- `app/settings/app-lock.tsx:242` · `src/security/AppLockOverlay.tsx:294` — 같은 색,
  `pinInputStyle` 배경 white(`app-lock.tsx:434`). 문구는 `"••••"`(장식성 점).
- `src/preparation/PreparationListParity.tsx:613` — `semanticColors.textDisabled`,
  배경 `semanticColors.surface`(#FFFFFF), 문구 `"품목명·별칭·분류 검색"` → **2.62:1**.
- `src/design-system/components/ModV1Primitives.tsx:113` — 같은 색·같은 배경.

**누가 못 쓰는가.** 저시력·노안·야외 밝은 화면에서 쓰는 사람. placeholder는 **비활성 컨트롤이
아니다**(입력칸은 살아 있다) — WCAG 1.4.3의 비활성 예외가 적용되지 않는 진짜 미달이다.
"금액을 입력해 주세요"가 안 보이면 그 칸이 무엇을 받는 칸인지 알 길이 없다.

**같은 저장소 안에 이미 정답이 있다**: `app/expenses/new.tsx:2671` ·
`app/expenses/recurring.tsx:393·417·466·488`은 같은 자리에 `theme.colors.gray600`(6.98:1)을
쓴다. 즉 이 저장소는 관례를 두 벌 갖고 있고 한 벌만 통과한다.

**대장이 못 보는 이유(값).** `src/a11y-contract.test.ts:127`의
`lowContrastCoralTextPattern`은 주석이 스스로 밝히듯 *"Matches the lowercase `color:` prop
only"* 이고 **coral 토큰만** 본다. `placeholderTextColor=` 는 `color:`가 아니고 gray300은
coral이 아니라, 이 자리는 정규식의 두 조건 모두에서 빠진다.

**고치는 크기: S**(7자리의 색 토큰 교체 · gray300→gray600, textDisabled→textSecondary).
**픽셀락: 아니오** — 다섯 화면 모두 캡처 목록 밖이고, placeholder는 값이 비었을 때만 그려진다.

---

## 발견 4 — 공용 `ScreenHeader`의 제목에 header role이 없다

`src/ui.tsx:199` (08:22 UTC):

```tsx
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text style={[textStyles.caption, { color: smallCoralText }]}>{eyebrow}</Text> : null}
        <Text style={[textStyles.h2, { color: theme.colors.brown }]}>{title}</Text>
        {subtitle ? <Text style={[textStyles.body2, { color: theme.colors.gray600 }]}>{subtitle}</Text> : null}
      </View>
```

제목 `<Text>`에 `accessibilityRole="header"`가 없다.

**모집단**: `<ScreenHeader` **24자리 / 22파일**(08:20 UTC 전수) — 온보딩 5 · 탭 2 ·
설정 7 · 가족 2 · 지출 2 · 예산 · 알림함 · 가져오기 · 동기화.

**이것이 비대칭인 근거(값).** 같은 저장소의 다른 제목 프리미티브는 전부 그 역할을 진다:
`src/design-system/components/CorePrimitives.tsx:39`(ScreenTitle) · `:104` · `:127`(TopAppBar) ·
`src/design-system/components/ApplicationPrimitives.tsx:61` ·
`src/design-system/components/ModV1Primitives.tsx:80`·`:265`. 화면들도 **섹션** 제목에는 손으로
붙여 놨다 — `app/settings/index.tsx:312·331·372·416`은 심지어 주석에
*"`accessibilityRole="header"`다 — 스크린리더 헤더 내비게이션에서 이 화면만…"* 이라고 적어 뒀다.
**앱에서 가장 많이 쓰는 제목 한 벌만 그 역할이 없다.**

**누가 못 쓰는가.** TalkBack/VoiceOver의 **제목 단위 이동**(로터 "표제", 위/아래 스와이프
탐색 모드)을 쓰는 사람. 설정 화면에서는 섹션 제목 넷으로는 뛸 수 있는데 화면 제목으로는
못 뛴다 — 목록이 긴 화면에서 맨 위로 돌아가는 관례가 끊긴다.

**고치는 크기: S** — `src/ui.tsx` 한 줄(`accessibilityRole="header"` 추가). 24자리가 한 번에
따라온다. **픽셀락: 아니오**(role은 렌더 속성이 아니다 — `hitSlop`과 같은 부류).

---

## 발견 5 — 조회 실패의 낭독: 그 축을 여는 일의 크기

대장은 이 축을 일부러 열지 않았고 사유를 값으로 남겼다
(`src/a11y-contract.test.ts:3113` `LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON` —
*"가르는 것은 대장이 아니라 방아쇠다 … 자동 낭독이 쿼리 자리에도 실제로 필요한지는 실기기 확인
항목(A-20 #85)이고, 답이 '필요하다'면 다음 라운드가 같은 형식으로 그 모집단을 연다."*).
**그 모집단을 여기서 센다.**

### 모집단 (08:20 UTC 전수)

`useLoadErrorCopy(` 호출 자리 **20개 / 16화면**. 그중 **3자리는 이미 낭독된다** —
`app/settings/privacy.tsx:740·746·752`의 파기 미리보기 셋으로, 방아쇠가 `.mutate()`라
GAP-080이 이미 데려갔다(그 자리의 문장은 `:870·899·927`에서
`accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`를 이미 달고 있다).

**→ 남은 쿼리 방아쇠: 17자리 / 15화면.** 낭독은 0건이다
(`announceForA11y(...loadError...)` 전수 검색 결과가 privacy의 셋뿐).

### 그 17자리가 어떤 얼굴로 서 있는가 — 여는 일이 세 덩어리로 갈린다

| 얼굴 | 자리 | 여는 비용 |
|---|---|---|
| **`LoadErrorCard`**(`src/ui.tsx:1450`) | **4** — `app/settings/categories.tsx:383` · `app/settings/children.tsx:728` · `app/settings/privacy.tsx:780` · `app/settings/notifications.tsx:314` | **S — 컴포넌트 한 곳.** 이 프리미티브는 **호출부 4개가 전부 조회 실패**라 조건부 프롭 없이 무조건 라이브 리전을 달 수 있다 |
| **`EmptyStateCard`**(`src/ui.tsx:1430`) | **8** — `app/(tabs)/index.tsx` · `items.tsx` · `records.tsx` · `reports.tsx` · `app/budget.tsx` · `app/expenses/[expenseId].tsx` · `app/family/index.tsx` · `app/items/[itemTemplateId].tsx` | **M — 프롭이 필요하다.** 이 카드는 총 **34자리**에서 쓰이고 나머지 26은 "아직 기록이 없어요" 같은 **빈 상태**다. 무조건 달면 정상적인 빈 목록까지 경보로 읽힌다 → opt-in 프롭 + 8자리 배선 |
| **손으로 지은 Card+Text** | **5** — `app/(onboarding)/prepared-items.tsx` 1 · `app/family/accept/[token].tsx` 1 · `app/settings/index.tsx` 1 · `app/import/[importJobId].tsx` 2 | **M — 자리마다.** 이 다섯의 "왜 카드가 아닌가"는 이미 값으로 적혀 있다(`src/offline/offline-aware-screens.ts`의 `OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS` — 항목 8개). 그중 `app/settings/index.tsx`는 요약 카드의 **오른쪽 값 한 줄**이라 경보로 세울 자리 자체가 애매하다 |

두 프리미티브 모두 지금은 라이브 리전이 **한 글자도 없다**(`src/ui.tsx:1430`~`:1466` 전량
읽음). 저장소의 관례 한 벌은 이미 66자리(`accessibilityLiveRegion`)·64자리
(`accessibilityRole="alert"`)로 서 있으므로 **새 관례를 만들 필요는 없다**.

**전체 크기: M~L.** L 쪽으로 미는 것은 `EmptyStateCard`의 34자리 중 8자리만 골라야 한다는
점 하나다. **`LoadErrorCard` 4자리만 여는 것이 그 축의 값싼 첫 조각**(S)이고, 그 넷은
전부 설정 세계라 실기기 확인의 범위도 좁다. **픽셀락: 아니오**.

---

## 발견 6 — 고정 상자 + 배율되는 글리프 (Dynamic Type)

이 저장소는 fontScale을 **일부 자리에서만** 이미 방어한다:
`maxFontSizeMultiplier`가 `src/expenses/RecordsCalendar.tsx:195·199·205`(1.2배 상한) ·
`src/ui.tsx:1217` · `app/(tabs)/reports.tsx:346`, 그리고 그리드 열 수는
`compactGridColumnCount(width, fontScale)`가 잡는다(`app/expenses/new.tsx:446` ·
`src/preparation/PreparationListParity.tsx:374`). **막지 않은 것은 고정 정사각 안의 글리프다.**

| 파일:줄 | 상자 | 안의 글자 | 잘리기 시작하는 배율 |
|---|---|---|---|
| `app/expenses/[expenseId].tsx:1507` | `height: 22, width: 22` | `✓` `fontSize: 14`(lineHeight 없음 → 줄 상자 ≈17) | **≈1.3×** |
| `app/expenses/new.tsx:2520`(±) | `height: 22, width: 22` | 같은 `✓` 14px | **≈1.3×** |
| `app/(auth)/login.tsx:454` | `checkbox` `height: 26` | `checkmark` 16**/19**(`:462`) | **≈1.37×** |
| `app/(onboarding)/prepared-items.tsx:293` | `height: 26, width: 26` | `✓` 14px | ≈1.55× |
|  `src/notifications/NotificationBell.tsx:60` | 배지 `height: 17` | 카운트 10**/12**(`:71`·`:73`) | **≈1.42×** |
| `app/(tabs)/index.tsx:427` | `homeBudgetNudgeArrowStyle.button` `height: 34` | `›` 22**/24** | ≈1.42× |

**누가 못 쓰는가.** OS 글꼴을 키운 사람. Android의 접근성 글꼴 크기는 기본 UI에서
1.3배까지(디스플레이 크기까지 합치면 그 이상), iOS Dynamic Type의 접근성 단계는 훨씬 위다.
**체크 표시가 잘리는 것은 장식이 잘리는 것이 아니라 "체크됨"의 유일한 시각 신호가 잘리는 것**이다
(소리 쪽은 `accessibilityState={{ checked }}`가 이미 정확하다 — 발견 없음).
알림 배지는 미읽음 **개수**가 잘린다.

**고치는 크기: S** — 각 글리프 `<Text>`에 `allowFontScaling={false}`(장식 글리프)이거나
상자에 `minHeight`/`minWidth`. 저장소에 선례가 있다(`app/items/[itemTemplateId].tsx:1509`가
그 판단을 이미 주석으로 적어 뒀다).
⚠️ **픽셀락**: `app/expenses/new.tsx`의 선물 체크박스는 EXP-001 세션 밖이지만 같은 화면이라
확인 필요, 나머지는 캡처 밖. 기본 배율(1.0)에서 렌더가 불변인 고침(=`allowFontScaling` 또는
`minHeight`)을 고르면 **재캡처 없이** 간다.

**덤(막혀 있는 값 하나)**: `src/design-system/responsive.ts:18`의
`adaptiveTabBarHeight(baseHeight, fontScale)`는 → 발견 7.

---

## 발견 7 — `adaptiveTabBarHeight`는 테스트만 있고 호출부가 0

08:20 UTC 전수 검색 결과 이 함수의 참조는 **넷뿐**이고 전부 자기 자신·배럴·테스트다:

```
src/design-system/responsive.ts:18   (선언)
src/design-system/index.ts:22        (재수출)
src/design-system/responsive.test.ts:21~24  (adaptiveTabBarHeight(64,1)=64 · (64,1.5)=76 · (64,2)=88 · (64,3)=88)
```

정작 탭바(`app/(tabs)/_layout.tsx:69`)는 고정값을 쓴다:

```tsx
        tabBarLabelStyle: { fontSize: BottomTabPixelStyles.labelSize, fontWeight: "700" },
        tabBarStyle: {
          …
          height: BottomTabPixelStyles.height,       // 72
          paddingBottom: BottomTabPixelStyles.paddingBottom,  // 10
          paddingTop: BottomTabPixelStyles.paddingTop         // 8
        }
```

즉 **테스트는 초록인데 앱은 그 함수를 한 번도 부르지 않는다.** 남는 세로 공간은
72 − 8 − 10 = 54dp이고 그 안에 아이콘 19 + 라벨 10(`src/pixelLock/styles/BottomTabPixelStyles.ts:5·8·11·14·17`)이
들어간다. 배율 2.0에서 라벨이 20 → 39dp라 아직 들어가지만, 3.0(iOS 접근성 단계)에서는
49dp로 여백이 5dp만 남고 아이콘/라벨 간격이 사라진다.

**누가 못 쓰는가.** 글꼴을 크게 키운 사람 — 다섯 탭 라벨이 서로 붙거나 잘린다.
**고치는 크기: M** — `useWindowDimensions().fontScale`을 읽어 그 함수에 넘기는 한 줄.
⚠️ **픽셀락에 걸린다** — 탭바 높이는 TAB-001 캡처 값이고 탭바는 HOME-001·REP-001·ITEM-001의
**아래쪽 띠에도 들어간다**. 배율 1.0에서 값이 그대로(`adaptiveTabBarHeight(72,1) === 72`)라
캡처는 이론상 불변이지만, 그 불변을 **실기기로 확인**하지 않고는 넣을 수 없다 →
**지금 불가능**.

---

## 발견 8 — 탭 활성 라벨 색이 3.43:1

`app/(tabs)/_layout.tsx:63` (08:15 UTC):

```tsx
        tabBarActiveTintColor: theme.colors.coral[500],
```
라벨 크기는 `BottomTabPixelStyles.labelSize` = **10px**.

**실측 대비**(coral[500] `#E85F3B` on tabBar 배경 `theme.colors.white` `#FFFFFF`):
**3.43:1**. 10px는 "큰 글자"가 아니므로 필요한 값은 **4.5:1**이다.
비활성 라벨(`gray600` #5F5854 = 6.98:1)은 통과한다 — **선택된 탭만 읽기 어렵다.**

이 값은 저장소 스스로가 이미 여러 번 적어 둔 사실과 같다(`app/sync-status.tsx:264` 주석
*"coral[500]은 흰 카드 위 3.16:1(AA 미달)"* — 그쪽은 cream 배경 기준). 같은 파일
`app/(tabs)/index.tsx:528`도 *"흰 소형 텍스트 … coral[500] 위에서"* 를 이유로 mainCoral로
올린 기록이 있다.

**대장이 못 보는 이유(값).** `lowContrastCoralTextPattern`(`src/a11y-contract.test.ts:127`)은
`color:\s*theme\.colors\.(…)` 만 문다. `tabBarActiveTintColor:`는 `color:`로 끝나지 않고
(정규식의 `(?<![A-Za-z])color:` 앞자리 가드에 걸린다) 화면 파일도 아니라, 이 자리는
**규칙이 정한 대로 통과**한다.

**고치는 크기: S**(coral[500]→coral[600] 4.78:1 또는 coral[700] 6.45:1 한 글자).
⚠️ **픽셀락에 걸린다** — 활성 탭 색은 모든 탭 캡처에 보이는 픽셀이다 → **실기기 필요, 지금 불가능**.
`app/(tabs)/_layout.tsx:25`의 아이콘 tint는 같은 색이지만 **비텍스트 3:1** 기준을 통과한다
(3.43 ≥ 3) — 바꿔야 하는 것은 라벨 쪽이다.

---

## 이미 통과한 축 (값으로)

정찰의 절반은 "여기는 이미 됐다"를 값으로 남기는 것이다. 아래는 이번에 재어 보고 **미달을
찾지 못한** 축이다 — 다음 라운드가 같은 곳을 다시 세지 않도록.

1. **reduce motion — 완전하다.** `Animated.`를 쓰는 파일 **6개**
   (`app/(tabs)/index.tsx` · `app/launch-animation.tsx` · `src/ui.tsx` · `src/ui/Skeleton.tsx` ·
   `src/commerce/PurchaseFollowupPrompt.tsx` · `src/design-system/components/ModV1Primitives.tsx`)
   가 **전부** 설정을 읽고 즉시 정착 분기를 갖는다. `LayoutAnimation`을 쓰는 **2개**
   (`app/(tabs)/index.tsx:1601` · `app/expenses/new.tsx:986`)도 마찬가지. 스택 전환까지
   `app/_layout.tsx:171`·`:180`이 `animation: reduceMotionEnabled ? "none" : …`으로 잠근다.
   공용 훅 `src/ui/useReducedMotion.ts`는 `reduceMotionChanged` 구독까지 한다.
   **남은 자리는 하나**: `src/design-system/components/ModV1Primitives.tsx:252`의
   `<Modal animationType="slide">`이 무방비인데, 그 `BottomSheet`는 `app/**`에서 **호출부가
   0개**다(08:21 UTC 전수) — 실사용자에게 도달하지 않는다.
2. **아이콘 버튼 라벨 — 미달 0건.** `<Pressable>` 158자리 전수에서
   `accessibilityLabel`도 자식 `<Text>`도 없는 자리는 **0개**다(`app/(tabs)/records.tsx:428`
   하나가 스캐너에 걸렸으나 자식 `RecordsFlatRow`가 글자를 그린다).
3. **아이콘이 초점을 먹지 않는다 — 구조로 보장.** `AppIcon`
   (`src/design-system/components/ApplicationPrimitives.tsx:20`)은 선언 자체가
   `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`다.
   36자리 전부 이 한 벌을 지난다.
4. **선택/체크 상태 — 라벨에 이어 붙인 자리 0건.** 확인한 자리 전부가
   `accessibilityState`를 쓴다: `app/(auth)/login.tsx:81`(role=checkbox+checked) ·
   `app/(onboarding)/prepared-items.tsx:274` · `app/import/[importJobId].tsx:340` ·
   `app/expenses/new.tsx:2500` · `app/family/invite.tsx:263`(selected) ·
   `app/sync-status.tsx:182·206`(selected) · `app/settings/children.tsx` 아이 전환.
5. **준비 카드 잉크/틴트 10쌍 — 전부 통과.** 실측 최저는
   `prepInkCoral #C54A2C` on `prepTintCoral #FFF0EC` = **4.31:1**, 최고는
   `prepInkViolet` 5.51:1. 이 10쌍은 **아이콘에만** 쓰인다
   (`src/preparation/PreparationListParity.tsx:679·728`의 `<AppIcon color={group.color}>`) →
   비텍스트 기준 3:1을 넉넉히 넘는다. 분류 아이콘 잉크
   (`categoryIconInk #443F3C` on 10색 팔레트)도 최저 **4.42:1**로 통과.
6. **의미색 표면 쌍 — 전부 통과.** `success/successSurface` 4.98 · `warning/warningSurface`
   4.72 · `danger/dangerSurface` 5.93 · `info/infoSurface` 6.12 · `review/reviewSurface` 5.10 ·
   `focus` on white 4.55 · `chartColors` 6종 전부 4.55~5.70. `coral[700]`은 어느 크림/코랄
   배경에서도 5.33~6.45로 통과 — A11Y-117이 고른 토큰이 실제로 옳다.
7. **터치 타깃의 "가로가 막히면 세로로 갚는다" 관례가 문서화돼 있다** —
   `src/expenses/RecordsCalendar.tsx:66~82`가 40.3dp 실측과 48dp 세로 보상,
   그리고 **면적 논증**(40.3×48 ≈ 1,934dp² ≈ 44×44)까지 값으로 적어 뒀다.
   발견 1·2의 고침은 이 관례를 그대로 쓰면 된다.

---

## 권고 (4개)

1. **[먼저] 발견 3 — placeholder 색 7자리.** 크기 S, 픽셀락 0, 계산이 이미 끝났고
   저장소 안에 정답 관례(`gray600`)가 있다. 값 대조 테스트는
   `색 리터럴/토큰` 계약(`src/color-literal-tokenization.test.ts`)과 같은 형식으로
   "placeholder에 쓸 수 있는 토큰 집합"을 값으로 못박으면 재발이 막힌다.
2. **[다음] 발견 4 — `src/ui.tsx:199` ScreenHeader에 header role 한 줄.** 크기 S,
   픽셀락 0, **24자리가 한 번에** 따라온다. 계약은 `screen-header-back.test.ts`가 이미
   `ScreenHeader`의 모집단을 **전수 파생**으로 세고 있으므로 그 파생을 그대로 재사용하면
   손 목록이 생기지 않는다.
3. **[대장 확장] 발견 1·2 — 터치 타깃 스윕을 열거에서 파생으로.** 지금 대장이 세는 11자리는
   **손으로 적은 경로**다. `GAP-065 #7`의 `categoryChipRowGaps()`가 이미 보여준 그 형식
   (전량 스캔 → 새 줄이 태어나면 자동으로 판정에 들어옴)을 터치 타깃 전체로 올리면
   18자리가 한 번에 모집단이 되고, "다음 라운드가 같은 스윕을 산문으로 다시 센다"가 끝난다.
   착수 순서는 **픽셀락 밖(family 6 · sync-status 2 · import 1 · recurring 1 · children 1 ·
   notifications 1 = 12자리)** 먼저, 홈 3자리와 `new.tsx` 요약바는 캡처 대조 뒤.
4. **[축 열기] 발견 5 — `LoadErrorCard` 4자리만 먼저.** 대장이 남긴 사유는 "쿼리 자리에도
   자동 낭독이 필요한가"를 실기기 항목(A-20 #85)으로 미뤄 뒀다. 그 답을 기다리는 동안에도
   `src/ui.tsx:1450` 한 곳은 **호출부 4개가 전부 조회 실패**라 조건 분기 없이 열 수 있다 —
   그 넷의 실기기 관찰이 곧 A-20 #85의 답이 되고, 답이 "필요하다"면 남은 13자리(EmptyStateCard
   opt-in 8 + 손 카드 5)를 같은 형식으로 연다.

---

## 교집합 없는 소유 파일 목록

권고를 그대로 집행할 때 이 정찰이 **단독으로 만지게 되는** 파일. 다른 라운드/트랙의 소유와
겹치지 않도록 권고별로 갈라 둔다.

**권고 1(placeholder 색) — 6파일**
```
apps/mobile/app/settings/categories.tsx        (:306, :446)
apps/mobile/app/settings/amount-presets.tsx    (:108)
apps/mobile/app/settings/app-lock.tsx          (:242)
apps/mobile/src/security/AppLockOverlay.tsx    (:294)
apps/mobile/src/preparation/PreparationListParity.tsx  (:613)
apps/mobile/src/design-system/components/ModV1Primitives.tsx  (:113)
```

**권고 2(header role) — 1파일**
```
apps/mobile/src/ui.tsx   (:199 ScreenHeader 제목 Text 한 줄)
```

**권고 3(터치 타깃, 픽셀락 밖 12자리) — 6파일**
```
apps/mobile/app/family/index.tsx               (:537 :564 :586 :671 :701 :725)
apps/mobile/app/sync-status.tsx                (:180 :204)
apps/mobile/app/import/[importJobId].tsx       (:211)
apps/mobile/app/expenses/recurring.tsx         (:568)
apps/mobile/app/settings/children.tsx          (:769)
apps/mobile/app/notifications.tsx              (:309)
```

**권고 4(조회 실패 낭독, 첫 조각) — 1파일**
```
apps/mobile/src/ui.tsx   (:1450 LoadErrorCard — 권고 2와 같은 파일이므로 한 트랙으로 묶는다)
```

**계약 파일(권고 3이 대장을 확장할 때) — 1파일**
```
apps/mobile/src/a11y-contract.test.ts   (GAP-064 #6 / GAP-065 #7 블록)
```

⚠️ **실기기가 필요해 지금 불가능**(픽셀락 재캡처 동반): 발견 2ⓑ(`app/expenses/new.tsx:2634`
— EXP-001) · 발견 7(`app/(tabs)/_layout.tsx` 탭바 높이 — TAB-001) ·
발견 8(`app/(tabs)/_layout.tsx:63` 활성 탭 색 — 탭바가 보이는 전 캡처) ·
발견 1의 홈 3자리(`app/(tabs)/index.tsx:2515·2726·2974` — 42/39→48은 세션 렌더가 6dp 자란다).
