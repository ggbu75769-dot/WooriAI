import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { createChild, LOCAL_HOUSEHOLD_ID, fixtureSessionToken } from "../../src/api/client";
import { ChildProfileFields, type ChildProfileDraft } from "../../src/children/ChildProfileFields";
import { invalidateChildScopedQueries } from "../../src/children/query-cache";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, SampleDataBanner, ScreenHeader } from "../../src/ui";

const initialValue: ChildProfileDraft = {
  nickname: "",
  stageMode: "born",
  dueDate: "",
  birthDate: "",
  manualStage: null,
  gender: ""
};

export default function NewChildScreen() {
  const params = useLocalSearchParams<{ evidence?: string }>();
  const isPixelEvidence =
    isPixelLockBuild() && String(params.evidence ?? "") === "PROFILE-GENDER-001";
  const accessToken = useSessionStore((state) => state.accessToken);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession || isPixelEvidence ? fixtureSessionToken : null);
  const householdId = defaultHouseholdId ?? (isTestSession || isPixelEvidence ? LOCAL_HOUSEHOLD_ID : null);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(`child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const create = useMutation({
    mutationFn: async (draft: ChildProfileDraft) => {
      if (!authToken || !householdId) throw new Error("missing child creation context");
      return createChild(
        authToken,
        {
          householdId,
          nickname: draft.nickname.trim(),
          stageMode: draft.stageMode,
          dueDate: draft.stageMode === "pregnant" ? draft.dueDate : undefined,
          birthDate: draft.stageMode === "born" ? draft.birthDate : undefined,
          manualStage: draft.stageMode === "manual" ? draft.manualStage : undefined,
          gender: draft.gender || undefined
        },
        idempotencyKey.current
      );
    },
    onSuccess: async (child) => {
      setSelectedChildId(child.id, householdId);
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      await invalidateChildScopedQueries(queryClient);
      router.replace("/children" as Href);
    }
  });

  if (!authToken) return <Redirect href="/launch-animation" />;
  if (!householdId) return <Redirect href="/" />;

  return (
    <AppScreen>
      <View
        accessibilityLabel={isPixelEvidence ? "PROFILE-GENDER-001" : "아이 추가"}
        testID={isPixelEvidence ? "screen-PROFILE-GENDER-001" : "screen-CHILD-NEW"}
        style={{ gap: theme.spacing.section }}
      >
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="CHILD-001" title="아이 추가" subtitle="아이마다 기록, 예산, 준비 현황을 따로 관리해요." />
        <ChildProfileFields
          failed={create.isError}
          initialValue={
            isPixelEvidence
              ? { ...initialValue, nickname: "검증용 아이", birthDate: "2024-01-01", gender: "female" }
              : initialValue
          }
          onSubmit={(draft) => create.mutate(draft)}
          pending={create.isPending}
          submitLabel="아이 추가"
        />
      </View>
    </AppScreen>
  );
}
