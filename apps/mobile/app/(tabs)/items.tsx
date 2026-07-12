import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Text, View, type ImageSourcePropType } from "react-native";
import { listItems, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemStatus, type ItemSummary } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, CategoryChip, EmptyStateCard, ProductCard, SecondaryButton } from "../../src/ui";
import { theme } from "../../src/theme";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";

const toddlerImage = require("../../assets/illustrations/toddler.png");
const recommendationBabyCarrierImage = require("../../assets/illustrations/recommendation_baby_carrier.png");
const recommendationDiaperImage = require("../../assets/illustrations/recommendation_diaper.png");
const recommendationBlocksImage = require("../../assets/illustrations/recommendation_blocks.png");
const tabOptions = ["0-6개월", "6-12개월", "12-24개월", "24개월+"] as const;
const recommendationScreenId = "pixel-screen-ITEM-001 ITEM-001";
const recommendationHorizontalOffset = 0;
const recommendationVerticalOffset = 0;
function recommendationPixelScaleFrameStyle() {
  return {
    transform: [
      { translateX: ItemListPixelStyles.horizontalOffset },
      { translateY: ItemListPixelStyles.topOffset },
      { scale: ItemListPixelStyles.scale }
    ]
  } as const;
}
const recommendationPixelFrameStyle = {
  gap: 14,
  transform: [{ translateX: recommendationHorizontalOffset }, { translateY: recommendationVerticalOffset }]
};
type RecommendationPreviewItem = ItemSummary & {
  badgeText: string;
  caption: string;
  image: ImageSourcePropType;
};
const recommendationPreviewImages = [recommendationBabyCarrierImage, recommendationDiaperImage, recommendationBlocksImage] as const;
const recommendationPreviewCaptions = ["★ 4.7 (1,245)", "★ 4.8 (2,154)", "★ 4.6 (982)"] as const;
const previewItems: RecommendationPreviewItem[] = [
  {
    id: "preview-baby-carrier-hipseat",
    name: "베이비 아기띠 힙시트",
    necessityLevel: "essential",
    status: "not_prepared",
    timingLabel: "12-24개월",
    priceBandText: "₩89,000",
    badgeText: "BEST",
    caption: recommendationPreviewCaptions[0],
    image: recommendationBabyCarrierImage
  },
  {
    id: "preview-naturelove-diaper",
    name: "네이처러브 기저귀 팬티형",
    necessityLevel: "convenience",
    status: "interested",
    timingLabel: "12-24개월",
    priceBandText: "₩42,900",
    badgeText: "BEST",
    caption: recommendationPreviewCaptions[1],
    image: recommendationDiaperImage
  },
  {
    id: "preview-wood-block-set",
    name: "도담도담 원목 블록 세트",
    necessityLevel: "optional",
    status: "gifted",
    timingLabel: "24개월+",
    priceBandText: "₩33,800",
    badgeText: "NEW",
    caption: recommendationPreviewCaptions[2],
    image: recommendationBlocksImage
  }
];

function statusLabel(status: ItemStatus) {
  if (status === "prepared") return "이미 준비";
  if (status === "not_needed") return "필요 없음";
  if (status === "interested") return "관심";
  if (status === "gifted") return "선물 받음";
  return "준비 전";
}

function getRecommendationDisplay(item: ItemSummary | RecommendationPreviewItem, index: number) {
  if ("image" in item) {
    return { badge: item.badgeText, caption: item.caption, image: item.image };
  }

  return {
    badge: index === 0 ? "BEST" : statusLabel(item.status),
    caption: undefined,
    image: recommendationPreviewImages[index % recommendationPreviewImages.length]
  };
}

export default function ItemsScreen() {
  const [stageLabel, setStageLabel] = useState<(typeof tabOptions)[number]>("12-24개월");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ["items", childId, "now", stageLabel],
    enabled: Boolean(authToken && childId),
    queryFn: () => listItems(authToken!, childId!, "now")
  });
  const updateStatus = useMutation({
    mutationFn: ({ itemTemplateId, status }: { itemTemplateId: string; status: ItemStatus }) =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });
  const hasSession = Boolean(authToken && childId);

  if (hasSession && (items.isLoading || !items.data)) {
    return (
      <AppScreen>
        <EmptyStateCard title="추천템을 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (hasSession && items.isError) {
    return (
      <AppScreen>
        <EmptyStateCard
          title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onPress={() => items.refetch()}
        />
      </AppScreen>
    );
  }

  const visibleItems = hasSession ? items.data!.items : previewItems;
  const stageFilteredItems = hasSession
    ? visibleItems.filter((item) => !item.timingLabel || item.timingLabel === stageLabel)
    : visibleItems;
  const showEmptyState = hasSession ? stageFilteredItems.length === 0 : false;
  const canUpdateStatus = hasSession;

  return (
    <AppScreen>
      <View style={recommendationPixelScaleFrameStyle()}>
        <View accessibilityLabel={recommendationScreenId} style={recommendationPixelFrameStyle}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.brown, fontSize: 22, fontWeight: "800" }}>추천</Text>
            <Text style={{ color: theme.colors.brown, fontSize: 18 }}>♡</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginHorizontal: -12 }}>
            {tabOptions.map((option) => (
              <CategoryChip key={option} label={option} selected={option === stageLabel} onPress={() => setStageLabel(option)} />
            ))}
          </View>

          <View style={{ backgroundColor: theme.colors.beige, borderRadius: 22, minHeight: 92, overflow: "hidden", padding: 15 }}>
            <View style={{ maxWidth: 210 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800", lineHeight: 24 }}>12-24개월 맞춤 추천</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18, marginTop: 7 }}>
                우리아이 발달 단계에 꼭 필요한 제품
              </Text>
            </View>
            <Image
              source={toddlerImage}
              resizeMode="cover"
              style={{ bottom: -8, height: 92, position: "absolute", right: 12, width: 74 }}
            />
          </View>

          {showEmptyState ? (
            <EmptyStateCard title="지금 필요한 추천템이 없어요." actionLabel="홈으로 가기" onPress={() => router.push("/(tabs)")} />
          ) : (
            <View style={{ gap: 10 }}>
              {stageFilteredItems.map((item, index) => {
                const display = getRecommendationDisplay(item, index);

                return (
                  <View key={item.id} style={{ gap: 8 }}>
                    <ProductCard
                      title={item.name}
                      price={item.priceBandText ?? "가격 정보 확인"}
                      badge={display.badge}
                      caption={display.caption}
                      image={display.image}
                      onPress={() => router.push(`/items/${item.id}`)}
                    />
                    {canUpdateStatus ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <SecondaryButton
                          label="준비했어요"
                          onPress={() => updateStatus.mutate({ itemTemplateId: item.id, status: "prepared" })}
                          style={{ flex: 1 }}
                        />
                        <SecondaryButton
                          label="괜찮아요"
                          onPress={() => updateStatus.mutate({ itemTemplateId: item.id, status: "not_needed" })}
                          style={{ flex: 1 }}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {hasSession ? null : (
            <SecondaryButton label="‹ 더 많은 추천 보기" onPress={() => router.push("/(tabs)/items")} />
          )}
        </View>
      </View>
    </AppScreen>
  );
}
