import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
// 라운드 101 트랙 C: 확인 시각 보조 문구의 단일 소스(판정·시간 표현은 그 모듈이 정한다 —
// relative-time 재사용). 이 import는 사이클을 만들지 않는다: home-sync-status가 이 파일에서
// 가져가는 것은 타입(AppSyncStatus)뿐이라 런타임 방향은 이쪽 하나다.
import { formatSyncCheckedPhrase } from "../../home/home-sync-status";
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

/**
 * T1(디자인 시스템) — **어휘 단일화**: 이 줄들이 서는 자리는 홈 하단의 동기화 줄이고, 그 화면의
 * 주어는 언제나 "기록"이다(핵심 루프 1단계 — synced의 "모든 기록이"가 이미 그 어휘였다).
 * syncing/pending만 "변경 (내용)"이라는 이 파일만의 낱말을 쓰고 있어 같은 줄이 상태에 따라
 * 주어를 바꿔 말했다. 문장 구조·해요체·아이콘·톤은 그대로 두고 낱말만 기록으로 맞춘다
 * (design-system-restore.test.ts의 해요체 계약을 같은 커밋에서 함께 갱신).
 */
const syncPresentation: Record<AppSyncStatus, { label: string; icon: IconName; tone: "neutral" | "warning" | "danger" }> = {
  synced: { label: "모든 기록이 동기화됐어요.", icon: "cloud-check-outline", tone: "neutral" },
  syncing: { label: "기록을 동기화하고 있어요.", icon: "cloud-sync-outline", tone: "neutral" },
  offline: { label: "오프라인 · 연결되면 자동으로 동기화해요.", icon: "cloud-off-outline", tone: "warning" },
  pending: { label: "서버 반영을 기다리는 기록이 있어요.", icon: "clock-outline", tone: "warning" },
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

export function SyncStatusBar({
  status,
  label,
  onPress,
  lastCheckedAt
}: {
  status: AppSyncStatus;
  label?: string;
  onPress?: () => void;
  /** 라운드 101 트랙 C: 스냅숏의 `lastFlushSucceededAt`(ms epoch). 없으면 종전 표시 그대로다. */
  lastCheckedAt?: number | null;
}) {
  const presentation = syncPresentation[status];
  /**
   * 라운드 101 트랙 C — 보조 문구는 **synced에만** 붙는다("모든 기록이 동기화됐어요 · 방금
   * 확인했어요"). 다른 상태의 줄은 지금 남아 있는 일(대기·전송 중·충돌)을 말하는 중이라 옛
   * 확인 시각이 옆에 서면 두 문장이 서로를 흐린다. 시각이 null이거나(아직 전량 확정 flush가
   * 없는 콜드 세션) 이 prop을 모르는 호출부에서는 종전 라벨 그대로다 — formatSyncCheckedPhrase
   * 가 null을 돌려준다. 렌더에서 Date.now()를 직접 읽는 것은 기기 목록의 "마지막 사용" 표기와
   * 같은 관례다(app/settings/notifications.tsx) — 이 줄은 스냅숏 갱신·리렌더마다 다시 계산되고,
   * 분 단위 표현에는 그 정밀도로 충분하다.
   */
  const checkedPhrase = status === "synced" ? formatSyncCheckedPhrase(lastCheckedAt ?? null, Date.now()) : null;
  const visibleLabel = label ?? (checkedPhrase ? `${presentation.label} · ${checkedPhrase}` : presentation.label);
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
