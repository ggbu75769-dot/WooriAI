import { formatKrw } from "../money";
import { isDateOnly } from "./day-math";
import { daysInYearMonth } from "./last-month-comparison";

/**
 * 기능 라운드 1 트랙 A — 홈 "월말 예상 지출(예산 페이스)" 카드의 판정·문구.
 *
 * 지금 홈의 예산 이야기는 전부 **사후 통보**다: 80%/100% 경고(budget-warning.ts)는 문턱에
 * *도달한 뒤* 서고, 히어로의 남은 예산도 오늘까지의 사실만 말한다. 이 모듈은 이번 달 지출
 * 페이스(사용액 ÷ 경과일 × 월일수)로 월말을 **앞서** 내다본다 — 초과 *전에* 소비를 조절할 수
 * 있는 유일한 숫자다(docs/5차/feature-round1-design.md 트랙 A · budget-app-gap-analysis.md).
 *
 * ## 문구 경계 (budget-warning.ts와의 분업 — 그 파일은 비접촉)
 * - 초과 **사실**("예산을 N원 초과했어요")은 경고 배너의 소유다. 이 모듈은 초과 **예상**
 *   ("~ 넘길 것 같아요")만 말하고, 이미 예산을 다 쓴 달(spent >= budget, 배너의 reached100과
 *   같은 부등호)에는 아예 서지 않는다 — 확정 사실이 서 있는 옆에서 같은 얘기를 추정형으로
 *   반복하면 문구 중복이고, 지난 일을 "예상"이라 부르는 허위가 된다.
 * - 추정임을 문장에 못 박는다("이 속도면 ~ 것 같아요"). 확정 수치(사용액·초과액)는 기존 카드
 *   소유라 여기서 다시 말하지 않는다(허위 데이터 금지 — 설계 §2).
 * - "아껴 쓰세요" 같은 지출 억제 권고는 쓰지 않는다(설계 "하지 않는 것" · DNC-018의 톤 경계
 *   — 관측만 말하고 평가하지 않는다).
 *
 * ## 표시 규칙 (설계가 정한 넷 — 전부 이 모듈이 판정한다)
 * 1. **예산이 있는 달만**: /home은 예산 미설정 달에 monthly.amountKrw: 0을 주므로(HOME-127의
 *    입력 계약 그대로) 0/음수/비정상은 전부 "예산 없음 → 숨김"이다.
 * 2. **경과 3일 미만 숨김**: 1~2일치 지출로 한 달을 외삽하면 하루짜리 큰 지출(예: 유모차)이
 *    "월말 3,000만 원"이 된다 — 표본 부족은 지어낸 숫자다(last-month-comparison.ts의
 *    PERCENT_MIN_COMPARED_DAYS와 같은 계열의 판단).
 * 3. **이미 100% 도달이면 숨김**: 위 문구 경계 그대로.
 * 4. **반올림은 천원 단위**: 원 단위 예측은 정밀해 보이는 만큼 거짓말이다 — 추정값의 표기
 *    정밀도를 실제 확신 수준에 맞춘다.
 *
 * 여기에 정직성 게이트 둘을 더한다(같은 "지어내지 않는다" 규칙의 귀결):
 * - **이번 달이 아니면 숨김**: monthly.yearMonth와 오늘(서울)의 달이 다르면 "경과일"이라는
 *   개념 자체가 서지 않는다(자정 직후 캐시 잔상·시계 이상 포함).
 * - **기록 0원이면 숨김**: 페이스 0으로 "예산 안에서 마무리될 것 같아요"라고 말하는 것은
 *   데이터가 아니라 침묵을 외삽한 것이다. 빈 홈의 다음 걸음은 첫 실행 안내가 이미 말한다.
 *
 * ## 산술 (나눗셈 정수 규율)
 * 금액은 전부 정수 KRW다(DNC-013). 외삽은 `spent × 월일수`를 먼저 곱한 뒤 한 번만 나누고
 * Math.round로 정수화한다 — 나눗셈을 먼저 하면 중간값이 부동소수가 되어 곱한 순서에 따라
 * 1원이 갈린다. 그 위에 천원 반올림을 얹으므로 결과는 언제나 1,000의 배수다. 월일수는
 * last-month-comparison.ts의 daysInYearMonth(윤년 포함, Date.UTC — iso-week.ts와 같은 규율)를
 * 재사용한다(읽기 전용 import — 두 벌로 적으면 2월에서 갈린다).
 *
 * 왜 순수 모듈인가: 이 저장소의 확립된 규율 그대로다(설계 §3 공통 관례) — vitest는 RN을 렌더할
 * 수 없으므로 판정·문구는 여기서 단위 테스트로 고정하고, 화면(app/(tabs)/index.tsx)은 그리기만
 * 한다. 배선은 budget-pace.test.ts의 소스 계약이 잡는다.
 */

/** 표본 부족 게이트: 이 일수 미만이면 카드가 서지 않는다(표시 규칙 2). */
const MIN_ELAPSED_DAYS = 3;

/** 추정값의 표기 정밀도(표시 규칙 4): 천원 단위 반올림. */
const PROJECTION_ROUNDING_KRW = 1000;

export type BudgetPaceOutlook = "within" | "over";

export type BudgetPaceForecast = {
  outlook: BudgetPaceOutlook;
  /** 페이스 외삽 월말 예상 지출(원) — 항상 1,000의 배수. */
  projectedKrw: number;
  /** 예상 초과액(원). within이면 0. */
  overKrw: number;
  /** 오늘까지의 경과일(오늘 포함, 1일 = 1). */
  elapsedDays: number;
  /** 이번 달의 총 일수(윤년 반영). */
  daysInMonth: number;
  /** 카드 제목 — 추정임을 문장이 직접 말한다("~ 것 같아요"). */
  title: string;
  /** 근거 한 줄(어림의 재료: 경과일과 예상값). */
  body: string;
  /** 낭독 라벨 — 값에서 파생한다(제목 + 근거). */
  accessibilityLabel: string;
};

export type BudgetPaceInput = {
  /** HomeSummary.monthly.yearMonth ("YYYY-MM" — 서버가 "YYYY-MM-DD"로 줘도 앞 7자로 맞춘다). */
  yearMonth: string | null | undefined;
  /** HomeSummary.monthly.amountKrw — 0/nullish는 "예산 미설정"(HOME-127 입력 계약). */
  budgetKrw: number | null | undefined;
  /** 선물 제외 이번 달 누계(DNC-015) — 홈이 이미 재조정해 쓰는 monthlyUsed 그대로. */
  spentKrw: number | null | undefined;
  /** 서울 기준 오늘("YYYY-MM-DD") — 화면은 @wooriai/domain의 getSeoulToday()를 넘긴다. */
  todayIso: string;
};

/** `raw`를 천원 단위로 반올림한다(항상 1,000의 배수 · 음수 입력은 호출부가 이미 걸렀다). */
function roundToThousand(raw: number): number {
  return Math.round(raw / PROJECTION_ROUNDING_KRW) * PROJECTION_ROUNDING_KRW;
}

/**
 * 홈 월말 예상 카드 한 장을 만든다. 표시 규칙(위 헤더)에 하나라도 걸리면 null — 그 자리는
 * 비어 있고, 화면은 이유를 다시 판정하지 않는다.
 */
export function evaluateBudgetPace(input: BudgetPaceInput): BudgetPaceForecast | null {
  if (!isDateOnly(input.todayIso)) return null;
  if (typeof input.yearMonth !== "string") return null;

  // 이번 달이 아니면(캐시 잔상·미래월) "경과일"이 서지 않는다 — 지어내지 않는다.
  const monthKey = input.yearMonth.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  if (input.todayIso.slice(0, 7) !== monthKey) return null;

  // 예산 미설정(/home의 amountKrw: 0 포함) → 비교할 기준이 없다.
  const budgetKrw = input.budgetKrw;
  if (typeof budgetKrw !== "number" || !Number.isFinite(budgetKrw) || budgetKrw <= 0) return null;

  // 기록 0원 → 침묵을 외삽하지 않는다. 음수/비정상도 같은 이유로 숨김.
  const spentKrw = input.spentKrw;
  if (typeof spentKrw !== "number" || !Number.isFinite(spentKrw) || spentKrw <= 0) return null;

  // 이미 예산을 다 쓴 달 — 초과 "사실"은 경고 배너의 소유다(reached100과 같은 >= 경계).
  if (spentKrw >= budgetKrw) return null;

  const elapsedDays = Number(input.todayIso.slice(8, 10));
  if (!Number.isInteger(elapsedDays) || elapsedDays < MIN_ELAPSED_DAYS) return null;

  const daysInMonth = daysInYearMonth(monthKey);
  if (!Number.isInteger(daysInMonth) || daysInMonth < elapsedDays) return null;

  // 곱을 먼저, 나눗셈은 한 번만(정수 규율 — 위 헤더 "산술").
  const projectedKrw = roundToThousand((spentKrw * daysInMonth) / elapsedDays);
  const overKrw = Math.max(0, projectedKrw - budgetKrw);
  const outlook: BudgetPaceOutlook = overKrw > 0 ? "over" : "within";

  const title =
    outlook === "over"
      ? `이 속도면 이번 달 예산을 약 ${formatKrw(overKrw)} 넘길 것 같아요`
      : "이 속도면 이번 달 예산 안에서 마무리될 것 같아요";
  const body = `${elapsedDays}일까지의 지출로 어림한 월말 예상 지출은 약 ${formatKrw(projectedKrw)} 수준이에요`;

  return {
    outlook,
    projectedKrw,
    overKrw,
    elapsedDays,
    daysInMonth,
    title,
    body,
    accessibilityLabel: `${title}. ${body}`
  };
}
