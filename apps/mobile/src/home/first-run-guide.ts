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
 * ## 왜 준비템 안내에 "신규 사용자" 게이트가 붙는가 (라운드 35 F6)
 * 위 규칙만으로는 `first-items`가 **기록이 하나라도 있는 모든 사용자**에게 뜬다 — 5년째 쓰는
 * 사용자가 앱을 새로 깔거나(플래그는 기기에 남는다) 캐시가 비워진 순간 "지금 시기 준비물
 * 3개를 골라뒀어요"라는 첫 실행 안내를 다시 받는다. 이 카드는 첫 10분용이므로 "막 시작한
 * 사람"으로 대상을 좁힌다:
 *
 *   - `recentRecordCount`(**이번 달**에 이 기기가 아는 기록 수 = 서버 캐시 + 오프라인 대기 행)가
 *     `FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS` 이하일 때만 띄운다. 가입 일자를 홈이 알 수 없으니
 *     (`/home`에 없다) **행동량으로 근사**한다. 모르면(null) 띄우지 않는다 — 모르는 상태에
 *     첫 실행 안내를 띄우는 쪽이 더 큰 오류다.
 *   - 라운드 36 F3: 그런데 그 근사는 **이번 달**만 본다. 1년째 쓰는 사용자도 매달 1~2일에는
 *     이번 달 기록이 0건이라, 매달 초 "지금 시기 준비물 N개를 골라뒀어요" 첫 실행 안내가
 *     되돌아왔다(달이 바뀌는 것은 사용자의 행동이 아닌데 안내가 그것에 반응했다). 그래서
 *     **전체 기간 신호**를 함께 요구한다: `serverRecentExpenseCount`(`/home`의 recentExpenses
 *     길이). 그 목록은 서버에서 LIMIT 3이라 길이가 3이면 "3건 이상"이라는 뜻일 뿐 총량을 모른다.
 *   - 라운드 37 G-6 → 38 H-5: 한때 이 게이트는 "서버 목록이 LIMIT(3)에 닿았어도 **그 3건이
 *     전부 이번 달 것이면** 막 시작한 사람"이라는 예외를 뒀다(`recentRecordCount >= 3`이면 통과).
 *     그런데 그 예외는 **8개월째 쓰는 사용자가 이번 달에 정확히 3건**을 기록한 상태와 구별되지
 *     않는다 — 서버 목록은 LIMIT 3이라 "3건 이상"까지만 말해 주고, 이번 달 3건이 그 3건과 같은
 *     것인지 알 방법이 없다. 구별할 수 없는 두 상태에 다른 화면을 주려던 것이 오류였다.
 *     그래서 예외를 없애고 **노출 상한을 2로 내린다**(`FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS`):
 *     이 카드의 목적은 기록 0~2건일 때의 초기 유도이고, 3건째부터는 이미 루프를 돌고 있는
 *     사람이라 첫 실행 안내가 방해가 된다. 상한이 LIMIT보다 **작아진** 덕분에 두 게이트가 더는
 *     같은 숫자에서 부딪히지 않는다 — 서버 목록이 LIMIT에 닿으면(총량을 모른다) 그냥 막는다.
 *   - 개수는 **아직 준비되지 않은 추천만** 센다(`countUnpreparedRecommendedItems`). 준비템 탭이
 *     "지금 시기 준비, 모두 마쳤어요"를 띄우는 아이에게 홈이 "준비물 3개를 골라뒀어요"라고
 *     말하면 두 화면이 서로를 부정한다. 0개면 카드를 만들지 않는다(위 규칙과 동일).
 *
 * ## 톤 (DNC-018)
 * 해요체, 짧은 문장, 비난·재촉 없음. "아직 아무것도 안 하셨네요" 대신 다음 한 걸음과 그 걸음이
 * 얼마나 가벼운지(10초)만 말한다.
 */

import type { ItemStatus } from "@wooriai/domain";
import { isResolvedItemStatus } from "../items/prep-progress";
import { SYNC_ROW_PENDING_LABEL } from "../offline/messages";

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
   *
   * 라운드 36 F2: 여기 들어오는 값은 **관찰값**이다(세션 이력 래치가 아니다). 래치된 값을
   * 넣으면 마지막 기록을 지운 뒤에도 계속 "기록이 있다"로 읽혀 첫 지출 유도 카드가 영영
   * 돌아오지 않는다 — 래치는 축하 배너 재발화 방지 전용이다(latchHasAnyExpenseRecord 주석).
   */
  hasAnyExpenseRecord: boolean | null;
  /**
   * `/home` 응답의 `recommendedItems` 중 **아직 준비되지 않은** 항목 수(최대 3).
   * `countUnpreparedRecommendedItems`가 세 준다 — 준비 완료된 항목까지 세면 준비템 탭의
   * "모두 마쳤어요" 축하와 정면으로 어긋난다(라운드 35 F6).
   */
  recommendedItemCount: number;
  /**
   * 이번 달에 이 기기가 아는 지출 기록 수(서버 캐시 + 오프라인 대기 행). 아직 모르면 null.
   * 준비템 첫 안내를 "막 시작한 사람"으로 좁히는 근사 게이트다(위 헤더 F6 참고).
   */
  recentRecordCount: number | null;
  /**
   * `/home` 응답 `recentExpenses`의 길이(서버 LIMIT 3). **전체 기간** 신호로만 쓴다 —
   * 라운드 36 F3의 "매달 초에 되돌아오는 첫 안내"를 막는 항이다. 3이면 그 이상일 수 있어
   * 총량을 모르므로 안내를 만들지 않는다. 모르면(null) 역시 만들지 않는다.
   */
  serverRecentExpenseCount: number | null;
  /** 준비템 안내 카드를 이미 닫았는지(기기에 남는 1회성 플래그). */
  itemsGuideDismissed: boolean;
};

export const FIRST_EXPENSE_GUIDE_TEST_ID = "home-first-expense-guide";
export const FIRST_ITEMS_GUIDE_TEST_ID = "home-items-guide";
/** 준비템 안내 카드의 닫기 버튼 라벨 — 준비템 탭의 축하 배너와 같은 말을 쓴다. */
export const FIRST_ITEMS_GUIDE_DISMISS_LABEL = "닫기";
/**
 * `/home`의 `recentExpenses`가 서버에서 잘리는 개수(apps/api/src/onboarding/
 * reporting-store.service.ts의 `slice(0, 3)`).
 *
 * 이 값이 "전체 기간 기록이 몇 건인지"를 홈이 **어디까지 알 수 있는지**의 경계다. 길이가 이
 * 값보다 작으면 그게 곧 전체 건수이고, 같으면 "이 이상"이라는 것만 안다. 라운드 36 F3의 게이트가
 * 후자를 "모른다"로 다루는 근거가 이 숫자다.
 */
export const HOME_RECENT_EXPENSES_LIMIT = 3;
/**
 * 준비템 첫 안내를 띄울 "이번 달 기록 수" 상한 — 즉 **기록 0~2건**일 때만 띄운다.
 *
 * 첫 지출 유도 카드가 사라지는 순간(1건)부터 몇 건 안에 준비템 탭으로 한 번 데려가는 것이 이
 * 카드의 목적이다. 그보다 많이 기록한 사람은 이미 루프를 돌고 있으므로 첫 실행 안내가 아니라
 * 방해가 된다.
 *
 * 라운드 38 H-5: 그 상한을 `HOME_RECENT_EXPENSES_LIMIT`보다 **하나 작게** 잡는다(3 → 2). 두 값이
 * 같은 3이던 동안에는 "서버 목록이 3이면 총량을 모른다"는 F3 게이트와 "이번 달 3건까지는 첫
 * 실행"이라는 이 상한이 정확히 3에서 겹쳤고, 그 겹침을 통과시키는 예외(G-6)가 곧 8개월째 쓰는
 * 사용자의 "이번 달 3건"까지 함께 통과시키는 구멍이 됐다(둘은 서버 LIMIT 3으로는 구별할 수
 * 없다). 상한이 LIMIT보다 작으면 두 게이트의 경계가 겹치지 않으므로 예외 자체가 필요 없다.
 */
export const FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS = HOME_RECENT_EXPENSES_LIMIT - 1;

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
  // F6 ①: "온보딩을 막 끝낸 사람"으로 좁히는 근사 게이트. 기록 수를 모르면(null) 띄우지 않는다.
  if (typeof input.recentRecordCount !== "number" || !Number.isFinite(input.recentRecordCount)) return null;
  if (input.recentRecordCount > FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS) return null;
  // 라운드 36 F3 ①': 이번 달 기록 수만으로는 매달 1일에 모든 기존 사용자가 "첫 실행"으로
  // 되돌아간다(달이 바뀐 것은 사용자의 행동이 아니다). 전체 기간 신호를 함께 요구한다.
  if (typeof input.serverRecentExpenseCount !== "number" || !Number.isFinite(input.serverRecentExpenseCount)) {
    return null;
  }
  // 라운드 38 H-5: 서버 목록이 LIMIT에 닿았다 = 전체 기간 총량을 **모른다**. 모르는 상태에
  // 첫 실행 안내를 띄우지 않는다는 규칙 그대로 차단한다(G-6의 "그 목록이 전부 이번 달 것인가"
  // 예외는 8개월 사용자의 '이번 달 3건'과 구별할 수 없어 폐기했다 -- 위 헤더 참고).
  if (input.serverRecentExpenseCount >= HOME_RECENT_EXPENSES_LIMIT) return null;
  // F6 ②: 이미 준비를 마친 항목은 세지 않는다(호출부가 countUnpreparedRecommendedItems로 센 값).
  const count = Number.isInteger(input.recommendedItemCount) ? input.recommendedItemCount : 0;
  if (count <= 0) return null;
  return firstItemsGuide(count);
}

/**
 * `/home`의 `recommendedItems`에서 이 판정에 필요한 한 필드만 (contracts의 ItemSummary와 구조
 * 호환). `status`를 넓은 `string`으로 받는 이유: 데모/테스트 세션의 로컬 백엔드
 * (src/api/local-backend.ts)가 같은 자리에 좁혀지지 않은 문자열을 돌려주므로, 홈이 두 소스를
 * 같은 함수로 셀 수 있어야 한다.
 */
export type RecommendedItemLike = { status: ItemStatus | (string & {}) };

/**
 * 아직 **준비 행동이 남은** 추천 준비물 수.
 *
 * "해결됨"의 정의는 준비템 탭의 준비율과 같은 도메인 규칙 하나뿐이다
 * (`isResolvedItemStatus` = prepared / gifted / not_needed). 여기서 상태 목록을 다시 적으면
 * 홈이 "3개 남았어요"라고 말하는 동안 준비템 탭이 "모두 마쳤어요"를 띄우는 어긋남이 생긴다.
 *
 * 모르는 상태 문자열은 "해결됨"으로 치지 않는다 — 그 판정은 집합 조회라(EXCLUDED_NOW_NEEDED_
 * STATUSES) 낯선 값에서 "아직 준비 안 됨"으로 떨어지고, 이 카드에서 안전한 쪽은 그쪽이다
 * (없는 준비 완료를 지어내지 않는다).
 */
export function countUnpreparedRecommendedItems(items: readonly RecommendedItemLike[]): number {
  return items.filter((item) => !isResolvedItemStatus(item.status as ItemStatus)).length;
}

/**
 * 라운드 35 F3 — "기록이 하나라도 있는가"의 **세션 내 이력 래치**.
 *
 * 동기화가 확정되는 순간 오프라인 대기 행이 먼저 사라지고(sync-controller의 스냅샷 갱신),
 * 홈의 `["home"]` refetch는 그 다음이다. 그 사이 한 프레임 동안 서버 `recentExpenses`도 비어
 * 있고 대기 행도 없어서 판정이 `true -> false -> true`로 순환한다.
 *
 * ## 라운드 36 F2 — 이 래치가 하는 일이 하나로 줄었다
 * 예전에는 이 값 하나가 화면의 세 가지를 동시에 정했다: 축하 배너, 첫 실행 안내 카드, "최근
 * 지출" 섹션 접기. 그런데 래치는 정의상 **거짓으로 돌아가지 않으므로**, 기록을 1건 남겼다가
 * 그 한 건을 지우면 홈이 앱 재시작 전까지 "기록이 있다"고 믿는다. 그 결과 최근 지출 섹션이
 * 헤더째 접힌 채로(할 말이 없다고 판단) 첫 지출 유도 카드도 뜨지 않아, 화면에 지출로 가는 큰
 * 입구가 사라진 구멍이 생겼다.
 *
 * 그래서 지금 이 래치는 **축하 배너 재발화 방지 전용**이다(홈은 이 값을
 * `useFirstRecordCelebrationStore.observe`에만 흘린다). 배너는 `false -> true` 전이에서 켜지므로,
 * 관찰값을 그대로 흘리면 "전부 삭제 후 다시 기록"이 새 전이로 읽혀 축하가 두 번 뜬다. 래치가
 * 참을 붙들고 있으면 그 전이 자체가 생기지 않는다.
 *
 * 화면 표시(안내 카드 · 섹션 접기)는 관찰값을 쓰고, 동기화 확정 순간의 깜빡임은
 * `holdHasAnyExpenseRecordDuringRefetch`가 **refetch 창 안에서만** 흡수한다.
 *
 * `null`(아직 모름)은 래치하지 않는다 — "모른다"에 카드를 만들지 않는다는 규칙이 우선이다.
 */
export function latchHasAnyExpenseRecord(observed: boolean | null, everObservedTrue: boolean): boolean | null {
  if (observed === null) return null;
  return observed || everObservedTrue;
}

export type HoldHasAnyExpenseRecordInput = {
  /** 지금 관찰한 값(서버 recentExpenses + 오프라인 대기 신규 행). 모르면 null. */
  observed: boolean | null;
  /** `["home"]` 쿼리가 지금 다시 불러오는 중인지(react-query의 isFetching). */
  isFetching: boolean;
  /** **마지막으로 refetch가 끝나 있던 프레임**에서 관찰한 값. 아직 없으면 null. */
  lastSettled: boolean | null;
};

/**
 * 라운드 36 F2 — 세션 이력 래치를 대신하는 **프레임 가드**.
 *
 * 막으려는 것은 라운드 35 F3와 같은 한 프레임짜리 깜빡임이다: 동기화가 확정되면 대기 행이 먼저
 * 사라지고 서버 응답 갱신이 그 뒤라, `["home"]` refetch가 도는 동안만 관찰값이 거짓으로 떨어진다.
 * 그 창은 정확히 `isFetching === true`인 구간이므로, **그 구간에서만** 직전에 확정돼 있던 값을
 * 붙든다. refetch가 끝나면 가드는 즉시 손을 떼고 관찰값이 화면을 정한다.
 *
 * 세션 래치 대신 이것을 고른 이유: 래치는 창을 닫는 조건이 "앱 재시작"이라 **정상적인 삭제**까지
 * 영구히 흡수해 버렸다(F2의 구멍). 프레임 가드는 창이 refetch 하나로 끝나므로, 마지막 기록을
 * 지우면 그 refetch가 끝나는 순간 홈이 "기록 없음"으로 정확히 돌아온다.
 *
 * **붙드는 방향은 하나뿐이다** — `true -> false`(사라지는 쪽)만. 그 반대(`false -> true`)는
 * 깜빡임이 아니라 방금 기록을 남긴 진짜 변화라, 붙들면 축하와 안내가 refetch만큼 늦어진다.
 */
export function holdHasAnyExpenseRecordDuringRefetch(input: HoldHasAnyExpenseRecordInput): boolean | null {
  if (input.observed === null) return null;
  if (input.isFetching && input.lastSettled === true && input.observed === false) return true;
  return input.observed;
}

export type HomeRecentExpensesSectionInput = {
  /** 서버 `/home`이 준 최근 지출 행 수(비세션 미리보기에서는 픽스처 길이). */
  serverRecentExpenseCount: number;
  /** 아직 올라가지 않은 로컬 신규 행 수(`countPendingOfflineCreates`). */
  pendingOfflineCreateCount: number;
  /** "이 아이에게 기록이 하나라도 있는가"의 **관찰값**(래치 아님). 모르면 null. */
  hasAnyExpenseRecord: boolean | null;
  /** 지금 홈에 떠 있는 첫 실행 안내 카드의 종류. 없으면 null. */
  guideVariant: HomeFirstRunGuideVariant | null;
};

/**
 * 라운드 35 F2 → 36 F2 — 홈 "최근 지출" 섹션(헤더 · 전체 보기 · 본문)을 통째로 그릴지.
 *
 * 본문만 지우고 제목을 남기면 접은 자리가 고장난 것처럼 보이므로 판정을 하나로 모은다. 할 말이
 * 있는 경우는 셋뿐이다:
 *  1) 서버 목록에 행이 있다(평소),
 *  2) 아직 올라가지 않은 대기 행이 있다(F1의 "동기화 대기" 한 줄),
 *  3) 정말 기록이 하나도 없고, 그 사실을 대신 말해 줄 첫 지출 유도 카드도 없다(MOB-117 빈 상태).
 *
 * 라운드 36 F2: 3)의 "기록이 하나도 없다"는 **관찰값**으로 판단한다. 세션 래치를 쓰면 마지막
 * 기록을 지운 뒤에도 영영 참이 아니게 되어, 섹션도 유도 카드도 없는 빈 화면이 남는다. 관찰값을
 * 쓰면 유도 카드와 이 섹션이 언제나 같은 사실을 보므로 **둘 다 사라지는 상태가 존재하지 않는다**
 * (기록 없음이면 유도 카드가 뜨고, 유도 카드가 없으면 이 섹션이 그 자리를 말한다).
 */
export function shouldShowHomeRecentExpensesSection(input: HomeRecentExpensesSectionInput): boolean {
  if (input.serverRecentExpenseCount > 0) return true;
  if (input.pendingOfflineCreateCount > 0) return true;
  return !input.hasAnyExpenseRecord && input.guideVariant !== "first-expense";
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
  return countPendingOfflineCreates(rows) > 0;
}

/**
 * 같은 규칙으로 센 **개수**. 홈의 "최근 지출" 자리가 대기 행을 한 줄로 알릴 때 쓴다(F1).
 * `hasPendingOfflineCreate`가 이 함수를 쓰므로 "있다"와 "몇 건"이 갈라질 수 없다.
 */
export function countPendingOfflineCreates(rows: readonly OfflineExpenseRowLike[]): number {
  return rows.filter((row) => row.canonicalId === null && !row.pendingDelete).length;
}

/**
 * 라운드 35 F1 — 홈 "최근 지출" 자리의 동기화 대기 한 줄.
 *
 * 오프라인으로 첫 기록을 남기면 서버 `recentExpenses`는 여전히 비어 있다. 그 자리에 MOB-117
 * 빈 상태("첫 기록을 남기면 …")를 그대로 두면, 바로 위 축하 배너("첫 기록이에요!")와 같은
 * 화면에서 서로를 부정한다. 기록 탭은 이런 행을 "동기화 대기" 부제로 그리므로, 홈도 **같은
 * 단어**를 쓰되 목록을 복제하지 않고 한 줄만 알린다(홈의 역할은 요약이지 목록이 아니다).
 *
 * 문구의 "동기화 대기"는 offline/messages.ts의 단일 소스에서 가져온다 — 기록 탭·동기화 상태
 * 화면과 표기가 갈라지지 않게 한 REC-123(H4) 규칙 그대로다.
 */
export function homePendingSyncNoticeText(count: number): string {
  return `${SYNC_ROW_PENDING_LABEL} 중인 기록 ${count}건`;
}

export const HOME_PENDING_SYNC_NOTICE_TEST_ID = "home-recent-pending-sync";
