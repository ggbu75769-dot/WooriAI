import type { MilestoneReport } from "../api/client";
import { formatKrw } from "../money";

/**
 * 라운드 45 UX-AA(후보 6): 리포트 탭 마일스톤 카드가 그리는 줄들.
 *
 * 고치는 것: 서버 응답(GET /children/:id/reports/milestone)은 총액·기록 수·하루 평균·상위
 * 카테고리 5개를 주는데, 카드는 총액과 **1위 카테고리 이름 하나**만 쓰고 나머지를 버렸다.
 * 100일 동안 얼마를 어디에 썼는지가 이 카드의 전부인데, 정작 "몇 건인지 · 하루 평균 얼마인지 ·
 * 그다음은 무엇인지"를 사용자가 알 방법이 없었다. **새 요청 없이** 이미 받은 값만 더 그린다.
 *
 * 공유 문구(milestone-share.ts)는 계약이 고정돼 있어 건드리지 않는다 -- 카드에만 붙는 줄이다.
 *
 * 순수 모듈인 이유: 리포트 탭은 vitest에서 렌더되지 않는다(react-native 네이티브 바인딩 없음).
 */

/** 카드가 이름을 부르는 상위 카테고리 수. 서버는 5개까지 주지만 카드 두 줄에 담기는 만큼만 쓴다. */
export const MILESTONE_CARD_TOP_CATEGORY_COUNT = 3;

type MilestoneCategory = MilestoneReport["topCategories"][number];

/**
 * 비중 라벨. `share`는 서버가 소수 3자리로 반올림해 주는 0..1 분수다.
 *
 * 0%로 반올림되는 0 아닌 비중은 "<1%"라고 적는다(카테고리 도넛 범례 percentLabel과 같은 규칙) --
 * 실제로 돈이 든 항목을 "0%"라고 말하지 않기 위해서다. 비중이 0이면(총액 0) 라벨이 없다.
 */
function sharePercentLabel(share: number): string | null {
  if (!Number.isFinite(share) || share <= 0) return null;
  const percent = Math.round(share * 100);
  return percent === 0 ? "<1%" : `${percent}%`;
}

/** "기저귀 42%" (비중을 말할 수 없으면 이름만). */
function categoryLabel(category: MilestoneCategory): string {
  const percentLabel = sharePercentLabel(category.share);
  return percentLabel ? `${category.name} ${percentLabel}` : category.name;
}

/**
 * "기록 12건 · 하루 평균 12,345원".
 *
 * 기록이 없으면(카드가 이미 0원을 말한다) 줄 자체가 없다. 하루 평균은 서버가 계산해 주는
 * `avgDailyKrw`를 그대로 쓴다 -- 화면에서 총액/일수를 다시 나누면 서버 값과 1원씩 어긋난다.
 * daysCovered가 0인 (생일 당일) 리포트는 avgDailyKrw가 0이라 평균 항을 생략한다.
 */
export function milestoneRecordCountLine(report: MilestoneReport): string | null {
  if (!Number.isFinite(report.expenseCount) || report.expenseCount <= 0) return null;
  const countText = `기록 ${report.expenseCount}건`;
  if (!Number.isFinite(report.avgDailyKrw) || report.avgDailyKrw <= 0) return countText;
  return `${countText} · 하루 평균 ${formatKrw(report.avgDailyKrw)}`;
}

/** "가장 많이 든 건 기저귀 42% 💛" -- 1위 카테고리가 없으면 null. */
export function milestoneTopCategoryLine(report: MilestoneReport): string | null {
  const top = report.topCategories?.[0];
  if (!top) return null;
  return `가장 많이 든 건 ${categoryLabel(top)} 💛`;
}

/**
 * "그다음 분유/유제품 21% · 의류 12%" -- 2·3위가 없으면 null.
 *
 * 1위만 말하던 카드가 버리던 값이다. 상위 3개까지만 부르는 이유: 카드 한 장이 감당하는 줄 수와,
 * 꼬리 카테고리(1~2%)를 나열해도 "어디에 썼는가"를 더 알려주지 않기 때문이다.
 */
export function milestoneOtherCategoriesLine(report: MilestoneReport): string | null {
  const rest = (report.topCategories ?? []).slice(1, MILESTONE_CARD_TOP_CATEGORY_COUNT);
  if (rest.length === 0) return null;
  return `그다음 ${rest.map(categoryLabel).join(" · ")}`;
}
