import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { render } from "../test-utils/react-test-renderer";
import type { StateStorage } from "zustand/middleware";

vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
  DateTimePickerAndroid: { open: vi.fn() }
}));
vi.mock("expo-web-browser", () => ({
  openBrowserAsync: vi.fn(),
  WebBrowserResultType: { LOCKED: "locked" }
}));
vi.mock("react-native", () => ({
  Linking: { canOpenURL: vi.fn(), openURL: vi.fn() },
  Pressable: "Pressable",
  Text: "Text",
  View: "View"
}));

import { PurchaseOfferAction } from "./PurchaseOfferAction";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import {
  beginPurchaseFollowup,
  markPurchaseFollowupOpened,
  markPurchaseFollowupRecorded
} from "./store";

function memoryStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const baseProps = {
  childId: "child-1",
  itemDefinitionId: "item-1",
  offer: { id: "offer-1", publicUrl: "https://seller.example/item-1" },
  scopeKey: "scope-1"
};

describe("PurchaseOfferAction rendered integration", () => {
  it("opens the seller and creates the Home follow-up from the rendered item-detail CTA", async () => {
    const storage = memoryStorage();
    const openURL = vi.fn(async () => undefined);
    const canOpenURL = vi.fn(async () => true);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="followup"
        dependencies={{ storage, canOpenURL, openURL }}
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(openURL).toHaveBeenCalledOnce();
      expect(onMessage).toHaveBeenCalledWith(
        "판매처에서 확인한 뒤 홈 화면으로 돌아오면 구매 여부를 다시 안내해 드릴게요."
      );
    });
  });

  it("still opens a safe seller URL when canOpenURL reports a false negative", async () => {
    const storage = memoryStorage();
    const openURL = vi.fn(async () => undefined);
    const canOpenURL = vi.fn(async () => false);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="followup"
        dependencies={{ storage, canOpenURL, openURL }}
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(canOpenURL).toHaveBeenCalledOnce();
      expect(openURL).toHaveBeenCalledOnce();
      expect(onMessage).toHaveBeenCalledWith(
        "판매처에서 확인한 뒤 홈 화면으로 돌아오면 구매 여부를 다시 안내해 드릴게요."
      );
    });
  });

  it("preserves the Linking receiver and falls back when the native URL opener rejects", async () => {
    vi.mocked(Linking.canOpenURL).mockImplementation(function (this: typeof Linking) {
      if (this !== Linking) throw new TypeError("Linking receiver was lost");
      return Promise.resolve(false);
    });
    vi.mocked(Linking.openURL).mockRejectedValue(new Error("native opener rejected"));
    vi.mocked(WebBrowser.openBrowserAsync).mockResolvedValue({ type: "dismiss" } as never);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="direct"
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(baseProps.offer.publicUrl);
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(baseProps.offer.publicUrl);
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  it("fails closed when both the native opener and custom tab are unavailable", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
    vi.mocked(Linking.openURL).mockRejectedValue(new Error("native opener rejected"));
    vi.mocked(WebBrowser.openBrowserAsync).mockResolvedValue({ type: "locked" } as never);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="direct"
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(
        "판매처 페이지를 열지 못했어요. 잠시 후 다시 시도해 주세요."
      );
      expect(warning).toHaveBeenCalledOnce();
    });
    warning.mockRestore();
  });

  it("still opens the seller while preserving an existing recorded-pending-sync expense", async () => {
    const storage = memoryStorage();
    const now = Date.now();
    const opening = await beginPurchaseFollowup(
      {
        scopeKey: baseProps.scopeKey,
        childId: baseProps.childId,
        itemDefinitionId: baseProps.itemDefinitionId,
        offerId: baseProps.offer.id
      },
      { storage, nowMs: now }
    );
    await markPurchaseFollowupOpened(opening.intentId, { storage, nowMs: now + 1 });
    await markPurchaseFollowupRecorded(
      {
        intentId: opening.intentId,
        scopeKey: baseProps.scopeKey,
        childId: baseProps.childId,
        itemDefinitionId: baseProps.itemDefinitionId,
        localExpenseId: "local-1"
      },
      { storage, nowMs: now + 2 }
    );
    const openURL = vi.fn(async () => undefined);
    const canOpenURL = vi.fn(async () => true);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="followup"
        dependencies={{ storage, canOpenURL, openURL }}
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(openURL).toHaveBeenCalledOnce();
      expect(onMessage).toHaveBeenCalledWith(
        "판매처를 열었어요. 기존 지출 기록의 동기화 상태는 홈에서 계속 확인할 수 있어요."
      );
    });
  });

  it("surfaces a safe retry message when follow-up persistence fails after the seller opens", async () => {
    const storage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => {
        throw new Error("storage unavailable");
      }
    };
    const openURL = vi.fn(async () => undefined);
    const canOpenURL = vi.fn(async () => true);
    const onMessage = vi.fn();
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="followup"
        dependencies={{ storage, canOpenURL, openURL }}
        onMessage={onMessage}
      />
    );

    renderer.act(() =>
      tree.root.findByProps({ accessibilityLabel: "판매처 일반 페이지 열기" }).props.onPress()
    );
    await vi.waitFor(() => {
      expect(openURL).toHaveBeenCalledOnce();
      expect(onMessage).toHaveBeenCalledWith(
        "판매처는 열었지만 구매 안내를 저장하지 못했어요. 구매했다면 지출 기록에서 직접 남겨 주세요."
      );
    });
  });

  it("disables the rendered CTA while household role verification is loading", () => {
    const tree = render(
      <PurchaseOfferAction
        {...baseProps}
        accessState="checking"
        onMessage={() => undefined}
      />
    );
    const button = tree.root.findByProps({ accessibilityLabel: "가족 권한 확인 중" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
