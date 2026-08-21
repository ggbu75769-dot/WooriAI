import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Platform, RefreshControl, Text, View, type ImageSourcePropType } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildItemStatusChangedPayload } from "../../src/analytics/events";
import { getHome, listItems, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemStatus, type ItemSummary } from "../../src/api/client";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, CategoryChip, EmptyStateCard, ProductCard, SecondaryButton } from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";
import { itemMatchesBand, resolveDefaultStageLabel } from "../../src/items/stage-bands";
import { computeEssentialPrepProgress } from "../../src/items/prep-progress";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

const toddlerImage = require("../../assets/illustrations/toddler.png");
const recommendationBabyCarrierImage = require("../../assets/illustrations/recommendation_baby_carrier.png");
const recommendationDiaperImage = require("../../assets/illustrations/recommendation_diaper.png");
const recommendationBlocksImage = require("../../assets/illustrations/recommendation_blocks.png");
const tabOptions = ["0-6개월", "6-12개월", "12-24개월", "24개월+"] as const;
// UX-5B-10b: 서버 items API의 tab 파라미터(now/soon/prepared/not_needed)를 그대로 쓰는
// 상태 필터 -- 기존에는 tab="now"만 조회해 클라이언트에서 걸렀다.
const statusTabOptions = [
  { value: "now", label: "지금 필요" },
  { value: "soon", label: "곧 필요" },
  { value: "prepared", label: "준비완료" },
  { value: "not_needed", label: "괜찮아요" }
] as const;
type StatusTabValue = (typeof statusTabOptions)[number]["value"];
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
  const [hasManualStageSelection, setHasManualStageSelection] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTabValue>("now");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ["items", childId, statusTab, stageLabel],
    enabled: Boolean(authToken && childId),
    queryFn: () => listItems(authToken!, childId!, statusTab)
  });
  // ITEM-114: 시기 준비율 계산용 전 상태 스냅샷. 현재 리스트 쿼리는 선택된 상태 탭 하나만
  // 조회하므로 준비율(분모=필수 전체, 분자=해결됨)을 계산할 수 없다. 4개 탭을 합치면 gifted를
  // 제외한 모든 활성 항목이 정확히 한 번씩 모인다(탭들은 상태 기준 서로소 -- 서버
  // itemsForChild 참고; gifted 한계는 src/items/prep-progress.ts 주석 참고). 쿼리 키가
  // ["items", ...] 접두어를 공유하므로 상태 변경 뮤테이션의 invalidateQueries(["items"])로
  // 함께 갱신된다. 픽셀 락 캡처 중에는 화면에 그리지 않으므로 조회도 하지 않는다.
  const allStatusItems = useQuery({
    queryKey: ["items", childId, "prep-progress"],
    enabled: Boolean(authToken && childId) && !isPixelLockMode,
    queryFn: async () => {
      const tabs = ["now", "soon", "prepared", "not_needed"] as const;
      const responses = await Promise.all(tabs.map((tab) => listItems(authToken!, childId!, tab)));
      return responses.flatMap((response) => response.items);
    }
  });
  // Default the selected chip to the child's actual current stage once it's known, unless the
  // pixel-lock capture is running, we're in the loginless test session (fixture data must render
  // deterministically), or the user already tapped a chip. Falls back to "12-24개월" otherwise.
  const shouldResolveChildStage = Boolean(authToken && childId) && !isPixelLockMode && !isTestSession;
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: shouldResolveChildStage,
    queryFn: () => getHome(authToken!, childId!)
  });
  useEffect(() => {
    setStageLabel(
      resolveDefaultStageLabel({
        currentStage: home.data?.child.currentStage,
        isPixelLockMode,
        isTestSession,
        hasManualSelection: hasManualStageSelection,
        fallback: "12-24개월"
      })
    );
  }, [home.data, isTestSession, hasManualStageSelection]);
  const updateStatus = useMutation({
    mutationFn: ({ itemTemplateId, status }: { itemTemplateId: string; itemName: string; status: ItemStatus }) =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onSuccess: async (_data, variables) => {
      // ANA-103: fires only after the server confirmed the status change. The payload carries
      // only the coarse category enum (derived on-device from the item name, which itself never
      // leaves the device -- src/analytics/events.ts) and the new status. A no-op without
      // ANA-102 consent (src/analytics/flag.ts).
      trackAndFlushAnalyticsEvent(authToken, {
        eventName: "item_status_changed",
        payload: buildItemStatusChangedPayload({ itemName: variables.itemName, status: variables.status }),
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });
  const hasSession = Boolean(authToken && childId);

  // MOB-117 당겨서 새로고침: ["items"] 접두어 invalidate로 현재 상태 탭 목록 + ITEM-114
  // 준비율 스냅샷을 함께 갱신하고, 기본 시기 칩이 읽는 ["home"] 캐시도 갱신한다.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] })
    ])
  );

  if (hasSession && (items.isLoading || !items.data)) {
    // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.gap }}>
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
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
    ? visibleItems.filter((item) => itemMatchesBand(item, stageLabel))
    : visibleItems;
  const showEmptyState = hasSession ? stageFilteredItems.length === 0 : false;
  const canUpdateStatus = hasSession;
  // ITEM-114: 선택된 시기 밴드(기본 칩은 아이의 현재 시기) 기준 필수템 준비율. 필수템이
  // 0개인 밴드나 스냅샷 로딩 전에는 null이라 요약 줄이 통째로 숨는다.
  const prepProgress =
    hasSession && !isPixelLockMode && allStatusItems.data
      ? computeEssentialPrepProgress(allStatusItems.data, stageLabel)
      : null;

  return (
    <AppScreen
      refreshControl={
        // 비세션 미리보기(previewItems)에는 새로고침할 서버 데이터가 없으므로 붙이지 않는다 (MOB-117).
        hasSession ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.mainCoral}
            colors={[theme.colors.mainCoral]}
          />
        ) : undefined
      }
    >
      <View style={recommendationPixelScaleFrameStyle()}>
        <View testID={recommendationScreenId} style={recommendationPixelFrameStyle}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.brown, fontSize: 22, fontWeight: "800" }}>추천</Text>
            <Text accessible={false} style={{ color: theme.colors.brown, fontSize: 18 }}>♡</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginHorizontal: -12 }}>
            {tabOptions.map((option) => (
              <CategoryChip
                key={option}
                label={option}
                selected={option === stageLabel}
                onPress={() => {
                  setHasManualStageSelection(true);
                  setStageLabel(option);
                }}
              />
            ))}
          </View>

          {/* UX-5B-10b: 상태 필터 (서버 tab 파라미터와 1:1) -- 세션이 있을 때만 의미가 있다. */}
          {hasSession ? (
            <View style={{ flexDirection: "row", gap: 6, marginHorizontal: -12 }}>
              {statusTabOptions.map((option) => (
                <CategoryChip
                  key={option.value}
                  label={option.label}
                  selected={option.value === statusTab}
                  onPress={() => setStatusTab(option.value)}
                />
              ))}
            </View>
          ) : null}

          <View style={{ backgroundColor: theme.colors.beige, borderRadius: 22, minHeight: 92, overflow: "hidden", padding: 15 }}>
            <View style={{ maxWidth: 210 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800", lineHeight: 24 }}>{stageLabel} 맞춤 추천</Text>
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

          {/* ITEM-114: 리스트 상단 얇은 준비율 요약 한 줄. 정보는 텍스트가 전달하고 바는
              보조 시각화다(색만으로 의미 전달 금지). progressbar 롤 + accessibilityValue로
              스크린 리더에도 동일 정보를 제공한다. DNC-002/003: 탭·리스트 구조는 그대로다. */}
          {prepProgress ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${prepProgress.summaryText}, ${prepProgress.percent}%`}
              accessibilityValue={{ min: 0, max: 100, now: prepProgress.percent }}
              style={{ gap: 6 }}
            >
              <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>{prepProgress.summaryText}</Text>
                <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700", lineHeight: 18 }}>
                  {prepProgress.percent}%
                </Text>
              </View>
              <View style={{ backgroundColor: theme.colors.peach, borderRadius: theme.radii.pill, height: 6, overflow: "hidden" }}>
                <View
                  style={{
                    backgroundColor: theme.colors.mainCoral,
                    borderRadius: theme.radii.pill,
                    height: 6,
                    width: `${prepProgress.percent}%`
                  }}
                />
              </View>
            </View>
          ) : null}

          {showEmptyState ? (
            <EmptyStateCard
              title={statusTab === "now" ? "지금 필요한 추천템이 없어요." : "이 조건에 맞는 준비템이 없어요."}
              actionLabel="홈으로 가기"
              onPress={() => router.push("/(tabs)")}
            />
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
                          accessibilityLabel={`${item.name} 준비했어요`}
                          onPress={() => updateStatus.mutate({ itemTemplateId: item.id, itemName: item.name, status: "prepared" })}
                          style={{ flex: 1 }}
                        />
                        <SecondaryButton
                          label="괜찮아요"
                          accessibilityLabel={`${item.name} 괜찮아요`}
                          onPress={() => updateStatus.mutate({ itemTemplateId: item.id, itemName: item.name, status: "not_needed" })}
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
