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
 * GAP-058 #6 — 위 두 문단의 규칙(로컬 우선 → 서버 폴백, 원천별 정리·정렬)은 이제 이 파일이
 * 아니라 `suggest-source.ts`에 있다. 같은 화면의 자동완성 두 갈래가 **같은 모집단**을 읽어야
 * 하는데(매달 1일 실종·오프라인 비대칭), 그 모집단을 만드는 규칙이 여기에만 있으면 두 벌로
 * 갈린다. 이 모듈은 그 공용 모듈이 갈라 준 `local`/`server` 두 목록 위에서 **칩을 만드는 규칙**
 * (품목명·금액 유효성, 이름 중복 제거, 상한, 폴백 판정)만 맡는다 — 밖에서 본 동작은 그대로다.
 *
 * 이 모듈은 저장소/네트워크/React에 의존하지 않는다 (vitest 단위 테스트 대상).
 */

import { formatKrw } from "../money";
import { partitionSuggestSourceRows, type SuggestSourceRow } from "./suggest-source";

/** 스냅숏 행 중 이 모듈이 실제로 읽는 필드만 구조적으로 요구한다 —
 * src/offline/types.ts의 LocalExpenseRow가 그대로 대입 가능하다.
 * GAP-058 #6: 이 모양 그대로 `SuggestSourceLocalRow`(suggest-source.ts)에도 대입된다 —
 * 그쪽이 더 넓은 행(canonicalId·spentOn·merchant)을 받되 전부 선택 필드이기 때문이다. */
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
 *
 * GAP-058 #6: 이 모양 그대로 `SuggestSourceServerRow`(suggest-source.ts)에도 대입된다(그쪽의
 * `id`는 선택 필드다 — id가 없으면 로컬 쌍둥이를 알아볼 수 없어 중복 제거만 건너뛴다).
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
   *
   * GAP-058 #6: 이 배열이 **어느 달**인지 이 모듈은 묻지 않는다(정렬 기준은 spentOn뿐이다).
   * 그래서 배선할 때 이번 달과 지난달 캐시를 이어 붙여 넘기면 매달 1일의 빈 칩도 그대로 메워진다
   * — 새 인자도, 새 요청도 필요 없다.
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
  // GAP-058 #6: 아이·삭제 대기·선물/환불 거르기와 원천별 최신순 정렬은 공용 모듈의 규칙 한 벌이다
  // (로컬은 createdAt, 서버는 spentOn 기준 — 두 원천의 "최신"이 다르다는 사실은 그쪽 주석 참고).
  const { local, server } = partitionSuggestSourceRows({
    childId,
    localRows: rows,
    currentMonthRows: options.serverRows
  });

  const chips = dedupeNewestPerItemName(local, limit);
  if (chips.length > 0) return chips;

  // UX-L(B): 이 기기에 이력이 없을 때만 서버 월 캐시로 폴백한다(우선순위는 언제나 로컬).
  // 판정을 원본 행이 아니라 **만들어진 칩**으로 하는 이유는 위 헤더 참고.
  return dedupeNewestPerItemName(server, limit);
}

/**
 * 최신순으로 이미 정렬된 후보에서 칩을 만든다: 품목명이 비었거나 금액이 양의 정수가 아닌 행을
 * 빼고(DNC-013과 같은 규칙), 품목명(trim 기준) 중복을 걷어낸 뒤 상한까지 자른다.
 */
function dedupeNewestPerItemName(newestFirst: readonly SuggestSourceRow[], limit: number): RecentItemChip[] {
  const seenItemNames = new Set<string>();
  const chips: RecentItemChip[] = [];
  for (const row of newestFirst) {
    if (!row.itemName || row.itemName.trim().length === 0) continue;
    if (!Number.isInteger(row.amountKrw) || row.amountKrw <= 0) continue;
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
