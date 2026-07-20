import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import type { ChildStageMode } from "@wooriai/domain";
import { useOnboardingDraftStore } from "../../src/stores/onboarding-draft.store";
import { routeForOnboardingPath } from "../../src/onboarding/resume";
import { BottomActionBar, ConfirmSheet, OnboardingScaffold as OnboardingScreenScaffold, RadioCard, ScreenHeader, StepProgress, Toast, semanticColors, spacing, typography, type AppIconName } from "../../src/design-system";

const onboardingChildStatusScreenId = "ONB-001";

const stageOptions: Array<{
  mode: ChildStageMode;
  icon: AppIconName;
  title: string;
  description: string;
}> = [
  {
    mode: "pregnant",
    icon: "human-pregnant",
    title: "임신 중이에요",
    description: "출산 예정일에 맞춰 준비를 도와드릴게요."
  },
  {
    mode: "born",
    icon: "baby-face-outline",
    title: "아이가 태어났어요",
    description: "우리 아이 성장 단계에 맞는 정보를 보여드릴게요."
  },
  {
    mode: "manual",
    icon: "tune-variant",
    title: "단계를 직접 선택할게요",
    description: "지금 상황에 맞는 단계를 나중에 골라주세요."
  }
];

export default function ChildStatusScreen() {
  const selectedMode = useOnboardingDraftStore((state) => state.draft?.selectedPath ?? null);
  const draft = useOnboardingDraftStore((state) => state.draft);
  const selectPath = useOnboardingDraftStore((state) => state.selectPath);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  const [pendingMode, setPendingMode] = useState<ChildStageMode | null | undefined>(undefined);
  const [scopeError, setScopeError] = useState(false);
  const cardRefs = useRef<Partial<Record<ChildStageMode, View | null>>>({});
  const returnFocusRef = useRef<View | null>(null);

  function choose(stageMode: ChildStageMode) {
    const hasPathSpecificInput = Boolean(draft?.dueDate || draft?.birthDate || draft?.manualStage);
    if (selectedMode && selectedMode !== stageMode && hasPathSpecificInput) {
      returnFocusRef.current = cardRefs.current[stageMode] ?? null;
      setPendingMode(stageMode);
      return;
    }
    setScopeError(!selectPath(stageMode));
  }

  function next() {
    if (!selectedMode) return;
    updateDraft({ currentStep: selectedMode === "pregnant" ? "pregnant" : selectedMode === "born" ? "born" : "direct-stage" });
    router.push(routeForOnboardingPath(selectedMode));
  }

  const cancelSelection = () => {
    const hasPathSpecificInput = Boolean(draft?.dueDate || draft?.birthDate || draft?.manualStage);
    returnFocusRef.current = selectedMode ? cardRefs.current[selectedMode] ?? null : null;
    if (hasPathSpecificInput) setPendingMode(null);
    else setScopeError(!selectPath(null));
  };

  return (
    <OnboardingScreenScaffold
      footer={(
        <BottomActionBar
          onPrimary={next}
          onText={selectedMode ? cancelSelection : undefined}
          primaryDisabled={!selectedMode}
          primaryLabel="다음"
          textLabel={selectedMode ? "선택 취소" : undefined}
        />
      )}
      testID="screen-ONB-001"
    >
      <View accessibilityLabel={onboardingChildStatusScreenId} testID="screen-ONB-001" style={{ gap: spacing.xl }}>
        <StepProgress current={1} label="아이 정보" total={3} />
        <ScreenHeader
          eyebrow="아이 정보 시작하기"
          title="지금 상황을 알려주세요"
          subtitle="선택한 내용에 맞춰 다음 안내를 준비할게요."
        />

        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="text" style={{ color: semanticColors.textSecondary, ...typography.body }}>
            아이 정보를 설정해 주세요. 약 2분이면 끝나요.
          </Text>
        </View>

        {scopeError ? <Toast message="선택 상태를 준비하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}

        <View accessibilityLabel="현재 상황 선택" accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
          {stageOptions.map((option) => {
            const selected = selectedMode === option.mode;
            return (
              <RadioCard
                key={option.mode}
                description={option.description}
                icon={option.icon}
                onPress={() => choose(option.mode)}
                ref={(node) => { cardRefs.current[option.mode] = node; }}
                selected={selected}
                title={option.title}
              />
            );
          })}
        </View>
        <ConfirmSheet
          description="경로에만 필요한 날짜와 직접 선택 단계는 지워져요. 입력한 이름과 성별은 유지됩니다."
          onCancel={() => setPendingMode(undefined)}
          onConfirm={() => {
            setScopeError(!selectPath(pendingMode ?? null));
            setPendingMode(undefined);
          }}
          returnFocusRef={returnFocusRef}
          title={pendingMode === null ? "선택을 취소할까요?" : "시작 선택을 변경할까요?"}
          visible={pendingMode !== undefined}
        />
      </View>
    </OnboardingScreenScaffold>
  );
}
