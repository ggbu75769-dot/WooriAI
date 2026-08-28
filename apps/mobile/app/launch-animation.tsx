import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AccessibilityInfo, Animated, Image, Text, useWindowDimensions, View } from "react-native";
import { AppScreen, PrimaryButton, TextButton } from "../src/ui";
import { theme } from "../src/theme";
import { SplashPixelStyles } from "../src/pixelLock/styles";
import { useSessionStore } from "../src/stores/session.store";

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

/** family.png 원본 비율(390x421). 실기기에서는 이 비율로 폭에 맞춰 높이를 잡는다. */
const introImageAspectRatio = 390 / 421;
/** 픽셀 락 기준 박스의 폭 -- 반응형 경로에서는 "이보다 커지지 않는다"는 상한으로만 쓴다. */
const introImageMaxWidth = 390;
/** AppScreen(ScrollView)의 좌우 패딩 -- 실기기에서 이미지가 쓸 수 있는 폭을 계산할 때 뺀다. */
const splashHorizontalPadding = theme.spacing.screen * 2;
/** 인트로 이미지가 세로로도 화면을 밀어내지 않도록 하는 상한(화면 높이 비율). */
const introImageMaxHeightRatio = 0.42;
const splashContentPaddingTop = 24;

/**
 * SPL-001 픽셀 락 캡처(`?pixelLock=1`)는 기준 이미지와 픽셀 단위로 맞춘 **고정 박스**
 * (390x380 + SplashPixelStyles.introImageMarginTop)를 그대로 쓴다.
 *
 * 일반 실행은 그 고정 폭이 그대로 적용되던 것이 실기기(폭 390dp 미만)에서 첫 화면이
 * 잘려 보이던 원인이라, 화면 폭·높이에 맞춰 줄어드는 박스를 쓴다. 픽셀 락 값은 건드리지
 * 않으므로 캡처 결과는 예전과 동일하다.
 */
function introImageStyle(isPixelLockMode: boolean, windowWidth: number, windowHeight: number) {
  if (isPixelLockMode) {
    return {
      height: SplashPixelStyles.introImageHeight,
      marginTop: SplashPixelStyles.introImageMarginTop,
      width: 390
    };
  }

  const availableWidth = Math.max(0, windowWidth - splashHorizontalPadding);
  const heightCappedWidth = Math.max(0, windowHeight * introImageMaxHeightRatio) * introImageAspectRatio;
  const width = Math.min(introImageMaxWidth, availableWidth, heightCappedWidth);

  return {
    height: Math.round(width / introImageAspectRatio),
    marginTop: splashContentPaddingTop,
    width: Math.round(width)
  };
}

/**
 * 픽셀 락 전용 프레임 보정(위로 당기고 축소). 실기기에서는 이 변환이 화면 위쪽을 잘라
 * 먹으므로 픽셀 락 모드가 아니면 아무 것도 얹지 않는다 -- 상단 여백도 여기서 갈린다.
 */
function splashPixelFrameStyle(isPixelLockMode: boolean) {
  if (!isPixelLockMode) return null;
  return {
    paddingTop: 112,
    transform: [{ translateY: SplashPixelStyles.topOffset }, { scale: SplashPixelStyles.groupScale }]
  };
}

export default function LaunchAnimationScreen() {
  const params = useLocalSearchParams<{ pixelLock?: string }>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const [stageIndex, setStageIndex] = useState(-1);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const isPixelLockMode = (__DEV__ || process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") && String(params.pixelLock ?? "") === "1";
  const isLoginlessTestMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1" && String(params.pixelLock ?? "") !== "1";
  const currentStage = stageIndex < 0 ? intro : animationStages[stageIndex];
  const isFinalStage = stageIndex === animationStages.length - 1;
  const pagerDots = stageIndex < 0 ? ["intro", "record", "report"] : animationStages.map((stage) => stage.label);
  const activeDotIndex = stageIndex < 0 ? 0 : stageIndex;

  // A11Y-117: reduce-motion이 켜져 있으면 성장 애니메이션을 돌리지 않고 곧바로 마지막
  // stage(시작하기 버튼이 있는 화면)로 건너뛴다 -- src/ui/Skeleton.tsx의 선례와 같은
  // best-effort 조회(비네이티브 환경에서는 조용히 무시).
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (isMounted && enabled) {
          setReduceMotionEnabled(true);
          setStageIndex(animationStages.length - 1);
        }
      })
      .catch(() => {
        // AccessibilityInfo unavailable (web preview, vitest) -- keep the animated flow.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isPixelLockMode || reduceMotionEnabled) {
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
  }, [isPixelLockMode, opacity, reduceMotionEnabled, scale, stageIndex]);

  const finish = () => router.replace("/login");

  if (isTestSession && !isPixelLockMode) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoginlessTestMode) {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  return (
    <AppScreen>
      <View
        style={[
          {
            alignItems: "center",
            flex: 1,
            gap: SplashPixelStyles.logoGap,
            justifyContent: "flex-start",
            paddingTop: splashContentPaddingTop
          },
          splashPixelFrameStyle(isPixelLockMode)
        ]}
      >
        <Image
          testID={splashScreenId}
          source={splashLogo}
          style={{ height: SplashPixelStyles.logoSize, width: SplashPixelStyles.logoSize }}
          // logo_mark.png는 96x86이라 정사각 박스에서 cover면 좌우가 잘린다. 픽셀 락 기준
          // 이미지는 그 잘린 모습으로 굳어 있어 캡처 경로만 cover를 유지한다.
          resizeMode={isPixelLockMode ? "cover" : "contain"}
        />
        <Text style={{ color: theme.colors.mainCoral, fontSize: SplashPixelStyles.titleFontSize, fontWeight: "800" }}>우리아이</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: SplashPixelStyles.taglineFontSize, lineHeight: SplashPixelStyles.taglineLineHeight, maxWidth: SplashPixelStyles.taglineMaxWidth, textAlign: "center" }}>
          아이의 모든 순간, 우리가 함께 기록하고 응원할게요.
        </Text>

        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Image
            source={currentStage.source}
            style={stageIndex < 0 ? introImageStyle(isPixelLockMode, windowWidth, windowHeight) : stageImageStyle}
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
        {/* A11Y-117: 건너뛰기 상시 노출 -- 인트로 홀드(3.6초) 동안에도 애니메이션을 기다리지
            않고 바로 빠져나갈 수 있어야 한다(마지막 stage에서는 시작하기가 대신 노출). */}
        {!isFinalStage ? <TextButton label="건너뛰기" onPress={finish} style={{ alignItems: "center" }} /> : null}
      </View>
    </AppScreen>
  );
}
