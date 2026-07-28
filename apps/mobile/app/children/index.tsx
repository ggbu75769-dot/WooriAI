import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { listChildren, fixtureSessionToken } from "../../src/api/client";
import { invalidateChildScopedQueries } from "../../src/children/query-cache";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, EmptyStateCard, IconButton, ListRow, SampleDataBanner, ScreenHeader, SecondaryButton } from "../../src/ui";

export default function ChildSwitcherScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });

  if (!authToken) return <Redirect href="/launch-animation" />;
  const childRows = children.data?.children ?? [];

  const selectChild = async (childId: string, householdId?: string) => {
    setSelectedChildId(childId, householdId ?? null);
    await invalidateChildScopedQueries(queryClient);
    router.replace("/(tabs)");
  };

  return (
    <AppScreen>
      <View accessibilityLabel="아이 전환" testID="screen-CHILD-001" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader
          action={<IconButton accessibilityLabel="아이 추가" icon="plus" onPress={() => router.push("/children/new" as Href)} />}
          eyebrow="아이 프로필"
          title="아이 전환"
          subtitle="기록과 준비 현황을 확인할 아이를 선택해 주세요."
        />

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
                  icon={
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: theme.colors.peach,
                        borderRadius: 18,
                        height: 36,
                        justifyContent: "center",
                        width: 36
                      }}
                    >
                      <Text style={{ color: theme.colors.coral[600], fontSize: 16, fontWeight: "800" }}>
                        {child.nickname.trim().slice(0, 1) || "아"}
                      </Text>
                    </View>
                  }
                  title={child.nickname}
                  subtitle={child.stageLabel}
                  value={selected ? "현재 아이" : "전환"}
                  onPress={() => selectChild(child.id, child.householdId)}
                />
              );
            })}
          </View>
        )}

        <SecondaryButton label="아이 추가" onPress={() => router.push("/children/new" as Href)} />
        {selectedChildId ? (
          <SecondaryButton
            label="현재 아이 프로필 수정"
            onPress={() => router.push(`/children/${selectedChildId}` as Href)}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}
