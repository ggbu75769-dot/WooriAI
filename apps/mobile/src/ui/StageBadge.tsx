import { Text, View } from "react-native";
import { theme } from "../theme";

export type StageBadgeProps = {
  /** e.g. "생후 7개월" */
  label: string;
};

/**
 * Round 5A D0 stage chip (docs/5차/round5a-design-spec.md §D0): coral-50 background + coral-700
 * text. Shared style between the home header ("생후 7개월" badge, D2) and the 준비템 stage filter
 * chips (D4) -- both consume this same component.
 */
export function StageBadge({ label }: StageBadgeProps) {
  return (
    <View style={containerStyle}>
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}

const containerStyle = {
  alignSelf: "flex-start",
  backgroundColor: theme.colors.coral[50],
  borderRadius: theme.radii.pill,
  paddingHorizontal: 12,
  paddingVertical: 6
} as const;

const labelStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700"
} as const;
