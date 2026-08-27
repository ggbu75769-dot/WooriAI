import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CHILD_STAGE_CODES, type ChildStageCode } from "@wooriai/domain";
import { createChild, LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN } from "../../src/api/client";
// MOB-118: the date guard (isFutureSeoulDate/isValidCalendarDate wiring), stage labels, and
// date-field label moved verbatim to src/children/child-form.ts so the settings 아이 관리
// screen's edit/add forms reuse exactly this screen's validation -- see that module.
import { CHILD_STAGE_LABELS, computeDateError, dateFieldLabel } from "../../src/children/child-form";
import { OnboardingSaveErrorCard, OnboardingStepProgress } from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, PrimaryButton, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

export default function ChildProfileScreen() {
  const [nickname, setNickname] = useState("튼튼이");
  const [dateText, setDateText] = useState("");
  const [manualStage, setManualStage] = useState<ChildStageCode | null>(null);
  const session = useSessionStore();
  const authToken = session.accessToken ?? (session.isTestSession ? LOCAL_SESSION_TOKEN : null);
  const householdId = session.defaultHouseholdId ?? (session.isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const draft = useOnboardingProgressStore((state) => state.childDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const getOrCreateChildCreateIdempotencyKey = useOnboardingProgressStore(
    (state) => state.getOrCreateChildCreateIdempotencyKey
  );
  const clearChildCreateIdempotencyKey = useOnboardingProgressStore((state) => state.clearChildCreateIdempotencyKey);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);

  const nicknameError = nickname.trim().length === 0 ? "태명 또는 별명을 입력해 주세요." : null;
  const dateError = useMemo(() => computeDateError(draft.stageMode, dateText), [draft.stageMode, dateText]);
  const dateLabel = useMemo(() => dateFieldLabel(draft.stageMode), [draft.stageMode]);
  const manualStageError = draft.stageMode === "manual" && !manualStage ? "아이 단계를 하나 선택해 주세요." : null;
  const canSave =
    !nicknameError &&
    !dateError &&
    !manualStageError &&
    Boolean(authToken && householdId && draft.stageMode);

  const save = useMutation({
    mutationFn: async () => {
      if (!authToken || !householdId || !draft.stageMode) {
        throw new Error("missing onboarding context");
      }
      if (draft.stageMode === "manual" && !manualStage) {
        throw new Error("missing manual stage selection");
      }
      const trimmedDate = dateText.trim();
      // MOB-101: reuse the same Idempotency-Key across retries of this submission (network
      // retry, or a resumed app restarting the mutation) so the server never creates a second
      // child for the household -- see round5a-sprint1-plan.md §4.
      const idempotencyKey = getOrCreateChildCreateIdempotencyKey();
      const child = await createChild(
        authToken,
        {
          householdId,
          nickname: nickname.trim(),
          stageMode: draft.stageMode,
          dueDate: draft.stageMode === "pregnant" && trimmedDate ? trimmedDate : undefined,
          birthDate: draft.stageMode === "born" && trimmedDate ? trimmedDate : undefined,
          manualStage: draft.stageMode === "manual" ? manualStage : undefined
        },
        idempotencyKey
      );
      return child;
    },
    onSuccess: (child) => {
      setSelectedChildId(child.id);
      completeStep("ONB-002");
      clearChildCreateIdempotencyKey();
      router.push("/onboarding/prepared-items");
    }
  });

  return (
    <AppScreen>
      <View testID="screen-ONB-002" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-002" />
        <ScreenHeader eyebrow="아이 프로필" title="아이를 소개해 주세요" subtitle="태명이나 별명을 알려주시면 앞으로 이렇게 부를게요." />

        <Card style={{ gap: theme.spacing.gap }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
              태명 / 별명
            </Text>
            <TextInput
              accessibilityLabel="태명 또는 별명 입력"
              returnKeyType="done"
              onChangeText={setNickname}
              placeholder="예) 튼튼이"
              style={{
                backgroundColor: theme.colors.beige,
                borderColor: nicknameError ? theme.colors.danger : "transparent",
                borderRadius: theme.radii.small,
                borderWidth: 1,
                color: theme.colors.brown,
                fontSize: theme.typography.body1.fontSize,
                minHeight: theme.touchTarget,
                paddingHorizontal: 14
              }}
              value={nickname}
            />
            {nicknameError ? (
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{nicknameError}</Text>
            ) : null}
          </View>

          {dateLabel ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                {dateLabel}
              </Text>
              <TextInput
                accessibilityLabel={`${dateLabel} 입력`}
                // 라운드 45 UX-Y(S): 예정일/생년월일은 숫자와 하이픈만 쓰는 입력이라 지출 화면의
                // 날짜 직접 입력(app/expenses/[expenseId].tsx)과 같은 숫자 키패드를 띄운다.
                // 길이도 YYYY-MM-DD 10자로 막아 오타를 줄인다 — 형식/달력 검증은 그대로
                // computeDateError가 한다.
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                returnKeyType="done"
                onChangeText={setDateText}
                placeholder="YYYY-MM-DD"
                style={{
                  backgroundColor: theme.colors.beige,
                  borderColor: dateError ? theme.colors.danger : "transparent",
                  borderRadius: theme.radii.small,
                  borderWidth: 1,
                  color: theme.colors.brown,
                  fontSize: theme.typography.body1.fontSize,
                  minHeight: theme.touchTarget,
                  paddingHorizontal: 14
                }}
                value={dateText}
              />
              {dateError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{dateError}</Text>
              ) : (
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                  날짜 없이 태명만으로도 계속할 수 있어요.
                </Text>
              )}
            </View>
          ) : null}

          {draft.stageMode === "manual" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                아이 단계 선택
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CHILD_STAGE_CODES.map((code) => (
                  <CategoryChip
                    key={code}
                    label={CHILD_STAGE_LABELS[code]}
                    selected={manualStage === code}
                    onPress={() => setManualStage(code)}
                  />
                ))}
              </View>
              {manualStageError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{manualStageError}</Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {save.isError ? <OnboardingSaveErrorCard onRetry={() => save.mutate()} /> : null}

        <PrimaryButton
          disabled={!canSave || save.isPending}
          label={save.isPending ? "저장하는 중" : "다음"}
          onPress={() => save.mutate()}
        />
      </View>
    </AppScreen>
  );
}
