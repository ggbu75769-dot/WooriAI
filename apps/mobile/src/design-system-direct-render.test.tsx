import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
const dateTimePickerAndroidOpen = vi.hoisted(() => vi.fn());
const keyboardDismiss = vi.hoisted(() => vi.fn());
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
  DateTimePickerAndroid: { open: dateTimePickerAndroidOpen }
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  Keyboard: { dismiss: keyboardDismiss },
  Modal: "Modal",
  Platform: { OS: "android" },
  Pressable: "Pressable",
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  findNodeHandle: () => 1,
  useWindowDimensions: () => ({ width: 320, height: 800, fontScale: 1.5 })
}));

import { PrimaryButton } from "./design-system/components/ApplicationPrimitives";
import { ItemStatusControl, PreparationItemCard, modV1ItemStatuses } from "./design-system/components/ModV1Primitives";
import { CheckboxRow, ConfirmSheet, DateField, RadioCard, StepProgress } from "./design-system/components/OnboardingControls";
import { AccessibilityInfo, type View as NativeView } from "react-native";

function flattenStyle(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (Array.isArray(value)) return value.reduce((result, entry) => ({ ...result, ...flattenStyle(entry) }), {});
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

describe("Design System v2 direct component outcomes", () => {
  it("keeps a long Korean primary action at least 48dp with busy and disabled semantics", () => {
    const label = "이대로 가족 준비를 시작하고 선택한 항목을 안전하게 저장하기";
    const tree = renderer.create(<PrimaryButton busy label={label} />);
    const button = tree.root.find((node) => String(node.type) === "Pressable");
    expect(button.props.accessibilityLabel).toBe(label);
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(flattenStyle(button.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
    expect(tree.root.find((node) => String(node.type) === "Text").children.join("")).toBe(label);
  });

  it("exposes selected radio and checkbox results without relying on color alone", () => {
    const radio = renderer.create(<RadioCard description="예정일을 기준으로 준비해요" icon="calendar" onPress={() => undefined} selected title="임신 중이에요" />);
    const radioButton = radio.root.find((node) => String(node.type) === "Pressable");
    expect(radioButton.props.accessibilityRole).toBe("radio");
    expect(radioButton.props.accessibilityState).toEqual({ checked: true, selected: true });
    expect(JSON.stringify(radio.toJSON())).toContain("check-circle");
    expect(JSON.stringify(radio.toJSON())).toContain("선택됨");

    const checkbox = renderer.create(<CheckboxRow checked icon="package-variant" onPress={() => undefined} title="기저귀" />);
    const checkboxButton = checkbox.root.find((node) => String(node.type) === "Pressable");
    expect(checkboxButton.props).toMatchObject({ accessibilityRole: "checkbox", accessibilityState: { checked: true } });
    expect(flattenStyle(checkboxButton.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
    expect(JSON.stringify(checkbox.toJSON())).toContain("선택됨");
  });

  it("shows the current onboarding position as labeled segments", () => {
    const tree = renderer.create(<StepProgress current={2} label="아이 정보" total={6} />);
    const progress = tree.root.findByProps({ accessibilityRole: "progressbar" });
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 6, now: 2, text: "2/6" });
    expect(tree.root.findAll((node) => String(node.props.testID ?? "").startsWith("onboarding-progress-segment-"))).toHaveLength(6);
    expect(tree.root.findAll((node) => String(node.type) === "Text").some((node) => node.children.join("") === "2 / 6")).toBe(true);
  });

  it("opens exactly one Android native picker without rendering a second interactive modal", () => {
    const tree = renderer.create(<DateField error="미래 생일은 선택할 수 없어요" label="생일" onChange={() => undefined} value="2025-05-01" />);
    const buttons = tree.root.findAll((node) => String(node.type) === "Pressable");
    expect(buttons[0]!.props).toMatchObject({
      accessibilityLabel: "생일, 2025-05-01",
      accessibilityRole: "button"
    });
    expect(buttons[0]!.props.accessibilityHint).toContain("미래 생일은 선택할 수 없어요");
    renderer.act(() => buttons[0]!.props.onPress());
    expect(keyboardDismiss).toHaveBeenCalledTimes(1);
    expect(dateTimePickerAndroidOpen).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(0);
    expect(buttons.some((button) => button.props.accessibilityLabel === "생일 삭제")).toBe(true);
  });

  it("commits only Android set events and preserves the value on cancel", () => {
    const onChange = vi.fn();
    const tree = renderer.create(<DateField label="생일" onChange={onChange} value="2025-05-01" />);

    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "생일, 2025-05-01" }).props.onPress());
    const options = dateTimePickerAndroidOpen.mock.calls.at(-1)?.[0];
    renderer.act(() => options.onChange({ type: "dismissed" }, undefined));
    renderer.act(() => options.onChange({ type: "neutralButtonPressed" }, undefined));
    expect(onChange).not.toHaveBeenCalled();
    renderer.act(() => options.onChange({ type: "set" }, new Date(2025, 5, 2, 12)));
    expect(onChange).toHaveBeenCalledWith("2025-06-02");
  });

  it("restores screen-reader focus after a confirmation sheet closes", () => {
    const returnFocusRef = { current: {} as NativeView } as React.RefObject<NativeView>;
    const tree = renderer.create(
      <ConfirmSheet
        description="삭제되는 정보를 확인해 주세요."
        onCancel={() => undefined}
        onConfirm={() => undefined}
        returnFocusRef={returnFocusRef}
        title="시작 선택을 변경할까요?"
        visible
      />
    );
    tree.root.find((node) => String(node.type) === "Modal").props.onDismiss();
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });

  it("renders all eight preparation states as labelled 48dp radio controls", () => {
    const onChange = vi.fn();
    const tree = renderer.create(<ItemStatusControl onChange={onChange} value="owned" />);
    const controls = tree.root.findAll((node) => String(node.type) === "Pressable");
    expect(modV1ItemStatuses.map((entry) => entry.value)).toEqual([
      "researching", "planned", "ordered", "owned", "rented", "gifted", "replacement_needed", "retired"
    ]);
    expect(new Set(modV1ItemStatuses.map((entry) => entry.label)).size).toBe(8);
    expect(new Set(modV1ItemStatuses.map((entry) => entry.icon)).size).toBe(8);
    expect(controls).toHaveLength(8);
    for (const control of controls) {
      expect(control.props.accessibilityRole).toBe("radio");
      expect(flattenStyle(control.props.style({ pressed: false }))).toMatchObject({ flex: 1, height: 48 });
    }
    expect(controls[3]!.props.accessibilityState.checked).toBe(true);
    renderer.act(() => controls[4]!.props.onPress());
    expect(onChange).toHaveBeenCalledWith("rented");
  });

  it("announces preparation item state in text instead of color alone", () => {
    const tree = renderer.create(<PreparationItemCard onPress={() => undefined} status="replacement_needed" title="카시트" />);
    const card = tree.root.find((node) => String(node.type) === "Pressable");
    expect(card.props.accessibilityLabel).toContain("상태 교체");
    expect(flattenStyle(card.props.style({ pressed: false })).height).toBe(148);
    expect(JSON.stringify(tree.toJSON())).toContain("교체");
  });
});
