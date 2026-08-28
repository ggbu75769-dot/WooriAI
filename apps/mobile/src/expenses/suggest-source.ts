/**
 * GAP-058 #6 — 입력 보조(최근 칩·품목 자동완성·판매처 자동완성)가 함께 읽는 **제안 원천 한 벌**.
 *
 * ## 무엇이 문제였나
 * 같은 화면(app/expenses/new.tsx)에서 세 보조가 서로 **다른 데이터**를 보고 있었다:
 *  - 최근 품목 칩(recent-items.ts): 오프라인 스냅숏 우선, 비면 서버 이번 달 캐시로 폴백.
 *  - 품목 자동완성(item-autocomplete.ts)·판매처 자동완성(merchant-suggest.ts): 서버 **이번 달
 *    캐시만**(new.tsx의 `expenseHistory`).
 *
 * 그래서 두 가지가 조용히 어긋났다.
 *  1. **매달 1일 실종**: 이번 달 캐시는 1일 아침에 거의 비어 있다. 어제까지 잘 뜨던 자동완성이
 *     달이 바뀌는 순간 통째로 사라진다 — 사용자의 이력이 사라진 것이 아닌데도.
 *  2. **오프라인 비대칭**: 방금 비행기 모드로 적은 지출은 아직 서버 캐시에 없다. 최근 칩에는
 *     보이는 그 품목이 두 글자만 치면 자동완성 후보에서는 사라진다(같은 화면·같은 사실인데
 *     한쪽만 안다).
 *
 * ## 이 모듈이 하는 일
 * "이 사용자가 적어 본 적 있는 품목·금액·판매처"의 모집단을 **한 곳에서** 만든다.
 *  - 원천 1: 이 기기의 오프라인 스냅숏 행(`useOfflineSyncSnapshot().rows`). 동기화가 끝난 뒤에도
 *    남아 있어(계정 전환 시에만 전체 삭제, PRIV-104) 네트워크 없이도 읽을 수 있는 이력이다.
 *  - 원천 2: 이미 받아 둔 서버 월 캐시(`["expenses", childId, ym]`)의 **이번 달 + 지난달**.
 *    지난달을 함께 받는 인자가 위 (1)의 해결이다.
 *
 * **새 네트워크 요청은 0건이다.** 이 모듈은 화면이 이미 손에 들고 있는 두 배열을 합칠 뿐이고,
 * 없는 것을 지어내지 않는다(둘 다 비면 빈 목록이고, 그때 화면은 이 기능이 없던 때와 같다).
 *
 * ## 중복 계수 방지 — "로컬에 있으면 로컬만"
 * 로컬 행이 서버에 올라가고 나면 **같은 지출이 두 원천에 동시에 존재한다**. 그대로 이어 붙이면
 * 판매처 후보의 `count`(정렬 1순위 키)가 두 배로 뛰어, 자주 가지 않는 곳이 위로 올라온다 —
 * 화면의 순서가 거짓이 되는 종류의 버그다. 그래서 로컬 행이 들고 있는 서버 id(`canonicalId`)와
 * 같은 id의 서버 행은 **버린다**. 남는 쪽은 언제나 로컬이다:
 *  - 로컬 행이 이 기기에서 방금 고친 값(아직 미전송)일 수 있고, 그때 서버 행은 낡은 값이다.
 *  - 삭제 대기(pendingDelete) 행도 마찬가지다. 사용자가 지운 기록을 서버 캐시가 아직 들고 있다고
 *    해서 제안으로 되살리면, 화면이 사용자의 마지막 의사와 반대되는 말을 한다.
 *
 * ## 왜 `reconcileMonthlyExpenses`를 쓰지 않나
 * 오프라인 재조정(src/offline/expense-list-reconciliation.ts)은 **"이 달의 목록과 합계는
 * 무엇인가"**에 답하는 함수라, 서버를 권위로 두고 (a) 아직 안 올라간 행만 로컬에서 끌어오며
 * (b) 그 달(`YYYY-MM`)로 좁힌다. 여기서 그 규칙을 쓰면 **동기화가 끝난 로컬 행이 전부 사라지고**
 * 두 달 밖의 로컬 이력도 잘려 나가, 이 티켓이 고치려는 바로 그 비대칭이 되돌아온다. 목적이 다른
 * 두 질문이므로 규칙도 둘이다 — 대신 겹치는 부분(같은 지출이 두 번 세어지는 것)은 위와 같이
 * `canonicalId` 한 가지 기준으로만 막는다.
 *
 * 내용이 같다고 묶지는 않는다(품목명+금액+날짜 해시 같은 것). 같은 날 같은 물건을 두 번 사는 일은
 * 실제로 있고, 그것은 판매처 빈도에서 **두 번 세는 것이 사실**이기 때문이다.
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다.
 */

import type { ItemAutocompleteSourceRow } from "./item-autocomplete";
import type { MerchantSuggestSourceRow } from "./merchant-suggest";

/**
 * 오프라인 스냅숏 행 중 이 모듈이 읽는 필드만 구조적으로 요구한다 —
 * `LocalExpenseRow`(src/offline/types.ts)가 그대로 대입되고, 이력 필드가 적은
 * `RecentItemSourceRow`(recent-items.ts)도 그대로 대입된다(아래 선택 필드들 덕분에).
 */
export type SuggestSourceLocalRow = {
  childId: string;
  /** 삭제 대기 행은 제안하지 않는다(그리고 그 서버 쌍둥이도 함께 감춘다 — 헤더 참고). */
  pendingDelete: boolean;
  /** 이 기기에 기록된 시각(ISO 8601) — 로컬 목록의 "최근 입력" 순서 기준. */
  createdAt: string;
  /**
   * 동기화가 끝난 행이 들고 있는 서버 지출 id. 이 값이 있으면 같은 id의 서버 행을 버린다.
   * 아직 올라가지 않은 행은 null/미포함이고, 그때는 버릴 짝이 애초에 없다.
   */
  canonicalId?: string | null;
  payload: {
    itemName: string;
    amountKrw: number;
    categoryId: string;
    /** 지출 날짜(YYYY-MM-DD). 자동완성·판매처 쪽의 최신순 정렬 기준이다. */
    spentOn?: string;
    merchant?: string | null;
    /**
     * "expense" | "gift" | "refund". 세 소비자 모듈이 모두 **일반 지출만** 제안하므로
     * 여기서 한 번에 거른다. 필드가 없는 레거시 행은 expense로 간주(라운드 13 m-8).
     */
    expenseType?: string;
  };
};

/**
 * 서버 월 캐시 행 중 이 모듈이 읽는 필드만 구조적으로 요구한다 — `Expense`(src/api/client.ts)가
 * 그대로 대입된다. 캐시는 조회할 때부터 childId로 좁혀져 있으므로 여기서 아이를 다시 거르지
 * 않는다(서버 행에는 childId를 요구하지 않는 이유다).
 */
export type SuggestSourceServerRow = {
  /**
   * 지출 id. **선택 필드다** — id가 없는 행(예: 이 값을 실어 나르지 않는 옛 호출부)도 그대로
   * 받되, 그때는 로컬 쌍둥이를 알아볼 방법이 없으므로 중복 제거 없이 통과한다.
   */
  id?: string;
  itemName: string;
  amountKrw: number;
  categoryId: string;
  /** 지출 날짜(YYYY-MM-DD) — 최신순 정렬 기준. */
  spentOn: string;
  merchant?: string | null;
  /** 로컬 행과 같은 규칙: "expense"가 아니면 제외, 없으면 expense로 간주. */
  expenseType?: string;
};

/** 통합 행이 어느 원천에서 왔는지. 화면에 그리는 값은 아니고, 순서·판단의 근거다. */
export type SuggestSourceOrigin = "local" | "server";

/**
 * 두 원천을 같은 모양으로 편 행. 세 소비자 모듈의 소스 타입에 **그대로 대입된다**
 * (아래 컴파일 타임 계약 참고) — 즉 통합 목록 하나를 세 함수에 그대로 넘길 수 있다.
 */
export type SuggestSourceRow = {
  origin: SuggestSourceOrigin;
  /**
   * 서버 지출 id — 서버 행은 자기 id, 로컬 행은 `canonicalId`(동기화 전이면 없음).
   *
   * 지출 상세(app/expenses/[expenseId].tsx)가 **자기 행을 후보에서 빼는** 데 쓴다: 판매처를
   * 고치려고 칸을 비운 사람에게 방금 지운 그 값을 첫 칩으로 돌려주면 안 된다(라운드 57 QA).
   * 그 화면은 지금 서버 캐시를 `row.id !== expenseId`로 거르는데, 통합 목록에서도 같은 한 줄이
   * 그대로 통하도록 id를 들고 온다 — 로컬 쪽이 이 값을 잃으면 그 필터가 조용히 헛돌고
   * (같은 지출이 로컬 행으로 살아남는다) 그 버그가 그대로 돌아온다.
   */
  id?: string;
  itemName: string;
  amountKrw: number;
  categoryId: string;
  /** 지출 날짜. 로컬 행의 payload에 없으면(구조적으로 선택) 없는 채로 둔다 — 지어내지 않는다. */
  spentOn?: string;
  merchant?: string | null;
  expenseType?: string;
  /** 로컬 행만 갖는 값(이 기기에 기록된 시각). 서버 행에는 없다. */
  createdAt?: string;
};

/**
 * `SuggestSourceRow`가 소비자 모듈의 소스 타입에 대입 가능한지를 **컴파일 타임에** 고정한다.
 * 어느 한쪽이 필드를 옮기거나 좁히면 여기서 tsc가 먼저 막는다 — 배선한 화면에서 뒤늦게
 * 깨지지 않도록. (타입만 import하므로 런타임 의존은 0이고 순환도 생기지 않는다.)
 */
type AssignableTo<TRow extends TTarget, TTarget> = TRow;
export type SuggestSourceRowFitsItemAutocomplete = AssignableTo<SuggestSourceRow, ItemAutocompleteSourceRow>;
export type SuggestSourceRowFitsMerchantSuggest = AssignableTo<SuggestSourceRow, MerchantSuggestSourceRow>;

export type SuggestSourceInput = {
  /** 지금 선택된 아이. 로컬 스냅숏은 여러 아이의 행을 함께 담고 있어 반드시 좁혀야 한다. */
  childId: string;
  /** `useOfflineSyncSnapshot().rows`. 없으면 서버 원천만으로 만든다. */
  localRows?: readonly SuggestSourceLocalRow[] | null;
  /** `["expenses", childId, 이번 달]` 캐시의 `expenses`. 캐시가 없으면 넘기지 않는다. */
  currentMonthRows?: readonly SuggestSourceServerRow[] | null;
  /**
   * `["expenses", childId, 지난달]` 캐시의 `expenses`. **매달 1일 실종의 해결책**이다 —
   * 이번 달 캐시가 아직 비어 있어도 어제까지의 이력이 그대로 남는다. 화면이 지난달 캐시를
   * 들고 있지 않으면 그냥 넘기지 않으면 되고, 그때 동작은 종전과 같다(새 요청 금지).
   */
  previousMonthRows?: readonly SuggestSourceServerRow[] | null;
};

/** 원천별로 갈라 둔 결과. 최근 칩처럼 "로컬 우선 → 서버 폴백"이 필요한 쪽이 쓴다. */
export type SuggestSourcePartition = {
  /** 이 기기에서 입력한 행(최근 입력 순). */
  local: SuggestSourceRow[];
  /** 로컬에 없는 서버 행만(지출 날짜 최신순). */
  server: SuggestSourceRow[];
};

/** "expense"가 아닌 구분(선물·환불)은 제안하지 않는다. 값이 없는 레거시 행은 일반 지출로 본다. */
function isPlainExpense(expenseType: string | undefined | null): boolean {
  return expenseType === undefined || expenseType === null || expenseType === "expense";
}

function nonEmptyId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * 두 원천을 각각 정리해서 돌려준다(합치지는 않는다).
 *
 * - 로컬: 선택된 아이의 행만, 삭제 대기 제외, 일반 지출만, `createdAt` 내림차순.
 * - 서버: 이번 달 + 지난달을 이어 붙이고 일반 지출만 남긴 뒤, **로컬이 이미 아는 id는 버리고**
 *   `spentOn` 내림차순으로 정렬한다. 같은 id가 두 번 실려 와도 한 번만 남긴다.
 *
 * 품목명이 비었다거나 금액이 이상한 행은 여기서 거르지 않는다 — 그 판정은 소비자마다 다르기
 * 때문이다(판매처 후보는 품목명이 비어도 유효하고, 품목 칩은 금액이 있어야 유효하다).
 * 입력 배열은 어느 것도 제자리에서 바뀌지 않는다.
 */
export function partitionSuggestSourceRows(input: SuggestSourceInput): SuggestSourcePartition {
  const localRows = input.localRows ?? [];
  const childRows = localRows.filter((row) => row.childId === input.childId);

  // 중복 제거 기준: **이 아이의 모든 로컬 행**이 아는 서버 id(삭제 대기 행 포함 — 헤더 참고).
  const knownServerIds = new Set<string>();
  for (const row of childRows) {
    const canonicalId = nonEmptyId(row.canonicalId);
    if (canonicalId) knownServerIds.add(canonicalId);
  }

  const local = childRows.filter((row) => !row.pendingDelete && isPlainExpense(row.payload.expenseType));
  // ISO 8601 문자열은 사전순 비교가 시간순 비교와 일치한다. sort는 복사본(filter 결과) 위에서.
  local.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const server: SuggestSourceRow[] = [];
  const seenServerIds = new Set<string>();
  for (const monthRows of [input.currentMonthRows, input.previousMonthRows]) {
    for (const row of monthRows ?? []) {
      if (!isPlainExpense(row.expenseType)) continue;
      const id = nonEmptyId(row.id);
      if (id) {
        if (knownServerIds.has(id)) continue;
        if (seenServerIds.has(id)) continue;
        seenServerIds.add(id);
      }
      server.push({
        origin: "server",
        ...(id !== null ? { id } : {}),
        itemName: row.itemName,
        amountKrw: row.amountKrw,
        categoryId: row.categoryId,
        spentOn: row.spentOn,
        merchant: row.merchant ?? null,
        ...(row.expenseType !== undefined ? { expenseType: row.expenseType } : {})
      });
    }
  }
  // YYYY-MM-DD도 사전순 비교가 날짜순과 일치한다. 같은 날짜끼리는 받은 순서를 유지한다
  // (Array#sort는 안정 정렬) — 그래서 이번 달 행이 지난달 행보다 앞이라는 사실이 흐려지지 않는다.
  server.sort((a, b) => {
    const left = a.spentOn ?? "";
    const right = b.spentOn ?? "";
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });

  return { local: local.map(toLocalSuggestRow), server };
}

function toLocalSuggestRow(row: SuggestSourceLocalRow): SuggestSourceRow {
  const canonicalId = nonEmptyId(row.canonicalId);
  return {
    origin: "local",
    ...(canonicalId !== null ? { id: canonicalId } : {}),
    itemName: row.payload.itemName,
    amountKrw: row.payload.amountKrw,
    categoryId: row.payload.categoryId,
    ...(row.payload.spentOn !== undefined ? { spentOn: row.payload.spentOn } : {}),
    merchant: row.payload.merchant ?? null,
    ...(row.payload.expenseType !== undefined ? { expenseType: row.payload.expenseType } : {}),
    createdAt: row.createdAt
  };
}

/**
 * 통합 목록 하나. 자동완성 두 갈래(품목·판매처)가 이것을 그대로 받는다.
 *
 * 순서는 **로컬 먼저, 그다음 서버**다. 두 모듈 모두 받은 목록을 `spentOn` 최신순으로 다시
 * 정렬하지만(item-name-match.ts의 `sortByRecency`), 그 정렬은 안정 정렬이라 **같은 날짜에서는
 * 여기서 앞에 둔 쪽이 그대로 앞에 남는다**. 즉 오늘 이 기기에서 방금 적은(아직 안 올라간) 행이
 * 같은 날짜의 서버 행보다 먼저 제안된다 — 사용자가 가장 최근에 손으로 적은 표기·금액이 이긴다.
 */
export function buildSuggestSourceRows(input: SuggestSourceInput): SuggestSourceRow[] {
  const { local, server } = partitionSuggestSourceRows(input);
  return [...local, ...server];
}
