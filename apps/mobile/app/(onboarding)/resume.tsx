import { useEffect } from "react";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { routeForDraftCurrentStep, routeForOnboardingNextStep } from "../../src/onboarding/resume";
import { clearOnboardingDraft, useOnboardingDraftStore } from "../../src/stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../../src/stores/onboarding-resume.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";
import { theme } from "../../src/theme";

const onboardingResumeScreenId = "ONB-006";

const nextStepLabels: Record<string, string> = {
  consents: "약관 동의",
  "child-profile": "아이 프로필 입력",
  "prepared-items": "이미 준비한 물건 체크",
  budget: "월 예산 설정"
};

export default function OnboardingResumeScreen() {
  const progress = useOnboardingResumeStore((state) => state.progress);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const draft = useOnboardingDraftStore((state) => state.draft);

  // If this screen is reached without a freshly fetched progress (e.g. a deep link, or a
  // reloaded JS bundle that cleared the in-memory resume store), fall back to "/" so index.tsx
  // re-fetches server progress instead of showing a blank/guessed resume state.
  useEffect(() => {
    if (!progress) {
      router.replace("/");
    }
  }, [progress]);

  if (!progress) {
    return <Redirect href="/" />;
  }

  const { summary, nextStep, canRestart } = progress;
  const stepLabel = nextStepLabels[nextStep] ?? "다음 단계";

  function resume() {
    if (!progress) return;
    if (summary.child) {
      setSelectedChildId(summary.child.id, summary.child.householdId ?? null);
      completeStep("ONB-001");
    }
    if (summary.preparedItemsCount !== null) {
      completeStep("ONB-002");
    }
    if (summary.budget) {
      completeStep("ONB-003");
    }
    router.replace(draft ? routeForDraftCurrentStep(draft.currentStep) : routeForOnboardingNextStep(nextStep));
  }

  function restartFromScratch() {
    resetOnboarding();
    void clearOnboardingDraft();
    router.replace("/onboarding/child-status");
  }

  return (
    <AppScreen>
      <View accessibilityLabel={onboardingResumeScreenId} testID="screen-ONB-006" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="이어서 진행하기"
          title="하던 곳부터 계속할까요?"
          subtitle={`지난번에는 "${stepLabel}" 단계까지 진행했어요.`}
        />

        <Card style={{ gap: 10 }}>
          {summary.child ? (
            <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
              {summary.child.nickname} · {summary.child.stageLabel}
            </Text>
          ) : null}
          {summary.preparedItemsCount !== null ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              준비물 체크 {summary.preparedItemsCount}개 저장됨
            </Text>
          ) : null}
          {summary.budget ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              월 예산 {summary.budget.amountKrw.toLocaleString("ko-KR")}원 저장됨
            </Text>
          ) : null}
          {!summary.child ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              아직 저장된 아이 정보가 없어요.
            </Text>
          ) : null}
        </Card>

        <View style={{ gap: theme.spacing.gap }}>
          <PrimaryButton label="이어서 하기" onPress={resume} />
          {canRestart ? <SecondaryButton label="처음부터 시작" onPress={restartFromScratch} /> : null}
        </View>
      </View>
    </AppScreen>
  );
}
