import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";
import { formatKrw } from "../money";

/**
 * BUD-001(라운드 38 UX-M) — 월 예산 수정 화면(app/budget.tsx)의 **판단 근거** 순수 로직.
 *
 * 문제: 화면은 "현재 예산 1,600,000원" 한 줄과 빈 입력칸만 보여줬다. 예산을 올릴지 내릴지
 * 정하려면 사람이 알아야 하는 건 세 가지인데(이번 달 얼마 썼는지 · 남았는지 · 지난달엔 실제로
 * 얼마 썼는지) 화면에는 하나도 없어서, 사용자는 홈 → 리포트를 오가며 숫자를 외운 뒤 돌아와야
 * 했다. 여기서는 그 세 값을 **이미 캐시에 있는 데이터만으로** 문장·칩으로 만든다.
 *
 * ## 허위 표시 방지 규칙(이 모듈의 존재 이유)
 * - 사용액을 **모르면 줄을 만들지 않는다**(null). 캐시가 비어 있을 때 0원으로 떨어뜨리면
 *   화면이 "이번 달 지금까지 0원 사용"이라는, 확인한 적 없는 사실을 말하게 된다.
 *   (홈 히어로가 예산 미설정 달에 `amountKrw: 0`을 100%로 그리던 HOME-127과 같은 종류의 버그다.)
 * - 예산을 넘긴 달에 "남은 예산 0원"이라고 말하지 않는다. 남은 게 없는 것과 초과한 것은
 *   다른 사실이라, 초과분을 **중립 서술**로 밝힌다("예산보다 N원 더 썼어요"). 죄책감을 얹는
 *   표현("너무 많이 썼어요" 등)은 쓰지 않는다.
 * - 지난달 실지출 칩의 금액은 기록 탭·홈의 월 합계와 **같은 술어**
 *   (`countsTowardMonthlyTotal`, DNC-015 선물·환불 제외)로만 더한다. 여기서 규칙이 갈리면
 *   칩이 제안하는 "지난달 실지출"이 기록 탭이 보여준 지난달 합계와 어긋난다.
 *
 * React/react-native/네트워크에 의존하지 않는다 — 화면 밖에서 vitest로 검증하기 위해서다
 * (src/home/budget-progress.ts와 같은 관례).
 */

/** 조정 칩 한 번의 증감 폭(원). "-10만 / +10만". */
export const BUDGET_STEP_KRW = 100_000;

/**
 * 조정 칩으로 만들 수 있는 상한(원, 1억). 지출 프리셋 칩과 **같은 상한**을 쓴다
 * (src/expenses/amount-presets.ts `QUICK_AMOUNT_MAX_KRW`) — 반복 탭으로 금액이 발산하거나
 * 안전 정수 범위를 넘지 않게 하는 입력 보조용 클램프일 뿐, 서버 계약에는 상한이 없다.
 * 값을 여기 다시 적는 이유는 지출 입력 모듈(다른 트랙 소유)에 의존을 만들지 않기 위해서다.
 */
export const BUDGET_MAX_KRW = 100_000_000;

/** 숫자만 남긴 뒤 앞자리 0을 지운다. 숫자가 없으면 빈 문자열(= 아직 입력 없음). */
function normalizeDigits(digits: string): string {
  const onlyDigits = digits.replace(/[^0-9]/g, "");
  if (onlyDigits.length === 0) return "";
  return onlyDigits.replace(/^0+(?=\d)/, "");
}

function isUsableAmount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export type BudgetUsageLineInput = {
  /** 화면이 "현재 예산"으로 보여주고 있는 값(원). 예산 미설정이면 null. */
  budgetKrw: number | null | undefined;
  /**
   * 이번 달 사용액(원) — `["home", childId]` 캐시의 `monthly.usedAmountKrw`(선물·환불 제외,
   * DNC-015). **모르면 null/undefined를 넘겨야 한다**(0으로 바꿔 넘기지 말 것).
   */
  usedKrw: number | null | undefined;
};

/**
 * 현재 예산 카드 아래에 붙는 한 줄. 만들 수 없으면 null(줄 자체를 그리지 않는다).
 *
 * - 사용액을 모르면            → null
 * - 예산이 없으면(0 이하/미설정) → "이번 달 지금까지 1,245,700원 사용"
 * - 예산 이내면                → "이번 달 지금까지 1,245,700원 사용 · 남은 예산 354,300원"
 * - 예산을 넘겼으면            → "이번 달 지금까지 1,745,700원 사용 · 예산보다 145,700원 더 썼어요"
 *
 * 남은 금액·초과분은 **화면이 보여주고 있는 예산**에서 뺀다. 서버도 같은 값을
 * `remainingAmountKrw`로 주지만, 바로 위 카드의 "현재 예산"과 이 줄의 뺄셈이 한 소스에서
 * 나와야 "사용 + 남음 = 현재 예산"이 어긋날 여지가 없다(budget-progress.ts와 같은 판단).
 */
export function buildBudgetUsageLine(input: BudgetUsageLineInput): string | null {
  if (!isUsableAmount(input.usedKrw)) return null;
  const usedKrw = input.usedKrw;
  const usedText = `이번 달 지금까지 ${formatKrw(usedKrw)} 사용`;

  if (!isUsableAmount(input.budgetKrw) || input.budgetKrw <= 0) return usedText;
  const budgetKrw = input.budgetKrw;

  if (usedKrw > budgetKrw) {
    // 중립 서술: 사실(초과 금액)만 말하고 평가하지 않는다.
    return `${usedText} · 예산보다 ${formatKrw(usedKrw - budgetKrw)} 더 썼어요`;
  }
  return `${usedText} · 남은 예산 ${formatKrw(budgetKrw - usedKrw)}`;
}

/** 지난달 합계가 읽는 서버 캐시 행의 최소 모양(src/api/client.ts의 `Expense`가 그대로 대입된다). */
export type LastMonthExpenseLike = {
  /** 서버 지출 id. 아래 오프라인 재조정이 "로컬 변경이 걸린 낡은 서버 행"을 걸러낼 때만 쓴다. */
  id?: string;
  amountKrw: number;
  expenseType?: string | null;
};

export type LastMonthOfflineInput = {
  /** 오프라인 저장소 스냅숏의 전체 행. 아래에서 `childId`로 걸러 쓴다. */
  rows: readonly LocalExpenseRow[];
  childId: string | null;
  /** 위 서버 캐시가 담고 있는 달("YYYY-MM") — 대기 행을 그 달로 좁힌다. */
  yearMonth: string;
};

/**
 * 한 달 실지출 합계(원). `["expenses", childId, 그 달]` 캐시의 행을 받아 월 합계와 **같은
 * 술어**로만 더한다(DNC-015 선물·환불 제외). 캐시가 없으면 null을 넘기고 null을 돌려받는다.
 *
 * 라운드 38 H-1: 서버 원본 행만 더하면 기록 탭이 같은 달에 보여 주는 합계와 어긋난다 — 아직
 * 올라가지 않은 오프라인 대기 행이 빠지고, 삭제 대기 중인 행은 그대로 들어간다. 그래서 기록
 * 탭·입력 화면 맥락 줄과 **같은 함수**(`reconcileMonthlyExpenses`)를 통과시킬 수 있도록
 * `offline` 인자를 받는다. 넘기지 않으면 종전 동작 그대로다(서버 행만 합산).
 *
 * 라운드 39 I-6: 이번 달 사용액도 같은 규칙을 쓰기 위해 이름에서 "지난달"을 뺐다 — 지난달 항은
 * 재조정된 값이고 이번 달 항만 서버 집계라면, 한 화면의 두 숫자가 다른 모집단을 말하게 된다.
 * 호출부 가독성을 위해 `sumLastMonthActualKrw` / `sumThisMonthActualKrw` 두 이름으로도 내보낸다
 * (같은 함수다 — 규칙이 갈릴 자리를 만들지 않는다).
 */
export function sumMonthActualKrw(
  records: ReadonlyArray<LastMonthExpenseLike> | null | undefined,
  offline?: LastMonthOfflineInput
): number | null {
  if (!records) return null;
  // 재조정에 넘기기 전에 값이 깨진 행만 떨군다(합계가 NaN이 되는 쪽이 더 나쁜 거짓말이다).
  const usableRecords = records.filter((record) => Number.isFinite(record.amountKrw));

  if (!offline || !offline.childId) {
    let total = 0;
    for (const record of usableRecords) {
      if (!countsTowardMonthlyTotal(record.expenseType)) continue;
      total += record.amountKrw;
    }
    return total;
  }

  const childRows = offline.rows.filter((row) => row.childId === offline.childId);
  // id가 없는 행은 어떤 canonicalId와도 매칭되지 않는다(재조정은 빈 canonicalId를 집합에 넣지
  // 않는다) — 즉 "로컬 변경이 걸리지 않은 서버 행"으로 다뤄져 종전처럼 그대로 합산된다.
  const { monthlyTotalKrw } = reconcileMonthlyExpenses(
    usableRecords.map((record) => ({
      id: record.id ?? "",
      amountKrw: record.amountKrw,
      expenseType: record.expenseType ?? "expense"
    })),
    [...childRows],
    offline.yearMonth
  );
  return monthlyTotalKrw;
}

/** 지난달 실지출 합계 — 위 함수 그대로(칩의 근거가 되는 달). */
export const sumLastMonthActualKrw = sumMonthActualKrw;

/**
 * 이번 달 실지출 합계 — 위 함수 그대로.
 *
 * 라운드 39 I-6: 예산 화면의 "이번 달 지금까지 …" 줄은 서버 집계(`usedAmountKrw`)만 보고 있었다.
 * 같은 화면의 지난달 칩은 오프라인 대기 행까지 재조정한 값이라, 기록 탭·입력 맥락 줄과 정합인
 * 숫자 옆에 그렇지 않은 숫자가 나란히 놓였다(아직 올라가지 않은 지출이 이번 달에서만 빠진다).
 * 캐시가 있으면 이 함수의 값이 1순위이고, 캐시가 없을 때만 서버 집계로 폴백한다 — 알림에서
 * `/budget`으로 직행해 이번 달 목록을 한 번도 받지 않은 경로에서도 줄이 살아 있어야 하기 때문이다
 * (라운드 38 H-4).
 */
export const sumThisMonthActualKrw = sumMonthActualKrw;

/**
 * 라운드 40 J-4 — 이 달에 **아직 서버에 반영되지 않은 로컬 변경**이 실제로 있는가.
 *
 * 오프라인 스냅숏은 이 기기의 local_expenses 전체다. 그중 이 아이·이 달의 행 가운데 아직
 * 'synced'가 아닌 것이 하나라도 있으면(대기 중인 생성·수정, 삭제 대기, 실패, 충돌) 서버 집계는
 * 그 변경을 모르는 상태다 — 그때만 캐시 재조정 값이 서버 집계보다 정확하다.
 *
 * 삭제 대기 행도 포함된다: 그 행은 서버 목록에서 아직 살아 있는 지출을 가리므로, 재조정이
 * 그것을 빼 준 값이 사용자가 방금 만든 사실에 더 가깝다.
 */
export function hasPendingMonthAdjustments({ rows, childId, yearMonth }: LastMonthOfflineInput): boolean {
  if (!childId) return false;
  return rows.some(
    (row) =>
      row.childId === childId &&
      row.syncState !== "synced" &&
      typeof row.payload?.spentOn === "string" &&
      row.payload.spentOn.startsWith(yearMonth)
  );
}

export type ThisMonthUsedInput = {
  /** `["expenses", childId, 이번 달]` 캐시의 행. 캐시가 없으면 null/undefined. */
  cachedExpenses: ReadonlyArray<LastMonthExpenseLike> | null | undefined;
  /** 이 기기의 오프라인 스냅숏(아이·달로 좁혀 쓴다). */
  offline: LastMonthOfflineInput;
  /** 이 화면의 budget 응답 집계(`usedAmountKrw`). 예산 미설정이면 없다. */
  serverUsedKrw?: number | null;
  /** `["home", childId]` 캐시의 `monthly.usedAmountKrw`. 없으면 없다. */
  homeUsedKrw?: number | null;
};

/**
 * 이번 달 사용액으로 말할 값(원). 아무것도 모르면 undefined — 그러면 판단 줄 자체가 사라진다
 * (0원이라고 말하지 않는다).
 *
 * ## 우선순위와 그 이유(라운드 40 J-4)
 *
 * 라운드 39 I-6은 "지난달 칩은 재조정 값인데 이번 달만 서버 집계면 한 화면의 두 숫자가 다른
 * 모집단을 말한다"는 이유로 캐시 재조정 값을 **무조건** 1순위에 놓았다. 그런데 그 캐시는
 * 지난달의 낡은 목록이거나(다른 달을 보다가 들어온 경우) 아직 한 건도 못 받은 빈 목록일 수
 * 있다. 그때 재조정 결과는 0이고, 방금 서버에서 받아 온 집계(다른 기기에서 기록한 지출까지
 * 들어 있다)를 이겨서 "이번 달 지금까지 0원 사용"이라는 **허위 표시**를 만들었다.
 *
 * 그래서 캐시 우선은 I-6이 실제로 필요로 한 경우로 좁힌다 — 그 달에 아직 올라가지 않은 로컬
 * 변경이 **실제로 있을 때만**. 그런 행이 없으면 서버 집계가 항상 최소한 캐시만큼은 최신이다.
 *
 *  1. 대기 행이 있고 캐시도 있으면  → 재조정 값(서버가 아직 모르는 내 기록이 들어간다);
 *  2. 아니면 서버 집계(`usedAmountKrw`) → 홈 캐시(라운드 38 H-4의 직행 경로 폴백);
 *  3. 둘 다 없으면 캐시 합계(있으면), 그것도 없으면 undefined(줄을 그리지 않는다).
 */
export function resolveThisMonthUsedKrw({
  cachedExpenses,
  offline,
  serverUsedKrw,
  homeUsedKrw
}: ThisMonthUsedInput): number | undefined {
  const cachedTotalKrw = sumThisMonthActualKrw(cachedExpenses ?? null, offline);
  if (cachedTotalKrw !== null && hasPendingMonthAdjustments(offline)) return cachedTotalKrw;
  if (isUsableAmount(serverUsedKrw)) return serverUsedKrw;
  if (isUsableAmount(homeUsedKrw)) return homeUsedKrw;
  return cachedTotalKrw ?? undefined;
}

export type BudgetAdjustChip = {
  /** React key 및 테스트용 식별자. */
  id: "minus-step" | "plus-step" | "last-month" | "last-month-budget";
  /** 칩에 그리는 문구. */
  label: string;
  /** 스크린리더용 문장 — "-10만" 같은 축약이 소리로 뭉개지지 않게 따로 준다. */
  accessibilityLabel: string;
  /** 탭했을 때 입력칸에 들어갈 숫자 문자열(빈 문자열 없음). */
  nextDigits: string;
};

export type BudgetAdjustChipsInput = {
  /** 입력칸의 현재 숫자 문자열. 비어 있으면 "아직 안 고쳤다" = 현재 예산이 기준. */
  amountDigits: string;
  /** 현재 예산(원). 미설정이면 null — 그때 기준값은 0이다. */
  currentBudgetKrw: number | null | undefined;
  /** 지난달 실지출 합계(원). 캐시가 없으면 null → 그 칩은 만들지 않는다. */
  lastMonthActualKrw: number | null | undefined;
  /**
   * 라운드 48 B1 — 지난달에 **설정되어 있던 월 예산**(원). 조회하지 않았거나 지난달에도
   * 예산이 없었으면 null/undefined → 그 칩은 만들지 않는다(실지출 칩과 같은 규율).
   *
   * 실지출(`lastMonthActualKrw`)과는 다른 값이다: 하나는 "지난달에 실제로 쓴 돈",
   * 다른 하나는 "지난달에 스스로 정했던 한도"다. 매달 1일에 예산이 사라지는 이 앱에서
   * 사람이 가장 자주 하려는 일은 후자를 그대로 다시 세우는 것이라, 둘을 한 칩으로
   * 합치지 않고 각각의 사실을 각각의 라벨로 말한다.
   */
  lastMonthBudgetKrw?: number | null;
};

/**
 * 조정 칩이 기준으로 삼는 금액: 사용자가 뭔가 입력했으면 그 값, 아니면 현재 예산.
 * 둘 다 없으면 0(그 상태에서 "+10만"은 100,000원이 된다).
 */
export function budgetAdjustBaseKrw(amountDigits: string, currentBudgetKrw: number | null | undefined): number {
  const digits = normalizeDigits(amountDigits);
  if (digits.length > 0) {
    const typed = Number(digits);
    if (!Number.isSafeInteger(typed)) return BUDGET_MAX_KRW;
    return typed;
  }
  return isUsableAmount(currentBudgetKrw) ? Math.floor(currentBudgetKrw) : 0;
}

/**
 * 기준 금액에 delta를 더한 새 입력 문자열. 0 아래로는 내려가지 않고(0에서 멈춤) 상한에서도
 * 멈춘다 — "-10만"을 계속 눌러 음수 예산을 만들 수 없다.
 */
export function adjustBudgetDigits(
  amountDigits: string,
  currentBudgetKrw: number | null | undefined,
  deltaKrw: number
): string {
  const base = budgetAdjustBaseKrw(amountDigits, currentBudgetKrw);
  if (!Number.isFinite(deltaKrw)) return String(base);
  return String(Math.min(BUDGET_MAX_KRW, Math.max(0, base + Math.trunc(deltaKrw))));
}

/**
 * 화면에 그릴 조정 칩 목록.
 *
 * 지난달 칩은 **캐시가 있고 실지출이 0보다 클 때만** 만든다. 캐시가 없으면 근거가 없고,
 * 0원이면 "지난달 실지출(0원)로"라는 제안이 저장할 수 없는 값(0 이하)을 권하게 된다 —
 * 둘 다 칩을 감추는 편이 정직하다.
 *
 * 라운드 38 H-10: 실지출이 상한(1억)을 넘는 달도 칩을 감춘다. 종전에는 라벨에 원본 금액을
 * 적으면서 입력값만 상한으로 잘라, "지난달 실지출(120,000,000원)로"를 누르면 입력칸에
 * 100,000,000원이 들어갔다 — 칩이 약속한 금액과 실제로 들어가는 금액이 다른 것은 그 자체로
 * 허위 표시다. 자를 수 없으면 제안하지 않는다(이 상한은 입력 보조용 클램프일 뿐이고, 그런
 * 달은 애초에 이 칩의 용도인 "지난달만큼으로 맞추기"가 성립하지 않는다).
 *
 * ## 라운드 48 B1 — "지난달과 같은 N원으로 시작" 칩(이월 제안)
 *
 * 월 예산은 (childId, yearMonth) 유니크이고 이월 규칙이 없다. 그래서 매달 1일이면 예산이
 * 통째로 사라지고, 홈 진행바·경고·주간 알림이 한꺼번에 침묵한다. 서버나 앱이 지난달 값을
 * **몰래 복사해 새 달의 예산으로 만드는 것은 하지 않는다** — 사용자가 정한 적 없는 예산을
 * 앱이 지어내는 것이기 때문이다(허위 데이터 표시 금지). 대신 지난달 값을 **제안**으로만
 * 내놓고, 실제 생성은 사람이 칩을 눌러 저장할 때만 일어난다.
 *
 * 이 칩은 **이번 달 예산이 아직 없을 때만** 만든다. 이미 이번 달 예산이 있는 화면에서
 * "…으로 시작"은 참이 아니고(시작할 것이 없다), 그때 필요한 제안은 종전의 ±10만·실지출 칩이다.
 * 나머지 규칙(0원 제외·상한 초과 제외·라벨과 입력값이 같은 숫자에서 나온다)은 실지출 칩과
 * 똑같다 — 규율이 갈릴 자리를 만들지 않는다.
 */
export function buildBudgetAdjustChips(input: BudgetAdjustChipsInput): BudgetAdjustChip[] {
  const chips: BudgetAdjustChip[] = [
    {
      id: "minus-step",
      label: "-10만",
      accessibilityLabel: "10만 원 줄이기",
      nextDigits: adjustBudgetDigits(input.amountDigits, input.currentBudgetKrw, -BUDGET_STEP_KRW)
    },
    {
      id: "plus-step",
      label: "+10만",
      accessibilityLabel: "10만 원 늘리기",
      nextDigits: adjustBudgetDigits(input.amountDigits, input.currentBudgetKrw, BUDGET_STEP_KRW)
    }
  ];

  // 이월 제안은 "이번 달에 예산이 없다"는 상태에서만 성립한다(위 B1 주석).
  const lastMonthBudgetKrw = input.lastMonthBudgetKrw;
  const thisMonthHasBudget = isUsableAmount(input.currentBudgetKrw) && input.currentBudgetKrw > 0;
  if (
    !thisMonthHasBudget &&
    isUsableAmount(lastMonthBudgetKrw) &&
    lastMonthBudgetKrw > 0 &&
    lastMonthBudgetKrw <= BUDGET_MAX_KRW
  ) {
    const nextDigits = String(Math.floor(lastMonthBudgetKrw));
    const amountText = formatKrw(Number(nextDigits));
    // 예산이 없는 달에 사람이 가장 먼저 시도하는 값이라 맨 앞에 둔다(±10만은 그 뒤의 미세 조정).
    chips.unshift({
      id: "last-month-budget",
      label: `지난달과 같은 ${amountText}으로 시작`,
      accessibilityLabel: `지난달과 같은 ${amountText}으로 시작하기`,
      nextDigits
    });
  }

  const lastMonthKrw = input.lastMonthActualKrw;
  if (isUsableAmount(lastMonthKrw) && lastMonthKrw > 0 && lastMonthKrw <= BUDGET_MAX_KRW) {
    const nextDigits = String(Math.floor(lastMonthKrw));
    // 라벨과 입력값이 같은 숫자에서 나온다 — 칩이 약속한 금액이 곧 입력칸에 들어가는 금액이다.
    const amountText = formatKrw(Number(nextDigits));
    chips.push({
      id: "last-month",
      label: `지난달 실지출(${amountText})로`,
      accessibilityLabel: `지난달 실지출 ${amountText}으로 맞추기`,
      nextDigits
    });
  }

  return chips;
}
