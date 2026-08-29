import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import type { ChildStageMode } from "@wooriai/domain";
import { OnboardingStepProgress, useOnboardingStepAnalytics } from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { AppScreen, Card, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

/**
 * 라운드 70 트랙 E(GAP-070 #5 · 선행 확인 6): 타일 안의 이모지 셋(🤰👶🧸)을 **탭바·알림함·
 * 가져오기와 같은 Ionicons outline 한 벌**로 바꿨다.
 *
 * 근거는 라운드 49 실기기 피드백 ②가 세 자리에 이미 적어 둔 그것이다 — 글리프/이모지는 기기
 * 폰트에 따라 굵기·크기·색이 제각각으로 떨어지고(가져오기에서는 🍴 하나만 컬러로 튀었다),
 * 무엇보다 **소리로는 "임신부" 같은 이모지 이름이 제목보다 먼저 읽힌다**. 그래서 아이콘은
 * 장식으로 내리고(`accessible={false}`) 카드가 제목·설명을 라벨로 진다.
 *
 * 이 화면은 승인 캡처 아홉에 **없다**(온보딩은 픽셀락 목록 밖 — 선행 확인 6). 그래도 바뀌는
 * 것은 48×48 tint 타일 **안의 노드 하나**뿐이다: tint 색·간격·문구·순서·카드 레이아웃 무변경.
 * 색은 알림함이 쓴 "한 가지 색" 관례를 따라 제목과 같은 brown 하나다(세 tint 전부 아주 밝은
 * 파스텔이라 대비가 남는다).
 *
 * 이름은 카드가 말하는 사실에서 왔다: 임신=예정일 달력 · 출생=아이 · 직접 선택=고르는 컨트롤.
 * 값은 `keyof typeof Ionicons.glyphMap`으로 잠겨 있어 없는 글리프는 typecheck에서 걸린다.
 */
const stageOptions: Array<{
  mode: ChildStageMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tint: string;
}> = [
  {
    mode: "pregnant",
    icon: "calendar-outline",
    title: "임신 중이에요",
    description: "출산 예정일에 맞춰 준비를 도와드릴게요.",
    tint: theme.colors.peach
  },
  {
    mode: "born",
    icon: "happy-outline",
    title: "아이가 태어났어요",
    description: "우리 아이 성장 단계에 맞는 정보를 보여드릴게요.",
    tint: theme.colors.mint
  },
  {
    mode: "manual",
    icon: "options-outline",
    title: "단계를 직접 선택할게요",
    description: "지금 상황에 맞는 단계를 나중에 골라주세요.",
    tint: theme.colors.sky
  }
];

export default function ChildStatusScreen() {
  const updateChildDraft = useOnboardingProgressStore((state) => state.updateChildDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const [selectedMode, setSelectedMode] = useState<ChildStageMode | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // 라운드 60 #9: 단계 진입 계측(onboarding_step_viewed). 동의 OFF면 완전한 no-op이다.
  useOnboardingStepAnalytics("ONB-001");

  // ONB-105: isNavigating guards against double-taps while pushing to the next screen, but it
  // used to stay true forever -- coming back from ONB-002 left every option disabled with no way
  // to recover. Re-enable the choices whenever this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, [])
  );

  function choose(stageMode: ChildStageMode) {
    if (isNavigating) return;
    setSelectedMode(stageMode);
    setIsNavigating(true);
    updateChildDraft({ stageMode });
    completeStep("ONB-001");
    router.push("/onboarding/child-profile");
  }

  return (
    <AppScreen>
      <View testID="screen-ONB-001" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-001" />
        <ScreenHeader
          eyebrow="아이 정보 시작하기"
          title="지금 상황을 알려주세요"
          subtitle="선택한 내용에 맞춰 다음 안내를 준비할게요."
        />

        <View style={{ gap: theme.spacing.gap }}>
          {stageOptions.map((option) => {
            const selected = selectedMode === option.mode;
            return (
              <Pressable
                key={option.mode}
                // 라운드 70 트랙 E: 카드는 `accessible` 한 덩어리로 읽히는데 라벨이 없어
                // 자식 노드가 순서대로 낭독됐다 — 타일이 먼저라 이모지 이름("임신부")이
                // 제목보다 앞섰다. 눈이 읽는 두 값(제목 · 설명)을 그대로 이어 라벨로 세운다
                // (문장은 여기서 새로 짓지 않는다 — 카드가 그리는 값 그대로다).
                accessibilityLabel={`${option.title}. ${option.description}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isNavigating}
                onPress={() => choose(option.mode)}
              >
                <Card
                  style={[
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: theme.spacing.gap,
                      opacity: isNavigating && !selected ? 0.5 : 1
                    },
                    selected ? { borderColor: theme.colors.mainCoral, borderWidth: 2 } : null
                  ]}
                >
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: option.tint,
                      borderRadius: theme.radii.small,
                      height: 48,
                      justifyContent: "center",
                      width: 48
                    }}
                  >
                    <Ionicons accessible={false} color={theme.colors.brown} name={option.icon} size={22} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                      {option.title}
                    </Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                      {option.description}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
  );
}
