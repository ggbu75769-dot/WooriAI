import { sortRecommendedItems, type ChildStageCode, type ItemStatus, type NecessityLevel } from "@wooriai/domain";
import { itemStagesMatchBand, type StageBandLabel } from "../items-commerce/stage-bands";

/**
 * TEST-124: 준비템 목록의 "어느 탭에 담기고 어떤 순서로 보이는가" 판단을 DB에서 떼어낸
 * 순수 모듈. 예전에는 ItemsCatalogService.itemsForChild 안에 탭 술어·정렬이 함께 있어
 * 경계(밴드에 걸치는 항목 vs 현재 단계, gifted의 소속 탭, tab=all의 밴드 무시, 동점 정렬)를
 * 실 PostgreSQL e2e로만 확인할 수 있었다. 여기 함수들은 입력 배열만 보므로 DB 없이 고정된다.
 *
 * 서비스는 이 모듈을 호출만 한다 — 응답(집합·순서)은 추출 전과 동일하며, 기존 e2e
 * (items-commerce / items-stage-band)가 그 동치성의 증거다.
 */

/**
 * ITEM-123 (B5): `all`은 상태로 거르지 않는 **전체 스냅샷** 탭이다. 기존 4개 탭은 그대로 두고
 * 추가만 했으므로(하위호환) 예전 클라이언트는 영향을 받지 않는다. 준비율(ITEM-114)처럼
 * "모든 활성 준비물의 현재 상태"가 필요한 화면이 탭 4개를 각각 부르는 대신 1요청으로
 * 같은 집합을 받는다.
 */
export type ItemTab = "now" | "soon" | "prepared" | "not_needed" | "all";

/**
 * 순위 판단에 필요한 최소 입력. 준비템 행 전체가 아니라 이 네 값 + id만 본다
 * (가격·문구 등 표시용 필드는 순서에 영향을 주지 않는다).
 */
export type RankableItem = {
  id: string;
  stageCodes: ChildStageCode[];
  necessityLevel: NecessityLevel;
  status: ItemStatus;
  displayOrder: number;
};

export type ItemRankingContext = {
  tab: ItemTab;
  /** 아이의 **현재** 단계. 점수의 stageMatches는 밴드와 무관하게 늘 이 값을 본다. */
  stageCode: ChildStageCode;
  /**
   * ITEM-121: 시기 칩. 생략하면 종전대로 "현재 단계 포함 여부"로 now/soon을 가른다.
   * 지정하면 그 밴드에 걸치는지로 가르고, prepared/not_needed도 같은 밴드로 좁힌다.
   */
  stageBand?: StageBandLabel;
};

/**
 * ITEM-123 (B4): 상태 탭이 담는 상태 집합.
 *
 * gifted가 어느 탭에 속하는가 — `prepared`다. 근거:
 * - 도메인(packages/domain/src/recommendation.ts EXCLUDED_NOW_NEEDED_STATUSES)은
 *   prepared/gifted/not_needed를 "지금 필요" 추천에서 함께 제외한다. 세 상태 모두
 *   더 이상 준비 행동이 필요 없다는 뜻이다.
 * - 그 안에서 gifted는 "선물로 받아 **이미 손에 있다**"이므로 물건을 갖춘 prepared와
 *   같은 계열이고, "필요 없다고 판단해 **준비하지 않기로 했다**"인 not_needed와는
 *   의미가 정반대다. 준비완료 탭에 넣어야 사용자가 가진 물건을 한 곳에서 본다.
 * - 예전에는 어느 탭에도 없어서 gifted 항목이 앱에서 완전히 사라졌다(ITEM-114 준비율의
 *   분모에서도 빠졌다). 탭 응답이 넓어질 뿐 기존 항목이 사라지지 않으므로 하위호환이다.
 */
export const TAB_STATUSES: Record<"prepared" | "not_needed", ItemStatus[]> = {
  prepared: ["prepared", "gifted"],
  not_needed: ["not_needed"]
};

/** now/soon 후보에 남는 상태(아직 정리되지 않은 항목). */
const OPEN_STATUSES: ItemStatus[] = ["not_prepared", "interested"];

/**
 * ITEM-121: 시기 필터의 기준. stageBand가 오면 "그 밴드에 걸치는가", 없으면 종전대로
 * "아이의 현재 단계를 포함하는가".
 */
export function isInSelectedPeriod(item: Pick<RankableItem, "stageCodes">, context: ItemRankingContext): boolean {
  return context.stageBand
    ? itemStagesMatchBand(item.stageCodes, context.stageBand)
    : item.stageCodes.includes(context.stageCode);
}

/**
 * 탭 술어: 그 항목이 이 탭에 담기는가. now/soon은 서로 여집합이라(같은 술어의 참/거짓)
 * 두 탭의 합집합은 "아직 정리되지 않은 항목 전체"가 된다.
 *
 * tab="all"은 상태로도 시기로도 거르지 않는다 — 아래 FIX/F4 참고.
 */
export function matchesTab(item: RankableItem, context: ItemRankingContext): boolean {
  // FIX/F4: 예전에는 stageBand가 오면 all도 다른 상태 탭들처럼 밴드로 좁혔는데, 그러면
  // 합집합보다 **작아진다** — now는 밴드에 걸치는 항목, soon은 그 여집합이라 둘의
  // 합집합은 밴드와 무관하게 "미준비·관심" 전부다. 밴드로 좁힌 all에는 soon 탭에
  // 버젓이 보이는 항목이 빠져 있었고, 준비율의 분모도 그만큼 줄었다. 그래서 all은
  // 밴드를 적용하지 않는다(밴드 유무와 상관없이 활성 항목 전체).
  if (context.tab === "all") {
    return true;
  }

  if (context.tab === "prepared" || context.tab === "not_needed") {
    if (!TAB_STATUSES[context.tab].includes(item.status)) {
      return false;
    }
    // 밴드 미지정이면 종전 동작 그대로(상태만으로 담는다).
    return context.stageBand ? isInSelectedPeriod(item, context) : true;
  }

  if (!OPEN_STATUSES.includes(item.status)) {
    return false;
  }
  const inPeriod = isInSelectedPeriod(item, context);
  return context.tab === "now" ? inPeriod : !inPeriod;
}

/**
 * 탭에 담기는 항목을 화면 순서대로 돌려준다.
 * - now/soon: 추천 점수(도메인 sortRecommendedItems) → 동점이면 displayOrder.
 * - 그 외 탭: displayOrder만(카탈로그 편집 순서 그대로).
 *
 * 입력 배열은 변형하지 않는다.
 */
export function rankItemsForTab<T extends RankableItem>(items: readonly T[], context: ItemRankingContext): T[] {
  const candidates = items.filter((item) => matchesTab(item, context));

  if (context.tab !== "now" && context.tab !== "soon") {
    return [...candidates].sort((left, right) => left.displayOrder - right.displayOrder);
  }

  const sorted = sortRecommendedItems(
    candidates.map((item) => ({
      id: item.id,
      // 점수의 stageMatches는 밴드와 무관하게 늘 "아이의 현재 단계"를 뜻한다 — 다음 시기를
      // 미리 볼 때도 지금 당장 필요한 항목이 위로 오게 하는 편이 사용자에게 정직하다.
      stageMatches: item.stageCodes.includes(context.stageCode),
      necessityLevel: item.necessityLevel,
      status: item.status,
      budgetFits: true,
      userInterest: item.status === "interested",
      displayOrder: item.displayOrder
    }))
  );

  // FIX/ITEM-121(F3): 예전에는 비교자 안에서 sorted.findIndex를 두 번 돌려 O(n²)였다.
  // 순위를 Map으로 한 번만 만들어 O(n log n)으로 정렬한다(결과 순서는 동일).
  const itemById = new Map(candidates.map((item) => [item.id, item]));
  const rankById = new Map(sorted.map((entry, index) => [entry.id, index]));
  return sorted
    .map((entry) => itemById.get(entry.id))
    .filter((item): item is T => Boolean(item))
    .sort((left, right) => {
      const leftIndex = rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.displayOrder - right.displayOrder;
    });
}
