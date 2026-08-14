import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { KoreanText as Text } from "./KoreanText";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

export function NoticeCard({ title, children, tone = "info" }: PropsWithChildren<{ title: string; tone?: "info" | "warning" | "danger" }>) {
  const foreground = tone === "warning" ? semanticColors.warning : tone === "danger" ? semanticColors.danger : semanticColors.info;
  const background = tone === "warning" ? "#FFF3E8" : tone === "danger" ? "#FDECEC" : "#EDF5FF";
  return (
    <View style={{ backgroundColor: background, borderRadius: radius.large, gap: spacing.xs, padding: spacing.md }}>
      <Text style={{ color: foreground, ...typography.heading3 }}>{title}</Text>
      {typeof children === "string" ? <Text style={{ color: semanticColors.textSecondary, ...typography.body }}>{children}</Text> : children}
    </View>
  );
}

