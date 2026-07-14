import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { getHome, listItems, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemStatus, type ItemSummary } from "../../src/api/client";
import { itemMatchesBand, resolveDefaultStageLabel } from "../../src/items/stage-bands";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  AppIcon,
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  IconButton,
  ProductCard,
  SampleDataBanner,
  SecondaryButton
} from "../../src/ui";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
const stageOptions = ["0-6개월", "6-12개월", "12-24개월", "24개월+"] as const;
const recommendationScreenId = "pixel-screen-ITEM-001 ITEM-001";

type ItemTab = "now" | "soon" | "prepared" | "not_needed";
const statusTabs: Array<{ value: ItemTab; label: string }> = [
  { value: "now", label: "지금 필요" },
  { value: "soon", label: "곧 필요" },
  { value: "prepared", label: "준비 완료" },
  { value: "not_needed", label: "필요 없음" }
];

function recommendationPixelScaleFrameStyle() {
  return {
    transform: [
      { translateX: ItemListPixelStyles.horizontalOffset },
      { translateY: ItemListPixelStyles.topOffset },
      { scale: ItemListPixelStyles.scale }
    ]
  } as const;
}

const previewItems: ItemSummary[] = [
  {
    id: "preview-car-seat",
    name: "카시트",
    necessityLevel: "essential",
    status: "not_prepared",
    timingLabel: "출산 전",
    priceBandText: "150,000~800,000원",
    stageCodes: ["toddler_1_3"]
  },
  {
    id: "preview-baby-bath",
    name: "아기 욕조",
    necessityLevel: "convenience",
    status: "not_prepared",
    timingLabel: "출산 전",
    priceBandText: "20,000~80,000원",
    stageCodes: ["toddler_1_3"]
  }
];

function necessityLabel(level: ItemSummary["necessityLevel"]) {
  if (level === "essential") return "필수";
  if (level === "convenience") return "편의";
  return "선택";
}

function statusLabel(status: ItemStatus) {
  if (status === "prepared") return "준비 완료";
  if (status === "not_needed") return "필요 없음";
  if (status === "interested") return "관심";
  if (status === "gifted") return "선물 받음";
  return "준비 전";
}

export default function ItemsScreen() {
  const [selectedTab, setSelectedTab] = useState<ItemTab>("now");
  const [stageLabel, setStageLabel] = useState<(typeof stageOptions)[number]>("12-24개월");
  const [hasManualStageSelection, setHasManualStageSelection] = useState(false);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const hasSession = Boolean(authToken && childId);
  const queryClient = useQueryClient();

  const items = useQuery({
    queryKey: ["items", childId, selectedTab],
    enabled: hasSession,
    queryFn: () => listItems(authToken!, childId!, selectedTab)
  });
  const preparedItems = useQuery({
    queryKey: ["items", childId, "prepared"],
    enabled: hasSession,
    queryFn: () => listItems(authToken!, childId!, "prepared")
  });
  const nowItems = useQuery({
    queryKey: ["items", childId, "now"],
    enabled: hasSession,
    queryFn: () => listItems(authToken!, childId!, "now")
  });
  const soonItems = useQuery({
    queryKey: ["items", childId, "soon"],
    enabled: hasSession,
    queryFn: () => listItems(authToken!, childId!, "soon")
  });
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: hasSession,
    queryFn: () => getHome(authToken!, childId!)
  });

  useEffect(() => {
    setStageLabel(
      resolveDefaultStageLabel({
        currentStage: home.data?.child.currentStage,
        isPixelLockMode,
        isTestSession: false,
        hasManualSelection: hasManualStageSelection,
        fallback: "12-24개월"
      })
    );
  }, [home.data?.child.currentStage, hasManualStageSelection]);

  const updateStatus = useMutation({
    mutationFn: ({ itemTemplateId, status }: { itemTemplateId: string; status: ItemStatus }) =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items", childId] });
      await queryClient.invalidateQueries({ queryKey: ["home", childId] });
    }
  });

  if (!hasSession && !isPixelLockMode) return <Redirect href="/onboarding/child-status" />;

  if (hasSession && items.isLoading) {
    return (
      <AppScreen>
        {isTestSession ? <SampleDataBanner /> : null}
        <EmptyStateCard title="준비템을 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (hasSession && items.isError) {
    return (
      <AppScreen>
        <EmptyStateCard title="준비템을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => items.refetch()} />
      </AppScreen>
    );
  }

  const visibleItems = hasSession ? items.data?.items ?? [] : previewItems;
  const stageFilteredItems = visibleItems.filter((item) => itemMatchesBand(item, stageLabel));
  const preparedCount = preparedItems.data?.items.length ?? 0;
  const remainingCount = (nowItems.data?.items.length ?? 0) + (soonItems.data?.items.length ?? 0);
  const totalCount = preparedCount + remainingCount;

  return (
    <AppScreen>
      <View style={recommendationPixelScaleFrameStyle()}>
        <View accessibilityLabel={recommendationScreenId} style={{ gap: 14 }}>
          {isTestSession ? <SampleDataBanner /> : null}
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 22, fontWeight: "800" }}>준비템</Text>
              <Text numberOfLines={2} style={{ color: theme.colors.gray600, fontSize: 11 }}>
                필요도와 준비 시기를 먼저 확인하고, 항목에서 필요한 이유를 볼 수 있어요.
              </Text>
              {home.data?.child ? (
                <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
                  {home.data.child.nickname} · {home.data.child.stageLabel}
                </Text>
              ) : null}
            </View>
            <IconButton accessibilityLabel="내 프로필" icon="account-circle-outline" onPress={() => router.push("/profile" as Href)} />
          </View>

          {hasSession && totalCount > 0 ? (
            <Card style={{ gap: 8 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <AppIcon color={theme.colors.coral[600]} name="check-circle-outline" size={24} />
                <Text style={{ color: theme.colors.brown, flex: 1, fontSize: 14, fontWeight: "800" }}>
                  준비 완료 {preparedCount}개 · 남은 항목 {remainingCount}개
                </Text>
              </View>
              <View style={{ backgroundColor: theme.colors.gray300, borderRadius: 999, height: 7, overflow: "hidden" }}>
                <View
                  style={{
                    backgroundColor: theme.colors.coral[500],
                    height: 7,
                    width: `${Math.round((preparedCount / totalCount) * 100)}%`
                  }}
                />
              </View>
            </Card>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {statusTabs.map((tab) => (
              <CategoryChip key={tab.value} label={tab.label} selected={selectedTab === tab.value} onPress={() => setSelectedTab(tab.value)} />
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {stageOptions.map((option) => (
              <CategoryChip
                key={option}
                label={option}
                selected={stageLabel === option}
                onPress={() => {
                  setHasManualStageSelection(true);
                  setStageLabel(option);
                }}
              />
            ))}
          </ScrollView>

          {stageFilteredItems.length === 0 ? (
            <EmptyStateCard
              title={selectedTab === "prepared" ? "아직 준비 완료한 항목이 없어요." : selectedTab === "not_needed" ? "필요 없음으로 정한 항목이 없어요." : "이 단계에 표시할 준비템이 없어요."}
              actionLabel={selectedTab === "now" ? "다음 단계 보기" : "지금 필요한 항목 보기"}
              onPress={() => setSelectedTab(selectedTab === "now" ? "soon" : "now")}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {stageFilteredItems.map((item) => (
                <View key={item.id} style={{ gap: 8 }}>
                  <ProductCard
                    title={item.name}
                    price={`준비 시기 · ${item.timingLabel ?? "확인 필요"}`}
                    badge={necessityLabel(item.necessityLevel)}
                    caption={`상태 · ${statusLabel(item.status)}`}
                    onPress={() => router.push(`/items/${item.id}`)}
                  />
                  {hasSession && (selectedTab === "now" || selectedTab === "soon") ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <SecondaryButton
                        label="준비했어요"
                        onPress={() => updateStatus.mutate({ itemTemplateId: item.id, status: "prepared" })}
                        style={{ flex: 1 }}
                      />
                      <SecondaryButton
                        label="필요 없어요"
                        onPress={() => updateStatus.mutate({ itemTemplateId: item.id, status: "not_needed" })}
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </AppScreen>
  );
}
