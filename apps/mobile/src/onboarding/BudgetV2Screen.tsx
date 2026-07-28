import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { useOnboardingDraftStore } from "../stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { ScreenHeader } from "../ui";
import { BottomActionBar, FormField, OnboardingScaffold, StepProgress } from "../design-system";
import { theme } from "../theme";

export function BudgetV2Screen() {
  const draft = useOnboardingDraftStore((state) => state.draft);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  if (!draft?.selectedPath || draft.preparedStepState === "not_started") return <Redirect href="/onboarding/prepared-items" />;
  const amountKrw = draft.monthlyBudgetWon ?? 0;
  const amountError = !Number.isSafeInteger(amountKrw) || amountKrw <= 0 ? "0보다 큰 원화 정수를 입력해 주세요." : null;
  const toReview = (monthlyBudgetWon: number | null) => {
    updateDraft({ monthlyBudgetWon, monthlyBudgetEdited: true, currentStep: "review" });
    useOnboardingProgressStore.getState().completeStep("ONB-003");
    router.push("/onboarding/review" as never);
  };
  return (
    <OnboardingScaffold
      footer={(
        <BottomActionBar
          onPrimary={() => toReview(amountKrw)}
          onSecondary={() => toReview(null)}
          primaryDisabled={Boolean(amountError)}
          primaryLabel="예산 확인하고 시작하기"
          secondaryLabel="나중에 설정할게요"
        />
      )}
      testID="screen-ONB-003"
    >
      <View accessibilityLabel="ONB-003" testID="screen-ONB-003" style={{ gap: theme.spacing.section }}>
        <StepProgress current={3} label="월 예산" total={3} />
        <ScreenHeader title="한 달 예산을 정해주세요" subtitle="준비와 기록을 한눈에 보기 위한 기준이에요. 나중에 바꿀 수 있어요." />
        <FormField
          error={amountError}
          keyboardType="number-pad"
          label="월 예산"
          onChangeText={(value) => {
            const digits = value.replace(/[^0-9]/g, "");
            updateDraft({ monthlyBudgetWon: digits ? Number(digits) : 0, monthlyBudgetEdited: true });
          }}
          placeholder="금액 입력"
          value={draft.monthlyBudgetWon === null ? "" : draft.monthlyBudgetWon.toLocaleString("ko-KR")}
        />
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>원 단위로 저장하며, 지출 기록을 자동 생성하지 않아요.</Text>
      </View>
    </OnboardingScaffold>
  );
}

export default BudgetV2Screen;
