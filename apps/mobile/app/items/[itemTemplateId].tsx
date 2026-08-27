import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, Share, Text, View } from "react-native";
// Platform/Alert are imported separately: items-commerce-flow.test.ts (COM-106) pins the
// exact react-native import line above, so later additions go on this second line
// (Alert = ITEM-123 B4의 "선물로 받았어요" 확인 흐름).
import { Alert, Platform } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import {
  buildAffiliateLinkClickedPayload,
  buildItemDetailViewedPayload,
  buildItemStatusChangedPayload
} from "../../src/analytics/events";
import { useAnalyticsConsentStore } from "../../src/analytics/flag";
import { clickProductLink, getItemDetail, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemDetail, type ItemStatus, type ProductLink } from "../../src/api/client";
import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";
import {
  expenseLinkParams,
  itemDetailExpenseLinkAccessibilityLabel,
  shouldShowItemDetailExpenseLink,
  ITEM_DETAIL_EXPENSE_LINK_LABEL
} from "../../src/items/expense-link-prompt";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  itemStatusMutationErrorMessage,
  type GiftedResetActionKind
} from "../../src/items/status-mutation-messages";
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
import { resolveScreenPhase } from "../../src/screen-phase";
import { theme } from "../../src/theme";
import { ProductDetailPixelStyles } from "../../src/pixelLock/styles/ProductDetailPixelStyles";

const productImage = require("../../assets/illustrations/product_diaper_pack.png");

/**
 * ANA-127: (viewer, child, item) triples whose detail view has already been reported this app
 * launch. Module-level on purpose -- the same once-per-app-session convention app/index.tsx uses
 * for app_opened (`hasTrackedAppOpenedThisLaunch`) and PurchaseFollowupPrompt.tsx uses for its
 * prompt gate: it survives remounts (re-entering the same item from the list is one view, not
 * several) and resets on cold start.
 *
 * 라운드 27 L-3: 키에 **보는 사람**이 들어간다. 예전 키는 `${childId}:${itemTemplateId}`뿐이라,
 * 한 기기를 같이 쓰는 가구에서 A가 보고 로그아웃한 뒤 B가 로그인해 같은 아이의 같은 아이템을
 * 열면 B의 열람이 통째로 사라졌다(모듈 상태는 로그아웃으로 지워지지 않는다).
 */
const trackedItemDetailViewsThisLaunch = new Set<string>();
/**
 * 데모/테스트 세션에는 userId가 없다(session.store의 startTestSession이 null로 둔다). 실계정
 * userId와 절대 겹칠 수 없는 고정 문자열을 써서 데모 열람이 실계정 열람을 잡아먹지 않게 한다.
 */
const DEMO_SESSION_VIEWER_KEY = "demo-session";
/** 실세션인데 userId를 모르는 예외 상황(구버전 persist 블롭 등)의 자리표시자. */
const UNKNOWN_VIEWER_KEY = "unknown-user";
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
  // 라운드 27 L-3: 열람 중복 억제 키에 들어갈 "보는 사람". 세션 스토어의 userId가 단일 소스다.
  const userId = useSessionStore((state) => state.userId);
  const viewerKey = userId ?? (isTestSession ? DEMO_SESSION_VIEWER_KEY : UNKNOWN_VIEWER_KEY);
  // 동의 상태를 **구독**한다(단발 isAnalyticsEnabled() 호출이 아니라) -- 설정에서 동의를 켜고
  // 돌아오면 아래 이펙트가 다시 돌아 그때 발사되도록 하기 위해서다.
  const analyticsConsent = useAnalyticsConsentStore((state) => state.enabled);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [clickedTitle, setClickedTitle] = useState<string | null>(null);
  // COM-106 fallback: when Linking.openURL fails (or canOpenURL is false), keep the
  // redirect URL around so we can offer "링크 공유하기" (Share.share) and "다시 시도"
  // instead of leaving the user stuck with just an error message.
  const [linkOpenFallback, setLinkOpenFallback] = useState<{ redirectUrl: string; disclosureText?: string } | null>(null);
  // ITEM-124: 상태 변경(찜하기/선물 받음/준비 완료) 실패 문구. 이 경로는 오프라인 아웃박스를
  // 타지 않아 실패가 곧 유실이라, 화면이 조용히 있으면 안 된다(src/items/status-mutation-messages.ts).
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["item-detail", childId, itemTemplateId],
    enabled: Boolean(authToken && childId && itemTemplateId),
    queryFn: () => getItemDetail(authToken!, childId!, itemTemplateId)
  });

  // ANA-103: item_status_changed fires only after the server confirmed a status change (both
  // the 찜하기/찜해제 toggle and "지출 없이 준비 완료로 표시"). The payload carries only the coarse
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
    onMutate: () => {
      setStatusErrorMessage(null);
    },
    onError: (error) => {
      setStatusErrorMessage(itemStatusMutationErrorMessage("prepare", error));
    },
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
    onMutate: () => {
      setStatusErrorMessage(null);
    },
    onError: (error, status) => {
      setStatusErrorMessage(itemStatusMutationErrorMessage(status === "interested" ? "interest" : "uninterest", error));
    },
    onSuccess: async (_data, status) => {
      trackItemStatusChanged(status);
      await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    }
  });

  /**
   * ITEM-123 (B4): "선물로 받았어요" — 도메인·DTO·statusLabel에는 있었지만 앱 어디에서도
   * 고를 수 없던 gifted 상태의 유일한 진입점이다. 찜하기 토글과 같은 관례(같은 status
   * PATCH, 같은 캐시 무효화, 같은 ANA-103 이벤트)를 쓰고, 되돌리기는 not_prepared로
   * 돌린다. DNC-015(선물 받은 물건은 지출 합계에서 제외)와도 맞물린다 — 지출을 만들지
   * 않고 준비 상태만 정리하는 경로다.
   */
  const markGifted = useMutation({
    mutationFn: (status: "gifted" | "not_prepared") =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onMutate: () => {
      setStatusErrorMessage(null);
    },
    onError: (error, status) => {
      setStatusErrorMessage(itemStatusMutationErrorMessage(status === "gifted" ? "gift" : "ungift", error));
    },
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

  /**
   * ANA-127: item_detail_viewed -- the funnel stage between 준비템 체크 and 링크 클릭 that had
   * no event at all. Fires once the loaded detail is actually on screen (not on mount, so a
   * bounced-off loading/error state is never counted as a view) and at most once per launch per
   * (viewer, child, item). Gated on hasSession, which is also what keeps it out of the pixel-lock
   * capture: app/pixel-lock.tsx clears the session before capturing, so the preview render
   * (previewDetail) reports nothing. A no-op without ANA-102 consent (src/analytics/flag.ts).
   *
   * 라운드 27 L-3: 동의 게이트를 **여기서 먼저** 본 뒤, 실제로 발사한 경우에만 중복 억제 Set에
   * 넣는다. trackAndFlushAnalyticsEvent는 void를 돌려주므로(src/analytics/client.ts의
   * trackAnalyticsEvent가 동의 OFF면 조용히 return) "발사됐는지"를 반환값으로 알 수 없고,
   * 예전처럼 add를 먼저 하면 동의 OFF로 본 아이템은 이후 동의를 켜도 이번 실행 내내 영영
   * 미발사로 남았다.
   */
  useEffect(() => {
    if (!hasSession || !detail.data) return;
    if (!analyticsConsent) return;
    const viewKey = `${viewerKey}:${childId}:${itemTemplateId}`;
    if (trackedItemDetailViewsThisLaunch.has(viewKey)) return;
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "item_detail_viewed",
      payload: buildItemDetailViewedPayload({
        itemName: detail.data.name,
        productLinkCount: detail.data.productLinks.length
      }),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
    trackedItemDetailViewsThisLaunch.add(viewKey);
  }, [hasSession, detail.data, authToken, analyticsConsent, viewerKey, childId, itemTemplateId]);

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const detailPhase = resolveScreenPhase({
    isPending: detail.isPending,
    isError: detail.isError,
    hasData: Boolean(detail.data)
  });

  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 — 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(detail.isError);

  if (hasSession && detailPhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title={loadErrorCopy.title}
          actionLabel={loadErrorCopy.actionLabel}
          onPress={() => detail.refetch()}
        />
      </AppScreen>
    );
  }

  if (hasSession && detailPhase === "loading") {
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

  const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);
  const isInterested = visibleDetail.status === "interested";
  const isGifted = visibleDetail.status === "gifted";
  // ITEM-123 (B4): 상태를 바꾸기 전 확인 -- 지출 삭제/설정 화면과 같은 Alert 관례
  // (질문형 제목 + "취소" cancel 버튼 + 실행 버튼). 준비 전으로 되돌리는 쪽도 목록에서
  // 항목이 다시 나타나는 눈에 띄는 변화라 같이 확인한다.
  function confirmGiftedChange() {
    if (isGifted) {
      Alert.alert("선물 받음을 취소할까요?", "다시 준비 전으로 돌아가요.", [
        { text: "취소", style: "cancel" },
        { text: "되돌리기", onPress: () => markGifted.mutate("not_prepared") }
      ]);
      return;
    }
    Alert.alert("선물로 받았어요", "이 준비템을 선물로 받은 걸로 표시할까요? 준비완료 탭에서 볼 수 있어요.", [
      { text: "취소", style: "cancel" },
      { text: "표시하기", onPress: () => markGifted.mutate("gifted") }
    ]);
  }
  /**
   * 리뷰 F2: gifted는 interested/prepared와 같은 단일 status 컬럼을 쓴다. 그래서 선물로 받았다고
   * 정리해 둔 항목에서 찜하기나 준비 완료를 누르면 "선물 받음"이 아무 말 없이 사라진다. 지금
   * 상태가 gifted일 때만 한 번 확인하고, 그 밖에는 예전처럼 바로 실행한다(추가 탭 비용 0).
   */
  function confirmGiftedReset(kind: GiftedResetActionKind, run: () => void) {
    if (!isGifted) {
      run();
      return;
    }
    Alert.alert(GIFTED_RESET_CONFIRM_TITLE, giftedResetConfirmMessage(kind), [
      { text: GIFTED_RESET_CONFIRM_CANCEL_LABEL, style: "cancel" },
      { text: GIFTED_RESET_CONFIRM_ACTION_LABEL, onPress: run }
    ]);
  }
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
        // ANA-127: carried so the prompt's purchase_followup_answered can report the same
        // `platform` dimension this click's affiliate_link_clicked just reported.
        platform: link.platform,
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
              // 라운드 24 L7: 확인 문구는 "interest" 고정이다. 확인이 뜨는 경우는 지금 상태가
              // gifted일 때뿐인데, status가 단일 컬럼이라 그때 isInterested는 항상 false다
              // (=버튼은 "찜하기", 실행은 interested로의 변경). gifted가 아니면 확인 없이 그대로
              // 실행되므로 kind는 쓰이지도 않는다.
              onPress={() =>
                confirmGiftedReset("interest", () =>
                  toggleInterested.mutate(isInterested ? "not_prepared" : "interested")
                )
              }
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

          {/* ITEM-123 (B4): 구매 CTA 아래에 두는 이유 -- (1) DNC-010의 제휴 고지는 구매 CTA에
              인접해야 하므로 그 사이에 아무것도 끼우지 않고, (2) "이미 선물로 받았다"는 구매를
              대체하는 선택지라 CTA 다음 줄에서 보여주는 편이 핵심 루프를 흐리지 않는다.

              리뷰 F1: 세션이 없을 때는 비활성 버튼을 남기지 않고 아예 렌더하지 않는다 --
              같은 화면군의 세션 전용 컨트롤 관례(app/(tabs)/items.tsx의 상태/필터/검색)와 같고,
              픽셀 락 ITEM-002 캡처가 비세션 프리뷰라 이 게이트가 캡처 불변의 조건이다
              (app/pixel-lock.tsx는 캡처 전 세션을 지운다). */}
          {hasSession ? (
            <SecondaryButton
              disabled={markGifted.isPending}
              label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}
              accessibilityLabel={
                isGifted ? `${visibleDetail.name} 선물 받음 취소` : `${visibleDetail.name} 선물로 받았어요`
              }
              onPress={confirmGiftedChange}
            />
          ) : null}

          {/* 라운드 37 UX-I: 앱 밖(마트·당근·지인)에서 이미 산 사람을 위한 상시 진입점.
              예전에는 아래 `clickedTitle` 카드 안의 "지출 기록하고 준비 완료"가 유일한 길이라
              **제휴 링크를 연 뒤에만** 지출과 준비템을 이을 수 있었다 -- 링크를 누를 일이 없는
              사람에게는 없는 기능이었다(핵심 루프의 빈 고리).

              배치: "선물로 받았어요"와 같은 이유로 구매 CTA **아래**다. 제휴 고지(AffiliateDisclosure)와
              구매 CTA 사이에는 아무것도 끼우지 않는다(DNC-010 인접성). 새 저장 경로를 만들지 않고
              기존 /expenses/new 프리필 계약(itemName, itemTemplateId)을 그대로 쓴다 --
              지출을 저장하면 서버가 이 준비템도 준비 완료로 처리한다(R19-B).

              세션이 없으면 렌더하지 않는다: 기록할 대상이 없고, 픽셀 락 ITEM-002 캡처가 세션을
              지운 프리뷰 렌더라 버튼 한 줄이 더 들어가면 기준 이미지와 어긋난다.

              라운드 37 G-8: 링크를 눌러 아래 "준비 완료로 남길까요?" 카드가 서 있는 동안에는
              숨긴다 -- 그 카드의 "지출 기록하고 준비 완료"와 목적지·행동이 같아서, 함께 보이면
              같은 화면에 지출 기록 입구가 두 개가 된다. 카드가 사라지면 다시 돌아온다. */}
          {shouldShowItemDetailExpenseLink({ hasSession, clickedPromptVisible: Boolean(clickedTitle) }) ? (
            <SecondaryButton
              label={ITEM_DETAIL_EXPENSE_LINK_LABEL}
              accessibilityLabel={itemDetailExpenseLinkAccessibilityLabel(visibleDetail.name)}
              onPress={() =>
                router.push({
                  pathname: "/expenses/new",
                  params: expenseLinkParams({ itemName: visibleDetail.name, itemTemplateId })
                })
              }
            />
          ) : null}

          {/* ITEM-124: 상태 변경 실패는 여기 한 곳에서만 알린다 -- 찜하기/선물 받음/준비 완료가
              모두 같은 status PATCH라 실패 문구도 한 자리에서 읽히는 편이 낫다. DNC-010의
              제휴 고지-구매 CTA 인접은 건드리지 않도록 CTA 아래에 둔다. */}
          {statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}

          {clickedTitle ? (
            <Card style={{ backgroundColor: theme.colors.mint }}>
              <Toast message={clickedTitle} />
              <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>준비 완료로 남길까요?</Text>
              {/* R19-B (DNC-002 핵심 루프 마지막 고리): 예전에는 "이미 준비로 표시"와 "지출도
                  기록하기"가 서로 배타적인 버튼 2개라, 지출을 기록한 사람은 준비 표시를
                  따로 눌러야 했고 대부분 누르지 않아 준비템이 계속 미준비로 남았다. 이제
                  연결된 지출을 저장하면 서버가 준비 완료까지 함께 처리하므로(기록 경로 하나로
                  통합), 지출 기록을 기본 동작으로 올리고 아래는 "지출 없이" 표시하는
                  보조 수단으로만 남긴다. */}
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                지출을 기록하면 이 준비템도 자동으로 준비 완료로 표시돼요.
              </Text>
              <PrimaryButton
                label="지출 기록하고 준비 완료"
                onPress={() =>
                  router.push({ pathname: "/expenses/new", params: { itemName: visibleDetail.name, itemTemplateId } })
                }
              />
              <SecondaryButton
                disabled={markPrepared.isPending}
                label="지출 없이 준비 완료로 표시"
                onPress={() => {
                  if (!authToken || !childId) return;
                  confirmGiftedReset("prepare", () => markPrepared.mutate());
                }}
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
