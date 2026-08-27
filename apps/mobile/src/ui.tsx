import type React from "react";
import { useEffect, useState } from "react";
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from "react-native";
import { AccessibilityInfo, Image, Pressable, ScrollView, Text, View } from "react-native";
import { lineChartSegmentsFor, normalizeLineChartPoints } from "./lineChartMath";
import { formatKrw } from "./money";
import { computeCategoryShares } from "./reports/category-share";
import { theme } from "./theme";

type ChildrenProps = {
  children: React.ReactNode;
};

/**
 * A11Y-117: contrast token for *small* coral text on light backgrounds. coral[500] (#EF6644) on
 * white is 3.16:1 -- below the WCAG AA 4.5:1 floor for text under 18pt/14pt-bold. coral[700]
 * (#B93E23) reaches 5.56:1 on white, so small coral text (eyebrows, prices, deltas, text buttons,
 * inline banners) uses this instead.
 *
 * Deliberately NOT applied to white-text-on-coral brand surfaces (PrimaryButton,
 * HeroSummaryCard, selected SegmentedControl/CategoryChip fills, FloatingActionButton): darkening
 * those fills changes the brand look across every screen and pixel-lock reference, so that subset
 * is on hold pending a design decision -- see A11Y-117.
 */
const smallCoralText = theme.colors.coral[700];

type PressableProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A11Y-101: override for TalkBack when the visible label alone is not descriptive enough. */
  accessibilityLabel?: string;
};

/**
 * A11Y-115: shared TalkBack/VoiceOver announce helper. AccessibilityInfo can be missing or
 * partially implemented outside a native runtime (web preview, vitest), so failures are
 * swallowed -- announcing is always best-effort and must never break the render path.
 */
export function announceForA11y(message: string) {
  try {
    AccessibilityInfo.announceForAccessibility?.(message);
  } catch {
    // non-native environment -- nothing to announce to
  }
}

const pixelLockWebStyleId = "wooriai-pixel-lock-web-styles";
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

function ensurePixelLockWebStyles() {
  if (typeof document === "undefined" || document.getElementById(pixelLockWebStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = pixelLockWebStyleId;
  style.textContent = `
    html, body, #root {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar,
    div::-webkit-scrollbar {
      display: none;
      height: 0;
      width: 0;
    }
  `;
  document.head.appendChild(style);
}

// MOB-117: optional pass-through so screens can attach pull-to-refresh without restructuring
// away from AppScreen (records.tsx is the exception -- its screen scroller is a FlatList per
// PERF-102, so it takes the same element via the FlatList refreshControl prop instead).
export function AppScreen({ children, refreshControl }: ChildrenProps & { refreshControl?: React.ReactElement }) {
  ensurePixelLockWebStyles();

  return (
    <ScrollView
      refreshControl={refreshControl}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={[{ backgroundColor: theme.colors.background, flex: 1 }, webScrollHiddenStyle]}
      contentContainerStyle={{
        backgroundColor: theme.colors.background,
        flexGrow: 1,
        gap: theme.spacing.section,
        padding: theme.spacing.screen
      }}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text style={[textStyles.caption, { color: smallCoralText }]}>{eyebrow}</Text> : null}
        <Text style={[textStyles.h2, { color: theme.colors.brown }]}>{title}</Text>
        {subtitle ? <Text style={[textStyles.body2, { color: theme.colors.gray600 }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function BrandLogo({ size = 56 }: { size?: number }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.white,
        borderRadius: Math.round(size * 0.28),
        height: size,
        justifyContent: "center",
        width: size,
        ...theme.shadows.card
      }}
    >
      <Text accessible={false} style={{ color: theme.colors.mainCoral, fontSize: Math.round(size * 0.54), fontWeight: "700" }}>⌁</Text>
    </View>
  );
}

export function Card({ children, style }: ChildrenProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.white,
          borderColor: "rgba(74, 63, 53, 0.08)",
          borderRadius: theme.radii.card,
          borderWidth: 1,
          gap: 10,
          padding: theme.spacing.card,
          ...theme.shadows.card
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: disabled ? theme.colors.gray300 : theme.colors.mainCoral,
          borderRadius: theme.radii.button,
          height: theme.ctaHeight,
          justifyContent: "center",
          opacity: pressed ? 0.86 : 1
        },
        style
      ]}
    >
      <Text style={{ color: theme.colors.white, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.primary100,
          borderRadius: theme.radii.button,
          borderWidth: 1,
          minHeight: theme.touchTarget,
          justifyContent: "center",
          opacity: pressed ? 0.82 : 1,
          paddingHorizontal: 16
        },
        style
      ]}
    >
      <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[{ minHeight: theme.touchTarget, justifyContent: "center" }, style]}
    >
      <Text style={{ color: disabled ? theme.colors.gray300 : smallCoralText, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function InputField({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ borderRadius: 16, paddingVertical: 12 }}>
      <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{label}</Text>
      <Text style={[textStyles.body1, { color: theme.colors.brown }]}>{value}</Text>
    </Card>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange
}: {
  options: string[];
  value: string;
  onChange?: (option: string) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ backgroundColor: "#F5F0EA", borderRadius: theme.radii.pill, flexDirection: "row", padding: 4 }}
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityLabel={option}
          accessibilityState={{ selected: option === value }}
          hitSlop={4}
          onPress={() => onChange?.(option)}
          style={{
            backgroundColor: option === value ? theme.colors.mainCoral : "transparent",
            borderRadius: theme.radii.pill,
            flex: 1,
            paddingVertical: 9
          }}
        >
          <Text
            style={{
              color: option === value ? theme.colors.white : theme.colors.gray600,
              fontSize: 13,
              fontWeight: "700",
              textAlign: "center"
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CategoryChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={3}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? theme.colors.mainCoral : theme.colors.white,
        borderColor: selected ? theme.colors.mainCoral : theme.colors.primary100,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        minHeight: 38,
        justifyContent: "center",
        paddingHorizontal: 14
      }}
    >
      <Text style={{ color: selected ? theme.colors.white : theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  // A11Y-117: warning tone follows the StageBadge recipe (coral[700] on coral[50]) so 11px badge
  // text -- including the DNC-011 광고/스폰서 disclosure badges -- meets WCAG AA contrast.
  const background = tone === "success" ? theme.colors.mint : tone === "warning" ? theme.colors.coral[50] : theme.colors.beige;
  const color = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.coral[700] : theme.colors.brown;

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: background, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function BudgetProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.45)", borderRadius: theme.radii.pill, height: 8, overflow: "hidden" }}>
      <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.radii.pill, height: 8, width: `${clamped}%` }} />
    </View>
  );
}

export function HeroSummaryCard({
  label,
  amount,
  subtext,
  progress
}: {
  label: string;
  amount: string;
  subtext: string;
  progress: number;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.mainCoral,
        borderRadius: 24,
        gap: 10,
        padding: 18,
        ...theme.shadows.card
      }}
    >
      <Text style={[textStyles.caption, { color: theme.colors.white }]}>{label}</Text>
      <Text style={{ color: theme.colors.white, fontSize: 28, fontWeight: "800" }}>{amount}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[textStyles.caption, { color: theme.colors.white }]}>{subtext}</Text>
        <Text style={[textStyles.caption, { color: theme.colors.white, fontWeight: "700" }]}>{progress}%</Text>
      </View>
      <BudgetProgressBar value={progress} />
    </View>
  );
}

export function QuickActionIconButton({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ alignItems: "center", flex: 1, gap: 6, minHeight: 68 }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.white,
          borderRadius: 18,
          height: 42,
          justifyContent: "center",
          width: 42,
          ...theme.shadows.card
        }}
      >
        <Text style={{ color: theme.colors.brown, fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={[textStyles.caption, { color: theme.colors.brown, fontWeight: "700", textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomTabBar({ children }: ChildrenProps) {
  return <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>;
}

export function FloatingActionButton({ onPress, accessibilityLabel = "지출 기록하기" }: { onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: theme.colors.mainCoral,
        borderRadius: 28,
        height: 56,
        justifyContent: "center",
        width: 56,
        ...theme.shadows.card
      }}
    >
      <Text style={{ color: theme.colors.white, fontSize: 30, lineHeight: 32 }}>+</Text>
    </Pressable>
  );
}

export function BottomSheetFrame({
  title,
  children,
  showHandle = true,
  style
}: ChildrenProps & { title: string; showHandle?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.white,
          borderTopLeftRadius: theme.radii.sheet,
          borderTopRightRadius: theme.radii.sheet,
          gap: 16,
          padding: 22,
          ...theme.shadows.card
        },
        style
      ]}
    >
      {showHandle ? (
        <View style={{ alignSelf: "center", backgroundColor: theme.colors.gray300, borderRadius: theme.radii.pill, height: 4, width: 42 }} />
      ) : null}
      {title ? <Text style={[textStyles.h3, { color: theme.colors.brown }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress}>
      <Card style={{ alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 12 }}>
        {icon ? <Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>{icon}</Text> : null}
        <View style={{ flex: 1 }}>
          <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          {subtitle ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{value}</Text> : null}
      </Card>
    </Pressable>
  );
}

export function ProductCard({
  title,
  price,
  badge,
  image,
  caption,
  onPress
}: {
  title: string;
  price: string;
  badge?: string;
  image?: ImageSourcePropType;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress}>
      <Card style={{ borderRadius: 18, flexDirection: "row", gap: 10, padding: 12 }}>
        <View style={{ backgroundColor: theme.colors.beige, borderRadius: 14, height: 64, overflow: "hidden", width: 64 }}>
          {image ? <Image source={image} style={{ height: "100%", width: "100%" }} resizeMode="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          {badge ? <StatusBadge label={badge} tone="warning" /> : null}
          <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          <Text style={[textStyles.body2, { color: smallCoralText, fontWeight: "800" }]}>{price}</Text>
          {caption ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{caption}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function ProductComparisonRow({ seller, price, onPress }: { seller: string; price: string; onPress?: () => void }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{seller}</Text>
        <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>무료배송</Text>
      </View>
      <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "800" }]}>{price}</Text>
      <SecondaryButton
        label="구매"
        accessibilityLabel={`${seller}에서 구매하기`}
        onPress={onPress}
        style={{ minWidth: 62 }}
      />
    </View>
  );
}

export function FamilyAvatarGroup({ names }: { names: string[] }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.map((name, index) => (
        <View
          key={name}
          style={{
            alignItems: "center",
            backgroundColor: [theme.colors.peach, theme.colors.mint, theme.colors.sky, theme.colors.beige][index % 4],
            borderColor: theme.colors.white,
            borderRadius: 18,
            borderWidth: 2,
            height: 36,
            justifyContent: "center",
            marginLeft: index === 0 ? 0 : -8,
            width: 36
          }}
        >
          <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700" }}>{name.slice(0, 1)}</Text>
        </View>
      ))}
    </View>
  );
}

const lineChartPoints = [
  { x: 8, y: 76 },
  { x: 46, y: 58 },
  { x: 78, y: 66 },
  { x: 112, y: 52 },
  { x: 150, y: 34 },
  { x: 186, y: 45 },
  { x: 228, y: 24 },
  { x: 268, y: 10 }
];

const lineChartSegments = lineChartPoints.slice(1).map((point, index) => {
  const previous = lineChartPoints[index];
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;

  return {
    angle: `${Math.atan2(dy, dx) * (180 / Math.PI)}deg`,
    length: Math.hypot(dx, dy),
    x: (previous.x + point.x) / 2,
    y: (previous.y + point.y) / 2
  };
});

const lineChartHeight = 104;
const lineChartPaddingTop = 10;
const lineChartPaddingBottom = 20;
const lineChartFallbackWidth = 280;

const reportCategoryLegend = [
  ["기저귀/위생", "34%"],
  ["식비/간식", "24%"],
  ["분유/유제품", "17%"],
  ["의류/잡화", "13%"],
  ["장난감/도서", "7%"],
  ["기타", "5%"]
] as const;

const donutSegmentPalette = [
  theme.colors.mainCoral,
  theme.colors.subCoral,
  theme.colors.warning,
  theme.colors.mint,
  theme.colors.sky,
  theme.colors.gray300
] as const;

export function LineChartCard({
  title,
  value,
  deltaLabel,
  points
}: {
  title: string;
  value: string;
  deltaLabel?: string | null;
  points?: number[];
}) {
  const showDelta = deltaLabel !== null;
  // deltaLabel undefined means no real comparison data -- the visible "+12.5%" is preview-only
  // decoration and must stay out of anything TalkBack announces (A11Y-117).
  const hasRealDelta = typeof deltaLabel === "string";
  const deltaText = deltaLabel ?? "+12.5%";

  // Only draw real geometry once real data (2+ amounts) is supplied — otherwise fall back to
  // the fixed decorative points/segments untouched so the no-session preview render (pixel-lock
  // capture) stays byte-for-byte identical to before.
  const hasRealData = Array.isArray(points) && points.length >= 2;
  const [measuredWidth, setMeasuredWidth] = useState(lineChartFallbackWidth);
  const activePoints = hasRealData
    ? normalizeLineChartPoints(points!, measuredWidth, lineChartHeight, lineChartPaddingTop, lineChartPaddingBottom)
    : lineChartPoints;
  const activeSegments = hasRealData ? lineChartSegmentsFor(activePoints) : lineChartSegments;

  return (
    <Card style={{ gap: 8 }}>
      <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{title}</Text>
      <Text style={{ color: theme.colors.gray900, fontSize: 28, fontWeight: "800", lineHeight: 34 }}>{value}</Text>
      {showDelta ? (
        // Preview-only fake delta stays visible but out of the accessibility tree (A11Y-117):
        // no-hide-descendants covers Android (TalkBack), accessibilityElementsHidden covers iOS.
        <View
          accessibilityElementsHidden={hasRealDelta ? undefined : true}
          importantForAccessibility={hasRealDelta ? undefined : "no-hide-descendants"}
          style={{ flexDirection: "row", gap: 5 }}
        >
          <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>지난 달 대비</Text>
          <Text style={[textStyles.caption, { color: smallCoralText, fontWeight: "800" }]}>{deltaText}</Text>
        </View>
      ) : null}
      <View
        // A11Y-117: the trend geometry (absolute-positioned line segments/dots) is meaningless
        // when read element-by-element -- accessible groups the decorative internals into one
        // element that announces a Korean summary (total + real delta only; the preview-only
        // fake delta never enters the label).
        accessible
        accessibilityLabel={`${title} 추이 차트, 합계 ${value}${hasRealDelta ? `, 지난 달 대비 ${deltaText}` : ""}`}
        onLayout={hasRealData ? (event) => setMeasuredWidth(event.nativeEvent.layout.width) : undefined}
        style={{ backgroundColor: "#FFF4EE", borderRadius: 14, height: 104, marginTop: 2, overflow: "hidden" }}
      >
        {[25, 50, 75].map((top) => (
          <View key={top} style={{ backgroundColor: "rgba(255, 107, 82, 0.08)", height: 1, left: 0, position: "absolute", right: 0, top }} />
        ))}
        {activeSegments.map((segment, index) => (
          <View
            key={`${segment.x}-${segment.y}-${index}`}
            style={{
              backgroundColor: theme.colors.mainCoral,
              borderRadius: 3,
              height: 3,
              left: segment.x - segment.length / 2,
              position: "absolute",
              top: segment.y,
              transform: [{ rotate: segment.angle }],
              width: segment.length
            }}
          />
        ))}
        {activePoints.map((point, index) => {
          const dotSize = index === activePoints.length - 1 ? 12 : 9;
          // Real data: center the dot on its coordinate so the edge inset from
          // normalizeLineChartPoints keeps the whole dot inside the clipped card.
          // Decorative fallback keeps the original -4 offset (pixel-lock preview).
          const dotOffset = hasRealData ? dotSize / 2 : 4;
          return (
            <View
              key={`${point.x}-${point.y}-${index}`}
              style={{
                backgroundColor: theme.colors.mainCoral,
                borderColor: theme.colors.white,
                borderRadius: 5,
                borderWidth: 2,
                height: dotSize,
                left: point.x - dotOffset,
                position: "absolute",
                top: point.y - dotOffset,
                width: dotSize
              }}
            />
          );
        })}
      </View>
    </Card>
  );
}

const categoryShareBarHeight = 14;

/**
 * 카테고리 비중 카드.
 *
 * R20-A: with real `segments` this draws a **proportional stacked share bar** -- each category's
 * width is its actual share of the total (`computeCategoryShares`). It used to draw a donut arc
 * via the border-quadrant trick (four border colors on a rounded View), which can only ever
 * express four fixed 90° wedges: the angles were pure decoration and a 60% category looked
 * identical to a 5% one. No SVG/conic-gradient dependency exists in this app (adding one is out of
 * scope) and the same border trick cannot produce an arbitrary sweep, so the honest fix is a bar
 * whose widths *are* the proportions rather than a circle whose angles lie.
 *
 * Without `segments` (the logged-out preview / pixel-lock capture) the original decorative donut
 * is rendered byte-for-byte unchanged -- same convention as LineChartCard's placeholder line.
 */
export function DonutChartCard({
  title,
  segments
}: {
  title: string;
  segments?: Array<{ label: string; amountKrw: number }>;
}) {
  if (segments) {
    const shares = computeCategoryShares(segments);

    // Real data that adds up to nothing (every amount 0) must not fall through to the decorative
    // preview legend -- that would show invented percentages as if they were this child's.
    if (shares.length === 0) {
      return (
        <Card style={{ gap: 8 }}>
          <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>아직 비중을 보여줄 지출이 없어요.</Text>
        </Card>
      );
    }

    return (
      <Card style={{ gap: 10 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
        {/* A11Y-117: the bar is decorative -- every slice's name, amount and percent is read from
            the legend rows below it, so the bar itself stays out of TalkBack/VoiceOver. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            backgroundColor: theme.colors.gray300,
            borderRadius: categoryShareBarHeight / 2,
            flexDirection: "row",
            height: categoryShareBarHeight,
            overflow: "hidden"
          }}
        >
          {shares.map((slice, index) => (
            <View
              key={`${slice.label}-${index}`}
              style={{
                backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length],
                flexBasis: 0,
                flexGrow: slice.widthPercent
              }}
            />
          ))}
        </View>
        <View style={{ gap: 5 }}>
          {shares.map((slice, index) => (
            // A11Y-117: one element per legend row so TalkBack announces "기저귀/위생, 34%,
            // 340,000원" instead of three disconnected fragments.
            <View
              accessible
              accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}
              key={`${slice.label}-${index}`}
              style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
            >
              <View
                style={{ backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length], borderRadius: 4, height: 8, width: 8 }}
              />
              <Text style={[textStyles.caption, { color: theme.colors.gray600, flex: 1 }]}>{slice.label}</Text>
              <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{formatKrw(slice.amountKrw)}</Text>
              <Text style={[textStyles.caption, { color: theme.colors.brown, fontWeight: "700", minWidth: 34, textAlign: "right" }]}>
                {slice.percentLabel}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    );
  }

  const legendItems = reportCategoryLegend.map(([label, percent]) => ({ label, percent }));
  const arcColors = [donutSegmentPalette[0], donutSegmentPalette[2], donutSegmentPalette[3], donutSegmentPalette[4]];

  return (
    <Card style={{ flexDirection: "row", gap: 14 }}>
      {/* A11Y-117: the border-trick arc is decorative -- the legend rows beside it carry the
          same data as text, so the arc is hidden from TalkBack/VoiceOver. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: "center", height: 96, justifyContent: "center", width: 96 }}
      >
        <View
          style={{
            borderBottomColor: arcColors[2],
            borderColor: arcColors[0],
            borderLeftColor: arcColors[3],
            borderRadius: 48,
            borderRightColor: arcColors[1],
            borderWidth: 16,
            height: 96,
            transform: [{ rotate: "-22deg" }],
            width: 96
          }}
        />
        <View style={{ backgroundColor: theme.colors.white, borderRadius: 28, height: 56, position: "absolute", width: 56 }} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
        {legendItems.map((item, index) => (
          <View key={`${item.label}-${index}`} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <View style={{ backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length], borderRadius: 4, height: 8, width: 8 }} />
            <Text style={[textStyles.caption, { color: theme.colors.gray600, flex: 1 }]}>{item.label}</Text>
            <Text style={[textStyles.caption, { color: theme.colors.gray600, fontWeight: "700" }]}>{item.percent}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function EmptyStateCard({ title, actionLabel, onPress }: { title: string; actionLabel: string; onPress?: () => void }) {
  return (
    <Card style={{ alignItems: "center", backgroundColor: theme.colors.beige }}>
      <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700", textAlign: "center" }]}>{title}</Text>
      <SecondaryButton label={actionLabel} onPress={onPress} />
    </Card>
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const isError = tone === "error";
  // A11Y-115: every Toast (저장 성공/실패, CSV 내보내기, 오프라인 저장 등) announces its message
  // when shown or when the message changes -- the live region backs this up on Android when the
  // subtree re-renders in place.
  useEffect(() => {
    announceForA11y(message);
  }, [message]);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: theme.colors.white, borderRadius: 18, flexDirection: "row", gap: 10, padding: 14, ...theme.shadows.card }}
    >
      <Text accessible={false} style={{ color: isError ? theme.colors.danger : theme.colors.success }}>{isError ? "⚠" : "✓"}</Text>
      <Text style={[textStyles.body2, { color: theme.colors.brown }]}>{message}</Text>
    </View>
  );
}

export function AffiliateDisclosure({ text }: { text?: string }) {
  return (
    <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>
      {text ?? "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."}
    </Text>
  );
}

const textStyles = {
  h2: theme.typography.headline2 as TextStyle,
  h3: theme.typography.headline3 as TextStyle,
  body1: theme.typography.body1 as TextStyle,
  body2: theme.typography.body2 as TextStyle,
  caption: theme.typography.caption as TextStyle
};
