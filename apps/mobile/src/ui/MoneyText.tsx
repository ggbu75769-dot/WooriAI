import type { StyleProp, TextStyle } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import { formatKrwParts } from "../money";
import { theme } from "../theme";

export type MoneyTextSize = "hero" | "section" | "row";

export type MoneyTextProps = {
  /** KRW amount. Always rendered as its absolute value (see src/money.ts). */
  amount: number;
  /** Hierarchy tier -- hero 30/800, section 17/700, row 15/600 (D0). */
  size?: MoneyTextSize;
  /**
   * Income/refund amounts get a "+" prefix and the semantic.success color, per D0
   * ("지출 금액 기본색 = text.primary... 수입/환불만 + 접두 + success"). Omit for a normal
   * (expense) amount, which renders in text.primary with no prefix.
   */
  sign?: "income" | "refund";
  style?: StyleProp<TextStyle>;
};

/**
 * Round 5A D0 money text component (docs/5차/round5a-design-spec.md §D0). Renders the '원'
 * suffix one size step smaller/lighter than the number, per the D0 hierarchy rule, and applies
 * `fontVariant: ["tabular-nums"]` to the whole amount so digits stay aligned.
 */
export function MoneyText({ amount, size = "row", sign, style }: MoneyTextProps) {
  const { number, suffix } = formatKrwParts(amount);
  const tier = theme.money[size];
  const color = sign ? theme.colors.semantic.success : theme.colors.text.primary;
  const prefix = sign ? "+" : "";
  const suffixFontSize = Math.round(tier.fontSize * 0.6);

  return (
    <Text style={[{ color, fontVariant: ["tabular-nums"] }, style]}>
      <Text style={{ color, fontSize: tier.fontSize, fontWeight: tier.fontWeight }}>
        {prefix}
        {number}
      </Text>
      <Text style={{ color, fontSize: suffixFontSize, fontWeight: tier.fontWeight }}>{suffix}</Text>
    </Text>
  );
}
