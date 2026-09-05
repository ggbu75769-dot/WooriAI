import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { render } from "../test-utils/react-test-renderer";

vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View"
}));

import { PurchaseFollowupCard, purchaseExpenseRouteParams } from "./PurchaseFollowupCard";
import type { PurchaseFollowup } from "./store";

const pending: PurchaseFollowup = {
  intentId: "intent-1",
  scopeKey: "scope-1",
  childId: "child-1",
  itemDefinitionId: "item-canonical",
  offerId: "offer-1",
  state: "pending",
  openedAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  snoozedUntil: null,
  localExpenseId: null
};

describe("PurchaseFollowupCard interactions", () => {
  it("routes with the stored canonical item and exposes record, snooze, and remove actions", () => {
    const onRecord = vi.fn();
    const onSnooze = vi.fn();
    const onRemove = vi.fn();
    const tree = render(
      <PurchaseFollowupCard
        followup={pending}
        itemName="카시트"
        onRecord={onRecord}
        onRemove={onRemove}
        onReviewSync={() => undefined}
        onSnooze={onSnooze}
      />
    );
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "구매했어요 · 지출 기록" }).props.onPress());
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "구매 여부 내일 다시 확인" }).props.onPress());
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "구매 후속 안내 지우기" }).props.onPress());
    expect(onRecord).toHaveBeenCalledOnce();
    expect(onSnooze).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(purchaseExpenseRouteParams(pending, "카시트")).toEqual({
      pathname: "/expenses/new",
      params: {
        itemName: "카시트",
        itemDefinitionId: "item-canonical",
        purchaseIntentId: "intent-1"
      }
    });
  });

  it("renders only the sync review action after an expense is recorded", () => {
    const onReviewSync = vi.fn();
    const tree = render(
      <PurchaseFollowupCard
        followup={{ ...pending, state: "recorded_pending_sync", localExpenseId: "local-1" }}
        itemName="카시트"
        onRecord={() => undefined}
        onRemove={() => undefined}
        onReviewSync={onReviewSync}
        onSnooze={() => undefined}
      />
    );
    expect(tree.root.findAllByProps({ accessibilityLabel: "구매했어요 · 지출 기록" })).toHaveLength(0);
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "동기화 상태 확인" }).props.onPress());
    expect(onReviewSync).toHaveBeenCalledOnce();
  });
});
