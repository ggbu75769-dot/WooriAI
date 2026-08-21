import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LOCAL_SESSION_TOKEN, setPreparedItems } from "../../src/api/client";
import { LOCAL_ITEM_CARRIER, LOCAL_ITEM_DIAPER } from "../../src/api/local-fixtures";
import { OnboardingSaveErrorCard, OnboardingStepProgress } from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

// These option ids must match real item template rows so that a check here actually flips that
// item's status server-side. The previous placeholder id ("11111111-...") did not correspond to
// any item template in the standalone test-mode local backend (see src/api/local-fixtures.ts),
// so setPreparedItems silently applied nothing for it in test mode -- swap in the local backend's
// real fixture ids instead.
const preparedItemOptions = [
  { id: LOCAL_ITEM_DIAPER, icon: "🧷", label: "기저귀" },
  { id: LOCAL_ITEM_CARRIER, icon: "🎒", label: "아기띠" }
];

export default function PreparedItemsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const [checkedIds, setCheckedIds] = useState<string[]>(preparedItemOptions.map((item) => item.id));

  function toggle(id: string) {
    setCheckedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !selectedChildId) {
        throw new Error("missing onboarding context");
      }
      return setPreparedItems(authToken, selectedChildId, checkedIds);
    },
    onSuccess: () => {
      completeStep("ONB-003");
      router.push("/onboarding/budget");
    }
  });

  return (
    <AppScreen>
      <View testID="screen-ONB-003" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-003" />
        <ScreenHeader
          eyebrow="출산 준비물"
          title="이미 준비한 물건이 있나요?"
          subtitle="체크한 항목은 준비물 목록에서 완료로 표시할게요."
        />

        <Card style={{ gap: 4 }}>
          {preparedItemOptions.map((item, index) => {
            const checked = checkedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => toggle(item.id)}
                style={{
                  alignItems: "center",
                  borderTopColor: theme.colors.gray300,
                  borderTopWidth: index === 0 ? 0 : 1,
                  flexDirection: "row",
                  gap: theme.spacing.gap,
                  minHeight: theme.touchTarget,
                  paddingVertical: 10
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.beige,
                    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
                    borderRadius: 8,
                    borderWidth: 1,
                    height: 26,
                    justifyContent: "center",
                    width: 26
                  }}
                >
                  {checked ? <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "800" }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                <Text style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </Card>

        <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
          나중에 준비템 탭에서 언제든 다시 체크할 수 있어요.
        </Text>

        {save.isError ? <OnboardingSaveErrorCard onRetry={() => save.mutate()} /> : null}

        <PrimaryButton
          disabled={save.isPending || !authToken || !selectedChildId}
          label={save.isPending ? "저장하는 중" : "저장하고 계속"}
          onPress={() => save.mutate()}
        />
      </View>
    </AppScreen>
  );
}
