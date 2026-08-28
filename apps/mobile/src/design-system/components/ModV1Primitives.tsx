import React, { useRef, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, Text as NativeText, TextInput, View, type TextInputProps } from "react-native";
import { KoreanText as Text } from "./KoreanText";
import { formatKrw } from "../../money";
import { balanceCompactKoreanLabel } from "../compact-korean-label";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";
import { AppIcon, IconButton, type AppIconName } from "./ApplicationPrimitives";

export function MoneyText({ amount, size = "md", tone = "default" }: { amount: number; size?: "md" | "lg" | "xl"; tone?: "default" | "inverse" | "danger" | "success" }) {
  const style = size === "xl" ? typography.amountLarge : size === "lg" ? typography.amountMedium : typography.amountRegular;
  const color = tone === "inverse" ? semanticColors.textInverse : tone === "danger" ? semanticColors.danger : tone === "success" ? semanticColors.success : semanticColors.textPrimary;
  return <Text accessibilityLabel={formatKrw(amount)} style={{ color, ...style }}>{formatKrw(amount)}</Text>;
}

export function BudgetSummary({ usedKrw, budgetKrw, label = "이번 달 지출" }: { usedKrw: number; budgetKrw: number | null; label?: string }) {
  const overBudget = budgetKrw !== null && budgetKrw > 0 && usedKrw > budgetKrw;
  const ratio = budgetKrw && budgetKrw > 0 ? usedKrw / budgetKrw : 0;
  const progress = Math.min(1, Math.max(0, ratio));
  const backgroundColor = overBudget ? semanticColors.danger : semanticColors.actionPrimary;
  const description = budgetKrw && budgetKrw > 0
    ? overBudget
      ? `예산 ${formatKrw(budgetKrw)}을 ${formatKrw(usedKrw - budgetKrw)} 초과했어요.`
      : `예산 ${formatKrw(budgetKrw)}의 ${Math.round(ratio * 100)}%를 사용했어요.`
    : "월 예산을 설정하면 사용률을 함께 보여드려요.";
  return (
    <View
      accessibilityLabel={`${label} ${formatKrw(usedKrw)}. ${description}`}
      accessibilityRole="summary"
      style={{ backgroundColor, borderRadius: radius.card, gap: spacing.sm, padding: spacing.lg }}
    >
      <Text style={{ color: semanticColors.textInverse, ...typography.label }}>{label}</Text>
      <MoneyText amount={usedKrw} size="xl" tone="inverse" />
      <Text style={{ color: semanticColors.textInverse, opacity: 0.9, ...typography.caption }}>{description}</Text>
      {budgetKrw && budgetKrw > 0 ? (
        <View
          accessibilityLabel={`예산 사용률 ${Math.round(ratio * 100)}퍼센트`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(ratio * 100)) }}
          style={{ backgroundColor: "rgba(255,255,255,0.32)", borderRadius: radius.pill, height: 8, overflow: "hidden" }}
        >
          <View style={{ backgroundColor: semanticColors.textInverse, borderRadius: radius.pill, height: 8, width: `${progress * 100}%` }} />
        </View>
      ) : null}
    </View>
  );
}

export function TopAppBar({ title, eyebrow, onBack, trailing }: { title: string; eyebrow?: string; onBack?: () => void; trailing?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 56 }}>
      {onBack ? <IconButton accessibilityLabel="뒤로" icon="chevron-left" onPress={onBack} /> : null}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        {eyebrow ? <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, ...typography.heading3 }}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function CheckCard({ label, description, icon, checked, disabled, busy, onChange }: { label: string; description?: string; icon: AppIconName; checked: boolean; disabled?: boolean; busy?: boolean; onChange: (checked: boolean) => void }) {
  const unavailable = Boolean(disabled || busy);
  return (
    <Pressable
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled: unavailable, busy: Boolean(busy) }}
      disabled={unavailable}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: checked ? semanticColors.actionSecondary : semanticColors.surface, borderColor: checked ? semanticColors.brandPrimary : semanticColors.border, borderRadius: radius.large, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 56, opacity: unavailable ? 0.56 : pressed ? 0.82 : 1, paddingHorizontal: spacing.md })}
    >
      <AppIcon color={checked ? semanticColors.brandPrimary : semanticColors.textSecondary} name={icon} size={22} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={{ color: semanticColors.textPrimary, ...typography.bodyStrong }}>{label}</Text>
        {description ? <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{description}</Text> : null}
      </View>
      <AppIcon color={checked ? semanticColors.brandPrimary : semanticColors.textDisabled} name={checked ? "toggle-switch" : "toggle-switch-off-outline"} size={34} />
    </Pressable>
  );
}

export function MoneyField({ label, value, onChangeText, error, helper, ...props }: Omit<TextInputProps, "value" | "onChangeText"> & { label: string; value: string; onChangeText: (value: string) => void; error?: string | null; helper?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: semanticColors.textPrimary, ...typography.bodyStrong }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: semanticColors.surface, borderColor: error ? semanticColors.danger : semanticColors.borderStrong, borderRadius: radius.medium, borderWidth: 1, flexDirection: "row", minHeight: 52, paddingHorizontal: spacing.md }}>
        <TextInput accessibilityLabel={label} keyboardType="number-pad" onChangeText={onChangeText} placeholderTextColor={semanticColors.textDisabled} style={{ color: semanticColors.textPrimary, flex: 1, fontSize: typography.bodyLarge.fontSize, minHeight: 50 }} value={value} {...props} />
        <Text style={{ color: semanticColors.textSecondary, ...typography.bodyStrong }}>원</Text>
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.danger, ...typography.caption }}>{error}</Text> : helper ? <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{helper}</Text> : null}
    </View>
  );
}

export type ModV1ItemStatus = "researching" | "planned" | "ordered" | "owned" | "rented" | "gifted" | "replacement_needed" | "retired";

export const modV1ItemStatuses: ReadonlyArray<{ value: ModV1ItemStatus; label: string; icon: AppIconName }> = [
  { value: "researching", label: "알아보기", icon: "magnify" },
  { value: "planned", label: "예정", icon: "calendar-clock" },
  { value: "ordered", label: "주문", icon: "truck-delivery-outline" },
  { value: "owned", label: "보유", icon: "check-circle-outline" },
  { value: "rented", label: "대여", icon: "handshake-outline" },
  { value: "gifted", label: "선물", icon: "gift-outline" },
  { value: "replacement_needed", label: "교체", icon: "autorenew" },
  { value: "retired", label: "종료", icon: "archive-outline" }
];

const modV1ItemStatusRows = Array.from(
  { length: Math.ceil(modV1ItemStatuses.length / 2) },
  (_, rowIndex) => modV1ItemStatuses.slice(rowIndex * 2, rowIndex * 2 + 2)
);

export function itemStatusLabel(value: string | null | undefined) {
  if (value === "borrowed") return "대여";
  if (value === "gift_expected") return "선물 예정";
  if (value === "replacement_due") return "교체 시기";
  if (value === "replaced") return "교체 완료";
  if (value === "not_needed") return "필요 없음";
  if (value === "need") return "필요";
  if (value === "ended") return "사용 종료";
  return modV1ItemStatuses.find((entry) => entry.value === value)?.label ?? "미정";
}

function preparationStatusVisual(status: string | null | undefined) {
  if (status === "planned" || status === "ordered" || status === "gift_expected") {
    return { backgroundColor: semanticColors.infoSurface, color: semanticColors.info };
  }
  if (status === "owned" || status === "gifted") {
    return { backgroundColor: semanticColors.successSurface, color: semanticColors.success };
  }
  if (status === "borrowed" || status === "rented") {
    return { backgroundColor: semanticColors.reviewSurface, color: semanticColors.review };
  }
  if (status === "replacement_needed" || status === "replacement_due") {
    return { backgroundColor: semanticColors.warningSurface, color: semanticColors.warning };
  }
  return { backgroundColor: semanticColors.surfaceMuted, color: semanticColors.textSecondary };
}

export function PreparationItemCard({ title, status, icon = "baby-face-outline", iconBackgroundColor = semanticColors.actionSecondary, iconColor = semanticColors.actionPrimary, hint, onPress }: { title: string; status?: string | null; icon?: AppIconName; iconBackgroundColor?: string; iconColor?: string; hint?: string | null; onPress: () => void }) {
  const label = itemStatusLabel(status);
  const statusVisual = preparationStatusVisual(status);
  const displayTitle = balanceCompactKoreanLabel(title);
  return (
    <Pressable
      accessibilityLabel={`${title}. 상태 ${label}${hint ? `. ${hint}` : ""}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: radius.large, borderWidth: 1, gap: spacing.xs, height: 148, justifyContent: "center", opacity: pressed ? 0.76 : 1, padding: spacing.sm })}
    >
      <View style={{ alignItems: "center", backgroundColor: iconBackgroundColor, borderRadius: radius.pill, height: 44, justifyContent: "center", width: 44 }}>
        <AppIcon color={iconColor} name={icon} size={24} />
      </View>
      <View style={{ alignItems: "center", justifyContent: "center", minHeight: 34 }}>
        {displayTitle.split("\n").map((line) => (
          <Text key={line} style={{ color: semanticColors.textPrimary, fontSize: 12, fontWeight: "700", lineHeight: 17, textAlign: "center" }}>{line}</Text>
        ))}
      </View>
      <View style={{ alignItems: "center", backgroundColor: statusVisual.backgroundColor, borderRadius: radius.pill, minHeight: 24, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs }}>
        <Text style={{ color: statusVisual.color, fontSize: 10, fontWeight: "700" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function ItemStatusControl({ value, onChange, disabled }: { value?: string | null; onChange: (value: ModV1ItemStatus) => void; disabled?: boolean }) {
  return (
    <View accessibilityLabel="준비 상태" accessibilityRole="radiogroup" style={{ gap: spacing.xs }}>
      {modV1ItemStatusRows.map((row) => (
        <View key={row[0]!.value} style={{ flexDirection: "row", gap: spacing.xs }}>
          {row.map((entry) => {
            const selected = value === entry.value || (entry.value === "rented" && value === "borrowed");
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                key={entry.value}
                onPress={() => onChange(entry.value)}
                style={({ pressed }) => ({ alignItems: "center", backgroundColor: selected ? semanticColors.actionSecondary : semanticColors.surface, borderColor: selected ? semanticColors.actionPrimary : semanticColors.border, borderRadius: radius.medium, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing.xs, height: 48, minWidth: 0, opacity: disabled ? 0.5 : pressed ? 0.76 : 1, paddingHorizontal: spacing.sm })}
              >
                <AppIcon color={selected ? semanticColors.actionPrimary : semanticColors.textSecondary} name={entry.icon} size={19} />
                <Text style={{ color: selected ? semanticColors.actionPrimary : semanticColors.textPrimary, fontSize: 13, fontWeight: "700" }}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function focusAccessibilityTarget(target: RefObject<View | NativeText | null>) {
  const handle = findNodeHandle(target.current);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}

export function BottomSheet({
  visible,
  title,
  description,
  onClose,
  returnFocusRef,
  children
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void | boolean;
  returnFocusRef?: RefObject<View | null>;
  children: React.ReactNode
}) {
  const headingRef = useRef<NativeText>(null);
  const close = () => {
    if (onClose() === false) return;
    if (returnFocusRef) setTimeout(() => focusAccessibilityTarget(returnFocusRef), 0);
  };
  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      onShow={() => setTimeout(() => focusAccessibilityTarget(headingRef), 0)}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={{ backgroundColor: semanticColors.overlay, flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel="시트 닫기" accessibilityRole="button" onPress={close} style={{ flex: 1 }} />
        <View accessibilityViewIsModal style={{ backgroundColor: semanticColors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, gap: spacing.md, maxHeight: "86%", paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <View style={{ alignSelf: "center", backgroundColor: semanticColors.borderStrong, borderRadius: radius.pill, height: 4, width: 40 }} />
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text accessible accessibilityRole="header" ref={headingRef} style={{ color: semanticColors.textPrimary, ...typography.heading3 }}>{title}</Text>
              {description ? <Text style={{ color: semanticColors.textSecondary, ...typography.caption }}>{description}</Text> : null}
            </View>
            <IconButton accessibilityLabel="닫기" icon="close" onPress={close} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function AccessibleDataTable({ label, rows }: { label: string; rows: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="summary" style={{ borderColor: semanticColors.border, borderRadius: radius.medium, borderWidth: 1, overflow: "hidden" }}>
      <View style={{ backgroundColor: semanticColors.surfaceMuted, flexDirection: "row", minHeight: 40, paddingHorizontal: spacing.sm }}>
        <Text style={{ color: semanticColors.textSecondary, flex: 1, fontSize: 11, fontWeight: "700", paddingVertical: spacing.xs }}>항목</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 11, fontWeight: "700", paddingVertical: spacing.xs }}>금액 · 비율</Text>
      </View>
      {rows.map((row) => (
        <View accessibilityLabel={`${row.label}, ${row.value}${row.detail ? `, ${row.detail}` : ""}`} key={`${row.label}:${row.value}`} style={{ borderTopColor: semanticColors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm }}>
          <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 12, paddingVertical: spacing.sm }}>{row.label}</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12, paddingVertical: spacing.sm, textAlign: "right" }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
