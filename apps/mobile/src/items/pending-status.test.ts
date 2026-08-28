import { describe, expect, it } from "vitest";
import { SYNC_ROW_FAILED_LABEL, SYNC_ROW_PENDING_LABEL } from "../offline/messages";
import type { ItemStatusOutboxRow } from "../offline/types";
import {
  buildPendingItemStatusIndex,
  effectiveItemStatus,
  patchItemStatusInQueryData,
  pendingItemStatusView
} from "./pending-status";
import { ITEM_STATUS_QUEUED_MESSAGE, ITEM_STATUS_SYNC_FAILED_HINT } from "./status-mutation-messages";

function row(overrides: Partial<ItemStatusOutboxRow> = {}): ItemStatusOutboxRow {
  return {
    mutationId: "istat-1",
    childId: "child-1",
    itemTemplateId: "item-carseat",
    status: "prepared",
    itemName: "카시트",
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides
  };
}

describe("buildPendingItemStatusIndex", () => {
  it("지금 보고 있는 아이의 행만 담는다", () => {
    const index = buildPendingItemStatusIndex(
      [row(), row({ mutationId: "istat-2", childId: "child-2", itemTemplateId: "item-stroller" })],
      "child-1"
    );

    expect(index.get("item-carseat")?.mutationId).toBe("istat-1");
    expect(index.has("item-stroller")).toBe(false);
  });

  /**
   * 준비템 id는 카탈로그 템플릿 id라 **아이가 달라도 같은 값**이다. 아이로 거르지 않으면
   * 첫째에게 누른 "준비했어요"가 둘째 목록에도 반영된 것처럼 보인다.
   */
  it("같은 준비템이라도 다른 아이의 대기 행은 새어 들어오지 않는다", () => {
    const index = buildPendingItemStatusIndex([row({ childId: "child-2" })], "child-1");
    expect(index.size).toBe(0);
  });

  it("아이가 아직 선택되지 않았거나 큐가 비면 빈 색인이다", () => {
    expect(buildPendingItemStatusIndex([row()], null).size).toBe(0);
    expect(buildPendingItemStatusIndex(undefined, "child-1").size).toBe(0);
  });

  it("전송 중 행과 그 뒤에 누른 행이 함께 있으면 나중 행(사용자가 마지막으로 원한 값)을 쓴다", () => {
    const index = buildPendingItemStatusIndex(
      [
        row({ mutationId: "istat-inflight", status: "interested", inFlight: true, syncState: "syncing" }),
        row({ mutationId: "istat-latest", status: "not_needed" })
      ],
      "child-1"
    );

    expect(index.get("item-carseat")?.status).toBe("not_needed");
  });
});

describe("effectiveItemStatus", () => {
  it("대기 중인 값이 서버 응답을 이긴다", () => {
    expect(effectiveItemStatus("not_prepared", row({ status: "gifted" }))).toBe("gifted");
  });

  it("대기 행이 없으면 서버 값 그대로다 (비세션 프리뷰 불변)", () => {
    expect(effectiveItemStatus("not_prepared", undefined)).toBe("not_prepared");
  });
});

describe("pendingItemStatusView", () => {
  it("대기 행은 기록 탭과 같은 배지 문구 + 자동 반영 약속", () => {
    const view = pendingItemStatusView(row());
    expect(view?.badgeLabel).toBe(SYNC_ROW_PENDING_LABEL);
    expect(view?.noticeText).toBe(ITEM_STATUS_QUEUED_MESSAGE);
  });

  it("전송 중 행도 대기와 같은 문구다 (사용자에게 둘의 차이는 의미가 없다)", () => {
    expect(pendingItemStatusView(row({ syncState: "syncing" }))?.badgeLabel).toBe(SYNC_ROW_PENDING_LABEL);
  });

  it("실패 행은 서버가 준 사유 + 어디서 정리할 수 있는지", () => {
    const view = pendingItemStatusView(
      row({ syncState: "failed", lastError: "이 가구에서 편집 권한이 없어요." })
    );
    expect(view?.badgeLabel).toBe(SYNC_ROW_FAILED_LABEL);
    expect(view?.noticeText).toContain("이 가구에서 편집 권한이 없어요.");
    expect(view?.noticeText).toContain(ITEM_STATUS_SYNC_FAILED_HINT);
  });

  it("사유가 없으면 힌트 한 줄만 남는다 (빈 문장을 붙이지 않는다)", () => {
    expect(pendingItemStatusView(row({ syncState: "failed" }))?.noticeText).toBe(ITEM_STATUS_SYNC_FAILED_HINT);
  });

  it("큐에 없으면 null -- 화면에 아무것도 늘어나지 않는다", () => {
    expect(pendingItemStatusView(undefined)).toBeNull();
  });
});

describe("patchItemStatusInQueryData (낙관 반영)", () => {
  const listData = { items: [{ id: "item-carseat", status: "not_prepared" }, { id: "item-bottle", status: "interested" }] };

  it("목록 응답 모양을 고친다", () => {
    const patched = patchItemStatusInQueryData(listData, "item-carseat", "prepared") as typeof listData;
    expect(patched.items[0].status).toBe("prepared");
    // 다른 행과 원본은 건드리지 않는다.
    expect(patched.items[1].status).toBe("interested");
    expect(listData.items[0].status).toBe("not_prepared");
  });

  it("준비율 스냅샷(배열) 모양도 고친다", () => {
    const patched = patchItemStatusInQueryData(listData.items, "item-bottle", "prepared") as Array<{ status: string }>;
    expect(patched[1].status).toBe("prepared");
  });

  it("상세 응답(단일 객체)은 id가 맞을 때만 고친다", () => {
    const detail = { id: "item-carseat", status: "not_prepared", name: "카시트" };
    expect((patchItemStatusInQueryData(detail, "item-carseat", "gifted") as typeof detail).status).toBe("gifted");
    expect(patchItemStatusInQueryData(detail, "item-other", "gifted")).toBe(detail);
  });

  it("모르는 모양은 그대로 돌려준다 (추측해서 고치지 않는다)", () => {
    const unknown = { totalAmountKrw: 1000 };
    expect(patchItemStatusInQueryData(unknown, "item-carseat", "prepared")).toBe(unknown);
    expect(patchItemStatusInQueryData(undefined, "item-carseat", "prepared")).toBeUndefined();
    expect(patchItemStatusInQueryData(null, "item-carseat", "prepared")).toBeNull();
  });
});
