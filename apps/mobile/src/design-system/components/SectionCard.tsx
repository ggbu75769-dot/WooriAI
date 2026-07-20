import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { semanticColors } from "../tokens/color";
import { elevation } from "../tokens/elevation";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";

export function SectionCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md, ...elevation.card }, style]}>
      {children}
    </View>
  );
}

