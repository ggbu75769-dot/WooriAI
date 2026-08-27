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
 * 매칭 규칙은 새로 만들지 않고 src/expenses/item-name-match.ts(UX-C가 낸 단일 소스)를 **그대로**
 * 쓴다 — 입력 화면의 자동완성/카테고리 추천이 "같은 품목"이라고 본 것과 이 섹션이 보는 것이
 * 갈리면, 같은 이름을 두고 화면마다 다른 이력이 나온다.
 *
 * React/react-native에 의존하지 않으므로 vitest에서 그대로 단위 테스트한다.
 */

import { formatKrw } from "../money";
import { itemNameMatchRank, sortByRecency } from "./item-name-match";

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
 * 같은 품목의 최근 기록을 만든다. 그릴 것이 없으면 `null`(섹션 자체를 생략).
 *
 * 정렬은 **매칭 등급 우선, 그다음 최신순**이다: 이름이 정확히 같은 과거 기록이 있으면 그것이
 * 먼저 보여야 하고("기저귀" vs "기저귀 크림"), 같은 등급 안에서는 최근 것이 더 쓸모 있다.
 */
export function buildItemHistory({
  cachedMonthExpenses,
  cacheYearMonth,
  itemName,
  currentExpenseId,
  maxRows = ITEM_HISTORY_MAX_ROWS
}: ItemHistoryInput): ItemHistory | null {
  // 콜드 스타트: 이번 달 목록을 아직 한 번도 못 받았다 -- "이력 없음"이라고 말하지 않고 침묵한다.
  if (!cachedMonthExpenses) return null;
  if (itemName.trim().length === 0) return null;
  if (maxRows <= 0) return null;

  const ranked = sortByRecency(cachedMonthExpenses)
    .filter((row) => row.id !== currentExpenseId)
    .map((row) => ({ row, rank: itemNameMatchRank(itemName, row.itemName ?? "") }))
    .filter((entry): entry is { row: ItemHistoryExpense; rank: number } => entry.rank !== null)
    // sortByRecency가 이미 최신순으로 놓았고 Array#sort는 안정 정렬이라, 여기서는 등급만 본다.
    .sort((left, right) => left.rank - right.rank)
    .slice(0, maxRows);

  if (ranked.length === 0) return null;

  const rows: ItemHistoryRow[] = ranked.map(({ row }) => {
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
