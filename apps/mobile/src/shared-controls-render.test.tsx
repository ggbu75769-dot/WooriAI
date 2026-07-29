import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons"
}));

vi.mock("react-native", () => ({
  Image: "Image",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View"
}));

vi.mock("./design-system", () => ({
  EmptyState: "EmptyState",
  ErrorState: "ErrorState",
  LoadingState: "LoadingState",
  ScreenScaffold: "ScreenScaffold"
}));

import { CategoryChip, PrimaryButton, SecondaryButton, TextButton } from "./ui";

function flattenStyle(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (Array.isArray(value)) {
    return value.reduce<Record<string, unknown>>(
      (result, entry) => ({ ...result, ...flattenStyle(entry) }),
      {}
    );
  }
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

describe("shared mobile control render contract", () => {
  it("keeps primary actions accessible and expandable for long Korean labels", () => {
    const label = "선택한 준비 항목을 가족 담당자와 예정 비용에 안전하게 반영하기";
    const tree = renderer.create(<PrimaryButton label={label} disabled />);
    const button = tree.root.find((node) => String(node.type) === "Pressable");
    expect(button.props).toMatchObject({
      accessibilityLabel: label,
      accessibilityRole: "button",
      accessibilityState: { disabled: true },
      disabled: true
    });
    const style = flattenStyle(button.props.style({ pressed: false }));
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style).not.toHaveProperty("height");
    expect(tree.root.find((node) => String(node.type) === "Text").children.join("")).toBe(label);
  });

  it("gives secondary, text, and compact chip actions a 48dp interaction contract", () => {
    for (const component of [
      <SecondaryButton key="secondary" label="다시 시도" />,
      <TextButton key="text" label="변경 내용 확인" />
    ]) {
      const tree = renderer.create(component);
      const button = tree.root.find((node) => String(node.type) === "Pressable");
      expect(button.props.accessibilityRole).toBe("button");
      expect(button.props.accessibilityLabel).toBeTruthy();
      const style = typeof button.props.style === "function"
        ? button.props.style({ pressed: false })
        : button.props.style;
      expect(flattenStyle(style).minHeight).toBeGreaterThanOrEqual(48);
    }

    const chip = renderer.create(
      <CategoryChip icon="hospital-box-outline" label="아주 긴 준비 상태 필터" selected />
    );
    const chipButton = chip.root.find((node) => String(node.type) === "Pressable");
    expect(chipButton.props).toMatchObject({
      accessibilityLabel: "아주 긴 준비 상태 필터",
      accessibilityRole: "button",
      accessibilityState: { selected: true },
      hitSlop: 5
    });
    expect(flattenStyle(chipButton.props.style({ pressed: false })).minHeight).toBe(38);
    expect(chip.root.find((node) => String(node.type) === "MaterialCommunityIcons").props).toMatchObject({
      name: "hospital-box-outline",
      size: 17
    });
  });
});
