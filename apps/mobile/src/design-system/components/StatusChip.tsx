import { View } from "react-native";
import { KoreanText as Text } from "./KoreanText";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

const tones = {
  neutral: { background: semanticColors.borderSubtle, foreground: semanticColors.textSecondary },
  action: { background: semanticColors.actionSecondary, foreground: semanticColors.actionPrimary },
  success: { background: semanticColors.successSurface, foreground: semanticColors.success },
  warning: { background: semanticColors.warningSurface, foreground: semanticColors.warning },
  danger: { background: semanticColors.dangerSurface, foreground: semanticColors.danger }
} as const;

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: keyof typeof tones }) {
  const colors = tones[tone];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs }}>
      <Text style={{ color: colors.foreground, ...typography.caption, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
