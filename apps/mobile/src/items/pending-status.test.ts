import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient } from "@tanstack/react-query";
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
  /** 라운드 99 F2 M-2: 패치는 이제 자기 주인(childId)과 겨냥한 캐시의 아이를 함께 받는다. */
  const patchFor = (itemTemplateId: string, status: "prepared" | "gifted") => ({
    childId: "child-1",
    itemTemplateId,
    status
  } as const);

  it("목록 응답 모양을 고친다", () => {
    const patched = patchItemStatusInQueryData(listData, patchFor("item-carseat", "prepared"), "child-1") as typeof listData;
    expect(patched.items[0].status).toBe("prepared");
    // 다른 행과 원본은 건드리지 않는다.
    expect(patched.items[1].status).toBe("interested");
    expect(listData.items[0].status).toBe("not_prepared");
  });

  it("준비율 스냅샷(배열) 모양도 고친다", () => {
    const patched = patchItemStatusInQueryData(listData.items, patchFor("item-bottle", "prepared"), "child-1") as Array<{
      status: string;
    }>;
    expect(patched[1].status).toBe("prepared");
  });

  it("상세 응답(단일 객체)은 id가 맞을 때만 고친다", () => {
    const detail = { id: "item-carseat", status: "not_prepared", name: "카시트" };
    expect((patchItemStatusInQueryData(detail, patchFor("item-carseat", "gifted"), "child-1") as typeof detail).status).toBe(
      "gifted"
    );
    expect(patchItemStatusInQueryData(detail, patchFor("item-other", "gifted"), "child-1")).toBe(detail);
  });

  it("모르는 모양은 그대로 돌려준다 (추측해서 고치지 않는다)", () => {
    const unknown = { totalAmountKrw: 1000 };
    expect(patchItemStatusInQueryData(unknown, patchFor("item-carseat", "prepared"), "child-1")).toBe(unknown);
    expect(patchItemStatusInQueryData(undefined, patchFor("item-carseat", "prepared"), "child-1")).toBeUndefined();
    expect(patchItemStatusInQueryData(null, patchFor("item-carseat", "prepared"), "child-1")).toBeNull();
  });

  /**
   * 라운드 99 F2 M-2 — 아이 경계 축. 색인 쪽 주석의 경고 그대로다: 준비템 id는 카탈로그 템플릿
   * id라 **아이가 달라도 같은 값**이다. 다른 아이의 캐시(cacheChildId 불일치)는 id가 맞아도
   * 한 바이트도 고치지 않고 **같은 참조**로 돌려준다.
   */
  it("다른 아이의 캐시는 id가 같아도 건드리지 않는다 (같은 참조 반환)", () => {
    const detail = { id: "item-carseat", status: "not_prepared", name: "카시트" };
    expect(patchItemStatusInQueryData(detail, patchFor("item-carseat", "prepared"), "child-2")).toBe(detail);
    expect(patchItemStatusInQueryData(listData, patchFor("item-carseat", "prepared"), "child-2")).toBe(listData);
    expect(patchItemStatusInQueryData(listData.items, patchFor("item-carseat", "prepared"), undefined)).toBe(listData.items);
  });
});

/**
 * 라운드 99 F2 M-2 — **캐시 패치가 아이 경계를 넘지 않는다**(교란 테스트).
 *
 * sync-controller의 updateItemStatusOffline은 vitest에서 import할 수 없으므로(네이티브 모듈)
 * 두 겹으로 고정한다:
 *  1. 실제 react-query QueryClient에 두 아이의 캐시를 실키 모양(["items", childId, "catalog"] ·
 *     ["item-detail", childId, itemTemplateId])으로 심고, 컨트롤러와 같은 접두
 *     `["items", childId]`로 setQueriesData를 돌려 **다른 아이 캐시가 안 바뀜**을 단언한다.
 *  2. 컨트롤러 소스가 실제로 그 좁힌 접두와 childId 인자를 쓰는지 소스 계약으로 고정한다.
 */
describe("라운드 99 F2 M-2: 낙관 캐시 패치의 아이 경계", () => {
  const controllerSource = () =>
    readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");

  it("접두를 childId까지 좁혀도 같은 아이의 캐시는 전부 패치되고, 다른 아이 캐시는 그대로다", () => {
    const queryClient = new QueryClient();
    const firstChildList = { items: [{ id: "item-carseat", status: "not_prepared" }] };
    const secondChildList = { items: [{ id: "item-carseat", status: "not_prepared" }] };
    const secondChildDetail = { id: "item-carseat", status: "not_prepared", name: "카시트" };
    queryClient.setQueryData(["items", "child-1", "catalog"], firstChildList);
    queryClient.setQueryData(["items", "child-2", "catalog"], secondChildList);
    queryClient.setQueryData(["item-detail", "child-2", "item-carseat"], secondChildDetail);

    // 컨트롤러의 배선과 같은 모양: 접두 ["items", childId] + 패치의 childId 검증 축.
    const cachePatch = { childId: "child-1", itemTemplateId: "item-carseat", status: "prepared" } as const;
    queryClient.setQueriesData({ queryKey: ["items", "child-1"] }, (data: unknown) =>
      patchItemStatusInQueryData(data, cachePatch, "child-1")
    );
    queryClient.setQueriesData({ queryKey: ["item-detail", "child-1"] }, (data: unknown) =>
      patchItemStatusInQueryData(data, cachePatch, "child-1")
    );

    expect(
      (queryClient.getQueryData(["items", "child-1", "catalog"]) as typeof firstChildList).items[0].status
    ).toBe("prepared");
    // 둘째의 캐시는 값도 참조도 그대로 — 배지 없는 낙관 반영(거짓 표시)이 설 자리가 없다.
    expect(queryClient.getQueryData(["items", "child-2", "catalog"])).toBe(secondChildList);
    expect(queryClient.getQueryData(["item-detail", "child-2", "item-carseat"])).toBe(secondChildDetail);
  });

  it("컨트롤러가 실제로 그 좁힌 접두와 childId 축을 쓴다 (소스 계약)", () => {
    const controller = controllerSource();
    const writeBody = controller.slice(
      controller.indexOf("export async function updateItemStatusOffline"),
      controller.indexOf("export async function retryOfflineItemStatus")
    );
    expect(writeBody).toContain('queryClient.setQueriesData({ queryKey: ["items", payload.childId] }');
    expect(writeBody).toContain('queryClient.setQueriesData({ queryKey: ["item-detail", payload.childId] }');
    // 접두 전체(["items"] 단독)로 되돌아가지 않는다.
    expect(writeBody).not.toContain('setQueriesData({ queryKey: ["items"] }');
    expect(writeBody).not.toContain('setQueriesData({ queryKey: ["item-detail"] }');
    // 패치 함수에도 주인과 겨냥한 캐시의 아이가 함께 간다.
    expect(writeBody).toContain("{ childId: payload.childId, itemTemplateId: payload.itemTemplateId, status: payload.status }");
  });
});
