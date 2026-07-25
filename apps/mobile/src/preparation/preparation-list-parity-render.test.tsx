import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  useWindowDimensions: () => ({ width: 320, height: 720, fontScale: 1.5 })
}));

vi.mock("../design-system", () => ({
  AppIcon: "AppIcon",
  BottomSheet: "BottomSheet",
  EmptyStateCard: "EmptyStateCard",
  PreparationItemCard: "PreparationItemCard",
  TopAppBar: "TopAppBar",
  semanticColors: {
    actionPrimary: "#D44727",
    border: "#E8DED8",
    brandSecondary: "#16745F",
    success: "#16794B",
    successSurface: "#E8F7EF",
    surface: "#FFFFFF",
    surfaceMuted: "#F7F4F2",
    textDisabled: "#A89E98",
    textInverse: "#FFFFFF",
    textPrimary: "#211D1A",
    textSecondary: "#665E59",
    warning: "#9A6300"
  },
  spacing: { xs: 8 }
}));

import { PreparationListParity, type PreparationParityItem } from "./PreparationListParity";

const categories = [
  ["C01", "산모 건강 측정기"],
  ["C02", "임부용 레깅스"],
  ["C03", "임산부 바디필로"],
  ["C04", "순한 바디 세정제"],
  ["C05", "출산 입원 가방"],
  ["C07", "수유 쿠션"],
  ["C09", "신생아 침대"],
  ["C10", "신생아 기저귀"],
  ["C17", "신생아 유모차"],
  ["C24", "가족 사진 앨범"]
] as const;

function props(items: PreparationParityItem[]) {
  return {
    contextOptions: [{ key: "child:1", label: "아이·복덩이" }],
    items,
    onBack: vi.fn(),
    onItemPress: vi.fn(),
    onMissingReport: vi.fn(),
    onRetry: vi.fn(),
    onSelectContext: vi.fn(),
    onToggleUrgent: vi.fn(),
    selectedContextKey: "child:1",
    urgentOnly: false
  };
}

describe("preparation list grouped mobile interaction", () => {
  it("renders all ten category accordions on a small phone with large text", () => {
    const items = categories.map(([domain, nameKo], index) => ({
      id: String(index),
      code: `R4-${domain}-001`,
      nameKo,
      timelineBucket: "this_week" as const
    }));
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...props(items)} />); });
    const headers = tree.root.findAll((node) => node.props.accessibilityState && "expanded" in node.props.accessibilityState);
    expect(headers).toHaveLength(10);
    expect(headers.every((header) => header.props.accessibilityRole === "button")).toBe(true);
    expect(headers.every((header) => header.props.style({ pressed: false }).minHeight >= 68)).toBe(true);
  });

  it("switches to four collapsible timing groups instead of a flat list", () => {
    const buckets = ["this_week", "this_month", "next_stage", "completed"] as const;
    const items = buckets.map((timelineBucket, index) => ({
      id: String(index),
      code: `R4-C0${index + 1}-001`,
      nameKo: `준비 품목 ${index + 1}`,
      timelineBucket
    }));
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...props(items)} />); });
    const timingTab = tree.root.findAll((node) => String(node.type) === "Pressable")
      .find((node) => node.findAll((child) => String(child.type) === "Text" && child.children.join("") === "시기별").length > 0);
    expect(timingTab).toBeDefined();
    renderer.act(() => timingTab!.props.onPress());
    const timingHeaders = tree.root.findAll((node) => node.props.accessibilityState && "expanded" in node.props.accessibilityState);
    expect(timingHeaders).toHaveLength(4);
    expect(timingHeaders[0]!.props.accessibilityState.expanded).toBe(true);
    renderer.act(() => timingHeaders[1]!.props.onPress());
    expect(tree.root.findAll((node) => node.props.accessibilityState && "expanded" in node.props.accessibilityState)[1]!.props.accessibilityState.expanded).toBe(true);
  });
});
