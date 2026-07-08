import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Animated, Image, Text, View } from "react-native";
import { AppScreen, PrimaryButton, TextButton } from "../src/ui";
import { theme } from "../src/theme";

const splashScreenId = "SPL-001";
const introHoldMs = 3600;
const splashLogo = require("../assets/illustrations/logo_mark.png");
const intro = { label: "intro", source: require("../assets/illustrations/family.png") };
const introImageStyle = { height: 320, marginTop: 72, width: 390 };
const stageImageStyle = { height: 210, width: 210 };
const splashPixelScale = 1.27;
const splashPixelVerticalOffset = -22;
const splashPixelFrameStyle = {
  transform: [{ translateY: splashPixelVerticalOffset }, { scale: splashPixelScale }]
} as const;
const animationStages = [
  { label: "로고", source: require("../assets/illustrations/growth_logo.png") },
  { label: "태아", source: require("../assets/illustrations/growth_fetus.png") },
  { label: "아기", source: require("../assets/illustrations/growth_baby.png") },
  { label: "유아", source: require("../assets/illustrations/growth_toddler.png") },
  { label: "초등학생", source: require("../assets/illustrations/growth_elementary.png") },
  { label: "중학생", source: require("../assets/illustrations/growth_middle.png") },
  { label: "고등학생", source: require("../assets/illustrations/growth_high.png") }
];

export default function LaunchAnimationScreen() {
  const [stageIndex, setStageIndex] = useState(-1);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const currentStage = stageIndex < 0 ? intro : animationStages[stageIndex];
  const isFinalStage = stageIndex === animationStages.length - 1;
  const pagerDots = stageIndex < 0 ? ["intro", "record", "report"] : animationStages.map((stage) => stage.label);
  const activeDotIndex = stageIndex < 0 ? 0 : stageIndex;

  useEffect(() => {
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
  }, [opacity, scale, stageIndex]);

  const finish = () => router.replace("/login");

  return (
    <AppScreen>
      <View style={[{ alignItems: "center", flex: 1, gap: 10, justifyContent: "flex-start", paddingTop: 112 }, splashPixelFrameStyle]}>
        <Image
          accessibilityLabel={splashScreenId}
          source={splashLogo}
          style={{ height: 64, width: 64 }}
          resizeMode="cover"
        />
        <Text style={{ color: theme.colors.mainCoral, fontSize: 25, fontWeight: "800" }}>우리아이</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: 14, lineHeight: 21, maxWidth: 230, textAlign: "center" }}>
          아이의 모든 순간, 우리가 함께 기록하고 응원할게요.
        </Text>

        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Image
            source={currentStage.source}
            style={stageIndex < 0 ? introImageStyle : stageImageStyle}
            resizeMode="contain"
          />
        </Animated.View>
        {stageIndex >= 0 ? (
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{currentStage.label}</Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 6 }}>
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
