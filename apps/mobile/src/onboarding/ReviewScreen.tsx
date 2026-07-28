import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useRef } from "react";
import { Platform, Text, View } from "react-native";
import { buildOnboardingCompletionInput, getOnboardingReadiness } from "@wooriai/domain";
import { completeOnboarding, fixtureSessionToken, getOnboardingProgress, isApiErrorCode, type CompleteOnboardingInput } from "../api/client";
import { trackAndFlushAnalyticsEvent } from "../analytics/client";
import { reportCrash } from "../crash/crash-adapter";
import { routeForOnboardingPath } from "./resume";
import { createSingleFlightGuard } from "./single-flight";
import { invalidateOnboardingCompletionQueries } from "../query/onboarding-invalidation";
import { useOnboardingDraftStore, clearOnboardingDraft } from "../stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { BottomActionBar, Card, OnboardingScaffold, ScreenHeader, StepProgress, TextButton, Toast } from "../design-system";
import { theme } from "../theme";
import { completionErrorMessage, finalizeOnboardingSuccess } from "./completion";

function pathLabel(path: CompleteOnboardingInput["child"]["stageMode"]) {
  return path === "pregnant" ? "임신 중이에요" : path === "born" ? "아이가 태어났어요" : "단계를 직접 선택했어요";
}

export default function OnboardingReviewScreen() {
  const draft = useOnboardingDraftStore((state) => state.draft);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const submitInFlight = useRef(createSingleFlightGuard());
  const completionAccepted = useRef(false);
  const readiness = draft ? getOnboardingReadiness(draft) : { ready: false, errors: ["ONBOARDING_DRAFT_MISSING"] };

  const complete = useMutation({
    mutationFn: async () => {
      if (!draft || !token) {
        throw new Error("ONBOARDING_DRAFT_INCOMPLETE");
      }
      const body = buildOnboardingCompletionInput(draft);
      try {
        const response = await completeOnboarding(token, body, draft.finalSubmitIdempotencyKey);
        completionAccepted.current = true;
        return { child: response.child, recovered: false };
      } catch (error) {
        if (!isApiErrorCode(error, "ONBOARDING_ALREADY_COMPLETED")) throw error;
        const status = await getOnboardingProgress(token);
        if (!status.completed || status.nextStep !== "home" || !status.summary.child) throw error;
        completionAccepted.current = true;
        return { child: status.summary.child, recovered: true };
      }
    },
    onSuccess: async ({ child }) => {
      await finalizeOnboardingSuccess(child.id, {
        selectChild: setSelectedChildId,
        refreshCache: async (childId) => { await invalidateOnboardingCompletionQueries(queryClient, childId); },
        completeProgress: () => {
          const progress = useOnboardingProgressStore.getState();
          progress.completeStep("ONB-001");
          progress.completeStep("ONB-002");
          progress.completeStep("ONB-003");
          progress.markHomeReached();
        },
        navigateHome: async () => {
          router.replace("/(tabs)");
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        },
        clearDraft: clearOnboardingDraft
      });
      trackAndFlushAnalyticsEvent(token, {
        eventName: "onboarding_completed",
        payload: { stepCount: 3 },
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
      });
    },
    onError: (error) => {
      reportCrash(error, false);
    },
    onSettled: () => {
      submitInFlight.current.finish();
    }
  });

  if (!draft?.selectedPath || draft.currentStep !== "review") {
    return completionAccepted.current ? null : <Redirect href="/onboarding/child-status" />;
  }
  return (
    <OnboardingScaffold
      footer={(
        <BottomActionBar
          onPrimary={() => {
            if (!submitInFlight.current.tryStart()) return;
            complete.mutate();
          }}
          onSecondary={() => router.back()}
          primaryDisabled={complete.isPending || !readiness.ready || !token}
          primaryLabel={complete.isPending ? "완료하는 중" : "이대로 시작하기"}
          secondaryLabel="이전 단계로"
        />
      )}
      testID="screen-ONB-003-REVIEW"
    >
      <View accessibilityLabel="ONB-003 완료 확인" testID="screen-ONB-003-REVIEW" style={{ gap: theme.spacing.section }}>
        <StepProgress current={3} label="월 예산" total={3} />
        <ScreenHeader title="입력한 내용을 확인해 주세요" subtitle="완료하기 전까지 실제 아이 프로필이나 준비 기록은 만들어지지 않아요." />
        <Card style={{ gap: 14 }}>
          <SummaryRow label="시작 정보" value={pathLabel(draft.selectedPath)} onEdit={() => router.push("/onboarding/child-status")} />
          <SummaryRow label={draft.selectedPath === "pregnant" ? "태명 또는 별명" : "아이 이름"} value={draft.childName} onEdit={() => router.push(routeForOnboardingPath(draft.selectedPath!))} />
          <SummaryRow label={draft.dueDate ? "출산 예정일" : "생일"} value={draft.dueDate ?? draft.birthDate ?? "확인 필요"} onEdit={() => router.push(routeForOnboardingPath(draft.selectedPath!))} />
          {draft.manualStage ? <SummaryRow label="직접 선택한 단계" value={stageLabel(draft.manualStage)} onEdit={() => router.push(routeForOnboardingPath(draft.selectedPath!))} /> : null}
          <SummaryRow label="이미 준비한 물건" value={draft.preparedStepState === "selected" ? `${draft.preparedItemIds.length}개 선택` : draft.preparedStepState === "skipped" ? "나중에 설정" : "준비한 항목 없음"} onEdit={() => router.push("/onboarding/prepared-items")} />
          <SummaryRow label="월 예산" value={draft.monthlyBudgetWon === null ? "나중에 설정" : `${draft.monthlyBudgetWon.toLocaleString("ko-KR")}원`} onEdit={() => router.push("/onboarding/budget")} />
        </Card>
        <Card>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "800" }}>시작하면 만들어지는 정보</Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 21 }}>아이 또는 임신 프로필 1개와 준비 완료 {draft.preparedStepState === "selected" ? draft.preparedItemIds.length : 0}개가 저장돼요.</Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 21 }}>{draft.monthlyBudgetWon === null ? "예산은 선택 사항이며 나중에 설정할 수 있어요." : "예산도 함께 저장돼요."} 완료 후 가족과 준비 화면에서 다시 바꿀 수 있어요.</Text>
        </Card>
        {complete.isError ? <Toast message={completionErrorMessage(complete.error)} tone="error" /> : null}
      </View>
    </OnboardingScaffold>
  );
}

function stageLabel(stage: NonNullable<CompleteOnboardingInput["child"]["manualStage"]>) {
  const labels: Record<NonNullable<CompleteOnboardingInput["child"]["manualStage"]>, string> = {
    pregnancy_early: "임신 초기",
    pregnancy_mid: "임신 중기",
    pregnancy_late: "임신 후기",
    newborn_0_3: "신생아 0~3개월",
    infant_4_6: "영아 4~6개월",
    infant_7_12: "영아 7~12개월",
    toddler_1_3: "유아 1~3세",
    kid_4_7: "유아 4~7세",
    elementary: "초등학생",
    middle_school: "중학생"
  };
  return labels[stage];
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{value}</Text>
      </View>
      {onEdit ? <TextButton label="수정" onPress={onEdit} /> : null}
    </View>
  );
}
