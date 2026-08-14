import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { KoreanText as Text } from "../components/KoreanText";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";
import type { AppSyncStatus } from "../../offline/sync-display-state";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type StateViewProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon: IconName;
  tone?: "neutral" | "danger" | "warning";
  testID?: string;
};

function StateView({ title, description, actionLabel, onAction, icon, tone = "neutral", testID }: StateViewProps) {
  const iconColor = tone === "danger" ? semanticColors.danger : tone === "warning" ? semanticColors.warning : semanticColors.info;
  const surface = tone === "danger" ? semanticColors.dangerSurface : tone === "warning" ? semanticColors.warningSurface : semanticColors.surface;
  return (
    <View accessibilityRole="summary" style={{ alignItems: "center", backgroundColor: surface, borderColor: semanticColors.borderSubtle, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.xl }} testID={testID}>
      <MaterialCommunityIcons accessibilityElementsHidden color={iconColor} importantForAccessibility="no-hide-descendants" name={icon} size={32} />
      <Text style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: "800", textAlign: "center" }}>{title}</Text>
      {description ? <Text style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, textAlign: "center" }}>{description}</Text> : null}
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => ({ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: radius.large, justifyContent: "center", minHeight: 48, minWidth: 48, opacity: pressed ? 0.84 : 1, paddingHorizontal: spacing.lg })}>
          <Text style={{ color: semanticColors.textInverse, fontSize: typography.body.fontSize, fontWeight: "800" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState({ title = "불러오고 있어요.", description }: { title?: string; description?: string }) {
  return (
    <View
      accessibilityLabel={[title, description].filter(Boolean).join(". ")}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={{ alignItems: "center", backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.xl }}
    >
      <View style={{ alignItems: "center", backgroundColor: semanticColors.actionSecondary, borderRadius: radius.pill, height: 52, justifyContent: "center", width: 52 }}>
        <ActivityIndicator accessibilityElementsHidden color={semanticColors.actionPrimary} importantForAccessibility="no-hide-descendants" size="small" />
      </View>
      <Text style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: "800", textAlign: "center" }}>{title}</Text>
      {description ? <Text style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, textAlign: "center" }}>{description}</Text> : null}
    </View>
  );
}

export function EmptyState(props: Omit<StateViewProps, "icon"> & { icon?: IconName }) {
  return <StateView {...props} icon={props.icon ?? "inbox-outline"} />;
}

export function ErrorState(props: Omit<StateViewProps, "icon" | "tone">) {
  return <StateView {...props} icon="alert-circle-outline" tone="danger" />;
}

export function OfflineState(props: Omit<StateViewProps, "icon" | "tone">) {
  return <StateView {...props} icon="cloud-off-outline" tone="warning" />;
}

const syncPresentation: Record<AppSyncStatus, { label: string; icon: IconName; tone: "neutral" | "warning" | "danger" }> = {
  synced: { label: "모든 기록이 동기화됐어요.", icon: "cloud-check-outline", tone: "neutral" },
  syncing: { label: "변경 내용을 동기화하고 있어요.", icon: "cloud-sync-outline", tone: "neutral" },
  offline: { label: "오프라인 · 연결되면 자동으로 동기화해요.", icon: "cloud-off-outline", tone: "warning" },
  pending: { label: "서버 반영을 기다리는 변경이 있어요.", icon: "clock-outline", tone: "warning" },
  conflict: { label: "확인이 필요한 동기화 충돌이 있어요.", icon: "alert-circle-outline", tone: "danger" }
};

export function SyncStatusBar({ status, label, onPress }: { status: AppSyncStatus; label?: string; onPress?: () => void }) {
  const presentation = syncPresentation[status];
  const visibleLabel = label ?? presentation.label;
  const warning = presentation.tone === "warning";
  const danger = presentation.tone === "danger";
  return (
    <Pressable accessibilityLabel={visibleLabel} accessibilityRole={onPress ? "button" : "text"} accessibilityState={{ busy: status === "syncing" }} disabled={!onPress} onPress={onPress} style={{ alignItems: "center", backgroundColor: danger ? semanticColors.dangerSurface : warning ? semanticColors.warningSurface : semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: radius.large, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md }}>
      <MaterialCommunityIcons color={danger ? semanticColors.danger : warning ? semanticColors.warning : status === "synced" ? semanticColors.success : semanticColors.info} name={presentation.icon} size={20} />
      <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: typography.body.fontSize, fontWeight: "700" }}>{visibleLabel}</Text>
      {onPress ? <MaterialCommunityIcons color={semanticColors.textSecondary} name="chevron-right" size={20} /> : null}
    </Pressable>
  );
}
