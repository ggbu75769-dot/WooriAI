/**
 * UX-G 첫 10분 — 홈의 "다음 한 걸음" 안내 카드.
 *
 * 온보딩을 막 끝낸 사용자가 홈에서 처음 보는 것은 `0원`짜리 히어로와 "이번 주 지출은 아직
 * 없어요"라는 서술뿐이었다. 둘 다 **사실이지만 행동이 아니다**. 이 모듈은 그 자리에 놓을
 * 카드 하나를 고른다.
 *
 * ## 왜 카드가 "하나"인가 (DNC-002)
 * 핵심 루프는 `지출 기록 → 총액 확인 → 준비템 확인 → 구매 링크 → 구매 후 기록`이다. 첫인상
 * 유도는 그 루프의 **1단계(지출 기록)** 와 **3단계(준비템 확인)** 로만 간다. 그리고 두 안내를
 * 동시에 띄우지 않는다 — 빈 홈에 CTA를 두 개 세우면 "어디부터?"라는 질문이 하나 더 생겨서
 * 루프가 오히려 흐려진다. 그래서 이 함수는 배열이 아니라 **단일 값 또는 null**을 돌려준다.
 *
 *   기록이 하나도 없다 → 1단계로 (`first-expense`)
 *   기록이 생겼고 준비템 안내를 아직 안 봤다 → 3단계로 (`first-items`)
 *   그 외 → null (평소의 홈)
 *
 * ## 왜 "몇 개"를 서버 추천 수로 세는가 (허위 데이터 금지)
 * `first-items`의 개수는 `/home` 응답의 `recommendedItems.length`다. 이 값은 서버가 이 아이의
 * 지금 시기에 맞춰 **실제로 골라준 항목 수**(최대 3, apps/api/src/onboarding/
 * reporting-store.service.ts의 `recommendedItems.slice(0, 3)`)라, 홈이 이미 들고 있는 응답만으로
 * 참인 문장을 만들 수 있다. 준비템 탭의 시기별 준비율 캐시(`["items", childId, "prep-progress"]`)는
 * **탭에 한 번도 들어가지 않은 첫 사용자에게는 비어 있어서**, 그 캐시로 개수를 말하려면 홈이
 * 요청을 하나 더 쏘거나(첫 진입 비용 증가) 없는 숫자를 지어내야 한다. 그래서 쓰지 않는다.
 * 개수를 모르는 경우(추천 0개)에는 카드를 아예 만들지 않는다 — "0개를 확인해 보세요"는 정보가
 * 아니다.
 *
 * ## 톤 (DNC-018)
 * 해요체, 짧은 문장, 비난·재촉 없음. "아직 아무것도 안 하셨네요" 대신 다음 한 걸음과 그 걸음이
 * 얼마나 가벼운지(10초)만 말한다.
 */

export type HomeFirstRunGuideVariant = "first-expense" | "first-items";

export type HomeFirstRunGuide = {
  variant: HomeFirstRunGuideVariant;
  title: string;
  subtitle: string;
  /** 카드 안 큰 버튼의 라벨. */
  ctaLabel: string;
  /** expo-router 경로 — 루프 1단계(지출 입력) 또는 3단계(준비템 탭)로만 간다. */
  route: "/expenses/new" | "/(tabs)/items";
  /** 카드를 닫을 수 있는지. 빈 홈의 첫 기록 유도는 닫을 대상이 아니다(기록이 생기면 사라진다). */
  dismissible: boolean;
  testID: string;
  /** TalkBack이 카드 전체를 한 덩어리로 읽을 문장. */
  accessibilityLabel: string;
};

export type HomeFirstRunGuideInput = {
  /** 로그인 + 아이 선택이 끝난 실제 세션인지. 비세션 미리보기에서는 항상 null을 돌려준다. */
  hasSession: boolean;
  /**
   * 이 아이에게 지출 기록이 하나라도 있는지. **아직 모르면 null**(홈 응답 로딩/실패) —
   * 그때는 카드를 만들지 않는다. 모르는 상태에 "첫 지출을 기록해 보세요"를 띄우면 이미
   * 수십 건을 기록한 사용자에게 없는 사실을 말하게 된다.
   */
  hasAnyExpenseRecord: boolean | null;
  /** `/home` 응답의 `recommendedItems.length`(서버가 고른 지금 시기 준비물 수, 최대 3). */
  recommendedItemCount: number;
  /** 준비템 안내 카드를 이미 닫았는지(기기에 남는 1회성 플래그). */
  itemsGuideDismissed: boolean;
};

export const FIRST_EXPENSE_GUIDE_TEST_ID = "home-first-expense-guide";
export const FIRST_ITEMS_GUIDE_TEST_ID = "home-items-guide";
/** 준비템 안내 카드의 닫기 버튼 라벨 — 준비템 탭의 축하 배너와 같은 말을 쓴다. */
export const FIRST_ITEMS_GUIDE_DISMISS_LABEL = "닫기";

function firstExpenseGuide(): HomeFirstRunGuide {
  const title = "첫 지출을 기록해 보세요";
  const subtitle = "10초면 돼요. 기록하면 이번 달 총액이 여기 쌓여요.";
  return {
    variant: "first-expense",
    title,
    subtitle,
    ctaLabel: "지출 기록하기",
    route: "/expenses/new",
    dismissible: false,
    testID: FIRST_EXPENSE_GUIDE_TEST_ID,
    accessibilityLabel: `${title}. ${subtitle}`
  };
}

function firstItemsGuide(count: number): HomeFirstRunGuide {
  const title = `지금 시기 준비물 ${count}개를 골라뒀어요`;
  const subtitle = "준비템 탭에서 확인하고 준비한 것만 체크해 보세요.";
  return {
    variant: "first-items",
    title,
    subtitle,
    ctaLabel: "준비물 확인하기",
    route: "/(tabs)/items",
    dismissible: true,
    testID: FIRST_ITEMS_GUIDE_TEST_ID,
    accessibilityLabel: `${title}. ${subtitle}`
  };
}

/** 홈에 띄울 첫 실행 안내 카드 하나를 고른다. 띄울 것이 없으면 null. */
export function evaluateHomeFirstRunGuide(input: HomeFirstRunGuideInput): HomeFirstRunGuide | null {
  if (!input.hasSession) return null;
  if (input.hasAnyExpenseRecord === null) return null;

  if (!input.hasAnyExpenseRecord) return firstExpenseGuide();

  if (input.itemsGuideDismissed) return null;
  const count = Number.isInteger(input.recommendedItemCount) ? input.recommendedItemCount : 0;
  if (count <= 0) return null;
  return firstItemsGuide(count);
}

/** `LocalExpenseRow`에서 이 판정에 필요한 두 필드만 (src/offline/types.ts와 구조 호환). */
export type OfflineExpenseRowLike = {
  canonicalId: string | null;
  pendingDelete: boolean;
};

/**
 * 아직 서버에 올라가지 않은 **로컬 신규 기록**이 있는지.
 *
 * 첫 기록을 오프라인(혹은 동기화 지연 중)으로 남기면 `/home`의 `recentExpenses`는 여전히
 * 비어 있다. 그 값만 보고 판단하면 방금 기록을 남긴 사용자에게 홈이 "첫 지출을 기록해
 * 보세요"라고 말한다 — 주간 요약 카드가 같은 이유로 오프라인 대기 행을 합산하는 것과
 * 같은 규칙이다(src/home/weekly-summary.ts 라운드 33 F6 주석).
 *
 * `canonicalId === null`이 "서버가 아직 모르는 신규 행"이고, 삭제 대기 중인 행은 곧 사라질
 * 기록이므로 세지 않는다.
 */
export function hasPendingOfflineCreate(rows: readonly OfflineExpenseRowLike[]): boolean {
  return rows.some((row) => row.canonicalId === null && !row.pendingDelete);
}
