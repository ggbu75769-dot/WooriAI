import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AccessibilityInfo, Animated, Image, Text, useWindowDimensions, View } from "react-native";
import { AppScreen, PrimaryButton, TextButton } from "../src/ui";
import { theme } from "../src/theme";
import { SplashPixelStyles } from "../src/pixelLock/styles";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

const splashScreenId = "pixel-screen-SPL-001 SPL-001";

/**
 * DSN-053 P1 §8 — 타이밍을 승인 캡처(c20deeb `app/launch-animation.tsx`)의 값으로 되돌린다.
 * 인트로 3.6초 + 단계 0.52초는 그 뒤에 붙은 값이고, 첫 실행에서 6초 가까이 로고 화면에
 * 붙잡혀 있게 만들던 원인이다.
 */
const introHoldMs = 300;
const stageHoldMs = 320;
/**
 * c20deeb의 마지막 단계 홀드. 원본은 이 시간이 지나면 스스로 /login으로 넘어갔지만, 이 트리는
 * 마지막 단계에서 "시작하기" 버튼을 띄우고 **사용자가 누를 때까지 기다린다**(A11Y-117로 들어온
 * 동작이다 — 자동 이동은 화면을 읽는 중에 사라지는 문제가 있다). 그래서 여기서는 마지막 단계의
 * 자동 전환 타이머를 걸지 않고, 값만 캡처의 타이밍표대로 남겨 둔다.
 */
const finalHoldMs = 350;
const stageTransitionMs = 180;

const splashLogo = require("../assets/splash-mark.png");
// 픽셀 락 캡처 전용 마크. 기준 이미지가 이 파일로 굳어 있어 캡처 경로만 이쪽을 쓴다.
const pixelSplashLogo = require("../assets/pixel-splash-mark.png");
const intro = { label: "intro", source: require("../assets/illustrations/family.png") };
const stageImageStyle = { height: 248, width: 248 };
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

/** 로고 컨테이너와 그 안의 마크(c20deeb: 컨테이너 logoSize+8 = 72, 이미지 logoSize+40 = 104). */
const splashLogoFrameSize = SplashPixelStyles.logoSize + 8;
const splashLogoImageSize = SplashPixelStyles.logoSize + 40;

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
  const scale = useRef(new Animated.Value(0.94)).current;
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

    // 마지막 단계는 "시작하기"를 기다리므로 전환 타이머를 걸지 않는다(위 finalHoldMs 주석).
    if (isFinalStage) return;

    const timer = setTimeout(() => {
      if (stageIndex < 0) {
        setStageIndex(0);
      } else {
        setStageIndex((value) => value + 1);
      }
    }, stageIndex < 0 ? introHoldMs : stageHoldMs);

    return () => clearTimeout(timer);
  }, [isFinalStage, isPixelLockMode, opacity, reduceMotionEnabled, scale, stageIndex]);

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
        {/* 승인 캡처의 로고는 둥근 컨테이너(radius 22 · 72dp) 안에 마크를 104dp로 담고
            contain으로 맞춘다 -- 정사각 박스에 cover로 채워 좌우를 자르던 예전 렌더가 아니다.
            캡처 경로만 pixel-splash-mark를 쓴다(기준 이미지가 그 파일로 굳어 있다). */}
        <View
          style={{
            alignItems: "center",
            borderRadius: 22,
            height: splashLogoFrameSize,
            justifyContent: "center",
            overflow: "hidden",
            width: splashLogoFrameSize
          }}
        >
          <Image
            testID={splashScreenId}
            source={isPixelLockMode ? pixelSplashLogo : splashLogo}
            style={{ height: splashLogoImageSize, width: splashLogoImageSize }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ color: isPixelLockMode ? theme.colors.mainCoral : theme.colors.brandNavy, fontSize: SplashPixelStyles.titleFontSize, fontWeight: "800" }}>우리아이</Text>
        {/* 태그라인은 캡처에서 두 줄로 굳어 있다. 한 줄로 넘겨 기기 폭에 따라 끊기는 자리가
            달라지면 같은 화면이 기기마다 다른 문장 배열로 읽힌다. */}
        <View style={{ alignItems: "center", maxWidth: SplashPixelStyles.taglineMaxWidth }}>
          <Text style={{ color: theme.colors.gray600, fontSize: SplashPixelStyles.taglineFontSize, lineHeight: SplashPixelStyles.taglineLineHeight, textAlign: "center" }}>아이의 모든 순간,</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: SplashPixelStyles.taglineFontSize, lineHeight: SplashPixelStyles.taglineLineHeight, textAlign: "center" }}>우리가 함께 기록하고 응원할게요.</Text>
        </View>

        {/* 성장 단계는 크림색 프레임(#FFF9F4 · radius 32 · 264dp) 안에 248dp 이미지로 앉는다.
            인트로(stageIndex < 0)는 프레임 없이 반응형 박스 그대로 -- 라운드 49의 실기기 잘림
            수정이 여기 걸려 있다. */}
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
                backgroundColor: index === activeDotIndex ? (isPixelLockMode ? theme.colors.mainCoral : theme.colors.brandNavy) : theme.colors.primary100,
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
        {/* A11Y-117: 건너뛰기 상시 노출 -- 인트로 홀드 동안에도 애니메이션을 기다리지
            않고 바로 빠져나갈 수 있어야 한다(마지막 stage에서는 시작하기가 대신 노출). */}
        {!isFinalStage ? <TextButton label="건너뛰기" onPress={finish} style={{ alignItems: "center" }} /> : null}
      </View>
    </AppScreen>
  );
}
