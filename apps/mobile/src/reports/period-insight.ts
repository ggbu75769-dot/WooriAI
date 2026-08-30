import { formatKrw } from "../money";
import { computeCategoryShares, type CategoryShareInput } from "./category-share";

/**
 * 라운드 82 트랙 A: 리포트 탭 **분기·연간** 세그먼트의 한 문장 — 순수 조립 모듈.
 *
 * ## 왜 이 모듈인가
 * 인사이트 카드(승인 캡처 REP-001의 "절약 팁" 자리 = 구획 ⑤)는 월간에서만 살았다
 * (`app/(tabs)/reports.tsx`의 `period === "월간"` 게이트). 분기·연간에서는 그 자리가 통째로
 * 빈칸이라, 화면이 **더 넓은 기간을 보여 주면서 말은 덜 했다** — 총액·도넛·추이·누적이라는
 * 숫자 카드의 나열만 남고, "그래서 이 분기는 어땠는데?"는 사용자가 범례에서 퍼센트를 눈으로
 * 읽어 스스로 만들어야 했다. 그 상태가 바로 `monthly-insight.ts` 머리말이 이 모듈군의 존재
 * 이유로 적어 둔 상태다.
 *
 * ## 새 값을 만들지 않는다 (새 요청 0건 · 새 집계 0건 · 새 반올림 0건)
 * 화면은 이미 **보고 있는 기간의** 카테고리 분해를 손에 들고 있다 — `categoryPeriod`가
 * 세그먼트를 그대로 따라가므로(월간=yearMonth · 분기=year+quarter · 연간=year) 바로 위 도넛이
 * 그리는 그 배열이 곧 이 문장의 근거다. 그래서 이 모듈은 **도넛에 넘어가는 조각 배열을 그대로**
 * 받아 `computeCategoryShares`(범례와 같은 함수 · 같은 최대잔여법)를 지난다.
 * **반올림 규칙의 두 번째 벌을 만들지 않는 것이 이 모듈의 첫 규율이다** — 같은 화면의 문장과
 * 범례가 1% 어긋날 자리를 구조적으로 없앤다.
 *
 * ## 말하지 않는 것 (그리고 그 이유)
 * - **예산 문장 없음.** 화면이 이미 적어 둔 판정 그대로다 — *"분기·연간에는 합친 예산이라는
 *   것이 존재하지 않는다"*(reports.tsx). 없는 값을 지어내지 않는다.
 * - **비교 문장 없음.** 직전 분기·직전 해의 합계를 이 화면은 갖고 있지 않다(`quarterTrend`는
 *   그 분기 세 달만, `yearly`는 그 해 열두 달만 준다). 없는 값으로 비교를 짓는 것이
 *   `monthly-insight.ts`가 허위 비교로 규정한 바로 그 자리다.
 * - **공유 문구 없음.** 분기·연간 공유 문구는 별도 결정이다(`share-text.ts` 머리말의 "세 번째
 *   벌" 경고). 이 모듈은 화면에 그릴 문장만 낸다 — 그래서 카드에 공유 버튼도 서지 않는다.
 * - **월간 문장 없음.** 월간은 `monthly-insight.ts` 하나가 소유한다(`unit`이 "quarter" | "year"
 *   뿐인 것이 그 규율의 타입 표현이다 — 이 모듈로는 월간 문장을 만들 수 없다).
 *
 * ## 문장 규칙 (DNC-018)
 * 해요체, 사실 서술만. 평가·조언·죄책감 유발 문구 금지. 그리고 **근거가 없으면 문장이 아니라
 * 카드가 없다**(`null` 반환) — 기간 총액이 0원이거나, 카테고리 분해가 없거나(아직 안 왔거나
 * 전부 0원), 기간 라벨이 비면 아무것도 말하지 않는다. 월간과 **같은 규율**이다.
 *
 * 문장은 **하나로 시작한다**(`PERIOD_INSIGHT_MAX_SENTENCES`). 둘째 문장을 더하려면 그 문장이
 * 기대는 값이 이 화면에 실제로 있는지부터 재야 한다 — 위 "말하지 않는 것"이 그 목록이다.
 *
 * 순수 모듈인 이유는 이 폴더의 관례와 같다: 리포트 탭은 네이티브 바인딩이 없어 vitest에서
 * 렌더되지 않는다. 그래서 판정은 전부 여기 있고 화면은 배선만 한다(화면 프레임워크 의존 0건).
 */

/** 이 모듈이 말할 수 있는 기간 단위. 월간이 없는 것이 계약이다(위 머리말). */
export type PeriodInsightUnit = "quarter" | "year";

export type PeriodInsightInput = {
  /** 보고 있는 세그먼트. 월간은 이 모듈을 지나지 않는다. */
  unit: PeriodInsightUnit;
  /** 화면이 이미 그리고 있는 기간 라벨("2026년 3분기" · "2026년" — reports.tsx의 periodLabel). */
  periodLabel: string;
  /** 그 기간의 총 지출(화면의 activeTotal). 0원/모름이면 카드가 없다. */
  totalExpenseKrw: number | null | undefined;
  /**
   * **도넛에 넘어가는 그 조각 배열 그대로**(reports.tsx의 categorySegments).
   *
   * 이름이 아직 해석되지 않았으면(카테고리 캐시 미도착) 화면이 `undefined`를 넘긴다 —
   * "기타" 폴백으로 엉뚱한 카테고리를 지목하느니 문장을 만들지 않는다(월간과 같은 판단).
   */
  segments?: readonly CategoryShareInput[] | null;
};

export type PeriodInsight = {
  unit: PeriodInsightUnit;
  /** 카드 첫 줄. */
  headline: string;
  /**
   * 카드 둘째 줄. 이 모듈은 **언제나 null**이다(문장 하나).
   *
   * 타입에 남겨 두는 이유: 화면의 카드가 월간 인사이트와 같은 모양을 읽기 때문이다. 값이 아니라
   * **자리**를 맞춰 두어야 카드가 두 벌로 갈리지 않는다.
   */
  detail: null;
  /** 렌더 순서 그대로의 문장들(최대 1). */
  sentences: string[];
  /** 카드를 한 요소로 읽어 주는 TalkBack 라벨. */
  accessibilityLabel: string;
  /**
   * 문장이 지목한 카테고리 이름과 퍼센트 라벨.
   *
   * 화면은 이 값을 그리지 않는다 — **문장이 도넛 범례 1위와 같은 값을 말했는지 검산하는 테스트
   * 전용 값**이다(monthly-insight.ts의 elapsedDays·dailyAverageKrw와 같은 관례).
   */
  topCategoryLabel: string;
  topCategoryPercentLabel: string;
};

/** 카드가 담는 문장 수 상한 — "숫자 나열"로 되돌아가지 않으면서, 없는 값으로 늘리지도 않는다. */
export const PERIOD_INSIGHT_MAX_SENTENCES = 1;

function normalizedAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * 분해에서 **금액이 가장 큰 조각**. 서버가 내림차순으로 주지만 순서에 기대지 않는다(동률은 먼저
 * 온 조각 — `computeCategoryShares`가 입력 순서를 그대로 보존하므로 범례 1위와 같은 조각이다).
 */
function topShare(segments: readonly CategoryShareInput[]) {
  const shares = computeCategoryShares(segments);
  if (shares.length === 0) return null;
  return shares.reduce((best, slice) => (slice.amountKrw > best.amountKrw ? slice : best), shares[0]);
}

/**
 * 분기·연간 인사이트 카드 한 장을 만든다. 말할 근거가 없으면 null(카드 미렌더).
 */
export function buildPeriodInsight(input: PeriodInsightInput): PeriodInsight | null {
  const periodLabel = input.periodLabel.trim();
  // 기간을 이름으로 부를 수 없으면 문장의 주어가 없다.
  if (periodLabel.length === 0) return null;

  // 그 기간에 지출이 하나도 없으면 요약할 것이 없다 — 빈 기간 문구는 화면의 몫이다
  // (src/reports/empty-period-card.ts).
  const totalExpenseKrw = normalizedAmount(input.totalExpenseKrw);
  if (totalExpenseKrw === null || totalExpenseKrw <= 0) return null;

  const top = topShare(input.segments ?? []);
  if (top === null) return null;

  const sentence = `${periodLabel}에는 ${top.label}에 가장 많이 썼어요 (${formatKrw(top.amountKrw)} · 전체의 ${top.percentLabel})`;
  const sentences = [sentence].slice(0, PERIOD_INSIGHT_MAX_SENTENCES);

  return {
    unit: input.unit,
    headline: sentences[0],
    detail: null,
    sentences,
    accessibilityLabel: sentences.join(" "),
    topCategoryLabel: top.label,
    topCategoryPercentLabel: top.percentLabel
  };
}
