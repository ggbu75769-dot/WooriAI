import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
  DateTimePickerAndroid: { open: vi.fn() }
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  Modal: "Modal",
  Platform: { OS: "ios" },
  Pressable: "Pressable",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  findNodeHandle: () => 1
}));

import { DateField } from "./design-system/components/OnboardingControls";

describe("iOS onboarding date field", () => {
  it("keeps one spinner sheet and commits only after explicit confirmation", () => {
    const onChange = vi.fn();
    const tree = renderer.create(<DateField label="생일" onChange={onChange} value="2025-05-01" />);
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "생일, 2025-05-01" }).props.onPress());
    expect(tree.root.findAll((node) => String(node.type) === "Modal")).toHaveLength(1);
    const picker = tree.root.find((node) => String(node.type) === "DateTimePicker");
    expect(picker.props.display).toBe("spinner");
    renderer.act(() => picker.props.onChange({ type: "set" }, new Date(2024, 1, 29, 12)));
    expect(onChange).not.toHaveBeenCalled();
    renderer.act(() => tree.root.findByProps({ accessibilityLabel: "선택 완료" }).props.onPress());
    expect(onChange).toHaveBeenCalledWith("2024-02-29");
  });
});
