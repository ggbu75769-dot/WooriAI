import type { MilestoneReport, MilestoneReportType } from "../api/client";
import { formatKrw } from "../money";

/**
 * REP-127: 마일스톤 이름은 **응답의 `type`에서만** 파생한다. 리포트 탭의 카드 제목이
 * "100일 리포트"로 하드코딩돼 있어 첫돌 리포트를 띄우면 제목이 거짓말을 하게 되므로,
 * 화면과 공유 문구가 같은 한 곳에서 이름을 받아 간다.
 */
export function milestoneLabel(type: MilestoneReportType): string {
  return type === "d100" ? "100일" : "첫돌";
}

/** 카드 제목 / 공유 버튼 접근성 라벨의 앞머리. */
export function milestoneReportTitle(type: MilestoneReportType): string {
  return `${milestoneLabel(type)} 리포트`;
}

/** 창이 다 지난(완결) 리포트의 "태어나서 ___ N원" 사이 문구. */
export function milestoneWindowPhrase(type: MilestoneReportType): string {
  return type === "d100" ? "100일 동안" : "첫돌까지";
}

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
  const label = milestoneLabel(report.type);
  const attribution = "우리아이 앱으로 기록했어요";

  if (report.expenseCount === 0 || report.totalKrw <= 0) {
    return [
      `『${childName}』 ${label}을 향해 함께 걷는 중이에요 💛`,
      `소중한 순간들을 이제 막 기록하기 시작했어요.`,
      attribution
    ].join("\n");
  }

  const headline = report.partial
    ? `『${childName}』 태어나서 ${report.daysCovered}일째, 지금까지 ${formatKrw(report.totalKrw)}을 함께했어요.`
    : `『${childName}』 태어나서 ${milestoneWindowPhrase(report.type)} ${formatKrw(report.totalKrw)}을 함께했어요.`;

  const topCategoryNames = report.topCategories
    .slice(0, 2)
    .map((category) => category.name)
    .join("·");
  const topLine = topCategoryNames ? `가장 많이 든 건 ${topCategoryNames} 💛` : `하루하루가 소중한 기록이었어요 💛`;

  return [headline, topLine, attribution].join("\n");
}
