/**
 * 라운드 41 K-6/K-10/K-13: 검수 화면의 **일괄 선택/해제 순차 PATCH**가 지켜야 하는 경합 규칙.
 *
 * 왜 별도 모듈인가: 서버 계약에 일괄 PATCH가 없어서
 * (apps/api/src/imports/imports.controller.ts는 `PATCH imports/:importJobId/rows/:rowId` 단건만
 * 노출한다 -- 129줄) 화면이 최대 2,000건을 **순차로** 보낸다. 그 루프는 화면보다 오래 살 수 있고,
 * 그래서 규칙이 필요했다:
 *
 *  - 화면을 벗어나면(언마운트·blur) 루프가 멈춰야 한다. 안 그러면 고아 루프가 계속 PATCH를
 *    보내고 캐시에 쓴다 -- 사용자가 이미 떠난 화면의 상태를;
 *  - 잡 하나에 루프도 하나여야 한다. 다시 들어와 버튼을 또 누르면 두 루프가 서로 반대 방향으로
 *    같은 행을 뒤집는다(전체 선택 루프와 전체 해제 루프가 교차);
 *  - 단건 토글과 겹치면 안 된다. 낙관 갱신끼리 서로를 덮어쓴다;
 *  - 사용자가 멈출 수 있어야 한다. 수백 건짜리 루프에 중단 버튼이 없으면 유일한 탈출구가
 *    "앱을 끄기"다;
 *  - 진행 표시가 매 건마다 캐시를 통째로 갈아 끼우면 O(n^2)다. N건 단위로 모아 쓴다.
 *
 * react / react-native / react-query import 없음 -- vitest에서 바로 단위 테스트한다
 * (src/import/preview-rows.ts와 같은 관례). 화면은 이 모듈에 콜백만 꽂는다.
 */

/** 진행 표시(=캐시 쓰기)를 모아 보내는 단위. 매 건마다 쓰면 2,000행에서 O(n^2)가 된다. */
export const IMPORT_BULK_PROGRESS_BATCH_SIZE = 10;

/* --------------------------------------------------------------- 실행 등록부 */

type ImportBulkRunEntry = { cancelled: boolean };

/**
 * 잡 id별 진행 중 루프. **모듈 지역** 상태다 -- 화면 리마운트(뒤로 갔다 다시 들어오기,
 * expo-router의 화면 재생성)에는 살아남아야 재진입 이중 실행을 막을 수 있고, 콜드 스타트에는
 * 비워져야 한다(src/family/useExpenseEntryGate.ts의 재검증 스로틀과 같은 이유·같은 관례).
 */
const activeImportBulkRuns = new Map<string, ImportBulkRunEntry>();

export type ImportBulkRunHandle = {
  /** 이 루프가 중단됐는가. 루프는 매 건 전후로 이 값을 본다. */
  isCancelled: () => boolean;
  /** 이 루프를 중단시킨다(중단 버튼 · 언마운트 · blur). 여러 번 불러도 안전하다. */
  cancel: () => void;
  /** 등록부에서 내려놓는다. 반드시 finally에서 부른다 -- 안 부르면 그 잡이 영영 잠긴다. */
  release: () => void;
};

/**
 * 이 잡의 일괄 실행권을 잡는다. 이미 도는 루프가 있으면 `null` -- 호출부는 그냥 돌아간다
 * (버튼 비활성만으로는 부족하다: 화면이 두 번 마운트되거나 탭이 빨리 두 번 들어오면 상태가
 * 아직 false인 채로 두 번째 호출이 지나간다).
 */
export function claimImportBulkRun(jobId: string): ImportBulkRunHandle | null {
  if (!jobId || activeImportBulkRuns.has(jobId)) return null;
  const entry: ImportBulkRunEntry = { cancelled: false };
  activeImportBulkRuns.set(jobId, entry);
  return {
    isCancelled: () => entry.cancelled,
    cancel: () => {
      entry.cancelled = true;
    },
    release: () => {
      if (activeImportBulkRuns.get(jobId) === entry) activeImportBulkRuns.delete(jobId);
    }
  };
}

/** 핸들을 들고 있지 않은 자리(언마운트 정리 등)에서 그 잡의 루프를 중단시킨다. */
export function cancelImportBulkRun(jobId: string): void {
  const entry = activeImportBulkRuns.get(jobId);
  if (entry) entry.cancelled = true;
}

export function isImportBulkRunActive(jobId: string): boolean {
  return activeImportBulkRuns.has(jobId);
}

/** 테스트 격리용 -- 프로덕션 코드에서는 부르지 않는다. */
export function resetImportBulkRuns(): void {
  activeImportBulkRuns.clear();
}

/* ------------------------------------------------------------------- 실행기 */

export type ImportBulkRunOutcome = "completed" | "cancelled" | "failed";

export type ImportBulkRunResult = {
  outcome: ImportBulkRunOutcome;
  /** 서버가 200으로 받아 준 건수. 중단·실패해도 여기까지는 진짜로 반영됐다. */
  appliedCount: number;
};

export type ImportBulkRunProgress = {
  done: number;
  total: number;
  /** 지난 보고 이후 반영된 행 id들. 캐시에 한 번에 밀어 넣으라고 모아 준다. */
  appliedRowIds: readonly string[];
};

export type ImportBulkRunOptions = {
  rowIds: readonly string[];
  selected: boolean;
  /** 단건 PATCH. 실패하면 throw 한다(그 자리에서 루프가 멈춘다). */
  patchRow: (rowId: string, selected: boolean) => Promise<unknown>;
  isCancelled: () => boolean;
  onProgress: (progress: ImportBulkRunProgress) => void;
  batchSize?: number;
};

/** 지금 진행 표시를 내보낼 차례인가. 마지막 건은 배치가 안 차도 반드시 보고한다. */
export function shouldFlushImportBulkProgress(done: number, total: number, batchSize: number): boolean {
  if (done >= total) return true;
  return batchSize > 0 && done % batchSize === 0;
}

/**
 * 순차 PATCH 루프. 화면 상태를 모르고, 캐시도 모르고, 네트워크 함수도 주입받는다.
 *
 * 중단 규칙: 매 건 **전후**로 `isCancelled()`를 본다. 앞에서 보는 건 아직 안 보낸 요청을 막기
 * 위해서고, 뒤에서 보는 건 이미 떠난 화면에 진행 보고를 밀어 넣지 않기 위해서다. 중단되면
 * 아직 보고하지 않은 배치는 **버린다** -- 호출부가 재조회로 진실을 다시 받아 오는 쪽이,
 * 사라진 화면의 캐시를 마지막으로 한 번 더 건드리는 것보다 안전하다.
 */
export async function runImportBulkSelection(options: ImportBulkRunOptions): Promise<ImportBulkRunResult> {
  const { rowIds, selected, patchRow, isCancelled, onProgress } = options;
  const batchSize = Math.max(1, options.batchSize ?? IMPORT_BULK_PROGRESS_BATCH_SIZE);
  const total = rowIds.length;
  let done = 0;
  let batch: string[] = [];

  const flush = () => {
    if (batch.length === 0) return;
    const appliedRowIds = batch;
    batch = [];
    onProgress({ done, total, appliedRowIds });
  };

  for (const rowId of rowIds) {
    if (isCancelled()) return { outcome: "cancelled", appliedCount: done };
    try {
      await patchRow(rowId, selected);
    } catch {
      // 중간에 끊기면 몇 건이 반영됐는지 화면이 알 수 없다 -- 여기까지의 배치만 보고하고
      // 호출부가 재조회로 진실을 다시 받아 온다(K-10의 전용 문구가 그 사실을 말한다).
      flush();
      return { outcome: "failed", appliedCount: done };
    }
    done += 1;
    batch.push(rowId);
    if (isCancelled()) return { outcome: "cancelled", appliedCount: done };
    if (shouldFlushImportBulkProgress(done, total, batchSize)) flush();
  }

  flush();
  return { outcome: "completed", appliedCount: done };
}

/* ------------------------------------------------------------------ 게이팅 */

export type ImportBulkStartInput = {
  hasAuth: boolean;
  /** 서버가 아직 편집을 받는 상태인가(preview_ready). */
  isPreviewReady: boolean;
  /** 이 화면이 이미 일괄 루프를 돌리고 있는가. */
  isBulkRunning: boolean;
  /** 진행 중인 단건 토글 수 -- 하나라도 있으면 일괄을 시작하지 않는다(교차 금지). */
  pendingRowCount: number;
  /** 이번에 실제로 PATCH할 행 수(계획이 빈 경우 누를 이유가 없다). */
  targetRowCount: number;
};

/** 일괄 버튼을 누를 수 있는가. 버튼의 `disabled`와 실행부의 첫 줄이 **같은 판정**을 쓴다. */
export function canStartImportBulkRun(input: ImportBulkStartInput): boolean {
  return (
    input.hasAuth &&
    input.isPreviewReady &&
    !input.isBulkRunning &&
    input.pendingRowCount === 0 &&
    input.targetRowCount > 0
  );
}

export type ImportRowToggleInput = {
  isPreviewReady: boolean;
  isBulkRunning: boolean;
  isRowPending: boolean;
};

/** 단건 토글을 누를 수 있는가. 일괄이 도는 동안에는 전부 잠근다(그 반대는 위 함수가 막는다). */
export function canToggleImportRow(input: ImportRowToggleInput): boolean {
  return input.isPreviewReady && !input.isBulkRunning && !input.isRowPending;
}

/* -------------------------------------------------------------------- 문구 */

/**
 * K-10: 일괄 중간 실패 전용 문구. 예전에는 목록 조회 실패 문구(`loadFailedText`, "불러오지
 * 못했어요. 잠시 후 다시 시도해 주세요.")를 그대로 썼는데, 그건 **아무것도 안 바뀌었다**는
 * 뜻으로 읽힌다 -- 실제로는 앞부분이 이미 서버에 반영된 상태였다.
 */
export const IMPORT_BULK_PARTIAL_FAILURE_TEXT =
  "일부만 반영됐어요. 목록을 새로고침했어요 — 남은 항목을 다시 시도해 주세요";

/** 사용자가 직접 멈춘 경우. 실패가 아니므로 사과하지 않고 사실만 말한다. */
export const IMPORT_BULK_CANCELLED_TEXT = "여기까지만 반영했어요. 목록을 새로고침했어요";

export const IMPORT_BULK_CANCEL_LABEL = "중단하기";

/** 중단 버튼의 스크린리더 라벨 -- 무엇을 중단하는지 말한다. */
export const IMPORT_BULK_CANCEL_A11Y_LABEL = "일괄 반영 중단하기";
