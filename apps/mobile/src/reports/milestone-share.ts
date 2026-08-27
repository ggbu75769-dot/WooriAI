import type { MilestoneReport, MilestoneReportType } from "../api/client";
import { joinShareLines, SHARE_APP_LINE, shareTopCategoryLine, shareTotalLine } from "./share-text";

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

/** 공유 카드의 "가장 많이 준비한 것" 줄에 싣는 카테고리 수. */
const SHARE_TOP_CATEGORY_COUNT = 2;

/**
 * REP-103 / UX-H: builds the warm Korean share text for the 100일/첫돌 milestone report card
 * (reports 탭 → "공유하기" → React Native `Share.share`).
 *
 * Pure function so it can be unit-tested without any React Native surface. All amounts go
 * through src/money.ts's `formatKrw` (the app-wide "12,000원" money rule).
 *
 * UX-H에서 문구를 **카드 모양**으로 바꿨다. 종전에는 한 줄이 길어(『다온이』 태어나서 100일
 * 동안 1,234,000원을 함께했어요.) 카카오톡에 붙여넣으면 화면 폭에서 제멋대로 접혔고, 자랑
 * 대상인 **숫자가 문장 한가운데 묻혔다**. 이제는 머리글 / 금액 / 맥락 / 앱 네 줄로 끊어
 * 어느 폭에서도 같은 모양으로 읽힌다. 줄 조립기와 마지막 앱 한 줄은 월간 요약 공유와
 * 공유한다(src/reports/share-text.ts).
 *
 * Shapes:
 *  - complete d100:
 *      🎉 다온이의 100일
 *      함께한 지출 1,234,000원
 *      가장 많이 준비한 것: 기저귀·분유
 *      — 우리아이 앱에서
 *  - complete first-birthday: 머리글만 "다온이의 첫돌"로 바뀐다.
 *  - partial window: 아직 오지 않은 D-day를 지난 일처럼 말하지 않는다 —
 *      💛 다온이의 100일 기록, 태어나서 67일째
 *  - zero expenses: 0원을 렌더하지 않고 따뜻한 초대 문구로 대체한다.
 * All variants end with the shared app line so shared text always credits the record.
 */
export function buildMilestoneShareMessage(report: MilestoneReport, childName: string): string {
  const label = milestoneLabel(report.type);

  if (report.expenseCount === 0 || report.totalKrw <= 0) {
    return joinShareLines([
      `💛 ${childName}의 ${label}을 향해 걷는 중이에요`,
      "소중한 순간들을 이제 막 기록하기 시작했어요",
      SHARE_APP_LINE
    ]);
  }

  // 창이 아직 안 끝난 리포트는 "100일"을 이미 지난 일처럼 쓰지 않는다(화면 카드와 같은 기준).
  //
  // 라운드 36 F-4: 예전 문구 "100일까지 67일째"는 "100일까지 67일 남음(D-67)"으로 읽혔다
  // (실제로는 태어난 뒤 67일이 지났고 남은 날은 33일이다). daysCovered는 **경과일**이므로
  // 화면 카드가 쓰는 "태어나서 67일째"와 같은 표현으로 통일한다 — "까지 N일째" 조합을 피하면
  // 남은 날로 오독될 여지가 없다(app/(tabs)/reports.tsx의 마일스톤 카드 본문과 같은 말).
  const headline = report.partial
    ? `💛 ${childName}의 ${label} 기록, 태어나서 ${report.daysCovered}일째`
    : `🎉 ${childName}의 ${label}`;

  const topCategoryLine = shareTopCategoryLine(
    report.topCategories.slice(0, SHARE_TOP_CATEGORY_COUNT).map((category) => category.name)
  );

  return joinShareLines([headline, shareTotalLine(report.totalKrw), topCategoryLine, SHARE_APP_LINE]);
}
