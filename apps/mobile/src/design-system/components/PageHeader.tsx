import type { ReactNode } from "react";
import { View } from "react-native";
import { KoreanText as Text } from "./KoreanText";
import { semanticColors } from "../tokens/color";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, ...typography.heading1 }}>{title}</Text>
        {subtitle ? <Text style={{ color: semanticColors.textSecondary, ...typography.body }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

