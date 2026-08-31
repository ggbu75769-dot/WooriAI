import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 92 트랙 A — **키보드가 떠 있어도 칩은 한 번에 눌린다.**
 *
 * 핵심 루프 1단계(지출 기록)에서 **금액이나 품목을 치다가 칩을 누르면 첫 탭이 통째로 먹혔다.**
 * RN `ScrollView`의 `keyboardShouldPersistTaps` 기본값은 `"never"`이고, 그 뜻은 *키보드가 떠
 * 있는 동안의 첫 탭은 자식에게 가지 않고 키보드만 내린다*는 것이다. 사용자에게는 **"눌렀는데
 * 반응이 없다"** 로 보인다.
 *
 * ⚠️⚠️ **해악의 이름도, 옳은 답도, 그 답을 고르지 않은 자리도 전부 이 저장소가 이미 적어
 * 두었다.** `src/ui.tsx:86-96`(라운드 65 · GAP-065 #6)이 그 문장을 그대로 쓰고,
 * `"always"`가 아니라 `"handled"`인 이유까지 적는다.
 *
 * ## ⚠️⚠️ 왜 바깥의 셋이 안쪽의 여덟을 덮지 못했는가 — 이 계약의 값 절반이다
 *
 * RN의 판단은 `onStartShouldSetResponderCapture`(**capture 단계** — 바깥에서 안으로)에서 나온다
 * (`node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js:1505-1535` · 그 소스의
 * 주석이 *"첫 탭은 키보드를 내리고 **두 번째 탭이** 실제 자식에게 간다"* 라고 적는다).
 * 그래서 바깥 스크롤러(`src/ui.tsx`의 `AppScreen` · `src/design-system/components/ScreenScaffold.tsx`)가
 * `"handled"`로 통과시켜도 **가장 안쪽 스크롤러가 기본값이면 그 자리가 첫 탭을 가로챈다.**
 * 지출 입력·지출 수정·기록 탭의 **중첩 가로 칩 줄 여덟**이 정확히 그 안쪽이었다.
 *
 * ## ⚠️⚠️ 고치려던 병은 *속성 하나*가 아니라 *손 목록*이다
 *
 * GAP-065 #6이 무는 스캐폴드는 **손으로 적은 셋**이라, 나머지 열넷은 그 계약의 모집단에
 * 들어온 적이 없다. 그리고 **그 계약이 자기 근거로 인용한 주석의 자리
 * (`app/expenses/new.tsx`의 `merchantFocused`)가 빠진 여덟 중 하나였다** — 인용한 손이
 * 인용당한 자리를 고치지 않았고, 그 낡음이 이 자리를 *이미 해결된 것*으로 읽히게 했다.
 * 그래서 이 파일은 **손 목록을 쓰지 않는다** — 모집단을 전수에서 파생한다(ⓐ).
 * (⚠️ GAP-065 #6의 손 목록 셋을 전수로 바꾸는 일 자체는 **이 트랙의 축이 아니다** — 아래
 * ⓕ의 `gap-065-6-scaffold-list-is-not-this-axis`가 그 사실을 재개 조건과 함께 진다.)
 *
 * ## ⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 저장소에는 앱 경계를 넘어 도는 그물 **열다섯**이 있다. **이 파일은 그 하나가 아니다.**
 * 이 스윕이 걷는 것은 `SWEEP_SCOPE_LABEL` 하나 — `apps/mobile/{app,src}/**` 뿐이고,
 * 어드민·api·`packages/**`로는 한 걸음도 나가지 않는다. 그 사실을 주석이 아니라 **값**으로
 * 두는 이유는, 다음 라운드에 누군가 이 파일을 "저장소 키보드 그물"로 넓히려 할 때 넓히는 손이
 * `SWEEP_ROOTS`를 고치며 지나가게 하기 위해서다 — 주석은 조용히 거짓이 되지만 값은 빨개진다.
 * (라운드 89 B의 `admin-table-name.test.ts` · 라운드 90 B의 `admin-status-announce.test.ts` ·
 * 라운드 91 A의 `src/mutation-press-guard.test.ts` · 라운드 91 B의
 * `admin-landmark-current.test.ts`와 같은 계열이다.)
 *
 * ## 판정 셋 — 손으로 적지 않고 소스에서 파생한다(ⓑ)
 *
 * 모집단은 `apps/mobile/{app,src}/**`의 비테스트 `.tsx` 전수에서 나온
 * `<ScrollView`·`<FlatList`·`<SectionList` **여는 태그**이고, 자리마다 셋 중 하나가 **소스에서** 나온다.
 *
 *  · `declares-handled` — 그 여는 태그가 `keyboardShouldPersistTaps="handled"`를 **명시한다.**
 *  · `no-keyboard-in-file` — 명시하지 않았지만 **그 파일에 `<TextInput` 여는 태그가 0건**이라
 *    키보드가 뜰 수 없다. 묻지 않는다(오늘 **여섯**).
 *  · `unguarded-with-keyboard` — 명시하지 않았는데 같은 파일에 입력칸이 있다.
 *    ⚠️⚠️ **트랙 뒤 0건이어야 한다.** 이 판정이 하나라도 서면 계약이 빨개진다.
 *
 * ## ⚠️ 타입 인자를 여는 태그로 세지 않는 규칙 — **발명이 아니라 인용이다**
 *
 * `Ref<ScrollView>` · `SectionList<RecordsListItem, RecordsSection>` 같은 자리는 여는 태그가
 * 아니다. 이 사각을 닫는 규칙은 이 파일이 지은 것이 아니라 `src/a11y-contract.test.ts:1289-1294`가
 * 이미 고른 답을 그대로 가져온 것이다 — *"태그 이름 뒤에 **공백이 오는 자리만** 센다."*
 * 그 인용을 주석이 아니라 값으로 둔다(`TYPE_ARG_RULE_CITATION` · ⓐ가 문다).
 * ⚠️ 오늘 그 규칙이 걸러 내는 자리는 **셋**이고, 아래 `it`이 그 셋을 이름으로 보인다.
 *
 * ## ⚠️⚠️ 전제 재실측 — 정찰의 17·여덟·여섯은 하한이었고, 바늘 하나가 실제로 갈렸다
 *
 * 정찰(2026-08-31)이 낸 수는 **비테스트 `.tsx` 58 · 여는 태그 17 · 명시 셋 · 명시 안 함 열넷 ·
 * 그중 키보드가 뜰 수 있는 중첩 칩 줄 여덟 · 키보드가 뜰 수 없는 자리 여섯**이었다.
 * 오늘 워킹트리에서 다시 재니 **58·17·셋·열넷·여덟·여섯이 전부 같다**(트랙 전 기준).
 *
 * ⚠️⚠️ **다만 정찰이 쓴 `<TextInput ` 바늘은 오늘 재어 보니 좁았다.** 그 낱말(**뒤에 공백 하나**)로
 * 세면 이 모집단에 `<TextInput ` 은 **파일 둘 · 자리 셋**뿐이다 — 이 저장소의 입력칸은 거의 전부
 * `<TextInput` **줄바꿈** 뒤에 속성이 오는 여러 줄 형식이기 때문이다. 같은 바늘을 여는 태그 규칙
 * (**뒤에 공백류가 오는 자리**)으로 넓혀 세면 **파일 열둘 · 자리 27**이다.
 * ⚠️ **이 계약은 넓은 쪽을 쓴다** — 좁은 바늘을 쓰면 `app/(tabs)/records.tsx`와
 * `app/expenses/[expenseId].tsx`가 *"키보드가 뜰 수 없는 화면"* 으로 잘못 갈려, 속성을 벗겨도
 * ⓑ가 조용히 초록이 된다(= 교란이 안 먹는 계약이 된다). **그리고 넓은 바늘로 세도
 * `no-keyboard-in-file`은 오늘 여섯 그대로다** — 정찰의 여섯은 값으로 살아남았고 하한으로 남는다.
 *
 * ## ⚠️ 이 스윕은 마스킹한 소스만 문다 — 그리고 뷰가 둘이다(라운드 91 리뷰 L-3의 규율)
 *
 *  · **기본 뷰**(`maskComments(raw)`) — 주석만 걷고 문자열 **내용은 남긴다.** 여는 태그의 속성
 *    읽기·`"always"` 부정 단언·ⓔ의 바이트 해시가 이 뷰를 본다.
 *  · **문자열까지 걷는 뷰**(`maskComments(raw, { strings: true })`) — **모집단 계수에만** 쓴다.
 *    소스를 인용해 둔 문자열이 스크롤러 자리를 만들지 않게 하려는 것이다.
 *
 * ⚠️ **오늘 두 뷰의 갈림은 0이다**(`MASKING_DELTA_TODAY`). **0인 것은 오늘의 값이지 규율이 아니다.**
 *
 * ## 이 트랙이 화면에서 바꾼 것
 *
 * 여는 태그 **여덟**에 `keyboardShouldPersistTaps="handled"` **한 속성씩**, 그리고
 * `app/expenses/new.tsx`의 `merchantFocused` 주석 한 문단의 **두 시점 정정**뿐이다.
 * **화면 문구 0글자 · 픽셀 0 · 서버 0건 · 새 요청 0건.** ⓔ가 그 사실을 **부정 단언**으로 문다 —
 * 여덟 여는 태그에서 그 속성 하나를 벗기면 **종전 바이트와 정확히 같아야 한다**
 * (라운드 91 A의 ⓓ 형식 · sha256 인용).
 */

/** 이 스윕이 걷는 앱 경계. `apps/mobile/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_SCOPE_LABEL = "apps/mobile/{app,src}/**" as const;

/** 뿌리 둘 — 화면(`app`)과 그 화면이 쓰는 모듈·UI(`src`). */
const SWEEP_ROOTS = ["app", "src"] as const;

const mobileRoot = process.cwd();

/** 스크롤 컨테이너를 여는 태그 이름 셋. */
const SCROLLER_TAGS = ["ScrollView", "FlatList", "SectionList"] as const;

/**
 * ⚠️ **타입 인자를 여는 태그로 세지 않는 규칙의 출처** — 이 파일이 발명한 것이 아니다.
 * 값으로 적어 두는 이유는, 그 규칙을 무르는 손이 이 인용을 지나가게 하기 위해서다.
 */
const TYPE_ARG_RULE_CITATION =
  "src/a11y-contract.test.ts:1289-1294 — 태그 이름 뒤에 공백이 오는 자리만 센다(타입 인자 배제)";

/** 정찰(2026-08-31)이 낸 하한. ⚠️ 값은 갱신하되 이 하한은 내리지 않는다. */
const SCOUT_LOWER_BOUNDS = {
  /** 비테스트 `.tsx` 전수. */
  sweptFiles: 58,
  /** 스크롤 컨테이너 여는 태그 전수. */
  scrollerSites: 17,
  /** 트랙이 고치는 중첩 가로 칩 줄. */
  coreLoopSites: 8,
  /** 키보드가 뜰 수 없어 묻지 않는 자리. */
  noKeyboardSites: 6,
  /** 오늘 타입 인자로 걸러 낸 자리. */
  excludedTypeArgs: 3
} as const;

/** 트랙 전에 `"handled"`를 명시하고 있던 스캐폴드 셋 — 이 트랙은 그 셋을 **건드리지 않는다.** */
const PRE_EXISTING_HANDLED_FILES = [
  "app/(tabs)/records.tsx",
  "src/design-system/components/ScreenScaffold.tsx",
  "src/ui.tsx"
] as const;

/**
 * ⓒ **핵심 루프 1단계의 그 여덟 — 파일과 자리 이름으로 못 박는다.**
 *
 * `anchor`는 손으로 지은 이름이 아니라 **그 여는 태그 바로 안쪽의 첫 `X.map(`** 이다(소스에서
 * 파생한다). 판정이 다시 `unguarded-with-keyboard`로 떨어지거나 자리 하나가 사라지는 날 빨개진다.
 */
const CORE_LOOP_SITES: readonly { readonly file: string; readonly anchor: string; readonly label: string }[] = [
  { file: "app/expenses/new.tsx", anchor: "recentItemChips", label: "지출 기록 · 최근 품목 칩 줄" },
  { file: "app/expenses/new.tsx", anchor: "recentDateChips", label: "지출 기록 · 최근 날짜 칩 줄" },
  { file: "app/expenses/new.tsx", anchor: "merchantSuggestions", label: "지출 기록 · 판매처 자동완성 칩 줄" },
  { file: "app/expenses/new.tsx", anchor: "itemAutocompleteChips", label: "지출 기록 · 품목 자동완성 칩 줄" },
  { file: "app/expenses/[expenseId].tsx", anchor: "merchantSuggestions", label: "지출 수정 · 판매처 자동완성 칩 줄" },
  { file: "app/expenses/[expenseId].tsx", anchor: "recentDateChips", label: "지출 수정 · 최근 날짜 칩 줄" },
  { file: "app/expenses/[expenseId].tsx", anchor: "categoryChips", label: "지출 수정 · 분류 칩 줄" },
  { file: "app/(tabs)/records.tsx", anchor: "categoryChips", label: "기록 탭 · 분류 칩 줄" }
];

/** 이 트랙이 붙인 속성 — 여덟 자리에 **한 글자도 다르지 않게** 같은 바이트로 붙었다. */
const ADDED_ATTRIBUTE = ' keyboardShouldPersistTaps="handled"' as const;

/**
 * ⓔ의 대장 — ⚠️⚠️ **라운드 91 A의 ⓓ 형식(sha256 부정 단언)을 그대로 인용한다**
 * (`src/mutation-press-guard.test.ts`의 `PRESS_SITE_LEDGER` · 그 파일 `:745-748`).
 *
 * 여덟 여는 태그에서 `ADDED_ATTRIBUTE` **하나만** 벗기면 종전 바이트와 정확히 같아야 한다.
 * ⚠️ 값은 손으로 지은 것이 아니라 **트랙 전 워킹트리의 바이트에서 떴고**, 여덟이 전부 같은
 * 한 줄이었다(그래서 대장이 한 줄이다 — 그 사실 자체가 값이라 아래 `it`이 여덟 모두를 견준다).
 */
const STRIPPED_OPENING_TAG =
  "<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>" as const;

/** 위 한 줄의 sha256 앞 12. ⚠️ 미리보기가 아니라 **해시**가 바이트를 문다. */
const STRIPPED_OPENING_TAG_SHA12 = "23a4d047f3cd" as const;

/**
 * ⓔ — 세 화면의 한국어 리터럴 수(마스킹된 소스의 문자열 리터럴 가운데 한글을 담은 것).
 *
 * ⚠️ 이 트랙은 문구를 **한 글자도** 더하지 않았다. 이 수가 움직였다면 ⓐ 이 트랙이 문구를
 * 더했거나 ⓑ 다른 라운드가 이 화면의 문구를 정당하게 고친 것이고, ⓑ라면 **그 라운드가 이
 * 대장을 함께 갱신해야 한다.**
 */
const KOREAN_LITERAL_LEDGER: readonly { readonly file: string; readonly count: number }[] = [
  { file: "app/expenses/new.tsx", count: 54 },
  { file: "app/expenses/[expenseId].tsx", count: 42 },
  { file: "app/(tabs)/records.tsx", count: 14 }
];

/**
 * ⓕ 사각 — ⚠️ **이 스윕이 못 보는 것을 값과 하한으로 적는다.**
 *
 * 이 계약이 세는 수는 *"저장소의 첫 탭이 이만큼 산다"* 가 아니라 *"이 모집단 안에서 이만큼이
 * 풀렸다"* 는 뜻이다(AB-5의 규율).
 */
const BLIND_SPOTS: readonly {
  readonly id: string;
  readonly measure: number;
  readonly floor: number;
  readonly reason: string;
  readonly resumeCondition: string;
}[] = [
  {
    id: "no-textinput-screens-are-unjudged",
    // 파생값(아래 계약이 다시 센다): `no-keyboard-in-file` 판정의 자리 수.
    measure: 6,
    floor: 1,
    reason:
      "그 파일에 `<TextInput` 여는 태그가 0건이면 이 자는 **묻지 않는다** — 오늘 여섯 자리가 그렇다 " +
      "(`app/import/[importJobId].tsx` 셋 · `app/sync-status.tsx` 하나 · " +
      "`src/design-system/components/ApplicationPrimitives.tsx` 하나 · `src/errors/ErrorBoundary.tsx` 하나). " +
      "그 여섯의 중첩 스크롤러는 판정 밖이고, 이 계약이 초록이라는 사실은 그 자리들이 옳다는 뜻이 아니다.",
    resumeCondition:
      "재개 조건(사건형): 그 여섯 화면 가운데 하나에 입력칸이 처음 서는 날 — 그날 그 자리는 " +
      "`no-keyboard-in-file`에서 `unguarded-with-keyboard`로 떨어지고 이 계약이 **먼저** 빨개진다."
  },
  {
    id: "keyboard-is-not-only-textinput",
    // 이 바늘이 실제로 보는 전부 — 마스킹된 모집단의 `<TextInput` 여는 태그 수.
    measure: 27,
    floor: 1,
    reason:
      "**키보드를 띄우는 것이 `TextInput`만은 아니다.** 네이티브 시트·검색 바·서드파티 입력 화면처럼 " +
      "그 파일에 `<TextInput` 여는 태그가 없는 경로로도 키보드는 뜬다. 이 바늘이 보는 것은 오늘 27자리뿐이고, " +
      "그 밖의 경로는 이 자의 시야 밖이다.",
    resumeCondition:
      "재개 조건(사건형): `TextInput` 아닌 경로로 키보드를 띄우는 화면이 이 모집단에 처음 서는 날 — " +
      "그날 이 바늘은 `<TextInput` 말고도 그 경로를 함께 세어야 하고, 첫 모집단은 오늘의 27이다."
  },
  {
    id: "keyboard-verdict-is-file-scoped",
    // 파일 단위 판정에 기대는 자리 수 — 명시하지 않은 전부.
    measure: 6,
    floor: 0,
    reason:
      "**판정이 파일 단위다** — 그 스크롤러가 실제로 그 입력칸과 **같은 화면에 동시에 서는가**는 묻지 않는다. " +
      "한 파일 안에 조건부로만 렌더되는 스크롤러와 입력칸이 서로 다른 분기에 있어도 이 자는 같은 파일로 본다. " +
      "⚠️ 라운드 91 리뷰 M-2가 연타 스윕(`src/mutation-press-guard.test.ts`의 " +
      "`control-verdict-is-file-scoped`)에서 이름 붙인 그 사각의 **같은 얼굴**이고, 그 사실을 값으로 적는다. " +
      "좁히려면 JSX 트리를 걸어야 하고, 그것은 이 스윕의 자가 아니다. " +
      "⚠️ **그때 조용해지지는 않는다: 파일 단위는 늘 넓은 쪽(= 더 자주 빨개지는 쪽)으로 튄다** — " +
      "같은 파일에 입력칸이 있으면 그 파일의 모든 스크롤러가 `unguarded-with-keyboard` 후보가 된다.",
    resumeCondition:
      "재개 조건(사건형): 한 파일 안에서 스크롤러와 입력칸이 **결코 같이 서지 않는** 자리가 " +
      "처음 발견되어 이 계약이 거짓 빨강을 내는 날 — 그날 이 자는 판정을 파일 단위에서 **트리 단위**로 " +
      "좁혀야 하고, 그 첫 모집단은 오늘의 17이다."
  },
  {
    id: "source-not-runtime",
    measure: 0,
    floor: 0,
    reason:
      "이 계약은 **소스 대조**다 — 키보드가 떠 있는 채로 칩이 실제로 한 번에 눌리는지는 이 자가 묻지 않는다" +
      "(런타임 확인 0건). 그 확인은 **실기기 항목**의 몫이고, 이 계약이 초록이라는 사실은 그 항목을 대신하지 않는다.",
    resumeCondition:
      "재개 조건(사건형): 실기기 확인이 이 자리를 항목으로 받는 날 — 그날 이 사각은 그 항목 번호를 함께 든다."
  },
  {
    // ⚠️⚠️ 이 트랙의 축이 **아닌** 것을 축과 함께 적는다(AD-5의 처방).
    id: "gap-065-6-scaffold-list-is-not-this-axis",
    // 트랙 전에 이미 `"handled"`를 명시하고 있던 스캐폴드 — GAP-065 #6이 손으로 적은 그 셋이다.
    measure: 3,
    floor: 3,
    reason:
      "**GAP-065 #6의 `scaffolds` 손 목록 셋을 전수로 바꾸는 일은 이 트랙의 축이 아니다.** " +
      "그 셋(`src/ui.tsx`의 `AppScreen` · `src/design-system/components/ScreenScaffold.tsx` · " +
      "기록 탭 `SectionList`)은 오늘도 옳고 이 트랙은 그 바이트를 건드리지 않았다. " +
      "이 파일은 **자기 모집단만** 전수로 파생하고, 그 계약의 모집단에는 한 걸음도 들어가지 않는다 " +
      "(그 파일을 읽지도 쓰지도 않았다 — 위 `TYPE_ARG_RULE_CITATION`은 좌표와 규칙의 인용이지 그 계약의 값이 아니다).",
    resumeCondition:
      "재개 조건(사건형): GAP-065 #6의 그 손 목록이 한 트랙의 축이 되는 라운드가 서는 날 — " +
      "**그날의 첫 모집단은 오늘의 열일곱이다.**"
  }
];

// ───────────────────────────────────────────────────────────────────────────────
// 자 — 주석과 문자열을 걷는다(라운드 91 A의 `maskComments`를 같은 규율로 쓴다).
// ───────────────────────────────────────────────────────────────────────────────

type MaskOptions = { readonly strings: boolean };

/**
 * 주석을(그리고 `strings`면 문자열 **내용**까지) 같은 길이의 공백으로 바꾼다.
 *
 * ⚠️ **길이를 보존한다** — 자리 계산이 원본과 어긋나지 않게 하려는 것이고, 계약이 그 사실을
 * 픽스처로 확인한다.
 */
function maskComments(source: string, options: MaskOptions = { strings: false }): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | '"' | "'" | "`" = "code";
  while (index < source.length) {
    const char = source[index];
    const pair = source.slice(index, index + 2);
    if (state === "code") {
      if (pair === "//") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      if (pair === "/*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        state = char;
        out += char;
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      } else {
        out += " ";
      }
      index += 1;
      continue;
    }
    if (state === "block") {
      if (pair === "*/") {
        state = "code";
        out += "  ";
        index += 2;
      } else {
        out += char === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    // 문자열 안.
    if (char === "\\") {
      out += options.strings ? "  " : source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === state) {
      state = "code";
      out += char;
      index += 1;
      continue;
    }
    out += options.strings ? (char === "\n" ? "\n" : " ") : char;
    index += 1;
  }
  return out;
}

function listSweptFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      if (entry.name.includes(".test.")) continue;
      found.push(relative(mobileRoot, path).split(sep).join("/"));
    }
  };
  for (const root of SWEEP_ROOTS) walk(join(mobileRoot, root));
  return found.sort();
}

function readSweptSource(relativePath: string): string {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

function sha12(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").substring(0, 12);
}

function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (code[i] === "\n") line += 1;
  return line;
}

type OpeningTag = {
  readonly tag: string;
  /** `<태그이름` 뒤부터 짝이 맞는 `>` 직전까지 — 속성 전부. */
  readonly body: string;
  /** `<태그이름` + 속성 + `>` 의 **전체 바이트**. */
  readonly full: string;
  readonly line: number;
  /** 여는 태그 바로 안쪽에서 처음 나오는 `{X.map(` 의 `X` — ⓒ가 자리 이름으로 쓴다. */
  readonly anchor: string | null;
};

/**
 * ⚠️ **여는 태그만 센다** — 태그 이름 **뒤에 공백류가 오는 자리**뿐이다.
 * 이 규칙은 발명이 아니라 인용이다(`TYPE_ARG_RULE_CITATION`).
 * 그래서 `Ref<ScrollView>` · `SectionList<RecordsListItem, …>` 같은 타입 인자는 세지 않는다.
 */
function openingTagsOf(code: string, tagName: string): OpeningTag[] {
  const out: OpeningTag[] = [];
  const needle = `<${tagName}`;
  let from = 0;
  for (;;) {
    const at = code.indexOf(needle, from);
    if (at === -1) break;
    from = at + needle.length;
    const next = code[at + needle.length];
    // 타입 인자 배제 — 공백류가 아니면 여는 태그가 아니다.
    if (next === undefined || !/\s/.test(next)) continue;
    let depth = 0;
    let quote: string | null = null;
    let i = at + needle.length;
    for (; i < code.length; i += 1) {
      const char = code[i];
      if (quote !== null) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    const body = code.slice(at + needle.length, i);
    const inner = code.slice(i, i + 400);
    const mapped = /\{\s*([A-Za-z0-9_$.]+)\.map\(/.exec(inner);
    out.push({
      tag: tagName,
      body,
      full: `${needle}${body}>`,
      line: lineOf(code, at),
      anchor: mapped === null ? null : mapped[1]
    });
  }
  return out;
}

/** 여는 태그의 `keyboardShouldPersistTaps` 값(`"handled"` · `{"handled"}` 둘 다 읽는다). */
function persistTapsValue(body: string): string | null {
  const matched = /keyboardShouldPersistTaps\s*=\s*\{?\s*["']([a-zA-Z-]+)["']/.exec(body);
  if (matched !== null) return matched[1];
  return /keyboardShouldPersistTaps/.test(body) ? "<non-literal>" : null;
}

/** ⚠️ 입력칸 세기도 **같은 여는 태그 규칙**을 쓴다 — 정찰의 `<TextInput ` 은 더 좁은 바늘이다. */
function textInputOpeningTagCount(code: string): number {
  return openingTagsOf(code, "TextInput").length;
}

type KeyboardVerdict = "declares-handled" | "no-keyboard-in-file" | "unguarded-with-keyboard";

type ScrollerSite = OpeningTag & {
  readonly file: string;
  readonly persistTaps: string | null;
  readonly textInputsInFile: number;
  readonly verdict: KeyboardVerdict;
};

/** ⓐ 모집단 — 손 목록이 아니라 전수에서 파생한다. */
function collectScrollerSites(): ScrollerSite[] {
  const sites: ScrollerSite[] = [];
  for (const file of sweptFiles) {
    const raw = readSweptSource(file);
    const code = maskComments(raw);
    const textInputsInFile = textInputOpeningTagCount(code);
    for (const tagName of SCROLLER_TAGS) {
      for (const tag of openingTagsOf(code, tagName)) {
        const persistTaps = persistTapsValue(tag.body);
        const verdict: KeyboardVerdict =
          persistTaps === "handled"
            ? "declares-handled"
            : textInputsInFile === 0
              ? "no-keyboard-in-file"
              : "unguarded-with-keyboard";
        sites.push({ ...tag, file, persistTaps, textInputsInFile, verdict });
      }
    }
  }
  return sites;
}

/** 문자열까지 걷는 뷰로 센 모집단 크기 — 계수에만 쓴다(L-3의 규율). */
function scrollerSiteCountStringsMasked(): number {
  let count = 0;
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file), { strings: true });
    for (const tagName of SCROLLER_TAGS) count += openingTagsOf(code, tagName).length;
  }
  return count;
}

/** 타입 인자라 걸러 낸 자리 — 여는 태그 규칙이 실제로 무엇을 버리는지 보이는 자리. */
function excludedTypeArgumentSites(): string[] {
  const out: string[] = [];
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file), { strings: true });
    for (const tagName of SCROLLER_TAGS) {
      const needle = `<${tagName}`;
      let from = 0;
      for (;;) {
        const at = code.indexOf(needle, from);
        if (at === -1) break;
        from = at + needle.length;
        const next = code[at + needle.length];
        if (next !== undefined && /\s/.test(next)) continue;
        out.push(`${file}:${lineOf(code, at)} <${tagName}${next ?? ""}`);
      }
    }
  }
  return out.sort();
}

function koreanLiteralCount(code: string): number {
  return (code.match(/["'`][^"'`]*[가-힣][^"'`]*["'`]/g) ?? []).length;
}

const sweptFiles = listSweptFiles();
const scrollerSites = collectScrollerSites();
const byVerdict = (verdict: KeyboardVerdict): ScrollerSite[] => scrollerSites.filter((site) => site.verdict === verdict);
const siteKey = (site: { readonly file: string; readonly anchor: string | null }): string =>
  `${site.file}::${site.anchor ?? "-"}`;

/** ⚠️ 오늘 두 마스킹 뷰의 갈림. **0인 것은 오늘의 값이지 규율이 아니다.** */
const MASKING_DELTA_TODAY = 0;

describe("마스킹 — 이 자가 무엇을 걷는지 픽스처가 보여 준다", () => {
  const fixture = [
    '// <ScrollView horizontal>',
    'const quoted = "<ScrollView horizontal>";',
    "/* <FlatList data={rows}> */",
    "const real = <ScrollView horizontal keyboardShouldPersistTaps=\"handled\">;"
  ].join("\n");

  it("주석은 걷고 코드는 남긴다 — 그리고 길이가 보존된다", () => {
    const masked = maskComments(fixture);
    expect(masked).toHaveLength(fixture.length);
    expect(openingTagsOf(masked, "FlatList")).toHaveLength(0);
    // 기본 뷰는 문자열 **내용**을 남기므로 인용된 자리가 아직 보인다.
    expect(openingTagsOf(masked, "ScrollView")).toHaveLength(2);
  });

  it("문자열까지 걷는 걸음은 인용된 여는 태그를 세지 않는다", () => {
    const masked = maskComments(fixture, { strings: true });
    expect(masked).toHaveLength(fixture.length);
    expect(openingTagsOf(masked, "ScrollView")).toHaveLength(1);
    // ⚠️ **그리고 이 뷰가 계수 전용인 이유가 여기서 보인다** — 문자열 내용을 걷으므로 속성 **값**이
    // 남지 않는다(`"handled"` → `<non-literal>`). 판정은 반드시 기본 뷰에서 낸다.
    expect(persistTapsValue(openingTagsOf(masked, "ScrollView")[0].body)).toBe("<non-literal>");
    expect(persistTapsValue(openingTagsOf(maskComments(fixture), "ScrollView")[1].body)).toBe("handled");
  });

  it("오늘 이 모집단에서 두 뷰의 갈림은 0이다 — 0인 것은 오늘의 값이지 규율이 아니다", () => {
    expect(scrollerSites.length - scrollerSiteCountStringsMasked()).toBe(MASKING_DELTA_TODAY);
  });
});

describe("ⓐ 모집단 — 전수에서 파생한다(손 목록 금지)", () => {
  it("스윕 경계가 값으로 서 있다 — 이 파일은 저장소 그물 열다섯의 하나가 아니다", () => {
    expect(SWEEP_SCOPE_LABEL).toBe("apps/mobile/{app,src}/**");
    expect([...SWEEP_ROOTS]).toEqual(["app", "src"]);
    // 뿌리 밖(어드민·api·packages)으로는 한 걸음도 나가지 않는다.
    expect(sweptFiles.every((file) => file.startsWith("app/") || file.startsWith("src/"))).toBe(true);
    expect(sweptFiles.some((file) => file.includes("node_modules"))).toBe(false);
  });

  it("유령 방지 — 모집단이 0건이 아니고 정찰의 하한을 넘는다", () => {
    expect(sweptFiles.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.sweptFiles);
    expect(scrollerSites.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.scrollerSites);
    expect(scrollerSites.every((site) => site.full.startsWith(`<${site.tag}`) && site.full.endsWith(">"))).toBe(true);
  });

  it("⚠️ 타입 인자를 여는 태그로 세지 않는다 — 그 규칙은 발명이 아니라 인용이다", () => {
    expect(TYPE_ARG_RULE_CITATION).toContain("a11y-contract.test.ts:1289-1294");
    expect(TYPE_ARG_RULE_CITATION).toContain("태그 이름 뒤에 공백이 오는 자리만 센다");
    const excluded = excludedTypeArgumentSites();
    expect(excluded.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.excludedTypeArgs);
    // 오늘 걸러 낸 셋 — 읽으라고 이름으로 둔다.
    expect(excluded.some((line) => line.includes("app/(tabs)/records.tsx") && line.includes("<SectionList<"))).toBe(true);
    expect(
      excluded.filter((line) => line.includes("<ScrollView>")).map((line) => line.split(":")[0])
    ).toEqual([
      "src/design-system/components/ApplicationPrimitives.tsx",
      "src/design-system/components/ScreenScaffold.tsx"
    ]);
    // 그리고 그 규칙이 **실제로** 무엇을 버리는지 픽스처가 보인다.
    expect(openingTagsOf("const r: Ref<ScrollView> = null;", "ScrollView")).toHaveLength(0);
    expect(openingTagsOf("<ScrollView horizontal>", "ScrollView")).toHaveLength(1);
  });

  it("⚠️ 모집단에 손 목록이 없다 — 자리마다 파일·줄·바이트가 소스에서 나온다", () => {
    for (const site of scrollerSites) {
      expect(site.line).toBeGreaterThan(0);
      expect(sweptFiles).toContain(site.file);
      expect(readSweptSource(site.file)).toContain(`<${site.tag}`);
    }
    // 세 태그 이름 말고는 이 모집단에 들어오지 않는다.
    expect([...new Set(scrollerSites.map((site) => site.tag))].sort()).toEqual(["FlatList", "ScrollView", "SectionList"]);
  });
});

describe("ⓑ 판정 셋 — 자리마다 소스에서 하나가 나온다", () => {
  it("모든 자리가 셋 중 하나로 갈린다", () => {
    const verdicts: KeyboardVerdict[] = ["declares-handled", "no-keyboard-in-file", "unguarded-with-keyboard"];
    for (const site of scrollerSites) expect(verdicts).toContain(site.verdict);
    expect(byVerdict("declares-handled").length + byVerdict("no-keyboard-in-file").length + byVerdict("unguarded-with-keyboard").length).toBe(
      scrollerSites.length
    );
  });

  it("⚠️⚠️ 트랙 뒤 — 명시하지 않은 채 키보드가 뜰 수 있는 자리가 0건이다", () => {
    const unguarded = byVerdict("unguarded-with-keyboard").map((site) => `${site.file}:${site.line} <${site.tag}`);
    expect(unguarded).toEqual([]);
  });

  it("키보드가 뜰 수 없어 묻지 않는 자리는 여섯이고, 그 여섯이 파일 이름으로 서 있다", () => {
    const noKeyboard = byVerdict("no-keyboard-in-file");
    expect(noKeyboard.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.noKeyboardSites);
    expect([...new Set(noKeyboard.map((site) => site.file))].sort()).toEqual([
      "app/import/[importJobId].tsx",
      "app/sync-status.tsx",
      "src/design-system/components/ApplicationPrimitives.tsx",
      "src/errors/ErrorBoundary.tsx"
    ]);
    // 판정의 근거가 소스다 — 그 파일들에는 입력칸 여는 태그가 정말 0건이다.
    for (const site of noKeyboard) expect(site.textInputsInFile).toBe(0);
  });

  it("⚠️ 입력칸 바늘은 여는 태그 규칙을 쓴다 — 정찰의 `<TextInput ` 은 더 좁았다(전제 재실측)", () => {
    let narrow = 0;
    let wide = 0;
    for (const file of sweptFiles) {
      const code = maskComments(readSweptSource(file));
      narrow += (code.match(/<TextInput /g) ?? []).length;
      wide += textInputOpeningTagCount(code);
    }
    // 좁은 바늘은 이 저장소의 여러 줄 형식(`<TextInput` + 줄바꿈)을 놓친다.
    expect(wide).toBeGreaterThan(narrow);
    expect(narrow).toBeGreaterThanOrEqual(3);
    expect(wide).toBeGreaterThanOrEqual(27);
    // ⚠️ 좁은 바늘을 쓰면 이 두 화면이 *키보드가 뜰 수 없는 화면*으로 잘못 갈린다.
    for (const file of ["app/(tabs)/records.tsx", "app/expenses/[expenseId].tsx"]) {
      const code = maskComments(readSweptSource(file));
      expect((code.match(/<TextInput /g) ?? []).length).toBe(0);
      expect(textInputOpeningTagCount(code)).toBeGreaterThan(0);
    }
  });

  it("이미 옳던 스캐폴드 셋은 이 트랙이 건드리지 않았다 — 오늘도 `\"handled\"`다", () => {
    for (const file of PRE_EXISTING_HANDLED_FILES) {
      const declared = scrollerSites.filter((site) => site.file === file && site.persistTaps === "handled");
      expect(declared.length).toBeGreaterThan(0);
    }
    expect(maskComments(readSweptSource("src/ui.tsx"))).toContain('keyboardShouldPersistTaps="handled"');
    expect(maskComments(readSweptSource("src/design-system/components/ScreenScaffold.tsx"))).toContain(
      'keyboardShouldPersistTaps="handled"'
    );
  });
});

describe("ⓒ 핵심 루프 1단계의 그 여덟 — 파일과 자리 이름으로 못 박는다", () => {
  const coreFiles = ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx", "app/(tabs)/records.tsx"];
  const horizontalChipRows = scrollerSites.filter(
    (site) => coreFiles.includes(site.file) && site.tag === "ScrollView" && /\bhorizontal\b/.test(site.body)
  );

  it("여덟 자리가 모집단 안에 실재하고, 파일·자리 이름이 대장과 정확히 같다", () => {
    expect(horizontalChipRows).toHaveLength(SCOUT_LOWER_BOUNDS.coreLoopSites);
    expect(CORE_LOOP_SITES).toHaveLength(SCOUT_LOWER_BOUNDS.coreLoopSites);
    expect(horizontalChipRows.map(siteKey).sort()).toEqual(CORE_LOOP_SITES.map(siteKey).sort());
    // 유령 방지 — 대장의 자리 이름이 비어 있으면 위 등호가 조용히 통과하지 않게.
    for (const entry of CORE_LOOP_SITES) {
      expect(entry.anchor.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("⚠️⚠️ 여덟의 판정이 전부 `declares-handled`다 — 하나라도 되돌아가면 빨개진다", () => {
    for (const site of horizontalChipRows) {
      expect(site.verdict).toBe("declares-handled");
      expect(site.persistTaps).toBe("handled");
    }
  });

  it("여덟은 다섯 종류의 줄이다 — 타이핑 중에 누르라고 만든 그 줄들", () => {
    expect([...new Set(horizontalChipRows.map((site) => site.anchor))].sort()).toEqual([
      "categoryChips",
      "itemAutocompleteChips",
      "merchantSuggestions",
      "recentDateChips",
      "recentItemChips"
    ]);
  });

  it("⚠️ `<ScrollView horizontal` 의 바이트를 끊지 않았다 — 새 속성은 `horizontal` 뒤에 붙는다", () => {
    for (const site of horizontalChipRows) {
      expect(site.full.startsWith("<ScrollView horizontal ")).toBe(true);
      expect(site.full).toContain('<ScrollView horizontal keyboardShouldPersistTaps="handled"');
    }
    // `records-list-virtualization.test.ts:39`가 무는 그 문자열이 오늘도 소스에 있다.
    expect(readSweptSource("app/(tabs)/records.tsx")).toContain("<ScrollView horizontal");
  });

  it("⚠️ 기록 탭의 `<ScrollView` 수가 늘지 않았다 — `records-calendar.test.ts:545`가 1로 문다", () => {
    const records = maskComments(readSweptSource("app/(tabs)/records.tsx"));
    expect((records.match(/<ScrollView/g) ?? []).length).toBe(1);
  });

  it("⚠️⚠️ 그 자리를 인용했던 주석이 두 시점으로 정정되어 있다 — 옛 문장을 지우지 않았다", () => {
    const raw = readSweptSource("app/expenses/new.tsx");
    // ① 라운드 56 시점의 옛 문장은 **그대로 남아 있다**(지우지 않는다).
    expect(raw).toContain('`keyboardShouldPersistTaps` 기본값("never")이라');
    expect(raw).toContain("두 번째 탭이 맞을 자리가 없다");
    // ② 오늘의 정정 — 전제가 거짓이 된 이유와 capture 단계가 함께 적혀 있다.
    expect(raw).toContain("두 시점");
    expect(raw).toContain("onStartShouldSetResponderCapture");
    expect(raw).toContain("src/ui.tsx:86-96");
    expect(raw).toContain("가장 안쪽 스크롤러가 기본값이면");
    // ⚠️ 동작은 바뀌지 않았다 — blur에서 접지 않는 판정 그대로다.
    expect(raw).toContain("const [merchantFocused, setMerchantFocused] = useState(false);");
    expect(raw).not.toMatch(/onBlur=\{\(\)\s*=>\s*setMerchantFocused\(false\)\}/);
  });
});

describe('ⓓ `"always"` 부정 단언 — 빈 자리를 눌러도 키보드가 내려간다', () => {
  it("모집단 전수에 `keyboardShouldPersistTaps=\"always\"`가 0건이다", () => {
    const offenders: string[] = [];
    for (const file of sweptFiles) {
      const code = maskComments(readSweptSource(file));
      if (/keyboardShouldPersistTaps\s*=\s*\{?\s*["']always["']/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
    expect(scrollerSites.filter((site) => site.persistTaps === "always")).toEqual([]);
  });

  it("`\"handled\"` 말고 다른 값이 선 자리가 0건이다 — 값이 리터럴이 아닌 자리도 0건", () => {
    const odd = scrollerSites.filter((site) => site.persistTaps !== null && site.persistTaps !== "handled");
    expect(odd.map((site) => `${site.file}:${site.line} ${site.persistTaps}`)).toEqual([]);
  });

  it("⚠️ `\"always\"`를 고르지 않은 이유가 저장소 소스에 그대로 있다 — 라운드 65가 값으로 적었다", () => {
    const ui = readSweptSource("src/ui.tsx");
    expect(ui).toContain('`"always"`가 아니라 `"handled"`인 이유');
    expect(ui).toContain("닫는 법을 모르겠다");
  });
});

describe("ⓔ 픽셀·문구 불변 — 속성 하나를 벗기면 종전 바이트와 정확히 같다(부정 단언 · sha256)", () => {
  const coreFiles = ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx", "app/(tabs)/records.tsx"];
  const horizontalChipRows = scrollerSites.filter(
    (site) => coreFiles.includes(site.file) && site.tag === "ScrollView" && /\bhorizontal\b/.test(site.body)
  );

  it("⚠️⚠️ 여덟 자리에서 새 속성 하나를 벗기면 종전 한 줄과 바이트가 같다", () => {
    expect(sha12(STRIPPED_OPENING_TAG)).toBe(STRIPPED_OPENING_TAG_SHA12);
    const stripped = horizontalChipRows.map((site) => site.full.replace(ADDED_ATTRIBUTE, ""));
    expect(stripped).toHaveLength(SCOUT_LOWER_BOUNDS.coreLoopSites);
    for (const line of stripped) {
      expect(line).toBe(STRIPPED_OPENING_TAG);
      expect(sha12(line)).toBe(STRIPPED_OPENING_TAG_SHA12);
    }
    // 그리고 그 해시가 **실제로 바이트를 무는지**를 픽스처가 보인다(한 글자만 바꿔도 갈린다).
    expect(sha12(`${STRIPPED_OPENING_TAG} `)).not.toBe(STRIPPED_OPENING_TAG_SHA12);
  });

  it("벗기는 것이 정확히 **한 번**이다 — 속성이 두 번 붙거나 다른 자리를 갉지 않았다", () => {
    for (const site of horizontalChipRows) {
      expect(site.full.split(ADDED_ATTRIBUTE)).toHaveLength(2);
      expect(site.full.length - ADDED_ATTRIBUTE.length).toBe(STRIPPED_OPENING_TAG.length);
    }
  });

  it("새 한국어 리터럴 0건 — 세 화면의 문구 수가 종전 그대로다", () => {
    for (const entry of KOREAN_LITERAL_LEDGER) {
      expect(koreanLiteralCount(maskComments(readSweptSource(entry.file)))).toBe(entry.count);
    }
  });

  it("새 낭독 0건 · 서버 0건 · 새 요청 0건 — 세 화면의 낭독·요청 자리 수가 종전 그대로다", () => {
    const counts = KOREAN_LITERAL_LEDGER.map((entry) => {
      const code = maskComments(readSweptSource(entry.file));
      return {
        file: entry.file,
        announce: (code.match(/announceForAccessibility/g) ?? []).length,
        mutations: (code.match(/useMutation/g) ?? []).length
      };
    });
    // 이 트랙은 낭독도 뮤테이션도 더하지 않았다 — 여덟 태그에 속성 하나씩이 전부다.
    expect(counts).toEqual([
      { file: "app/expenses/new.tsx", announce: 0, mutations: 2 },
      { file: "app/expenses/[expenseId].tsx", announce: 0, mutations: 3 },
      { file: "app/(tabs)/records.tsx", announce: 0, mutations: 2 }
    ]);
  });

  it("⚠️ 칩의 `hitSlop`·`gap`·라벨을 건드리지 않았다 (GAP-065 #7의 축이다)", () => {
    for (const site of horizontalChipRows) {
      expect(site.body).toContain("contentContainerStyle={{ gap: 8 }}");
      expect(site.body).not.toContain("hitSlop");
    }
    expect(readSweptSource("app/expenses/new.tsx")).toContain("hitSlop={SUGGEST_CHIP_HIT_SLOP}");
    expect(readSweptSource("app/expenses/[expenseId].tsx")).toContain("hitSlop={SUGGEST_CHIP_HIT_SLOP}");
  });
});

describe("ⓕ 사각 — 이 스윕이 못 보는 것을 값과 하한으로 적는다", () => {
  it("사각 다섯이 이유와 재개 조건을 함께 진다 (하한 넷)", () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    for (const spot of BLIND_SPOTS) {
      expect(spot.id.length).toBeGreaterThan(0);
      expect(spot.reason.length).toBeGreaterThan(60);
      expect(spot.resumeCondition).toContain("재개 조건");
      expect(spot.measure).toBeGreaterThanOrEqual(spot.floor);
    }
    expect([...new Set(BLIND_SPOTS.map((spot) => spot.id))]).toHaveLength(BLIND_SPOTS.length);
  });

  it("입력칸 없는 화면 여섯이 판정 밖이라는 사실이 값으로 서 있다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "no-textinput-screens-are-unjudged");
    expect(spot).toBeDefined();
    expect(byVerdict("no-keyboard-in-file").length).toBeGreaterThanOrEqual(spot?.floor ?? 1);
    expect(byVerdict("no-keyboard-in-file")).toHaveLength(spot?.measure ?? -1);
  });

  it("`TextInput`만이 키보드를 띄우는 것은 아니라는 사실이 값으로 서 있다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "keyboard-is-not-only-textinput");
    expect(spot).toBeDefined();
    let wide = 0;
    for (const file of sweptFiles) wide += textInputOpeningTagCount(maskComments(readSweptSource(file)));
    expect(wide).toBeGreaterThanOrEqual(spot?.measure ?? Number.MAX_SAFE_INTEGER);
  });

  it("⚠️ 판정이 **파일 단위**라는 사실이 값으로 적혀 있다 (라운드 91 리뷰 M-2의 같은 얼굴)", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "keyboard-verdict-is-file-scoped");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("같은 화면에 동시에 서는가");
    expect(spot?.reason).toContain("M-2");
    // 오늘 그 사각에 기대는 자리 = 명시하지 않은 전부.
    expect(scrollerSites.filter((site) => site.verdict !== "declares-handled")).toHaveLength(spot?.measure ?? -1);
  });

  it("소스 대조이지 런타임이 아니다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "source-not-runtime");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("실기기");
    expect(spot?.measure).toBe(0);
  });

  it("⚠️⚠️ GAP-065 #6의 손 목록 셋을 전수로 바꾸는 일은 이 트랙의 축이 아니다 — 재개 조건과 함께 적는다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "gap-065-6-scaffold-list-is-not-this-axis");
    expect(spot).toBeDefined();
    expect(spot?.resumeCondition).toContain("그날의 첫 모집단은 오늘의 열일곱이다");
    // 그 셋은 오늘도 `"handled"`이고, 이 트랙은 그 바이트를 건드리지 않았다.
    expect(PRE_EXISTING_HANDLED_FILES).toHaveLength(spot?.measure ?? -1);
    expect(scrollerSites.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.scrollerSites);
  });

  it("어드민·api·packages는 이 스윕의 뿌리 밖이다 — 세는 자리가 구조적으로 0건이다", () => {
    expect(sweptFiles.filter((file) => file.includes("apps/admin") || file.includes("packages/"))).toEqual([]);
  });
});
