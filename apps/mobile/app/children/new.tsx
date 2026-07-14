import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { createChild, LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { ChildProfileFields, type ChildProfileDraft } from "../../src/children/ChildProfileFields";
import { invalidateChildScopedQueries } from "../../src/children/query-cache";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, SampleDataBanner, ScreenHeader } from "../../src/ui";

const initialValue: ChildProfileDraft = {
  nickname: "",
  stageMode: "born",
  dueDate: "",
  birthDate: "",
  manualStage: null
};

export default function NewChildScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const householdId = defaultHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
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
          manualStage: draft.stageMode === "manual" ? draft.manualStage : undefined
        },
        idempotencyKey.current
      );
    },
    onSuccess: async (child) => {
      setSelectedChildId(child.id);
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      await invalidateChildScopedQueries(queryClient);
      router.replace("/children" as Href);
    }
  });

  if (!authToken) return <Redirect href="/launch-animation" />;
  if (!householdId) return <Redirect href="/" />;

  return (
    <AppScreen>
      <View accessibilityLabel="아이 추가" testID="screen-CHILD-NEW" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="CHILD-001" title="아이 추가" subtitle="아이마다 기록, 예산, 준비 현황을 따로 관리해요." />
        <ChildProfileFields
          failed={create.isError}
          initialValue={initialValue}
          onSubmit={(draft) => create.mutate(draft)}
          pending={create.isPending}
          submitLabel="아이 추가"
        />
      </View>
    </AppScreen>
  );
}
