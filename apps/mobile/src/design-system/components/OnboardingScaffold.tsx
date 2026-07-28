import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";
import { breakpoints, horizontalPaddingForWidth } from "../tokens/breakpoint";
import { semanticColors } from "../tokens/color";
import { spacing } from "../tokens/spacing";

export function OnboardingScaffold({
  children,
  footer,
  scrollMode = "scaffold",
  testID
}: PropsWithChildren<{ footer: ReactNode; scrollMode?: "scaffold" | "content"; testID?: string }>) {
  const { width } = useWindowDimensions();
  const horizontalPadding = horizontalPaddingForWidth(width);

  return (
    <SafeAreaView style={{ backgroundColor: semanticColors.background, flex: 1 }} testID={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {scrollMode === "scaffold" ? <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          testID={testID ? `${testID}-scroll` : undefined}
        >
          <View
            style={{
              alignSelf: "center",
              flex: 1,
              gap: spacing.xl,
              maxWidth: breakpoints.contentMax,
              paddingBottom: spacing.xl,
              paddingHorizontal: horizontalPadding,
              paddingTop: spacing.md,
              width: "100%"
            }}
          >
            {children}
          </View>
        </ScrollView> : (
          <View
            style={{
              alignSelf: "center",
              flex: 1,
              maxWidth: breakpoints.contentMax,
              paddingHorizontal: horizontalPadding,
              paddingTop: spacing.md,
              width: "100%"
            }}
            testID={testID ? `${testID}-content` : undefined}
          >
            {children}
          </View>
        )}
        <View
          style={{
            backgroundColor: semanticColors.surface,
            borderTopColor: semanticColors.borderSubtle,
            borderTopWidth: 1
          }}
          testID={testID ? `${testID}-footer` : undefined}
        >
          <View
            style={{
              alignSelf: "center",
              maxWidth: breakpoints.contentMax,
              paddingHorizontal: horizontalPadding,
              paddingVertical: spacing.sm,
              width: "100%"
            }}
          >
            {footer}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
