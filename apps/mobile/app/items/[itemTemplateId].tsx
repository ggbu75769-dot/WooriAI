import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, Share, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { clickProductLink, getItemDetail, fixtureSessionToken, updateItemStatus, type ItemDetail, type ProductLink } from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AffiliateDisclosure,
  AppIcon,
  AppScreen,
  Card,
  EmptyStateCard,
  PrimaryButton,
  SampleDataBanner,
  SecondaryButton,
  Toast
} from "../../src/design-system";
// release5v-source-quality-exception: ProductComparisonRow remains a catalog-domain component; owner=mobile-design-system; review=2026-10-01.
import { ProductComparisonRow } from "../../src/ui";
import { theme } from "../../src/theme";
import { ProductDetailPixelStyles } from "../../src/pixelLock/styles/ProductDetailPixelStyles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { Release4ItemDetailScreen } from "../../src/preparation/Release4ItemDetailScreen";

const productImage = require("../../assets/illustrations/product_diaper_pack.png");
const isPixelLockMode = isPixelLockBuild();
const productDetailScreenId = pixelEvidenceId("ITEM-002 ITEM-002 · ITEM-003 · ITEM-004");
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
        <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" hitSlop={7} onPress={() => router.back()} style={productDetailChromeButtonStyle}>
          <AppIcon color={theme.colors.brown} name="chevron-left" size={22} />
        </Pressable>
        <Pressable accessibilityLabel="공유하기" accessibilityRole="button" hitSlop={7} onPress={onShare} style={productDetailChromeButtonStyle}>
          <AppIcon color={theme.colors.brown} name="share-variant-outline" size={20} />
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

export default function ItemDetailScreen() {
  return isPixelLockMode ? <PixelItemDetailScreen /> : <Release4ItemDetailScreen />;
}

function PixelItemDetailScreen() {
  const params = useLocalSearchParams<{ itemTemplateId?: string }>();
  const itemTemplateId = String(params.itemTemplateId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
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

  const markPrepared = useMutation({
    mutationFn: () => updateItemStatus(authToken!, childId!, itemTemplateId, "prepared"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      router.replace("/(tabs)/items");
    }
  });

  const markInterested = useMutation({
    mutationFn: () => updateItemStatus(authToken!, childId!, itemTemplateId, "interested"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      setClickedTitle("관심 준비템에 저장했어요.");
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

  if (!hasSession && !isPixelLockMode) {
    return <Redirect href="/onboarding/child-status" />;
  }

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
          {isTestSession ? <SampleDataBanner /> : null}
          <ProductDetailNavigation
            onShare={() => {
              void Share.share({ message: `${visibleDetail.name} · ${visibleDetail.priceBandText}` });
            }}
          />
          <View accessibilityLabel={productDetailScreenId} style={productDetailHeaderSpacerStyle} />

          <Card style={productDetailHeroCardStyle()}>
            {hasSession ? (
              <View style={[productDetailHeroImageStyle(), { alignItems: "center", justifyContent: "center" }]}>
                <AppIcon color={theme.colors.coral[600]} name="package-variant-closed" size={64} />
              </View>
            ) : (
              <Image source={productImage} style={productDetailHeroImageStyle()} resizeMode="cover" />
            )}
          </Card>

          <Card style={productDetailInfoCardStyle()}>
            <Text style={{ color: theme.colors.brown, fontSize: 21, fontWeight: "800" }}>{visibleDetail.name}</Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>예상 가격대</Text>
            <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>
              {visibleDetail.priceBandText ?? "가격 정보 없음"}
            </Text>

            <View style={{ borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, flexDirection: "row", gap: 28, paddingTop: 8 }}>
              <Text style={{ borderBottomColor: theme.colors.gray900, borderBottomWidth: 2, color: theme.colors.brown, fontSize: 13, fontWeight: "800", paddingBottom: 9 }}>
                가격 비교
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13, fontWeight: "700", paddingBottom: 9 }}>제품 정보</Text>
            </View>

            {visibleDetail.productLinks.map((link, index) => (
              <ProductComparisonRow
                key={link.id}
                primaryAction
                seller={link.title}
                price={["42,900원", "44,900원", "45,900원"][index] ?? "판매처에서 확인"}
                onPress={() => handleProductLinkPress(link)}
              />
            ))}
          </Card>

          {visibleDetail.productLinks.length > 0 ? (
            <PixelProductPurchaseActions
              onBuy={() => handleProductLinkPress(visibleDetail.productLinks[0])}
              onSave={() => markInterested.mutate()}
              saveDisabled={!hasSession || markInterested.isPending}
              visibleDetail={visibleDetail}
            />
          ) : (
            <Card style={{ backgroundColor: theme.colors.beige }}>
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
                검수된 구매 링크가 아직 없어요.
              </Text>
            </Card>
          )}

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

          <Card>
            <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
              중고로 사도 괜찮은가요?
            </Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>
              {visibleDetail.usedSecondhandOk ? "상태와 안전 기준을 확인하면 중고도 고려할 수 있어요." : "위생과 안전을 위해 새 제품을 권해요."}
            </Text>
          </Card>

          {visibleDetail.safetyNote ? (
            <Card>
              <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>안전 주의</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{visibleDetail.safetyNote}</Text>
            </Card>
          ) : null}

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

function PixelProductPurchaseActions({
  onBuy,
  onSave,
  saveDisabled,
  visibleDetail
}: {
  onBuy: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  visibleDetail: ItemDetail;
}) {
  return (
    <View style={{ gap: 10 }}>
      <AffiliateDisclosure text={visibleDetail.productLinks[0]?.disclosureText} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SecondaryButton disabled={saveDisabled} label="관심에 저장" onPress={onSave} style={{ flex: 1 }} />
        <PrimaryButton label="바로 구매하기" onPress={onBuy} style={{ backgroundColor: theme.colors.coral[400], flex: 1 }} />
      </View>
    </View>
  );
}
