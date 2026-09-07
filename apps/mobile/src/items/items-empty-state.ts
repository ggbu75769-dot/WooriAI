import { customItemEntryLabel } from "./custom-item-form";

/**
 * 준비템 탭(ITEM-001 세션 렌더)의 **0건 카드 판정** 단일 소스.
 *
 * ## 무엇이 문제였나 — 주 행동이 이 화면을 떠난다
 *
 * 이 화면의 0건 갈래는 셋이다(찜 0건 · 검색/필터 0건 · **전체 0건**). 앞의 둘은 각각 그 자리를
 * 실제로 푸는 행동을 준다(찜 칩 끄기 · 좁히기 초기화). 그런데 셋째(전체 0건)의 버튼은
 * `[홈으로 가기]`(홈 탭으로 나가는 push)였다 —
 *
 *  ⓐ 무슨 일이 있었는지는 말했고("아직 볼 수 있는 준비템이 없어요."),
 *  ⓑ 다음에 무엇을 하면 되는지는 말하지 않았으며,
 *  ⓒ 가장 큰 버튼이 **그 빈 상태를 풀지 못하는 곳**을 가리켰다.
 *
 * 홈으로 나가도 준비템은 생기지 않으므로, 다시 들어오면 같은 빈 화면을 만난다. 반면 이 빈
 * 상태를 실제로 푸는 행동은 **같은 스크롤 안 바로 아래**에 이미 서 있었다 — 라운드 100 T3의
 * 커스텀 품목 진입 버튼(`customItemEntryLabel()` → CustomItemSheet)이다. 서버 목록이 0건인
 * 아이에게 이 화면 안에서 준비템을 만들 수 있는 길은 그것 하나뿐이다.
 *
 * ## 이 모듈이 하는 일
 *
 * ① 세 갈래를 **하나의 판정**으로 접는다(`itemsListEmptyKind`). 종전에는 화면의 JSX 삼항이
 *    갈래를 정하고, 목록 아래 진입 버튼은 그 갈래를 모른 채 언제나 섰다 — 두 자리가 같은
 *    사실("지금 전체 0건인가")을 각자 판단하면 한쪽만 고쳐지는 날이 온다.
 * ② 전체 0건 카드의 **문구를 새로 짓지 않는다**(`buildItemsAllEmptyCard`). 제목은 종전
 *    그대로이고(관찰형 · DNC-018), 액션 라벨은 목록 아래 버튼이 이미 쓰는 그 한 값
 *    (`customItemEntryLabel()`)을 그대로 읽는다 — 같은 동작이 두 이름으로 낭독되지 않는다.
 * ③ 그래서 **입구가 화면에 하나만** 선다(`showsStandingCustomItemEntry`). 전체 0건일 때는
 *    카드가 그 입구를 지고, 목록이 서 있거나 좁히기 0건일 때는 종전대로 목록 아래 버튼이 진다.
 *    (좁히기 0건 카드의 행동은 "좁히기 풀기"라 커스텀 추가와 다른 일이다 — 그 갈래에서 아래
 *    버튼이 사라지면 추가 입구 자체가 화면에서 없어진다.)
 *
 * ⚠️ **ITEM-001 픽셀락 무접촉.** 캡처는 세션을 지우고 찍는 비세션 렌더이고(app/pixel-lock.tsx의
 * `clearSession()`), 그 갈래는 화면의 `if (!hasSession)` early return에서 `previewItems` 리터럴만
 * 그리고 먼저 반환한다 — 이 모듈이 닿는 JSX(PreparationListParity의 `emptyState`와 그 아래 진입
 * 버튼)는 그 반환 **뒤**에 있어 캡처가 도달하지 않는다(같은 전제를 items-tab-root-back.test.ts ·
 * custom-item-wiring.test.ts가 이미 값으로 붙들고 있다).
 *
 * ⚠️ **찜 0건·필터 0건 갈래는 한 글자도 바뀌지 않는다.** 이 모듈은 그 둘의 문구를 들고 있지
 * 않다 — 화면이 종전 리터럴을 그대로 그린다(design-restore-p2b.test.ts가 그 두 자리를 소스
 * 문자열로 고정하고 있다). 여기서 바뀐 것은 **어느 갈래인지를 누가 판단하는가**뿐이다.
 */
export type ItemsEmptyStateKind = "interested" | "filtered" | "all";

/** 전체 0건 카드가 제안하는 다음 행동 — 화면은 이 키로 무엇을 배선할지 정한다. */
export type ItemsAllEmptyAction = "add-custom-item";

export type ItemsAllEmptyCard = {
  /** 0건 카드 제목(종전 문구 그대로). */
  title: string;
  /** 기본 액션 버튼 라벨. 목록 아래 진입 버튼과 **같은 한 값**이다. */
  actionLabel: string;
  /** 그 버튼이 실제로 하는 일. */
  action: ItemsAllEmptyAction;
};

/**
 * 지금 목록이 비었다면 **어느 0건인가**. 목록이 비지 않았으면 null이다.
 *
 * 순서는 화면의 종전 삼항 그대로다(찜 → 좁히기 → 전체). 두 판정은 이미 서로 배타적이지만
 * (`showInterestedEmptyState = showInterestedOnly && !isNarrowedByFilter`), 그 사실에 기대지 않고
 * 순서를 지켜 종전 렌더와 갈래가 어긋나지 않게 한다.
 *
 * @param listedCount     화면이 그리려는 목록의 길이(`listedItems.length`).
 * @param interestedEmpty 찜 칩만 켜져 있어 비었는가(화면의 `showInterestedEmptyState`).
 * @param narrowedByFilter 검색/필수도/출산 전 칩이 걸려 있는가(화면의 `isNarrowedByFilter`).
 */
export function itemsListEmptyKind(input: {
  listedCount: number;
  interestedEmpty: boolean;
  narrowedByFilter: boolean;
}): ItemsEmptyStateKind | null {
  if (input.listedCount > 0) return null;
  if (input.interestedEmpty) return "interested";
  if (input.narrowedByFilter) return "filtered";
  return "all";
}

/**
 * 전체 0건 카드(제목 + 액션). 문구는 **둘 다 이미 있던 것**이다 — 제목은 이 자리의 종전 문장,
 * 라벨은 커스텀 품목 진입 버튼의 단일 소스(`custom-item-form.ts §9.6 확정값`)다.
 */
export function buildItemsAllEmptyCard(): ItemsAllEmptyCard {
  return {
    title: "아직 볼 수 있는 준비템이 없어요.",
    actionLabel: customItemEntryLabel(),
    action: "add-custom-item"
  };
}

/**
 * 목록 **아래**의 상시 진입 버튼을 세울 것인가.
 *
 * 전체 0건에서는 카드가 같은 라벨·같은 동작의 버튼을 이미 들고 있으므로 아래 버튼을 세우면
 * 같은 글자의 버튼 둘이 나란히 선다(낭독도 두 번이다). 그 한 갈래에서만 카드에 자리를 넘긴다.
 */
export function showsStandingCustomItemEntry(kind: ItemsEmptyStateKind | null): boolean {
  return kind !== "all";
}
