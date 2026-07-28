import React from "react";
import renderer, { act } from "react-test-renderer";
import { AccessibilityInfo } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalTodayCenterContract } from "../api/client";
import { semanticColors } from "../design-system/tokens/color";

vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  findNodeHandle: () => 1
}));

import { TodayCenterCard } from "./TodayCenterCard";

const childId = "5d2a79d4-cc9d-4e78-898d-64d889802031";
const itemId = "20ca11fe-0000-4a01-8a01-f1c7deb0a001";
const center: LocalTodayCenterContract = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  referenceDate: "2026-07-26",
  source: "local_fixture",
  actions: [
    {
      actionKey: "safety:local",
      kind: "safety_acknowledgement",
      sourceId: itemId,
      childId,
      dueDate: null,
      assignedUserId: null,
      reasonCode: "safety_acknowledgement",
      reasonParams: { itemName: "기저귀" },
      navigation: { kind: "notifications" },
      preferenceScope: { kind: "child", childId },
      preferenceVersion: 0
    },
    {
      actionKey: "plan:local:recurring",
      kind: "recurring_due",
      sourceId: itemId,
      childId,
      dueDate: "2026-07-27",
      assignedUserId: null,
      reasonCode: "recurring_due",
      reasonParams: { itemName: "기저귀" },
      navigation: { kind: "item", itemId, childId },
      preferenceScope: { kind: "child", childId },
      preferenceVersion: 0
    }
  ]
};

describe("TodayCenterCard", () => {
  beforeEach(() => {
    vi.mocked(AccessibilityInfo.setAccessibilityFocus).mockClear();
  });

  it("keeps safety non-dismissible and exposes a contextual 48dp snooze sheet", async () => {
    const onNavigate = vi.fn();
    const onSnooze = vi.fn().mockResolvedValue({
      kind: "saved",
      message: "내일까지 미뤘어요.",
      canRetryMutation: false
    });
    const tree = renderer.create(
      <TodayCenterCard
        center={center}
        onNavigate={onNavigate}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSnooze={onSnooze}
      />,
      { createNodeMock: () => ({}) }
    );

    expect(tree.root.findAll((node) => node.props.accessibilityLabel === "기저귀 안전 확인 알림 관리")).toHaveLength(0);
    const manage = tree.root.find((node) => node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리");
    expect(manage.props.accessibilityRole).toBe("button");
    expect(manage.props.style({ pressed: false })).toMatchObject({ height: 48, width: 48 });

    act(() => manage.props.onPress());
    const modal = tree.root.find((node) => String(node.type) === "Modal");
    expect(modal.props.onRequestClose).toBeTypeOf("function");
    expect(tree.root.findAll((node) => node.props.accessibilityViewIsModal)).toHaveLength(1);
    const snooze = tree.root.find((node) => node.props.accessibilityLabel === "내일까지 미루기");

    await act(async () => {
      await snooze.props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSnooze).toHaveBeenCalledWith(center.actions[1]);
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.accessibilityLiveRegion === "polite")).toHaveLength(1);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });

  it("navigates safety without opening management", () => {
    const onNavigate = vi.fn();
    const tree = renderer.create(
      <TodayCenterCard
        center={{ ...center, actions: [center.actions[0]!] }}
        onNavigate={onNavigate}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSnooze={vi.fn()}
      />
    );
    const row = tree.root.findAll((node) => node.props.accessibilityRole === "button" && !node.props.accessibilityLabel)[0]!;
    act(() => row.props.onPress());
    expect(onNavigate).toHaveBeenCalledWith(center.actions[0]);
  });

  it("focuses the sheet heading and restores the invoker on Android-back dismissal", async () => {
    const tree = renderer.create(
      <TodayCenterCard
        center={{ ...center, actions: [center.actions[1]!] }}
        onNavigate={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSnooze={vi.fn()}
      />,
      { createNodeMock: () => ({}) }
    );
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리"
    ).props.onPress());
    const modal = tree.root.find((node) => String(node.type) === "Modal");
    await act(async () => {
      modal.props.onShow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledTimes(1);

    await act(async () => {
      modal.props.onRequestClose();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(0);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledTimes(2);
  });

  it("keeps modal focus contained when Android Back is pressed during a pending snooze", async () => {
    const onSnooze = vi.fn().mockReturnValue(new Promise(() => undefined));
    const tree = renderer.create(
      <TodayCenterCard
        center={{ ...center, actions: [center.actions[1]!] }}
        onNavigate={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSnooze={onSnooze}
      />,
      { createNodeMock: () => ({}) }
    );
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리"
    ).props.onPress());
    const modal = tree.root.find((node) => String(node.type) === "Modal");
    await act(async () => {
      modal.props.onShow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      tree.root.find((node) => node.props.accessibilityLabel === "내일까지 미루기").props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      modal.props.onRequestClose();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSnooze).toHaveBeenCalledOnce();
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(1);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledTimes(1);
  });

  it("moves programmatic refresh-close focus to the stable Today heading", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const tree = renderer.create(
      <TodayCenterCard
        center={center}
        onNavigate={vi.fn()}
        onRefresh={onRefresh}
        onSnooze={vi.fn().mockResolvedValue({
          kind: "saved_refresh_failed",
          message: "저장됐지만 목록을 새로 불러오지 못했어요.",
          canRetryMutation: false
        })}
      />,
      { createNodeMock: () => ({}) }
    );
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리"
    ).props.onPress());
    await act(async () => {
      await tree.root.find((node) => node.props.accessibilityLabel === "내일까지 미루기").props.onPress();
    });
    await act(async () => {
      await tree.root.find((node) => node.props.accessibilityLabel === "목록 다시 불러오기").props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(0);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });

  it("renders an indeterminate refresh-required outcome as warning, not success", async () => {
    const tree = renderer.create(
      <TodayCenterCard
        center={{ ...center, actions: [center.actions[1]!] }}
        onNavigate={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSnooze={vi.fn().mockResolvedValue({
          kind: "refresh_required",
          message: "저장 여부를 확인하지 못했어요. 먼저 최신 상태를 불러와 주세요.",
          canRetryMutation: false
        })}
      />
    );
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리"
    ).props.onPress());
    await act(async () => {
      await tree.root.find((node) => node.props.accessibilityLabel === "내일까지 미루기").props.onPress();
    });

    const toast = tree.root.find((node) => node.props.accessibilityLiveRegion === "polite");
    expect(toast.props.style).toMatchObject({ backgroundColor: semanticColors.warningSurface });
    expect(toast.find((node) => String(node.type) === "MaterialCommunityIcons").props).toMatchObject({
      color: semanticColors.warning,
      name: "alert-circle-outline"
    });
  });

  it("keeps the success announcement and focus target when the last action disappears", async () => {
    let resolveSnooze!: (value: {
      kind: "saved";
      message: string;
      canRetryMutation: false;
    }) => void;
    const onSnooze = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveSnooze = resolve;
    }));
    const ordinaryOnly = { ...center, actions: [center.actions[1]!] };
    const props = {
      onNavigate: vi.fn(),
      onRefresh: vi.fn().mockResolvedValue(undefined),
      onSnooze
    };
    const tree = renderer.create(
      <TodayCenterCard center={ordinaryOnly} {...props} />,
      { createNodeMock: () => ({}) }
    );
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "기저귀 반복 구매 알림 관리"
    ).props.onPress());
    act(() => tree.root.find((node) =>
      node.props.accessibilityLabel === "내일까지 미루기"
    ).props.onPress());

    await act(async () => {
      tree.update(<TodayCenterCard center={{ ...ordinaryOnly, actions: [] }} {...props} />);
      resolveSnooze({
        kind: "saved",
        message: "내일까지 미뤘어요.",
        canRetryMutation: false
      });
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(tree.root.findAll((node) => node.props.accessibilityLiveRegion === "polite")).toHaveLength(1);
    expect(tree.root.find((node) => node.props.accessibilityRole === "header").children)
      .toContain("오늘의 가족 준비");
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });
});
