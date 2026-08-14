import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { getBudget, getChild, listItems, fixtureSessionToken, updateChild } from "../../src/api/client";
import { ChildProfileFields, type ChildProfileDraft } from "../../src/children/ChildProfileFields";
import { invalidateChildScopedQueries } from "../../src/children/query-cache";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { formatKrw } from "../../src/money";
import { useConfirmDiscardChanges } from "../../src/navigation/use-confirm-discard-changes";
import { theme } from "../../src/theme";
import { AppScreen, EmptyStateCard, InputField, SampleDataBanner, ScreenHeader, SecondaryButton } from "../../src/ui";

export default function EditChildScreen() {
  const { childId: childIdParam } = useLocalSearchParams<{ childId?: string }>();
  const childId = childIdParam ?? "";
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [allowExit, setAllowExit] = useState(false);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const child = useQuery({
    queryKey: ["children", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getChild(authToken!, childId)
  });
  const budget = useQuery({
    queryKey: ["budget", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getBudget(authToken!, childId)
  });
  const preparedItems = useQuery({
    queryKey: ["items", childId, "prepared"],
    enabled: Boolean(authToken && childId),
    queryFn: () => listItems(authToken!, childId, "prepared")
  });
  const update = useMutation({
    mutationFn: async (draft: ChildProfileDraft) => {
      if (!authToken || !childId) throw new Error("missing child update context");
      return updateChild(authToken, childId, {
        nickname: draft.nickname.trim(),
        stageMode: draft.stageMode,
        dueDate: draft.stageMode === "pregnant" ? draft.dueDate : undefined,
        birthDate: draft.stageMode === "born" ? draft.birthDate : undefined,
        manualStage: draft.stageMode === "manual" ? draft.manualStage ?? undefined : undefined,
        gender: draft.gender
      });
    },
    onSuccess: async () => {
      setAllowExit(true);
      setSelectedChildId(childId, child.data?.householdId ?? null);
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      await invalidateChildScopedQueries(queryClient);
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        router.replace("/children" as Href);
      }, 50);
    }
  });

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
  }, []);
  useConfirmDiscardChanges(hasUnsavedChanges && !allowExit && !update.isPending);

  if (!authToken) return <Redirect href="/launch-animation" />;
  if (child.isLoading) return <AppScreen><EmptyStateCard title="아이 프로필을 불러오고 있어요." actionLabel="잠시만요" /></AppScreen>;
  if (child.isError || !child.data) {
    return <AppScreen><EmptyStateCard title="아이 프로필을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => child.refetch()} /></AppScreen>;
  }

  const initialValue: ChildProfileDraft = {
    nickname: child.data.nickname,
    stageMode: child.data.stageMode,
    dueDate: child.data.dueDate ?? "",
    birthDate: child.data.birthDate ?? "",
    manualStage: child.data.manualStage,
    gender: child.data.gender ?? ""
  };

  return (
    <AppScreen>
      <View accessibilityLabel="아이 프로필 수정" testID="screen-CHILD-002" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="아이 관리" onBack={() => router.back()} title="아이 프로필" subtitle="이름과 성장 기준을 바꾸면 홈과 준비템 추천이 바로 갱신돼요." />
        <ChildProfileFields
          failed={update.isError}
          initialValue={initialValue}
          onDirtyChange={setHasUnsavedChanges}
          onSubmit={(draft) => update.mutate(draft)}
          pending={update.isPending}
          submitLabel="변경사항 저장"
          submitOnlyWhenChanged
        />
        <View style={{ gap: theme.spacing.gap }}>
          <InputField
            label="월 예산"
            value={budget.data ? formatKrw(budget.data.amountKrw) : "미설정"}
          />
          <InputField
            label="준비 현황"
            value={`준비 완료 ${preparedItems.data?.items.length ?? 0}개`}
          />
        </View>
        <SecondaryButton label="이 아이의 예산 설정" onPress={() => router.push("/budget")} />
        <SecondaryButton label="준비템 현황 보기" onPress={() => router.push("/(tabs)/items")} />
      </View>
    </AppScreen>
  );
}
