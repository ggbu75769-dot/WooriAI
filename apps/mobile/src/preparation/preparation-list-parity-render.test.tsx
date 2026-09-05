import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Keyboard: { dismiss: vi.fn() },
  Pressable: "Pressable",
  Text: "Text",
  TextInput: "TextInput",
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

import { nextPreparationGroupLimit, PreparationListParity, type PreparationParityItem } from "./PreparationListParity";
import { Keyboard } from "react-native";

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
    items,
    onBack: vi.fn(),
    onItemPress: vi.fn(),
    onMissingReport: vi.fn(),
    onSearch: vi.fn(),
    onClearSearch: vi.fn(),
    onRetry: vi.fn(),
    selectedContextKey: "child:1",
    selectedContextName: "복덩이"
  };
}

describe("preparation list grouped mobile interaction", () => {
  it("renders only category groups backed by at least five real items on a small phone with large text", () => {
    const items = categories.flatMap(([domain, nameKo], groupIndex) =>
      Array.from({ length: 5 }, (_, itemIndex) => ({
        id: `${groupIndex}-${itemIndex}`,
        code: `R4-${domain}-00${itemIndex + 1}`,
        nameKo: `${nameKo} ${itemIndex + 1}`,
        timelineBucket: "this_week" as const
      }))
    );
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...props(items)} />); });
    const headers = tree.root.findAll((node) =>
      node.props.accessibilityState && "expanded" in node.props.accessibilityState
      && typeof node.props.style === "function"
      && (node.props.style({ pressed: false }).minHeight ?? 0) >= 68
    );
    expect(headers).toHaveLength(10);
    expect(headers.every((header) => header.props.accessibilityRole === "button")).toBe(true);
    expect(headers.every((header) => header.props.style({ pressed: false }).minHeight >= 68)).toBe(true);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === "준비물 통합 검색")).toHaveLength(1);
    expect(tree.root.findAll((node) => node.children.join("") === "7일 안에" || node.children.join("") === "아이·복덩이")).toHaveLength(0);
  });

  it("switches to four collapsible timing groups instead of a flat list", () => {
    const buckets = ["this_week", "this_month", "next_stage", "completed"] as const;
    const items = buckets.flatMap((timelineBucket, bucketIndex) =>
      Array.from({ length: 5 }, (_, itemIndex) => ({
        id: `${bucketIndex}-${itemIndex}`,
        code: `R4-C0${bucketIndex + 1}-00${itemIndex + 1}`,
        nameKo: `준비 품목 ${bucketIndex + 1}-${itemIndex + 1}`,
        timelineBucket
      }))
    );
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...props(items)} />); });
    const timingTab = tree.root.findAll((node) => String(node.type) === "Pressable")
      .find((node) => node.findAll((child) => String(child.type) === "Text" && child.children.join("") === "시기별").length > 0);
    expect(timingTab).toBeDefined();
    renderer.act(() => timingTab!.props.onPress());
    const timingHeaders = tree.root.findAll((node) =>
      node.props.accessibilityState && "expanded" in node.props.accessibilityState
      && typeof node.props.style === "function"
      && (node.props.style({ pressed: false }).minHeight ?? 0) >= 68
    );
    expect(timingHeaders).toHaveLength(4);
    expect(timingHeaders[0]!.props.accessibilityState.expanded).toBe(true);
    renderer.act(() => timingHeaders[1]!.props.onPress());
    expect(tree.root.findAll((node) =>
      node.props.accessibilityState && "expanded" in node.props.accessibilityState
      && typeof node.props.style === "function"
      && (node.props.style({ pressed: false }).minHeight ?? 0) >= 68
    )[1]!.props.accessibilityState.expanded).toBe(true);
  });

  it("hides sparse groups, keeps search results usable, and advances 5 to 10 to 20 to 40 to all", () => {
    const sparseItems = categories.slice(0, 2).flatMap(([domain, nameKo], groupIndex) =>
      Array.from({ length: 4 }, (_, itemIndex) => ({
        id: `${groupIndex}-${itemIndex}`,
        code: `R4-${domain}-00${itemIndex + 1}`,
        nameKo: `${nameKo} ${itemIndex + 1}`,
        timelineBucket: "this_week" as const
      }))
    );
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<PreparationListParity {...props(sparseItems)} activeSearchQuery="검색어" />);
    });
    expect(tree.root.findAll((node) => String(node.type) === "PreparationItemCard")).toHaveLength(8);
    expect(nextPreparationGroupLimit(5, 73)).toBe(10);
    expect(nextPreparationGroupLimit(10, 73)).toBe(20);
    expect(nextPreparationGroupLimit(20, 73)).toBe(40);
    expect(nextPreparationGroupLimit(40, 73)).toBe(73);
  });

  it("counts completed items once and excludes not-needed, retired, and ended states", () => {
    const states = ["owned", "planned", "not_needed", "retired", "ended"] as const;
    const items = states.map((state, index) => ({
      id: String(index),
      code: `R4-C10-00${index + 1}`,
      nameKo: `기저귀 준비 ${index + 1}`,
      timelineBucket: state === "not_needed" ? "not_needed" as const : "this_week" as const,
      plan: { state }
    }));
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...props(items)} />); });
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === "나의 준비 진행률, 2개 중 1개 완료")).toHaveLength(1);
  });

  it("dismisses the keyboard when the user explicitly submits or closes search", () => {
    const handlers = props([]);
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<PreparationListParity {...handlers} activeSearchQuery="기저귀" />); });
    const input = tree.root.find((node) => node.props.accessibilityLabel === "준비물 통합 검색");
    renderer.act(() => input.props.onChangeText("분유"));
    const submit = tree.root.find((node) => node.props.accessibilityLabel === "준비물 검색 실행");
    renderer.act(() => submit.props.onPress());
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(handlers.onSearch).toHaveBeenCalledWith("분유");
    const close = tree.root.find((node) => node.props.accessibilityLabel === "준비물 검색 닫기");
    renderer.act(() => close.props.onPress());
    expect(handlers.onClearSearch).toHaveBeenCalled();
  });
});
