import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AccessibilityInfo, Animated, Image, StatusBar, Text, View } from "react-native";
import { AppScreen } from "../src/ui";
import { theme } from "../src/theme";
import { SplashPixelStyles } from "../src/pixelLock/styles";
import { isPixelLockBuild } from "../src/pixelLock/build-profile";
import { pixelEvidenceId } from "../src/api/fixture-runtime";
import { useSessionStore } from "../src/stores/session.store";

const splashScreenId = pixelEvidenceId("SPL-001 SPL-001");
const introHoldMs = 300;
const stageHoldMs = 320;
const finalHoldMs = 350;
const stageTransitionMs = 180;
const splashLogo = require("../assets/splash-mark.png");
const intro = { label: "intro", source: require("../assets/illustrations/family.png") };
const stageImageStyle = { height: 248, width: 248 };
const animationStages = [
  { label: "태아", source: require("../assets/illustrations/growth_fetus.png") },
  { label: "아기", source: require("../assets/illustrations/growth_baby.png") },
  { label: "유아", source: require("../assets/illustrations/growth_toddler.png") },
  { label: "초등학생", source: require("../assets/illustrations/growth_elementary.png") },
  { label: "중학생", source: require("../assets/illustrations/growth_middle.png") },
  { label: "고등학생", source: require("../assets/illustrations/growth_high.png") }
];

function introImageStyle() {
  return {
    height: SplashPixelStyles.introImageHeight,
    marginTop: SplashPixelStyles.introImageMarginTop,
    width: 390
  } as const;
}

function splashPixelFrameStyle() {
  return {
    transform: [{ translateY: SplashPixelStyles.topOffset }, { scale: SplashPixelStyles.groupScale }]
  } as const;
}

export default function LaunchAnimationScreen() {
  const params = useLocalSearchParams<{ pixelLock?: string }>();
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const [stageIndex, setStageIndex] = useState(-1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const pixelLockBuild = isPixelLockBuild();
  const isPixelLockMode = pixelLockBuild && String(params.pixelLock ?? "") === "1";
  const isLoginlessTestMode = pixelLockBuild && String(params.pixelLock ?? "") !== "1";
  const currentStage = stageIndex < 0 ? intro : animationStages[stageIndex];
  const isFinalStage = stageIndex === animationStages.length - 1;
  const pagerDots = stageIndex < 0 ? ["intro", "record", "report"] : animationStages.map((stage) => stage.label);
  const activeDotIndex = stageIndex < 0 ? 0 : stageIndex;

  useEffect(() => {
    let mounted = true;
    const skipDecorativeMotion = () => {
      if (!mounted || isPixelLockMode) return;
      setReduceMotion(true);
      setStageIndex(animationStages.length - 1);
    };
    void Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      AccessibilityInfo.isScreenReaderEnabled()
    ]).then(([reduceMotion, screenReader]) => {
      if (reduceMotion || screenReader) skipDecorativeMotion();
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (enabled) skipDecorativeMotion();
      }
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [isPixelLockMode]);

  useEffect(() => {
    if (isPixelLockMode || reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }

    opacity.setValue(0);
    scale.setValue(0.94);

    Animated.parallel([
      Animated.timing(opacity, {
        duration: stageTransitionMs,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        friction: 7,
        tension: 65,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();
  }, [isPixelLockMode, opacity, reduceMotion, scale, stageIndex]);

  useEffect(() => {
    if (isPixelLockMode) return;

    const timer = setTimeout(() => {
      if (isFinalStage) {
        router.replace("/login");
      } else if (stageIndex < 0) {
        setStageIndex(0);
      } else {
        setStageIndex((value) => value + 1);
      }
    }, stageIndex < 0 ? introHoldMs : isFinalStage ? finalHoldMs : stageHoldMs);

    return () => clearTimeout(timer);
  }, [isFinalStage, isPixelLockMode, stageIndex]);

  if (isTestSession && !isPixelLockMode) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoginlessTestMode) {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  return (
    <AppScreen>
      {isPixelLockMode ? (
        <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" translucent={false} />
      ) : null}
      <View style={[{ alignItems: "center", flex: 1, gap: SplashPixelStyles.logoGap, justifyContent: "flex-start", paddingTop: 112 }, splashPixelFrameStyle()]}>
        <View
          style={{
            alignItems: "center",
            borderRadius: 22,
            height: SplashPixelStyles.logoSize + 8,
            justifyContent: "center",
            overflow: "hidden",
            width: SplashPixelStyles.logoSize + 8
          }}
        >
          <Image
            accessibilityLabel={splashScreenId}
            source={splashLogo}
            style={{ height: SplashPixelStyles.logoSize + 40, width: SplashPixelStyles.logoSize + 40 }}
            resizeMode="cover"
          />
        </View>
        <Text style={{ color: theme.colors.mainCoral, fontSize: SplashPixelStyles.titleFontSize, fontWeight: "800" }}>우리아이</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: SplashPixelStyles.taglineFontSize, lineHeight: SplashPixelStyles.taglineLineHeight, maxWidth: SplashPixelStyles.taglineMaxWidth, textAlign: "center" }}>
          아이의 모든 순간, 우리가 함께 기록하고 응원할게요.
        </Text>

        <Animated.View
          key={currentStage.label}
          style={{
            alignItems: "center",
            backgroundColor: stageIndex >= 0 ? theme.colors.presentation.splashStageSurface : "transparent",
            borderColor: stageIndex >= 0 ? theme.colors.primary100 : "transparent",
            borderRadius: stageIndex >= 0 ? 32 : 0,
            borderWidth: stageIndex >= 0 ? 1 : 0,
            justifyContent: "center",
            minHeight: stageIndex >= 0 ? 264 : undefined,
            minWidth: stageIndex >= 0 ? 264 : undefined,
            opacity,
            transform: [{ scale }]
          }}
        >
          <Image
            accessibilityLabel={stageIndex < 0 ? "우리아이 가족 소개 이미지" : `${currentStage.label} 성장 단계 이미지`}
            source={currentStage.source}
            style={stageIndex < 0 ? introImageStyle() : stageImageStyle}
            resizeMode="contain"
          />
        </Animated.View>
        {stageIndex >= 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}
          >
            {currentStage.label}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: SplashPixelStyles.pagerGap }}>
          {pagerDots.map((stage, index) => (
            <View
              key={stage}
              style={{
                backgroundColor: index === activeDotIndex ? theme.colors.mainCoral : theme.colors.primary100,
                borderRadius: 999,
                height: 5,
                width: index === activeDotIndex ? 16 : 5
              }}
            />
          ))}
        </View>
      </View>
    </AppScreen>
  );
}
