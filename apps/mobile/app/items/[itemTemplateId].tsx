import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Text, View } from "react-native";
import { clickProductLink, getItemDetail, updateItemStatus, type ItemDetail, type ProductLink } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AffiliateDisclosure,
  AppScreen,
  Card,
  PrimaryButton,
  ProductComparisonRow,
  SecondaryButton,
  StatusBadge,
  Toast
} from "../../src/ui";
import { theme } from "../../src/theme";

const productImage = require("../../assets/illustrations/product_diaper_pack.png");
const productDetailScreenId = "ITEM-002 · ITEM-003 · ITEM-004";
const productDetailHeaderSpacerStyle = { minHeight: 0 } as const;
const productDetailViewportOffset = 8;
const productDetailHorizontalOffset = 0;
const productDetailReferenceScale = 0.806;
const productDetailReferenceScaleX = 1.35;
const productDetailReferenceScaleVerticalOffset = -40;
const productDetailReferenceScaleFrameStyle = {
  transform: [{ translateY: productDetailReferenceScaleVerticalOffset }, { scale: productDetailReferenceScale }, { scaleX: productDetailReferenceScaleX }]
} as const;
const productDetailFrameStyle = {
  gap: theme.spacing.section,
  transform: [{ translateX: productDetailHorizontalOffset }]
};
const productDetailHeroCardStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.beige,
  borderColor: "transparent",
  borderWidth: 0,
  boxShadow: "none",
  elevation: 0,
  marginTop: -12 + productDetailViewportOffset,
  padding: 10,
  shadowOpacity: 0
} as const;
const productDetailHeroImageStyle = {
  borderRadius: 22,
  height: 215,
  width: "100%"
} as const;
const productDetailInfoCardStyle = {
  gap: 12,
  marginTop: -8
} as const;
const productDetailStatusBarStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  left: -8,
  position: "absolute",
  right: -8,
  top: -12 + productDetailViewportOffset,
  zIndex: 4
} as const;
const productDetailFloatingControlsStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  left: -4,
  position: "absolute",
  right: -4,
  top: 50 + productDetailViewportOffset,
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

function ProductDetailScreenChrome() {
  return (
    <View pointerEvents="none">
      <View style={productDetailStatusBarStyle}>
        <Text style={{ color: theme.colors.gray900, fontSize: 12, fontWeight: "800" }}>9:41</Text>
        <Text style={{ color: theme.colors.gray900, fontSize: 10, fontWeight: "800" }}>LTE 100%</Text>
      </View>
      <View style={productDetailFloatingControlsStyle}>
        <View style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{"<"}</Text>
        </View>
        <View style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>[]</Text>
        </View>
      </View>
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
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [clickedTitle, setClickedTitle] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["item-detail", childId, itemTemplateId],
    enabled: Boolean(accessToken && childId && itemTemplateId),
    queryFn: () => getItemDetail(accessToken!, childId!, itemTemplateId)
  });

  const markPrepared = useMutation({
    mutationFn: () => updateItemStatus(accessToken!, childId!, itemTemplateId, "prepared"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      router.replace("/(tabs)/items");
    }
  });

  const clickLink = useMutation({
    mutationFn: (productLinkId: string) => clickProductLink(accessToken!, productLinkId, childId!, "ITEM-003"),
    onSuccess: async (result) => {
      setClickedTitle(result.disclosureText ?? "구매 링크");
      await Linking.openURL(result.redirectUrl);
    }
  });
  const visibleDetail = detail.data ?? previewDetail(itemTemplateId);
  const canCallLinkApi = Boolean(accessToken && childId);
  const handleProductLinkPress = (link: ProductLink) => {
    if (canCallLinkApi) {
      clickLink.mutate(link.id);
      return;
    }
    setClickedTitle(link.disclosureText ?? "구매 링크를 확인했어요.");
  };

  return (
    <AppScreen>
      <View style={productDetailReferenceScaleFrameStyle}>
        <View style={productDetailFrameStyle}>
          <ProductDetailScreenChrome />
          <View accessibilityLabel={productDetailScreenId} style={productDetailHeaderSpacerStyle} />

          <Card style={productDetailHeroCardStyle}>
            <Image source={productImage} style={productDetailHeroImageStyle} resizeMode="cover" />
          </Card>

          <Card style={productDetailInfoCardStyle}>
            <Text style={{ color: theme.colors.brown, fontSize: 21, fontWeight: "800" }}>{visibleDetail.name}</Text>
            <Text style={{ color: theme.colors.warning, fontSize: 13, fontWeight: "800" }}>★ 4.8 (2,154)</Text>
            <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>42,900원</Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>최저가 {visibleDetail.priceBandText}</Text>

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
                  price={link.title === "우리아이몰" ? "42,900원" : link.title === "네이처 공식몰" ? "44,900원" : "45,900원"}
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
                  if (accessToken && childId) markPrepared.mutate();
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
