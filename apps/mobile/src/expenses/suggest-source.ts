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
 * ## 영구 실패 행의 네 자리 — 다섯 모듈이 공유하는 근거 (라운드 59 트랙 A)
 *
 * `syncState !== "synced"`인 행은 한 가지가 아니다. **생성 대기** 행은 서버에 아직 없지만,
 * **수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고 그 값이 곧 달라질 뿐이다
 * (라운드 57 QA P1-2). 그 위에 라운드 59가 갈래를 하나 더 갈랐다: 서버가 4xx로 거절해 **다시
 * 보내도 같은 답이 오는** 행이다(`isPermanentlyFailedSyncRow` — src/offline/permission-denied.ts).
 * 그 행을 "동기화 대기"라고 부르면 오지 않을 시점을 약속하는 것이고, 없는 셈 치면 화면에 보이는
 * 목록과 숫자가 어긋난다.
 *
 * 그래서 **네 자리가 각자 다른 답을 낸다.** 한 술어로 통일하지 않는다 — 통일하는 순간 그중
 * 최소 한 자리가 거짓을 말한다:
 *
 *  1. **합계 유지**(`src/offline/expense-list-reconciliation.ts`): 서버에 아직 없는 행(생성이
 *     거절된 행)은 월 합계에서 **빼지 않는다.** 그 행은 기록 탭 목록에 그대로 서 있어 사용자가
 *     눈으로 셀 수 있다 — 목록에 있는 금액이 합계에 없으면 앱이 산수를 틀린 것으로 읽힌다. 대신
 *     영구 실패 **건수**를 결과에 실어, 화면이 고지 한 줄을 덧붙일 수 있게 한다. 반대로 **서버
 *     지출을 가리키는 행**(수정·삭제가 거절된 행)에서는 그 변경이 영영 닿지 않으므로 **서버 값이
 *     목록·합계로 되돌아온다**(4번과 같은 규칙 — 죽은 로컬 값이 산 서버 값을 가리지 않는다).
 *     그러지 않으면 403으로 거절된 삭제가 화면에서만 성사돼, 서버에 멀쩡히 남아 있는 지출 한 줄이
 *     목록에서도 합계에서도 사라진다.
 *  2. **정기 지출 판정**(`src/expenses/recurring-template.ts`의 `recordedItemNamesForMonth`):
 *     "기록됨"에서 **뺀다.** 묻는 것이 "이번 달에 이 품목을 샀는가"인데 영구 실패 행은 서버에
 *     결코 닿지 않는다. 실패한 기저귀 한 줄이 카드를 끄면 사용자는 다시 기록할 기회를 잃는다.
 *     일시 실패·대기 행은 종전대로 센다(그것들은 언젠가 반영된다).
 *  3. **고지 어휘 분리**(`src/reports/pending-scope-notice.ts` ·
 *     `src/export/export-pending-notice.ts`): 세는 대상은 그대로 두고 **부르는 이름만 가른다.**
 *     영구 실패가 섞이면 주어에서 "동기화 대기 중인"이 떨어져 그냥 "기록 N건"이 되고, 그중 몇
 *     건이 "보낼 수 없는 기록"인지 뒷문장이 따로 말한다(offline/messages.ts). **술어는 두 갈래가
 *     같다**("…에 아직 반영되지 않았어요"): 이 모집단에는 삭제 대기 행(그 숫자에 아직 들어 있다)과
 *     수정 대기 행(옛 값으로 담긴다)이 섞여 있어, "빠져 있어요"처럼 세게 말하면 그 부분집합에
 *     거짓이다. 두 모듈의 모집단은 다르지만(DNC-015) **구분 규칙은 하나**다.
 *  4. **자동완성 모집단**(`src/expenses/suggest-source.ts`): 제안에서 **뺀다.** 400을 부른 바로
 *     그 값이 첫 후보로 돌아오면 사용자는 같은 실패를 다시 만든다(실패 공장). 빼도 잃는 것이
 *     없다 — 이력은 남고, 그 지출의 서버 값이 있으면 그쪽이 대신 후보가 된다.
 *
 * 대기 행을 **세는 방식**이 모듈마다 다른 이유(라운드 57 QA P1-2)는 그대로다: 내보내기 고지는
 * 전부 세고, 리포트 고지는 아래 숫자를 움직일 행만 세고(DNC-015), 정기 지출 판정은 대기·전송
 * 중·일시 실패·충돌을 가리지 않고 센다(빼는 것은 삭제 대기와 위 2번의 영구 실패뿐이다).
 *
 * ### 실패 공장이 실제로 어떻게 돌아가는가 (이 모듈이 4번을 하는 이유)
 *
 * 아웃박스를 영구 실패로 굳히는 4xx는 대부분 **입력값 자체**가 원인이다: 101자 품목명
 * (`CreateExpenseDto.itemName`의 @MaxLength(100) → 400), int4를 넘긴 금액, 미래 날짜
 * (EXPENSE_FUTURE_DATE). 그 값들은 로컬 저장이 먼저 성공했으므로 스냅숏에 남고, 이 모듈은
 * 스냅숏을 **가장 최근 입력**으로 정렬해 앞에 세운다. 즉 아무 조치도 하지 않으면 400을 부른
 * 그 품목명·금액이 다음 기록의 첫 후보로 돌아오고, 사용자가 그것을 탭하면 같은 400이 하나 더
 * 생긴다. 그래서 여기서는 제외가 곧 정직이다 — 이 목록은 "무엇을 적었나"의 기록이 아니라
 * **"다음에 무엇을 적겠나"의 제안**이기 때문이다.
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다.
 */

import { isPermanentlyFailedSyncRow } from "../offline/permission-denied";
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
   * 라운드 59 트랙 A — 영구 실패 행을 제안에서 빼는 데 필요한 네 값(헤더의 "네 자리" 4번).
   *
   * **전부 선택**이라 이 값을 모르는 호출부는 종전과 똑같이 동작한다 = 실패가 아닌 행으로
   * 읽힌다. 그래야 이력 필드가 적은 `RecentItemSourceRow`(recent-items.ts)가 계속 그대로
   * 대입되고, 스냅숏 전량을 넘기는 화면(app/expenses/new.tsx · [expenseId].tsx)은 배선을
   * 한 줄도 바꾸지 않은 채 새 규칙을 얻는다.
   *
   * 판정 규칙을 여기 다시 적지 않는다 — `isPermanentlyFailedSyncRow` 하나가 네 자리 전부의
   * 술어다(src/offline/permission-denied.ts).
   */
  syncState?: string | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
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
 * - 로컬: 선택된 아이의 행만, 삭제 대기 제외, **영구 실패 제외**(라운드 59 트랙 A — 헤더의
 *   "네 자리" 4번), 일반 지출만, `createdAt` 내림차순.
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

  // 라운드 59 트랙 A: 영구 실패 행은 제안에서 빠진다(헤더 "실패 공장" 절). 일시 실패·전송 중·
  // 대기 행은 그대로 남는다 — 그것들이 나르는 값은 아직 서버가 거절하지 않았다.
  const sendableChildRows = childRows.filter((row) => !isPermanentlyFailedSyncRow(row));

  // 중복 제거 기준: **보낼 수 있는 로컬 행**이 아는 서버 id(삭제 대기 행 포함 — 헤더 참고).
  //
  // 영구 실패 행의 canonicalId를 여기서 빼는 이유(라운드 59 트랙 A): 그 id를 계속 "로컬이 아는
  // 것"으로 두면 서버 쌍둥이까지 함께 사라져, 그 지출은 어느 원천에서도 후보로 나오지 않는다.
  // 그런데 영구 실패한 것은 **수정 시도**뿐이고 서버에는 마지막으로 받아들여진 값이 멀쩡히
  // 남아 있다(그 수정은 앞으로도 반영되지 않는다). 그러니 이 자리의 사실은 서버 값이다 —
  // 로컬 대표가 빠졌으면 대표 자리를 서버 행에 돌려준다. 삭제가 영구 실패한 행도 같다:
  // 그 지출은 서버에서 지워지지 않았으므로 여전히 이 사용자의 이력이다.
  const knownServerIds = new Set<string>();
  for (const row of sendableChildRows) {
    const canonicalId = nonEmptyId(row.canonicalId);
    if (canonicalId) knownServerIds.add(canonicalId);
  }

  const local = sendableChildRows.filter((row) => !row.pendingDelete && isPlainExpense(row.payload.expenseType));
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
