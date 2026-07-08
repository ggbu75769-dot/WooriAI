import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { setPreparedItems } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

const preparedIds = ["11111111-1111-4111-8111-111111111111"];

export default function PreparedItemsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);

  async function save() {
    if (!accessToken || !selectedChildId) return;
    await setPreparedItems(accessToken, selectedChildId, preparedIds);
    completeStep("ONB-003");
    router.push("/onboarding/budget");
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>이미 준비한 물건</Text>
      <Text>ONB-003</Text>
      <Text>[x] 카시트</Text>
      <Pressable
        onPress={save}
        style={{ backgroundColor: theme.colors.primary500, borderRadius: 8, padding: 16 }}
      >
        <Text>저장하고 계속</Text>
      </Pressable>
    </View>
  );
}
