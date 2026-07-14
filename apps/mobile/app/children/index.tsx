import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { listChildren, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppIcon, AppScreen, EmptyStateCard, ListRow, SampleDataBanner, ScreenHeader } from "../../src/ui";

export default function ChildSwitcherScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });

  if (!authToken) return <Redirect href="/onboarding/child-status" />;
  const childRows = children.data?.children ?? [];

  const selectChild = async (childId: string) => {
    setSelectedChildId(childId);
    await Promise.all(
      ["home", "expenses", "items", "report", "budget"].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [queryKey] })
      )
    );
    router.replace("/(tabs)");
  };

  return (
    <AppScreen>
      <View accessibilityLabel="아이 전환" testID="screen-CHILD-001" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="아이 프로필" title="아이 전환" subtitle="기록과 준비 현황을 확인할 아이를 선택해 주세요." />

        {children.isLoading ? (
          <EmptyStateCard title="아이 목록을 불러오고 있어요." actionLabel="잠시만요" />
        ) : children.isError ? (
          <EmptyStateCard title="아이 목록을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => children.refetch()} />
        ) : childRows.length === 0 ? (
          <EmptyStateCard
            title="등록된 아이가 없어요. 아이 프로필을 먼저 만들어 주세요."
            actionLabel="아이 프로필 만들기"
            onPress={() => router.replace("/onboarding/child-status")}
          />
        ) : (
          <View style={{ gap: theme.spacing.gap }}>
            {childRows.map((child) => {
              const selected = child.id === selectedChildId;
              return (
                <ListRow
                  key={child.id}
                  icon={<AppIcon color={theme.colors.coral[600]} name="account-child-circle" size={24} />}
                  title={child.nickname}
                  subtitle={child.stageLabel}
                  value={selected ? "현재 아이" : "전환"}
                  onPress={() => selectChild(child.id)}
                />
              );
            })}
          </View>
        )}
      </View>
    </AppScreen>
  );
}
