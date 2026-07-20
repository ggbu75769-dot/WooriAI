import { MaterialCommunityIcons } from "@expo/vector-icons";
import type React from "react";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function DecorativeIcon({ color, name, size = 24 }: { color: string; name: IconName; size?: number }) {
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
    />
  );
}

export function AppHeader({
  title,
  subtitle,
  onNotificationPress,
  trailing
}: {
  title: string;
  subtitle?: string;
  onNotificationPress?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, fontSize: typography.heading2.fontSize, fontWeight: "800", lineHeight: typography.heading2.lineHeight }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight }}>{subtitle}</Text> : null}
      </View>
      {onNotificationPress ? (
        <Pressable
          accessibilityLabel="알림"
          accessibilityRole="button"
          onPress={onNotificationPress}
          style={({ pressed }) => ({ alignItems: "center", borderRadius: radius.large, height: 48, justifyContent: "center", opacity: pressed ? 0.72 : 1, width: 48 })}
        >
          <DecorativeIcon color={semanticColors.textPrimary} name="bell-outline" />
        </Pressable>
      ) : null}
      {trailing}
    </View>
  );
}

export function SelectionCard({
  title,
  description,
  icon,
  selected,
  onPress
}: {
  title: string;
  description?: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? semanticColors.actionSecondary : semanticColors.surface,
        borderColor: selected ? semanticColors.brandPrimary : semanticColors.border,
        borderRadius: radius.card,
        borderWidth: selected ? 2 : 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 64,
        opacity: pressed ? 0.82 : 1,
        padding: spacing.md
      })}
    >
      <DecorativeIcon color={selected ? semanticColors.brandPrimary : semanticColors.textSecondary} name={icon} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: typography.title.fontSize, fontWeight: "800" }}>{title}</Text>
        {description ? <Text style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight }}>{description}</Text> : null}
      </View>
      <DecorativeIcon color={selected ? semanticColors.brandPrimary : semanticColors.borderStrong} name={selected ? "check-circle" : "circle-outline"} />
    </Pressable>
  );
}

export function SummaryCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg }}>
      {title ? <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, fontSize: typography.title.fontSize, fontWeight: "800" }}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function OfflineBanner({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      style={{ alignItems: "center", backgroundColor: semanticColors.warningSurface, borderRadius: radius.large, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md }}
    >
      <DecorativeIcon color={semanticColors.warning} name="cloud-off-outline" size={20} />
      <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: typography.body.fontSize, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: 48 }}>
      <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, flex: 1, fontSize: typography.title.fontSize, fontWeight: "800" }}>{title}</Text>
      {action}
    </View>
  );
}

export function AmountDisplay({ label, value, large = false }: { label?: string; value: string; large?: boolean }) {
  return (
    <View accessibilityLabel={label ? `${label} ${value}` : value} style={{ gap: spacing.xs }}>
      {label ? <Text style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize }}>{label}</Text> : null}
      <Text style={{ color: semanticColors.textPrimary, fontSize: large ? typography.amountLarge.fontSize : typography.amountRegular.fontSize, fontVariant: ["tabular-nums"], fontWeight: large ? "900" : "800", lineHeight: large ? typography.amountLarge.lineHeight : typography.amountRegular.lineHeight }}>
        {value}
      </Text>
    </View>
  );
}

export function ChildSwitcher({ name, stage, onPress }: { name: string; stage?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={`${name}${stage ? `, ${stage}` : ""}. 아이 전환`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 48, opacity: pressed ? 0.72 : 1 })}>
      <Text numberOfLines={1} style={{ color: semanticColors.textPrimary, fontSize: typography.heading3.fontSize, fontWeight: "700" }}>{name}</Text>
      {stage ? (
        <View style={{ backgroundColor: semanticColors.actionSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 }}>
          <Text numberOfLines={1} style={{ color: semanticColors.brandPrimary, fontSize: typography.caption.fontSize, fontWeight: "700" }}>{stage}</Text>
        </View>
      ) : null}
      <DecorativeIcon color={semanticColors.textSecondary} name="chevron-down" size={20} />
    </Pressable>
  );
}

export function AppTabBar({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: semanticColors.surface, borderTopColor: semanticColors.border, borderTopWidth: 1, flexDirection: "row", minHeight: 64 }}>
      {children}
    </View>
  );
}
