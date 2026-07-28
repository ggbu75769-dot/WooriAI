import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

const dimensions = vi.hoisted(() => ({ width: 320, height: 800, fontScale: 1 }));

vi.mock("react-native", () => ({
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  View: "View",
  useWindowDimensions: () => dimensions
}));

import { ScreenScaffold } from "./design-system/components/ScreenScaffold";

const viewportPairs = [
  [320, 1],
  [320, 1.5],
  [360, 1.3],
  [412, 1.5],
  [600, 1.5],
  [840, 1.3]
] as const;

describe("ScreenScaffold viewport and font contract", () => {
  it.each(viewportPairs)("keeps the core content in one responsive column at %sdp / %sx font scale", (width, fontScale) => {
    dimensions.width = width;
    dimensions.fontScale = fontScale;
    const longKoreanContent = "아주 긴 아이 이름과 가족 이름, 준비 품목명, 999,999,999원 금액도 핵심 행동과 함께 유지됩니다.";
    const tree = renderer.create(
      <ScreenScaffold testID="release4g-scaffold">
        <View>{longKoreanContent}</View>
      </ScreenScaffold>
    );
    const content = tree.root.findAll((node) => String(node.type) === "View").at(-1);
    expect(content?.props.style).toMatchObject({
      alignSelf: "center",
      maxWidth: 720,
      width: "100%"
    });
    expect(JSON.stringify(tree.toJSON())).toContain(longKoreanContent);
    expect(tree.root.find((node) => String(node.type) === "ScrollView").props.showsHorizontalScrollIndicator).toBe(false);
  });
});

function View({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
