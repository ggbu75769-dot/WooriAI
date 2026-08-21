/**
 * EXP-113 — 지출 빠른 재입력(최근 항목 칩)의 순수 로직.
 *
 * 데이터 소스는 오프라인 SQLite 저장소(local_expenses)의 반응형 스냅숏
 * (src/offline/sync-controller.ts의 useOfflineSyncSnapshot)이다. 그 테이블에는 이 기기에서
 * 기록/수정한 지출 행이 동기화 완료 후에도 남아 있으므로(계정 전환 시에만 전체 삭제,
 * PRIV-104), 서버 왕복 없이 — 완전 오프라인에서도 — "이 사용자가 직접 입력했던 항목"을
 * 그대로 다시 보여줄 수 있다. 이 모듈은 그 행 배열을 받아 칩 목록으로 줄이는 계산만 하며
 * 저장소/네트워크/React에 의존하지 않는다 (vitest 단위 테스트 대상).
 */

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

export type RecentItemChip = {
  itemName: string;
  amountKrw: number;
  categoryId: string;
};

export const RECENT_ITEM_CHIP_LIMIT = 5;

/**
 * 최근 입력한 지출 행에서 재입력 칩 목록을 만든다.
 * - 선택된 아이(childId)의 행만 사용, 삭제 대기 행 제외
 * - expenseType이 "expense"가 아닌 행(선물 등) 제외 — 단 필드가 없는 레거시 행은 expense로 간주
 * - 품목명이 비었거나 금액이 양의 정수가 아닌 행 제외 (DNC-013과 같은 규칙)
 * - createdAt 내림차순(가장 최근 입력 우선)으로 정렬
 * - 동일 품목명(trim 기준)은 최신 1개만 유지 (중복 제거)
 * - 최대 `limit`개(기본 5)로 상한
 */
export function buildRecentItemChips(
  rows: readonly RecentItemSourceRow[],
  childId: string,
  limit: number = RECENT_ITEM_CHIP_LIMIT
): RecentItemChip[] {
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

  const seenItemNames = new Set<string>();
  const chips: RecentItemChip[] = [];
  for (const row of newestFirst) {
    const itemName = row.payload.itemName.trim();
    if (seenItemNames.has(itemName)) continue;
    seenItemNames.add(itemName);
    chips.push({ itemName, amountKrw: row.payload.amountKrw, categoryId: row.payload.categoryId });
    if (chips.length >= limit) break;
  }
  return chips;
}

/** 칩에 보이는 텍스트: "기저귀 · 38,500원" */
export function formatRecentItemChipLabel(chip: RecentItemChip): string {
  return `${chip.itemName} · ${chip.amountKrw.toLocaleString("ko-KR")}원`;
}

/** 스크린리더용 라벨: "최근 항목 기저귀 38,500원 다시 입력" */
export function recentItemChipAccessibilityLabel(chip: RecentItemChip): string {
  return `최근 항목 ${chip.itemName} ${chip.amountKrw.toLocaleString("ko-KR")}원 다시 입력`;
}
