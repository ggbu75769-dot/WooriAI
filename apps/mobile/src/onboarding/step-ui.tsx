import { Text, View } from "react-native";
import { Card, SecondaryButton } from "../ui";
import { theme } from "../theme";
import { onboardingSteps, type OnboardingScreenId } from "./steps";

// ONB-105: shared step progress indicator for the four onboarding step screens.
// Derives the step number and total from src/onboarding/steps.ts (the pinned
// ONB-001..ONB-004 list) so the indicator can never drift from the real flow.
export function OnboardingStepProgress({ screenId }: { screenId: OnboardingScreenId }) {
  const stepIndex = onboardingSteps.findIndex((step) => step.screenId === screenId);
  const stepNumber = stepIndex + 1;
  const totalSteps = onboardingSteps.length;

  return (
    <View
      accessibilityLabel={`온보딩 ${totalSteps}단계 중 ${stepNumber}단계`}
      accessibilityRole="progressbar"
      style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.gap }}
    >
      <View style={{ flexDirection: "row", gap: 6 }}>
        {onboardingSteps.map((step, index) => {
          const isCurrent = index === stepIndex;
          const reached = index <= stepIndex;
          return (
            <View
              key={step.screenId}
              style={{
                backgroundColor: reached ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: 4,
                height: 8,
                width: isCurrent ? 20 : 8
              }}
            />
          );
        })}
      </View>
      <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
        {stepNumber}/{totalSteps}
      </Text>
    </View>
  );
}

// ONB-105: consistent inline save-failure card with an explicit 재시도 affordance.
// Rendered by the onboarding steps that persist to the server (ONB-002/003/004)
// when their save mutation fails (e.g. network error), instead of a passive toast.
export function OnboardingSaveErrorCard({
  message = "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  onRetry
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert">
      <Card style={{ borderColor: theme.colors.danger, borderWidth: 1, gap: theme.spacing.gap }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.body1.fontSize }}>⚠</Text>
          <Text style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body2.fontSize }}>{message}</Text>
        </View>
        <SecondaryButton accessibilityLabel="저장 재시도" label="재시도" onPress={onRetry} />
      </Card>
    </View>
  );
}
