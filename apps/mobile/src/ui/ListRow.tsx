import type React from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";

export type ListRowProps = {
  /** Glyph rendered inside the left circular color slot. */
  icon?: string;
  /** Background of the circular icon slot -- pass a category color (theme.colors.categoryColors) to color-code rows. Defaults to coral-100. */
  iconBackgroundColor?: string;
  /** Glyph color inside the circular icon slot. Defaults to coral-600. */
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned value text (e.g. a formatted amount). Renders above `badge` when both are set. */
  value?: string;
  /** Right-aligned badge/extra slot rendered under `value` (e.g. a StageBadge or sync-status chip). */
  badge?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Round 5A D0 list row (docs/5차/round5a-design-spec.md §D0 "TDS ListRow 사고방식"): left circular
 * color icon slot / title+subtitle / right value+badge slot. Touch target is always >= 44dp
 * (theme.touchTarget), whether or not the row is pressable.
 *
 * This is a new, additive component -- the pre-existing `ListRow` in src/ui.tsx (used by
 * app/(tabs)/records.tsx, app/(tabs)/index.tsx, app/settings/index.tsx) is untouched.
 */
export function ListRow({ icon, iconBackgroundColor, iconColor, title, subtitle, value, badge, onPress, disabled, style }: ListRowProps) {
  const content = (
    <View style={[listRowStyle, style]}>
      {icon ? (
        <View style={[iconSlotStyle, { backgroundColor: iconBackgroundColor ?? theme.colors.coral[100] }]}>
          <Text style={{ color: iconColor ?? theme.colors.coral[600], fontSize: 18 }}>{icon}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={titleStyle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={subtitleStyle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value || badge ? (
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {value ? <Text style={valueStyle}>{value}</Text> : null}
          {badge}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      {content}
    </Pressable>
  );
}

const listRowStyle: ViewStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12,
  minHeight: theme.touchTarget,
  paddingVertical: 8
};

const iconSlotStyle: ViewStyle = {
  alignItems: "center",
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40
};

const titleStyle: TextStyle = {
  color: theme.colors.text.primary,
  fontSize: theme.typography.body1.fontSize,
  fontWeight: "700"
};

const subtitleStyle: TextStyle = {
  color: theme.colors.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "400"
};

const valueStyle: TextStyle = {
  color: theme.colors.text.primary,
  fontSize: theme.money.row.fontSize,
  fontVariant: ["tabular-nums"],
  fontWeight: theme.money.row.fontWeight as TextStyle["fontWeight"]
};
