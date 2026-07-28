import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { CheckCard, EmptyStateCard, AppScreen, SampleDataBanner, Toast, TopAppBar } from "../src/design-system";
import {
  fixtureSessionToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences
} from "../src/api/client";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";

type Editable = Pick<NotificationPreferences, "familyEnabled" | "replacementEnabled" | "budgetEnabled" | "marketingEnabled">;
type EditableKey = keyof Editable;

const defaults: Editable = {
  familyEnabled: true,
  replacementEnabled: true,
  budgetEnabled: true,
  marketingEnabled: false
};

export default function NotificationPreferencesScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", householdId ?? "local"] as const;
  const preferences = useQuery({ queryKey, enabled: Boolean(token && !isTestSession), queryFn: () => getNotificationPreferences(token!) });
  const [draft, setDraft] = useState<Editable>(defaults);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data) {
      setDraft({
        familyEnabled: preferences.data.familyEnabled,
        replacementEnabled: preferences.data.replacementEnabled,
        budgetEnabled: preferences.data.budgetEnabled,
        marketingEnabled: preferences.data.marketingEnabled
      });
    }
  }, [preferences.data]);

  const save = useMutation({
    mutationFn: ({ next, expectedVersion }: { next: Editable; expectedVersion: number; previous: Editable }) =>
      updateNotificationPreferences(token!, { ...next, expectedVersion }),
    onMutate: async ({ next }) => {
      setErrorMessage(null);
      await queryClient.cancelQueries({ queryKey });
      const previousQuery = queryClient.getQueryData<NotificationPreferences>(queryKey);
      if (previousQuery) queryClient.setQueryData(queryKey, { ...previousQuery, ...next });
      return { previousQuery };
    },
    onSuccess: (value) => {
      queryClient.setQueryData(queryKey, value);
      setDraft({
        familyEnabled: value.familyEnabled,
        replacementEnabled: value.replacementEnabled,
        budgetEnabled: value.budgetEnabled,
        marketingEnabled: value.marketingEnabled
      });
    },
    onError: (_error, variables, context) => {
      setDraft(variables.previous);
      if (context?.previousQuery) queryClient.setQueryData(queryKey, context.previousQuery);
      setErrorMessage("저장하지 못했어요. 이전 설정으로 되돌렸습니다. 다시 시도해 주세요.");
    }
  });

  if (!token) return <Redirect href="/launch-animation" />;
  if (isTestSession) {
    return (
      <AppScreen>
        <SampleDataBanner />
        <TopAppBar eyebrow="프로필" onBack={() => router.back()} title="알림 설정" />
        <EmptyStateCard title="샘플 계정에서는 알림 설정을 변경하지 않아요." actionLabel="실제 계정에서 이용해 주세요" />
      </AppScreen>
    );
  }
  if (preferences.isLoading) return <AppScreen><EmptyStateCard title="알림 설정을 불러오고 있어요." actionLabel="잠시만요" /></AppScreen>;
  if (preferences.isError || !preferences.data) return <AppScreen><EmptyStateCard title="알림 설정을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => preferences.refetch()} /></AppScreen>;

  const toggle = (key: EditableKey, checked: boolean) => {
    if (save.isPending) return;
    const previous = draft;
    const next = { ...draft, [key]: checked };
    setDraft(next);
    save.mutate({ next, previous, expectedVersion: preferences.data.version });
  };

  return (
    <AppScreen>
      <View accessibilityLabel="PF-05 알림 설정" testID="screen-PF-05" style={{ gap: theme.spacing.section }}>
        <TopAppBar eyebrow="프로필" onBack={() => router.back()} title="알림 설정" />
        <View style={{ gap: 10 }}>
          <CheckCard busy={save.isPending} checked={draft.replacementEnabled} description="아이 단계에 맞춰 필요한 때에만 알려드려요" icon="calendar-heart" label="준비 시기 알림" onChange={(value) => toggle("replacementEnabled", value)} />
          <CheckCard busy={save.isPending} checked={draft.budgetEnabled} description="설정한 예산을 넘기기 전에 알려드려요" icon="wallet-outline" label="예산 초과 경고" onChange={(value) => toggle("budgetEnabled", value)} />
          <CheckCard busy={save.isPending} checked={draft.familyEnabled} description="가족의 초대와 공동 기록 변경을 알려드려요" icon="account-multiple-outline" label="가족 활동 알림" onChange={(value) => toggle("familyEnabled", value)} />
          <CheckCard busy={save.isPending} checked={draft.marketingEnabled} description="기본은 꺼짐이며 켜는 시점이 수신 동의로 기록돼요" icon="bell-ring-outline" label="소식 · 혜택 알림" onChange={(value) => toggle("marketingEnabled", value)} />
        </View>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>토글을 바꾸면 바로 저장돼요. 외부 push 채널이 연결되지 않은 환경에서는 앱 안에서만 확인할 수 있어요.</Text>
        {errorMessage ? <Toast message={errorMessage} tone="error" /> : null}
      </View>
    </AppScreen>
  );
}
