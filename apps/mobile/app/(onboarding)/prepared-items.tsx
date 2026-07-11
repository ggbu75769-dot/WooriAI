import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LOCAL_SESSION_TOKEN, setPreparedItems } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

const onboardingPreparedItemsScreenId = "ONB-003";

const preparedItemOptions = [
  { id: "11111111-1111-4111-8111-111111111111", icon: "🚗", label: "카시트" }
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
      <View accessibilityLabel={onboardingPreparedItemsScreenId} testID="screen-ONB-003" style={{ gap: theme.spacing.section }}>
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

        {save.isError ? <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." /> : null}

        <PrimaryButton
          disabled={save.isPending || !authToken || !selectedChildId}
          label={save.isPending ? "저장하는 중" : "저장하고 계속"}
          onPress={() => save.mutate()}
        />
      </View>
    </AppScreen>
  );
}
