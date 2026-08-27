import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Platform, RefreshControl, Text, TextInput, View, type ImageSourcePropType } from "react-native";
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
import { bandDefinitions, resolveDefaultStageLabel, type StageBandLabel } from "../../src/items/stage-bands";
import { computeEssentialPrepProgress } from "../../src/items/prep-progress";
import {
  filterItems,
  hasActiveItemFilter,
  NECESSITY_FILTER_OPTIONS,
  type NecessityFilter
} from "../../src/items/item-filters";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

const toddlerImage = require("../../assets/illustrations/toddler.png");
const recommendationBabyCarrierImage = require("../../assets/illustrations/recommendation_baby_carrier.png");
const recommendationDiaperImage = require("../../assets/illustrations/recommendation_diaper.png");
const recommendationBlocksImage = require("../../assets/illustrations/recommendation_blocks.png");
// ITEM-121: 시기 칩 라벨은 밴드 정의(src/items/stage-bands.ts)에서 그대로 가져온다 --
// 칩 라벨이 곧 서버로 보내는 `stageBand` 값이라, 목록을 손으로 복제하면 조용히 어긋난다.
const tabOptions = bandDefinitions.map((band) => band.label);
// UX-5B-10b: 서버 items API의 tab 파라미터(now/soon/prepared/not_needed)를 그대로 쓰는
// 상태 필터 -- 기존에는 tab="now"만 조회해 클라이언트에서 걸렀다.
const statusTabOptions = [
  { value: "now", label: "지금 필요" },
  { value: "soon", label: "곧 필요" },
  { value: "prepared", label: "준비완료" },
  { value: "not_needed", label: "괜찮아요" }
] as const;
type StatusTabValue = (typeof statusTabOptions)[number]["value"];
// 리뷰 F3: 다른 시기 칩을 미리 보는 동안 "soon"은 선택한 밴드의 여집합이라 지나간 시기까지
// 포함한다 -- 그때는 "곧 필요"가 사실과 어긋나므로 라벨만 중립적으로 바꾼다(값은 그대로 soon).
const soonTabLabelWhilePreviewingBand = "다른 시기";
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
    // ITEM-123 (B4): gifted 항목은 목록 순서와 무관하게 항상 상태 배지를 단다. 준비완료 탭이
    // prepared와 gifted를 함께 보여주므로("선물로 받아 이미 있다" vs "직접 준비했다"),
    // 첫 항목만 "BEST"로 덮으면 선물 받은 물건인지 구분할 방법이 사라진다. 문구는
    // statusLabel을 그대로 재사용해 상태 이름을 한 곳에서만 관리한다.
    badge: index === 0 && item.status !== "gifted" ? "BEST" : statusLabel(item.status),
    caption: undefined,
    image: recommendationPreviewImages[index % recommendationPreviewImages.length]
  };
}

export default function ItemsScreen() {
  const [stageLabel, setStageLabel] = useState<StageBandLabel>("12-24개월");
  const [hasManualStageSelection, setHasManualStageSelection] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTabValue>("now");
  // ITEM-121 (B2/B3): 목록을 더 좁히는 클라이언트 전용 조건. 시기/상태와 달리 이미 받은
  // 항목의 필드만 보므로 서버 왕복이 없다(src/items/item-filters.ts).
  const [necessityFilter, setNecessityFilter] = useState<NecessityFilter>("all");
  const [searchText, setSearchText] = useState("");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  // Default the selected chip to the child's actual current stage once it's known, unless the
  // pixel-lock capture is running, we're in the loginless test session (fixture data must render
  // deterministically), or the user already tapped a chip. Falls back to "12-24개월" otherwise.
  const shouldResolveChildStage = Boolean(authToken && childId) && !isPixelLockMode && !isTestSession;
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: shouldResolveChildStage,
    queryFn: () => getHome(authToken!, childId!)
  });
  // 기본으로 선택되는 칩(= 아이 현재 단계가 속한 밴드). 사용자의 수동 선택과 무관하게 계산해,
  // "지금 보고 있는 칩이 기본 칩인가"를 판별하는 기준으로 쓴다.
  const defaultStageLabel = resolveDefaultStageLabel({
    currentStage: home.data?.child.currentStage,
    isPixelLockMode,
    isTestSession,
    hasManualSelection: false,
    fallback: "12-24개월"
  });
  // ITEM-121: 선택한 시기 칩을 서버로 넘겨(`stageBand`) 그 밴드 기준 목록을 받는다. 예전에는
  // 서버가 아이의 현재 단계만 필터하고 화면이 그 위에 밴드 필터를 한 번 더 걸어서, 현재
  // 단계가 속한 칩만 목록이 나오고 나머지 칩은 전부 빈 화면이었다(이중 필터). 이제 다음
  // 시기 준비물을 미리 볼 수 있고, 화면은 서버가 준 목록을 그대로 신뢰한다.
  //
  // 리뷰 F2: 단, 기본 칩이 선택된 동안에는 stageBand를 보내지 않아 "지금 필요"가 정확히 아이의
  // 현재 단계를 뜻하던 구 동작을 유지한다 -- 밴드(0-6개월 = 임신 초기~생후 6개월)를 통째로
  // 보내면 신생아 부모의 기본 화면에 임신기 품목까지 섞여 핵심 루프가 흐려지고, 추천 정렬의
  // stageMatches 점수도 밴드가 아니라 현재 단계 기준이라 정렬 신호까지 약해진다. 확대는
  // 사용자가 다른 칩을 명시적으로 눌러 다음/이전 시기를 미리 볼 때만 허용한다.
  const isPreviewingOtherBand = stageLabel !== defaultStageLabel;
  const requestedStageBand = isPreviewingOtherBand ? stageLabel : undefined;
  const items = useQuery({
    queryKey: ["items", childId, statusTab, requestedStageBand ?? "current-stage"],
    enabled: Boolean(authToken && childId),
    queryFn: () => listItems(authToken!, childId!, statusTab, requestedStageBand)
  });
  // ITEM-114: 시기 준비율 계산용 전 상태 스냅샷. 현재 리스트 쿼리는 선택된 상태 탭 하나만
  // 조회하므로 준비율(분모=필수 전체, 분자=해결됨)을 계산할 수 없다.
  //
  // ITEM-123 (B5): 예전에는 now/soon/prepared/not_needed 4개 탭을 Promise.all로 동시에
  // 불러 합쳤다 -- 준비템 탭 1회 진입에 목록 1 + 스냅샷 4 + 홈 1 = 6요청. 서버가 상태로
  // 거르지 않는 tab="all" 스냅샷을 주므로 스냅샷은 1요청이면 된다(같은 집합 + 예전에는
  // 어느 탭에도 없어 통째로 빠지던 gifted 포함 -- ITEM-123 B4). 밴드는 넘기지 않는다:
  // 준비율의 시기 필터는 클라이언트에서(computeEssentialPrepProgress) 적용한다.
  //
  // 쿼리 키가 ["items", ...] 접두어를 공유하므로 상태 변경 뮤테이션의
  // invalidateQueries(["items"])로 함께 갱신된다. 픽셀 락 캡처 중에는 화면에 그리지
  // 않으므로 조회도 하지 않는다.
  const allStatusItems = useQuery({
    queryKey: ["items", childId, "prep-progress"],
    enabled: Boolean(authToken && childId) && !isPixelLockMode,
    queryFn: async () => {
      const response = await listItems(authToken!, childId!, "all");
      return response.items;
    }
  });
  useEffect(() => {
    if (hasManualStageSelection) return;
    setStageLabel(defaultStageLabel);
  }, [defaultStageLabel, hasManualStageSelection]);
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
  // 시기(stageBand)·상태(tab)는 서버가 이미 걸렀다. 여기서는 필수도 칩과 이름 검색만 적용한다
  // -- 비세션 미리보기에는 두 컨트롤을 노출하지 않으므로 목록도 손대지 않는다.
  const itemFilterInput = { necessity: necessityFilter, searchText };
  const listedItems: Array<ItemSummary | RecommendationPreviewItem> = hasSession
    ? filterItems<ItemSummary | RecommendationPreviewItem>(visibleItems, itemFilterInput)
    : visibleItems;
  const isNarrowedByFilter = hasSession && hasActiveItemFilter(itemFilterInput);
  const showEmptyState = hasSession ? listedItems.length === 0 : false;
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
                  label={option.value === "soon" && isPreviewingOtherBand ? soonTabLabelWhilePreviewingBand : option.label}
                  selected={option.value === statusTab}
                  onPress={() => setStatusTab(option.value)}
                />
              ))}
            </View>
          ) : null}

          {/* ITEM-121 (B2): 필수도 칩. 세션 전용이라 픽셀 락 캡처(비세션 미리보기)에는 나오지 않는다. */}
          {hasSession ? (
            <View style={{ flexDirection: "row", gap: 6, marginHorizontal: -12 }}>
              {NECESSITY_FILTER_OPTIONS.map((option) => (
                <CategoryChip
                  key={option.value}
                  label={option.label}
                  selected={option.value === necessityFilter}
                  onPress={() => setNecessityFilter(option.value)}
                />
              ))}
            </View>
          ) : null}

          {/* ITEM-121 (B3): 준비템 이름 검색. 기록 탭 검색과 같은 관례(trim + 소문자 부분일치). */}
          {hasSession ? (
            <TextInput
              accessibilityLabel="준비템 이름으로 검색"
              returnKeyType="search"
              onChangeText={setSearchText}
              placeholder="준비템 이름으로 검색"
              style={{
                backgroundColor: theme.colors.white,
                borderColor: "rgba(74, 63, 53, 0.10)",
                borderRadius: theme.radii.small,
                borderWidth: 1,
                color: theme.colors.brown,
                fontSize: theme.typography.body1.fontSize,
                minHeight: theme.touchTarget,
                paddingHorizontal: 14
              }}
              value={searchText}
            />
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
            isNarrowedByFilter ? (
              // 필터/검색 때문에 비었을 때는 홈으로 보내는 대신 조건을 풀 수 있게 한다.
              <EmptyStateCard
                title="검색·필터에 맞는 준비템이 없어요."
                actionLabel="필터 초기화"
                onPress={() => {
                  setNecessityFilter("all");
                  setSearchText("");
                }}
              />
            ) : (
              <EmptyStateCard
                title={statusTab === "now" ? "지금 필요한 추천템이 없어요." : "이 조건에 맞는 준비템이 없어요."}
                actionLabel="홈으로 가기"
                onPress={() => router.push("/(tabs)")}
              />
            )
          ) : (
            <View style={{ gap: 10 }}>
              {listedItems.map((item, index) => {
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
