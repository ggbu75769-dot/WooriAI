/**
 * UX-K(A) — 지출 입력 시점에 보여 주는 "이번 달 지금까지" 한 줄의 순수 계산.
 *
 * 왜 여기서 계산하나: 기록 시트(app/expenses/new.tsx)는 이미 홈/기록 탭이 채워 둔
 * `["expenses", childId, 이번 달]` 캐시를 `getQueryData`로 **읽기만** 한다(UX-C 자동 추천·
 * 자동완성과 같은 소스, 네트워크 0). 그 캐시가 손에 있는 김에, 금액을 치는 그 순간에
 * "이번 달에 지금까지 얼마 썼는지"를 한 줄로 보여 주면 사용자가 탭을 옮기지 않고도 총액을
 * 확인할 수 있다(핵심 루프의 '총액 확인'을 입력 화면 안으로 당겨오는 것).
 *
 * 절대 규칙(허위 표시 금지):
 *  - 합계 규칙은 **한 벌뿐**이다. 기록 탭 월 합계와 똑같이 `reconcileMonthlyExpenses`
 *    (src/offline/expense-list-reconciliation.ts)를 그대로 통과시킨다 — 로컬 변경이 걸린 낡은
 *    서버 행은 숨기고, 아직 올라가지 않은 로컬 대기 행은 더한다. 선물·환불 제외(DNC-015)도
 *    같은 술어(`countsTowardMonthlyTotal`)에서만 온다. 여기서 합계를 다시 손으로 쓰면
 *    같은 달을 두고 이 줄과 홈/기록 탭이 다른 숫자를 말하게 된다.
 *  - **캐시가 없으면 줄 자체를 그리지 않는다**(null 반환). 콜드 스타트라 아직 아무것도 못
 *    받아 온 상태를 "0원 썼어요"로 말하면 그건 없는 사실을 만드는 것이다. 캐시가 있는데
 *    합계가 0이어도(첫 기록 전, 그 달이 전부 선물) 마찬가지로 줄을 생략한다 — 0원 한 줄은
 *    알려 주는 것이 없고, "0원"이 캐시 없음과 구분되지 않아 오해만 남긴다.
 *  - 기록하려는 **날짜의 달**이 캐시의 달과 다르면(지난달 지출을 뒤늦게 입력하는 경우)
 *    역시 생략한다. 이 화면이 가진 캐시는 이번 달 한 달치뿐이라 지난달 맥락을 말할 수
 *    없고, 지난달 지출을 적는 옆에 이번 달 합계를 붙이면 그 줄이 무엇의 합계인지 오해된다.
 *
 * 카테고리 항은 **지금 선택되어 있는 타일** 기준이다(화면에서 눌려 보이는 그 타일). 그 분류의
 * 이번 달 합계가 0이면 항 자체를 붙이지 않는다 — 월 합계만 말하면 충분하고, "0원"은 위와
 * 같은 이유로 붙일 값이 아니다.
 *
 * React/react-native에 의존하지 않으므로 vitest에서 그대로 단위 테스트한다
 * (이 저장소의 화면은 vitest에서 렌더할 수 없다 — src/expenses/month-expenses.test.ts 관례).
 */

import { formatKrw } from "../money";
import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";

/** 이 모듈이 서버 캐시 행에서 실제로 읽는 필드 — src/api/client.ts의 `Expense`가 그대로 대입된다. */
export type EntryContextServerExpense = {
  id: string;
  categoryId: string;
  amountKrw: number;
  expenseType: string;
};

export type EntryContextLineInput = {
  /**
   * `["expenses", childId, cacheYearMonth]` 캐시의 `expenses`. 캐시가 아예 없으면
   * `undefined`/`null`을 그대로 넘긴다 — 빈 배열로 바꿔 넘기지 말 것(그 둘은 "아직 모른다"와
   * "이번 달 기록이 없다"로 의미가 다르고, 이 함수는 앞의 경우에만 줄을 생략할 수 있다).
   */
  cachedMonthExpenses: EntryContextServerExpense[] | null | undefined;
  /** 위 캐시가 담고 있는 달("YYYY-MM"). */
  cacheYearMonth: string;
  /** 지금 기록하려는 지출 날짜의 달("YYYY-MM"). */
  entryYearMonth: string;
  /** 오프라인 저장소 스냅숏의 전체 행 — 아래에서 `childId`로 걸러 쓴다. */
  offlineRows: LocalExpenseRow[];
  childId: string | null;
  /** 지금 선택된 카테고리 타일. 선택이 없으면 null(월 합계만 말한다). */
  selectedCategory: { id: string; label: string } | null;
};

export type EntryContextLine = {
  /** 화면에 보이는 문자열: "8월 지금까지 1,245,700원 · 기저귀 68,000원" */
  text: string;
  /** 스크린리더용: 가운뎃점 대신 쉼표로 끊는다(src/expenses/recent-items.ts와 같은 관례). */
  accessibilityLabel: string;
};

function sumCategory(
  rows: { categoryId: string; amountKrw: number; expenseType: string | null | undefined }[],
  categoryId: string
): number {
  return rows
    .filter((row) => row.categoryId === categoryId && countsTowardMonthlyTotal(row.expenseType))
    .reduce((sum, row) => sum + row.amountKrw, 0);
}

/**
 * 입력 화면에 붙일 맥락 한 줄을 만든다. 그릴 것이 없으면 `null`(줄 자체를 생략).
 */
export function buildEntryContextLine({
  cachedMonthExpenses,
  cacheYearMonth,
  entryYearMonth,
  offlineRows,
  childId,
  selectedCategory
}: EntryContextLineInput): EntryContextLine | null {
  // 콜드 스타트: 아직 이번 달 목록을 한 번도 못 받았다 -- 0원이라고 말하지 않고 침묵한다.
  if (!cachedMonthExpenses) return null;
  if (!/^\d{4}-\d{2}$/.test(cacheYearMonth)) return null;
  // 지난달 지출을 뒤늦게 적는 중이면 이번 달 합계는 이 화면의 맥락이 아니다.
  if (entryYearMonth !== cacheYearMonth) return null;

  const childRows = childId ? offlineRows.filter((row) => row.childId === childId) : [];
  // 기록 탭 월 합계와 **같은 함수**. 중복 제거(로컬 변경이 걸린 낡은 서버 행)와 선물·환불
  // 제외(DNC-015)가 여기 한 곳에서만 정해진다.
  const { visibleServerExpenses, offlinePendingRows, monthlyTotalKrw } = reconcileMonthlyExpenses(
    cachedMonthExpenses,
    childRows,
    cacheYearMonth
  );
  if (monthlyTotalKrw <= 0) return null;

  const monthLabel = `${Number(cacheYearMonth.slice(5, 7))}월`;
  const monthPart = `${monthLabel} 지금까지 ${formatKrw(monthlyTotalKrw)}`;

  if (selectedCategory) {
    const categoryTotalKrw =
      sumCategory(visibleServerExpenses, selectedCategory.id) +
      sumCategory(
        offlinePendingRows.map((row) => ({
          categoryId: row.payload.categoryId,
          amountKrw: row.payload.amountKrw,
          expenseType: row.payload.expenseType
        })),
        selectedCategory.id
      );
    if (categoryTotalKrw > 0) {
      const categoryPart = `${selectedCategory.label} ${formatKrw(categoryTotalKrw)}`;
      return { text: `${monthPart} · ${categoryPart}`, accessibilityLabel: `${monthPart}, ${categoryPart}` };
    }
  }

  return { text: monthPart, accessibilityLabel: monthPart };
}
