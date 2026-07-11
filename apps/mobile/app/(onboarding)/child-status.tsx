import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { ChildStageMode } from "@wooriai/domain";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { AppScreen, Card, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

const onboardingChildStatusScreenId = "ONB-001";

const stageOptions: Array<{
  mode: ChildStageMode;
  icon: string;
  title: string;
  description: string;
  tint: string;
}> = [
  {
    mode: "pregnant",
    icon: "🤰",
    title: "임신 중이에요",
    description: "출산 예정일에 맞춰 준비를 도와드릴게요.",
    tint: theme.colors.peach
  },
  {
    mode: "born",
    icon: "👶",
    title: "아이가 태어났어요",
    description: "우리 아이 성장 단계에 맞는 정보를 보여드릴게요.",
    tint: theme.colors.mint
  },
  {
    mode: "manual",
    icon: "🧸",
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
      <View accessibilityLabel={onboardingChildStatusScreenId} testID="screen-ONB-001" style={{ gap: theme.spacing.section }}>
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
                    <Text style={{ fontSize: 22 }}>{option.icon}</Text>
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
