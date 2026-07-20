import type { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";
import { breakpoints, horizontalPaddingForWidth } from "../tokens/breakpoint";
import { semanticColors } from "../tokens/color";
import { spacing } from "../tokens/spacing";

export function ScreenScaffold({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  const { width } = useWindowDimensions();
  const horizontalPadding = horizontalPaddingForWidth(width);

  return (
    <SafeAreaView style={{ backgroundColor: semanticColors.background, flex: 1 }} testID={testID}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignSelf: "center",
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
      </ScrollView>
    </SafeAreaView>
  );
}
