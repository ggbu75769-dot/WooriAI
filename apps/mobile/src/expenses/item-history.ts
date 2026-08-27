/**
 * 라운드 41 UX-U(B-ⓓ) — 지출 상세(app/expenses/[expenseId].tsx)의 "이 품목 이력" 섹션.
 *
 * 무엇을 위한 것인가: 상세 화면은 지금까지 "수정 폼 + 저장/삭제"뿐이라, 열어 봐야 이미 아는
 * 값만 다시 보였다. 같은 품목을 이번 달에 몇 번 · 얼마에 샀는지가 그 자리에 있으면 "이 금액이
 * 평소보다 비싼가?"를 화면을 옮기지 않고 판단할 수 있다(핵심 루프의 '총액 확인'을 상세 화면
 * 안으로 당겨오는 것 — 입력 시트의 UX-K(A) 맥락 한 줄과 같은 생각이다).
 *
 * 절대 규칙 — **새 요청을 만들지 않는다**:
 *  - 원천은 홈/기록 탭이 이미 채워 둔 `["expenses", childId, 이번 달]` 캐시를 `getQueryData`로
 *    **읽기만** 한 값이다(useQuery 금지). known-limitations H(비용 증가 금지)와, 같은 캐시를
 *    같은 방식으로 읽는 app/expenses/new.tsx의 관례를 그대로 따른다.
 *  - 캐시가 없으면(콜드 스타트, 다른 아이, 오프라인 첫 실행) 섹션 **자체를 생략**한다. 없는 것을
 *    "이력 없음"으로 말하면 그건 사실이 아니다 — 아직 모를 뿐이다(entry-context-line.ts와 같은 판단).
 *  - 이번 달 캐시 한 달치만 보므로 **범위를 반드시 밝힌다**(라운드 39 UX-P 검색 범위 고지 관례).
 *    범위를 말하지 않으면 "지난달에 더 싸게 샀는데 안 보인다"가 조용한 허위 표시가 된다.
 *
 * ## 무엇을 "같은 품목"으로 보는가 (라운드 41 K-11 ②)
 * **정규화 후 이름이 같은 것만**이다(`normalizeItemName` — 앞뒤/내부 공백 제거 + 소문자화, 그래서
 * "물 티슈"와 "물티슈"는 같은 품목이다). 정규화 자체는 새로 만들지 않고 UX-C의 단일 소스
 * (src/expenses/item-name-match.ts)를 그대로 쓴다.
 *
 * 그런데 그 모듈의 **느슨한 등급**(prefix/contains/containedBy)은 여기서 쓰지 않는다 — 목적이
 * 다르기 때문이다. 자동완성·카테고리 추천은 "지금 치고 있는 글자로 후보를 넓게 건져 올리는" 일이라
 * 조금 넘치게 걸리는 편이 낫다(사용자가 고르지 않으면 그만이다). 이 섹션은 반대로 **이미 확정된
 * 품목의 값을 판단하는 근거**라, "기저귀 크림" 상세에 "기저귀" 기록이 이력으로 섞이면 사용자는
 * 다른 물건의 단가로 이 지출이 비싼지 싼지를 판단하게 된다 — 그건 표시 자체가 근거 없는 비교다.
 * 그래서 넘치게 거는 대신 **정확히 같은 이름만** 센다(없으면 섹션을 생략한다).
 *
 * ## 모집단 (라운드 41 K-11 ①)
 * "이번 달 기록 기준"이라고 말하려면 이 기기가 아는 이번 달 기록이 전부 들어와야 한다. 서버
 * 캐시 원본만 보면 아직 올라가지 않은 대기 행·실패 행·충돌 행이 빠지고(방금 오프라인으로 남긴
 * 같은 품목 기록이 이력에 없다), 로컬에서 수정한 서버 행은 **바뀌기 전 금액**으로 보인다.
 * 그래서 기록 탭·홈 주간 카드·예산 화면과 **같은 함수**(`reconcileMonthlyExpenses`)를 지나게
 * `offline` 인자를 받는다. 넘기지 않으면 종전 동작 그대로다(서버 캐시만).
 *
 * React/react-native에 의존하지 않으므로 vitest에서 그대로 단위 테스트한다.
 */

import { formatKrw } from "../money";
import { reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";
import { normalizeItemName, sortByRecency } from "./item-name-match";

/** 한 번에 보여 주는 최대 건수. 상세 화면의 보조 정보라 스크롤을 차지하지 않을 만큼만 든다. */
export const ITEM_HISTORY_MAX_ROWS = 3;

/** 섹션 제목. */
export const ITEM_HISTORY_TITLE = "이 품목 이력";

/** 이 모듈이 캐시 행에서 실제로 읽는 필드 — src/api/client.ts의 `Expense`가 그대로 대입된다. */
export type ItemHistoryExpense = {
  id: string;
  itemName: string;
  amountKrw: number;
  spentOn: string;
  /**
   * 선물·환불 구분. 이 섹션은 값을 **더하지 않고 나열만** 하므로 걸러 쓰지 않는다(선물로 받은
   * 같은 품목의 기록도 "언제 · 얼마"라는 사실이고, 빼면 이력에 구멍이 생긴다). 필드를 받아 두는
   * 이유는 아래 오프라인 재조정이 서버 행 모양에 이 이름을 요구하기 때문이다 — 그쪽이 계산하는
   * 월 합계는 여기서 쓰지 않는다.
   */
  expenseType?: string | null;
};

/**
 * 라운드 41 K-11 ① — 이 기기의 오프라인 스냅숏(`useOfflineSyncSnapshot().rows`)과 그 주인.
 * 예산 화면의 `LastMonthOfflineInput`과 같은 모양이다(src/home/budget-edit.ts) — 달은 위
 * `cacheYearMonth`가 이미 말하므로 여기서 다시 받지 않는다.
 */
export type ItemHistoryOfflineInput = {
  rows: readonly LocalExpenseRow[];
  /** 지금 보고 있는 지출의 아이. 모르면 null — 그때는 재조정하지 않는다(남의 행을 섞지 않는다). */
  childId: string | null;
};

export type ItemHistoryRow = {
  /** 캐시 행의 지출 id — 화면의 key이자 "자기 자신 제외" 판정의 기준. */
  id: string;
  /** "8월 12일" */
  dateLabel: string;
  /** "12,000원" */
  amountLabel: string;
  /** 과거에 적힌 품목명 그대로(부분일치라 지금 이름과 다를 수 있다 — 그대로 보여 준다). */
  itemName: string;
  /** 스크린리더용: 가운뎃점 대신 쉼표로 끊는다(src/expenses/recent-items.ts와 같은 관례). */
  accessibilityLabel: string;
};

export type ItemHistory = {
  title: string;
  /** "이번 달(8월) 기록 기준이에요" — 이 목록이 무엇을 보고 만든 것인지 밝히는 줄. */
  scopeNotice: string;
  rows: ItemHistoryRow[];
};

export type ItemHistoryInput = {
  /**
   * `["expenses", childId, cacheYearMonth]` 캐시의 `expenses`. 캐시가 아예 없으면
   * `undefined`/`null`을 그대로 넘긴다 — 빈 배열로 바꿔 넘기지 말 것("아직 모른다"와 "이번 달
   * 기록이 없다"는 다르고, 앞의 경우에만 섹션을 생략할 수 있다).
   */
  cachedMonthExpenses: ItemHistoryExpense[] | null | undefined;
  /** 위 캐시가 담고 있는 달("YYYY-MM"). 범위 고지 문구가 이 값에서 나온다. */
  cacheYearMonth: string;
  /** 지금 화면에서 편집 중인 품목명(입력 중인 값). */
  itemName: string;
  /** 지금 보고 있는 지출의 id — 이력에 자기 자신이 끼면 "이력이 있다"는 착시가 생긴다. */
  currentExpenseId: string;
  /**
   * 라운드 41 K-11 ①: 이 기기의 오프라인 대기·실패·충돌 행. 넘기지 않으면 종전대로 서버 캐시만
   * 본다(호출부가 스냅숏을 아직 못 읽은 경우에도 섹션이 조용히 사라지지 않는다).
   */
  offline?: ItemHistoryOfflineInput;
  /** 최대 건수. 기본값 ITEM_HISTORY_MAX_ROWS. */
  maxRows?: number;
};

/** "2026-08-12" -> "8월 12일". 형식이 다르면 원본을 그대로 돌려준다(지어내지 않는다). */
function formatSpentOnLabel(spentOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(spentOn ?? "");
  if (!match) return spentOn ?? "";
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

/** "2026-08" -> "이번 달(8월) 기록 기준이에요". 달을 모르면 달 표기 없이 범위만 밝힌다. */
export function itemHistoryScopeNotice(cacheYearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(cacheYearMonth ?? "");
  if (!match) return "이번 달 기록 기준이에요";
  return `이번 달(${Number(match[2])}월) 기록 기준이에요`;
}

/**
 * 라운드 41 K-11 ① — 이번 달 모집단 한 벌. 서버 캐시 행에서 로컬 변경이 걸린 낡은 행을 빼고,
 * 아직 올라가지 않은 행(대기·실패·충돌)을 그 자리에 넣는다. 규칙은 기록 탭·홈 주간 카드가 쓰는
 * `reconcileMonthlyExpenses` 하나뿐이라 화면마다 다른 모집단이 생기지 않는다.
 */
function itemHistoryPopulation(
  cachedMonthExpenses: ItemHistoryExpense[],
  cacheYearMonth: string,
  offline?: ItemHistoryOfflineInput
): ItemHistoryExpense[] {
  if (!offline || !offline.childId) return cachedMonthExpenses;
  const childRows = offline.rows.filter((row) => row.childId === offline.childId);
  const { visibleServerExpenses, offlinePendingRows } = reconcileMonthlyExpenses(
    cachedMonthExpenses.map((expense) => ({ ...expense, expenseType: expense.expenseType ?? "expense" })),
    [...childRows],
    cacheYearMonth
  );
  return [
    ...visibleServerExpenses,
    ...offlinePendingRows.map((row) => ({
      // 아직 서버 id가 없는 신규 행은 로컬 id로 식별한다. 그 값은 어떤 서버 지출 id와도 같을 수
      // 없으므로 "자기 자신 제외" 판정을 흐리지 않고, 화면의 key로도 그대로 쓸 수 있다.
      // 서버 행을 로컬에서 고친 행은 canonicalId를 그대로 들고 오므로, 지금 보고 있는 지출을
      // 편집 중이라면 그 행이 정확히 "자기 자신"으로 걸러진다.
      id: row.canonicalId ?? `local:${row.localId}`,
      itemName: row.payload.itemName,
      amountKrw: row.payload.amountKrw,
      spentOn: row.payload.spentOn,
      expenseType: row.payload.expenseType ?? "expense"
    }))
  ];
}

/**
 * 같은 품목의 최근 기록을 만든다. 그릴 것이 없으면 `null`(섹션 자체를 생략).
 *
 * 걸리는 것은 **정규화 후 이름이 정확히 같은 기록**뿐이고(위 헤더 K-11 ② 참고), 정렬은 최신순이다.
 */
export function buildItemHistory({
  cachedMonthExpenses,
  cacheYearMonth,
  itemName,
  currentExpenseId,
  offline,
  maxRows = ITEM_HISTORY_MAX_ROWS
}: ItemHistoryInput): ItemHistory | null {
  // 콜드 스타트: 이번 달 목록을 아직 한 번도 못 받았다 -- "이력 없음"이라고 말하지 않고 침묵한다.
  if (!cachedMonthExpenses) return null;
  const normalizedItemName = normalizeItemName(itemName);
  if (normalizedItemName.length === 0) return null;
  if (maxRows <= 0) return null;

  const matched = sortByRecency(itemHistoryPopulation([...cachedMonthExpenses], cacheYearMonth, offline))
    .filter((row) => row.id !== currentExpenseId)
    .filter((row) => normalizeItemName(row.itemName ?? "") === normalizedItemName)
    .slice(0, maxRows);

  if (matched.length === 0) return null;

  const rows: ItemHistoryRow[] = matched.map((row) => {
    const dateLabel = formatSpentOnLabel(row.spentOn);
    const amountLabel = formatKrw(row.amountKrw);
    return {
      id: row.id,
      dateLabel,
      amountLabel,
      itemName: row.itemName,
      accessibilityLabel: `${dateLabel}, ${row.itemName}, ${amountLabel}`
    };
  });

  return { title: ITEM_HISTORY_TITLE, scopeNotice: itemHistoryScopeNotice(cacheYearMonth), rows };
}
