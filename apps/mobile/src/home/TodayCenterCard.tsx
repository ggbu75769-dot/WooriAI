import type { TodayActionContract, TodayCenterContract } from "@wooriai/contracts";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View, findNodeHandle } from "react-native";
import {
  AppIcon,
  Card,
  ListRow,
  PrimaryButton,
  Toast
} from "../design-system/components/ApplicationPrimitives";
import { BottomSheet } from "../design-system/components/ModV1Primitives";
import { semanticColors } from "../design-system/tokens/color";
import { spacing } from "../design-system/tokens/spacing";
import type { LocalTodayCenterContract } from "../api/client";
import {
  isTodayActionDismissible,
  todayActionPresentation
} from "./today-center";
import type { TodaySnoozeOutcome } from "./today-center-mutation";

type TodayCenterCardProps = {
  center: TodayCenterContract | LocalTodayCenterContract;
  onNavigate: (action: TodayActionContract) => void;
  onSnooze: (action: TodayActionContract) => Promise<TodaySnoozeOutcome>;
  onRefresh: () => Promise<void>;
};

function outcomeToastTone(outcome: TodaySnoozeOutcome) {
  if (outcome.kind === "rejected") return "error" as const;
  if (outcome.kind === "refresh_required") return "warning" as const;
  return "success" as const;
}

export function TodayCenterCard({
  center,
  onNavigate,
  onSnooze,
  onRefresh
}: TodayCenterCardProps) {
  const [selected, setSelected] = useState<TodayActionContract | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<TodaySnoozeOutcome | null>(null);
  const [notice, setNotice] = useState<TodaySnoozeOutcome | null>(null);
  const headingRef = useRef<Text | null>(null);
  const returnFocusRef = useRef<View | null>(null);
  const managementRefs = useRef(new Map<string, View>());

  const focusStableHeading = () => {
    setTimeout(() => {
      const handle = findNodeHandle(headingRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 0);
  };

  const close = () => {
    if (pending) return false;
    setSelected(null);
    setOutcome(null);
    return true;
  };

  const snooze = async () => {
    if (!selected || pending) return;
    setPending(true);
    setOutcome(null);
    const result = await onSnooze(selected);
    setPending(false);
    setOutcome(result);
    if (["saved", "changed", "current_deferred"].includes(result.kind)) {
      setNotice(result);
      setSelected(null);
      focusStableHeading();
    }
  };

  const refresh = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onRefresh();
      setNotice({ kind: "changed", message: "최신 목록을 불러왔어요.", canRetryMutation: false });
      setSelected(null);
      setOutcome(null);
      focusStableHeading();
    } catch {
      setOutcome({
        kind: "refresh_required",
        message: "목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
        canRetryMutation: false
      });
    } finally {
      setPending(false);
    }
  };

  const selectedCopy = selected ? todayActionPresentation(selected) : null;
  if (center.actions.length === 0 && !notice) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessible accessibilityRole="header" ref={headingRef} style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "800" }}>
        오늘의 가족 준비
      </Text>
      <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>
        지금 처리할 중요한 행동만 최대 3개 보여드려요.
      </Text>
      {center.source === "local_fixture" ? (
        <Text accessibilityLabel="로컬 샘플 Today Center" style={{ color: semanticColors.info, fontSize: 11, fontWeight: "700" }}>
          이 기기의 샘플 알림
        </Text>
      ) : null}
      {notice ? <Toast message={notice.message} tone={outcomeToastTone(notice)} /> : null}
      {center.actions.map((action) => {
        const copy = todayActionPresentation(action);
        const dismissible = isTodayActionDismissible(action);
        return (
          <View key={action.actionKey} style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <ListRow
                icon={<AppIcon color={action.kind === "safety_acknowledgement" ? semanticColors.danger : semanticColors.actionPrimary} name={action.kind === "safety_acknowledgement" ? "shield-alert-outline" : "calendar-check-outline"} size={21} />}
                onPress={() => onNavigate(action)}
                subtitle={copy.subtitle}
                title={copy.title}
              />
            </View>
            {dismissible ? (
              <Pressable
                accessibilityLabel={copy.managementLabel}
                accessibilityRole="button"
                onPress={() => {
                  returnFocusRef.current = managementRefs.current.get(action.actionKey) ?? null;
                  setOutcome(null);
                  setSelected(action);
                }}
                ref={(node) => {
                  if (node) managementRefs.current.set(action.actionKey, node);
                  else managementRefs.current.delete(action.actionKey);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: semanticColors.surface,
                  borderColor: semanticColors.border,
                  borderRadius: 14,
                  borderWidth: 1,
                  height: 48,
                  justifyContent: "center",
                  opacity: pressed ? 0.72 : 1,
                  width: 48
                })}
              >
                <AppIcon color={semanticColors.actionPrimary} name="clock-outline" size={22} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {selected && selectedCopy ? (
        <BottomSheet
          description="이 알림만 다음 서울 날짜까지 미뤄요."
          onClose={close}
          returnFocusRef={returnFocusRef}
          title={selectedCopy.title}
          visible
        >
          {outcome ? <Toast message={outcome.message} tone={outcomeToastTone(outcome)} /> : null}
          {outcome && !outcome.canRetryMutation ? (
            <PrimaryButton busy={pending} label="목록 다시 불러오기" onPress={() => void refresh()} />
          ) : (
            <PrimaryButton
              busy={pending}
              label={pending ? "미루는 중" : outcome?.canRetryMutation ? "다시 미루기" : "내일까지 미루기"}
              onPress={() => void snooze()}
            />
          )}
        </BottomSheet>
      ) : null}
    </Card>
  );
}
