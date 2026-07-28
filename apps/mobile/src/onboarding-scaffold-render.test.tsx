import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

const dimensions = vi.hoisted(() => ({ width: 320, height: 800, fontScale: 1.5 }));

vi.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" },
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  View: "View",
  useWindowDimensions: () => dimensions
}));

import { OnboardingScaffold } from "./design-system/components/OnboardingScaffold";
import { View } from "react-native";

const viewportPairs = [
  [320, 1],
  [320, 1.5],
  [360, 1.3],
  [412, 1.5],
  [600, 1.5],
  [840, 1.3]
] as const;

describe("OnboardingScaffold responsive action contract", () => {
  it.each(viewportPairs)("keeps the action footer outside scrolling content at %sdp / %sx", (width, fontScale) => {
    dimensions.width = width;
    dimensions.fontScale = fontScale;
    const tree = renderer.create(
      <OnboardingScaffold footer={<View testID="primary-action">긴 다음 단계 계속하기</View>} testID="onboarding">
        <View>긴 한국어 질문과 입력 내용</View>
      </OnboardingScaffold>
    );

    const keyboardAvoider = tree.root.find((node) => String(node.type) === "KeyboardAvoidingView");
    expect(keyboardAvoider.props).toMatchObject({ behavior: "height", keyboardVerticalOffset: 0 });
    expect(tree.root.findByProps({ testID: "onboarding-scroll" }).type).toBe("ScrollView");
    expect(tree.root.findByProps({ testID: "onboarding-footer" }).type).toBe("View");
    expect(tree.root.findByProps({ testID: "primary-action" }).children.join("")).toContain("긴 다음 단계 계속하기");
  });
});
