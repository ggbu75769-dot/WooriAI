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
 *    같은 달을 두고 이 줄과 **기록 탭**이 다른 숫자를 말하게 된다.
 *    라운드 37 G-9(주석 정정): 이 줄이 지는 정합 계약은 **기록 탭 월 합계와의 일치**뿐이다.
 *    홈 히어로의 "이번 달 지출"은 /home 서버 집계(HomeSummary.monthly.usedAmountKrw)라 아직
 *    올라가지 않은 오프라인 대기 행이 들어 있지 않고, 그래서 이 줄과 정당하게 갈릴 수 있다
 *    (둘 다 자기 출처를 정확히 말하고 있다). 종전 주석은 홈까지 같은 숫자여야 하는 것처럼
 *    읽혀서, 그 차이를 결함으로 오해하게 만들었다.
 *  - **캐시가 없으면 줄 자체를 그리지 않는다**(null 반환). 콜드 스타트라 아직 아무것도 못
 *    받아 온 상태를 "0원 썼어요"로 말하면 그건 없는 사실을 만드는 것이다. 캐시가 있는데
 *    합계가 0이어도(첫 기록 전, 그 달이 전부 선물) 마찬가지로 줄을 생략한다 — 0원 한 줄은
 *    알려 주는 것이 없고, "0원"이 캐시 없음과 구분되지 않아 오해만 남긴다.
 *  - 기록하려는 **날짜의 달**을 말한다 — 그 달의 캐시를 손에 들고 있을 때만. 지난달 지출을
 *    적는 옆에 이번 달 합계를 붙이면 그 줄이 무엇의 합계인지 오해되므로, 말하는 달과 기록하는
 *    달은 언제나 같다. 손에 없는 달은 부르지 않고 그냥 침묵한다(아래 라운드 85 A).
 *
 * 라운드 85 A — **손에 든 달이 둘이 됐다**: 종전 주석은 지난달 침묵의 이유로 이 화면의 캐시가
 * 한 달치밖에 없다고 적어 두었는데, 그 문장은 GAP-058 #6 이후 거짓이다(그래서 지웠다 — 그
 * 문자열의 부재를 테스트가 문다). 같은
 * 화면이 `["expenses", childId, 지난달]` 캐시를 이미 `getQueryData`로 읽고 있고(app/expenses/
 * new.tsx — 자동완성·판매처 칩이 매달 1일에 통째로 사라지던 것을 고치면서 들어온 값 · 새 요청
 * 0건), 그 캐시를 채워 두는 것은 이 줄이 없앴어야 할 바로 그 이동(기록 탭에서 달 옮기기)이다.
 * 그래서 지난달 캐시와 그 달을 **선택 인자**로 받아, 기록 날짜가 그 달이면 그 달의 합계로 줄을
 * 세운다. 인자를 넘기지 않는 호출부의 결과는 종전과 한 글자도 같다(폴백).
 * ⚠️ **두 달보다 넓히지 않는다** — 셋째 달 캐시를 손에 든 화면은 오늘 0건이고, 없는 캐시를
 * 부르는 순간 이 모듈의 규칙("새 요청 0건")이 깨진다.
 *
 * 카테고리 항은 **지금 선택되어 있는 타일** 기준이다(화면에서 눌려 보이는 그 타일). 그 분류의
 * 그 달 합계가 0이면 항 자체를 붙이지 않는다 — 월 합계만 말하면 충분하고, "0원"은 위와
 * 같은 이유로 붙일 값이 아니다.
 *
 * 라운드 37 G-4 — 카테고리 항을 **말할 수 없는 달**: 카테고리 합산은 이 화면의 8타일이 쓰는
 * 고정 UUID(src/categories.ts `categoryCatalog`)와의 완전 일치로만 센다. 그런데 같은 달에
 * 엑셀 임포트·지출 수정 화면을 거친 행은 서버가 시드한 정식 카테고리 UUID(DB마다 다른 값)를
 * 달고 들어온다 — 그 행들은 어떤 타일에도 매칭되지 않아 카테고리 합계에서 통째로 빠지고,
 * 화면에는 실제보다 작은 "기저귀 68,000원"이 남는다(월 합계는 정확한데 카테고리 항만 과소).
 * 그래서 **모르면 말하지 않는다**: 그 달에 어느 타일로도 옮길 수 없는 categoryId를 가진 행이
 * 하나라도 있으면 카테고리 항을 통째로 생략하고 월 합계만 말한다(작은 숫자를 사실처럼 내놓는
 * 것보다 낫다). 분류가 아직 없는 행(categoryId 없음/빈 문자열)은 어느 타일의 합계도 갉아먹지
 * 않으므로 제외한다.
 *
 * 라운드 38 H-11 — 그 생략의 **범위를 좁힌다**: 서버 시드 UUID라고 해서 분류를 모르는 것은
 * 아니다. 화면이 이미 들고 있는 `["categories"]` 캐시가 `id -> code`를 알려 주므로, 공용 매핑
 * (`buildTileCategoryResolver`)을 `resolveTileCategory`로 넘겨 주면 임포트·수정 행도 제
 * 타일에 정상 합산된다. 생략은 **끝내 매핑되지 않는 행이 남을 때만** 한다(8타일에 대응이 없는
 * 분류, 임포트 스텁, 캐시가 아직 없는 콜드 스타트). 인자를 넘기지 않으면 종전처럼 타일 id 완전
 * 일치만 보는 규칙이고, 그때의 동작은 라운드 37 G-4 그대로다.
 *
 * 라운드 39 I-1 — **모호한 매핑도 "모른다"로 친다**: 서버 code 하나에 이 화면의 타일이 둘 걸린
 * 분류가 있다(`feeding_babyfood` = "분유/유제품" + "식비"). 매핑은 그런 행을 결정적으로 첫
 * 타일("분유/유제품")로 보내는데, 그 선택은 근거가 아니라 임의값이다 — 그런 행이 섞인 달에
 * "식비 30,000원"이라고 적으면 실제로는 분유 행이 빠진(또는 남의 행이 더해진) 숫자를 사실처럼
 * 말하게 된다. 그래서 합계를 말하는 이 경로에서만 `ambiguous` 결과를 매핑 실패와 똑같이 다뤄
 * G-4의 침묵으로 되돌린다. 프리필 경로(app/expenses/new.tsx의 "또 기록")는 합계를 말하지 않고
 * 어느 쪽이든 타일 하나를 골라야 하므로 종전의 결정적 선택을 그대로 쓴다.
 *
 * React/react-native에 의존하지 않으므로 vitest에서 그대로 단위 테스트한다
 * (이 저장소의 화면은 vitest에서 렌더할 수 없다 — src/expenses/month-expenses.test.ts 관례).
 */

import { categoryCatalog, type TileCategoryResolver } from "../categories";
import { formatKrw } from "../money";
import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";

/** 이 화면이 고를 수 있는 8타일의 고정 UUID — 이 집합 밖의 categoryId는 "알 수 없는 분류"다. */
const TILE_CATEGORY_IDS = new Set(categoryCatalog.map((entry) => entry.id));

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
  /**
   * 라운드 38 H-11: 행의 `categoryId`를 8타일 id로 옮기는 매핑(src/categories.ts
   * `buildTileCategoryResolver`). 넘기지 않으면 타일 id 완전 일치만 보는 종전 규칙이다.
   * 타일을 찾지 못한 행(`tileCategoryId: null`)이나 **어느 타일인지 확정할 수 없는 행**
   * (라운드 39 I-1, `ambiguous: true`)이 하나라도 있으면 카테고리 항 자체를 생략한다.
   */
  resolveTileCategory?: TileCategoryResolver;
  /**
   * 라운드 85 A(선택): `["expenses", childId, previousYearMonth]` 캐시의 `expenses`. 화면이 이미
   * 읽어 둔 그 값을 그대로 넘긴다(새 요청 0건). 넘기지 않거나 캐시가 없으면(콜드 스타트)
   * 지난달 갈래 자체가 서지 않는다 — 그때의 동작은 이 인자가 없던 때와 같다.
   */
  previousMonthExpenses?: EntryContextServerExpense[] | null;
  /** 라운드 85 A(선택): 위 캐시가 담고 있는 달("YYYY-MM"). */
  previousYearMonth?: string | null;
};

export type EntryContextLine = {
  /**
   * 화면에 보이는 문자열: "8월 지금까지 1,245,700원 · 기저귀 68,000원"
   * (지난달 날짜를 적는 중이면 끝난 달 문구다 — "7월에는 1,245,700원 썼어요 · 기저귀 68,000원")
   */
  text: string;
  /** 스크린리더용: 가운뎃점 대신 쉼표로 끊는다(src/expenses/recent-items.ts와 같은 관례). */
  accessibilityLabel: string;
};

/** 카테고리 합산이 실제로 세는 행의 최소 모양(서버 캐시 행·오프라인 대기 행 공통). */
type CountedCategoryRow = { categoryId: string; amountKrw: number; expenseType: string | null | undefined };

/** 매핑을 넘기지 않은 호출부의 기본 규칙 — 타일 id 완전 일치(라운드 37 G-4의 동작 그대로). */
const tileIdExactMatchOnly: TileCategoryResolver = (categoryId) => ({
  tileCategoryId: TILE_CATEGORY_IDS.has(categoryId) ? categoryId : null,
  ambiguous: false
});

/** 합산 단계에서 본 행 하나: 어느 타일로 갔는지와, 끝내 옮기지 못했는지. */
type ResolvedCategoryRow = { tileCategoryId: string | null; unknown: boolean; amountKrw: number };

/**
 * 라운드 37 G-4 + 38 H-11: 행의 분류를 8타일로 옮긴다. 분류가 아직 없는 행(빈 값)은 어느 타일의
 * 합계에서도 빠지지 않으므로 "알 수 없는 분류"로 치지 않는다 — 옮길 곳이 없을 뿐이다.
 *
 * 라운드 39 I-1: 매핑이 타일을 골라 주긴 했지만 그 선택이 임의값인 행(`ambiguous`)도 "알 수 없는
 * 분류"다. 그 행을 어느 타일에 넣든 그 타일의 합계는 사실이 아니게 된다.
 */
function resolveCategoryRow(row: CountedCategoryRow, resolve: TileCategoryResolver): ResolvedCategoryRow {
  const rawCategoryId = typeof row.categoryId === "string" ? row.categoryId : "";
  if (rawCategoryId.length === 0) return { tileCategoryId: null, unknown: false, amountKrw: row.amountKrw };
  const { tileCategoryId, ambiguous } = resolve(rawCategoryId);
  if (ambiguous) return { tileCategoryId: null, unknown: true, amountKrw: row.amountKrw };
  return { tileCategoryId, unknown: tileCategoryId === null, amountKrw: row.amountKrw };
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
  selectedCategory,
  resolveTileCategory,
  previousMonthExpenses,
  previousYearMonth
}: EntryContextLineInput): EntryContextLine | null {
  // 라운드 85 A — **말할 달을 고르는 한 줄.** 기록 날짜의 달이 지난달이고 그 달의 캐시가 손에
  // 있을 때만 지난달 갈래다(캐시가 없거나 인자가 없으면 false라 종전 동작 그대로). 그 밖의 달은
  // 아래에서 여전히 침묵한다 -- 손에 든 캐시가 두 달치뿐이므로 셋째 달은 모른다.
  const speaksPreviousMonth =
    entryYearMonth !== cacheYearMonth &&
    typeof previousYearMonth === "string" &&
    entryYearMonth === previousYearMonth &&
    Boolean(previousMonthExpenses);
  const targetYearMonth = speaksPreviousMonth ? (previousYearMonth as string) : cacheYearMonth;
  const targetMonthExpenses = speaksPreviousMonth ? previousMonthExpenses : cachedMonthExpenses;

  // 콜드 스타트: 아직 그 달 목록을 한 번도 못 받았다 -- 0원이라고 말하지 않고 침묵한다.
  if (!targetMonthExpenses) return null;
  if (!/^\d{4}-\d{2}$/.test(targetYearMonth)) return null;
  // 두 달 밖의 달(더 과거·미래)을 적는 중이면 손에 든 어느 합계도 이 화면의 맥락이 아니다.
  if (!speaksPreviousMonth && entryYearMonth !== cacheYearMonth) return null;

  const childRows = childId ? offlineRows.filter((row) => row.childId === childId) : [];
  // 기록 탭 월 합계와 **같은 함수**. 중복 제거(로컬 변경이 걸린 낡은 서버 행)와 선물·환불
  // 제외(DNC-015)가 여기 한 곳에서만 정해진다.
  const { visibleServerExpenses, offlinePendingRows, monthlyTotalKrw } = reconcileMonthlyExpenses(
    targetMonthExpenses,
    childRows,
    targetYearMonth
  );
  if (monthlyTotalKrw <= 0) return null;

  // 위 정규식이 통과한 뒤에만 잘라 낸다(형식이 깨진 달은 이미 침묵으로 빠졌다).
  const monthLabel = `${Number(targetYearMonth.slice(5, 7))}월`;
  // 라운드 85 A — "지금까지"는 **진행 중인 달**의 낱말이다. 이미 끝난 달에 그 말을 붙이면 아직
  // 늘어날 숫자처럼 읽힌다. 끝난 달은 completed-month-budget.ts의 관례대로 과거로 말한다.
  const monthPart = speaksPreviousMonth
    ? `${monthLabel}에는 ${formatKrw(monthlyTotalKrw)} 썼어요`
    : `${monthLabel} 지금까지 ${formatKrw(monthlyTotalKrw)}`;

  if (selectedCategory) {
    // 카테고리 항이 세는 행은 월 합계와 **같은 집합**이다 — 재조정을 거친 서버 행 + 로컬 대기 행,
    // 선물·환불 제외(DNC-015). 아래 두 판정(알 수 없는 분류 / 선택 분류 합계)이 같은 목록을 본다.
    const countedRows: CountedCategoryRow[] = [
      ...visibleServerExpenses,
      ...offlinePendingRows.map((row) => ({
        categoryId: row.payload.categoryId,
        amountKrw: row.payload.amountKrw,
        expenseType: row.payload.expenseType
      }))
    ].filter((row) => countsTowardMonthlyTotal(row.expenseType));
    // 라운드 38 H-11: 서버 시드 UUID(엑셀 임포트·수정 화면을 거친 행)는 매핑으로 제 타일에
    // 정상 합산한다. 그래도 옮길 곳이 없는 행이 하나라도 남으면 — 8타일에 대응이 없는 분류,
    // 캐시가 아직 없는 콜드 스타트, 또는 타일이 둘 걸린 code라 확정할 수 없는 행(라운드 39 I-1)
    // — 카테고리 합계를 믿을 수 없으므로(라운드 37 G-4) 틀린 숫자를 내놓느니 항을 생략한다.
    const resolvedRows = countedRows.map((row) =>
      resolveCategoryRow(row, resolveTileCategory ?? tileIdExactMatchOnly)
    );
    const categoryTotalKrw = resolvedRows.some((row) => row.unknown)
      ? 0
      : resolvedRows
          .filter((row) => row.tileCategoryId === selectedCategory.id)
          .reduce((sum, row) => sum + row.amountKrw, 0);
    if (categoryTotalKrw > 0) {
      const categoryPart = `${selectedCategory.label} ${formatKrw(categoryTotalKrw)}`;
      return { text: `${monthPart} · ${categoryPart}`, accessibilityLabel: `${monthPart}, ${categoryPart}` };
    }
  }

  return { text: monthPart, accessibilityLabel: monthPart };
}
