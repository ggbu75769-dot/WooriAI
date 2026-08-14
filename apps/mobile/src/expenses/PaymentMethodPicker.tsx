import { Pressable, View } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import { AppIcon } from "../ui";
import { theme } from "../theme";

export type PaymentMethodPickerOption = {
  id: string | null;
  label: string;
  unavailable?: boolean;
};

export function PaymentMethodPicker({
  options,
  selectedId,
  onSelect
}: {
  options: PaymentMethodPickerOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <View accessibilityLabel="결제 수단 선택" accessibilityRole="radiogroup" style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>결제 수단</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              accessibilityLabel={`${option.label}${option.unavailable ? ", 현재 숨김" : ""}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: Boolean(option.unavailable), selected }}
              disabled={option.unavailable && !selected}
              key={option.id ?? "unassigned"}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: selected ? theme.colors.coral[50] : theme.colors.white,
                borderColor: selected ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: theme.radii.pill,
                borderWidth: selected ? 2 : 1,
                flexDirection: "row",
                gap: 6,
                minHeight: theme.touchTarget,
                opacity: option.unavailable && !selected ? 0.45 : pressed ? 0.78 : 1,
                paddingHorizontal: 14
              })}
            >
              {selected ? <AppIcon color={theme.colors.mainCoral} name="check" size={18} /> : null}
              <Text style={{ color: selected ? theme.colors.mainCoral : theme.colors.brown, fontSize: 13, fontWeight: "800" }}>
                {option.label}{option.unavailable ? " (숨김)" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
