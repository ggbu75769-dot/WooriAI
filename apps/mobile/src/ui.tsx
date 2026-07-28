import { MaterialCommunityIcons } from "@expo/vector-icons";
import type React from "react";
import type { ComponentProps } from "react";
import { useState } from "react";
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from "react-native";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { lineChartSegmentsFor, normalizeLineChartPoints } from "./lineChartMath";
import { theme } from "./theme";
import { EmptyState as DesignEmptyState, ErrorState, LoadingState, ScreenScaffold } from "./design-system";
import { isPixelLockBuild } from "./pixelLock/build-profile";

type ChildrenProps = {
  children: React.ReactNode;
};

type PressableProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function AppIcon({
  name,
  size = 24,
  color = theme.colors.brown
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no"
      name={name}
      size={size}
    />
  );
}

export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
  selected = false
}: {
  accessibilityLabel: string;
  icon: AppIconName;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? theme.colors.coral[50] : "transparent",
        borderRadius: 22,
        height: theme.touchTarget,
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
        width: theme.touchTarget
      })}
    >
      <AppIcon color={selected ? theme.colors.coral[600] : theme.colors.brown} name={icon} />
    </Pressable>
  );
}

export function SampleDataBanner() {
  return (
    <View
      accessibilityLabel="샘플 데이터 안내"
      style={{
        alignItems: "center",
        alignSelf: "stretch",
        backgroundColor: theme.colors.sky,
        borderRadius: theme.radii.small,
        flexDirection: "row",
        gap: 8,
        minHeight: theme.touchTarget,
        paddingHorizontal: 12
      }}
    >
      <AppIcon color={theme.colors.semantic.info} name="flask-outline" size={18} />
      <Text style={[textStyles.caption, { color: theme.colors.brown, flex: 1, fontWeight: "700" }]}>
        샘플 데이터 · 실제 계정 정보와 분리되어 이 기기에만 저장돼요.
      </Text>
    </View>
  );
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

export function AppScreen({ children }: ChildrenProps) {
  if (!isPixelLockBuild()) {
    return <ScreenScaffold>{children}</ScreenScaffold>;
  }
  ensurePixelLockWebStyles();

  return (
    <ScrollView
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
        {eyebrow ? <Text style={[textStyles.caption, { color: theme.colors.mainCoral }]}>{eyebrow}</Text> : null}
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
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        resizeMode="contain"
        source={require("../assets/illustrations/logo_mark.png")}
        style={{ height: Math.round(size * 0.78), width: Math.round(size * 0.78) }}
      />
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

export function PrimaryButton({ label, onPress, disabled, style }: PressableProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: disabled ? theme.colors.gray300 : theme.colors.mainCoral,
          borderRadius: theme.radii.button,
          minHeight: theme.ctaHeight,
          justifyContent: "center",
          opacity: pressed ? 0.86 : 1,
          paddingHorizontal: 16,
          paddingVertical: 10
        },
        style
      ]}
    >
      <Text style={{ color: theme.colors.white, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, style }: PressableProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
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

export function TextButton({ label, onPress, disabled, style }: PressableProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[{ minHeight: theme.touchTarget, justifyContent: "center" }, style]}
    >
      <Text style={{ color: disabled ? theme.colors.gray300 : theme.colors.mainCoral, fontWeight: "700" }}>{label}</Text>
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

export function DateField({ value }: { value: string }) {
  return <InputField label="날짜" value={value} />;
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
    <View style={{ backgroundColor: theme.colors.presentation.segmentedTrack, borderRadius: theme.radii.pill, flexDirection: "row", padding: 4 }}>
      {options.map((option) => (
        <Pressable
          key={option}
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
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={5}
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
  const background = tone === "success" ? theme.colors.mint : tone === "warning" ? theme.colors.peach : theme.colors.beige;
  const color = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.mainCoral : theme.colors.brown;

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
  progress?: number | null;
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
        {progress == null ? null : (
          <Text style={[textStyles.caption, { color: theme.colors.white, fontWeight: "700" }]}>{progress}%</Text>
        )}
      </View>
      {progress == null ? null : <BudgetProgressBar value={progress} />}
    </View>
  );
}

export function QuickActionIconButton({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flex: 1, gap: 6, minHeight: 68 }}>
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

export function FloatingActionButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
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
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 12 }}>
        {icon ? (
          typeof icon === "string" ? (
            <Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>{icon}</Text>
          ) : (
            <View style={{ alignItems: "center", justifyContent: "center", minWidth: 24 }}>{icon}</View>
          )
        ) : null}
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
  icon = "baby-face-outline",
  iconBackgroundColor = theme.colors.coral[50],
  iconColor = theme.colors.coral[700],
  caption,
  onPress
}: {
  title: string;
  price: string;
  badge?: string;
  image?: ImageSourcePropType;
  icon?: AppIconName;
  iconBackgroundColor?: string;
  iconColor?: string;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ borderRadius: 18, flexDirection: "row", gap: 10, padding: 12 }}>
        <View style={{ backgroundColor: image ? theme.colors.beige : iconBackgroundColor, borderRadius: 14, height: 64, overflow: "hidden", width: 64 }}>
          {image ? (
            <Image source={image} style={{ height: "100%", width: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <AppIcon color={iconColor} name={icon} size={28} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          {badge ? <StatusBadge label={badge} tone="warning" /> : null}
          <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          <Text style={[textStyles.body2, { color: theme.colors.mainCoral, fontWeight: "800" }]}>{price}</Text>
          {caption ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{caption}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function ProductComparisonRow({ seller, price, onPress, primaryAction = false }: { seller: string; price: string; onPress?: () => void; primaryAction?: boolean }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{seller}</Text>
        <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>무료배송</Text>
      </View>
      <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "800" }]}>{price}</Text>
      {primaryAction ? (
        <PrimaryButton label="구매하기" onPress={onPress} style={{ backgroundColor: theme.colors.coral[400], minWidth: 72 }} />
      ) : (
        <SecondaryButton label="구매" onPress={onPress} style={{ minWidth: 62 }} />
      )}
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

export function UploadFileCard({ fileName, total }: { fileName: string; total: string }) {
  return (
    <Card style={{ backgroundColor: theme.colors.mint }}>
      <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{fileName}</Text>
      <Text style={[textStyles.body2, { color: theme.colors.gray600 }]}>업로드 완료 · {total}</Text>
    </Card>
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
        <View style={{ flexDirection: "row", gap: 5 }}>
          <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>지난 달 대비</Text>
          <Text style={[textStyles.caption, { color: theme.colors.mainCoral, fontWeight: "800" }]}>{deltaText}</Text>
        </View>
      ) : null}
      <View
        onLayout={hasRealData ? (event) => setMeasuredWidth(event.nativeEvent.layout.width) : undefined}
        style={{ backgroundColor: theme.colors.presentation.chartPlot, borderRadius: 14, height: 104, marginTop: 2, overflow: "hidden" }}
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

export function DonutChartCard({
  title,
  segments
}: {
  title: string;
  segments?: Array<{ label: string; amountKrw: number }>;
}) {
  const legendItems = segments
    ? (() => {
        const total = segments.reduce((sum, segment) => sum + segment.amountKrw, 0);
        return segments.map((segment) => ({
          label: segment.label,
          percent: total > 0 ? `${Math.round((segment.amountKrw / total) * 100)}%` : "0%"
        }));
      })()
    : reportCategoryLegend.map(([label, percent]) => ({ label, percent }));

  // The arc is drawn with a border-quadrant trick (no SVG/conic-gradient dependency available
  // in this app), which can only express four fixed 90° wedges rather than an arbitrary
  // proportional sweep. When real segments are supplied, map the legend's own colors onto
  // those four wedges (merging down when there are fewer than four categories) so the arc's
  // visible slice count and colors always match the legend beside it, instead of always
  // showing the same four decorative colors regardless of the real data.
  const arcColors = segments
    ? (() => {
        const colors = segments.map((_, index) => donutSegmentPalette[index % donutSegmentPalette.length]);
        if (colors.length <= 1) {
          const only = colors[0] ?? donutSegmentPalette[0];
          return [only, only, only, only];
        }
        if (colors.length === 2) return [colors[0], colors[0], colors[1], colors[1]];
        if (colors.length === 3) return [colors[0], colors[1], colors[2], colors[2]];
        return [colors[0], colors[1], colors[2], colors[3]];
      })()
    : [donutSegmentPalette[0], donutSegmentPalette[2], donutSegmentPalette[3], donutSegmentPalette[4]];

  return (
    <Card style={{ flexDirection: "row", gap: 14 }}>
      <View style={{ alignItems: "center", height: 96, justifyContent: "center", width: 96 }}>
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

export function EmptyStateCard({ title, description, actionLabel, onPress }: { title: string; description?: string; actionLabel: string; onPress?: () => void }) {
  if (!isPixelLockBuild()) {
    if (/불러오고|분석 중|저장하는 중/.test(title)) {
      return <LoadingState title={title} />;
    }
    if (/못했|실패|오류/.test(title)) {
      return <ErrorState actionLabel={onPress ? actionLabel : undefined} onAction={onPress} title={title} />;
    }
    return <DesignEmptyState actionLabel={onPress ? actionLabel : undefined} description={description} icon="inbox-outline" onAction={onPress} title={title} />;
  }
  return (
    <Card style={{ alignItems: "center", backgroundColor: theme.colors.beige }}>
      <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700", textAlign: "center" }]}>{title}</Text>
      {description ? <Text style={[textStyles.body2, { color: theme.colors.gray600, textAlign: "center" }]}>{description}</Text> : null}
      <SecondaryButton label={actionLabel} onPress={onPress} />
    </Card>
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const isError = tone === "error";
  return (
    <View style={{ backgroundColor: theme.colors.white, borderRadius: 18, flexDirection: "row", gap: 10, padding: 14, ...theme.shadows.card }}>
      <AppIcon
        color={isError ? theme.colors.danger : theme.colors.success}
        name={isError ? "alert-circle-outline" : "check-circle-outline"}
        size={20}
      />
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
