import { MaterialCommunityIcons } from "@expo/vector-icons";
import type React from "react";
import type { ComponentProps, PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "../patterns/AsyncState";
import { semanticColors } from "../tokens/color";
import { elevation } from "../tokens/elevation";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";
import { isPixelLockBuild } from "../../pixelLock/build-profile";
import { ScreenScaffold } from "./ScreenScaffold";

export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function AppIcon({ name, size = 24, color = semanticColors.textPrimary }: { name: AppIconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons accessibilityElementsHidden color={color} importantForAccessibility="no-hide-descendants" name={name} size={size} />;
}

export function AppScreen({ children }: PropsWithChildren) {
  if (!isPixelLockBuild()) return <ScreenScaffold>{children}</ScreenScaffold>;
  return (
    <ScrollView
      contentContainerStyle={{ backgroundColor: semanticColors.background, flexGrow: 1, gap: spacing.lg, padding: spacing.xl }}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: semanticColors.background, flex: 1 }}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        {eyebrow ? <Text style={{ color: semanticColors.brandPrimary, ...typography.caption }}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, ...typography.heading1 }}>{title}</Text>
        {subtitle ? <Text style={{ color: semanticColors.textSecondary, ...typography.body }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md, ...elevation.card }, style]}>{children}</View>;
}

type ButtonProps = { label: string; onPress?: () => void; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle> };

function ActionButton({ label, onPress, disabled, busy, style, primary }: ButtonProps & { primary: boolean }) {
  const unavailable = Boolean(disabled || busy);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(busy), disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [{ alignItems: "center", backgroundColor: primary ? unavailable ? semanticColors.actionDisabled : semanticColors.actionPrimary : semanticColors.surface, borderColor: primary ? semanticColors.actionPrimary : semanticColors.border, borderRadius: radius.large, borderWidth: primary ? 0 : 1, justifyContent: "center", minHeight: 52, opacity: pressed ? 0.82 : 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, style]}
    >
      <Text style={{ color: primary ? semanticColors.textInverse : semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: "800", lineHeight: typography.body.lineHeight, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton(props: ButtonProps) { return <ActionButton {...props} primary />; }
export function SecondaryButton(props: ButtonProps) { return <ActionButton {...props} primary={false} />; }

export function TextButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={[{ justifyContent: "center", minHeight: 48 }, style]}>
      <Text style={{ color: disabled ? semanticColors.textDisabled : semanticColors.brandPrimary, fontSize: typography.body.fontSize, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ accessibilityLabel, icon, onPress, selected = false }: { accessibilityLabel: string; icon: AppIconName; onPress?: () => void; selected?: boolean }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: selected ? semanticColors.actionSecondary : "transparent", borderRadius: radius.large, height: 48, justifyContent: "center", opacity: pressed ? 0.72 : 1, width: 48 })}>
      <AppIcon color={selected ? semanticColors.brandPrimary : semanticColors.textPrimary} name={icon} />
    </Pressable>
  );
}

export function CategoryChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }} hitSlop={6} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: selected ? semanticColors.actionPrimary : semanticColors.surface, borderColor: selected ? semanticColors.actionPrimary : semanticColors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 36, opacity: pressed ? 0.82 : 1, paddingHorizontal: spacing.md })}>
      <Text style={{ color: selected ? semanticColors.textInverse : semanticColors.textPrimary, fontSize: typography.caption.fontSize, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "brand" | "info" | "success" | "warning" | "review" }) {
  const backgroundColor = tone === "brand" ? semanticColors.actionSecondary : tone === "info" ? semanticColors.infoSurface : tone === "success" ? semanticColors.successSurface : tone === "warning" ? semanticColors.warningSurface : tone === "review" ? semanticColors.reviewSurface : semanticColors.surfaceMuted;
  const color = tone === "brand" ? semanticColors.brandPrimary : tone === "info" ? semanticColors.info : tone === "success" ? semanticColors.success : tone === "warning" ? semanticColors.warning : tone === "review" ? semanticColors.review : semanticColors.textSecondary;
  return <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}><Text style={{ color, fontSize: typography.caption.fontSize, fontWeight: "800" }}>{label}</Text></View>;
}

export function ListRow({ icon, iconBackgroundColor, title, subtitle, value, onPress }: { icon?: React.ReactNode; iconBackgroundColor?: string; title: string; subtitle?: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : "text"} disabled={!onPress} onPress={onPress}>
      <Card style={{ alignItems: "center", flexDirection: "row", minHeight: 64 }}>
        {icon ? (
          <View style={{ alignItems: "center", backgroundColor: iconBackgroundColor ?? semanticColors.actionSecondary, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 }}>
            {icon}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: "800" }}>{title}</Text>
          {subtitle ? <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={{ color: semanticColors.textPrimary, fontWeight: "800" }}>{value}</Text> : null}
      </Card>
    </Pressable>
  );
}

export function EmptyStateCard({ title, description, actionLabel, onPress }: { title: string; description?: string; actionLabel: string; onPress?: () => void }) {
  if (/불러오고|분석 중|저장하는 중/.test(title)) return <LoadingState title={title} />;
  if (/못했|실패|오류/.test(title)) return <ErrorState actionLabel={onPress ? actionLabel : undefined} onAction={onPress} title={title} />;
  return <EmptyState actionLabel={onPress ? actionLabel : undefined} description={description} onAction={onPress} title={title} />;
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const error = tone === "error";
  return <View accessibilityLiveRegion="polite" style={{ alignItems: "center", backgroundColor: error ? semanticColors.dangerSurface : semanticColors.successSurface, borderRadius: radius.large, flexDirection: "row", gap: spacing.sm, minHeight: 48, padding: spacing.md }}><AppIcon color={error ? semanticColors.danger : semanticColors.success} name={error ? "alert-circle-outline" : "check-circle-outline"} size={20} /><Text style={{ color: semanticColors.textPrimary, flex: 1, ...typography.body }}>{message}</Text></View>;
}

export function SampleDataBanner() {
  return <View accessibilityLabel="샘플 데이터 안내" style={{ alignItems: "center", backgroundColor: semanticColors.infoSurface, borderRadius: radius.large, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md }}><AppIcon color={semanticColors.info} name="flask-outline" size={20} /><Text style={{ color: semanticColors.textPrimary, flex: 1, ...typography.caption }}>샘플 데이터 · 실제 계정 정보와 분리되어 이 기기에만 저장돼요.</Text></View>;
}

export function AffiliateDisclosure({ text }: { text?: string }) {
  return <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{text ?? "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."}</Text>;
}
