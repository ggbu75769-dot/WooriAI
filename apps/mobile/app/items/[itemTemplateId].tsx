import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, Share, Text, View } from "react-native";
// Platform is imported separately: items-commerce-flow.test.ts (COM-106) pins the exact
// react-native import line above.
import { Platform } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildAffiliateLinkClickedPayload, buildItemStatusChangedPayload } from "../../src/analytics/events";
import { clickProductLink, getItemDetail, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemDetail, type ItemStatus, type ProductLink } from "../../src/api/client";
import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AffiliateDisclosure,
  AppScreen,
  Card,
  EmptyStateCard,
  PrimaryButton,
  ProductComparisonRow,
  SecondaryButton,
  StatusBadge,
  Toast
} from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";
import { ProductDetailPixelStyles } from "../../src/pixelLock/styles/ProductDetailPixelStyles";

const productImage = require("../../assets/illustrations/product_diaper_pack.png");
const productDetailScreenId = "pixel-screen-ITEM-002 ITEM-002 · ITEM-003 · ITEM-004";
const productDetailHeaderSpacerStyle = { minHeight: 0 } as const;
const productDetailViewportOffset = 8;
function productDetailReferenceScaleFrameStyle() {
  return {
    transform: [{ translateY: ProductDetailPixelStyles.topOffset }, { scale: ProductDetailPixelStyles.scale }, { scaleX: ProductDetailPixelStyles.scaleX }]
  } as const;
}
function productDetailFrameStyle() {
  return {
    gap: ProductDetailPixelStyles.cardGap,
    transform: [{ translateX: ProductDetailPixelStyles.horizontalOffset }]
  };
}
function productDetailHeroCardStyle() {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.beige,
    borderColor: "transparent",
    borderRadius: ProductDetailPixelStyles.cardRadius,
    borderWidth: 0,
    boxShadow: "none",
    elevation: 0,
    marginTop: -12 + productDetailViewportOffset,
    padding: 10,
    shadowOpacity: 0
  } as const;
}
function productDetailHeroImageStyle() {
  return {
    borderRadius: ProductDetailPixelStyles.cardRadius,
    height: ProductDetailPixelStyles.heroHeight,
    width: "100%"
  } as const;
}
function productDetailInfoCardStyle() {
  return {
    borderRadius: ProductDetailPixelStyles.cardRadius,
    gap: ProductDetailPixelStyles.cardGap,
    marginTop: -8
  };
}
const productDetailFloatingControlsStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  left: -4,
  position: "absolute",
  right: -4,
  top: 8 + productDetailViewportOffset,
  zIndex: 4
} as const;
const productDetailChromeButtonStyle = {
  alignItems: "center",
  backgroundColor: "rgba(255, 255, 255, 0.82)",
  borderRadius: 17,
  height: 34,
  justifyContent: "center",
  width: 34
} as const;

function ProductDetailNavigation({ onShare }: { onShare: () => void }) {
  return (
    <View style={productDetailFloatingControlsStyle}>
        <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" hitSlop={5} onPress={() => router.back()} style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{"<"}</Text>
        </Pressable>
        <Pressable accessibilityLabel="공유하기" accessibilityRole="button" hitSlop={5} onPress={onShare} style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>[]</Text>
        </Pressable>
    </View>
  );
}

function previewDetail(itemTemplateId: string): ItemDetail {
  return {
    id: itemTemplateId || "preview-diaper-party-pack",
    name: "네이처러브 기저귀 팬티형",
    necessityLevel: "essential",
    status: "not_prepared",
    timingLabel: "12-24개월 필수 준비",
    priceBandText: "42,900원 ~ 48,900원",
    reasonText: "소모가 빠른 물건이라 월별 예산과 함께 준비 상태를 체크하기 좋아요.",
    skipReasonText: "가정에 충분한 재고가 있거나 선물로 받은 경우",
    usedSecondhandOk: false,
    safetyNote: "피부에 닿는 제품은 사이즈와 소재를 확인해 주세요.",
    productLinks: [
      {
        id: "preview-affiliate-diaper",
        platform: "custom",
        title: "우리아이몰",
        isAffiliate: true,
        isSponsored: false,
        disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요."
      },
      {
        id: "preview-sponsored-diaper",
        platform: "custom",
        title: "네이처 공식몰",
        isAffiliate: true,
        isSponsored: true,
        disclosureText: "스폰서 상품이며 구매 CTA 근처에 광고/제휴 고지를 표시합니다."
      },
      {
        id: "preview-coupang-diaper",
        platform: "coupang",
        title: "쿠팡",
        isAffiliate: true,
        isSponsored: false,
        disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요."
      }
    ]
  };
}

function marker(link: ProductLink) {
  if (link.isSponsored) return "스폰서";
  if (link.isAffiliate) return "제휴";
  return "일반";
}

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ itemTemplateId?: string }>();
  const itemTemplateId = String(params.itemTemplateId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [clickedTitle, setClickedTitle] = useState<string | null>(null);
  // COM-106 fallback: when Linking.openURL fails (or canOpenURL is false), keep the
  // redirect URL around so we can offer "링크 공유하기" (Share.share) and "다시 시도"
  // instead of leaving the user stuck with just an error message.
  const [linkOpenFallback, setLinkOpenFallback] = useState<{ redirectUrl: string; disclosureText?: string } | null>(null);
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["item-detail", childId, itemTemplateId],
    enabled: Boolean(authToken && childId && itemTemplateId),
    queryFn: () => getItemDetail(authToken!, childId!, itemTemplateId)
  });

  // ANA-103: item_status_changed fires only after the server confirmed a status change (both
  // the 찜하기/찜해제 toggle and "이미 준비로 표시"). The payload carries only the coarse
  // category enum (derived on-device from the item name, which itself never leaves the device
  // -- src/analytics/events.ts) and the new status. A no-op without ANA-102 consent.
  const trackItemStatusChanged = (status: ItemStatus) => {
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "item_status_changed",
      payload: buildItemStatusChangedPayload({ itemName: detail.data?.name ?? "", status }),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  };

  const markPrepared = useMutation({
    mutationFn: () => updateItemStatus(authToken!, childId!, itemTemplateId, "prepared"),
    onSuccess: async () => {
      trackItemStatusChanged("prepared");
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      router.replace("/(tabs)/items");
    }
  });

  // UX-5B-2: 장바구니 스텁 대신 찜하기/찜해제 토글 -- 서버가 실제로 저장하는 'interested'
  // 상태를 items 탭과 같은 status PATCH로 기록한다. 찜해제는 'not_prepared'로 되돌린다.
  const toggleInterested = useMutation({
    mutationFn: (status: "interested" | "not_prepared") =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onSuccess: async (_data, status) => {
      trackItemStatusChanged(status);
      await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });

  const clickLink = useMutation({
    mutationFn: (productLinkId: string) => clickProductLink(authToken!, productLinkId, childId!, "ITEM-003"),
    onSuccess: async (result) => {
      setClickedTitle(result.disclosureText ?? "구매 링크");
      setLinkOpenFallback(null);
      try {
        const canOpen = await Linking.canOpenURL(result.redirectUrl);
        if (!canOpen) throw new Error("cannot-open-url");
        await Linking.openURL(result.redirectUrl);
      } catch {
        setClickedTitle("링크를 열지 못했어요. 링크를 공유하거나 다시 시도해 주세요.");
        setLinkOpenFallback({ redirectUrl: result.redirectUrl, disclosureText: result.disclosureText });
      }
    },
    onError: () => {
      setClickedTitle("링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
      setLinkOpenFallback(null);
    }
  });

  const retryOpenFallbackLink = async () => {
    if (!linkOpenFallback) return;
    try {
      const canOpen = await Linking.canOpenURL(linkOpenFallback.redirectUrl);
      if (!canOpen) throw new Error("cannot-open-url");
      await Linking.openURL(linkOpenFallback.redirectUrl);
      setClickedTitle(linkOpenFallback.disclosureText ?? "구매 링크");
      setLinkOpenFallback(null);
    } catch {
      setClickedTitle("링크를 열지 못했어요. 링크를 공유하거나 다시 시도해 주세요.");
    }
  };

  const shareFallbackLink = () => {
    if (!linkOpenFallback) return;
    void Share.share({ message: linkOpenFallback.redirectUrl });
  };

  const hasSession = Boolean(authToken && childId && itemTemplateId);

  if (hasSession && (detail.isLoading || !detail.data)) {
    // MOB-119 (UX-5B-5 후속, D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    // 히어로/상품정보 카드 2장 + 구매 링크 비교 행 실루엣으로 본 화면 형태를 따라간다.
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </AppScreen>
    );
  }

  if (hasSession && detail.isError) {
    return (
      <AppScreen>
        <EmptyStateCard
          title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onPress={() => detail.refetch()}
        />
      </AppScreen>
    );
  }

  const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);
  const isInterested = visibleDetail.status === "interested";
  const canCallLinkApi = hasSession;
  const handleProductLinkPress = (link: ProductLink) => {
    if (canCallLinkApi) {
      // ANA-103: affiliate_link_clicked fires on the press itself (the comparison rows and the
      // purchase CTA both funnel through here), alongside the server-side click record
      // (clickProductLink). The payload carries only the platform + screen enums -- never the
      // link URL, title or id. A no-op without ANA-102 consent (src/analytics/flag.ts).
      trackAndFlushAnalyticsEvent(authToken, {
        eventName: "affiliate_link_clicked",
        payload: buildAffiliateLinkClickedPayload({ platform: link.platform, screenId: "item_detail" }),
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
      });
      // COM-108: remember this click as a "pending purchase check" so the app can ask
      // 『…』 구매하셨나요? on the next foreground return / cold start (3min–24h window) --
      // see src/commerce/purchase-followup.store.ts + PurchaseFollowupPrompt.tsx.
      usePurchaseFollowupStore.getState().recordLinkClick({
        itemTemplateId,
        itemName: visibleDetail.name,
        childId: childId!,
        priceBandText: visibleDetail.priceBandText ?? undefined,
        clickedAt: Date.now()
      });
      clickLink.mutate(link.id);
      return;
    }
    setClickedTitle(link.disclosureText ?? "구매 링크를 확인했어요.");
  };

  return (
    <AppScreen>
      <View style={productDetailReferenceScaleFrameStyle()}>
        <View style={productDetailFrameStyle()}>
          <ProductDetailNavigation
            onShare={() => {
              void Share.share({
                message: visibleDetail.priceBandText ? `${visibleDetail.name} · ${visibleDetail.priceBandText}` : visibleDetail.name
              });
            }}
          />
          <View testID={productDetailScreenId} style={productDetailHeaderSpacerStyle} />

          <Card style={productDetailHeroCardStyle()}>
            <Image source={productImage} style={productDetailHeroImageStyle()} resizeMode="cover" />
          </Card>

          <Card style={productDetailInfoCardStyle()}>
            <Text style={{ color: theme.colors.brown, fontSize: 21, fontWeight: "800" }}>{visibleDetail.name}</Text>
            {/* UX-5B-1: 별점·최저가 등 API에 없는 가짜 수치는 렌더하지 않는다 -- 실제 응답의
                가격대(priceBandText)만 보여주고, 없으면 아무것도 표시하지 않는다. */}
            {visibleDetail.priceBandText ? (
              <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>{visibleDetail.priceBandText}</Text>
            ) : null}

            <View style={{ borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, flexDirection: "row", gap: 28, paddingTop: 8 }}>
              <Text style={{ borderBottomColor: theme.colors.gray900, borderBottomWidth: 2, color: theme.colors.brown, fontSize: 13, fontWeight: "800", paddingBottom: 9 }}>
                가격 비교
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13, fontWeight: "700", paddingBottom: 9 }}>제품 정보</Text>
            </View>

            {visibleDetail.productLinks.map((link) => (
              <View key={link.id} style={{ gap: 6 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <StatusBadge label={marker(link)} tone={link.isSponsored ? "warning" : "neutral"} />
                  <Text style={{ color: theme.colors.gray600, flex: 1, fontSize: 11 }}>{link.isSponsored ? "광고/스폰서" : "제휴 링크"}</Text>
                </View>
                {/* UX-5B-1: 링크별 가짜 판매가 대신, API가 주는 가격대만 표시 (없으면 빈칸). */}
                <ProductComparisonRow
                  seller={link.title}
                  price={visibleDetail.priceBandText ?? ""}
                  onPress={() => handleProductLinkPress(link)}
                />
              </View>
            ))}
          </Card>

          <Card>
            <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
              왜 필요해요?
            </Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{visibleDetail.reasonText}</Text>
          </Card>

          {visibleDetail.skipReasonText ? (
            <Card>
              <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
                이런 경우엔 안 사도 돼요
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{visibleDetail.skipReasonText}</Text>
            </Card>
          ) : null}

          <AffiliateDisclosure text={visibleDetail.productLinks[0]?.disclosureText} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SecondaryButton
              disabled={!hasSession || toggleInterested.isPending}
              label={isInterested ? "찜해제" : "찜하기"}
              onPress={() => toggleInterested.mutate(isInterested ? "not_prepared" : "interested")}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="바로 구매하기"
              onPress={() => {
                const firstLink = visibleDetail.productLinks[0];
                if (firstLink) handleProductLinkPress(firstLink);
              }}
              style={{ flex: 1 }}
            />
          </View>

          {clickedTitle ? (
            <Card style={{ backgroundColor: theme.colors.mint }}>
              <Toast message={clickedTitle} />
              <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>준비 완료로 남길까요?</Text>
              <SecondaryButton
                label="이미 준비로 표시"
                onPress={() => {
                  if (authToken && childId) markPrepared.mutate();
                }}
              />
              <SecondaryButton
                label="지출도 기록하기"
                onPress={() =>
                  router.push({ pathname: "/expenses/new", params: { itemName: visibleDetail.name, itemTemplateId } })
                }
              />
            </Card>
          ) : null}

          {linkOpenFallback ? (
            <Card style={{ backgroundColor: theme.colors.beige }}>
              <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>
                링크를 자동으로 열지 못했어요.
              </Text>
              <SecondaryButton label="링크 공유하기" onPress={shareFallbackLink} />
              <PrimaryButton label="다시 시도" onPress={() => void retryOpenFallbackLink()} />
            </Card>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}
