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
import { amountDigitsOnly, formatAmountDigits } from "../../src/money";
// GAP-054 #2: 상한 값·문구는 예산 수정·지출 입력 화면과 **같은 모듈**이 단일 소스다.
import { amountOverLimitMessage, isAmountOverLimit } from "../../src/expenses/amount-limit";
import { AppScreen, Card, PrimaryButton, ScreenHeader, TextButton } from "../../src/ui";
import { theme } from "../../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (예산 수정·지출 수정 화면의 같은 사본들과 함께) 제거했다.

export default function BudgetScreen() {
  const [amountDigits, setAmountDigits] = useState("500000");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);

  const amountKrw = Number(amountDigits || "0");
  /**
   * GAP-054 #2 — 예산 수정 화면(app/budget.tsx)과 **같은 판정·같은 문구**다. `budgets.amount_krw`
   * (int4) 상한을 넘긴 값은 서버가 400으로 거절하므로(UpsertBudgetDto의 @Max), 온보딩 마지막
   * 단계에서 저장이 실패해 사용자가 막히는 일이 없게 입력 칸이 먼저 말한다. 기본값(500,000)은
   * 상한 아래라 이 화면의 첫 렌더는 한 픽셀도 바뀌지 않는다.
   */
  const amountError =
    amountDigits.length > 0 && amountKrw <= 0
      ? "0보다 큰 금액을 입력해 주세요."
      : isAmountOverLimit(amountKrw)
        ? amountOverLimitMessage()
        : null;
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
      // GAP-054 #2: 버튼 비활성과 같은 판정을 저장 직전에도 본다(서버 @Max와 같은 숫자).
      if (
        !authToken ||
        !selectedChildId ||
        !Number.isInteger(amountKrw) ||
        amountKrw <= 0 ||
        isAmountOverLimit(amountKrw)
      ) {
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
      <View testID="screen-ONB-004" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-004" />
        {/* UX-G: 마지막 단계의 부제가 온보딩 다음에 올 **첫 행동**(홈에서의 첫 지출 기록)을
            미리 알려 준다 -- 홈의 첫 지출 유도 카드(src/home/first-run-guide.ts)와 이어지는
            한 문장이라, 예산을 건너뛴 사용자도 빈 홈 앞에서 "이제 뭘 하지?"로 멈추지 않는다.
            흐름·구조는 그대로이고 문구만 다듬었다. */}
        <ScreenHeader
          eyebrow="마지막 단계"
          title="한 달 예산을 정해주세요"
          subtitle="나중에 예산 화면에서 언제든 바꿀 수 있어요. 이제 홈에서 첫 지출만 기록하면 준비 끝이에요."
        />
        {/* 라운드 48 B1(d): 예산은 (아이, 연월) 단위로 저장되고 **이월되지 않는다**. 그래서 매달
            1일이면 홈의 진행바·경고가 함께 조용해지는데, 지금까지 온보딩은 그 사실을 한 번도
            말하지 않아 사용자는 "예산이 사라졌다 = 고장"으로 읽을 수밖에 없었다. 여기서 미리
            한 줄로 밝힌다 -- 재촉이나 숙제가 아니라 사실 고지이고, 홈의 넛지가 매달 초에 지난달
            값을 알려 주며 이어 받는다(app/(tabs)/index.tsx의 B1(c)). */}
        <Text
          testID="onboarding-budget-monthly-notice"
          style={{
            color: theme.colors.gray600,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: 18
          }}
        >
          예산은 달마다 따로 설정해요 — 매달 초에 홈에서 이어서 설정할 수 있어요.
        </Text>

        <Card style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
            월 예산
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <TextInput
              accessibilityLabel="월 예산 입력"
              keyboardType="number-pad"
              returnKeyType="done"
              onChangeText={(value) => setAmountDigits(amountDigitsOnly(value))}
              style={{
                color: theme.colors.brown,
                fontSize: 24,
                fontWeight: "800",
                paddingVertical: 6
              }}
              value={formatAmountDigits(amountDigits)}
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
