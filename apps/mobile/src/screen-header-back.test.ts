import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX-Q(C): 나가는 길 계약.
 *
 * 앱은 전역 `headerShown: false`라 스택 화면에 OS 헤더가 없고, ScreenHeader에도 되돌아가는
 * 슬롯이 없었다. 이 파일은 두 가지를 고정한다.
 *
 *  a) ScreenHeader의 `onBack`은 **옵셔널**이며, 넘기지 않으면 뒤로가기 노드를 아예 만들지 않는다
 *     (픽셀락 HOME/EXP/ITEM/REP/FAM/IMP/SET 캡처가 지나가는 화면들이 예전 트리를 그대로 유지).
 *  b) 스택으로만 도달하는 화면들은 실제로 `onBack`을 배선한다.
 *
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 소스 grep 관례를 따른다
 * (ui-pixel-lock-flow.test.ts 참고).
 *
 * ---
 *
 * ## ⚠️⚠️ 라운드 93 트랙 A — **모집단이 손 목록이어서 스물두 라운드 동안 보이지 않은 자리가 있었다**
 *
 * ### 두 시점 (AE-3) — 이 파일이 스스로에 대해 적었던 문장과 오늘의 답
 *
 *  · **종전(라운드 39 I-8 ~ 라운드 55)**: 이 파일은 `backWiredScreens`라는 **손으로 적은 열하나**를
 *    두고, 그 위에 *"스택으로만 도달하는 화면 중 나가는 길이 없는 곳은 이제 없다"* 고 적었다.
 *    ⚠️⚠️ **그 문장은 모집단 전체를 두고 한 단언인데, 계약이 실제로 센 것은 *목록에 적힌 열하나가
 *    관례를 지키는가*이지 *관례를 져야 하는 자리가 이것뿐인가*가 아니었다.** 그래서 목록 밖에
 *    서 있던 화면은 한 번도 세어진 적이 없고, **그 문장 덕에 이 자리는 *이미 해결된 것*으로
 *    읽혔다.** 라운드 55가 둘을 더한 뒤로 이 목록은 스물두 라운드 동안 자라지 않았다.
 *  · **오늘(라운드 93 A)**: `app/**`를 걸어 보니 라우트 **36** · 탭 밖 **31** · 그중 `ScreenHeader`를
 *    쓰는 것 **18** · `onBack`을 배선한 것 **11**(= 손 목록과 정확히 같았다) ·
 *    ⚠️⚠️ **쓰는데 배선하지 않은 것 일곱**이었고, 그중 **여섯은 뒤로가기가 없는 것이 판단인 자리**
 *    (선형 온보딩 다섯 + 딥링크 착지 하나)인 반면 **`app/sync-status.tsx` 하나는 그 어느 쪽도
 *    아니었다** — 목록이 빌 때만 서는 "닫기" 말고는 화면 안의 나가는 길이 0개였고, 앱은 실패 행을
 *    고쳐 저장한 사용자를 **스스로 그 화면으로 보낸다**
 *    (`src/expenses/post-save-destination.ts`의 `POST_SAVE_SYNC_STATUS_DESTINATION` · 핵심 루프 1단계 직후).
 *    ⚠️ **옛 문장은 지우지 않는다** — 그 문장이 참이 되도록 화면을 고치고(`onBack` 한 줄),
 *    같은 걸음에 **모집단을 손 목록에서 전수 파생으로** 바꾼다.
 *
 * ### ⓐ 모집단 — 손 목록 금지, `app/` 트리를 걷는다
 *
 * `apps/mobile/app/**`의 `.tsx` 전수에서 시작해 세 갈래를 **파생으로** 갈라낸다:
 * `_`로 시작하는 **레이아웃**(라우트가 아니다) · **탭 루트**(`app/(tabs)/`) ·
 * **한 줄 재수출**(`export { default } from "…";` 한 줄뿐인 파일 — 화면이 아니라 별칭 경로다).
 *
 * ### ⓑ 판정 — 탭 밖 화면마다 정확히 하나
 *
 *  · `back-wired` — 그 화면의 `<ScreenHeader` 여는 태그가 `onBack`을 진다(오늘 **12**).
 *  · `no-back-by-design` — 짊어지지 않는 것이 판단이고 **이유가 값으로** 있다(오늘 **여섯**).
 *  · `stack-screen-without-exit` — 지지도 않고 이유도 없다. ⚠️⚠️ **트랙 뒤 0건이어야 한다.**
 *  · `no-screen-header` — `ScreenHeader`를 쓰지 않는다(오늘 **여덟** · 아래 사각 ⓐ).
 *
 * ### ⓕ 이 계약이 못 보는 것은 아래 `BLIND_SPOTS`가 값과 하한으로 진다(넷 이상).
 */

/** ⚠️ 이 스윕이 걷는 경계. `apps/mobile/app/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_SCOPE_LABEL = "apps/mobile/app/**" as const;

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const screenHeaderBlock = () => {
  const uiSource = source("src/ui.tsx");
  return uiSource.slice(uiSource.indexOf("export function ScreenHeader"), uiSource.indexOf("export function Card"));
};

/**
 * ⚠️ **오늘의 하한.** 정찰(2026-08-31)이 낸 수를 오늘 워킹트리에서 다시 재었고 **전부 같았다**
 * (라우트 36 · 탭 밖 31 · `ScreenHeader` 18 · 배선 11 → 트랙 뒤 12 · 배선 없음 일곱 → 트랙 뒤 여섯).
 * 값은 갱신하되 이 하한은 내리지 않는다.
 */
const LOWER_BOUNDS = {
  /** `_` 레이아웃을 뺀 라우트 전수. */
  routes: 36,
  /** 탭 루트 다섯을 뺀 자리. */
  outsideTabs: 31,
  /** 한 줄 재수출(화면이 아니다). */
  reExports: 5,
  /** 탭 밖에서 `ScreenHeader`를 쓰는 화면. */
  screenHeaderScreens: 18,
  /** ⓔ 래칫 — 배선한 자리 수는 줄지 않는다(라운드 55까지 11 · 라운드 93 A가 하나를 더했다). */
  backWired: 12,
  /** 뒤로가기가 없는 것이 판단인 자리. */
  noBackByDesign: 6,
  /** `ScreenHeader`를 쓰지 않아 이 바늘 밖인 탭 밖 화면. */
  noScreenHeader: 8,
  /** 탭 루트 가운데 `ScreenHeader`를 쓰는 것(픽셀락 캡처가 지나간다). */
  tabRootsWithHeader: 2
} as const;

/**
 * ⚠️ 라운드 55까지 이 파일이 **손으로** 적고 있던 목록의 크기. 목록 자체는 지웠고(모집단은 이제
 * 파생이다) **수만 하한으로 남긴다** — 파생이 그 아래로 떨어지면 관례가 후퇴한 것이다.
 */
const ROUND_55_HAND_LIST_SIZE = 11 as const;

/** 열둘이 한 글자도 다르지 않게 쓰는 그 한 관례. 화면마다 다른 뒤로가기를 만들지 않는다. */
const BACK_WIRING = "onBack={() => router.back()}" as const;

/**
 * ⓑ 판정 둘째 — **뒤로가기가 없는 것이 판단인 자리와 그 이유.**
 *
 * ⚠️ 이유는 파생이 아니라 **사람의 문장**이다(사각 ⓓ). 빈 알리바이는 길이로만 막는다(40자 하한).
 * ⚠️⚠️ **여기에 이름을 적는 것으로 자리 하나가 면제되므로, 새 이름을 더하는 손은 그 화면이
 * 정말 그 갈래인지를 먼저 답해야 한다** — 이 표가 자라는 것은 관례의 후퇴가 아니라 판단의 기록이다.
 */
const NO_BACK_BY_DESIGN: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: "app/(onboarding)/budget.tsx",
    reason:
      "선형 온보딩의 마지막 걸음이라 **뒤로가기가 없는 것이 판단**이다. 앞 걸음이 저장한 아이 정보 위에 서고, " +
      "되돌아가면 이미 확정한 값과 어긋난 상태로 다시 들어온다. 나가는 길은 온보딩을 끝내는 것이다."
  },
  {
    file: "app/(onboarding)/child-profile.tsx",
    reason:
      "선형 온보딩의 첫 입력 걸음이라 되돌아갈 앞 화면이 없다(그 뒤는 로그인·런치 애니메이션이고 " +
      "돌아가면 계정 흐름으로 떨어진다). 나가는 길은 다음 걸음으로 나아가는 것 하나다."
  },
  {
    file: "app/(onboarding)/child-status.tsx",
    reason:
      "선형 온보딩의 한 걸음이라 뒤로가기가 없는 것이 판단이다. 이 화면의 선택은 다음 걸음이 무엇을 " +
      "물을지를 정하므로, 되돌아가 고르면 이미 지나간 걸음과 어긋난 상태가 남는다."
  },
  {
    file: "app/(onboarding)/prepared-items.tsx",
    reason:
      "선형 온보딩의 한 걸음이라 뒤로가기가 없는 것이 판단이다. 여기서 고른 준비템은 다음 걸음(예산)의 " +
      "재료이고, 되돌아가는 대신 앞으로 나아가는 길만 둔다 — 온보딩 다섯이 같은 답을 골랐다."
  },
  {
    file: "app/(onboarding)/resume.tsx",
    reason:
      "중단된 온보딩을 **이어서** 시작하는 갈림길이라 뒤에 화면이 없다. 이 자리의 선택지는 이어하기와 " +
      "처음부터 다시이고 둘 다 앞으로 가는 길이므로, 뒤로가기는 지을 수 있는 길이 아니다."
  },
  {
    file: "app/family/accept/[token].tsx",
    reason:
      "초대 딥링크가 **앱 바깥에서** 착지하는 화면이라 되돌아갈 스택 자체가 없다(메신저·브라우저에서 바로 " +
      "열린다). 막다른 길의 탈출구는 이 화면이 스스로 지닌 것이고(`householdJoinEscapePlan`이 목적지를 " +
      "고르는 replace · 라운드 60 #3·리뷰 P1-1), 거기에 ‹를 더하면 나가는 길이 둘로 갈린다."
  }
];

/** 그 여섯의 소스 증인 — 파일 전체에 `router.back()`이 0건이다(뒤로가기가 그 화면들의 길이 아니다). */
const NO_BACK_SOURCE_WITNESS = "router.back()" as const;

/** ⓒ 오늘 고치는 그 하나 — 판정 첫째로 떨어짐을 **파일 이름으로** 못 박는다. */
const TRACK_A_FIXED_SCREEN = "app/sync-status.tsx" as const;

/**
 * ⓓ 바이트 불변 — 라운드 91 A·92 A의 ⓔ 형식(sha256 부정 단언)을 인용한다
 * (`src/keyboard-tap-guard.test.ts`의 `STRIPPED_OPENING_TAG` · `src/mutation-press-guard.test.ts`).
 *
 * `app/sync-status.tsx`의 `<ScreenHeader` 여는 태그에서 **이 트랙이 더한 한 줄만** 벗기면 종전
 * 바이트와 **정확히** 같아야 한다.
 */
const ADDED_ATTRIBUTE_LINE = `\n        ${BACK_WIRING}` as const;

/**
 * ⚠️ 등호를 고른 자리 — **이동 의무를 여기 적는다**: 이 리터럴은 `app/sync-status.tsx`의 헤더
 * 문구(눈썹·제목·부제)가 정당하게 바뀌는 라운드에 **그 라운드의 손이 함께 옮긴다.** 그때 아래
 * sha12도 같은 걸음에 갱신하고, 갱신하지 않으면 이 계약이 먼저 빨개진다(조용히 낡지 않는다).
 */
const STRIPPED_SYNC_STATUS_HEADER =
  '<ScreenHeader\n        eyebrow="동기화"\n        title="동기화 상태"\n        subtitle={\n' +
  "          expenseEntryLocked ? VIEW_ONLY_HEADLINES.syncStatus : " +
  '"아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요."\n        }\n      />';

/** 위 한 줄묶음의 sha256 앞 12. ⚠️ 미리보기가 아니라 **해시**가 바이트를 문다. */
const STRIPPED_SYNC_STATUS_HEADER_SHA12 = "8c83e774e05c" as const;

/**
 * ⓓ — `app/sync-status.tsx`의 한국어 문자열 리터럴 수(주석을 걷은 뒤 센다).
 *
 * ⚠️ 이 트랙은 문구를 **한 글자도** 더하지 않았다. ⚠️ 등호를 고른 자리이므로 이동 의무를 적는다:
 * 이 화면의 문구를 정당하게 고치는 라운드가 **그 걸음에 이 수를 함께 옮긴다**. 움직였는데 옮기지
 * 않으면 빨개진다 — 그것이 이 수의 일이다.
 */
const SYNC_STATUS_KOREAN_LITERALS = 10 as const;

/**
 * ⓕ 사각 — ⚠️ **이 계약이 못 보는 것을 값과 하한으로 적는다.**
 *
 * 이 계약이 초록이라는 사실은 *"이 앱에서 사람이 갇히는 자리가 0이다"* 가 아니라 *"이 모집단
 * 안에서 이만큼이 풀렸다"* 는 뜻이다(AB-5의 규율).
 *
 * ## ⚠️⚠️ 라운드 94 트랙 B — 사각의 **자가 상수에서 함수가 됐다**(결정형 #18을 집었다)
 *
 * ### 두 시점 (AE-3) — 이 파일이 자기 사각을 재던 꼴
 *
 *  · **시점 ① 라운드 93 리뷰 L-3까지**: 아래 여섯의 자는 **여섯 다 손이 적은 상수**였다
 *    (`measure: <수>`). L-3이 이름 붙인 병은 *"손이 적은 수를 다른 손이 적은 수와 맞대면 둘이
 *    함께 낡아도 초록"* 이고, 그 라운드의 답은 **`it` 쪽에서 파생값과 맞대는 것**이었다 —
 *    그래서 대조가 서는 자리 **셋**(ⓐ·ⓓ·ⓔ)과 서지 않는 자리 셋이 갈렸고, **자 자체는 여섯 다
 *    상수**였다. 자가 상수인 한 그 대조는 *관례*이지 *구조*가 아니다.
 *  · **시점 ② 오늘(라운드 94 B)**: 자가 **자기 모집단을 그 자리에서 다시 세는 함수**가 됐다
 *    (`measure: () => number` — 트랙 D `apps/admin/src/admin-load-error-copy.test.ts:678`의 꼴을
 *    **인용한다**. 그 파일은 이 트랙의 것이 아니라 읽기만 했고 바이트를 한 글자도 만지지 않았다).
 *    파생이 되는 **넷**은 자를 함수로 지니고, 파생이 되지 않는 **둘**은 ⚠️⚠️ **자를 아예 두지
 *    않는다** — 그 둘이 종전에 지녔던 0은 *없다*가 아니라 *셀 수 없다*였고, `() => 0`은 그 0을
 *    함수로 포장한 것이라 병이 그대로다. 그 둘은 크기 대신 **불가의 증거**(`uncountable` —
 *    무엇을 세려 했고 어떤 정보가 소스에 없는가)와 **소스 증인**을 지고, 증인 자체도 걷어서 낸다.
 *  · ⚠️ **옛 상수는 지우지 않는다** — 자리마다 `round93Constant`로 남긴다(AE-3). 오늘의 파생값이
 *    그 수와 갈리는 날 고칠 곳은 `today`이지 그 기록이 아니다.
 *
 * ### ⚠️ 자가 진짜 자인지는 이 절이 스스로 문다 (유령 자 금지)
 *
 * 상수를 감싼 함수는 저장소가 통째로 바뀌어도 조용하다. 그래서 아래 `it` 둘이 값으로 보인다 —
 * ⓐ 자가 **오늘 실제로 불려** 수를 낸다(그 수를 기록과 맞댄다) · ⓑ **이 파일의 소스**에
 * *수를 그 자리에 박아 돌려주는 화살표·`return`* 이 **0건**이다(주석은 걷고 본다). 즉 `() => 0`
 * 꼴은 규율이 아니라 **부정 단언**이 막는다.
 *
 * ⚠️ **재개 조건(결정형 · 손은 저장소 안): 이 파일의 사각 자를 트랙 D의 꼴로 바꾸는 날** — 라운드
 * 93 트랙 D(`apps/admin/src/admin-load-error-copy.test.ts:678`)는 사각의 자를 값이 아니라
 * **`measure: () => number`**(자기 모집단을 그 자리에서 다시 세는 함수)로 지닌다. 그 꼴로 옮기면
 * 상수 대 상수가 **구조적으로** 불가능해지고, 그날 먼저 물을 것은 *파생이 불가능한 사각(위 둘)의
 * `measure`를 어떤 꼴로 둘 것인가*이다. 첫 모집단은 이 다섯이다.
 * ⚠️⚠️ **그날이 오늘이다(라운드 94 트랙 B) — 이 결정형은 집혔고 소진됐다.** 함께 물은 그 물음의
 * 답은 **자를 두지 않는다**이고, 이 결정형이 **다시 열리는 조건**은 아래 `DECISION_18`이 값으로
 * 진다(소진은 사각이 닫혔다는 뜻이 아니다 — 자의 꼴이 바뀌었다는 뜻뿐이다).
 */

/**
 * ⚠️⚠️ **결정형 #18의 발동 기록 — 두 시점을 *값으로* 든다.**
 *
 * 산문으로만 적으면 다음 라운드가 이 사실을 다시 발견해야 한다. 그래서 집히기 전의 꼴과 집힌 뒤의
 * 꼴을 **자가 읽을 수 있는 수**로 남기고, 아래 `it`이 시점 ②의 수를 **오늘의 `BLIND_SPOTS`에서
 * 다시 세어** 맞댄다 — 기록도 파생과 맞댄다(기록만 남기면 그 기록이 먼저 낡는다).
 */
const DECISION_18 = {
  id: "blind-spot-measure-as-derivation",
  raisedBy: "라운드 93 리뷰 L-3",
  pickedUpBy: "라운드 94 트랙 B",
  quotedShapeFrom: "apps/admin/src/admin-load-error-copy.test.ts",
  /** 시점 ① — 자가 여섯 다 상수였고, 그중 셋만 `it`에서 파생값과 맞대어졌다. */
  round93: { spots: 6, constantMeasures: 6, derivedMeasures: 0, comparedAgainstDerivation: 3 },
  /** 시점 ② — 넷이 함수가 됐고, 둘은 자를 두지 않는다(증거와 증인만 진다). */
  round94: { spots: 6, constantMeasures: 0, derivedMeasures: 4, withoutMeasure: 2 },
  /**
   * ⚠️ 소진은 사각이 닫혔다는 뜻이 아니다 — **다시 열리는 조건**을 값으로 남긴다.
   */
  reopenCondition:
    "재개 조건(사건형): 자를 두지 않은 둘 가운데 하나가 소스에서 셀 수 있게 되는 날 — 하드웨어 " +
    "뒤로가기를 가로채는 자리가 `app/**` 안에 서거나, 이 저장소의 vitest가 화면을 렌더할 수 있게 " +
    "되는 날(둘 다 아래 증인이 0을 벗어나는 것으로 먼저 드러난다). 그날 그 자리는 증거가 아니라 " +
    "`measure`를 지녀야 하고, 첫 모집단은 오늘의 증인 넷이다."
} as const;

/**
 * ⚠️⚠️ **AH-1의 병이 이 파일에도 있었다 — *주석 대 자*(정찰 §답 1의 여섯째 자리와 같은 꼴).**
 *
 * 종전 사각 ⓒ의 소스 증인은 이유가 *"이 계약은 화면을 **렌더하지도 탐색하지도** 않는다"* 라고
 * **부류 전체**를 두고 말하는데, 자는 react-native 렌더 하네스 **이름 하나**였다(그 이름은 아래
 * 목록의 첫 줄이 조각으로 잇는다 — 여기 통짜로 적으면 이 자가 그 주석을 세어 늘 걸린다). 다른
 * 하네스가 이 파일에 들어오면 그 자는 **조용히 통과한다** — 어드민에서 AH-1이 집은 자리
 * (주석은 *"손 목록이 다시 서지 않는다"* 인데 바늘은 이름 하나)와 정확히 같은 병이 한 겹 안쪽에서
 * 다시 난 자리다. 오늘 그 자를 **부류의 전수**로 넓힌다.
 *
 * ⚠️ 바늘은 조각으로 잇는다 — 통짜 리터럴로 적으면 이 자가 **자기 자신**을 세어 늘 걸린다
 * (라운드 93 트랙 D가 `admin-load-error-copy.test.ts`에서 쓴 그 규율을 인용한다).
 * ⚠️ 이 목록이 **부류 전체**를 말한다는 사실도 값이다: 밖에 무엇이 있는지 모르면 여기 이름을
 * 더하는 손이 판단할 것이 없으므로, 새 하네스가 저장소에 서는 날 그 이름을 여기에 함께 더한다.
 */
const RENDER_HARNESS_NEEDLES: readonly string[] = [
  ["@testing-", "library/react-", "native"].join(""),
  ["@testing-", "library/react"].join(""),
  ["react-test-", "renderer"].join(""),
  ["react-native-", "testing-library"].join(""),
  ["en", "zyme"].join(""),
  ["play", "wright"].join(""),
  ["pupp", "eteer"].join(""),
  ["js", "dom"].join("")
];

/**
 * 크기 대신 드는 **소스 증인** — 이름과, 그 증인을 소스에서 내는 파생.
 *
 * ⚠️ 증인도 상수면 뜻이 없다(그래서 `count`가 함수다) · ⚠️ 증인이 **유령이 아님**은 `population`이
 * 진다(모집단이 0이면 그 파생은 아무것도 보지 않은 것이고, 그런 0은 증언이 아니다).
 * ⚠️ 계약이 무는 것은 **방향**이다 — `atMost`는 *"오늘 이만큼이고 넘으면 사각이 자란 것"* ·
 * `atLeast`는 *"밖에 이만큼이 있고 줄면 증인이 사라진 것"*. 등호를 쓰지 않는다.
 */
type SourceWitness = {
  readonly label: string;
  readonly count: () => number;
  readonly population: () => number;
  /** 오늘 그 파생이 낸 수(기록 · 두 시점의 오른쪽). */
  readonly today: number;
  readonly bound: "atMost" | "atLeast";
};

/**
 * ⚠️⚠️ **파생이 불가능한 사각의 자리에 크기 대신 서는 것** — *왜 못 세는지*를 문장이 아니라
 * **증거**로 적는다: 무엇을 세려 했고(`wantedToCount`), 그 수를 내려면 소스에 무엇이 있어야 하는데
 * 없는가(`missingFromSource`), 그리고 0을 어떻게 읽어야 하는가(`zeroMeans`).
 */
type UncountableEvidence = {
  readonly wantedToCount: string;
  readonly missingFromSource: string;
  readonly zeroMeans: string;
  readonly witnesses: readonly SourceWitness[];
};

/**
 * 사각 하나.
 *
 * ⚠️ `measure`·`today`·`floor`는 **함께 서거나 함께 없다**(아래 `it`이 그 배타를 문다).
 * 자가 없는 자리는 `uncountable`을 지고, 자가 있는 자리는 `uncountable`을 지지 않는다.
 */
type BlindSpot = {
  readonly id: string;
  readonly reason: string;
  readonly resumeCondition: string;
  /** ⚠️ 라운드 93까지 이 자리가 지녔던 **손이 적은 상수**(두 시점의 왼쪽 · 기록이라 지우지 않는다). */
  readonly round93Constant: number;
  /** ⓐ 자 — 자기 모집단을 그 자리에서 다시 세는 함수(트랙 D의 꼴). */
  readonly measure?: () => number;
  /** 오늘 그 자가 낸 수(두 시점의 오른쪽). ⚠️ 이동 의무: 모집단이 정당하게 자라는 라운드가 함께 옮긴다. */
  readonly today?: number;
  /** 하한 — 넘어서는 안 되는 바닥. */
  readonly floor?: number;
  /** ⓑ 자를 둘 수 없는 자리의 증거. */
  readonly uncountable?: UncountableEvidence;
};

const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    id: "screens-without-screen-header-are-outside-this-needle",
    round93Constant: 8,
    /** 자 — 탭 밖 화면 가운데 `ScreenHeader`를 쓰지 않는 것을 **트리에서 다시 센다**. */
    measure: () => ledger.noScreenHeader.length,
    today: 8,
    floor: 1,
    reason:
      "이 자가 보는 것은 **공용 `ScreenHeader`의 `onBack` 슬롯 하나**다. 탭 밖 화면 여덟은 자기 헤더를 " +
      "그리거나 헤더 자체가 없어(`app/(auth)/login.tsx` · `app/expenses/new.tsx` · `app/family/index.tsx` · " +
      "`app/import/index.tsx` · `app/index.tsx` · `app/items/[itemTemplateId].tsx` · " +
      "`app/launch-animation.tsx` · `app/pixel-lock.tsx`) 이 바늘 밖이다. " +
      "⚠️ **오늘 그중 넷이 `router.back()`을 다른 자리에서 쓴다**(나가는 길이 있다는 뜻이지만 이 자가 센 것은 아니다) — " +
      "나머지 넷의 나가는 길이 옳은지는 **이 계약이 묻지 않았다.** 오차의 방향은 조용한 쪽(거짓 초록)이다.",
    resumeCondition:
      "재개 조건(사건형): 그 여덟 가운데 하나가 자기 헤더에서 나가는 길을 잃었다는 보고가 처음 서는 날 — " +
      "그날 이 바늘은 `ScreenHeader` 밖의 헤더 관례까지 세어야 하고, 그 첫 모집단은 오늘의 여덟이다."
  },
  {
    id: "hardware-back-and-swipe-are-not-seen",
    round93Constant: 0,
    reason:
      "**안드로이드 하드웨어 뒤로가기와 iOS 가장자리 스와이프는 이 계약이 보지 않는다.** 이 자가 세는 것은 " +
      "**화면 안의 길**뿐이다 — 화면 안에 길이 0개여도 OS 제스처로는 나갈 수 있고, 반대로 이 계약이 초록인 " +
      "화면이 제스처에서는 막혀 있을 수도 있다. 그 둘은 이 소스 대조가 답할 수 있는 물음이 아니다.",
    uncountable: {
      wantedToCount:
        "OS 제스처(안드로이드 하드웨어 뒤로가기 · iOS 가장자리 스와이프)로 실제로 나갈 수 있는 화면의 수 — " +
        "즉 **이 계약이 못 본 나가는 길의 크기**. 그 수가 있어야 사각의 크기를 말할 수 있다.",
      missingFromSource:
        "그 길이 열려 있는지는 화면 소스가 아니라 **OS와 네비게이터**가 정한다. `app/**` 전수를 걸어도 " +
        "`BackHandler`도 `gestureEnabled`도 **한 글자가 없고**(증인 ①·②가 그 0을 트리에서 낸다), " +
        "**없다는 사실에서는 *열려 있다*도 *막혀 있다*도 나오지 않는다** — 세려는 대상이 소스에 " +
        "바이트로 존재하지 않으므로 걷기의 문제가 아니라 **모집단의 문제**다.",
      zeroMeans:
        "⚠️⚠️ **여기의 0은 *없다*가 아니라 *셀 수 없다*는 뜻이다.** 증인 ③이 그 사실을 값으로 든다 — " +
        "이 앱은 하드웨어 뒤로가기를 **실제로 가로챈다**(`src/**`에 `BackHandler` 한 자리 · 잠금 오버레이). " +
        "그 자리는 `app/**` 밖이라 이 스윕의 모집단에 들어오지 않고, 그래서 증인 ①의 0은 " +
        "*가로채기가 없다*가 아니라 **이 자가 볼 수 있는 곳에 없다**이다.",
      witnesses: [
        {
          label: "증인 ① — `app/**` 전수에서 `BackHandler`를 담은 파일",
          count: () => filesContaining("app", "BackHandler").length,
          population: () => listSourceFiles("app").length,
          today: 0,
          bound: "atMost"
        },
        {
          label: "증인 ② — `app/**` 전수에서 제스처 설정(`gestureEnabled`)을 담은 파일",
          count: () => filesContaining("app", "gestureEnabled").length,
          population: () => listSourceFiles("app").length,
          today: 0,
          bound: "atMost"
        },
        {
          label: "증인 ③ — 이 스윕 **밖**(`src/**`)에서 하드웨어 뒤로가기를 가로채는 파일",
          count: () => filesContaining("src", "BackHandler").length,
          population: () => listSourceFiles("src").length,
          today: 1,
          bound: "atLeast"
        }
      ]
    },
    resumeCondition:
      "재개 조건(사건형): 하드웨어 뒤로가기를 가로채는 화면(`BackHandler`)이 이 모집단에 처음 서는 날 — " +
      "그날 이 자는 그 가로채기를 자리로 세어야 한다(오늘 `app/**`에 0건)."
  },
  {
    id: "source-not-runtime",
    round93Constant: 0,
    reason:
      "이 계약은 **소스 대조**다 — ‹를 실제로 눌러 그 화면에서 나가지는지, `router.back()`이 그 순간 어디로 " +
      "돌려보내는지는 이 자가 묻지 않는다(런타임 확인 0건). 그 확인은 **실기기 항목**의 몫이고, " +
      "이 계약이 초록이라는 사실이 그 항목을 대신하지 않는다.",
    uncountable: {
      wantedToCount:
        "‹를 실제로 눌렀을 때 그 화면에서 나가지는가 — 즉 **배선 열둘 가운데 런타임에서 참인 것의 수**. " +
        "그 수가 있어야 *나가는 길이 있다*를 소스가 아니라 앱에 대해 말할 수 있다.",
      missingFromSource:
        "누름과 이동은 **런타임 사건**이라 소스에는 배선까지만 남는다. 이 저장소의 vitest에는 react-native " +
        "네이티브 바인딩이 없어 화면을 렌더할 하네스가 **한 벌도 없고**(증인 ①이 그 0을 이 파일에서 낸다), " +
        "렌더가 없으면 누를 것도 없다 — 걸어서 낼 수 있는 것은 *배선이 있다*까지이고 그 앞은 " +
        "**바이트로 존재하지 않는다.**",
      zeroMeans:
        "⚠️⚠️ **여기의 0도 *없다*가 아니라 *셀 수 없다*는 뜻이다** — *런타임에서 다 옳다*가 아니라 " +
        "**이 자가 런타임을 한 번도 보지 않았다**이다. 증인 ②가 그 대조를 값으로 든다: 이 계약이 오늘 한 " +
        "일은 탭 밖 화면 스물여섯을 **바이트로 읽은 것**이고 렌더한 것은 하나도 없다. 그 확인은 " +
        "**실기기 항목**의 몫이고, 이 계약이 초록이라는 사실이 그 항목을 대신하지 않는다.",
      witnesses: [
        {
          label: "증인 ① — 이 계약 파일에 든 렌더·브라우저 하네스 바늘(부류 전수)",
          count: () => {
            const self = source("src/screen-header-back.test.ts");
            return RENDER_HARNESS_NEEDLES.filter((needle) => self.includes(needle)).length;
          },
          population: () => RENDER_HARNESS_NEEDLES.length,
          today: 0,
          bound: "atMost"
        },
        {
          label: "증인 ② — 이 자가 렌더 대신 **바이트로 읽은** 탭 밖 화면",
          count: () => ledger.screens.length,
          population: () => ledger.outsideTabs.length,
          today: 26,
          bound: "atLeast"
        }
      ]
    },
    resumeCondition:
      "재개 조건(사건형): 실기기 확인이 이 나가는 길을 항목으로 받는 날 — 그날 이 사각은 그 항목 번호를 함께 든다."
  },
  {
    id: "second-verdict-reason-is-hand-written-prose",
    round93Constant: 6,
    /** 자 — 판정 둘째의 **파생된** 자리 수(손이 적은 표의 크기가 아니다). */
    measure: () => ledger.noBackByDesign.length,
    today: 6,
    floor: 1,
    reason:
      "**판정 둘째의 *이유*는 파생이 아니라 사람의 문장이다.** 이 자는 그 문장이 참인지 묻지 못하고 " +
      "**빈 알리바이를 길이로만 막는다**(40자 하한 + 그 파일에 `router.back()`이 0건이라는 소스 증인 하나). " +
      "즉 자리 하나를 이 표에 적는 것으로 면제할 수 있고, 그 판단이 옳은지는 사람이 진다. " +
      "⚠️ 오차의 방향은 조용한 쪽(거짓 초록)이다.",
    resumeCondition:
      "재개 조건(사건형): 이 표의 자리 하나가 *뒤로가기가 있어야 하는 화면이었다*고 보고되는 날 — " +
      "그날 그 줄을 지우면 그 자리는 `stack-screen-without-exit`로 떨어지고 이 계약이 **먼저** 빨개진다."
  },
  {
    id: "one-line-re-export-routes-are-not-screens",
    round93Constant: 5,
    /** 자 — `app/` 트리에서 파생한 한 줄 재수출 라우트. */
    measure: () => ledger.reExports.length,
    today: 5,
    floor: 1,
    reason:
      "`app/onboarding/**`의 다섯은 `export { default } from \"../(onboarding)/…\";` **한 줄**짜리 별칭 " +
      "경로라 화면이 아니다 — 이 자는 그 다섯을 판정에서 갈라낸다. ⚠️ 그 별칭이 가리키는 실제 화면은 " +
      "`app/(onboarding)/**`로 이미 모집단 안에 있으므로 사각이 아니라 **이중 계수의 방지**이지만, " +
      "재수출이 **여러 줄로 자라 화면이 되는 날** 이 갈라내기는 조용히 틀린다.",
    resumeCondition:
      "재개 조건(사건형): `app/onboarding/**`의 파일 하나가 한 줄 재수출을 벗어나는 날 — " +
      "그날 그 파일은 저절로 판정 모집단으로 들어오고(파생이므로 손이 필요 없다), 첫 모집단은 오늘의 다섯이다."
  },
  {
    // ⚠️ 라운드 93 리뷰(L-5)가 값으로 적은 한 줄 — **바늘의 확장자 좁힘**.
    id: "extension-narrowed-to-tsx",
    round93Constant: 0,
    /** 자 — `app/` 트리의 비테스트 `.ts` 전수(오늘 0 — 실피해가 없다는 사실을 값으로 적는다). */
    measure: () => listAppNonTsxSourceFiles().length,
    today: 0,
    floor: 0,
    reason:
      "**이 걷기는 `app/` 트리에서 `.tsx`만 담는다**(`listAppTsxFiles`). expo-router는 라우트를 " +
      "`.ts`로도 받으므로, 라우트 하나가 `.ts`로 서면 이 계약은 빨개지지 않고 **그냥 못 본다** — " +
      "오차의 방향은 조용한 쪽(거짓 초록)이다. ⚠️ **오늘 그 실피해는 0건이다**: `app/` 아래 비테스트 " +
      "`.ts`가 한 파일도 없고(이 자가 그 0을 트리에서 다시 센다), 그래서 이 좁힘은 **오늘 아무 " +
      "자리도 잃지 않는다.** 0인 것은 규율이 아니라 오늘의 값이다. " +
      "⚠️ 위 `hardware-back-…`의 0과 **한 낱말로 적지 않는다** — 이쪽 0은 걷어서 낸 수이고 " +
      "그쪽 0은 셀 수 없어 자를 두지 않은 자리다.",
    resumeCondition:
      "재개 조건(사건형): `app/` 트리에 비테스트 `.ts`가 처음 서는 날 — 그날 이 수가 0을 벗어나고, " +
      "걷기의 확장자를 넓힐지(넓히면 라우트가 아닌 순수 모듈도 들어온다) 먼저 판단해야 한다."
  }
];

// ───────────────────────────────────────────────────────────────────────────────
// 자 — `app/` 트리를 걷고 자리마다 판정 하나를 소스에서 낸다.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 주석을 같은 길이의 공백으로 바꾼다(문자열 **내용은 남긴다**).
 *
 * ⚠️ **길이를 보존한다** — 마스킹한 뷰에서 찾은 자리로 **원본 바이트**를 잘라 내기 때문이다
 * (`src/keyboard-tap-guard.test.ts`의 `maskComments`와 같은 규율).
 */
function maskComments(code: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | '"' | "'" | "`" = "code";
  while (index < code.length) {
    const char = code[index];
    const pair = code.slice(index, index + 2);
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
    // 문자열 안 — 내용은 그대로 둔다.
    if (char === "\\") {
      out += code.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === state) {
      state = "code";
      out += char;
      index += 1;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/** 주석을 걷은 뒤 남는 문자열 리터럴 가운데 한글을 담은 것의 수(ⓓ가 문다). */
function koreanLiteralCount(raw: string): number {
  const code = maskComments(raw);
  let count = 0;
  let index = 0;
  let quote: string | null = null;
  let buffer = "";
  while (index < code.length) {
    const char = code[index];
    if (quote === null) {
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        buffer = "";
      }
      index += 1;
      continue;
    }
    if (char === "\\") {
      buffer += code.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === quote) {
      if (/[가-힣]/.test(buffer)) count += 1;
      quote = null;
      index += 1;
      continue;
    }
    buffer += char;
    index += 1;
  }
  return count;
}

/** ⓐ `app/` 트리를 걷는다 — 손 목록 금지. */
function listAppTsxFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      found.push(relative(mobileRoot, path).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, "app"));
  return found.sort();
}

/**
 * ⓕ-② 사각 `extension-narrowed-to-tsx`의 자 — **`app/` 트리에서 이 바늘이 지나치는 `.ts` 전수**
 * (라운드 93 리뷰 L-5). 위 걷기가 `.tsx`만 담으므로, 라우트가 `.ts`로 서면 조용히 사라진다.
 */
function listAppNonTsxSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.includes(".test.")) continue;
      found.push(relative(mobileRoot, path).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, "app"));
  return found.sort();
}

/**
 * ⓕ-③ **사각 증인의 걷기** — 어떤 뿌리 아래의 비테스트 소스 전수(`.ts`·`.tsx`).
 *
 * ⚠️⚠️ **이것은 판정의 모집단이 아니다.** 판정은 `app/**`만 걷는다(`SWEEP_SCOPE_LABEL`은 그대로
 * 한 걸음도 나가지 않는다). 이 걷기가 서는 자리는 **자를 둘 수 없는 사각의 증인**이고, 증인은
 * *그 사각이 스윕 밖에 무엇을 두고 있는지*를 보여야 하므로 뿌리를 인자로 받는다.
 */
function listSourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
      found.push(relative(mobileRoot, path).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, root));
  return found.sort();
}

/** 그 뿌리에서 바늘을 담은 파일 — 증인의 자는 **상수가 아니라 걷기**다. */
function filesContaining(root: string, needle: string): string[] {
  return listSourceFiles(root).filter((file) => source(file).includes(needle));
}

/** 파일 이름이 `_`로 시작하면 라우트가 아니라 레이아웃이다(expo-router 관례). */
function isLayoutFile(relativePath: string): boolean {
  const name = relativePath.split("/").pop() ?? "";
  return name.startsWith("_");
}

function isTabRoute(relativePath: string): boolean {
  return relativePath.startsWith("app/(tabs)/");
}

/** `export { default } from "…";` **한 줄**뿐이면 화면이 아니라 별칭 경로다. */
function isOneLineReExport(raw: string): boolean {
  return /^export \{ default \} from "[^"]+";$/.test(raw.trim());
}

/**
 * `<ScreenHeader` **여는 태그**를 전부 딴다 — 태그 이름 뒤에 **공백류가 오는 자리만** 센다
 * (타입 인자 배제 규칙의 출처는 `src/a11y-contract.test.ts:1289-1294`이고, 이 파일이 지은 규칙이
 * 아니다). 마스킹한 뷰에서 자리를 찾고 **원본 바이트**를 잘라 낸다.
 */
function screenHeaderTags(raw: string): { readonly full: string; readonly at: number }[] {
  const code = maskComments(raw);
  const needle = "<ScreenHeader";
  const tags: { full: string; at: number }[] = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf(needle, from);
    if (at === -1) break;
    from = at + needle.length;
    const next = code[at + needle.length];
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
    tags.push({ full: raw.slice(at, i + 1), at });
  }
  return tags;
}

type Verdict = "back-wired" | "no-back-by-design" | "stack-screen-without-exit" | "no-screen-header";

type RouteEntry = {
  readonly file: string;
  readonly raw: string;
  readonly headerTags: readonly { readonly full: string; readonly at: number }[];
  readonly wiresBack: boolean;
  readonly verdict: Verdict | null;
};

const noBackFiles = new Set(NO_BACK_BY_DESIGN.map((entry) => entry.file));

/** 모집단과 판정을 한 번만 파생한다(모듈 로드 시 — 단언은 전부 `it` 안에서 한다). */
function deriveLedger() {
  const allTsx = listAppTsxFiles();
  const layouts = allTsx.filter(isLayoutFile);
  const routes = allTsx.filter((file) => !isLayoutFile(file));
  const tabRoutes = routes.filter(isTabRoute);
  const outsideTabs = routes.filter((file) => !isTabRoute(file));

  const reExports: string[] = [];
  const screens: RouteEntry[] = [];
  for (const file of outsideTabs) {
    const raw = source(file);
    if (isOneLineReExport(raw)) {
      reExports.push(file);
      continue;
    }
    const headerTags = screenHeaderTags(raw);
    const wiresBack = headerTags.some((tag) => tag.full.includes("onBack"));
    const verdict: Verdict = headerTags.length === 0
      ? "no-screen-header"
      : wiresBack
        ? "back-wired"
        : noBackFiles.has(file)
          ? "no-back-by-design"
          : "stack-screen-without-exit";
    screens.push({ file, raw, headerTags, wiresBack, verdict });
  }

  const tabEntries: RouteEntry[] = tabRoutes.map((file) => {
    const raw = source(file);
    const headerTags = screenHeaderTags(raw);
    return {
      file,
      raw,
      headerTags,
      wiresBack: headerTags.some((tag) => tag.full.includes("onBack")),
      verdict: null
    };
  });

  const byVerdict = (verdict: Verdict) => screens.filter((entry) => entry.verdict === verdict);
  return {
    allTsx,
    layouts,
    routes,
    tabRoutes,
    tabEntries,
    outsideTabs,
    reExports,
    screens,
    backWired: byVerdict("back-wired"),
    noBackByDesign: byVerdict("no-back-by-design"),
    withoutExit: byVerdict("stack-screen-without-exit"),
    noScreenHeader: byVerdict("no-screen-header")
  };
}

const ledger = deriveLedger();
const names = (entries: readonly RouteEntry[]) => entries.map((entry) => entry.file);

describe("UX-Q(C) ScreenHeader 뒤로가기 슬롯", () => {
  it("onBack은 옵셔널이고, 지정 시 가족 화면의 ‹ · 44dp · \"뒤로가기\" 관례를 재사용한다", () => {
    const block = screenHeaderBlock();
    expect(block).toContain("onBack?: () => void");
    expect(block).toContain('accessibilityLabel="뒤로가기"');
    expect(block).toContain('accessibilityRole="button"');
    expect(block).toContain("onPress={onBack}");
    expect(block).toContain("‹");
  });

  it("미지정 시 Pressable 자체를 렌더하지 않는다 (픽셀락 캡처 불변)", () => {
    const block = screenHeaderBlock();
    // 조건부 렌더여야 한다 -- 비활성/투명 Pressable을 항상 그려 두면 레이아웃이 달라진다.
    expect(block).toContain("{onBack ? (");
    expect(block).toContain(") : null}");
    // 항상 렌더한 뒤 숨기는 우회로(가시성 토글·pointerEvents)를 금지한다.
    expect(block).not.toContain('pointerEvents="none"');
    expect(block).not.toContain("opacity: onBack");
    expect(block).not.toContain("display: onBack");
  });

  it("터치 타깃은 theme.touchTarget을 쓴다 — 새 치수를 만들지 않는다", async () => {
    const uiSource = source("src/ui.tsx");
    const { theme } = await import("./theme");
    expect(uiSource).toContain("height: theme.touchTarget");
    expect(uiSource).toContain("width: theme.touchTarget");
    // DSN-053 P1: 승인 캡처의 최소 터치 타깃은 48dp다(44는 Round 5A에서 낮춘 값).
    // 이 테스트가 지키는 요지는 "화면이 44/48 같은 숫자를 직접 적지 않고 토큰을 쓴다"이므로
    // 값만 갱신한다 — 48은 44보다 크므로 접근성 하한은 그대로 지켜진다.
    expect(theme.touchTarget).toBe(48);
  });
});

describe("라운드 93 A ⓐ 모집단 — app/ 라우트를 걷어서 파생한다 (손 목록 금지)", () => {
  it(`${SWEEP_SCOPE_LABEL}만 걷고, 레이아웃·탭 루트·한 줄 재수출을 파생으로 갈라낸다`, () => {
    // 유령 방지 — 걷기가 0건이면 아래 모든 판정이 조용히 초록이 된다.
    expect(ledger.allTsx.length, "app/ 트리를 실제로 걸었는가").toBeGreaterThanOrEqual(LOWER_BOUNDS.routes);
    expect(ledger.allTsx.every((file) => file.startsWith("app/"))).toBe(true);

    // `_` 레이아웃은 라우트가 아니다(오늘 app/_layout.tsx · app/(tabs)/_layout.tsx 둘).
    expect(ledger.layouts.length).toBeGreaterThanOrEqual(2);
    expect(ledger.routes.length).toBeGreaterThanOrEqual(LOWER_BOUNDS.routes);
    expect(ledger.routes.length + ledger.layouts.length).toBe(ledger.allTsx.length);

    expect(ledger.tabRoutes.length).toBeGreaterThanOrEqual(5);
    expect(ledger.outsideTabs.length).toBeGreaterThanOrEqual(LOWER_BOUNDS.outsideTabs);
    expect(ledger.outsideTabs.length + ledger.tabRoutes.length).toBe(ledger.routes.length);
  });

  it("한 줄 재수출 라우트는 화면이 아니다 — 소스에서 갈라내고 이중 계수를 막는다", () => {
    expect(ledger.reExports.length).toBeGreaterThanOrEqual(LOWER_BOUNDS.reExports);
    for (const file of ledger.reExports) {
      const raw = source(file);
      expect(isOneLineReExport(raw), `${file}는 한 줄 재수출이어야 한다`).toBe(true);
      // 그 별칭이 가리키는 실제 화면은 모집단 안에 따로 서 있다.
      const target = /from "\.\.\/(\([a-z]+\)\/[a-z-]+)"/.exec(raw.trim());
      expect(target, `${file}의 재수출 대상 경로를 읽어야 한다`).not.toBeNull();
      expect(ledger.outsideTabs).toContain(`app/${target?.[1]}.tsx`);
    }
    // 재수출은 판정 모집단 밖이다.
    expect(names(ledger.screens).filter((file) => ledger.reExports.includes(file))).toHaveLength(0);
  });
});

describe("라운드 93 A ⓑ 판정 — 탭 밖 화면마다 정확히 하나", () => {
  it("판정이 빠짐없이 정확히 하나씩 붙는다 (넷의 합이 모집단이다)", () => {
    const sum =
      ledger.backWired.length +
      ledger.noBackByDesign.length +
      ledger.withoutExit.length +
      ledger.noScreenHeader.length;
    // 구조적 등호 — 판정 넷이 모집단을 **덮는다**는 뜻이지 특정 수를 못 박는 것이 아니다
    // (각 갈래의 수는 아래에서 하한·상한으로 따로 문다).
    expect(sum).toBe(ledger.screens.length);
    expect(ledger.screens.length).toBeGreaterThanOrEqual(LOWER_BOUNDS.outsideTabs - LOWER_BOUNDS.reExports);
    expect(ledger.screens.length + ledger.reExports.length).toBe(ledger.outsideTabs.length);
  });

  it(`ⓔ 배선한 자리는 ${LOWER_BOUNDS.backWired} 아래로 내려가지 않고, 열둘이 한 관례를 쓴다`, () => {
    // 라운드 55까지의 손 목록 열하나 → 라운드 93 A가 하나를 더해 열둘. 하한은 내려가지 않는다.
    expect(LOWER_BOUNDS.backWired).toBeGreaterThan(ROUND_55_HAND_LIST_SIZE);
    expect(ledger.backWired.length, `배선한 자리: ${names(ledger.backWired).join(", ")}`).toBeGreaterThanOrEqual(
      LOWER_BOUNDS.backWired
    );
    for (const entry of ledger.backWired) {
      expect(entry.raw, `${entry.file}는 expo-router를 읽는다`).toContain('from "expo-router"');
      const wiredTags = entry.headerTags.filter((tag) => tag.full.includes("onBack"));
      expect(wiredTags.length, `${entry.file}에 onBack을 진 ScreenHeader가 있어야 한다`).toBeGreaterThan(0);
      for (const tag of wiredTags) {
        // 화면마다 다른 뒤로가기를 만들지 않는다 — 열둘이 같은 한 줄이다.
        expect(tag.full, `${entry.file}의 ScreenHeader가 ${BACK_WIRING} 관례를 쓴다`).toContain(BACK_WIRING);
      }
    }
  });

  it(`ⓑ 뒤로가기가 없는 것이 판단인 자리 ${LOWER_BOUNDS.noBackByDesign}곳은 이유를 값으로 지닌다`, () => {
    expect(ledger.noBackByDesign.length).toBeGreaterThanOrEqual(LOWER_BOUNDS.noBackByDesign);
    for (const entry of ledger.noBackByDesign) {
      const reason = NO_BACK_BY_DESIGN.find((row) => row.file === entry.file)?.reason ?? "";
      // 빈 알리바이를 길이로 막는다(사각 ⓓ가 이 자의 한계를 값으로 진다).
      expect(reason.length, `${entry.file}의 이유는 40자를 넘어야 한다`).toBeGreaterThan(40);
      // 소스 증인 — 그 파일 어디에도 router.back()이 없다(뒤로가기가 그 화면의 길이 아니다).
      expect(entry.raw.includes(NO_BACK_SOURCE_WITNESS), `${entry.file}에는 router.back()이 0건이다`).toBe(false);
      expect(entry.headerTags.length, `${entry.file}는 ScreenHeader를 쓴다`).toBeGreaterThan(0);
    }
    // 표에 적힌 이름이 모집단 밖으로 새지 않는다(면제만 남고 자리가 사라진 상태를 막는다).
    for (const row of NO_BACK_BY_DESIGN) {
      expect(names(ledger.screens), `${row.file}가 모집단 안에 있어야 한다`).toContain(row.file);
    }
  });

  it("ⓑ ⚠️ 스택인데 나가는 길이 없는 화면은 0건이다 (0을 상한으로 문다)", () => {
    // ⚠️⚠️ 라운드 55까지 이 파일이 손 목록 위에 적었던 그 문장 — *"스택으로만 도달하는 화면 중
    // 나가는 길이 없는 곳은 이제 없다"* — 이 이제 **파생 모집단 위에서** 참이다.
    expect(names(ledger.withoutExit), "나가는 길이 없는 스택 화면").toHaveLength(0);
  });

  it("탭 루트는 onBack을 지지 않는다 — 탭이 나가는 길이고 픽셀락 캡처가 지나간다", () => {
    const tabsWithHeader = ledger.tabEntries.filter((entry) => entry.headerTags.length > 0);
    expect(tabsWithHeader.length, `탭 루트의 ScreenHeader: ${names(tabsWithHeader).join(", ")}`).toBeGreaterThanOrEqual(
      LOWER_BOUNDS.tabRootsWithHeader
    );
    for (const entry of ledger.tabEntries) {
      for (const tag of entry.headerTags) {
        expect(tag.full, `${entry.file}의 ScreenHeader에는 onBack이 붙지 않는다`).not.toContain("onBack");
      }
    }
  });
});

describe("라운드 93 A ⓒ 오늘 고치는 그 하나 — app/sync-status.tsx", () => {
  it(`${TRACK_A_FIXED_SCREEN}가 판정 첫째(back-wired)로 떨어진다`, () => {
    expect(names(ledger.screens), "모집단 안에 있어야 한다").toContain(TRACK_A_FIXED_SCREEN);
    expect(names(ledger.backWired)).toContain(TRACK_A_FIXED_SCREEN);
    expect(names(ledger.withoutExit)).not.toContain(TRACK_A_FIXED_SCREEN);
    // 이 화면은 면제 표에 없다 — 뒤로가기가 없는 것이 판단인 자리가 아니었다.
    expect(NO_BACK_BY_DESIGN.map((row) => row.file)).not.toContain(TRACK_A_FIXED_SCREEN);
  });

  it("빈 목록의 \"닫기\"는 그대로다 — 나가는 길을 고친 것이지 옮긴 것이 아니다", () => {
    const screen = source(TRACK_A_FIXED_SCREEN);
    const at = screen.indexOf("<EmptyStateCard");
    expect(at, "빈 상태 카드가 있어야 한다").toBeGreaterThan(-1);
    const end = screen.indexOf("/>", at);
    expect(end, "빈 상태 카드의 여는 태그가 닫혀야 한다").toBeGreaterThan(-1);
    const block = screen.slice(at, end + 2);
    expect(block).toContain('actionLabel="닫기"');
    expect(block).toContain("onPress={() => router.back()}");
  });
});

describe("라운드 93 A ⓓ 바이트 불변 — 새 속성 하나 말고는 아무것도 바뀌지 않았다", () => {
  it("onBack 한 줄을 벗기면 종전 헤더 바이트와 정확히 같다 (sha256 부정 단언)", () => {
    const screen = source(TRACK_A_FIXED_SCREEN);
    const tags = screenHeaderTags(screen);
    // ⚠️ 등호를 고른 자리 — 이동 의무: 이 화면이 ScreenHeader를 둘 이상 세우는 날(예: 섹션마다
    // 머리말을 두는 개편) 이 단언과 아래 바이트 대장은 **그 라운드의 손이 함께 옮긴다.**
    expect(tags.length, "sync-status의 ScreenHeader 여는 태그").toBe(1);
    const full = tags[0].full;
    expect(full).toContain(ADDED_ATTRIBUTE_LINE);
    const stripped = full.replace(ADDED_ATTRIBUTE_LINE, "");
    expect(stripped).toBe(STRIPPED_SYNC_STATUS_HEADER);
    expect(createHash("sha256").update(stripped, "utf8").digest("hex").substring(0, 12)).toBe(
      STRIPPED_SYNC_STATUS_HEADER_SHA12
    );
    // 붙은 것은 **한 자리**뿐이다 — 같은 줄이 두 번 들어가지 않았다.
    expect(full.split(BACK_WIRING).length - 1).toBe(1);
  });

  it("새 한국어 리터럴 0건 · 새 낭독 0건 — 라벨은 공용 슬롯이 이미 지닌 하나다", () => {
    const screen = source(TRACK_A_FIXED_SCREEN);
    expect(koreanLiteralCount(screen)).toBe(SYNC_STATUS_KOREAN_LITERALS);
    // 화면이 자기 뒤로가기 라벨을 짓지 않는다(‹ 글리프도 이 화면의 **코드**에는 없다).
    // ⚠️ 주석은 걷고 본다 — 이 트랙이 그 자리에 남긴 근거 문단이 ‹를 인용하기 때문이다.
    const code = maskComments(screen);
    expect(code).not.toContain('accessibilityLabel="뒤로가기"');
    expect(code).not.toContain("‹");
    expect(screenHeaderBlock()).toContain('accessibilityLabel="뒤로가기"');
  });

  it("ScreenHeader 구현(src/ui.tsx)은 이 트랙이 건드리지 않았다 — 슬롯은 종전 그대로다", () => {
    const block = screenHeaderBlock();
    expect(block).toContain("onBack?: () => void");
    expect(block).toContain("{onBack ? (");
    // 이 트랙이 슬롯을 새로 만들지 않았다는 뜻: 열둘이 **하나의** 슬롯을 나눠 쓴다.
    // ⚠️ 등호를 고른 자리 — 이동 의무: ScreenHeader가 뒤로가기 노드를 둘 이상 지니게 되는 날
    // (예: 오른쪽 닫기 버튼이 같은 라벨을 쓰게 되는 개편) 그 라운드의 손이 이 수를 함께 옮긴다.
    expect(block.split("accessibilityLabel=\"뒤로가기\"").length - 1).toBe(1);
  });
});

describe("라운드 93 A ⓕ 사각 — 이 계약이 못 보는 것을 값과 하한으로 적는다", () => {
  it("사각을 넷 이상 값으로 지니고, 저마다 이유와 재개 조건이 있다 (AD-5)", () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(BLIND_SPOTS.map((spot) => spot.id));
    expect(ids.size).toBe(BLIND_SPOTS.length);
    for (const spot of BLIND_SPOTS) {
      expect(spot.reason.length, `${spot.id}의 이유는 40자를 넘어야 한다`).toBeGreaterThan(40);
      expect(spot.resumeCondition, `${spot.id}의 재개 조건`).toContain("재개 조건");
      expect(spot.resumeCondition.length).toBeGreaterThan(40);
      // ⚠️ 두 시점의 왼쪽 — 라운드 93까지의 손이 적은 수는 자리마다 그대로 남아 있다(AE-3).
      expect(Number.isInteger(spot.round93Constant), `${spot.id}의 옛 상수가 기록으로 남아야 한다`).toBe(true);
      // 자가 있거나 증거가 있거나 — **둘 다이거나 둘 다 아닌 자리는 없다.**
      const hasGauge = spot.measure !== undefined;
      expect(hasGauge, `${spot.id}: 자와 증거가 함께 서 있다`).not.toBe(spot.uncountable !== undefined);
      if (hasGauge) {
        expect(spot.today, `${spot.id}: 자가 있으면 오늘의 값도 있어야 한다`).not.toBeUndefined();
        expect(spot.floor, `${spot.id}: 자가 있으면 하한도 있어야 한다`).not.toBeUndefined();
      }
    }
  });

  /**
   * ⚠️⚠️ **라운드 94 B가 집은 그 자리** — 트랙 D(`admin-load-error-copy.test.ts:678`)의
   * *"ⓕ 사각의 값이 오늘도 그대로다(유령 사각 금지)"* 와 **같은 꼴**이다. 자가 상수였을 때는 이
   * `it`을 쓸 수 없었다(상수를 상수와 맞대는 것뿐이므로).
   */
  it("ⓕ 자 — 사각의 자가 오늘 실제로 불려 수를 낸다 (measure: () => number · 결정형 #18)", () => {
    const gauged = BLIND_SPOTS.filter((spot) => spot.measure !== undefined);
    expect(gauged.length, "파생 자를 지닌 사각").toBeGreaterThanOrEqual(DECISION_18.round94.derivedMeasures);
    for (const spot of gauged) {
      const measured = spot.measure?.() ?? Number.NaN;
      expect(Number.isInteger(measured), `${spot.id}의 자가 수를 내지 않았다`).toBe(true);
      expect(measured, `${spot.id}: 오늘 다시 잰 값이 기록과 갈렸다`).toBe(spot.today);
      expect(measured, `${spot.id}의 오늘 값은 하한 위에 있다`).toBeGreaterThanOrEqual(spot.floor ?? 0);
    }
    // ⚠️ 두 시점이 오늘 갈리지 않았다는 사실도 값이다. 갈리는 날 고칠 곳은 `today`이지
    // `round93Constant`가 아니다(옛 수는 기록이라 지우지 않는다 · AE-3).
    const diverged = gauged.filter((spot) => spot.today !== spot.round93Constant);
    expect(diverged.map((spot) => spot.id), "라운드 93의 상수와 오늘의 파생값이 갈린 자리").toEqual([]);
  });

  it("ⓕ 자 — 상수를 감싼 함수가 0건이다 (부정 단언 · 유령 자 금지)", () => {
    // ⚠️⚠️ 이 계약이 **스스로** 막는 자리다. 자를 함수로 옮겨도 그 함수가 수를 그 자리에 박아
    // 돌려주면 병은 그대로이므로(라운드 93 리뷰 L-6의 *"자는 진짜 자여야 한다"*), 이 파일의
    // 소스에서 그 꼴을 센다. 주석은 걷고 본다 — 위 머리말이 그 꼴을 인용하기 때문이다.
    //
    // ⚠️ 여기서 `maskComments`를 쓰지 않는 이유를 값으로 적는다: 이 파일 자신에는 따옴표가
    // **홀수로** 든 정규식이 있어(`isOneLineReExport`) 그 마스커의 상태가 문자열 안에서 풀리지
    // 않는다 — 그 자는 화면 소스를 보라고 지은 것이고, **자기 계약 파일은 그 자의 사각**이다.
    // 그래서 여기서는 줄 단위로 주석을 가른다. 코드 줄 **끝**에 붙은 주석은 이 바늘 안에 남고,
    // 오차의 방향은 거짓 빨강(안전)이다.
    const lines = source("src/screen-header-back.test.ts")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"));
    const constantArrows = lines.filter((line) => /=>\s*-?\d/.test(line));
    const constantReturns = lines.filter((line) => /\breturn\s+-?\d/.test(line));
    expect([...constantArrows, ...constantReturns], "수를 박아 돌려주는 자").toEqual([]);
    // 유령 방지의 유령 방지 — 이 부정 단언이 빈 문자열 위에 서 있지 않고, 바늘이 실제로 문다.
    expect(lines.length, "이 계약 파일을 실제로 읽었는가").toBeGreaterThan(100);
    // ⚠️ 가짜 자는 조각으로 잇는다 — 통짜로 적으면 이 자가 **자기 자신**을 물어 늘 빨개진다.
    const fakeGauge = ["measure: () =", "> 8"].join("");
    expect(/=>\s*-?\d/.test(fakeGauge), "이 바늘이 상수를 감싼 자를 실제로 문다").toBe(true);
  });

  it("결정형 #18의 발동 기록이 오늘의 사각에서 다시 세어진다 (두 시점)", () => {
    expect(DECISION_18.raisedBy).toContain("L-3");
    expect(DECISION_18.pickedUpBy).toContain("라운드 94");
    // 시점 ① — 옛 상수는 자리마다 그대로 남아 있다(여섯 다).
    expect(BLIND_SPOTS.length).toBe(DECISION_18.round93.spots);
    expect(BLIND_SPOTS.filter((spot) => Number.isInteger(spot.round93Constant)).length).toBe(
      DECISION_18.round93.constantMeasures
    );
    // 시점 ② — 오늘의 꼴을 기록이 아니라 **배열에서 다시 센다.**
    expect(BLIND_SPOTS.length).toBe(DECISION_18.round94.spots);
    expect(BLIND_SPOTS.filter((spot) => spot.measure !== undefined).length).toBe(
      DECISION_18.round94.derivedMeasures
    );
    expect(BLIND_SPOTS.filter((spot) => spot.uncountable !== undefined).length).toBe(
      DECISION_18.round94.withoutMeasure
    );
    // 소진된 결정형도 다시 열릴 조건을 진다 — 형을 밝혀 적는다.
    expect(DECISION_18.reopenCondition).toMatch(/재개 조건\((사건형|결정형)/);
    expect(DECISION_18.reopenCondition.length).toBeGreaterThan(40);
    // 꼴은 발명이 아니라 인용이다 — 그 파일은 이 트랙이 **읽기만** 했고(바이트 불변) 실재한다.
    // ⚠️ 이동 의무: 이 단언은 **다른 파일의 꼴**을 문다. 그 계약이 자기 사각의 자를 다른 꼴로
    // 옮기는 라운드가 이 줄을 함께 옮긴다 — 그때 빨개지는 것이 옳다(꼴을 인용했다는 이 파일의
    // 문장이 그 순간 거짓이 되기 때문이다). 무는 것은 **꼴 한 줄**이지 그 파일의 수가 아니다.
    const quoted = readFileSync(join(mobileRoot, "..", "admin", "src", "admin-load-error-copy.test.ts"), "utf8");
    expect(quoted, "인용한 본보기가 그 꼴을 지닌다").toContain("measure: () => number");
    expect(DECISION_18.quotedShapeFrom).toContain("admin-load-error-copy.test.ts");
  });

  it("사각 ⓐ — ScreenHeader를 쓰지 않는 탭 밖 화면 여덟은 이 바늘 밖이고, 그중 넷이 다른 자리에서 router.back()을 쓴다", () => {
    const spot = BLIND_SPOTS.find((row) => row.id === "screens-without-screen-header-are-outside-this-needle");
    expect(spot, "사각 ⓐ가 값으로 있어야 한다").toBeDefined();
    expect(ledger.noScreenHeader.length, `바늘 밖: ${names(ledger.noScreenHeader).join(", ")}`).toBeGreaterThanOrEqual(
      LOWER_BOUNDS.noScreenHeader
    );
    // ⚠️ 자가 파생이 된 뒤로 *자와 파생값을 맞대는 것*은 뜻이 없다(같은 수다). 이 자리가 무는 것은
    // **그 파생이 하한 아래로 내려가지 않는다**는 래칫이다.
    expect(spot?.measure?.()).toBeGreaterThanOrEqual(LOWER_BOUNDS.noScreenHeader);
    const withRouterBack = ledger.noScreenHeader.filter((entry) => entry.raw.includes(NO_BACK_SOURCE_WITNESS));
    // 하한이다 — 그 넷의 나가는 길을 이 계약이 센 것이 아니라 **못 셌다는 사실**을 값으로 적는다.
    expect(withRouterBack.length, `router.back()을 쓰는 자리: ${names(withRouterBack).join(", ")}`).toBeGreaterThanOrEqual(4);
  });

  it("파생이 불가능한 둘은 자를 두지 않고, 불가의 **증거**와 소스 증인을 진다 (라운드 94 B)", () => {
    const uncountable = BLIND_SPOTS.filter((spot) => spot.uncountable !== undefined);
    expect(uncountable.map((spot) => spot.id)).toEqual([
      "hardware-back-and-swipe-are-not-seen",
      "source-not-runtime"
    ]);
    for (const spot of uncountable) {
      const evidence = spot.uncountable;
      // ⚠️⚠️ `() => 0`은 다시 상수다 — 그래서 이 둘에는 자가 **없다.**
      expect(spot.measure, `${spot.id}: 셀 수 없는 자리에 자가 서 있다`).toBeUndefined();
      // 불가는 문장이 아니라 증거다 — 무엇을 세려 했고 어떤 정보가 소스에 없는가.
      expect(evidence?.wantedToCount.length, `${spot.id}: 무엇을 세려 했는가`).toBeGreaterThan(40);
      expect(evidence?.missingFromSource.length, `${spot.id}: 소스에 없는 것이 무엇인가`).toBeGreaterThan(40);
      expect(evidence?.zeroMeans, `${spot.id}: 0의 뜻`).toContain("셀 수 없다");
      // 증인은 상수가 아니라 파생이고, 유령이 아니다.
      expect(evidence?.witnesses.length, `${spot.id}: 증인이 있어야 한다`).toBeGreaterThan(0);
      for (const witness of evidence?.witnesses ?? []) {
        const population = witness.population();
        expect(population, `${witness.label}: 아무것도 보지 않았다`).toBeGreaterThan(0);
        const counted = witness.count();
        expect(Number.isInteger(counted), `${witness.label}: 수를 내지 않았다`).toBe(true);
        if (witness.bound === "atMost") {
          expect(counted, `${witness.label}: 오늘의 값을 넘었다`).toBeLessThanOrEqual(witness.today);
        } else {
          expect(counted, `${witness.label}: 증인이 사라졌다`).toBeGreaterThanOrEqual(witness.today);
        }
      }
      // 재개 조건은 그대로 산다 — 자가 없다고 조건까지 없는 것이 아니다.
      expect(spot.resumeCondition).toContain("재개 조건");
    }
  });

  it("사각 ⓑ — 하드웨어 뒤로가기는 셀 수 없고, 그 사실을 증인 셋이 값으로 든다", () => {
    const spot = BLIND_SPOTS.find((row) => row.id === "hardware-back-and-swipe-are-not-seen");
    expect(spot, "사각 ⓑ가 값으로 있어야 한다").toBeDefined();
    // 판정 모집단 안에서는 오늘도 0건이다(이 사실 자체는 그대로 문다).
    const intercepting = ledger.screens.filter((entry) => entry.raw.includes("BackHandler"));
    expect(names(intercepting), "BackHandler를 쓰는 탭 밖 화면").toHaveLength(0);
    // ⚠️⚠️ 그리고 그 0이 *없다*가 아니라는 증거 — 같은 바늘이 이 스윕 **밖**에서는 자리를 낸다.
    const outsideSweep = filesContaining("src", "BackHandler");
    expect(outsideSweep.length, `스윕 밖의 가로채기: ${outsideSweep.join(", ")}`).toBeGreaterThanOrEqual(1);
    expect(outsideSweep.every((file) => !file.startsWith("app/")), "그 자리는 app/** 밖이다").toBe(true);
    expect(spot?.uncountable?.zeroMeans, "0의 뜻이 값으로 적혀 있다").toContain("볼 수 있는 곳에 없다");
  });

  it("사각 ⓒ — 소스 대조이지 런타임이 아니다 (렌더 하네스의 **부류 전수**를 센다 · AH-1 정합)", () => {
    const spot = BLIND_SPOTS.find((row) => row.id === "source-not-runtime");
    expect(spot, "사각 ⓒ가 값으로 있어야 한다").toBeDefined();
    expect(spot?.reason).toContain("실기기");
    expect(spot?.resumeCondition).toContain("실기기 확인");
    // ⚠️⚠️ **AH-1의 병(주석 대 자)을 여기서 닫는다** — 이유가 *"렌더하지도 탐색하지도 않는다"* 라고
    // 부류 전체를 말하므로, 자도 이름 하나가 아니라 **부류의 전수**여야 한다.
    expect(RENDER_HARNESS_NEEDLES.length, "부류가 이름 하나로 좁혀져 있다").toBeGreaterThan(1);
    const self = source("src/screen-header-back.test.ts");
    const present = RENDER_HARNESS_NEEDLES.filter((needle) => self.includes(needle));
    expect(present, "이 계약은 화면을 렌더하지 않는다").toEqual([]);
    // 그리고 그 바늘이 유령이 아니다 — 조각으로 이어 붙였을 뿐 실제 이름을 짓는다.
    expect(RENDER_HARNESS_NEEDLES).toContain(["@testing-", "library/react-", "native"].join(""));
  });

  it("사각 ⓓ — 판정 둘째의 이유 수는 그 자리 수와 같다(면제만 남은 줄이 없다)", () => {
    expect(NO_BACK_BY_DESIGN.length).toBe(ledger.noBackByDesign.length);
    const files = new Set(NO_BACK_BY_DESIGN.map((row) => row.file));
    expect(files.size).toBe(NO_BACK_BY_DESIGN.length);
    // ⚠️ L-3의 규율은 자가 파생이 된 뒤에도 남는다 — 여기서 맞대는 것은 **손이 적은 표의 크기**와
    // **트리를 걸어 낸 수**다(둘 다 상수였던 종전에는 이 대조가 자와 자의 대조였다).
    const spot = BLIND_SPOTS.find((row) => row.id === "second-verdict-reason-is-hand-written-prose");
    expect(spot, "사각 ⓓ가 값으로 있어야 한다").toBeDefined();
    expect(spot?.measure?.(), "손이 적은 이유의 수 = 판정 둘째의 **파생된** 자리 수").toBe(NO_BACK_BY_DESIGN.length);
    expect(spot?.measure?.()).toBeGreaterThanOrEqual(LOWER_BOUNDS.noBackByDesign);
  });

  it("사각 ⓕ — 바늘이 `.tsx`로 좁혀져 있고, 오늘 그 실피해가 0이다 (L-5)", () => {
    const spot = BLIND_SPOTS.find((row) => row.id === "extension-narrowed-to-tsx");
    expect(spot, "사각 ⓕ가 값으로 있어야 한다").toBeDefined();
    const missed = listAppNonTsxSourceFiles();
    expect(spot?.measure?.(), `바늘이 지나치는 .ts: ${missed.join(", ")}`).toBe(missed.length);
    // ⚠️ 이 0은 **걷어서 낸 0**이다(위 두 사각의 *셀 수 없다*와 한 낱말로 적지 않는다).
    expect(missed, "오늘 이 좁힘이 잃는 자리").toEqual([]);
    // 그리고 그 걷기가 유령이 아니다 — 같은 트리에서 `.tsx`는 실제로 나온다.
    expect(ledger.allTsx.length).toBeGreaterThan(0);
  });

  it("사각 ⓔ — 한 줄 재수출 다섯의 자가 트리에서 다시 세어진다 (L-3 → 라운드 94 B)", () => {
    const spot = BLIND_SPOTS.find((row) => row.id === "one-line-re-export-routes-are-not-screens");
    expect(spot, "사각 ⓔ가 값으로 있어야 한다").toBeDefined();
    // ⚠️⚠️ **여기가 L-3이 지목한 자리다** — 종전에는 이 5가 손이 적은 상수라 `it` 쪽에서 파생값과
    // 맞대야 했고(그것이 L-3의 임시안이었다), 오늘은 **자 자체가 그 파생**이다. 그래서 이 자리가
    // 무는 것은 등호가 아니라 **래칫**이다: 재수출이 하나라도 줄면 갈라내기가 조용해진 것이다.
    expect(spot?.measure?.(), "사각이 든 수 = `app/` 트리에서 파생한 한 줄 재수출 라우트 수").toBe(
      ledger.reExports.length
    );
    expect(spot?.measure?.()).toBeGreaterThanOrEqual(LOWER_BOUNDS.reExports);
    // 그리고 그 파생이 유령이 아니다 — 다섯이 다 실재하고 전부 판정 모집단 밖이다.
    expect(names(ledger.screens).filter((file) => ledger.reExports.includes(file))).toHaveLength(0);
  });
});
