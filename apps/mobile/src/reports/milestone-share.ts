import type { MilestoneReport } from "../api/client";
import { formatKrw } from "../money";

/**
 * REP-103: builds the warm Korean share text for the 100일/첫돌 milestone report card
 * (reports 탭 → "공유하기" → React Native `Share.share`).
 *
 * Pure function so it can be unit-tested without any React Native surface. All amounts go
 * through src/money.ts's `formatKrw` (the app-wide "12,000원" money rule).
 *
 * Shapes:
 *  - complete d100:      『다온이』 태어나서 100일 동안 1,234,000원을 함께했어요.
 *  - complete first-birthday uses "첫돌까지" instead of "100일 동안".
 *  - partial window:     『다온이』 태어나서 67일째, 지금까지 1,234,000원을 함께했어요. (D-day still ahead)
 *  - zero expenses:      warm invitation copy without any 0원 figure.
 * All variants end with the app attribution line so shared text always credits the record.
 */
export function buildMilestoneShareMessage(report: MilestoneReport, childName: string): string {
  const milestoneLabel = report.type === "d100" ? "100일" : "첫돌";
  const attribution = "우리아이 앱으로 기록했어요";

  if (report.expenseCount === 0 || report.totalKrw <= 0) {
    return [
      `『${childName}』 ${milestoneLabel}을 향해 함께 걷는 중이에요 💛`,
      `소중한 순간들을 이제 막 기록하기 시작했어요.`,
      attribution
    ].join("\n");
  }

  const headline = report.partial
    ? `『${childName}』 태어나서 ${report.daysCovered}일째, 지금까지 ${formatKrw(report.totalKrw)}을 함께했어요.`
    : `『${childName}』 태어나서 ${milestoneLabel === "100일" ? "100일 동안" : "첫돌까지"} ${formatKrw(report.totalKrw)}을 함께했어요.`;

  const topCategoryNames = report.topCategories
    .slice(0, 2)
    .map((category) => category.name)
    .join("·");
  const topLine = topCategoryNames ? `가장 많이 든 건 ${topCategoryNames} 💛` : `하루하루가 소중한 기록이었어요 💛`;

  return [headline, topLine, attribution].join("\n");
}
