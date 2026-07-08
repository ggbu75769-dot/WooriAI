import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Animated, Image, Text, View } from "react-native";
import { AppScreen, PrimaryButton, TextButton } from "../src/ui";
import { theme } from "../src/theme";
import { SplashPixelStyles } from "../src/pixelLock/styles";

declare const __DEV__: boolean;

const splashScreenId = "pixel-screen-SPL-001 SPL-001";
const introHoldMs = 3600;
const splashLogo = require("../assets/illustrations/logo_mark.png");
const intro = { label: "intro", source: require("../assets/illustrations/family.png") };
const stageImageStyle = { height: 210, width: 210 };
const animationStages = [
  { label: "로고", source: require("../assets/illustrations/growth_logo.png") },
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
  const [stageIndex, setStageIndex] = useState(-1);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const isPixelLockMode = (__DEV__ || process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") && String(params.pixelLock ?? "") === "1";
  const currentStage = stageIndex < 0 ? intro : animationStages[stageIndex];
  const isFinalStage = stageIndex === animationStages.length - 1;
  const pagerDots = stageIndex < 0 ? ["intro", "record", "report"] : animationStages.map((stage) => stage.label);
  const activeDotIndex = stageIndex < 0 ? 0 : stageIndex;

  useEffect(() => {
    if (isPixelLockMode) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }

    opacity.setValue(0);
    scale.setValue(0.88);

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 420,
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

    const timer = setTimeout(() => {
      if (stageIndex < 0) {
        setStageIndex(0);
      } else if (stageIndex < animationStages.length - 1) {
        setStageIndex((value) => value + 1);
      }
    }, stageIndex < 0 ? introHoldMs : 520);

    return () => clearTimeout(timer);
  }, [isPixelLockMode, opacity, scale, stageIndex]);

  const finish = () => router.replace("/login");

  return (
    <AppScreen>
      <View style={[{ alignItems: "center", flex: 1, gap: SplashPixelStyles.logoGap, justifyContent: "flex-start", paddingTop: 112 }, splashPixelFrameStyle()]}>
        <Image
          accessibilityLabel={splashScreenId}
          source={splashLogo}
          style={{ height: SplashPixelStyles.logoSize, width: SplashPixelStyles.logoSize }}
          resizeMode="cover"
        />
        <Text style={{ color: theme.colors.mainCoral, fontSize: SplashPixelStyles.titleFontSize, fontWeight: "800" }}>우리아이</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: SplashPixelStyles.taglineFontSize, lineHeight: SplashPixelStyles.taglineLineHeight, maxWidth: SplashPixelStyles.taglineMaxWidth, textAlign: "center" }}>
          아이의 모든 순간, 우리가 함께 기록하고 응원할게요.
        </Text>

        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Image
            source={currentStage.source}
            style={stageIndex < 0 ? introImageStyle() : stageImageStyle}
            resizeMode="contain"
          />
        </Animated.View>
        {stageIndex >= 0 ? (
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{currentStage.label}</Text>
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

      <View style={{ gap: 10 }}>
        {isFinalStage ? <PrimaryButton label="시작하기" onPress={finish} /> : null}
        {stageIndex >= 0 && !isFinalStage ? <TextButton label="건너뛰기" onPress={finish} style={{ alignItems: "center" }} /> : null}
      </View>
    </AppScreen>
  );
}
