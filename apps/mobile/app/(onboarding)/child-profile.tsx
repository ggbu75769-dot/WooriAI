import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { createChild } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

export default function ChildProfileScreen() {
  const [nickname, setNickname] = useState("튼튼이");
  const session = useSessionStore();
  const draft = useOnboardingProgressStore((state) => state.childDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);

  async function save() {
    if (!session.accessToken || !session.defaultHouseholdId || !draft.stageMode) return;
    const child = await createChild(session.accessToken, {
      householdId: session.defaultHouseholdId,
      nickname,
      stageMode: draft.stageMode,
      dueDate: draft.stageMode === "pregnant" ? "2026-08-31" : undefined,
      birthDate: draft.stageMode === "born" ? "2026-04-06" : undefined,
      manualStage: draft.stageMode === "manual" ? "infant_4_6" : undefined
    });
    setSelectedChildId(child.id);
    completeStep("ONB-002");
    router.push("/onboarding/prepared-items");
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>아이 프로필</Text>
      <Text>ONB-002</Text>
      <TextInput
        onChangeText={setNickname}
        placeholder="태명 또는 별명"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={nickname}
      />
      <Pressable
        onPress={save}
        style={{ backgroundColor: theme.colors.primary500, borderRadius: 8, padding: 16 }}
      >
        <Text>다음</Text>
      </Pressable>
    </View>
  );
}
