import { useEffect, useRef, useState } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import { AccessibilityInfo, Animated, View } from "react-native";
import { theme } from "../theme";

export type SkeletonProps = {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Round 5A D6 skeleton primitive (docs/5차/round5a-design-spec.md §D0/§D6): replaces the old
 * "…불러오고 있어요 / 잠시만요" text-card loading state with a silhouette + gentle opacity pulse.
 *
 * Respects reduce-motion: if `AccessibilityInfo.isReduceMotionEnabled()` resolves true, the pulse
 * loop never starts and the skeleton renders at a fixed, non-animated opacity instead.
 */
export function Skeleton({ width, height, radius = theme.radii.small, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (isMounted) setReduceMotionEnabled(Boolean(enabled));
      })
      .catch(() => {
        // AccessibilityInfo can be unavailable in non-native test/preview environments -- fall
        // back to the animated pulse rather than failing the render.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      opacity.stopAnimation();
      opacity.setValue(0.75);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 700, toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 700, toValue: 0.55, useNativeDriver: true })
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotionEnabled]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: theme.colors.cream.surfaceAlt,
          borderRadius: radius,
          height,
          opacity,
          width
        },
        style
      ]}
    />
  );
}

/** Preset silhouette matching a ListRow: circular icon slot + title/subtitle lines + value box. */
export function SkeletonRow() {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minHeight: theme.touchTarget, paddingVertical: 8 }}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={14} radius={7} />
        <Skeleton width="40%" height={11} radius={6} />
      </View>
      <Skeleton width={56} height={16} radius={8} />
    </View>
  );
}

/** Preset silhouette matching a Card: label line + big value line + a thin bar (e.g. progress). */
export function SkeletonCard() {
  return (
    <View style={{ backgroundColor: theme.colors.cream.surface, borderRadius: theme.radii.card, gap: 10, padding: theme.spacing.card }}>
      <Skeleton width="40%" height={12} radius={6} />
      <Skeleton width="70%" height={24} radius={8} />
      <Skeleton width="100%" height={8} radius={4} />
    </View>
  );
}
