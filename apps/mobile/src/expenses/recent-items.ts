/**
 * EXP-113 — 지출 빠른 재입력(최근 항목 칩)의 순수 로직.
 *
 * 1순위 데이터 소스는 오프라인 SQLite 저장소(local_expenses)의 반응형 스냅숏
 * (src/offline/sync-controller.ts의 useOfflineSyncSnapshot)이다. 그 테이블에는 이 기기에서
 * 기록/수정한 지출 행이 동기화 완료 후에도 남아 있으므로(계정 전환 시에만 전체 삭제,
 * PRIV-104), 서버 왕복 없이 — 완전 오프라인에서도 — "이 사용자가 직접 입력했던 항목"을
 * 그대로 다시 보여줄 수 있다.
 *
 * UX-L(B) — 서버 월 캐시 폴백.
 *
 * 그런데 그 스냅숏은 **이 기기의 이력**이다. 앱을 다시 깔았거나, 기종을 바꿨거나, 두 번째
 * 기기에서 로그인하면 지출 이력이 서버에 멀쩡히 있는데도 칩 영역이 통째로 비어 있었다(기록이
 * 수백 건인 사용자에게 "최근 품목"이 없다고 말하는 셈이다). 같은 화면의 품목 자동완성은 이미
 * 서버 월 캐시(["expenses", childId, 이번 달])를 읽고 있으므로, 여기서도 **로컬이 비었을 때만**
 * 같은 캐시를 폴백으로 쓴다. 새 네트워크 요청은 없다 — 화면이 이미 받아 둔 응답을 넘겨줄 뿐이다.
 *
 * 우선순위는 언제나 로컬이다: 로컬에서 칩이 하나라도 나오면 예전과 완전히 같은 결과를 돌려주고
 * 서버 행은 보지 않는다(둘을 섞으면 "방금 적은 것이 맨 앞"이라는 순서 규칙이 깨진다). 폴백
 * 판정을 원본 행이 아니라 **만들어진 칩**으로 하는 이유: 로컬 행이 전부 선물이거나 삭제
 * 대기라서 후보가 0개인 경우도 사용자 눈에는 똑같이 "칩이 비었다"이고, 그 자리에서 보여줄 수
 * 있는 사실이 서버 캐시에 있다면 보여주는 편이 맞다.
 *
 * 이 모듈은 저장소/네트워크/React에 의존하지 않는다 (vitest 단위 테스트 대상).
 */

import { formatKrw } from "../money";

/** 스냅숏 행 중 이 모듈이 실제로 읽는 필드만 구조적으로 요구한다 —
 * src/offline/types.ts의 LocalExpenseRow가 그대로 대입 가능하다. */
export type RecentItemSourceRow = {
  childId: string;
  /** 삭제 대기 중인 행은 다시 제안하지 않는다. */
  pendingDelete: boolean;
  /** 행이 로컬 저장소에 기록된 시각(ISO 8601) — "최근 입력" 순서의 기준. */
  createdAt: string;
  payload: {
    itemName: string;
    amountKrw: number;
    categoryId: string;
    /** "expense" | "gift" 등(offline/types.ts의 ExpenseKind). 칩을 탭하면 일반 지출로
     * 재입력되므로 "expense"가 아닌 행(선물/환불 등)은 후보에서 제외한다. 필드가 없는
     * 레거시 페이로드는 expense로 간주(라운드 13 m-8). */
    expenseType?: string;
  };
};

/**
 * UX-L(B) 폴백 입력: 서버 월 지출 캐시의 행.
 *
 * 이 화면이 이미 자동완성에 쓰는 `["expenses", childId, 이번 달]` 응답의 항목이 그대로 대입된다
 * (src/api/client.ts의 `Expense`). 그 캐시는 조회할 때부터 childId로 좁혀져 있으므로 여기서
 * 아이를 다시 거르지 않는다 — 로컬 행과 달리 이 행에는 childId가 없다.
 *
 * "최신"의 기준은 로컬 행의 `createdAt`(입력 시각)이 아니라 `spentOn`(지출 날짜)이다. 서버 행에는
 * 입력 시각이 없고, 목록 정렬도 spentOn 내림차순이라 사용자가 화면에서 보는 순서와 같아진다.
 */
export type RecentItemServerRow = {
  itemName: string;
  amountKrw: number;
  categoryId: string;
  /** 지출 날짜(YYYY-MM-DD) — 최신순 정렬 기준. */
  spentOn: string;
  /** 로컬 행과 같은 규칙: "expense"가 아니면 제외, 없으면 expense로 간주. */
  expenseType?: string;
};

export type RecentItemChip = {
  itemName: string;
  amountKrw: number;
  categoryId: string;
};

export const RECENT_ITEM_CHIP_LIMIT = 5;

/** buildRecentItemChips의 선택 입력. */
export type RecentItemChipOptions = {
  /**
   * UX-L(B): 로컬 스냅숏에서 칩이 하나도 나오지 않을 때만 쓰는 서버 월 캐시 행.
   * 넘기지 않으면(또는 비어 있으면) 예전과 완전히 같은 동작이다.
   */
  serverRows?: readonly RecentItemServerRow[];
  limit?: number;
};

/**
 * 최근 입력한 지출 행에서 재입력 칩 목록을 만든다.
 * - 선택된 아이(childId)의 행만 사용, 삭제 대기 행 제외
 * - expenseType이 "expense"가 아닌 행(선물 등) 제외 — 단 필드가 없는 레거시 행은 expense로 간주
 * - 품목명이 비었거나 금액이 양의 정수가 아닌 행 제외 (DNC-013과 같은 규칙)
 * - createdAt 내림차순(가장 최근 입력 우선)으로 정렬
 * - 동일 품목명(trim 기준)은 최신 1개만 유지 (중복 제거)
 * - 최대 `limit`개(기본 5)로 상한
 *
 * 로컬 행에서 칩이 하나도 나오지 않으면(재설치·기종 변경·두 번째 기기) `options.serverRows`의
 * 서버 월 캐시 행에 **같은 규칙**을 적용해 폴백한다 — 정렬 기준만 spentOn이다(위 타입 주석).
 */
export function buildRecentItemChips(
  rows: readonly RecentItemSourceRow[],
  childId: string,
  options: RecentItemChipOptions = {}
): RecentItemChip[] {
  const limit = options.limit ?? RECENT_ITEM_CHIP_LIMIT;
  const candidates = rows.filter((row) => {
    if (row.childId !== childId) return false;
    if (row.pendingDelete) return false;
    // 라운드 13 m-8: 선물(gift) 등 일반 지출이 아닌 행은 재입력 칩으로 제안하지 않는다.
    // expenseType이 없는 레거시 페이로드는 expense로 간주한다.
    if (row.payload.expenseType !== undefined && row.payload.expenseType !== "expense") return false;
    if (!row.payload.itemName || row.payload.itemName.trim().length === 0) return false;
    if (!Number.isInteger(row.payload.amountKrw) || row.payload.amountKrw <= 0) return false;
    return true;
  });
  // ISO 8601 문자열은 사전순 비교가 시간순 비교와 일치한다. sort는 복사본 위에서 수행.
  const newestFirst = [...candidates].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const chips = dedupeNewestPerItemName(
    newestFirst.map((row) => ({
      itemName: row.payload.itemName,
      amountKrw: row.payload.amountKrw,
      categoryId: row.payload.categoryId
    })),
    limit
  );
  if (chips.length > 0) return chips;

  // UX-L(B): 이 기기에 이력이 없을 때만 서버 월 캐시로 폴백한다(우선순위는 언제나 로컬).
  return buildRecentItemChipsFromServerRows(options.serverRows ?? [], limit);
}

/** 서버 월 캐시 행 → 칩. 로컬 경로와 같은 필터·중복 제거 규칙, 정렬 기준만 spentOn이다. */
function buildRecentItemChipsFromServerRows(
  serverRows: readonly RecentItemServerRow[],
  limit: number
): RecentItemChip[] {
  const candidates = serverRows.filter((row) => {
    if (row.expenseType !== undefined && row.expenseType !== "expense") return false;
    if (!row.itemName || row.itemName.trim().length === 0) return false;
    if (!Number.isInteger(row.amountKrw) || row.amountKrw <= 0) return false;
    return true;
  });
  // YYYY-MM-DD도 사전순 비교가 날짜순과 일치한다. 같은 날짜끼리는 입력 순서를 유지한다
  // (Array.prototype.sort는 안정 정렬이라, 서버가 준 목록 순서가 그대로 남는다).
  const newestFirst = [...candidates].sort((a, b) => (a.spentOn < b.spentOn ? 1 : a.spentOn > b.spentOn ? -1 : 0));
  return dedupeNewestPerItemName(newestFirst, limit);
}

/** 최신순으로 이미 정렬된 후보에서 품목명(trim 기준) 중복을 걷어내고 상한까지 자른다. */
function dedupeNewestPerItemName(
  newestFirst: readonly { itemName: string; amountKrw: number; categoryId: string }[],
  limit: number
): RecentItemChip[] {
  const seenItemNames = new Set<string>();
  const chips: RecentItemChip[] = [];
  for (const row of newestFirst) {
    const itemName = row.itemName.trim();
    if (seenItemNames.has(itemName)) continue;
    seenItemNames.add(itemName);
    chips.push({ itemName, amountKrw: row.amountKrw, categoryId: row.categoryId });
    if (chips.length >= limit) break;
  }
  return chips;
}

/** 칩에 보이는 텍스트: "기저귀 · 38,500원" */
export function formatRecentItemChipLabel(chip: RecentItemChip): string {
  return `${chip.itemName} · ${formatKrw(chip.amountKrw)}`;
}

/** 스크린리더용 라벨: "최근 항목 기저귀 38,500원 다시 입력" */
export function recentItemChipAccessibilityLabel(chip: RecentItemChip): string {
  return `최근 항목 ${chip.itemName} ${formatKrw(chip.amountKrw)} 다시 입력`;
}
