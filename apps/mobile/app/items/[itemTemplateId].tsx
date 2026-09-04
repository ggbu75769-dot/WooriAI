import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, Share, Text, View } from "react-native";
// Platform/Alert are imported separately: items-commerce-flow.test.ts (COM-106) pins the
// exact react-native import line above, so later additions go on this second line
// (Alert = ITEM-123 B4의 "선물로 받았어요" 확인 흐름 · TextInput = 기능 라운드 1 트랙 D의
// 품목 메모 입력).
import { Alert, Platform, TextInput } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import {
  buildAffiliateLinkClickedPayload,
  buildItemDetailViewedPayload,
  buildItemStatusChangedPayload
} from "../../src/analytics/events";
import { useAnalyticsConsentStore } from "../../src/analytics/flag";
// 라운드 77 A: 클릭 실패가 서버 코드를 들고 왔을 때 그 문구를 앱 전역 표에서 받는다
// (문구를 이 화면에서 새로 짓지 않는다 — src/api/api-error.ts가 단일 소스다).
import { apiErrorCodeOf, apiErrorMessageForCode } from "../../src/api/api-error";
import { clickProductLink, getItemDetail, LOCAL_SESSION_TOKEN, type Child, type ItemDetail, type ItemStatus, type ProductLink } from "../../src/api/client";
import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";
import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";
import {
  expenseLinkParams,
  itemDetailExpenseLinkAccessibilityLabel,
  shouldShowItemDetailExpenseLink,
  ITEM_DETAIL_EXPENSE_LINK_LABEL
} from "../../src/items/expense-link-prompt";
import {
  canSharePurchaseLink,
  EMPTY_PRODUCT_LINKS_TEXT,
  hasPurchasableLink,
  LINK_SHARE_UNAVAILABLE_NOTICE,
  linkOpenFailureNotice,
  primaryPurchaseLinkIndex,
  productLinkMarker,
  productLinksDisclosureText,
  productPlatformLabel,
  purchaseLinkShareMessage
} from "../../src/items/link-marker";
import { resolveLinkPriceDisplay, withLinkPriceCaption } from "../../src/items/link-price";
import { itemStatusBadgeLabel, itemStatusLabel, necessityBadgeLabel } from "../../src/items/item-labels";
// 기능 라운드 1 트랙 D: 품목 메모(기기 보관). 문구·상한·판정은 순수 모듈이 들고
// (src/items/item-memo.ts) 저장은 기기 로컬 스토어가 맡는다 — 서버 0바이트.
import {
  ITEM_MEMO_CARD_TITLE,
  ITEM_MEMO_DEVICE_ONLY_NOTICE,
  ITEM_MEMO_INPUT_LABEL,
  ITEM_MEMO_INPUT_PLACEHOLDER,
  ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE,
  ITEM_MEMO_MAX_LENGTH,
  ITEM_MEMO_SAVE_LABEL,
  itemMemoSaveAccessibilityLabel,
  itemMemoSavedNotice
} from "../../src/items/item-memo";
import { useItemMemoStore } from "../../src/items/item-memo.store";
import { itemTrustNotes } from "../../src/items/item-trust-notes";
import { linkedExpenseRow } from "../../src/items/linked-expense";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useItemStatusGate } from "../../src/items/useItemStatusGate";
import { buildPendingItemStatusIndex, effectiveItemStatus, pendingItemStatusView } from "../../src/items/pending-status";
import {
  refreshOfflineSyncSnapshot,
  updateItemStatusOffline,
  useOfflineSyncSnapshot
} from "../../src/offline/sync-controller";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { OFFLINE_RETRY_NOTICE } from "../../src/offline/messages";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE,
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
  TextButton,
  Toast
} from "../../src/ui";
// DSN-053 P2-B: 승인 디자인의 히어로 글리프. 디자인 시스템은 읽기 전용으로만 가져다 쓴다.
import { AppIcon } from "../../src/design-system";
// FIX-C: 목록 타일이 쓰는 **품목별 아이콘 해석기**(src/preparation/item-visuals.ts —
// PreparationListParity.tsx가 같은 시그니처로 부른다)를 읽기 전용으로 가져온다. 매핑을 여기서
// 다시 짓지 않는다 — 목록과 상세가 같은 물건에 다른 그림을 그리면 같은 품목인지 확신할 수 없다.
import { resolvePreparationItemVisual } from "../../src/preparation/item-visuals";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
// T1(디자인 시스템) 후속: 잠깐 안내의 수명 한 벌 — memoNotice가 화면 이탈까지 남던 관례를
// 설정 → 아이 관리·더보기 내보내기와 같은 3200ms 수명(훅 기본값)으로 맞춘다.
import { useTransientNotice } from "../../src/ui/use-transient-notice";
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
// PIX-133: 보정 스케일 변환은 ITEM-002 캡처 빌드 전용.
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function productDetailReferenceScaleFrameStyle() {
  if (!isPixelLockCalibration) return undefined;
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
/**
 * 라운드 48 T1(A3c) → DSN-053 P2-B: 세션 경로에는 **상품 사진이 없다**. 카드 자체는 있다.
 *
 * `productImage`(기저귀 팩 일러스트) 한 장이 시드 62개 품목 **전부**의 대표 사진으로
 * 붙어 있었다 — 카시트 상세에도 기저귀 사진이 떴다. 응답에 상품 이미지가 없으므로 그릴
 * 사실이 없다. A3c는 그래서 히어로를 통째로 빈 자리(높이 44)로 바꿨는데, 승인 디자인
 * (ITEM-002)의 상단은 베이지 히어로 카드다 — 사진을 지어내지 않으면서 그 프레임을 되살리려면
 * 카드 안에 **중립 글리프**를 두면 된다(c20deeb의 세션 분기와 같은 처리).
 *
 * 비세션 프리뷰(ITEM-002 픽셀 락 캡처)는 예전 히어로 카드와 사진을 그대로 그린다.
 */
function productDetailSessionHeroPlaceholderStyle() {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.beige,
    borderRadius: ProductDetailPixelStyles.cardRadius,
    height: ProductDetailPixelStyles.heroHeight,
    justifyContent: "center",
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
/**
 * 라운드 64 #6 — 이 화면의 플로팅 크롬(뒤로가기·공유하기) 히트 영역.
 *
 * 34dp 정사각에 hitSlop 5면 44dp라, 이 저장소가 스스로 못박은 최소 터치 타깃
 * (`theme.touchTarget = 48`, DSN-053 토큰 표)에 미달이었다. 같은 파일의 탭 밴드는 이미 그
 * 규율을 명시적으로 지킨다("텍스트+패딩(≈31dp)에 hitSlop 6으로는 48dp 타깃 미달이라 높이로
 * 확보한다"). 여기서는 높이를 못 늘린다 — 34는 승인 캡처(ITEM-002)의 값이다. 그래서
 * **hitSlop만** 7로 올린다: 34 + 2×7 = 48. `hitSlop`은 레이아웃 속성이 아니라 히트 영역이라
 * 렌더는 한 픽셀도 바뀌지 않으므로 ITEM-002 픽셀락 캡처가 그대로다.
 *
 * 가로도 함께 늘려도 되는 이유: 기록 화면의 칩들(gap 8)과 달리 이 둘은 `space-between`으로
 * 화면 좌·우 끝에 하나씩 서 있어 서로의 히트 영역과 만날 일이 없다.
 */
const PRODUCT_DETAIL_CHROME_HIT_SLOP = 7;

function ProductDetailNavigation({ onShare }: { onShare: () => void }) {
  return (
    <View style={productDetailFloatingControlsStyle}>
        <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" hitSlop={PRODUCT_DETAIL_CHROME_HIT_SLOP} onPress={() => router.back()} style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 18, fontWeight: "800" }}>{"<"}</Text>
        </Pressable>
        <Pressable accessibilityLabel="공유하기" accessibilityRole="button" hitSlop={PRODUCT_DETAIL_CHROME_HIT_SLOP} onPress={onShare} style={productDetailChromeButtonStyle}>
          <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>[]</Text>
        </Pressable>
    </View>
  );
}

/**
 * DSN-053 P2-B — 승인 디자인(ITEM-002)의 정보 카드 탭 밴드. 라벨은 캡처 그대로다.
 */
const PRODUCT_DETAIL_TABS = [
  { value: "price", label: "가격 비교" },
  { value: "info", label: "제품 정보" }
] as const;
type ProductDetailTab = (typeof PRODUCT_DETAIL_TABS)[number]["value"];

/**
 * "제품 정보" 탭이 세우는 줄들 — **응답에 실제로 있는 값만** 담는다(없으면 줄이 없다).
 *
 * 필수도가 `optional`이면 줄을 세우지 않는다: 필수도 축의 기본값이라 알릴 사실이 없다는
 * 판정이 이미 순수 모듈에 있고(src/items/item-labels.ts necessityBadgeLabel), 여기서 그
 * 판정을 뒤집으면 두 화면이 같은 값을 다르게 말한다.
 */
function productDetailFacts(detail: ItemDetail, displayStatus: ItemStatus): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (detail.timingLabel) facts.push({ label: "준비 시기", value: detail.timingLabel });
  const necessity = necessityBadgeLabel(detail.necessityLevel);
  if (necessity) facts.push({ label: "필수도", value: necessity });
  facts.push({ label: "내 준비 상태", value: itemStatusLabel(displayStatus) });
  return facts;
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
        // 라운드 43 리뷰 M-1: 집합에 스폰서가 있으면 이 문구가 구매 CTA 옆에 실제로 그려진다
        // (예전에는 productLinks[0]의 문구만 쓰여 이 줄은 화면에 나온 적이 없었다). 사용자에게
        // 보이는 문장이므로 해요체로 두고(DNC-018), 광고 사실과 수수료 고지를 함께 말한다
        // (DNC-011 + DNC-010 승인 문구).
        disclosureText: "스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."
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
  // UX-R(M): 이 화면의 지출 기록 입구 두 개("이미 샀어요 · 지출로 기록", 링크를 연 뒤의
  // "지출 기록하고 준비 완료")는 보기 전용 참여자에게 서버가 403으로 막는 저장으로 이어진다.
  // 판정은 src/family/record-permissions.ts 한 곳에 있고, 비세션(ITEM-002 픽셀락 캡처)에서는
  // 애초에 두 입구가 렌더되지 않는다.
  const expenseGate = useExpenseEntryGate();
  // 라운드 51 #8: 준비 상태(찜하기·선물 받음·준비 완료) 전용 게이트. 서버가 이 PATCH에도 편집
  // 권한을 요구하므로(items-catalog.service.ts) 같은 판정을 읽고 문구만 준비템의 말로 바꾼다.
  const itemStatusGate = useItemStatusGate();
  // DSN-053 P2-B: 정보 카드의 "가격 비교 / 제품 정보" 탭. 기본값은 가격 비교 -- 핵심 루프의
  // 다음 칸(구매처 확인)이 첫 화면에서 바로 보여야 한다.
  const [detailTab, setDetailTab] = useState<ProductDetailTab>("price");
  const [clickedTitle, setClickedTitle] = useState<string | null>(null);
  // COM-106 fallback: when Linking.openURL fails (or canOpenURL is false), keep the
  // redirect URL around so we can offer "링크 공유하기" (Share.share) and "다시 시도"
  // instead of leaving the user stuck with just an error message.
  //
  // GAP-060 #4: 눌린 **링크 자체**도 함께 들고 있는다. 구매 확인 대기는 이제 링크가 실제로
  // 열린 뒤에만 등록되므로(아래 registerPurchaseFollowup), 재시도로 열린 경우에도 같은 사실을
  // 남기려면 그때 그 링크가 무엇이었는지를 알아야 한다.
  //
  // GAP-067 #4: **밖으로 내보내는** URL(`shareUrl`)도 함께 들고 있는다. 여는 URL과 다른 값이라
  // 한 칸으로 합칠 수 없다(아래 shareFallbackLink 주석).
  const [linkOpenFallback, setLinkOpenFallback] = useState<{
    redirectUrl: string;
    shareUrl?: string;
    disclosureText?: string;
    link: ProductLink;
  } | null>(null);
  // ITEM-124: 상태 변경(찜하기/선물 받음/준비 완료) 실패 문구. 이 경로는 오프라인 아웃박스를
  // 타지 않아 실패가 곧 유실이라, 화면이 조용히 있으면 안 된다(src/items/status-mutation-messages.ts).
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
  /**
   * 기능 라운드 1 트랙 D — 품목 메모(기기 보관).
   *
   * 입력 중 값은 draft로만 들고, 저장은 아래 handleMemoSave(명시 [메모 저장] 버튼)가 한다 —
   * **자동 저장 없음**(blur/뒤로가기에 걸지 않는다): 지웠다가 마음을 바꾼 입력이 화면을
   * 떠났다는 이유로 말없이 확정되지 않는다. draft가 null이면 화면은 스토어 값을 그대로
   * 따르므로, persist 하이드레이션이 마운트보다 늦게 끝나도 저장된 메모가 제때 나타난다.
   * 키는 itemTemplateId 단위다(아이 전환과 무관한 물건 메모 — item-memo.ts의 설계 근거).
   */
  const [memoDraft, setMemoDraft] = useState<string | null>(null);
  /**
   * 저장/삭제 직후의 확인 한 줄(Toast가 스스로 낭독한다 — A11Y-115). 문구는 순수 모듈의 것.
   * 수명은 공용 훅(useTransientNotice — 기본 3200ms, 설정 → 아이 관리 토스트의 그 값)이 진다 —
   * 종전에는 화면 이탈까지 남았다(T1이 세운 한 벌을 이 화면이 첫 소비자로 채택).
   */
  const { notice: memoNotice, show: showMemoNotice, clear: clearMemoNotice } = useTransientNotice();
  const storedMemo = useItemMemoStore((state) => state.memos[itemTemplateId] ?? "");
  const saveMemo = useItemMemoStore((state) => state.saveMemo);
  const memoText = memoDraft ?? storedMemo;
  /**
   * 명시 저장: 스토어가 기기 쓰기까지 기다렸다가 실패를 되돌려주므로(saveMemo가 reject —
   * item-memo.store.ts의 flushLastWrite) 실패가 무음이 될 수 없다. 실패 문구는 준비 상태의
   * 기기 저장 실패(ITEM-124)와 **같은 배너 한 자리**(아래 statusErrorMessage Toast)로 알린다 —
   * 이 화면의 기기 저장 실패 출구는 하나다. 빈/공백 메모 저장은 그 품목의 메모 삭제다.
   */
  const handleMemoSave = () => {
    // 리뷰 L-2: 키가 비면(딥링크 파라미터 이상) 스토어 판정(applyItemMemoSave)이 no-op이라
    // 저장이 일어나지 않는데, 종전에는 그 no-op에도 성공 토스트가 떴다 — 일어나지 않은 일을
    // 말하지 않도록 저장 경로 자체에 들어가지 않는다(같은 트림 판정 — item-memo.ts).
    if (itemTemplateId.trim().length === 0) return;
    // 리뷰 H-2(두 시점): 종전에는 진입에서 memoNotice만 지워서, 실패(statusErrorMessage 세움)
    // → 재시도 성공 흐름에 실패 배너와 성공 토스트가 **동시에** 남았다. 상태 뮤테이션 경로
    // (applyStatusChange)와 같은 관례로 진입 시점에 실패 배너도 지운다.
    setStatusErrorMessage(null);
    clearMemoNotice();
    saveMemo(itemTemplateId, memoText)
      .then(() => {
        setMemoDraft(null);
        showMemoNotice(itemMemoSavedNotice(memoText));
      })
      .catch(() => {
        setStatusErrorMessage(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE);
      });
  };
  const queryClient = useQueryClient();
  /**
   * 라운드 62 #7 — 이 화면이 **누구의 준비템인가**를 말한다.
   *
   * 고치는 문제: 알림함의 "샀나요?"(purchase_pending)가 데려오는 착지 화면이 여기다. 라운드 62
   * #2가 이동 **전에** 그 알림의 아이로 전환하도록 고쳤지만(app/notifications.tsx), 전환이
   * 일어났다는 사실은 이 화면 어디에도 남지 않는다 — 다자녀 가구에서 둘째의 알림을 누르면
   * 아이가 바뀐 채로 첫째의 물건과 구별되지 않는 상세가 열리고, 여기서 누르는 "이미 샀어요 ·
   * 지출로 기록"은 **그 바뀐 아이** 밑으로 들어간다. 화면이 말하지 않은 전환이 지출의 주인을
   * 정하는 셈이다.
   *
   * 어휘를 새로 만들지 않는다: 라운드 60 #7이 쓰기 화면들에 세운 그 한 벌
   * (src/children/child-switch.ts — 해석 `resolveChildScopeLabel`, 조립 `withChildScopeLabel`)을
   * 그대로 쓰고, 준비템 탭이 쓰는 단어("준비템" — app/(tabs)/_layout.tsx)에 붙인다.
   *
   * 게이트는 기존 관례 그대로 **둘**이다: 다자녀(라벨이 null이 아님) ∧ 세션(`hasSession`).
   *  - 외동 계정: `resolveChildScopeLabel`이 null이라 줄 자체가 생기지 않는다.
   *  - 비세션: **ITEM-002 픽셀락 캡처가 세션을 지운 프리뷰 렌더다**(app/pixel-lock.tsx). 그래서
   *    이 줄은 세션 전용으로만 그린다 — 같은 카드의 "예상 가격대" 라벨·상태 배지와 같은 자리에
   *    같은 게이트를 쓴다. 캡처 경로는 한 픽셀도 달라지지 않는다.
   *
   * 목록은 **새 요청 없이** 이미 채워진 캐시에서만 읽는다(예산·정기 지출 화면과 같은 규칙):
   * `useQuery`가 아니라 `getQueryData`라 쿼리를 활성화하지 않고, 캐시가 비어 있으면 라벨이
   * null이라 화면이 종전 그대로다 — 모르면 말하지 않는다.
   */
  const cachedChildren = authToken
    ? queryClient.getQueryData<{ children: Child[] }>(["children"])?.children
    : undefined;
  const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);
  const detail = useQuery({
    queryKey: ["item-detail", childId, itemTemplateId],
    enabled: Boolean(authToken && childId && itemTemplateId),
    queryFn: () => getItemDetail(authToken!, childId!, itemTemplateId)
  });
  // 라운드 51 C-10: 이 준비템에 아직 전송되지 않은 상태 변경이 있는가. 낙관 반영은 캐시 패치가
  // 이미 해 두지만, 상세를 다시 조회해 서버 값으로 덮이더라도 이 행이 사용자가 마지막으로 누른
  // 값을 지킨다(판정·문구는 src/items/pending-status.ts).
  const syncSnapshot = useOfflineSyncSnapshot();
  const pendingStatusRow = buildPendingItemStatusIndex(syncSnapshot.itemStatusRows, childId).get(itemTemplateId);
  const pendingStatus = pendingItemStatusView(pendingStatusRow);
  useEffect(() => {
    // 목록을 거치지 않고 딥링크로 곧장 들어온 첫 렌더에서도 큐를 읽어 둔다.
    void refreshOfflineSyncSnapshot();
  }, []);

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

  /**
   * 라운드 51 C-10 — 이 화면의 준비 상태 변경 셋(찜하기/찜해제 · 선물 받음/취소 · 지출 없이
   * 준비 완료)이 하나의 **오프라인 우선** 경로로 합쳐졌다.
   *
   * 예전에는 뮤테이션 셋이 각각 PATCH를 쏘고 성공하면 세 캐시를 무효화했다. 실패는 곧 유실이라
   * (큐가 없었다) 오프라인에서 누른 "선물로 받았어요"는 사라졌고, 화면은 "잠시 후 다시 시도해
   * 주세요"라고만 말했다. 이제는 로컬 큐에 남기고 낙관 반영한 뒤 곧바로 돌아온다 -- 전송과
   * 재시도는 sync-engine이, 실패 안내는 그 행의 배지와 동기화 상태 화면이 맡는다.
   *
   * 무효화를 여기서 하지 않는 이유는 목록 탭과 같다: 서버는 아직 옛 값을 들고 있어 지금 다시
   * 물으면 방금 누른 값이 되돌아온다(sync-controller의 updateItemStatusOffline 주석).
   *
   * 라운드 51 #8: 보기 전용 역할이면 큐에 넣지 않고 안내로 답한다 -- 넣어 봐야 403으로 실패
   * 행이 될 뿐이고, 그 사실을 지금 말해 주는 편이 정직하다.
   */
  const applyStatusChange = (status: ItemStatus, options?: { returnToItemsTab?: boolean; onSaved?: () => void }) => {
    if (!authToken || !childId || !itemTemplateId) return;
    if (itemStatusGate.locked) {
      itemStatusGate.explain();
      return;
    }
    setStatusErrorMessage(null);
    void updateItemStatusOffline(authToken, queryClient, {
      childId,
      itemTemplateId,
      itemName: detail.data?.name ?? "",
      status
    })
      .then(() => {
        // ANA-103: 서버 확정이 아니라 **사용자 행동** 시점에 보고한다(목록 탭과 같은 근거).
        // 무엇을 보고할지는 호출부가 정한다 -- 세 진입점이 각자 자기 이벤트를 선언해 두면
        // 어느 버튼이 무엇을 보고하는지 그 자리에서 읽힌다(예전 뮤테이션 셋의 onSuccess와 같다).
        options?.onSaved?.();
        if (options?.returnToItemsTab) {
          // 준비 완료로 정리한 뒤에는 그 변화가 보이는 화면(준비율·준비완료 탭)으로 돌아간다.
          router.replace("/(tabs)/items");
        }
      })
      .catch(() => {
        setStatusErrorMessage(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE);
      });
  };

  // UX-5B-2: 장바구니 스텁 대신 찜하기/찜해제 토글 -- 서버가 실제로 저장하는 'interested'
  // 상태를 items 탭과 같은 status 변경으로 기록한다. 찜해제는 'not_prepared'로 되돌린다.
  const toggleInterested = (status: "interested" | "not_prepared") =>
    applyStatusChange(status, { onSaved: () => trackItemStatusChanged(status) });

  /**
   * ITEM-123 (B4): "선물로 받았어요" — 도메인·DTO·statusLabel에는 있었지만 앱 어디에서도
   * 고를 수 없던 gifted 상태의 유일한 진입점이다. 찜하기 토글과 같은 관례(같은 저장 경로,
   * 같은 ANA-103 이벤트)를 쓰고, 되돌리기는 not_prepared로 돌린다. DNC-015(선물 받은 물건은
   * 지출 합계에서 제외)와도 맞물린다 — 지출을 만들지 않고 준비 상태만 정리하는 경로다.
   */
  const markGifted = (status: "gifted" | "not_prepared") =>
    applyStatusChange(status, { onSaved: () => trackItemStatusChanged(status) });

  /** 링크를 연 뒤 카드의 "지출 없이 준비 완료로 표시". 저장 뒤 준비템 탭으로 돌아간다. */
  const markPrepared = () =>
    applyStatusChange("prepared", { returnToItemsTab: true, onSaved: () => trackItemStatusChanged("prepared") });

  /**
   * GAP-060 #4 — **링크가 실제로 열린 뒤에만** 구매 확인 대기를 남긴다(COM-108).
   *
   * 종전에는 이 등록이 handleProductLinkPress 안, 서버 클릭 기록보다도 **앞**에 있었다. 그래서
   * 링크가 열리지 않은 경우(브라우저가 없다·URL 스킴을 못 연다·서버 클릭 기록이 4xx/5xx로
   * 실패)에도 대기가 그대로 쌓였고, 앱은 3분 뒤부터 **사용자가 본 적도 없는 상품**을 두고
   * "『…』 구매하셨나요?"라고 물었다(purchase_pending 알림까지). 사용자가 한 일은 "링크를
   * 눌렀는데 아무 일도 안 일어났다" 하나뿐인데 앱은 구매를 물은 것이다.
   *
   * 취소(롤백)가 아니라 **성공 후 등록**을 고른 이유: 롤백은 "실패했다는 사실을 놓치면 대기가
   * 남는다"는 경로를 하나 더 만들지만(예외·언마운트·중간에 끼어든 새 클릭), 성공 후 등록은
   * 열렸다는 사실이 확인된 자리 하나에서만 쓴다 -- 더 단순하고, 틀려도 "묻지 않는" 쪽으로
   * 틀린다.
   *
   * clickedAt도 **열린 시각**이다(3분~24시간 창의 기준). 그래야 창의 뜻("살 시간을 준다")과
   * 실제가 맞는다.
   *
   * ANA-103 affiliate_link_clicked는 종전 그대로 **누름** 시점에 남는다(아래
   * handleProductLinkPress) -- 그것은 사용자가 한 행동의 기록이고, 여기 대기 항목은 앞으로
   * 물어볼 물음이라 서로 다른 사실이다.
   */
  const registerPurchaseFollowup = (link: ProductLink) => {
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
      // 라운드 49 C-06(a)가 준비해 둔 선택 인자 배선 -- "샀어요"가 만든 지출이 어떤 상품
      // 링크에서 왔는지 남긴다(빠진 동안에는 늘 undefined였다).
      productLinkId: link.id,
      clickedAt: Date.now()
    });
  };

  /**
   * 이 카드에 마지막으로 쓴 문구의 순번. 아래 폴이 늦게 돌아와 **이미 지난 판정**으로 화면을
   * 덮어쓰지 않게 하는 걸쇠다(라운드 52 QA P3-1이 저장 실패 문구에서 없앤 그 레이스 --
   * 실패 → 재시도 성공 사이에 도착한 오프라인 판정이 성공 문구를 지웠다). 언마운트되면
   * -1이 되어 사라진 화면에 setState가 걸리지 않는다.
   */
  const linkNoticeSeqRef = useRef(0);
  useEffect(() => {
    return () => {
      linkNoticeSeqRef.current = -1;
    };
  }, []);
  /** 링크 카드 문구를 쓰는 **한 자리**. 쓰는 순간 이전 폴의 결과는 지난 것이 된다. */
  const showLinkNotice = (text: string) => {
    linkNoticeSeqRef.current += 1;
    setClickedTitle(text);
  };
  /**
   * GAP-060 #4 — 링크 실패 문구의 **오프라인 정직** 갈래. 예산·아이 프로필 저장(라운드 52
   * C-07), CSV 내보내기(GAP-056 #3), 가족 관리가 이미 지나온 그 관례에 커머스 경로만 빠져
   * 있었다: 연결이 아예 없을 때 "잠시 후 다시 시도해 주세요"는 사실과 어긋난다(기다릴 대상이
   * 없고, 다시 눌러도 같은 실패다).
   *
   * 온라인 문구는 한 글자도 바꾸지 않고, 오프라인으로 **확인됐을 때만** messages.ts의 단일
   * 소스 문장으로 갈린다(여기서 문구를 새로 짓지 않는다). 판정은 실패 시점의 폴 한 번이고,
   * 판정할 수 없는 플랫폼에서는 true라 기존 문구로 안전하게 떨어진다.
   */
  const showLinkFailure = (onlineNotice: string) => {
    showLinkNotice(onlineNotice);
    const seq = linkNoticeSeqRef.current;
    void isCurrentlyOnline().then((online) => {
      // 그 사이에 더 최신 문구가 섰거나(재시도 성공) 화면이 사라졌으면 버린다.
      if (linkNoticeSeqRef.current !== seq) return;
      if (!online) setClickedTitle(OFFLINE_RETRY_NOTICE);
    });
  };

  const retryOpenFallbackLink = async () => {
    if (!linkOpenFallback) return;
    try {
      const canOpen = await Linking.canOpenURL(linkOpenFallback.redirectUrl);
      if (!canOpen) throw new Error("cannot-open-url");
      await Linking.openURL(linkOpenFallback.redirectUrl);
      // GAP-060 #4: 재시도로 열린 것도 **열린 것**이다 -- 첫 시도와 같은 자리에서 같은 사실을
      // 남긴다(그러지 않으면 재시도로 산 사람에게는 구매 확인이 영영 오지 않는다).
      registerPurchaseFollowup(linkOpenFallback.link);
      showLinkNotice(linkOpenFallback.disclosureText ?? "구매 링크");
      setLinkOpenFallback(null);
    } catch {
      showLinkFailure(linkOpenFailureNotice(linkOpenFallback.shareUrl));
    }
  };

  /**
   * 라운드 64 #5ⓐ — 링크를 앱 밖으로 내보낼 때 **고지를 함께** 내보낸다(DNC-010).
   *
   * 예전에는 저장해 둔 리다이렉트 URL 한 줄만 메시지로 나갔다(제휴 URL 그 자체다).
   * 화면에서는 고지가 구매 CTA 바로 위에 서 있는데, 그 링크가 카카오톡으로 건너가는
   * 순간 인접이라 부를 자리가 사라져 고지가 통째로 빠졌다 — 받는 사람은 제휴 링크라는 사실을
   * 들을 근거가 없다.
   *
   * 문구를 여기서 짓지 않는다: 조립은 순수 모듈 한 자리(src/items/link-marker.ts의
   * `purchaseLinkShareMessage`)이고, 그 안에서 화면과 **같은 판정**(`productLinksDisclosureText`)이
   * 돈다. 일반 링크(제휴도 스폰서도 아님)는 종전 그대로 URL 한 줄이다.
   *
   * 라운드 67 #4 — **나가는 URL을 공개 리다이렉트로 옮긴다**(라운드 64가 이 자리에 남긴 몫이고,
   * 그 선행 조건인 어드민 노출은 라운드 64 D가 채웠다).
   *
   * 종전에는 `redirectUrl`(= 저장된 원문 제휴 URL)이 그대로 나갔다. 그래서 ⓐ 그 사본으로 산
   * 구매는 우리 집계에 한 줄도 남지 않았고, ⓑ 어드민이 깨진 링크를 내려도 이미 나간 사본은
   * 계속 살아 있었다. 서버가 주는 `shareUrl`(공개 리다이렉트 `/r/:code`의 절대 주소)로 나가면
   * 그 클릭이 익명 행으로 집계에 남고, 내려간 링크는 그 주소에서 404가 된다.
   *
   * **여는 URL은 그대로다**(위 openLink·retryOpenFallbackLink는 `redirectUrl`을 쓴다) — `/r/`로
   * 열면 이 화면이 만든 클릭 행과 리다이렉트가 만드는 익명 행이 겹쳐 한 번의 클릭이 두 번
   * 세어진다(허위 수치).
   *
   * URL을 여기서 짓지 않는다: 서버가 만든 문자열을 그대로 싣는다(베이스는 API 환경변수라
   * 앱이 알 수 없다).
   *
   * 라운드 68 C(#4) — **`shareUrl`이 없으면 내보내지 않는다.** 종전에는 원문 URL
   * (`redirectUrl`)로 떨어졌는데, 서버가 그 값을 빼는 조건이 하나 늘면서 그 폴백이 정확히
   * 반대 방향이 됐다: 워커가 눌러 보고 4xx를 받은 링크(`health_status = "broken"`)에는 서버가
   * `shareUrl`을 싣지 않으므로, 폴백을 두면 **우리가 죽은 줄 아는 주소**를 원문 그대로(집계도
   * 회수도 없이) 친구에게 보내게 된다. 그래서 버튼 자체를 내린다 — 공유할 수 있는 주소가
   * 없다는 것이 사실이고, 없는 것을 대신 지어내지 않는다. 판정·근거는 순수 모듈 한 자리다
   * (src/items/link-marker.ts의 `canSharePurchaseLink`).
   */
  const shareFallbackLink = () => {
    if (!linkOpenFallback) return;
    if (!canSharePurchaseLink(linkOpenFallback.shareUrl)) return;
    void Share.share({
      message: purchaseLinkShareMessage({
        url: linkOpenFallback.shareUrl,
        link: linkOpenFallback.link,
        disclosureText: linkOpenFallback.disclosureText
      })
    });
  };

  /**
   * 서버 클릭 기록(POST /product-links/:id/click) — 성공하면 그 응답의 리다이렉트 주소를 연다.
   *
   * ⚠️ **자리 이동 한 번**(라운드 77 A — 동작 0건 변경, 훅 순서도 그대로다: 옮겨 온 구간에는
   * 훅이 하나도 없다). 이 뮤테이션은 자기가 쓰는 헬퍼들(`showLinkNotice`·`showLinkFailure`·
   * `registerPurchaseFollowup`·`retryOpenFallbackLink`·`shareFallbackLink`) **뒤**로 내려왔다.
   * 사유는 둘이고 둘 다 이 파일 안에서 확인된다: **읽는 순서**(헬퍼가 먼저, 그것을 쓰는
   * 소비자가 뒤)와, **구매 확인 대기 등록이 전부 이 뮤테이션 앞에 모인다**는 사실
   * (`onSuccess`의 성공 자리와 폴백 재시도 자리 둘뿐이다).
   *
   * ⚠️ **라운드 79 정정(P3 · S-5 잔여) — 종전 주석이 적어 둔 세 번째 사유는 오늘 존재하지
   * 않는다.** 그 주석은 *"다른 파일의 소스 계약이 끝점을 잃기 때문"* 이라며
   * `src/commerce/purchase-followup-flow.test.ts`가 옛 `onError` **시그니처 문자열**까지를 잘라
   * 확인한다고 적었는데, 그 끝점은 이미 접두(`"onError: ("`)로 바뀌었고 시작·끝 두 인덱스의
   * 실재 확인까지 함께 서 있다(라운드 77 리뷰 M-3). 그리고 오늘 그 단언이 자르는 구간은
   * **onSuccess의 `} catch {`부터 같은 뮤테이션의 onError까지**라 **이 블록이 파일 어디에 있든
   * 참**이다. 즉 그 주석이 말하던 제약은 사라졌다 — **되돌리지 않는다는 판정은 그대로**이고
   * (라운드 78 S-5), 고친 것은 사유 한 문단뿐이다(**코드 0줄 · 동작 0건**).
   */
  const clickLink = useMutation({
    mutationFn: (link: ProductLink) => clickProductLink(authToken!, link.id, childId!, "ITEM-003"),
    onSuccess: async (result, link) => {
      showLinkNotice(result.disclosureText ?? "구매 링크");
      setLinkOpenFallback(null);
      try {
        const canOpen = await Linking.canOpenURL(result.redirectUrl);
        if (!canOpen) throw new Error("cannot-open-url");
        await Linking.openURL(result.redirectUrl);
        registerPurchaseFollowup(link);
      } catch {
        // 라운드 68 C: 문구도 **공유 가능 여부와 같은 판정**에서 갈린다 — 공유 버튼이 서지
        // 않는 상태에서 "링크를 공유하거나"라고 말하면 화면의 두 주장이 어긋난다.
        showLinkFailure(linkOpenFailureNotice(result.shareUrl));
        setLinkOpenFallback({
          redirectUrl: result.redirectUrl,
          shareUrl: result.shareUrl,
          disclosureText: result.disclosureText,
          link
        });
      }
    },
    /**
     * 라운드 77 A — **서버가 이미 말해 준 이유를 이 자리에서 뭉개지 않는다**(핵심 루프 4단계).
     *
     * 종전 이 핸들러는 `error`를 **받지도 않았다.** 그래서 어드민이 내린 링크(404
     * PRODUCT_LINK_NOT_FOUND) · 허용 도메인 밖 주소(같은 404) · 깨진 스킴(400
     * PRODUCT_LINK_URL_SCHEME_INVALID)이 전부 *"잠시 후 다시 시도해 주세요."* 를 받았다.
     * 셋 다 **다시 눌러도 결과가 같다** — 그 상세에 다른 판매처 링크가 두 개 더 서 있는데도
     * 앱이 "기다리면 된다"고 말했으므로 사용자는 그것을 눌러 볼 이유를 얻지 못했다.
     *
     * 문구는 여기서 짓지 않는다: 아는 코드면 앱 전역 표(src/api/api-error.ts)가 답하고,
     * 모르는 실패는 **종전 그대로**(문장 바이트 불변) `showLinkFailure`의 오프라인 갈래로 간다.
     *
     * ⚠️ 아는 코드일 때 **오프라인 폴을 돌리지 않는다**: 서버가 코드로 답했다는 사실이 곧
     * 연결이 있었다는 뜻이라, 그때 "인터넷 연결을 확인해 주세요"로 갈아 끼우면 새 오안내가
     * 선다(src/family/invite-permissions.ts가 403을 연결 판정보다 앞에 두는 그 근거 그대로).
     * 그래서 아는 코드는 `showLinkNotice` 한 자리로 간다 — 그 함수가 seq를 올리므로
     * 앞선 폴이 늦게 돌아와 이 문구를 덮는 일도 없다.
     */
    onError: (error) => {
      const knownFailureReason = apiErrorMessageForCode(apiErrorCodeOf(error));
      if (knownFailureReason) showLinkNotice(knownFailureReason);
      else showLinkFailure("링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
      setLinkOpenFallback(null);
    }
  });

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
  // 라운드 51 C-10: 화면이 말하는 "내 준비 상태"는 대기 중인 변경이 있으면 그 값이다 -- 방금
  // 누른 값이 이 기기의 진실이고, 서버 응답은 아직 그 사실을 모르는 옛 값이다. 대기 행이 없으면
  // 종전 그대로 서버 값이라, 비세션 프리뷰(ITEM-002 픽셀락 캡처)에는 영향이 없다.
  const displayStatus = effectiveItemStatus(visibleDetail.status, pendingStatusRow) as ItemStatus;
  const isInterested = displayStatus === "interested";
  /**
   * FIX-C — 상세 헤더의 히어로 글리프가 **품목별 아이콘**이 된다(두 시점).
   *
   * ① DSN-053 P2-B(라운드 48 A3c 후속)는 응답에 상품 사진이 없다는 사실 앞에서 히어로 카드에
   *    범용 상자 글리프(`package-variant-closed`) 하나를 세웠다 — 그때는 "사진을 지어내지
   *    않는다"가 판정의 전부였고 어떤 글리프인지는 논점이 아니었다.
   * ② FIX-C(2026-09-03): 목록 타일은 이미 품목별 아이콘을 그린다(유모차 → baby-carriage,
   *    PreparationListParity.tsx가 이 해석기를 같은 모양으로 부른다). 목록에서 유모차 아이콘을
   *    보고 들어온 상세가 상자를 보여 주면 같은 물건인지 확신할 수 없으므로, **같은 해석기의
   *    같은 판정**을 헤더에 쓴다. 해석기는 읽기만 한다(매핑 모듈·목록 렌더 0바이트 변경).
   *    모르는 품목이면 해석기의 기존 폴백(baby-face-outline)이 그대로 선다 — 여기서 새 폴백을
   *    만들지 않는다. 비세션 프리뷰(ITEM-002 픽셀락 캡처)는 사진 분기라 이 값에 닿지 않는다.
   */
  const heroVisual = resolvePreparationItemVisual({
    code: itemTemplateId,
    nameKo: visibleDetail.name,
    primaryCategory: null
  });
  // 라운드 48 T1(A4): 내 준비 상태 라벨. 목록 카드 배지와 같은 모듈이 정하고
  // (src/items/item-labels.ts), 준비 전(기본값)이면 undefined라 줄 자체가 사라진다.
  const statusBadgeLabel = itemStatusBadgeLabel(displayStatus);
  const isGifted = displayStatus === "gifted";
  /**
   * 라운드 43 UX-V (C2): 구매처가 하나도 없는 준비템 — **라운드 43 당시** 시드 62개 품목 중 4개
   * (영양제·기저귀 재고·이유식 메이커·첫 그림책)가 링크 0개였다. ⚠️ 라운드 82 리뷰 M-4:
   * **라운드 82 B 이후 시드는 62/62로 링크 0건 품목이 없다**(그 넷에 일반 링크를 채웠고,
   * `apps/api/test/seed-data.test.ts`의 링크 0건 대장이 래칫 0으로 그 사실을 지킨다). 그래도 이
   * 분기는 죽은 코드가 아니다 — 어드민이 링크를 비활성화하거나 운영 데이터가 시드와 다른 창에서는
   * 여전히 도달한다(같은 사실이 src/items/link-marker.ts의 EMPTY_PRODUCT_LINKS_TEXT에도 적혀 있다).
   * 예전에는 그 화면에서도
   * 구매 CTA가 그대로 서 있었고(누르면 productLinks[0]이 없어 **아무 일도 일어나지 않는**
   * 죽은 버튼), 제휴 고지도 기본 문구로 렌더됐다.
   *
   * DNC-010은 "구매 CTA 인접 위치의 제휴 고지를 숨기지 않는다"는 계약이다. 구매 CTA도
   * 제휴 링크도 없는 화면에는 고지할 대상 자체가 없으므로, 여기서 고지를 그리지 않는 것은
   * 숨기는 것이 아니다 — 오히려 제휴 관계가 없는 자리에 제휴 문구를 띄우는 쪽이 허위 표시다.
   * 링크가 하나라도 있으면 예전과 똑같이 구매 CTA가 렌더된다(ITEM-002 프리뷰 포함).
   */
  const hasProductLinks = hasPurchasableLink(visibleDetail.productLinks);
  /**
   * 라운드 43 리뷰 M-1/M-2: 고지 문구는 **링크 집합**이 정한다(src/items/link-marker.ts).
   *
   * 예전에는 `productLinks[0]?.disclosureText`를 읽고 값이 없으면 컴포넌트 기본 문구를
   * 그렸다 — (1) 제휴도 스폰서도 아닌 일반 링크뿐인 화면(시드 링크 중 그런 링크가 라운드 43 당시
   * 58개 중 34개 · 라운드 83 A 이후 67개 중 43개)이
   * "수수료를 받을 수 있어요"라고 말했고, (2) 문구가 맨 앞 링크에 매여 있어 워커 헬스 기반
   * 정렬(UX-W)이 순서를 바꾸면 고지 문구까지 조용히 따라 바뀌었다.
   *
   * 이제 undefined면 고지할 대상이 없다는 뜻이라 렌더하지 않는다 — DNC-010의 은닉이 아니라
   * C2("구매처 0개")와 같은 "고지 대상 부재"다. 스폰서/제휴가 하나라도 있으면 종별 우선순위
   * (스폰서 > 제휴)로 문구가 정해지고, 그 화면의 제휴 링크 행에는 여전히 제휴 배지·캡션이
   * 남는다(productLinkMarker — DNC-010/DNC-011).
   */
  const affiliateDisclosureText = productLinksDisclosureText(visibleDetail.productLinks);
  /**
   * 채워진 "구매하기" 버튼을 받을 판매처 행(src/items/link-marker.ts). 순서상 첫 줄이 아니라
   * **첫 비스폰서 줄**이다 — 스폰서가 1위로 정렬되면 광고 자리만 가장 강한 CTA를 갖게 되는데,
   * 그건 스폰서를 구분해 표시하라는 DNC-011을 우대로 뒤집는 것이다. 전부 스폰서면 -1이라
   * 채워진 버튼이 하나도 없다.
   */
  const filledPurchaseRowIndex = primaryPurchaseLinkIndex(visibleDetail.productLinks);
  /**
   * 라운드 64 #1 — 카드 아래 전폭 구매 CTA가 여는 링크. **판매처 행의 채움과 같은 판정**이다.
   * (라벨 문자열은 아래 PrimaryButton 한 자리에만 둔다 — 여러 계약 테스트가 그 문자열의
   * 첫 등장 위치로 화면 순서를 대조하므로 주석에 같은 문자열을 다시 적지 않는다.)
   *
   * 고치는 문제: 이 버튼은 응답의 첫 링크(productLinks[0])를 그대로 열었다. 바로 위 판매처
   * 목록은 `filledPurchaseRowIndex`로 스폰서 행을 외곽선으로 격하시켜 놓는데, 그 한 줄 아래
   * 화면에서 가장 큰 버튼이 **같은 스폰서 링크**를 열었다 — DNC-011이 세우려던 시각 구분이
   * 통째로 되돌려지는 자리였다. 가정이 아니라 **라운드 82 시드로 재현됐다**(유일한 링크가
   * 스폰서인 품목 다섯: 유모차·임신일기·물티슈 대용량·보행기·유아 자전거) — 라운드 83 A가
   * 그 다섯에 일반 링크를 하나씩 더해 **오늘 시드에는 0건**이고, 그래서 그 다섯 화면에도
   * 전폭 CTA가 선다(계약은 apps/api/test/seed-data.test.ts의
   * `ITEM_CODES_WITHOUT_NON_SPONSORED_LINK` 대장·래칫 0). 운영에서는 더 조용하다 —
   * 비스폰서 1순위 링크가 워커 헬스로 broken 판정을 받아 뒤로 밀리는 날, 코드 변경도 어드민
   * 조작도 없이 index 0이 스폰서가 된다.
   *
   * 새 판정을 만들지 않는다: `primaryPurchaseLinkIndex`가 이미 답을 알고 있다(스폰서는 순서와
   * 무관하게 강조를 받지 않는다). 정렬은 한 줄도 건드리지 않는다(DNC-009).
   *
   * 전부 스폰서(-1)면 이 버튼을 **렌더하지 않는다** — 링크 0건에서 죽은 버튼을 지운 라운드 43
   * C2와 같은 규율이다. 구매 경로가 좁아지는 것이 아니다: 그 링크는 판매처 행에 그대로 서
   * 있고, 그 행에는 스폰서 배지와 "광고/스폰서" 캡션이 붙어 있다. 광고를 광고라고 말한
   * 자리에서만 누르게 되는 것이 DNC-011의 취지다.
   *
   * ITEM-002 픽셀락(비세션 프리뷰)은 index 0이 비스폰서라 판정이 0이고, 버튼은 종전과 똑같이
   * 렌더된다 — 캡처는 한 픽셀도 달라지지 않는다.
   */
  const primaryPurchaseLink =
    filledPurchaseRowIndex >= 0 ? visibleDetail.productLinks[filledPurchaseRowIndex] : undefined;
  /**
   * 라운드 49 C-04: "이 준비템으로 기록한 지출" 한 줄. 세션 게이트·표기·문구는 전부 순수
   * 모듈이 정하고(src/items/linked-expense.ts) 화면은 그리기만 한다 -- 비세션 프리뷰
   * (ITEM-002 픽셀 락 캡처)에서는 null이라 줄 자체가 없다.
   */
  const linkedExpense = linkedExpenseRow({ hasSession, linkedExpense: visibleDetail.linkedExpense });
  // ITEM-123 (B4): 상태를 바꾸기 전 확인 -- 지출 삭제/설정 화면과 같은 Alert 관례
  // (질문형 제목 + "취소" cancel 버튼 + 실행 버튼). 준비 전으로 되돌리는 쪽도 목록에서
  // 항목이 다시 나타나는 눈에 띄는 변화라 같이 확인한다.
  function confirmGiftedChange() {
    if (isGifted) {
      Alert.alert("선물 받음을 취소할까요?", "다시 준비 전으로 돌아가요.", [
        { text: "취소", style: "cancel" },
        { text: "되돌리기", onPress: () => markGifted("not_prepared") }
      ]);
      return;
    }
    Alert.alert("선물로 받았어요", "이 준비템을 선물로 받은 걸로 표시할까요? 준비완료 탭에서 볼 수 있어요.", [
      { text: "취소", style: "cancel" },
      { text: "표시하기", onPress: () => markGifted("gifted") }
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
  /**
   * 라운드 91 A — 왕복이 끝나기 전의 **두 번째 탭**을 조용히 떨어뜨린다(핵심 루프 4단계).
   *
   * ⚠️⚠️ **두 시점 — 라운드 91 A가 세운 가드는 뮤테이션 단위였고, 라운드 91 리뷰가 링크 단위로
   * 좁힌다.** A가 적은 줄은 `if (clickLink.isPending) return;` 한 조건이었다. 그 모양은 *"이
   * 화면에서 왕복이 하나라도 돌고 있으면 아무것도 누를 수 없다"* 는 뜻이라, **누른 적 없는 다른
   * 판매처 행까지 함께 삼켰다** — 이 화면의 누르는 자리 둘(판매처 비교 행 · 구매 CTA)은 한
   * 핸들러로 모이지만 **서로 다른 링크**를 넘긴다(`handleProductLinkPress(link)` ·
   * `handleProductLinkPress(primaryPurchaseLink)`). 느린 망에서 A의 가드는 첫 탭이 도는 동안
   * 사용자가 *다른 판매처*를 눌러 보는 정당한 행동까지 아무 말 없이 없앴고, 그 자리는 A가 막으려던
   * 중복 기록(**허위 수치**)과 아무 상관이 없다.
   *
   * ⚠️ **그래서 오늘의 조건은 *같은 링크인가*까지 묻는다.** `clickLink.variables`는 방금 `mutate`에
   * 넘긴 그 링크이므로, 같은 링크를 다시 누른 탭만 떨어지고 **다른 링크는 정당한 별개의 클릭으로
   * 통과한다**. 중복 기록을 막는 힘은 그대로다 — 두 번 기록되는 자리는 언제나 *같은 링크의 두 번째
   * 탭*이기 때문이다.
   *
   * ⚠️ **여전히 `disabled`가 아니다**: 대기 창 동안 픽셀이 바뀌면 승인 캡처(ITEM-002 · DSN-053)가
   * 갈리고, `ProductComparisonRow`에는 `disabled` 프롭이 아예 없다.
   */
  const handleProductLinkPress = (link: ProductLink) => {
    if (clickLink.isPending && clickLink.variables?.id === link.id) return;
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
      // GAP-060 #4: 구매 확인 대기는 여기서 남기지 않는다 -- 링크가 실제로 열린 뒤에만
      // (clickLink.onSuccess / retryOpenFallbackLink의 registerPurchaseFollowup) 남긴다.
      clickLink.mutate(link);
      return;
    }
    showLinkNotice(link.disclosureText ?? "구매 링크를 확인했어요.");
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

          {hasSession ? (
            <Card style={productDetailHeroCardStyle()}>
              <View style={productDetailSessionHeroPlaceholderStyle()}>
                <AppIcon color={theme.colors.coral[600]} name={heroVisual.icon} size={64} />
              </View>
            </Card>
          ) : (
            <Card style={productDetailHeroCardStyle()}>
              <Image source={productImage} style={productDetailHeroImageStyle()} resizeMode="cover" />
            </Card>
          )}

          <Card style={productDetailInfoCardStyle()}>
            {/* 라운드 62 #7: 다자녀 세션에서만 서는 한 줄 — 이 상세가 누구의 준비템인가.
                게이트·근거는 위 childScopeLabel 주석에 있다(ITEM-002 캡처는 비세션이라 불변).
                조립은 공용 함수 하나뿐이고 이 화면에서 문자열을 다시 잇지 않는다. */}
            {hasSession && childScopeLabel ? (
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>
                {withChildScopeLabel("준비템", childScopeLabel)}
              </Text>
            ) : null}
            <Text style={{ color: theme.colors.brown, fontSize: 21, fontWeight: "800" }}>{visibleDetail.name}</Text>
            {/* 라운드 48 T1(A4): 내 준비 상태 한 줄. 목록 카드 배지와 **같은 문구**를 쓴다
                (src/items/item-labels.ts) -- 목록에서 "선물 받음"으로 보이던 항목이 상세에서는
                아무 말도 없거나 다른 단어로 불리면 같은 물건인지 확신할 수 없다. 준비 전
                (not_prepared)은 알릴 사실이 없어 줄 자체가 나오지 않는다.
                세션 게이트: ITEM-002 픽셀 락 캡처(비세션 프리뷰)에는 존재하지 않는다. */}
            {hasSession && statusBadgeLabel ? <StatusBadge label={statusBadgeLabel} /> : null}
            {/* 라운드 51 C-10: 그 상태가 아직 이 기기에만 있다는 사실. 바로 위 배지가 이미 새
                값을 말하고 있으므로 여기서는 "언제 반영되는지"만 덧붙인다 -- 문구는 기록 탭의
                대기/실패 행과 같은 단어를 쓴다(src/offline/messages.ts). 큐가 비면 통째로
                사라지고, 비세션 프리뷰(ITEM-002 캡처)에는 애초에 대기 행이 없다. */}
            {hasSession && pendingStatus ? (
              <View style={{ gap: 4 }}>
                <StatusBadge label={pendingStatus.badgeLabel} tone="warning" />
                <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                  {pendingStatus.noticeText}
                </Text>
              </View>
            ) : null}
            {/* 라운드 49 C-04: 준비 상태 바로 아래에 **그 준비로 실제 기록한 지출** 한 줄.
                지금까지 연결은 "지출 → 준비템" 한 방향으로만 보였고(지출을 저장하면 준비템이
                준비 완료가 된다, R19-B), 그 반대편인 이 화면에는 얼마를 언제 썼는지가 없었다 --
                핵심 루프의 마지막 칸에서 확인할 수 있는 게 배지뿐이었다.

                값은 전부 서버 응답 그대로다(금액을 가격대에서 추정하지 않는다). 서버가
                **삭제되지 않은 지출만** 싣고(items-catalog.service.ts linkedExpenseDto), 값이
                없으면 이 줄 자체가 없다. 세션 게이트는 모듈 안에 있어 ITEM-002 픽셀 락 캡처
                (비세션 프리뷰)에는 나오지 않는다.

                위치: 제휴 고지와 구매 CTA 사이가 아니라 정보 카드 안이다(DNC-010 인접성 무접촉). */}
            {linkedExpense ? (
              <TextButton
                label={linkedExpense.text}
                accessibilityLabel={linkedExpense.accessibilityLabel}
                onPress={() => router.push(linkedExpense.href)}
              />
            ) : null}
            {/* UX-5B-1: 별점·최저가 등 API에 없는 가짜 수치는 렌더하지 않는다 -- 실제 응답의
                가격대(priceBandText)만 보여주고, 없으면 아무것도 표시하지 않는다.
                DSN-053 P2-B: 승인 디자인의 "예상 가격대" 라벨이 그 값 위에 선다. 라벨과 값은
                한 덩어리라 값이 없으면 라벨도 나오지 않는다 -- 빈 가격 아래 라벨만 남으면
                "가격대가 있는데 못 불러왔다"로 읽힌다. */}
            {visibleDetail.priceBandText ? (
              <View style={{ gap: 4 }}>
                {/* 라벨은 세션 렌더에만 붙인다 -- ITEM-002 픽셀 락 캡처(비세션 프리뷰)의
                    렌더는 이 트랙에서 한 글자도 바꾸지 않기로 한 계약이다. */}
                {hasSession ? (
                  <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>예상 가격대</Text>
                ) : null}
                <Text style={{ color: theme.colors.gray900, fontSize: 26, fontWeight: "800" }}>{visibleDetail.priceBandText}</Text>
              </View>
            ) : null}

            {/* 라운드 43 UX-V (C4) → DSN-053 P2-B: 승인 디자인의 "가격 비교 / 제품 정보" 밴드가
                돌아오되, **실제로 눌리는 탭**이다. C4가 없앤 것은 밴드 자체가 아니라 "누를 수
                없는 것을 탭처럼 그리는 것"이었다 — 두 칸이 각각 카드 아래 내용을 바꾸므로 그
                금지는 그대로 지켜진다. 비세션 프리뷰(ITEM-002 픽셀 락 캡처)는 상태가 없는
                기준 이미지 그대로 둔다. */}
            {hasSession ? (
              <View
                accessibilityRole="tablist"
                style={{ borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, flexDirection: "row", gap: 28, paddingTop: 8 }}
              >
                {PRODUCT_DETAIL_TABS.map((tab) => {
                  const selected = detailTab === tab.value;
                  return (
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      key={tab.value}
                      onPress={() => setDetailTab(tab.value)}
                      // 텍스트+패딩(≈31dp)에 hitSlop 6으로는 48dp 타깃 미달이라 높이로 확보한다.
                      style={{ justifyContent: "flex-end", minHeight: theme.touchTarget }}
                    >
                      <Text
                        style={
                          selected
                            ? { borderBottomColor: theme.colors.gray900, borderBottomWidth: 2, color: theme.colors.brown, fontSize: 13, fontWeight: "800", paddingBottom: 9 }
                            : { color: theme.colors.gray600, fontSize: 13, fontWeight: "700", paddingBottom: 9 }
                        }
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={{ borderBottomColor: theme.colors.gray300, borderBottomWidth: 1, flexDirection: "row", gap: 28, paddingTop: 8 }}>
                <Text style={{ borderBottomColor: theme.colors.gray900, borderBottomWidth: 2, color: theme.colors.brown, fontSize: 13, fontWeight: "800", paddingBottom: 9 }}>
                  가격 비교
                </Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 13, fontWeight: "700", paddingBottom: 9 }}>제품 정보</Text>
              </View>
            )}

            {/* "제품 정보" 탭 -- 서버 응답에 실제로 있는 값만 줄로 세운다(없는 항목은 줄 자체가
                없다). 아래 설명 카드(왜 필요해요? 등)를 여기로 옮겨 오지 않는다: 그 카드들은
                탭과 무관하게 계속 보여야 하는 내용이다. */}
            {hasSession && detailTab === "info" ? (
              <View accessibilityLabel="제품 정보" style={{ gap: 8 }}>
                {productDetailFacts(visibleDetail, displayStatus).map((fact) => (
                  <View key={fact.label} style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
                    <Text style={{ color: theme.colors.gray600, fontSize: 13, width: 92 }}>{fact.label}</Text>
                    <Text style={{ color: theme.colors.brown, flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 20 }}>
                      {fact.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {hasSession && detailTab === "info" ? null : hasProductLinks ? (
              visibleDetail.productLinks.map((link, index) => {
                // C3: 배지와 캡션을 한 판정에서 함께 받는다(src/items/link-marker.ts).
                // 예전에는 배지만 3분기하고 캡션은 스폰서 여부로만 갈라, 일반 링크에
                // "일반" 배지와 "제휴 링크" 캡션이 나란히 붙는 모순이 있었다.
                const linkMarker = productLinkMarker(link);
                // 라운드 52 C-01: 가격과 그 확인 시각을 **한 판정에서 함께** 받는다
                // (src/items/link-price.ts). 둘 중 하나라도 없으면 null이고, 그때 이 행은
                // 종전 그대로 가격 칸을 비운다 -- 값만 크게 찍고 언제 확인한 값인지를
                // 빠뜨리는 배선을 만들 수 없게, 두 조각이 같은 객체에서만 나온다.
                const linkPrice = hasSession ? resolveLinkPriceDisplay(link) : null;
                return (
                  <View key={link.id} style={{ gap: 6 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                      <StatusBadge label={linkMarker.badgeLabel} tone={linkMarker.badgeTone} />
                      {linkMarker.caption ? (
                        <Text style={{ color: theme.colors.gray600, flex: 1, fontSize: 11 }}>{linkMarker.caption}</Text>
                      ) : null}
                    </View>
                    {/* UX-5B-1: 링크별 가짜 판매가 대신, API가 주는 가격대만 표시 (없으면 빈칸).
                        C4: 세션 경로에서는 그마저 비웠다 — 세 판매처 행에 **같은** 가격대를
                        나란히 찍으면 서로 다른 값을 견준 것처럼 읽히는데, 그 값은 이미 카드
                        상단에 큰 글씨로 한 번 나와 있다.
                        C3: 판매처 아래 한 줄도 "무료배송"(근거 없음) 대신 실제 platform 값.

                        라운드 52 C-01: 이제 **판매처별 실판매가가 API에 있다**(라운드 51 #9의
                        priceSnapshotKrw). 그래서 세션 경로의 빈 가격 칸에 그 값을 넣되, 같은
                        행 캡션에 "언제 확인한 값인지"를 반드시 붙인다 — 두 문자열이 같은 판정
                        객체(linkPrice)에서만 나오므로 한쪽만 그릴 수 없다. 가격이 없는 링크는
                        linkPrice가 null이라 가격 칸도 캡션도 종전 그대로다.
                        비세션 프리뷰(ITEM-002 픽셀 락 캡처)는 한 글자도 건드리지 않는다. */}
                    <ProductComparisonRow
                      /* DSN-053 P2-B: 승인 캡처(ITEM-002)의 판매처 행은 **한 줄만** 채워진
                         "구매하기"이고 나머지는 외곽선 "구매"다(src/ui.tsx primaryAction 주석).
                         그 한 줄은 첫 비스폰서 링크다(filledPurchaseRowIndex — DNC-011).
                         비세션 프리뷰는 종전 렌더 그대로 둔다(캡처 불변). */
                      primaryAction={hasSession && index === filledPurchaseRowIndex}
                      seller={link.title}
                      price={hasSession ? linkPrice?.priceText ?? "" : visibleDetail.priceBandText ?? ""}
                      caption={hasSession ? withLinkPriceCaption(productPlatformLabel(link.platform), linkPrice) : undefined}
                      onPress={() => handleProductLinkPress(link)}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{EMPTY_PRODUCT_LINKS_TEXT}</Text>
            )}
          </Card>

          <Card>
            <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
              왜 필요해요?
            </Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{visibleDetail.reasonText}</Text>
          </Card>

          {/* FIX-C(2026-09-03) — 안내 카드 축소(두 시점).
              ① COM-101(라운드 5a §6)은 skipReasonText 카드("이런 경우엔 안 사도 …" 제목)를
                 여기, "왜 필요해요?" 다음에 세웠다.
              ② FIX-C: 상세의 설명 카드는 **둘**로 줄인다 — "왜 필요해요?"와 중고 구매 안내만
                 남기고 이 카드는 렌더를 지운다. 데이터는 그대로다: skipReasonText는 서버
                 DTO·로컬 픽스처·ItemDetail 타입에 남아 있고(계약 무변), 화면이 그리지 않을
                 뿐이다. 제목 전문을 이 주석에 다시 적지 않는다 — 부재 계약이 주석에 걸려
                 통과해 버리면 안 되기 때문(GAP-064 #1이 라벨 문자열에 세운 그 규율). 계약
                 이관은 src/items-commerce-flow.test.ts(COM-101)·src/design-restore-p2b.test.ts·
                 src/commerce/purchase-followup-flow.test.ts에 같은 두 시점으로 적었다. */}

          {/* 라운드 48 T1(A1/A2c): 서버가 준비템마다 들고 있었지만 앱이 한 번도 그리지 않던
              신뢰 정보 세 가지 -- 의료 상담 안내(medicalDisclaimerRequired), 안전 확인
              (safetyNote), 중고 구매 OK(usedSecondhandOk). 판정과 문구는 순수 모듈이 정하고
              (src/items/item-trust-notes.ts) 화면은 그리기만 한다.

              위치: "왜 필요해요?" 다음, 제휴 고지 **앞**이다 -- 고지와 구매 CTA
              사이에는 아무것도 끼우지 않는다(DNC-010 인접성).

              세션 게이트는 모듈 안에 있다(hasSession=false면 빈 배열): 프리뷰 픽스처가
              safetyNote를 갖고 있어도 ITEM-002 픽셀 락 캡처에는 카드가 한 장도 나오지 않는다.

              FIX-C(2026-09-03) — 두 시점 하나 더: ① 라운드 48 T1은 세 카드(의료·안전·중고)를
              전부 그렸다. ② FIX-C는 안내 카드 축소 지시에 따라 안전 카드(SAFETY_NOTE_TITLE
              — 제목 전문은 부재 계약 때문에 여기 적지 않는다)만
              **렌더에서** 거른다 — 판정 모듈과 그 값 계약(item-trust-notes.test.ts의 모듈
              테스트)은 무변이고, safetyNote는 여전히 모듈에 넘긴다(배선 계약 유지). 의료 상담
              안내(medical)는 지시 대상 밖이라 남긴다(DNC-020 — 있는 품목이 드물고, 확인해야
              할 사실을 지우는 쪽이 더 위험하다). */}
          {itemTrustNotes({
            hasSession,
            usedSecondhandOk: visibleDetail.usedSecondhandOk,
            safetyNote: visibleDetail.safetyNote,
            medicalDisclaimerRequired: visibleDetail.medicalDisclaimerRequired
          })
            .filter((note) => note.id !== "safety")
            .map((note) => (
            <Card key={note.id}>
              <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
                {note.title}
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{note.body}</Text>
            </Card>
          ))}

          {/* C2 → 라운드 43 리뷰 M-1: 고지는 **고지 대상이 있을 때** 구매 CTA 바로 위에 그린다
              (위 affiliateDisclosureText 주석의 DNC-010 근거 참고). 위치는 그대로: 고지와 구매
              CTA 사이에 아무것도 끼우지 않는다. */}
          {affiliateDisclosureText ? <AffiliateDisclosure text={affiliateDisclosureText} /> : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SecondaryButton
              disabled={!hasSession}
              label={isInterested ? "찜해제" : "찜하기"}
              // 라운드 24 L7: 확인 문구는 "interest" 고정이다. 확인이 뜨는 경우는 지금 상태가
              // gifted일 때뿐인데, status가 단일 컬럼이라 그때 isInterested는 항상 false다
              // (=버튼은 "찜하기", 실행은 interested로의 변경). gifted가 아니면 확인 없이 그대로
              // 실행되므로 kind는 쓰이지도 않는다.
              onPress={() =>
                confirmGiftedReset("interest", () =>
                  toggleInterested(isInterested ? "not_prepared" : "interested")
                )
              }
              style={{ flex: 1 }}
            />
            {/* C2: 열 링크가 없으면 렌더하지 않는다 — 예전에는 버튼이 그대로 있고 누르면
                아무 반응이 없었다(productLinks[0] 부재). 없는 기능을 있는 것처럼 보이지
                않게 하는 쪽이, 눌러 보고 나서야 아는 것보다 낫다.

                라운드 64 #1: 그 게이트가 이제 **강조를 받을 링크가 있는가**다(위
                primaryPurchaseLink 주석). 링크 0건도, 전부 스폰서인 경우도 같은 이유로 여기서
                버튼이 사라진다 — 화면에서 가장 큰 버튼이 광고를 열지 않는다(DNC-011). */}
            {primaryPurchaseLink ? (
              <PrimaryButton
                label="바로 구매하기"
                onPress={() => handleProductLinkPress(primaryPurchaseLink)}
                style={{ flex: 1 }}
              />
            ) : null}
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
              onPress={expenseGate.guard(() =>
                router.push({
                  pathname: "/expenses/new",
                  // 라운드 48 QA(P2-5): 출처를 함께 넘겨 저장 후 준비템 탭으로 돌아간다 --
                  // 이 기록은 서버가 이 준비템을 준비 완료로 올리므로(R19-B), 결과가 보이는
                  // 화면으로 되돌아가는 것이 맞다(src/expenses/post-save-destination.ts).
                  // 라운드 49 C-02: 준비템의 지출 분류까지 함께 넘긴다 — 서버 DTO에는 있었지만
                  // (item_templates.category_id) 프리필이 버려서 분류가 늘 기본 타일로 떨어졌다.
                  // 금액은 넘기지 않는다: priceBandText는 범위라 특정 값을 지어내는 셈이 된다.
                  params: expenseLinkParams(
                    { itemName: visibleDetail.name, itemTemplateId, categoryId: visibleDetail.categoryId },
                    "item-detail"
                  )
                })
              )}
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
                onPress={expenseGate.guard(() =>
                  router.push({
                    pathname: "/expenses/new",
                    // 라운드 48 QA(P2-5): 위 상시 진입점과 **같은 파라미터 조립기**를 탄다.
                    // 두 버튼이 같은 곳으로 가는 같은 행동인데(G-8) 한쪽만 출처를 붙이면
                    // 저장 후 목적지가 어느 버튼을 눌렀느냐로 갈린다.
                    // 라운드 49 C-02: 분류(categoryId)도 같은 조립기가 함께 싣는다.
                    params: expenseLinkParams(
                      { itemName: visibleDetail.name, itemTemplateId, categoryId: visibleDetail.categoryId },
                      "item-detail"
                    )
                  })
                )}
              />
              <SecondaryButton
                label="지출 없이 준비 완료로 표시"
                onPress={() => {
                  if (!authToken || !childId) return;
                  confirmGiftedReset("prepare", () => markPrepared());
                }}
              />
            </Card>
          ) : null}

          {linkOpenFallback ? (
            <Card style={{ backgroundColor: theme.colors.beige }}>
              <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>
                링크를 자동으로 열지 못했어요.
              </Text>
              {/* 라운드 68 C(#4): 내보낼 주소가 없으면(서버가 깨진 줄 아는 링크·코드 없는 옛
                  데이터·구버전 서버) 공유 버튼을 그리지 않고 그 사실을 한 줄로 말한다 —
                  버튼만 말없이 사라지면 사용자는 이유를 알 길이 없고, 원문 URL로 떨어지면
                  집계에도 회수에도 잡히지 않는 사본이 밖으로 나간다. */}
              {canSharePurchaseLink(linkOpenFallback.shareUrl) ? (
                <SecondaryButton label="링크 공유하기" onPress={shareFallbackLink} />
              ) : (
                <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                  {LINK_SHARE_UNAVAILABLE_NOTICE}
                </Text>
              )}
              <PrimaryButton label="다시 시도" onPress={() => void retryOpenFallbackLink()} />
            </Card>
          ) : null}

          {/* 기능 라운드 1 트랙 D — 품목 메모(기기 보관). FIX-C가 정리한 카드 구조(설명 카드
              둘·품목 아이콘)의 **아래**에 서는 별도 카드다. 제휴 고지-구매 CTA 인접(DNC-010)을
              건드리지 않도록 CTA·기존 카드들보다 뒤에 둔다.

              세션 게이트: 비세션 프리뷰(ITEM-002 픽셀락 캡처 — app/pixel-lock.tsx가 세션을
              지운다)에는 렌더되지 않는다. 기록할 기기 상태의 주인이 없기도 하다.

              정직성: 이 메모는 서버로 가지 않으므로 "이 기기에만 저장돼요" 고지가 필수다 —
              가족 공유로 오해할 수 있는 자리에서 저장 위치의 사실을 숨기지 않는다(문구는
              src/items/item-memo.ts 한 곳). 가격은 어디에도 표시하지 않는다(사용자 결정 대기
              잠금). 저장은 명시 버튼이고 실패는 위 statusErrorMessage 배너로 알린다. */}
          {hasSession ? (
            <Card>
              <Text accessibilityRole="header" style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
                {ITEM_MEMO_CARD_TITLE}
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                {ITEM_MEMO_DEVICE_ONLY_NOTICE}
              </Text>
              <TextInput
                accessibilityLabel={ITEM_MEMO_INPUT_LABEL}
                // 상한은 판정 모듈의 값 하나다(글자 수 계약 — src/items/item-memo.ts).
                maxLength={ITEM_MEMO_MAX_LENGTH}
                multiline
                onChangeText={setMemoDraft}
                placeholder={ITEM_MEMO_INPUT_PLACEHOLDER}
                // 지출 입력의 메모 칸과 같은 입력 칸 관례(app/expenses/new.tsx — 배경·테두리·
                // 색). multiline이라 세로 여백과 위 정렬만 더한다. 글꼴 배율은 막지 않는다
                // (allowFontScaling 기본값 유지 — 이 화면의 다른 글자들과 같은 규칙).
                style={{
                  backgroundColor: theme.colors.white,
                  borderColor: "rgba(74, 63, 53, 0.10)",
                  borderRadius: 14,
                  borderWidth: 1,
                  color: theme.colors.brown,
                  minHeight: 72,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  textAlignVertical: "top"
                }}
                value={memoText}
              />
              <SecondaryButton
                accessibilityLabel={itemMemoSaveAccessibilityLabel(visibleDetail.name)}
                label={ITEM_MEMO_SAVE_LABEL}
                onPress={handleMemoSave}
              />
              {memoNotice ? <Toast message={memoNotice.message} /> : null}
            </Card>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}
