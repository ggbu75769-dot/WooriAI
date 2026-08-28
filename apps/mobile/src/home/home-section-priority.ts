/**
 * DSN-053 P2-A — 홈 "카드 다이어트"의 우선순위 판정.
 *
 * 승인 캡처(c20deeb `app/(tabs)/index.tsx` 픽셀 103-215)의 홈은 **히어로 1장 + 구획 3개**다:
 * 히어로 → "자주 기록해요" 칩 → 준비 현황 카드 → 최근 기록. 그런데 현재 세션 홈은 그 사이에
 * 카드를 최대 8장까지 세울 수 있다(예산 경고 · 첫 실행 안내 · 첫 기록 축하 · 마일스톤 · 주간
 * 요약 · 예산 넛지 · 지난달 대비 · 누적 총액). 전부 각자 참인 말이지만, 한 화면에 동시에
 * 서면 어느 것도 읽히지 않는다.
 *
 * **기능을 지우지 않는다**: 판정 훅·데이터·알림 평가는 종전 그대로 전부 돈다. 이 모듈이 정하는
 * 것은 "그중 몇 장을 지금 펼쳐 두는가"뿐이고, 나머지는 같은 화면의 "더 보기"로 접힌다 --
 * 사용자가 한 번 누르면 예전과 똑같은 카드가 같은 순서로 나온다.
 *
 * 왜 순수 모듈인가 — 화면에서 `{a ? ... : b ? ... : null}`로 짜면 "무엇이 무엇보다 중요한가"가
 * JSX 중첩에 흩어져, 카드가 하나 늘 때마다 순서가 조용히 바뀐다. 순위를 **값**으로 적어 두면
 * 근거를 단위 테스트로 고정할 수 있다.
 *
 * 순위 근거(스펙 §홈 "세션 상한"):
 *  1. 예산 경고 — 이 화면에서 유일하게 **되돌릴 수 없는 사실**을 말한다(80/100% 도달).
 *  2. 첫 실행 안내 — 빈 홈에서 다음 한 걸음이 없으면 화면이 할 말을 잃는다(DNC-002 루프 1단계).
 *  3. 정기 지출 리마인더 — 라운드 55 트랙 C(설계 §1.5). 지금 행동하지 않으면 **이번 달 합계가
 *     실제와 어긋나는** 사실이라, 날짜 안내인 마일스톤보다 금전적 결과가 크다. 그래서 기존
 *     3~7위를 한 칸씩 뒤로 민다(설계 §6 위험 6: 마일스톤 카드가 한 칸 뒤로 가는 것은 사용자에게
 *     보이는 변화다).
 *  4. 마일스톤 임박 — 날짜가 정해 놓은 것이라 놓치면 그 시점이 지나간다.
 *  5. 주간 요약 — 이번 주의 사실. 지나가지는 않지만 호흡이 짧다.
 *  6. 예산 넛지(사용률) — 격려·확인 문구라 늦게 봐도 잃는 것이 없다.
 *  7. 지난달 대비 · 8. 누적 총액 — 리포트 탭이 같은 숫자를 더 자세히 말한다(위임 가능).
 *
 * 이 표에 없는 두 가지:
 *  - **구매 확인 카드**: 순위상으로는 예산 경고 다음이지만, 이 앱에서는 홈 구획이 아니라 전역
 *    오버레이가 그린다(app/_layout.tsx의 `PurchaseFollowupLifecycle`). 홈이 접거나 펼칠 수 있는
 *    대상이 아니라서 표에 넣지 않는다 -- 없는 분기를 "순위표에 있는 척" 남겨 두면 다음 사람이
 *    그 자리를 찾다가 시간을 버린다.
 *  - **첫 기록 축하 배너**: 한 세션에 한 번, 닫으면 끝나는 일시적 알림(accessibilityRole="alert")
 *    이라 히어로 바로 아래에 그대로 둔다(스펙의 "일시적 예외"와 같은 취급).
 */

export type HomeSectionId =
  | "budget-warning"
  | "first-run-guide"
  | "recurring-reminder"
  | "milestone"
  | "weekly-summary"
  | "budget-nudge"
  | "last-month"
  | "cumulative-total";

/** 낮을수록 먼저 펼친다. 위 헤더의 근거와 1:1로 대응한다. */
export const HOME_SECTION_RANK: Readonly<Record<HomeSectionId, number>> = {
  "budget-warning": 1,
  "first-run-guide": 2,
  "recurring-reminder": 3,
  milestone: 4,
  "weekly-summary": 5,
  "budget-nudge": 6,
  "last-month": 7,
  "cumulative-total": 8
};

/**
 * 히어로 아래에서 **접지 않고** 펼쳐 두는 카드 수의 상한.
 *
 * 캡처는 히어로 + 3구획(칩 · 준비 현황 · 최근 기록)이라, 그 사이에 끼울 수 있는 여유가 1~2장이다.
 * 2로 두면 "가장 중요한 사실 하나 + 그다음 하나"까지는 스크롤 없이 읽히고, 3장부터는 캡처의
 * 리듬이 무너진다.
 */
export const HOME_VISIBLE_SECTION_LIMIT = 2;

export type HomeSectionPlanEntry = {
  id: HomeSectionId;
  /** HOME_SECTION_RANK의 값 -- 판정 근거를 결과에도 실어 둔다(테스트·디버깅용). */
  rank: number;
  visible: boolean;
};

export type HomeSectionPlan = {
  /** 지금 펼쳐 두는 카드(순위 오름차순, 최대 limit장). */
  visible: readonly HomeSectionId[];
  /** "더 보기"를 눌러야 나오는 카드(순위 오름차순). */
  collapsed: readonly HomeSectionId[];
  /** 활성 카드 전체의 순위표. visible + collapsed와 같은 순서다. */
  entries: readonly HomeSectionPlanEntry[];
};

export type HomeSectionPlanInput = {
  /** 지금 실제로 그릴 값이 있는 카드들. 순서는 무시하고 순위표가 정한다. */
  active: readonly HomeSectionId[];
  /** 기본값 HOME_VISIBLE_SECTION_LIMIT. 0이면 전부 접힌다. */
  limit?: number;
};

/**
 * 활성 카드를 순위대로 줄 세워 "펼침 / 접힘"으로 가른다.
 *
 * 중복 id는 한 번만 센다(같은 카드를 두 자리에서 활성으로 넘겨도 순위가 흔들리지 않게).
 */
export function planHomeSections(input: HomeSectionPlanInput): HomeSectionPlan {
  const limit = Math.max(0, input.limit ?? HOME_VISIBLE_SECTION_LIMIT);
  const unique: HomeSectionId[] = [];
  for (const id of input.active) {
    if (!unique.includes(id)) unique.push(id);
  }
  const ordered = unique.slice().sort((left, right) => HOME_SECTION_RANK[left] - HOME_SECTION_RANK[right]);
  const entries = ordered.map((id, index) => ({ id, rank: HOME_SECTION_RANK[id], visible: index < limit }));
  return {
    visible: entries.filter((entry) => entry.visible).map((entry) => entry.id),
    collapsed: entries.filter((entry) => !entry.visible).map((entry) => entry.id),
    entries
  };
}

/** 접힌 카드를 펼치는 버튼 문구. 개수를 밝혀 "무엇이 숨어 있는지"를 감추지 않는다. */
export function homeMoreSectionsLabel(count: number): string {
  return `카드 ${count}개 더 보기`;
}

/** 펼친 뒤 다시 접는 버튼 문구. */
export const HOME_SECTIONS_COLLAPSE_LABEL = "카드 접기";

export const HOME_MORE_SECTIONS_TEST_ID = "home-more-sections-toggle";

// ---------------------------------------------------------------------------------------------
// 준비 현황 카드 — 같은 말을 두 번 하지 않기 위한 단일 판정
// ---------------------------------------------------------------------------------------------

/**
 * 캡처의 ④ "이번 주 준비 현황" 카드 자리는 **하나**인데, 현재 홈에는 그 자리를 노리는 말이
 * 셋이다:
 *  - 첫 실행 안내의 `first-items` 갈래("준비물 확인하기", 1회성 · 닫기 가능),
 *  - 준비템 넛지(`evaluateHomePrepNudge` — 지금 시기/관심 표시 준비템),
 *  - 그리고 캡처의 기본 문구("지금 필요한 준비템 N개").
 * 셋을 각자 카드로 세우면 홈이 준비템 이야기를 세 번 한다. 자리는 하나로 두고 **무엇을 말할지**
 * 만 여기서 고른다.
 *
 * 우선순위:
 *  1. 첫 실행 안내(`first-items`) — 1회성이고 닫을 수 있어 가장 먼저 지나가야 할 말이다.
 *  2. 준비템 넛지 — 이름·상태까지 아는 구체적인 말이라 기본 문구보다 정보가 많다.
 *  3. 기본 문구 — 위 둘이 없을 때, 아직 준비되지 않은 항목이 실제로 있을 때만.
 * 셋 다 해당 없으면 카드를 만들지 않는다(0개를 "0개"라고 말하려고 카드를 세우지 않는다).
 */
export const HOME_PREP_CARD_TITLE = "이번 주 준비 현황";
export const HOME_PREP_CARD_CTA_LABEL = "지금 필요한 준비템 보기";
export const HOME_PREP_CARD_ROUTE = "/(tabs)/items" as const;
export const HOME_PREP_CARD_TEST_ID = "home-prep-status-card";

export function homePrepCardSubtitle(count: number): string {
  return `지금 필요한 준비템 ${count}개`;
}

export type HomePrepCardSource = "first-run-guide" | "prep-nudge" | "recommended-count";

export type HomePrepCard = {
  source: HomePrepCardSource;
  title: string;
  subtitle: string;
  ctaLabel: string;
  route: typeof HOME_PREP_CARD_ROUTE;
  testID: string;
  /** 첫 실행 안내 갈래만 닫을 수 있다(그 카드가 원래 갖고 있던 성질). */
  dismissible: boolean;
  accessibilityLabel: string;
};

export type HomePrepCardGuideLike = {
  variant: "first-expense" | "first-items" | "view-only";
  title: string;
  subtitle: string;
  ctaLabel: string | null;
  testID: string;
  dismissible: boolean;
};

export type HomePrepCardNudgeLike = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  testID: string;
  accessibilityLabel: string;
};

export type HomePrepCardInput = {
  /** 비세션 미리보기(HOME-001 캡처 경로)는 이 카드를 만들지 않는다. */
  hasSession: boolean;
  firstRunGuide: HomePrepCardGuideLike | null | undefined;
  prepNudge: HomePrepCardNudgeLike | null | undefined;
  /** 아직 준비되지 않은 추천 준비템 수(`countUnpreparedRecommendedItems`). */
  unpreparedItemCount: number;
};

export function resolveHomePrepCard(input: HomePrepCardInput): HomePrepCard | null {
  if (!input.hasSession) return null;

  const guide = input.firstRunGuide;
  if (guide && guide.variant === "first-items" && guide.ctaLabel) {
    return {
      source: "first-run-guide",
      title: guide.title,
      subtitle: guide.subtitle,
      ctaLabel: guide.ctaLabel,
      route: HOME_PREP_CARD_ROUTE,
      testID: guide.testID,
      dismissible: guide.dismissible,
      accessibilityLabel: `${guide.title}. ${guide.subtitle}`
    };
  }

  const nudge = input.prepNudge;
  if (nudge) {
    return {
      source: "prep-nudge",
      title: nudge.title,
      subtitle: nudge.subtitle,
      ctaLabel: nudge.ctaLabel,
      route: HOME_PREP_CARD_ROUTE,
      testID: nudge.testID,
      dismissible: false,
      accessibilityLabel: nudge.accessibilityLabel
    };
  }

  if (input.unpreparedItemCount > 0) {
    const subtitle = homePrepCardSubtitle(input.unpreparedItemCount);
    return {
      source: "recommended-count",
      title: HOME_PREP_CARD_TITLE,
      subtitle,
      ctaLabel: HOME_PREP_CARD_CTA_LABEL,
      route: HOME_PREP_CARD_ROUTE,
      testID: HOME_PREP_CARD_TEST_ID,
      dismissible: false,
      accessibilityLabel: `${HOME_PREP_CARD_TITLE}. ${subtitle}`
    };
  }

  return null;
}
