import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, Share, Text, View } from "react-native";
import { clickProductLink, getItemDetail, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemDetail, type ProductLink } from "../../src/api/client";
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
        <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" onPress={() => router.back()} style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{"<"}</Text>
        </Pressable>
        <Pressable accessibilityLabel="공유하기" accessibilityRole="button" onPress={onShare} style={productDetailChromeButtonStyle}>
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
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["item-detail", childId, itemTemplateId],
    enabled: Boolean(authToken && childId && itemTemplateId),
    queryFn: () => getItemDetail(authToken!, childId!, itemTemplateId)
  });

  const markPrepared = useMutation({
    mutationFn: () => updateItemStatus(authToken!, childId!, itemTemplateId, "prepared"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      router.replace("/(tabs)/items");
    }
  });

  const clickLink = useMutation({
    mutationFn: (productLinkId: string) => clickProductLink(authToken!, productLinkId, childId!, "ITEM-003"),
    onSuccess: async (result) => {
      setClickedTitle(result.disclosureText ?? "구매 링크");
      try {
        const canOpen = await Linking.canOpenURL(result.redirectUrl);
        if (!canOpen) throw new Error("cannot-open-url");
        await Linking.openURL(result.redirectUrl);
      } catch {
        setClickedTitle("링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    },
    onError: () => {
      setClickedTitle("링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  });
  const hasSession = Boolean(authToken && childId && itemTemplateId);

  if (hasSession && (detail.isLoading || !detail.data)) {
    return (
      <AppScreen>
        <EmptyStateCard title="상품 정보를 불러오고 있어요." actionLabel="잠시만요" />
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
  const canCallLinkApi = hasSession;
  const handleProductLinkPress = (link: ProductLink) => {
    if (canCallLinkApi) {
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
              void Share.share({ message: `${visibleDetail.name} · ${visibleDetail.priceBandText}` });
            }}
          />
          <View accessibilityLabel={productDetailScreenId} style={productDetailHeaderSpacerStyle} />

          <Card style={productDetailHeroCardStyle()}>
            <Image source={productImage} style={productDetailHeroImageStyle()} resizeMode="cover" />
          </Card>

          <Card style={productDetailInfoCardStyle()}>
            <Text style={{ color: theme.colors.brown, fontSize: 21, fontWeight: "800" }}>{visibleDetail.name}</Text>
            {hasSession ? null : (
              <Text style={{ color: theme.colors.warning, fontSize: 13, fontWeight: "800" }}>★ 4.8 (2,154)</Text>
            )}
            {hasSession ? (
              <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>
                {visibleDetail.priceBandText ?? "가격 정보 확인 중"}
              </Text>
            ) : (
              <>
                <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>42,900원</Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>최저가 {visibleDetail.priceBandText}</Text>
              </>
            )}

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
                <ProductComparisonRow
                  seller={link.title}
                  price={
                    hasSession
                      ? visibleDetail.priceBandText ?? "가격 정보 확인 중"
                      : link.title === "우리아이몰"
                        ? "42,900원"
                        : link.title === "네이처 공식몰"
                          ? "44,900원"
                          : "45,900원"
                  }
                  onPress={() => handleProductLinkPress(link)}
                />
              </View>
            ))}
          </Card>

          <AffiliateDisclosure text={visibleDetail.productLinks[0]?.disclosureText} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SecondaryButton label="장바구니 담기" onPress={() => setClickedTitle("장바구니에 담아두었어요.")} style={{ flex: 1 }} />
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
              <SecondaryButton label="지출도 기록하기" onPress={() => router.push("/expenses/new")} />
            </Card>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}
