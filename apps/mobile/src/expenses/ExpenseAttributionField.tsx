import { Pressable, Text, View } from "react-native";
import { AppIcon, semanticColors, spacing } from "../design-system";

const options = [
  { id: "child", label: "아이", supported: true },
  { id: "mother", label: "엄마", supported: false },
  { id: "family", label: "가족", supported: false }
] as const;

export function ExpenseAttributionField() {
  return (
    <View accessibilityLabel="지출 귀속. 선택한 아이" style={{ gap: spacing.xs }}>
      <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "700" }}>귀속</Text>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: option.id === "child", disabled: !option.supported }}
            disabled={!option.supported}
            key={option.id}
            onPress={() => undefined}
            style={{ alignItems: "center", backgroundColor: option.supported ? semanticColors.actionSecondary : semanticColors.surfaceMuted, borderColor: option.supported ? semanticColors.actionPrimary : semanticColors.border, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 48, opacity: option.supported ? 1 : 0.52 }}
          >
            {option.supported ? <AppIcon color={semanticColors.actionPrimary} name="check-circle-outline" size={17} /> : null}
            <Text style={{ color: option.supported ? semanticColors.actionPrimary : semanticColors.textDisabled, fontSize: 12, fontWeight: "700" }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>현재 저장 계약은 선택한 아이 귀속만 지원해요.</Text>
    </View>
  );
}
