import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { createChild, LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

const onboardingChildProfileScreenId = "ONB-002";
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function dateFieldLabel(stageMode: string | null) {
  if (stageMode === "pregnant") return "출산 예정일 (선택)";
  if (stageMode === "born") return "출생일 (선택)";
  return null;
}

export default function ChildProfileScreen() {
  const [nickname, setNickname] = useState("튼튼이");
  const [dateText, setDateText] = useState("");
  const session = useSessionStore();
  const authToken = session.accessToken ?? (session.isTestSession ? LOCAL_SESSION_TOKEN : null);
  const householdId = session.defaultHouseholdId ?? (session.isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const draft = useOnboardingProgressStore((state) => state.childDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);

  const nicknameError = nickname.trim().length === 0 ? "태명 또는 별명을 입력해 주세요." : null;
  const dateError = dateText.trim().length > 0 && !isoDatePattern.test(dateText.trim())
    ? "날짜는 YYYY-MM-DD 형식으로 입력해 주세요."
    : null;
  const dateLabel = useMemo(() => dateFieldLabel(draft.stageMode), [draft.stageMode]);
  const canSave = !nicknameError && !dateError && Boolean(authToken && householdId && draft.stageMode);

  const save = useMutation({
    mutationFn: async () => {
      if (!authToken || !householdId || !draft.stageMode) {
        throw new Error("missing onboarding context");
      }
      const trimmedDate = dateText.trim();
      const child = await createChild(authToken, {
        householdId,
        nickname: nickname.trim(),
        stageMode: draft.stageMode,
        dueDate: draft.stageMode === "pregnant" && trimmedDate ? trimmedDate : undefined,
        birthDate: draft.stageMode === "born" && trimmedDate ? trimmedDate : undefined,
        manualStage: draft.stageMode === "manual" ? "infant_4_6" : undefined
      });
      return child;
    },
    onSuccess: (child) => {
      setSelectedChildId(child.id);
      completeStep("ONB-002");
      router.push("/onboarding/prepared-items");
    }
  });

  return (
    <AppScreen>
      <View accessibilityLabel={onboardingChildProfileScreenId} testID="screen-ONB-002" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="아이 프로필" title="아이를 소개해 주세요" subtitle="태명이나 별명을 알려주시면 앞으로 이렇게 부를게요." />

        <Card style={{ gap: theme.spacing.gap }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
              태명 / 별명
            </Text>
            <TextInput
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
        </Card>

        {save.isError ? <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." /> : null}

        <PrimaryButton
          disabled={!canSave || save.isPending}
          label={save.isPending ? "저장하는 중" : "다음"}
          onPress={() => save.mutate()}
        />
      </View>
    </AppScreen>
  );
}
