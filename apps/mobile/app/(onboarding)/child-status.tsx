import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { theme } from "../../src/theme";

export default function ChildStatusScreen() {
  const updateChildDraft = useOnboardingProgressStore((state) => state.updateChildDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);

  function choose(stageMode: "pregnant" | "born" | "manual") {
    updateChildDraft({ stageMode });
    completeStep("ONB-001");
    router.push("/onboarding/child-profile");
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>아이 상태를 선택해주세요</Text>
      <Text>ONB-001</Text>
      <Pressable onPress={() => choose("pregnant")}>
        <Text>임신 중이에요</Text>
      </Pressable>
      <Pressable onPress={() => choose("born")}>
        <Text>아이가 태어났어요</Text>
      </Pressable>
      <Pressable onPress={() => choose("manual")}>
        <Text>단계를 직접 선택할게요</Text>
      </Pressable>
    </View>
  );
}
