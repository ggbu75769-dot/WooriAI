import { formatKrw } from "../money";
import type { MonthlyInsight } from "./monthly-insight";

/**
 * UX-H: 리포트 탭의 **공유 문구 조립** — 마일스톤(100일/첫돌) 카드와 월간 인사이트 카드가
 * 같은 모양의 카카오톡 붙여넣기용 멀티라인 텍스트를 만든다.
 *
 * ## 왜 한 모듈인가
 * 두 카드는 서로 다른 API 응답을 읽지만, 받는 사람(배우자·가족)에게는 **같은 카드**로 보여야
 * 한다. 머리글 한 줄 → 금액 한 줄 → 맥락 한 줄 → 앱 한 줄. 문구가 카드마다 제각각이면
 * 붙여넣은 쪽에서 "이건 무슨 앱이지"가 되고, 앱 홍보 줄이 두 줄로 늘어나기도 쉽다.
 * 그래서 줄 조립기와 앱 서명 줄을 여기 한 곳에 둔다(마일스톤 문구 본체는 화면 배선 계약이
 * 가리키는 milestone-share.ts에 그대로 남고, 이 모듈의 조각들을 빌려 쓴다).
 *
 * ## 숫자는 화면과 같은 소스에서만 (DNC-013/015)
 * - 금액은 전부 `formatKrw`("1,245,700원", ₩ 없음)를 지난다. 공유 문구용 포맷을 따로 만들지
 *   않는다.
 * - 월간 요약의 문장은 화면이 이미 그린 `MonthlyInsight`를 **그대로** 받는다. 이 모듈은
 *   monthly-insight.ts를 타입으로만 참조하고 집계를 다시 하지 않는다 — 화면에 보이는 문장과
 *   보낸 문장이 다를 수 없다.
 * - 총액도 화면이 그린 값(월간 응답의 totalExpenseKrw)을 받아 쓴다.
 *
 * ## 진행 중인 달은 구간을 밝힌다 (허위 방지)
 * 8월 27일에 8월을 공유하면 "1,245,700원"은 **한 달치가 아니다**. 받는 사람은 그걸 알 길이
 * 없으므로 "8월 1일~27일 기준" 줄을 금액 바로 아래에 넣는다. 이미 끝난 달에는 머리글의
 * "2026년 8월"이 곧 구간이므로 그 줄을 넣지 않는다.
 *
 * ## 개인정보
 * 공유 텍스트에 들어가는 식별 정보는 **호출자가 넘긴 아이 이름/태명 하나뿐**이다(사용자가
 * 스스로 보내는 값). childId·이메일·계정 식별자는 입력으로 받지도, 출력에 넣지도 않는다.
 *
 * ## 톤 (DNC-018)
 * 사실 서술 + 해요체. 평가("잘하고 있어요")·조언("줄여보세요")·죄책감 유발 문구 없음.
 * 앱 홍보는 마지막 한 줄뿐이다.
 */

/** 모든 공유 카드의 마지막 줄. 앱 홍보는 여기 한 줄로 끝난다. */
export const SHARE_APP_LINE = "— 우리아이 앱에서";

/** 금액 줄. 마일스톤·월간이 같은 문구를 써서 두 카드가 한 가족으로 읽힌다. */
export function shareTotalLine(totalKrw: number): string {
  return `함께한 지출 ${formatKrw(totalKrw)}`;
}

/**
 * "가장 많이 준비한 것: 기저귀/위생" — 이름이 하나도 없으면 줄 자체를 만들지 않는다
 * (근거 없는 줄은 넣지 않는다).
 */
export function shareTopCategoryLine(categoryNames: readonly string[]): string | null {
  const names = categoryNames.map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) return null;
  // 카테고리 이름 자체에 "/"가 들어가므로(기저귀/위생) 구분자는 "·"를 쓴다.
  return `가장 많이 준비한 것: ${names.join("·")}`;
}

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 진행 중인 달의 구간 표기 — "8월 1일~27일 기준".
 *
 * 보고 있는 달이 오늘이 속한 달이 아니거나 날짜 형식이 어긋나면 null(줄 없음)이다. 오늘이
 * 그 달의 1일이면 "8월 1일~1일 기준"이 되는데, 하루치라는 사실이 그대로 드러나므로 그대로 둔다.
 */
export function partialMonthRangeLine(yearMonth: string, todayIso: string): string | null {
  if (!YEAR_MONTH_PATTERN.test(yearMonth) || !DATE_ONLY_PATTERN.test(todayIso)) return null;
  if (todayIso.slice(0, 7) !== yearMonth) return null;
  const month = Number(yearMonth.slice(5, 7));
  const day = Number(todayIso.slice(8, 10));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1) return null;
  return `${month}월 1일~${day}일 기준`;
}

/** 빈 줄(null/공백)을 걸러 개행으로 잇는다. 카카오톡에 그대로 붙여넣는 형태. */
export function joinShareLines(lines: ReadonlyArray<string | null | undefined>): string {
  return lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0).join("\n");
}

export type MonthlyShareInput = {
  /** 화면이 보고 있는 달 "YYYY-MM"(reports.tsx의 reportYearMonth). */
  yearMonth: string;
  /** 화면 머리글과 같은 라벨("2026년 8월") — 공유 문구가 화면과 다른 달 이름을 쓰지 않게. */
  monthLabel: string;
  /** 서울 기준 오늘 "YYYY-MM-DD". */
  todayIso: string;
  /** 아이 닉네임/태명. 사용자가 스스로 보내는 값이라 그대로 싣는다. */
  childName: string;
  /** 월간 리포트 totalExpenseKrw — 화면의 "총 지출" 카드와 같은 값. */
  totalExpenseKrw: number;
  /** 화면이 이미 그린 인사이트 카드. null이면 공유할 문장이 없다. */
  insight: MonthlyInsight | null;
};

/**
 * 월간 요약 공유 문구. 화면의 인사이트 카드가 없으면(= 말할 근거가 없으면) null이라 공유
 * 버튼도 붙지 않는다.
 *
 * 예)
 *   📊 다온이의 2026년 8월
 *   함께한 지출 1,245,700원
 *   8월 1일~27일 기준
 *   이번 달은 기저귀/위생에 가장 많이 썼어요 (84,200원 · 전체의 32%)
 *   — 우리아이 앱에서
 *
 * 카드의 **첫 문장(headline)만** 싣는다. 둘째 문장은 예산 달성률·하루 평균처럼 화면에서
 * 읽는 개인 목표에 가깝다 — 가족에게 보내는 카드에 예산을 얹지 않고, 줄 수도 붙여넣기 좋은
 * 다섯 줄 안에 묶어 둔다.
 */
export function buildMonthlyShareMessage(input: MonthlyShareInput): string | null {
  const { insight } = input;
  if (!insight) return null;
  if (!Number.isFinite(input.totalExpenseKrw) || input.totalExpenseKrw <= 0) return null;

  const rangeLine = insight.monthStatus === "in-progress" ? partialMonthRangeLine(input.yearMonth, input.todayIso) : null;

  return joinShareLines([
    `📊 ${input.childName}의 ${input.monthLabel}`,
    shareTotalLine(input.totalExpenseKrw),
    rangeLine,
    insight.headline,
    SHARE_APP_LINE
  ]);
}
