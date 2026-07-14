import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";

export type EmptyStateProps = {
  /** Glyph/emoji shown above the title -- illustration placeholder slot for later "S" work. */
  icon?: string;
  title: string;
  description?: string;
  /** CTA button label. Omit to render a plain (non-actionable) empty state. */
  ctaLabel?: string;
  onPressCta?: () => void;
};

/**
 * Round 5A D6 empty state (docs/5차/round5a-design-spec.md §D0/§D6): covers the 4 empty-state
 * kinds called out in the spec (최초/검색없음/완료/교육) via the same icon/title/description/cta
 * shape -- callers choose copy and icon per screen (S-phase work), this component only owns
 * layout/tokens.
 */
export function EmptyState({ icon, title, description, ctaLabel, onPressCta }: EmptyStateProps) {
  return (
    <View style={containerStyle}>
      {icon ? <Text style={iconStyle}>{icon}</Text> : null}
      <Text style={titleStyle}>{title}</Text>
      {description ? <Text style={descriptionStyle}>{description}</Text> : null}
      {ctaLabel ? (
        <Pressable onPress={onPressCta} style={({ pressed }) => [ctaStyle, { opacity: pressed ? 0.86 : 1 }]}>
          <Text style={ctaLabelStyle}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const containerStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.cream.surfaceAlt,
  borderRadius: theme.radii.card,
  gap: 10,
  paddingHorizontal: theme.spacing.card,
  paddingVertical: theme.spacing.card + 8
} as const;

const iconStyle = {
  fontSize: 32
} as const;

const titleStyle = {
  color: theme.colors.text.primary,
  fontSize: 16,
  fontWeight: "700",
  textAlign: "center"
} as const;

const descriptionStyle = {
  color: theme.colors.text.secondary,
  fontSize: 13,
  textAlign: "center"
} as const;

const ctaStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.coral[500],
  borderRadius: theme.radii.pill,
  justifyContent: "center",
  minHeight: theme.touchTarget,
  paddingHorizontal: 20
} as const;

const ctaLabelStyle = {
  color: theme.colors.cream.surface,
  fontSize: 14,
  fontWeight: "700"
} as const;
