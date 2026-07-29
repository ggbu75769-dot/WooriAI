import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { dateOnlyToLocalDate, localDateToDateOnly } from "@wooriai/domain/money-date";
import { forwardRef, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps
} from "react-native";
import { AppIcon, IconButton, PrimaryButton, SecondaryButton, TextButton, type AppIconName } from "./ApplicationPrimitives";
import { theme } from "../../theme";
import { semanticColors } from "../tokens/color";
import { radius } from "../tokens/radius";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";

export function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const safeCurrent = Math.max(0, Math.min(total, current));
  return (
    <View
      accessibilityLabel={`${label}, ${total}단계 중 ${safeCurrent}단계`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: safeCurrent, text: `${safeCurrent}/${total}` }}
      style={{ gap: spacing.sm }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: semanticColors.textSecondary, ...typography.label }}>{label}</Text>
        <Text style={{ color: semanticColors.brandPrimary, ...typography.label }}>{safeCurrent} / {total}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            testID={`onboarding-progress-segment-${index + 1}`}
            style={{
              backgroundColor: index < safeCurrent ? semanticColors.brandPrimary : semanticColors.border,
              borderRadius: radius.pill,
              flex: 1,
              height: 5
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function BottomActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  textLabel,
  onText
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  textLabel?: string;
  onText?: () => void;
}) {
  return (
    <View style={{ gap: 10, paddingTop: 8 }}>
      <PrimaryButton disabled={primaryDisabled} label={primaryLabel} onPress={onPrimary} />
      {secondaryLabel && onSecondary ? <SecondaryButton label={secondaryLabel} onPress={onSecondary} /> : null}
      {textLabel && onText ? <TextButton label={textLabel} onPress={onText} style={{ alignSelf: "center" }} /> : null}
    </View>
  );
}

export const RadioCard = forwardRef<View, {
  icon: AppIconName;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}>(function RadioCard({
  icon,
  title,
  description,
  selected,
  onPress
}, ref) {
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? semanticColors.actionSecondary : semanticColors.surface,
        borderColor: selected ? semanticColors.brandPrimary : semanticColors.border,
        borderRadius: radius.card,
        borderWidth: selected ? 2 : 1,
        flexDirection: "row",
        gap: spacing.sm,
        minHeight: 88,
        opacity: pressed ? 0.82 : 1,
        padding: spacing.md
      })}
    >
      <View style={{ alignItems: "center", backgroundColor: semanticColors.warningSurface, borderRadius: radius.large, height: 48, justifyContent: "center", width: 48 }}>
        <AppIcon color={semanticColors.brandPrimary} name={icon} size={24} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={{ color: semanticColors.textPrimary, ...typography.title }}>{title}</Text>
        <Text style={{ color: semanticColors.textSecondary, ...typography.body }}>{description}</Text>
      </View>
      <View style={{ alignItems: "center", gap: spacing.xxs }}>
        <AppIcon color={selected ? semanticColors.brandPrimary : semanticColors.borderStrong} name={selected ? "check-circle" : "circle-outline"} size={24} />
        {selected ? <Text style={{ color: semanticColors.brandPrimary, ...typography.caption }}>선택됨</Text> : null}
      </View>
    </Pressable>
  );
});

export function SegmentedChoice<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: selected ? theme.colors.coral[50] : theme.colors.surface,
                borderColor: selected ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                flexDirection: "row",
                flexGrow: 1,
                gap: spacing.xs,
                justifyContent: "center",
                minHeight: 48,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: 14
              })}
            >
              {selected ? <AppIcon color={theme.colors.coral[700]} name="check" size={18} /> : null}
              <Text style={{ color: selected ? theme.colors.coral[700] : theme.colors.textPrimary, fontWeight: "700" }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FormField({ label, error, optional, ...inputProps }: TextInputProps & { label: string; error?: string | null; optional?: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" }}>
        {label}{optional ? " (선택)" : ""}
      </Text>
      <TextInput
        accessibilityHint={error ?? inputProps.accessibilityHint}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.text.tertiary}
        {...inputProps}
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.gray300,
            borderRadius: theme.radii.small,
            borderWidth: 1,
            color: theme.colors.textPrimary,
            fontSize: 16,
            minHeight: 52,
            paddingHorizontal: 14,
            paddingVertical: 12
          },
          inputProps.style
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  error
}: {
  label: string;
  value: string | null;
  onChange: (dateOnly: string | null) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(() => pickerInitialDate(value, minimumDate, maximumDate));
  const triggerRef = useRef<View>(null);
  const modalHeadingRef = useRef<Text>(null);
  const restoreFocus = () => {
    const node = findNodeHandle(triggerRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  const focusModalHeading = () => {
    const node = findNodeHandle(modalHeadingRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  const closePicker = () => {
    setOpen(false);
    setTimeout(restoreFocus, 0);
  };
  const openPicker = () => {
    Keyboard.dismiss();
    const initialDate = pickerInitialDate(value, minimumDate, maximumDate);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        display: "calendar",
        maximumDate,
        minimumDate,
        mode: "date",
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(localDateToDateOnly(date));
          setTimeout(restoreFocus, 0);
        },
        value: initialDate
      });
      return;
    }
    setPendingDate(initialDate);
    setOpen(true);
  };
  const confirmPicker = () => {
    onChange(localDateToDateOnly(pendingDate));
    closePicker();
  };
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Pressable
          ref={triggerRef}
          accessibilityHint={error ? `${error}. 두 번 탭하면 달력이 열려요` : "두 번 탭하면 달력이 열려요"}
          accessibilityLabel={`${label}, ${value ?? "선택 안 됨"}`}
          accessibilityRole="button"
          onPress={openPicker}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.gray300,
            borderRadius: theme.radii.small,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            minHeight: 52,
            opacity: pressed ? 0.8 : 1,
            paddingHorizontal: 14
          })}
        >
          <AppIcon color={theme.colors.coral[600]} name="calendar-month-outline" size={22} />
          <Text style={{ color: value ? theme.colors.textPrimary : theme.colors.text.tertiary, flex: 1, marginLeft: 10 }}>{value ? formatKoreanDate(value) : "날짜 선택"}</Text>
        </Pressable>
        {value ? <IconButton accessibilityLabel={`${label} 삭제`} icon="close-circle-outline" onPress={() => onChange(null)} /> : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</Text> : null}
      {Platform.OS === "ios" ? <Modal accessibilityViewIsModal animationType="slide" onDismiss={restoreFocus} onRequestClose={closePicker} onShow={focusModalHeading} transparent visible={open}>
        <View style={{ backgroundColor: semanticColors.overlay, flex: 1, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.sheet, borderTopRightRadius: theme.radii.sheet, gap: spacing.md, maxHeight: "90%", padding: 24, width: "100%" }}>
            <Text ref={modalHeadingRef} accessible accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: "800" }}>{label}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 }}>날짜를 확인한 뒤 선택 완료를 눌러 주세요.</Text>
            <DateTimePicker
              display="spinner"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              mode="date"
              onChange={(event, date) => {
                if (event.type === "set" && date) setPendingDate(date);
              }}
              value={pendingDate}
            />
            <View accessibilityLiveRegion="polite" style={{ alignItems: "center", backgroundColor: semanticColors.actionSecondary, borderRadius: radius.large, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md }}>
              <AppIcon color={semanticColors.brandPrimary} name="calendar-check-outline" size={22} />
              <Text style={{ color: semanticColors.textPrimary, flex: 1, fontWeight: "800" }}>{formatKoreanDate(localDateToDateOnly(pendingDate))}</Text>
            </View>
            <PrimaryButton label="선택 완료" onPress={confirmPicker} />
            <SecondaryButton label="취소" onPress={closePicker} />
          </View>
        </View>
      </Modal> : null}
    </View>
  );
}

export function CheckboxRow({ icon, title, subtitle, checked, onPress }: { icon: AppIconName; title: string; subtitle?: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={checked ? "준비 완료로 선택됨. 두 번 탭하면 해제됩니다." : "두 번 탭하면 준비 완료로 선택됩니다."}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: checked ? semanticColors.actionSecondary : semanticColors.surface,
        borderColor: checked ? semanticColors.brandPrimary : "transparent",
        borderRadius: radius.medium,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        minHeight: 72,
        opacity: pressed ? 0.8 : 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm
      })}
    >
      <AppIcon color={checked ? theme.colors.mainCoral : theme.colors.gray300} name={checked ? "checkbox-marked" : "checkbox-blank-outline"} size={26} />
      <AppIcon color={theme.colors.coral[600]} name={icon} size={24} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{title}</Text>
        {subtitle ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      <Text style={{ color: checked ? semanticColors.brandPrimary : semanticColors.textSecondary, ...typography.caption }}>{checked ? "선택됨" : "선택"}</Text>
    </Pressable>
  );
}

export function ConfirmSheet({ visible, title, description, children, confirmLabel = "변경하기", onConfirm, onCancel, returnFocusRef }: { visible: boolean; title: string; description: string; children?: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; returnFocusRef?: RefObject<View> }) {
  const modalHeadingRef = useRef<Text>(null);
  const focusModalHeading = () => {
    const node = findNodeHandle(modalHeadingRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  const restoreFocus = () => {
    const node = findNodeHandle(returnFocusRef?.current ?? null);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  return (
    <Modal accessibilityViewIsModal animationType="slide" onDismiss={restoreFocus} onRequestClose={onCancel} onShow={focusModalHeading} transparent visible={visible}>
      <View style={{ backgroundColor: semanticColors.overlay, flex: 1, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.sheet, borderTopRightRadius: theme.radii.sheet, gap: 14, padding: 24 }}>
          <Text ref={modalHeadingRef} accessible accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 21, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22 }}>{description}</Text>
          {children}
          <PrimaryButton label={confirmLabel} onPress={onConfirm} />
          <SecondaryButton label="계속 입력할게요" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function pickerInitialDate(value: string | null, minimumDate?: Date, maximumDate?: Date) {
  const initial = value ? dateOnlyToLocalDate(value) : new Date();
  if (minimumDate && initial < minimumDate) return minimumDate;
  if (maximumDate && initial > maximumDate) return maximumDate;
  return initial;
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
