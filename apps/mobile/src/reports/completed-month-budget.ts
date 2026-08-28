import { evaluateHomeBudgetProgress } from "../home/budget-progress";
import { formatKrw } from "../money";
import type { MonthlyInsight, MonthlyInsightMonthStatus } from "./monthly-insight";

/**
 * GAP-066 트랙 A(#1) — **끝난 달의 예산 결과** 한 줄.
 *
 * ## 무엇이 문제였나
 * 월간 리포트 응답은 **어느 달이든** 그 달의 예산을 싣는다(apps/api/src/onboarding/
 * reporting-store.service.ts — `budgetAmountKrw`를 `(childId, yearMonth)`로 직접 조회한다).
 * 그런데 리포트 화면은 그 값을 **인사이트 카드 한 곳에만** 넘겼고, 그 카드의 끝난 달 우선순위는
 * `[카테고리 1위, 지난달 비교, 예산]`이며 상한이 2문장이다(./monthly-insight.ts의
 * `MONTHLY_INSIGHT_MAX_SENTENCES`). 즉 **카테고리 분해가 있고 지난달이 0원이 아닌 모든 끝난
 * 달에서 예산 문장은 잘려 나간다.**
 *
 * 다른 자리에도 없다: 홈의 예산 카드·경고 배너·진행률은 전부 **이번 달**이고, `/budget` 화면도
 * 이번 달 한 칸을 고친다. 그래서 "이번 달 20만 원으로 정한 예산을 지난달엔 지켰나?"라는, 월말
 * 정리에서 가장 먼저 나오는 질문에 앱이 답하지 않았다 — 매달 예산을 새로 세우라고 말하면서
 * (라운드 48 B1의 이월 칩) 지난달 결과는 보여 주지 않은 셈이다.
 *
 * ## 왜 인사이트 카드 안이 아니라 **카드 밖 한 줄**인가
 * 문장을 하나 더 넣는 방식은 상한 2문장 규칙과 정면으로 부딪힌다(그 상한은 "숫자 나열로 되돌아
 * 가지 않는다"는 규칙이라 이번 변경이 흔들 자리가 아니다). 그래서 "총 지출" 카드 아래 캡션 한
 * 줄로 낸다 — 인사이트 모듈은 **읽기만** 하고 문장 규칙은 한 글자도 바뀌지 않는다.
 *
 * ## 판정을 두 벌로 만들지 않는다
 * 예산이 있는지·몇 퍼센트인지는 홈 히어로와 인사이트가 함께 쓰는 `evaluateHomeBudgetProgress`
 * 하나가 답한다. 반올림과 "미소진 100% 금지" 캡(라운드 37 G-2)이 그 함수 안에 있으므로, 같은
 * 달을 홈과 리포트가 다른 퍼센트로 말할 자리가 없다. 초과한 달에 퍼센트 대신 **초과 금액**을
 * 말하는 것도 인사이트가 이미 내린 판단 그대로다(홈 퍼센트는 100%에서 잘리므로 130%를
 * "100%를 썼어요"로 감추게 된다).
 *
 * ## 말하지 않는 경우 (근거가 없으면 줄을 만들지 않는다)
 *  - **진행 중인 달**: 홈이 진행률 바와 경고 배너로 이미 말하고 있다. 같은 사실을 두 화면에서
 *    다른 그림으로 두 번 말하지 않는다(라운드 34 L1이 방향 행·인사이트에서 내린 판단과 같다).
 *  - **예산이 없는 달**: 사용자가 정한 적 없는 값을 지어내지 않는다(`hasBudget`).
 *  - **지출이 0원인 달**: 요약할 것이 없다(인사이트 카드가 같은 자리에서 스스로 접는 규칙).
 *  - **인사이트가 이미 예산을 말한 달**: 아래 `monthlyInsightSpokeBudget` 참고.
 *  - **분기·연간 탭**: 예산은 (아이, 월) 한 칸이라 세 달·열두 달을 합친 예산이라는 것이
 *    존재하지 않는다. 합쳐 만들면 그 순간 앱이 없는 숫자를 지어낸다 — 화면이 월간 탭에서만
 *    이 줄을 그린다.
 *
 * 대기 고지는 이 줄이 다시 말하지 않는다: 화면 머리의 기간 고지(pending-scope-notice.ts)가 **같은
 * 달**을 세고 있어 아래 숫자 전부를 이미 덮는다. 여기서 한 번 더 말하면 한 화면이 같은 사실을
 * 두 번 말하게 된다.
 *
 * react/react-native 의존 없음 — vitest 단위 테스트 대상이다.
 */

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 화면이 이 줄에 다는 testID. 계약 테스트와 화면이 같은 문자열을 쓰도록 여기 한 번만 적는다. */
export const COMPLETED_MONTH_BUDGET_LINE_TEST_ID = "reports-completed-month-budget";

export type CompletedMonthBudgetInput = {
  /** 화면이 보고 있는 달 `YYYY-MM`(reports.tsx의 reportYearMonth). */
  yearMonth: string;
  /** `resolveMonthStatus`의 결과 그대로. 끝난 달("complete")에서만 줄이 선다. */
  monthStatus: MonthlyInsightMonthStatus | null;
  /** 월간 리포트 `budgetAmountKrw`. null/0이면 예산 미설정. */
  budgetAmountKrw?: number | null;
  /** 월간 리포트 `totalExpenseKrw`(선물 제외 서버 집계 — DNC-015). */
  totalExpenseKrw?: number | null;
};

function normalizedAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * 인사이트 카드가 그 달의 **예산 문장을 이미 말했는가**.
 *
 * 끝난 달의 인사이트 우선순위는 `[카테고리 1위, 지난달 비교, 예산]`이고 상한이 2문장이라, 예산
 * 문장은 앞의 둘 중 **하나 이하만** 성립한 달에서 살아남는다(사실상 그 사용자의 첫 달 — 지난달이
 * 0원인 달이다). 그런 달에 이 줄까지 세우면 한 화면이 같은 사실을 두 번 말한다.
 *
 * 판정은 인사이트가 **이미 공개한 두 값**만 읽는다(그 모듈의 문장 규칙은 손대지 않는다):
 *  - `shareableHeadline !== null` = 카테고리 1위 문장이 실제로 렌더된 문장 안에 있다.
 *  - `hasComparison` = 지난달 비교 문장이 실제로 렌더된 문장 안에 있다.
 *
 * 경우의 수를 전부 적으면(끝난 달):
 *  | 성립한 문장          | 렌더된 2문장   | shareable | hasComparison | 예산을 말했나 |
 *  | 1위+비교+예산        | [1위, 비교]    | 있음      | true          | 아니오       |
 *  | 1위+비교             | [1위, 비교]    | 있음      | true          | 아니오(없음) |
 *  | 1위+예산             | [1위, 예산]    | 있음      | false         | 예           |
 *  | 비교+예산            | [비교, 예산]   | 없음      | true          | 예           |
 *  | 예산만               | [예산]         | 없음      | false         | 예           |
 * 즉 **둘 다 있을 때만** 예산이 밀려난다.
 *
 * 카드가 아예 없으면(총액 0원 등) 말한 것도 없다 — false다. 이 함수는 끝난 달에만 의미가 있고,
 * 진행 중인 달은 아래 빌더가 `monthStatus`에서 이미 막는다.
 */
export function monthlyInsightSpokeBudget(insight: MonthlyInsight | null | undefined): boolean {
  if (!insight) return false;
  if (insight.monthStatus !== "complete") return false;
  return !(insight.shareableHeadline !== null && insight.hasComparison);
}

/**
 * 끝난 달의 예산 결과 한 줄. 말할 근거가 없으면 null(줄 없음).
 *
 * 문구는 두 갈래뿐이고 둘 다 사실 서술이다(DNC-018 해요체 — 평가·조언·죄책감 없음):
 *  - 지킨 달: `7월은 예산 200,000원의 78%를 썼어요`
 *  - 넘긴 달: `7월은 예산 200,000원보다 32,000원 많이 썼어요`
 *
 * 예산 금액을 함께 말하는 이유: 이 줄이 답하는 질문이 "지난달엔 **얼마로 정해 놓고** 지켰나"라,
 * 퍼센트만으로는 분모가 화면 어디에도 없다(그 달의 예산 화면은 이번 달만 고친다).
 */
export function buildCompletedMonthBudgetLine(input: CompletedMonthBudgetInput): string | null {
  if (input.monthStatus !== "complete") return null;
  if (typeof input.yearMonth !== "string" || !YEAR_MONTH_PATTERN.test(input.yearMonth)) return null;

  const spentKrw = normalizedAmount(input.totalExpenseKrw);
  // 지출이 하나도 없는 달에는 "얼마를 썼다"고 말할 것이 없다(인사이트 카드와 같은 게이트).
  if (spentKrw === null || spentKrw <= 0) return null;

  const budgetKrw = normalizedAmount(input.budgetAmountKrw);
  const progress = evaluateHomeBudgetProgress({ budgetKrw, spentKrw });
  if (!progress.hasBudget || progress.percent === null || budgetKrw === null) return null;

  const month = Number(input.yearMonth.slice(5, 7));
  const overBudgetKrw = spentKrw > budgetKrw ? spentKrw - budgetKrw : 0;
  return overBudgetKrw > 0
    ? `${month}월은 예산 ${formatKrw(budgetKrw)}보다 ${formatKrw(overBudgetKrw)} 많이 썼어요`
    : `${month}월은 예산 ${formatKrw(budgetKrw)}의 ${progress.percent}%를 썼어요`;
}
