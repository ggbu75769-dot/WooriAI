import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE } from "../../offline/messages";
import { KoreanText as Text } from "../components/KoreanText";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

/**
 * DSN-053 P1 이식 메모: c20deeb에서는 이 타입이 `src/offline/sync-display-state.ts`에 있었고
 * 현재 트리에는 그 모듈이 없다. 이식은 원본 로직을 그대로 옮기는 것이 목적이므로, 없는 모듈을
 * 새로 만들지 않고 `SyncStatusBar`가 실제로 분기하는 상태만 여기서 선언한다 -- 동기화
 * 상태를 **계산**하는 쪽(src/offline/*)이 이 이름들을 다시 갖게 되면 그때 그쪽을 단일 소스로
 * 삼고 이 선언을 지운다(P2 이후).
 *
 * 라운드 61 M-1: `"unknown"`이 여섯 번째로 붙었다. 나머지 다섯이 전부 **관측한 사실**을 말하는
 * 데 비해 이것은 "말할 수 있는 것이 없다"는 상태다 -- 저장소를 열지 못해 대기 건수 자체를 읽지
 * 못했을 때다(src/home/home-sync-status.ts). 빈 스냅샷의 0건을 `"synced"`로 읽어 "모든 기록이
 * 동기화됐어요"라고 말하던 자리를 대신한다.
 */
export type AppSyncStatus = "synced" | "syncing" | "offline" | "pending" | "conflict" | "unknown";

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
  conflict: { label: "확인이 필요한 동기화 충돌이 있어요.", icon: "alert-circle-outline", tone: "danger" },
  /**
   * 라운드 61 M-1 — 저장소를 열지 못해 **셀 수가 없는** 상태. 문구는 새로 짓지 않고
   * `OFFLINE_STORAGE_UNAVAILABLE_NOTICE`(offline/messages.ts)의 가운데 문장을 그대로 쓴다:
   * 이 줄을 눌러 들어가는 동기화 상태 화면이 같은 상황에서 그 긴 문장을 띄우므로, 두 화면이
   * 같은 단어로 같은 상태를 말한다.
   *
   * 톤은 `offline` 선례를 따라 경고다(danger가 아니다) — 무엇이 잘못됐다는 단정이 아니라
   * "지금은 알 수 없다"는 상태이고, 사용자가 당장 고칠 것도 없다.
   */
  unknown: { label: OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE, icon: "cloud-question", tone: "warning" }
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
