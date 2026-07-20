import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import {
  calculateChildStage,
  CHILD_STAGE_CODES,
  formatChildAgeKorean,
  getSeoulToday,
  isValidCalendarDate,
  type ChildSex,
  type ChildStageCode
} from "@wooriai/domain";
import { useOnboardingDraftStore } from "../stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { BottomActionBar, CategoryChip, ConfirmSheet, DateField, FormField, OnboardingScaffold, ScreenHeader, SegmentedChoice, StepProgress, TextButton, Toast } from "../design-system";
import { theme } from "../theme";

const sexOptions: Array<{ value: ChildSex; label: string }> = [
  { value: "male", label: "남아" },
  { value: "female", label: "여아" },
  { value: "unknown", label: "아직 몰라요" }
];

const stageLabels: Record<ChildStageCode, string> = {
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

function PathChangeActions({ impact }: { impact: string }) {
  const [confirming, setConfirming] = useState(false);
  const selectPath = useOnboardingDraftStore((state) => state.selectPath);
  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <TextButton label="뒤로" onPress={() => router.back()} />
        <TextButton label="선택 변경" onPress={() => setConfirming(true)} />
      </View>
      <ConfirmSheet
        description={impact}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          selectPath(null);
          setConfirming(false);
          router.replace("/onboarding/child-status");
        }}
        title="시작 선택을 변경할까요?"
        visible={confirming}
      />
    </>
  );
}

function nextToPrepared() {
  useOnboardingProgressStore.getState().completeStep("ONB-001");
  router.push("/onboarding/prepared-items");
}

export function PregnantOnboardingScreen() {
  const draft = useOnboardingDraftStore((state) => state.draft);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  if (!draft || draft.selectedPath !== "pregnant") return <Redirect href="/onboarding/child-status" />;
  const nameError = draft.childName.trim() ? null : "태명 또는 별명을 입력해 주세요.";
  const dateError = draft.dueDate && isValidCalendarDate(draft.dueDate) ? null : "출산 예정일을 달력에서 선택해 주세요.";
  const pastDue = Boolean(draft.dueDate && draft.dueDate < getSeoulToday());
  const canContinue = !nameError && !dateError && Boolean(draft.sex);
  return (
    <OnboardingScaffold
      footer={(
        <BottomActionBar
          onPrimary={() => { updateDraft({ currentStep: "prepared-items" }); nextToPrepared(); }}
          primaryDisabled={!canContinue}
          primaryLabel="다음"
        />
      )}
      testID="screen-ONB-002-PREGNANT"
    >
      <View accessibilityLabel="ONB-002-PREGNANT" testID="screen-ONB-002-PREGNANT" style={{ gap: theme.spacing.section }}>
        <StepProgress current={1} label="아이 정보" total={3} />
        <PathChangeActions impact="입력한 출산 예정일은 지워지고, 태명과 성별은 유지돼요." />
        <ScreenHeader title="출산 예정일이 언제인가요?" subtitle="예정일을 기준으로 지금 필요한 준비를 알려드려요." />
        <FormField
          error={nameError}
          label="태명 또는 별명"
          maxLength={60}
          onChangeText={(childName) => updateDraft({ childName })}
          placeholder="직접 입력해 주세요"
          value={draft.childName}
        />
        <DateField error={dateError} label="출산 예정일" onChange={(dueDate) => updateDraft({ dueDate })} value={draft.dueDate} />
        {pastDue ? <Toast message="예정일이 지났다면 ‘아이가 태어났어요’ 경로로 변경할 수 있어요." tone="error" /> : null}
        <SegmentedChoice label="현재 알고 있는 성별" onChange={(sex) => updateDraft({ sex })} options={sexOptions} value={draft.sex} />
      </View>
    </OnboardingScaffold>
  );
}

export function BornOnboardingScreen() {
  const draft = useOnboardingDraftStore((state) => state.draft);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  if (!draft || draft.selectedPath !== "born") return <Redirect href="/onboarding/child-status" />;
  const nameError = draft.childName.trim() ? null : "아이 이름을 입력해 주세요.";
  const dateError = !draft.birthDate || !isValidCalendarDate(draft.birthDate)
    ? "생일을 달력에서 선택해 주세요."
    : draft.birthDate > getSeoulToday()
      ? "생일은 오늘보다 미래일 수 없어요."
      : null;
  const age = !dateError && draft.birthDate ? formatChildAgeKorean(draft.birthDate) : null;
  const preview = !dateError && draft.birthDate
    ? calculateChildStage({ stageMode: "born", birthDate: draft.birthDate })
    : null;
  const canContinue = !nameError && !dateError && Boolean(draft.sex);
  return (
    <OnboardingScaffold
      footer={<BottomActionBar onPrimary={() => { updateDraft({ currentStep: "prepared-items" }); nextToPrepared(); }} primaryDisabled={!canContinue} primaryLabel="다음" />}
      testID="screen-ONB-002-BORN"
    >
      <View accessibilityLabel="ONB-002-BORN" testID="screen-ONB-002-BORN" style={{ gap: theme.spacing.section }}>
        <StepProgress current={1} label="아이 정보" total={3} />
        <PathChangeActions impact="입력한 생일은 지워지고, 아이 이름과 성별은 유지돼요." />
        <ScreenHeader title="아이를 소개해 주세요" subtitle="생일에서 나이와 현재 준비 단계를 자동으로 계산해요." />
        <FormField error={nameError} label="아이 이름" maxLength={60} onChangeText={(childName) => updateDraft({ childName })} placeholder="직접 입력해 주세요" value={draft.childName} />
        <DateField error={dateError} label="생일" maximumDate={new Date()} onChange={(birthDate) => updateDraft({ birthDate })} value={draft.birthDate} />
        {age && preview ? (
          <View style={{ backgroundColor: theme.colors.mint, borderRadius: theme.radii.small, gap: 4, padding: 14 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{age}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{preview.stageLabel} 준비를 안내할게요.</Text>
          </View>
        ) : null}
        <SegmentedChoice label="성별" onChange={(sex) => updateDraft({ sex })} options={sexOptions} value={draft.sex} />
      </View>
    </OnboardingScaffold>
  );
}

export function DirectStageOnboardingScreen() {
  const draft = useOnboardingDraftStore((state) => state.draft);
  const updateDraft = useOnboardingDraftStore((state) => state.updateDraft);
  if (!draft || draft.selectedPath !== "manual") return <Redirect href="/onboarding/child-status" />;
  const pregnancyStage = draft.manualStage?.startsWith("pregnancy_") ?? false;
  const dateValue = pregnancyStage ? draft.dueDate : draft.birthDate;
  const dateError = !dateValue || !isValidCalendarDate(dateValue)
    ? pregnancyStage ? "출산 예정일을 선택해 주세요." : "생일을 선택해 주세요."
    : !pregnancyStage && dateValue > getSeoulToday()
      ? "생일은 오늘보다 미래일 수 없어요."
      : null;
  const derivedStage = !pregnancyStage && draft.birthDate && !dateError
    ? calculateChildStage({ stageMode: "born", birthDate: draft.birthDate }).stageCode
    : null;
  const hasConflict = Boolean(derivedStage && draft.manualStage && derivedStage !== draft.manualStage);
  const canContinue = Boolean(draft.manualStage && draft.childName.trim() && draft.sex && !dateError && (!hasConflict || draft.stageOverride));

  const chooseStage = (manualStage: ChildStageCode) => {
    const nextPregnancyStage = manualStage.startsWith("pregnancy_");
    updateDraft({
      manualStage,
      dueDate: nextPregnancyStage ? draft.dueDate : null,
      birthDate: nextPregnancyStage ? null : draft.birthDate,
      stageOverride: false
    });
  };

  return (
    <OnboardingScaffold
      footer={(
        <BottomActionBar
          onPrimary={() => { updateDraft({ stageOverride: true, currentStep: "prepared-items" }); nextToPrepared(); }}
          primaryDisabled={!canContinue}
          primaryLabel="다음"
        />
      )}
      testID="screen-ONB-002-DIRECT"
    >
      <View accessibilityLabel="ONB-002-DIRECT" testID="screen-ONB-002-DIRECT" style={{ gap: theme.spacing.section }}>
        <StepProgress current={1} label="아이 정보" total={3} />
        <PathChangeActions impact="직접 선택한 단계와 날짜는 지워지고, 이름과 성별은 유지돼요." />
        <ScreenHeader title="현재 단계를 직접 선택해 주세요" subtitle="날짜로 계산한 단계와 다르면 차이를 확인한 뒤 직접 선택을 적용해요." />
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CHILD_STAGE_CODES.map((stage) => <CategoryChip key={stage} label={stageLabels[stage]} onPress={() => chooseStage(stage)} selected={draft.manualStage === stage} />)}
        </View>
        {draft.manualStage ? (
          <>
            <FormField label={pregnancyStage ? "태명 또는 별명" : "아이 이름"} maxLength={60} onChangeText={(childName) => updateDraft({ childName })} placeholder="직접 입력해 주세요" value={draft.childName} />
            <DateField
              error={dateError}
              label={pregnancyStage ? "출산 예정일" : "생일"}
              maximumDate={pregnancyStage ? undefined : new Date()}
              onChange={(value) => updateDraft({ ...(pregnancyStage ? { dueDate: value } : { birthDate: value }), stageOverride: false })}
              value={dateValue}
            />
            <SegmentedChoice label="성별" onChange={(sex) => updateDraft({ sex })} options={sexOptions} value={draft.sex} />
          </>
        ) : null}
        {hasConflict ? (
          <View style={{ backgroundColor: theme.colors.presentation.dangerSurface, borderRadius: theme.radii.small, gap: 8, padding: 14 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "800" }}>생일로 계산한 단계와 달라요</Text>
            <Text style={{ color: theme.colors.textSecondary }}>생일 기준은 {derivedStage ? stageLabels[derivedStage] : "확인 필요"}, 직접 선택은 {draft.manualStage ? stageLabels[draft.manualStage] : "없음"}이에요.</Text>
            <TextButton label={draft.stageOverride ? "직접 선택 적용 확인됨" : "직접 선택한 단계로 사용할게요"} onPress={() => updateDraft({ stageOverride: true })} />
          </View>
        ) : null}
      </View>
    </OnboardingScaffold>
  );
}
