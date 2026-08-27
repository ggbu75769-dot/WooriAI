import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canStartImportBulkRun,
  canToggleImportRow,
  cancelImportBulkRun,
  claimImportBulkRun,
  isImportBulkRunActive,
  resetImportBulkRuns,
  runImportBulkSelection,
  shouldFlushImportBulkProgress,
  IMPORT_BULK_CANCELLED_TEXT,
  IMPORT_BULK_CANCEL_LABEL,
  IMPORT_BULK_PARTIAL_FAILURE_TEXT,
  IMPORT_BULK_PROGRESS_BATCH_SIZE,
  type ImportBulkRunProgress
} from "./bulk-run";

beforeEach(() => {
  resetImportBulkRuns();
});

/** 순차 PATCH 한 건을 흉내 내는 최소 스텁 -- 실제 fetch는 여기 관심사가 아니다. */
function collector() {
  const patched: string[] = [];
  const progress: ImportBulkRunProgress[] = [];
  return {
    patched,
    progress,
    patchRow: async (rowId: string) => {
      patched.push(rowId);
    },
    onProgress: (value: ImportBulkRunProgress) => {
      progress.push(value);
    }
  };
}

const ids = (count: number) => Array.from({ length: count }, (_, index) => `row-${index + 1}`);

describe("K-6 순차 PATCH 실행기", () => {
  it("계획된 행을 순서대로 보내고 completed로 끝난다", async () => {
    const sink = collector();
    const result = await runImportBulkSelection({
      rowIds: ["a", "b", "c"],
      selected: true,
      isCancelled: () => false,
      patchRow: sink.patchRow,
      onProgress: sink.onProgress
    });

    expect(result).toEqual({ outcome: "completed", appliedCount: 3 });
    expect(sink.patched).toEqual(["a", "b", "c"]);
  });

  /**
   * PERF: 진행 보고 한 번이 곧 캐시 쓰기 한 번이고, 캐시 쓰기 한 번이 2,000행 배열 하나다.
   * 매 건마다 보고하면 O(n^2) -- 배치로 모은다.
   */
  it("진행 보고는 N건 단위로 모이고, 마지막 자투리도 반드시 보고된다", async () => {
    const sink = collector();
    await runImportBulkSelection({
      rowIds: ids(25),
      selected: true,
      isCancelled: () => false,
      patchRow: sink.patchRow,
      onProgress: sink.onProgress,
      batchSize: 10
    });

    expect(sink.progress.map((item) => item.done)).toEqual([10, 20, 25]);
    expect(sink.progress.map((item) => item.appliedRowIds.length)).toEqual([10, 10, 5]);
    expect(sink.progress.every((item) => item.total === 25)).toBe(true);
    // 보고된 id의 합집합이 곧 보낸 목록이다(빠뜨린 행 없음).
    expect(sink.progress.flatMap((item) => [...item.appliedRowIds])).toEqual(ids(25));
  });

  it("기본 배치 크기는 10건이다 (2,000행에서 200번의 캐시 쓰기)", async () => {
    const sink = collector();
    await runImportBulkSelection({
      rowIds: ids(IMPORT_BULK_PROGRESS_BATCH_SIZE + 1),
      selected: true,
      isCancelled: () => false,
      patchRow: sink.patchRow,
      onProgress: sink.onProgress
    });
    expect(sink.progress.map((item) => item.done)).toEqual([IMPORT_BULK_PROGRESS_BATCH_SIZE, IMPORT_BULK_PROGRESS_BATCH_SIZE + 1]);
  });

  it("마지막 건은 배치가 안 차도 보고한다", () => {
    expect(shouldFlushImportBulkProgress(3, 3, 10)).toBe(true);
    expect(shouldFlushImportBulkProgress(10, 25, 10)).toBe(true);
    expect(shouldFlushImportBulkProgress(11, 25, 10)).toBe(false);
  });

  /**
   * 이탈(언마운트·blur) 시나리오. 예전에는 고아 루프가 끝까지 PATCH를 보내고 캐시에 계속 썼다.
   */
  it("중단되면 남은 PATCH를 보내지 않고, 아직 보고 안 한 배치도 화면에 밀어 넣지 않는다", async () => {
    const sink = collector();
    let cancelled = false;
    const result = await runImportBulkSelection({
      rowIds: ids(50),
      selected: true,
      isCancelled: () => cancelled,
      patchRow: async (rowId: string) => {
        await sink.patchRow(rowId);
        if (sink.patched.length === 3) cancelled = true;
      },
      onProgress: sink.onProgress,
      batchSize: 10
    });

    expect(result).toEqual({ outcome: "cancelled", appliedCount: 3 });
    expect(sink.patched).toEqual(["row-1", "row-2", "row-3"]);
    // 중단 시점의 자투리 배치는 버린다 -- 호출부가 재조회로 진실을 다시 받아 온다.
    expect(sink.progress).toEqual([]);
  });

  it("시작 전에 이미 중단돼 있으면 한 건도 보내지 않는다", async () => {
    const sink = collector();
    const result = await runImportBulkSelection({
      rowIds: ids(5),
      selected: false,
      isCancelled: () => true,
      patchRow: sink.patchRow,
      onProgress: sink.onProgress
    });
    expect(result).toEqual({ outcome: "cancelled", appliedCount: 0 });
    expect(sink.patched).toEqual([]);
  });

  it("중간 실패는 거기서 멈추고, 그때까지 반영된 건수를 정직하게 돌려준다", async () => {
    const sink = collector();
    const result = await runImportBulkSelection({
      rowIds: ids(20),
      selected: true,
      isCancelled: () => false,
      patchRow: async (rowId: string) => {
        if (rowId === "row-4") throw new Error("403");
        await sink.patchRow(rowId);
      },
      onProgress: sink.onProgress,
      batchSize: 10
    });

    expect(result).toEqual({ outcome: "failed", appliedCount: 3 });
    expect(sink.patched).toEqual(["row-1", "row-2", "row-3"]);
    // 실패 시에는 여기까지의 배치를 보고한다 -- 화면이 "3건은 진짜 반영됐다"를 알아야 한다.
    expect(sink.progress).toEqual([{ done: 3, total: 20, appliedRowIds: ["row-1", "row-2", "row-3"] }]);
  });

  it("빈 계획은 아무 일도 하지 않는다", async () => {
    const sink = collector();
    const result = await runImportBulkSelection({
      rowIds: [],
      selected: true,
      isCancelled: () => false,
      patchRow: sink.patchRow,
      onProgress: sink.onProgress
    });
    expect(result).toEqual({ outcome: "completed", appliedCount: 0 });
    expect(sink.progress).toEqual([]);
  });
});

describe("K-6 잡별 실행 등록부 (재진입 이중 실행 차단)", () => {
  it("같은 잡의 두 번째 실행권은 내주지 않는다", () => {
    const first = claimImportBulkRun("job-1");
    expect(first).not.toBeNull();
    expect(isImportBulkRunActive("job-1")).toBe(true);
    expect(claimImportBulkRun("job-1")).toBeNull();

    first!.release();
    expect(isImportBulkRunActive("job-1")).toBe(false);
    expect(claimImportBulkRun("job-1")).not.toBeNull();
  });

  it("다른 잡은 서로를 막지 않는다", () => {
    expect(claimImportBulkRun("job-1")).not.toBeNull();
    expect(claimImportBulkRun("job-2")).not.toBeNull();
  });

  it("잡 id가 없으면 실행권도 없다 (라우트 파라미터가 비어 도착한 경우)", () => {
    expect(claimImportBulkRun("")).toBeNull();
  });

  it("핸들 없이도 잡 id로 중단시킬 수 있다 (언마운트 정리 경로)", () => {
    const handle = claimImportBulkRun("job-1")!;
    expect(handle.isCancelled()).toBe(false);
    cancelImportBulkRun("job-1");
    expect(handle.isCancelled()).toBe(true);
    // 없는 잡을 중단시켜도 조용히 지나간다.
    expect(() => cancelImportBulkRun("job-nope")).not.toThrow();
  });

  it("release는 자기 등록만 지운다 -- 늦게 끝난 옛 루프가 새 루프를 풀어 주지 않는다", () => {
    const stale = claimImportBulkRun("job-1")!;
    stale.release();
    const fresh = claimImportBulkRun("job-1")!;
    stale.release();
    expect(isImportBulkRunActive("job-1")).toBe(true);
    fresh.release();
    expect(isImportBulkRunActive("job-1")).toBe(false);
  });

  it("실행 중 재진입은 실행기까지 내려가지 않는다", async () => {
    const patchRow = vi.fn(async () => {});
    const handle = claimImportBulkRun("job-1");
    expect(handle).not.toBeNull();

    // 두 번째 진입: 실행권을 못 받았으므로 PATCH를 한 건도 보내지 않는다.
    const second = claimImportBulkRun("job-1");
    expect(second).toBeNull();
    expect(patchRow).not.toHaveBeenCalled();
  });
});

describe("K-6 게이팅 판정 (버튼 disabled와 실행부 첫 줄이 같은 규칙)", () => {
  const base = {
    hasAuth: true,
    isPreviewReady: true,
    isBulkRunning: false,
    pendingRowCount: 0,
    targetRowCount: 5
  };

  it("정상 상태에서만 일괄을 시작한다", () => {
    expect(canStartImportBulkRun(base)).toBe(true);
    expect(canStartImportBulkRun({ ...base, hasAuth: false })).toBe(false);
    expect(canStartImportBulkRun({ ...base, isPreviewReady: false })).toBe(false);
    expect(canStartImportBulkRun({ ...base, targetRowCount: 0 })).toBe(false);
  });

  it("일괄이 이미 돌고 있으면 다시 시작하지 않는다", () => {
    expect(canStartImportBulkRun({ ...base, isBulkRunning: true })).toBe(false);
  });

  it("단건 토글이 하나라도 진행 중이면 일괄을 시작하지 않는다 (교차 금지)", () => {
    expect(canStartImportBulkRun({ ...base, pendingRowCount: 1 })).toBe(false);
  });

  it("반대로 일괄이 도는 동안에는 단건 토글을 전부 잠근다", () => {
    expect(canToggleImportRow({ isPreviewReady: true, isBulkRunning: false, isRowPending: false })).toBe(true);
    expect(canToggleImportRow({ isPreviewReady: true, isBulkRunning: true, isRowPending: false })).toBe(false);
    // 잠기는 것은 그 행 하나뿐이라는 규칙은 그대로다.
    expect(canToggleImportRow({ isPreviewReady: true, isBulkRunning: false, isRowPending: true })).toBe(false);
    expect(canToggleImportRow({ isPreviewReady: false, isBulkRunning: false, isRowPending: false })).toBe(false);
  });
});

describe("K-10 일괄 결과 문구", () => {
  it("부분 실패는 '아무것도 안 됐어요'가 아니라 '일부만 반영됐어요'라고 말한다 (해요체)", () => {
    expect(IMPORT_BULK_PARTIAL_FAILURE_TEXT).toBe(
      "일부만 반영됐어요. 목록을 새로고침했어요 — 남은 항목을 다시 시도해 주세요"
    );
    expect(IMPORT_BULK_PARTIAL_FAILURE_TEXT).toContain("일부만 반영됐어요");
    // 목록 조회 실패 문구를 돌려 쓰지 않는다.
    expect(IMPORT_BULK_PARTIAL_FAILURE_TEXT).not.toBe("불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("사용자가 멈춘 경우는 실패가 아니므로 사과하지 않는다", () => {
    expect(IMPORT_BULK_CANCELLED_TEXT).toBe("여기까지만 반영했어요. 목록을 새로고침했어요");
    expect(IMPORT_BULK_CANCELLED_TEXT).not.toContain("못했어요");
    expect(IMPORT_BULK_CANCEL_LABEL).toBe("중단하기");
  });
});
