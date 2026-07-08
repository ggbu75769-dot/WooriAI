import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { upsertBudget } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

export default function BudgetScreen() {
  const [amountText, setAmountText] = useState("500000");
  const accessToken = useSessionStore((state) => state.accessToken);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);

  async function save() {
    const amountKrw = Number(amountText);
    if (!accessToken || !selectedChildId || !Number.isInteger(amountKrw) || amountKrw <= 0) return;
    await upsertBudget(accessToken, selectedChildId, amountKrw);
    completeStep("ONB-004");
    markHomeReached();
    router.replace("/(tabs)");
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>월 예산</Text>
      <Text>ONB-004</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setAmountText}
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={amountText}
      />
      <Pressable
        onPress={save}
        style={{ backgroundColor: theme.colors.primary500, borderRadius: 8, padding: 16 }}
      >
        <Text>홈으로 가기</Text>
      </Pressable>
    </View>
  );
}
