import { describe, expect, it } from "vitest";
import { notificationTapRoute } from "./notification-route";

/**
 * 라운드 39 UX-O: 알림 탭 목적지 판정.
 *
 * 회귀의 핵심은 weekly_summary다 -- 예산 알림과 한 조건으로 묶여 예산 **수정 폼**으로 가고
 * 있었는데, 그 알림 본문은 "지출 내역을 확인해보세요"다. 종류별 목적지를 값으로 못박는다.
 */
describe("라운드 39 UX-O 알림 탭 목적지", () => {
  it("주간 요약은 지출 내역으로 간다 (예산 수정 폼이 아니라)", () => {
    const route = notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" });
    expect(route).toBe("/(tabs)/records");
    expect(route).not.toBe("/budget");
  });

  it("예산 80%/100% 알림은 그대로 예산 화면으로 간다", () => {
    expect(notificationTapRoute({ type: "budget_80", dedupeKey: "budget_80:child-1:2026-08" })).toBe("/budget");
    expect(notificationTapRoute({ type: "budget_100", dedupeKey: "budget_100:child-1:2026-08" })).toBe("/budget");
  });

  it("시기 전환 알림은 준비템 탭으로 간다", () => {
    expect(notificationTapRoute({ type: "stage_transition", dedupeKey: "stage_transition:child-1:12개월" })).toBe(
      "/(tabs)/items"
    );
  });

  it("구매 확인 알림은 그 준비템 상세로 간다", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending:item-diaper:1700000000000" })).toBe(
      "/items/item-diaper"
    );
  });

  it("dedupeKey에서 준비템을 못 뽑거나 모르는 종류면 준비템 목록으로 떨어진다 (기존 폴백 그대로)", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending" })).toBe("/(tabs)/items");
    expect(notificationTapRoute({ type: "something_new", dedupeKey: "something_new:1" })).toBe("/(tabs)/items");
  });
});
