import type { PropsWithChildren, Ref } from "react";
import { SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";
import { breakpoints, horizontalPaddingForWidth } from "../tokens/breakpoint";
import { semanticColors } from "../tokens/color";
import { spacing } from "../tokens/spacing";

export function ScreenScaffold({
  children,
  scrollRef,
  scrollable = true,
  testID
}: PropsWithChildren<{ scrollRef?: Ref<ScrollView>; scrollable?: boolean; testID?: string }>) {
  const { width } = useWindowDimensions();
  const horizontalPadding = horizontalPaddingForWidth(width);

  const content = (
    <View
      style={{
        alignSelf: "center",
        flex: scrollable ? undefined : 1,
        gap: spacing.xl,
        maxWidth: breakpoints.contentMax,
        paddingBottom: spacing.xxl,
        paddingHorizontal: horizontalPadding,
        paddingTop: spacing.md,
        width: "100%"
      }}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: semanticColors.background, flex: 1 }} testID={testID}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}
