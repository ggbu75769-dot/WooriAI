import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Platform, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LOCAL_SESSION_TOKEN, upsertBudget } from "../../src/api/client";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { OnboardingSaveErrorCard, OnboardingStepProgress } from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, TextButton } from "../../src/ui";
import { theme } from "../../src/theme";

const onboardingBudgetScreenId = "ONB-004";

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatAmount(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

export default function BudgetScreen() {
  const [amountDigits, setAmountDigits] = useState("500000");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);

  const amountKrw = Number(amountDigits || "0");
  const amountError = amountDigits.length > 0 && amountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;
  const canSave = !amountError && amountKrw > 0 && Boolean(authToken && selectedChildId);

  // ANA-101 (round5a-sprint2-plan.md §5): the last onboarding step reaching
  // /(tabs) -- via either a saved budget or an explicit skip -- is the single
  // "onboarding completed" moment. trackAndFlushAnalyticsEvent is a no-op
  // while analytics opt-in is OFF (its default), so this has no effect until
  // ANA-102 turns consent on.
  function trackOnboardingCompleted() {
    const stepCount = useOnboardingProgressStore.getState().completedStepIds.length;
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "onboarding_completed",
      payload: { stepCount },
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !selectedChildId || !Number.isInteger(amountKrw) || amountKrw <= 0) {
        throw new Error("invalid budget");
      }
      return upsertBudget(authToken, selectedChildId, amountKrw);
    },
    onSuccess: () => {
      completeStep("ONB-004");
      markHomeReached();
      trackOnboardingCompleted();
      router.replace("/(tabs)");
    }
  });

  function skip() {
    completeStep("ONB-004");
    markHomeReached();
    trackOnboardingCompleted();
    router.replace("/(tabs)");
  }

  return (
    <AppScreen>
      <View accessibilityLabel={onboardingBudgetScreenId} testID="screen-ONB-004" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-004" />
        <ScreenHeader
          eyebrow="마지막 단계"
          title="한 달 예산을 정해주세요"
          subtitle="나중에 예산 화면에서 언제든 바꿀 수 있어요."
        />

        <Card style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
            월 예산
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setAmountDigits(toDigits(value))}
              style={{
                color: theme.colors.brown,
                fontSize: 24,
                fontWeight: "800",
                paddingVertical: 6
              }}
              value={formatAmount(amountDigits)}
            />
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>원</Text>
          </View>
          {amountError ? (
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
          ) : null}
        </Card>

        {save.isError ? <OnboardingSaveErrorCard onRetry={() => save.mutate()} /> : null}

        <View style={{ gap: theme.spacing.gap }}>
          <PrimaryButton
            disabled={!canSave || save.isPending}
            label={save.isPending ? "저장하는 중" : "예산 저장하고 시작하기"}
            onPress={() => save.mutate()}
          />
          <TextButton disabled={save.isPending} label="나중에 설정할게요" onPress={skip} style={{ alignSelf: "center" }} />
        </View>
      </View>
    </AppScreen>
  );
}
