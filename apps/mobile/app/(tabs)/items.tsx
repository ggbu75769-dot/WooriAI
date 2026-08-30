import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Image, Platform, Pressable, RefreshControl, Text, View, type ImageSourcePropType } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildItemStatusChangedPayload } from "../../src/analytics/events";
import {
  listCategories,
  listChildren,
  listItems,
  LOCAL_SESSION_TOKEN,
  type ItemStatus,
  type ItemSummary
} from "../../src/api/client";
import { buildCategoryNameLookup, buildTileCategoryResolver } from "../../src/categories";
import {
  childSwitchTriggerAccessibilityLabel,
  CHILD_SWITCH_TRIGGER_HINT,
  resolveChildScopeLabel,
  withChildScopeLabel,
  withSpokenChildScopeLabel
} from "../../src/children/child-switch";
import { ChildSwitchSheet, useChildSwitchSheet } from "../../src/children/ChildSwitchSheet";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { isChildrenSettled } from "../../src/family/household-scope";
import { useItemStatusGate } from "../../src/items/useItemStatusGate";
import {
  buildPendingItemStatusIndex,
  effectiveItemStatus,
  pendingItemStatusView
} from "../../src/items/pending-status";
import { refreshOfflineSyncSnapshot, updateItemStatusOffline, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import {
  PreparationListParity,
  type PreparationCategoryGroup,
  type PreparationParityItem
} from "../../src/preparation/PreparationListParity";
import { resolvePreparationTimelineBucket, toPreparationParityItem } from "../../src/preparation/catalog-contract";
import { expenseCategoryVisual } from "../../src/preparation/item-visuals";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AppScreen,
  CategoryChip,
  EmptyStateCard,
  ProductCard,
  SecondaryButton,
  StatusBadge,
  TextButton,
  Toast
} from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { resolveScreenPhase } from "../../src/screen-phase";
import { theme } from "../../src/theme";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";
import {
  bandDefinitions,
  resolveDefaultStageLabel,
  STAGE_BAND_UNRESOLVED_NOTICE,
  type StageBandLabel
} from "../../src/items/stage-bands";
import { computeEssentialPrepProgress } from "../../src/items/prep-progress";
import {
  buildPrepMilestoneView,
  nextPrepFocusHintText,
  nextPrepFocusIds,
  nextStageBandLabel,
  nextStageBandPreviewLabel,
  NEXT_PREP_FOCUS_BADGE_LABEL,
  PREP_CELEBRATION_BODY,
  PREP_CELEBRATION_DISMISS_LABEL,
  PREP_CELEBRATION_TITLE
} from "../../src/items/prep-milestones";
import {
  expenseLinkParams,
  expenseLinkPromptPlacement,
  isExpenseLinkPromptRow,
  isExpenseLinkPromptStale,
  itemListExpenseLinkAccessibilityLabel,
  itemListExpenseLinkLabel,
  nextExpenseLinkPrompt,
  type ExpenseLinkPrompt,
  type ExpenseLinkPromptScope
} from "../../src/items/expense-link-prompt";
import {
  filterInterestedItems,
  filterItems,
  hasActiveItemFilter,
  INTERESTED_FILTER_EMPTY_TEXT,
  INTERESTED_FILTER_LABEL,
  INTERESTED_FILTER_SCOPE_NOTE,
  NECESSITY_FILTER_OPTIONS,
  type NecessityFilter
} from "../../src/items/item-filters";
import { ITEM_PRICE_BAND_FALLBACK_TEXT } from "../../src/items/item-labels";
import {
  applyPreBirthFilter,
  isPreBirthFilterActive,
  PRE_BIRTH_FILTER_LABEL,
  shouldOfferPreBirthFilter
} from "../../src/items/pre-birth-filter";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE
} from "../../src/items/status-mutation-messages";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

const toddlerImage = require("../../assets/illustrations/toddler.png");
const recommendationBabyCarrierImage = require("../../assets/illustrations/recommendation_baby_carrier.png");
const recommendationDiaperImage = require("../../assets/illustrations/recommendation_diaper.png");
const recommendationBlocksImage = require("../../assets/illustrations/recommendation_blocks.png");
// ITEM-121: 시기 칩 라벨은 밴드 정의(src/items/stage-bands.ts)에서 그대로 가져온다 --
// 칩 라벨이 곧 서버로 보내는 `stageBand` 값이라, 목록을 손으로 복제하면 조용히 어긋난다.
//
// DSN-053 P2-B: 그 라벨은 이제 서버로 나가지 않고 **화면 안에서** 쓰인다(아래 목록 쿼리 주석).
// 여전히 밴드 정의가 단일 소스다 -- 시기 밴드가 늘거나 이름이 바뀌면 칩도 함께 따라간다.
const tabOptions = bandDefinitions.map((band) => band.label);
const recommendationScreenId = "pixel-screen-ITEM-001 ITEM-001";
const recommendationHorizontalOffset = 0;
const recommendationVerticalOffset = 0;
// PIX-133: 보정 스케일 변환은 ITEM-001 캡처 빌드 전용(항등 기본값이어도 튜닝 값 유출 차단).
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function recommendationPixelScaleFrameStyle() {
  if (!isPixelLockCalibration) return undefined;
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

/**
 * 라운드 48 T1(A3): 실서버 항목의 배지/사진을 **응답에 있는 사실**로만 만든다 -- 그리고
 * DSN-053 P2-B에서 세션 목록은 아예 배지/사진을 쓰지 않는 타일 그리드가 됐다.
 *
 * 전:
 *  - `index === 0`인 행에 "BEST" 배지. 서버는 그런 평가를 주지 않고, 정렬이 바뀌면
 *    "BEST"도 따라 움직였다 — 근거 없는 추천 표시였다(DNC-009/DNC-011 취지).
 *  - 미리보기용 일러스트 3장을 `index % 3`으로 돌려 붙였다. 62개 준비템 어느 것도 그
 *    사진과 관계가 없어서, 아기띠 그림이 붙은 "철분제" 같은 카드가 나왔다.
 *
 * 후: 세션 목록은 승인 디자인의 준비 타일(아이콘 + 이름 + 상태 pill)이라 붙일 배지도 사진도
 * 없다. 이 함수는 **비세션 미리보기 픽스처 전용**으로 남는다: ITEM-001은 픽셀 락 캡처라
 * 배지 문구·사진·캡션이 한 픽셀도 바뀌면 안 된다.
 */
function getRecommendationDisplay(item: RecommendationPreviewItem) {
  return { badge: item.badgeText, caption: item.caption, image: item.image };
}

/** 분류가 비어 있는 준비템을 담는 그룹 id. 서버 분류 id와 겹칠 수 없는 고정 문자열이다. */
const UNCATEGORIZED_GROUP_ID = "uncategorized";
/** 분류를 모를 때 쓰는 그룹 이름 -- 없는 분류를 지어내지 않는다. */
const UNCATEGORIZED_GROUP_NAME = "분류 없음";

export default function ItemsScreen() {
  const [stageLabel, setStageLabel] = useState<StageBandLabel>("12-24개월");
  const [hasManualStageSelection, setHasManualStageSelection] = useState(false);
  // 라운드 49 C-01: 찜(♡) 칩. 서버 tab 파라미터가 아니라 클라이언트 필터라, 이 칩을 눌러도
  // 목록 요청은 한 건도 나가지 않고(이미 받아 둔 tab="all" 스냅샷을 거른다) 끄면 종전 목록이
  // 그대로 돌아온다.
  const [showInterestedOnly, setShowInterestedOnly] = useState(false);
  // ITEM-121 (B2/B3): 목록을 더 좁히는 클라이언트 전용 조건. 시기/상태와 달리 이미 받은
  // 항목의 필드만 보므로 서버 왕복이 없다(src/items/item-filters.ts).
  const [necessityFilter, setNecessityFilter] = useState<NecessityFilter>("all");
  // 라운드 43 UX-V: "출산 전"만 보기. 시기 밴드 "0-6개월"이 임신 초기~생후 6개월을 한 칩에
  // 묶어서, 아직 아이가 태어나지 않은 사람에게 임신 준비물과 출생 직후 물건이 뒤섞여 나온다.
  // 밴드 계약(ITEM-001 칩)은 그대로 두고 화면에서 한 번 더 좁힌다
  // (src/items/pre-birth-filter.ts).
  const [preBirthOnly, setPreBirthOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  // ITEM-124 → 라운드 51 C-10: 이제 이 배너가 뜨는 경우는 **기기 저장 자체가 실패**했을 때뿐이다.
  // 서버 전송 실패는 더 이상 여기서 보이지 않는다 -- 큐에 남아 자동으로 재시도되고, 끝내 거절되면
  // 그 타일에 실패 배지가 붙는다(src/items/pending-status.ts).
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
  // 라운드 37 UX-I: 방금 "준비했어요"를 누른 항목. 그 타일 아래에서만 "지출도 기록할까요?" 한
  // 줄이 뜬다(카드/모달 없이 텍스트 링크 하나). 한 번에 하나만 기억하므로 다른 항목을 누르면
  // 이전 줄은 조용히 사라진다 -- 목록에 안내가 쌓이지 않게 하기 위해서다. 노출 판정과 문구는
  // 전부 순수 모듈(src/items/expense-link-prompt.ts)에 있다.
  //
  // 라운드 37 G-3: 이 줄은 **어느 목록을 보다가 남긴 것인지**(아이·시기 밴드·필수도·검색어)를
  // 함께 들고 있다. 특히 아이를 바꾸고 돌아왔을 때 남아 있던 줄을 누르면 다른 아이의 지출로
  // 기록되고 서버가 그 아이의 준비템까지 준비 완료로 바꿔 버렸다(R19-B) -- 사용자가 시킨 적
  // 없는 데이터 변경이다.
  const [expenseLinkPrompt, setExpenseLinkPrompt] = useState<ExpenseLinkPrompt | null>(null);
  // UX-E: 100% 축하 배너를 닫은 시기 밴드들. 축하는 "도달했다"는 사실을 한 번 알리는 것이지
  // 계속 붙어 있는 라벨이 아니다 -- 닫으면 이 화면이 살아 있는 동안 같은 밴드에서는 다시
  // 뜨지 않는다(밴드별로 기억하므로 다른 시기를 100% 채우면 그때는 다시 축하한다).
  const [dismissedCelebrationBands, setDismissedCelebrationBands] = useState<ReadonlySet<StageBandLabel>>(
    () => new Set<StageBandLabel>()
  );
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  // UX-R(M): "지출도 기록할까요?"는 지출 생성 화면으로 가는 입구다. 보기 전용 참여자에게는
  // 서버가 그 저장을 403으로 막으므로, 여기서 같은 판정으로 안내한다.
  const expenseGate = useExpenseEntryGate();
  // 라운드 51 #8: 준비 상태 변경 전용 게이트. 판정은 위 지출 게이트와 **같은 한 곳**을 읽고
  // (서버가 두 동작에 같은 편집 권한을 요구한다) 문구만 준비템의 말로 바꾼다.
  const itemStatusGate = useItemStatusGate();
  const queryClient = useQueryClient();
  // 라운드 51 C-10: 아직 서버에 닿지 않은 준비 상태 변경. 낙관 반영은 캐시 패치가 이미 해 두지만,
  // 그 사이 목록이 다시 조회돼 서버 값으로 덮이더라도 이 색인이 사용자가 마지막으로 누른 값을
  // 그대로 지킨다. 대기/실패 배지의 근거이기도 하다(src/items/pending-status.ts).
  const syncSnapshot = useOfflineSyncSnapshot();
  const pendingStatusIndex = buildPendingItemStatusIndex(syncSnapshot.itemStatusRows, childId);
  useEffect(() => {
    // 스냅샷은 앱 루트(useOfflineSyncLifecycle)와 저장 경로가 갱신하지만, 이 탭으로 곧장 들어온
    // 첫 렌더에서도 큐를 읽어 두어야 대기 배지가 한 박자 늦게 나타나지 않는다.
    void refreshOfflineSyncSnapshot();
  }, []);
  /**
   * 라운드 51 #10 → 라운드 69 트랙 C — `["children"]` 캐시는 이제 이 화면의 **두 가지**를 짊어진다:
   * 아이 전환 시트/다자녀 라벨(아래 `childScopeLabel`·`childSwitch`)과 **시기 밴드의 원천**.
   *
   * 다자녀 가구에서 둘째의 준비템을 보려면 홈으로 나갔다 돌아와야 했는데, 준비템은 아이마다
   * 목록도 준비율도 통째로 다른 화면이라 그 왕복이 특히 잦았다. 상태·부수효과·시트는 홈/기록/
   * 리포트와 **같은 한 벌**을 쓴다(src/children/ChildSwitchSheet.tsx). 전환은 ["items"]·
   * ["item-detail"]·["home"]을 통째로 무효화하므로 이 탭의 목록·준비율도 함께 갈린다.
   *
   * DSN-053 P2-B: 입구가 헤더의 제목에서 **TopAppBar 우측 슬롯**으로 옮겼다(스펙 §통합 지점의
   * "아이 전환=헤더 onPress"). 이중 게이트는 그대로다 -- hasSession(비세션 캡처에서 false)
   * **그리고** 아이 2명 이상. 둘 중 하나라도 아니면 슬롯이 비어 헤더는 제목만 남는다.
   *
   * 쿼리 자체(키·enabled·queryFn)는 라운드 51 #10이 세운 그대로다 — 이번 라운드가 하는 일은
   * **이미 구독 중인 이 응답을 한 번 더 읽는 것**뿐이라 새 요청이 0건이다.
   */
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  /**
   * 라운드 69 트랙 C — **시기 밴드의 원천을 `/home`에서 `["children"]`으로 옮긴다.**
   *
   * 고치는 문제: 이 화면은 아이의 현재 단계를 `/home`에서만 읽었고, 그 응답에서 쓰는 것은
   * `child.currentStage` **한 필드**가 전부였다. `/home`이 실패하면(지하철·엘리베이터·와이파이
   * 전환) `currentStage`가 undefined가 되고, 기본 칩은 아무 말 없이 `"12-24개월"`로,
   * "출산 전" 칩은 아예 사라진다 — 그런데 목록(`tab="all"`)은 성공하므로 **화면은 완전히
   * 건강해 보인다.** 임신 28주 사용자가 보행기와 이유식 그릇을 권받는 화면이고, 탭의 이름이
   * 곧 약속인 자리에서(시기별 준비물 — DNC-001) 그 약속이 침묵으로 깨진다.
   *
   * 두 원천은 **정의상 같은 값**이다: 서버가 `Child` DTO를 만드는 함수가 한 벌뿐이고
   * (apps/api/src/onboarding/store-shared.ts의 `toChildDto`), `/home`은
   * reporting-store.service.ts의 `child: toChildDto(child)`가, `/children`은
   * onboarding-core.service.ts가 그 같은 함수를 부른다. 즉 출처만 바뀌고 값은 그대로다.
   *
   * 그래서 `/home` 쿼리는 이 화면에서 **사라졌다** — 소비처가 그 한 필드뿐이었다.
   * (요청 수 감소는 곁가지이지 목적이 아니다: `["home", childId]`는 홈 탭과 공유하는 키라
   * 실제 절감은 "홈을 아직 안 본 상태에서 준비템 탭으로 직행"에서만 생긴다. 이 변경의 본체는
   * 정직성이다.)
   */
  const stageSourceChild = childrenQuery.data?.children.find((child) => child.id === childId);
  /**
   * 기본으로 선택되는 칩(= 아이 현재 단계가 속한 밴드). 사용자의 수동 선택과 무관하게 계산해,
   * "지금 보고 있는 칩이 기본 칩인가"를 판별하는 기준으로 쓴다.
   *
   * 라운드 51 #3: 데모의 기본 칩도 **실제 아이 시기**를 따른다 — `ensureSeeded`가 사용자
   * 데이터를 하나도 만들지 않게 되면서(local-backend.ts) 데모 아이도 온보딩에서 직접 입력하는
   * 값이다. 픽셀 락 캡처의 결정성은 `isPixelLockMode`가 그대로 지킨다.
   *
   * ⚠️ ITEM-001 캡처의 **이중 게이트**(값으로 증명 — src/items/stage-bands.test.ts):
   *  1. `resolveDefaultStageLabel`이 `isPixelLockMode`를 **최우선**으로 보고 폴백을 돌려준다;
   *  2. 캡처는 비세션 렌더라(app/pixel-lock.tsx가 세션을 지우고 찍는다) 위 `["children"]`
   *     쿼리 자체가 `enabled: Boolean(authToken)`으로 꺼져 있어 `stageSourceChild`가 undefined다.
   * 원천이 바뀌어도 캡처는 어느 쪽으로도 흔들리지 않는다.
   *
   * 라운드 69 트랙 C: 반환값이 `{ label, resolved }`다 — `resolved === false`는 "이 칩은
   * 아이의 시기가 아니라 폴백"이라는 뜻이고, 아래 안내 한 줄이 그 사실을 화면에 세운다.
   */
  const defaultStageBand = resolveDefaultStageLabel({
    currentStage: stageSourceChild?.currentStage,
    birthDate: stageSourceChild?.birthDate,
    // 라운드 74 리뷰 B-1: 수동 입력 아이에게는 설계상 birthDate가 없다 — 나이를 모르는 것이
    // 그 갈래의 정상이라, "시기를 확인하지 못했어요" 안내가 그 자리에 서면 안 된다.
    // 같은 `["children"]` 응답에 이미 실려 오는 필드라 새 요청은 여전히 0건이다.
    stageMode: stageSourceChild?.stageMode,
    isPixelLockMode,
    hasManualSelection: false,
    fallback: "12-24개월"
  });
  const defaultStageLabel = defaultStageBand.label;
  /**
   * DSN-053 P2-B — 준비템 목록은 **전 상태 스냅샷 한 건**이다.
   *
   * 예전에는 상태 탭(now/soon/prepared/not_needed)마다 서버에 따로 물었다. 승인 디자인의
   * "내 준비 목록"은 그 구조와 맞지 않는다: 분류 섹션이 "2/6 보유"를 말하려면 **보유한 것과
   * 아직 아닌 것이 한 목록에** 있어야 하고, 시기별 밴드 4종(지금/곧/여유/정리됨)도 한 화면에
   * 함께 서야 한다. 상태로 거른 목록으로는 둘 다 구조적으로 불가능하다.
   *
   * `tab="all"`은 상태로도 시기로도 거르지 않는 그 스냅샷이고(apps/api item-ranking.ts의
   * FIX/F4), 이미 준비율(ITEM-114)과 찜 필터(C-01)가 쓰던 바로 그 요청이다 — 화면이 쓰는
   * 목록 요청은 둘에서 하나로 줄었다. 시기 밴드는 이제 서버 파라미터가 아니라 화면 안에서
   * 각 품목의 `stageCodes`로 판정한다(src/preparation/catalog-contract.ts의
   * `resolvePreparationTimelineBucket` — 서버 now/soon 술어와 같은 규칙).
   */
  const items = useQuery({
    queryKey: ["items", childId, "catalog"],
    enabled: Boolean(authToken && childId),
    queryFn: () => listItems(authToken!, childId!, "all")
  });
  /**
   * 분류 섹션의 이름·아이콘을 정하기 위한 공유 `["categories"]` 캐시.
   *
   * 새 화면 데이터가 아니다: 지출 수정·리포트·CSV 내보내기가 이미 채워 두는 그 캐시이고
   * (CAT-124 전량 규약대로 `includeAll: true`), 준비템의 `categoryId`는 서버 시드 분류의
   * UUID라 이 목록 없이는 이름을 알 수 없다(src/categories.ts buildCategoryNameLookup 주석).
   * 캐시가 비어 있으면 정적 매핑으로 떨어지고, 그래도 모르는 분류는 "기타"로만 말한다.
   */
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken && childId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });
  useEffect(() => {
    if (hasManualStageSelection) return;
    setStageLabel(defaultStageLabel);
  }, [defaultStageLabel, hasManualStageSelection]);
  // 라운드 37 G-3: "지출도 기록할까요?" 줄이 살아 있어도 되는 화면 좌표. 목록을 갈아 끼우는
  // 입력(아이·시기 밴드·필수도 칩·검색어)만 담는다.
  const expenseLinkPromptScope: ExpenseLinkPromptScope = {
    childId,
    stageLabel,
    necessityFilter,
    searchText
  };
  // 좌표가 바뀌면 상태에서도 걷는다. 렌더 쪽(expenseLinkPromptPlacement)이 같은 판정으로 이미
  // 그리지 않으므로 이 정리는 "화면에 없는 줄이 상태에만 남는" 상황을 없애는 뒷정리다.
  useEffect(() => {
    setExpenseLinkPrompt((prompt) =>
      isExpenseLinkPromptStale({ prompt, scope: { childId, stageLabel, necessityFilter, searchText } })
        ? null
        : prompt
    );
  }, [childId, stageLabel, necessityFilter, searchText]);
  /**
   * 라운드 51 C-10 — 상태 변경이 **오프라인 아웃박스**를 탄다.
   *
   * 로컬 큐에 남기고(updateItemStatusOffline) 낙관 반영을 캐시에 적은 뒤 곧바로 돌아온다.
   * 서버 전송은 sync-engine이 연결이 돌아오는 대로 알아서 한다. 그래서 여기에는 성공/실패
   * 콜백이 없다 -- 실패는 나중에, 그 타일의 배지와 동기화 상태 화면이 말한다. 남은 유일한
   * 오류 경로는 **기기 저장 실패**다.
   *
   * 무효화를 여기서 하지 않는 것도 의도다(sync-controller의 updateItemStatusOffline 주석):
   * 서버는 아직 옛 값을 들고 있어 지금 다시 물으면 방금 누른 값이 되돌아온다.
   */
  const applyStatusChange = (variables: {
    itemTemplateId: string;
    itemName: string;
    // 라운드 49 C-02: `categoryId`는 서버로 보내지 않는다 -- 아래 "지출도 기록할까요?" 줄이
    // 분류까지 프리필하려면 그 항목의 분류를 알아야 하는데, 그때는 항목이 목록에서 사라져 있을
    // 수 있어서 여기서 함께 들고 간다.
    categoryId?: string;
    status: ItemStatus;
  }) => {
    if (!authToken || !childId) return;
    setStatusErrorMessage(null);
    // 새 조작이 시작되면 앞선 항목의 "지출도 기록할까요?" 줄은 걷는다(한 항목에서만 보인다).
    setExpenseLinkPrompt(null);
    void updateItemStatusOffline(authToken, queryClient, {
      childId,
      itemTemplateId: variables.itemTemplateId,
      itemName: variables.itemName,
      status: variables.status
    })
      .then(() => {
        // 라운드 37 UX-I: "괜찮아요"(not_needed)에는 남기지 않는다 -- 사지 않기로 한 판단에
        // 지출 기록을 권하면 판단을 되묻는 잔소리가 된다(DNC-018). 판정은 순수 모듈이 한다.
        //
        // C-10: 기준이 "서버 확인"에서 "기기 저장"으로 바뀌었다. 서버 확인을 기다리면 오프라인
        // 에서는 이 줄이 영영 뜨지 않는데, 마트에서 사 온 물건을 기록하려는 사람이 바로 그
        // 상황에 있다 -- 지출 기록도 어차피 오프라인 우선이라 이 줄을 눌러도 저장은 된다.
        setExpenseLinkPrompt(
          nextExpenseLinkPrompt({
            itemTemplateId: variables.itemTemplateId,
            itemName: variables.itemName,
            categoryId: variables.categoryId,
            status: variables.status,
            // G-3: 지금 보고 있는 목록의 좌표를 함께 박아 둔다.
            scope: { childId, stageLabel, necessityFilter, searchText }
          })
        );
        // ANA-103: 사용자가 상태를 바꾼 사실을 보고한다. 이벤트가 재는 것은 서버 왕복이 아니라
        // **사용자 행동**이라 기기 저장 시점에 쏜다. 페이로드는 거친 분류 enum과 상태뿐이다
        // (품목명은 기기를 떠나지 않는다 -- src/analytics/events.ts).
        trackAndFlushAnalyticsEvent(authToken, {
          eventName: "item_status_changed",
          payload: buildItemStatusChangedPayload({ itemName: variables.itemName, status: variables.status }),
          platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
        });
      })
      .catch(() => {
        setStatusErrorMessage(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE);
      });
  };
  const hasSession = Boolean(authToken && childId);
  const childScopeLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);
  /**
   * 라운드 69 트랙 C — **모르면 모른다고 말하는 자리.**
   *
   * 조건 넷이 모두 참일 때만 칩 줄 위에 한 줄이 선다:
   *  1. 세션 렌더일 것 — 비세션(ITEM-001 캡처)에는 이 아래 코드가 아예 도달하지 않지만,
   *     판정 자체도 `hasSession`을 지나게 해 캡처 불변을 값으로 남긴다;
   *  2. 픽셀 락이 아닐 것 — `resolveDefaultStageLabel`이 캡처에서 늘 폴백을 돌려주므로, 이
   *     게이트가 없으면 캡처 빌드의 세션 렌더에 없던 문장이 선다;
   *  3. `["children"]` 조회가 **정착했을 것**(성공·실패 모두 — 규칙은 기존 술어 한 벌만 쓴다:
   *     src/family/household-scope.ts의 `isChildrenSettled`). **로딩 중에는 아무 말도 하지
   *     않는다** — 첫 페인트마다 경고가 번쩍이면 그것이 새 소음이다;
   *  4. 그러고도 시기를 모를 것(`!resolved`). 조회가 실패한 경우와 성공했는데 그 아이를 찾지
   *     못한 경우(다른 가구·방금 지워진 아이)가 여기로 함께 떨어진다 — 사용자가 겪는 사실이
   *     둘 다 "지금 시기를 모른다"로 같기 때문이다.
   *
   * 사용자가 칩을 직접 고른 뒤에는 말하지 않는다: 그때 화면에 선 밴드는 **사용자의 선택**이지
   * 우리가 지어낸 값이 아니라서, 고쳐야 할 거짓이 남아 있지 않다(안내가 권한 일이 바로 그것이다).
   */
  const showStageBandUnresolvedNotice =
    hasSession &&
    !isPixelLockMode &&
    !hasManualStageSelection &&
    !defaultStageBand.resolved &&
    isChildrenSettled({ authToken, isSuccess: childrenQuery.isSuccess, isError: childrenQuery.isError });
  const childSwitch = useChildSwitchSheet({
    hasSession,
    childId,
    children: childrenQuery.data?.children
  });

  /**
   * 리뷰 F2: gifted/prepared/not_needed는 서로 배타적인 단일 status 컬럼이라, 정리된 품목에서
   * "선물 받음" 배지를 단 항목의 준비했어요/괜찮아요를 누르면 선물 받았다는 기록이 아무 말 없이
   * 사라진다. 지금 상태가 gifted인 항목에서만 확인을 한 번 거치고(문구는 상세 화면과 같은
   * 단일 소스), 그 밖에는 예전처럼 바로 실행한다.
   *
   * 라운드 51 #8: 그 앞에 보기 전용 역할 게이트가 선다. 서버가 준비 상태 쓰기를 편집 역할에만
   * 허용하므로, 잠긴 세션에서는 큐에 넣어 봐야 403으로 실패 행이 될 뿐이다 -- 버튼을 지우지
   * 않고 눌렀을 때 사실을 말한다(src/items/status-permission.ts).
   */
  const requestStatusChange = (
    item: { id: string; name: string; categoryId?: string; status: ItemStatus },
    status: "prepared" | "not_needed"
  ) => {
    if (itemStatusGate.locked) {
      itemStatusGate.explain();
      return;
    }
    const kind = status === "prepared" ? "prepare" : "skip";
    const run = () =>
      applyStatusChange({ itemTemplateId: item.id, itemName: item.name, categoryId: item.categoryId, status });
    if (item.status !== "gifted") {
      run();
      return;
    }
    Alert.alert(GIFTED_RESET_CONFIRM_TITLE, giftedResetConfirmMessage(kind), [
      { text: GIFTED_RESET_CONFIRM_CANCEL_LABEL, style: "cancel" },
      { text: GIFTED_RESET_CONFIRM_ACTION_LABEL, onPress: run }
    ]);
  };

  // MOB-117 당겨서 새로고침: ["items"] 접두어 invalidate로 목록 = 준비율 스냅샷을 갱신한다.
  //
  // 라운드 69 트랙 C — 이 화면이 읽는 캐시가 바뀌었으므로 당김의 대상도 함께 판단했다.
  //  · `["children"]`을 **더한다**: 시기 밴드의 원천이 그 캐시로 옮겨 왔다. 실패로 정착해
  //    모름 고지(STAGE_BAND_UNRESOLVED_NOTICE)가 서 있을 때, 사용자가 그 안내에서 벗어나는
  //    길이 화면에 있어야 한다 — 당겨서 새로고침이 바로 그 길이고, 홈·기록 탭이 이미 "화면이
  //    읽는 캐시를 갱신한다"는 같은 규율을 따른다(GAP-060 #10).
  //  · `["home"]`을 **남긴다**: 이 화면은 더 이상 그 응답을 읽지 않지만, 여기서 누른 준비 상태는
  //    홈 탭의 추천 카드가 그리는 값이라(app/(tabs)/index.tsx의 recommendedItems) 그 캐시를
  //    낡은 것으로 표시해 두는 편이 맞다. 라운드 69 리뷰 S-5 — 정확히 말하면 이 줄은 홈을 지금
  //    **다시 불러오지 않는다**: 이 화면이 `["home"]`을 구독하지 않으므로 그 쿼리는 비활성이고,
  //    invalidate는 stale 표시까지다. 실제 재요청은 사용자가 홈 탭에 들어가 그 쿼리가 다시
  //    활성이 되는 순간 일어난다(그래서 이 줄의 값은 "당김 즉시 갱신"이 아니라 "홈에 갔을 때
  //    낡은 값을 보지 않는다"이다). 이 트랙은 홈 화면 무접촉이고, 빼는 쪽이 오히려 홈의 동작을 바꾼다.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["children"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] })
    ])
  );

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const itemsPhase = resolveScreenPhase({ isPending: items.isPending, isError: items.isError, hasData: Boolean(items.data) });
  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 — 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(items.isError);

  /**
   * 라운드 49 C-07: 로그인은 돼 있는데 **선택된 아이가 없을 때**.
   *
   * 예전에는 이 경우도 `hasSession`이 false라 아래에서 비세션 미리보기 픽스처
   * (previewItems -- "베이비 아기띠 힙시트 ₩89,000 · ★ 4.7 (1,245)")가 그대로 그려졌다.
   * 로그인한 사용자에게 서버에 존재하지도 않는 상품과 있지도 않은 별점을 **자기 데이터인 양**
   * 보여준 셈이라, 허위 표시 금지 원칙에 정면으로 어긋난다(그 픽스처는 픽셀 락 캡처 전용이다).
   *
   * ⚠️ 비세션(`authToken === null`) 분기는 이 게이트에 걸리지 않는다 -- ITEM-001 픽셀 락
   * 캡처(app/pixel-lock.tsx가 세션을 지우고 찍는다)의 렌더는 한 픽셀도 바뀌지 않는다.
   */
  if (authToken && !childId) {
    return (
      <AppScreen>
        <EmptyStateCard
          title="아이를 먼저 선택해 주세요."
          actionLabel="아이 관리로 가기"
          onPress={() => router.push("/settings/children")}
        />
      </AppScreen>
    );
  }

  if (hasSession && itemsPhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title={loadErrorCopy.title}
          actionLabel={loadErrorCopy.actionLabel}
          onPress={() => items.refetch()}
        />
      </AppScreen>
    );
  }

  if (hasSession && itemsPhase === "loading") {
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

  const visibleItems = hasSession ? items.data!.items : previewItems;
  // 라운드 49 C-01: 찜 칩이 켜져 있으면 목록의 모집단이 **찜한 항목**으로 바뀐다. 서버 왕복은
  // 없다(같은 스냅샷) -- 판정은 순수 모듈이 한다(src/items/item-filters.ts). 스냅샷은 시기
  // 밴드를 무시하므로 찜 목록은 시기 칩을 따르지 않고, 그 사실은 목록 위 한 줄로 밝힌다
  // (INTERESTED_FILTER_SCOPE_NOTE).
  const sourceItems: Array<ItemSummary | RecommendationPreviewItem> =
    hasSession && showInterestedOnly ? filterInterestedItems(visibleItems) : visibleItems;
  /**
   * 분류 섹션의 축. 원본(c20deeb)은 카탈로그 도메인 코드로 10그룹을 나눴지만 현재 준비템
   * 계약에는 그 코드가 없다 -- 있는 분류는 **지출 분류**(`categoryId`) 하나뿐이고, 그것이
   * 마침 이 앱이 지출을 세는 축이자 "지출도 기록할까요?"가 프리필하는 축이다. 없는 분류를
   * 지어내는 대신 그 축을 그대로 쓴다. 순서는 서버가 준 목록 순서 그대로다(재정렬 없음).
   *
   * 라운드 81 D: 선언이 목록 조립(listedItems)보다 **위**로 올라왔다. 검색이 분류 이름을
   * 보려면 그 이름이 필터보다 먼저 있어야 하기 때문이고, 두 선언 다 순수 호출이라 값도
   * 렌더도 바뀌지 않는다(아래 세션 렌더는 이 값을 그대로 이어 쓴다).
   */
  const categoryNameOf = buildCategoryNameLookup(categories.data?.categories);
  /**
   * 그룹 키는 **분류 id가 아니라 그 분류의 이름**이다.
   *
   * 공유 캐시가 아직 비어 있으면(콜드 스타트·오프라인 첫 실행) 서버 분류 UUID는 이름을 알 수
   * 없어 전부 "기타"로 떨어진다. 그때 id로 묶으면 "기타"라는 이름의 섹션이 여러 개 나란히
   * 서서 서로 구별되지 않는다 -- 이름으로 묶으면 그 경우 하나로 합쳐지고, 캐시가 채워지면
   * 자연히 갈라진다.
   *
   * 라운드 81 D: 이 함수가 **분류 이름의 단일 소스**다 -- 그룹 헤더의 제목도, 아래 검색의
   * 분류 갈래도 여기서만 나온다. 두 번째 조립기를 두면 사용자가 화면에서 읽은 글자와
   * 검색이 찾는 글자가 갈라진다.
   */
  const groupKeyOf = (item: ItemSummary) =>
    item.categoryId ? categoryNameOf(item.categoryId) : UNCATEGORIZED_GROUP_NAME;
  // 필수도 칩과 검색만 적용한다 -- 비세션 미리보기에는 두 컨트롤을 노출하지 않으므로
  // 목록도 손대지 않는다.
  //
  // 라운드 81 D: 검색은 품목명에 더해 **그룹 헤더가 그 항목 위에 그리는 분류 이름**도 본다.
  // 새 요청도 새 스키마도 없다 -- 화면이 이미 만들어 그리고 있는 값 하나(groupKeyOf)를
  // 술어에 그대로 넘길 뿐이고, 분류 캐시가 비어 있으면 헤더와 검색이 똑같이 "기타"를 쓴다.
  const itemFilterInput = { necessity: necessityFilter, searchText, categoryNameOf: groupKeyOf };
  // 라운드 43 UX-V: 칩은 아이가 아직 태어나기 전일 때만 나온다. 출생 뒤에는 좁혀 봐야 지나간
  // 준비물만 남기 때문이다. 켜 둔 채로 아이가 출생 전환을 하면 칩이 사라지는데, 그때 필터만
  // 살아 남아 목록이 이유 없이 비지 않도록 **노출 판정과 적용 판정을 같은 값으로 묶는다**.
  //
  // 라운드 69 트랙 C: 판정(src/items/pre-birth-filter.ts)은 한 글자도 바뀌지 않는다 — 바뀐 것은
  // `currentStage`의 **출처**뿐이고, 기본 칩과 이 칩이 이제 같은 한 값을 읽는다. 종전에는 둘 다
  // `/home`을 읽었으므로 그 응답이 실패하면 기본 칩은 폴백으로, 이 칩은 통째로 사라졌다.
  const offersPreBirthFilter = shouldOfferPreBirthFilter({
    hasSession,
    currentStage: stageSourceChild?.currentStage,
    selectedBand: stageLabel
  });
  // 라운드 49 QA(P3-3): 찜 칩이 켜져 있으면 시기 좁히기는 쉰다 -- 바로 위 안내가 "시기와
  // 상관없이 모두 보여요"라고 말하는 동안 시기 필터가 함께 걸리면 그 안내가 거짓이 된다.
  const preBirthFilterActive = isPreBirthFilterActive({
    offered: offersPreBirthFilter,
    preBirthOnly,
    interestedOnly: showInterestedOnly
  });
  const listedItems: Array<ItemSummary | RecommendationPreviewItem> = hasSession
    ? applyPreBirthFilter(
        filterItems<ItemSummary | RecommendationPreviewItem>(sourceItems, itemFilterInput),
        preBirthFilterActive
      )
    : visibleItems;
  const isNarrowedByFilter = hasSession && (hasActiveItemFilter(itemFilterInput) || preBirthFilterActive);
  // C-01: 찜 목록이 비었는데 다른 좁히기 조건은 하나도 안 걸려 있다면, 그건 "필터에 안 맞는다"가
  // 아니라 **아직 찜한 것이 없다**는 뜻이다. 그때만 전용 문구를 쓴다(필터 초기화 카드는 눌러도
  // 바뀌는 게 없어 막다른 길이 된다).
  const showInterestedEmptyState = showInterestedOnly && !isNarrowedByFilter;
  const canUpdateStatus = hasSession;
  // ITEM-114: 선택된 시기 밴드(기본 칩은 아이의 현재 시기) 기준 필수템 준비율. 필수템이
  // 0개인 밴드나 스냅샷 로딩 전에는 null이라 히어로 수치가 통째로 숨는다.
  const prepProgress =
    hasSession && !isPixelLockMode && items.data
      ? computeEssentialPrepProgress(items.data.items, stageLabel)
      : null;
  // UX-E: 준비율을 "여정"으로 읽히게 하는 파생값들. 전부 순수 모듈(src/items/prep-milestones.ts)이
  // 계산하고, 화면은 그리기만 한다. prepProgress 자체가 hasSession + !isPixelLockMode 게이트를
  // 이미 통과한 값이라 ITEM-001 픽셀 락 캡처(비세션 미리보기)에는 어느 것도 나오지 않는다.
  const prepMilestone = buildPrepMilestoneView(prepProgress);
  /**
   * DSN-053 P2-B — 승인 디자인의 진행률 히어로가 그릴 값.
   *
   * **프레임만 c20deeb이고 수치는 지금 화면의 정직한 계산 그대로다.** 퍼센트는 개수 판정에
   * 맞춰 캡을 거친 `displayPercent` 하나뿐이고(라운드 36 F8), 접근성 문장도 모듈이 만든
   * 그 값을 그대로 넘긴다 -- 화면이 문장을 다시 조립하지 않는다.
   */
  const parityProgress = prepMilestone
    ? {
        totalCount: prepMilestone.totalCount,
        completedCount: prepMilestone.resolvedCount,
        displayPercent: prepMilestone.displayPercent,
        summaryText: prepMilestone.headline,
        accessibilityLabel: prepMilestone.accessibilityLabel,
        detailText: prepMilestone.tierText
      }
    : null;
  // 축하 배너는 "지금 보고 있는 시기"가 100%일 때만, 그리고 닫기 전까지만.
  const showPrepCelebration = Boolean(prepMilestone?.isComplete) && !dismissedCelebrationBands.has(stageLabel);
  // 100%에서 자연스럽게 이어 줄 다음 시기 칩(마지막 밴드에서는 null -- 그때는 축하만 한다).
  const nextStageBand = nextStageBandLabel(stageLabel);
  const dismissPrepCelebration = () =>
    setDismissedCelebrationBands((bands) => {
      if (bands.has(stageLabel)) return bands;
      const next = new Set(bands);
      next.add(stageLabel);
      return next;
    });
  // "먼저 챙기면 좋아요" 대상: 서버가 준 순서 그대로에서 앞선 미준비 필수템 1~2개를 **고르기만**
  // 한다(클라이언트 재정렬 없음). 같은 항목을 타일로 다시 그리지 않고, 목록 위 한 줄 안내 +
  // 제자리 배지로만 구분한다.
  const prepFocusIds = hasSession && !isPixelLockMode ? nextPrepFocusIds(listedItems) : null;
  const prepFocusHint = hasSession && !isPixelLockMode ? nextPrepFocusHintText(listedItems) : null;
  // 라운드 37 UX-I: "지출도 기록할까요?" 한 줄을 어디에 그릴지. 준비했어요를 누른 항목이 목록에
  // 남아 있으면 그 타일 아래(inline), 필터 때문에 사라졌으면 목록 위 한 줄(detached)로 자리만
  // 옮긴다. 판정은 순수 모듈이 한다. G-3: 좌표가 어긋난 프롬프트(다른 아이·다른 밴드·다른
  // 필터에서 남은 줄)는 "none"으로 떨어져 한 프레임도 그려지지 않는다.
  const expenseLinkPlacement = expenseLinkPromptPlacement({
    hasSession,
    prompt: expenseLinkPrompt,
    scope: expenseLinkPromptScope,
    visibleItemIds: listedItems.map((item) => item.id)
  });
  // 라운드 48 QA(P2-5): 출처를 함께 넘겨 저장 후 **이 탭으로 돌아오게** 한다. 여기서 남긴
  // 지출은 서버가 그 준비템을 준비 완료로 올리므로(store-shared.ts markLinkedItemPrepared),
  // 방금 오른 준비율과 100% 축하 배너가 있는 화면이 바로 이 화면이다.
  const openExpenseLinkPrompt = expenseGate.guard(
    (prompt: { itemTemplateId: string; itemName: string; categoryId?: string }) => {
      setExpenseLinkPrompt(null);
      router.push({
        pathname: "/expenses/new",
        // 라운드 49 C-02: 품목명·준비템 id에 더해 **분류**까지 넘긴다. 인라인(타일이 아직 보임)과
        // 떨어져 나온 줄(항목이 목록에서 빠짐) 둘 다 같은 조립기를 타므로, 어느 자리에서 눌러도
        // 같은 프리필이 간다. 분류가 없는 준비템이면 파라미터 키 자체가 생기지 않는다.
        params: expenseLinkParams(
          { itemName: prompt.itemName, itemTemplateId: prompt.itemTemplateId, categoryId: prompt.categoryId },
          "items"
        )
      });
    }
  );

  /**
   * ITEM-001 비세션 미리보기 = 픽셀 락 캡처 경로. 승인 캡처와 한 픽셀도 달라지면 안 되므로
   * 종전 렌더(추천 헤더 · 시기 칩 · 맞춤 추천 히어로 · ProductCard 목록)를 그대로 둔다.
   */
  if (!hasSession) {
    return (
      <AppScreen>
        <View style={recommendationPixelScaleFrameStyle()}>
          <View testID={recommendationScreenId} style={recommendationPixelFrameStyle}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.brown, fontSize: 22, fontWeight: "800" }}>
                {withChildScopeLabel("추천", childScopeLabel)}
              </Text>
              <Ionicons accessible={false} name="heart-outline" size={18} color={theme.colors.brown} />
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

            <View style={{ gap: 10 }}>
              {previewItems.map((item) => {
                const display = getRecommendationDisplay(item);
                return (
                  <ProductCard
                    key={item.id}
                    title={item.name}
                    price={item.priceBandText ?? ITEM_PRICE_BAND_FALLBACK_TEXT}
                    badge={display.badge}
                    caption={display.caption}
                    image={display.image}
                    onPress={() => router.push(`/items/${item.id}`)}
                  />
                );
              })}
            </View>

            <SecondaryButton label="‹ 더 많은 추천 보기" onPress={() => router.push("/(tabs)/items")} />
          </View>
        </View>
      </AppScreen>
    );
  }

  /**
   * DSN-053 P2-B — 세션 렌더는 승인 디자인의 "내 준비 목록"이다.
   *
   * 목록의 뼈대(TopAppBar → 진행률 히어로 → 세그먼트 → 검색 → 분류 섹션/시기별 밴드)는
   * 이식한 `PreparationListParity`가 그대로 그리고, 이 화면은 **무엇을 담을지**만 정한다.
   */
  const sessionRows = (listedItems as ItemSummary[]).map((item) => {
    // 라운드 51 C-10: 아직 전송되지 않은 변경이 있으면 그 값이 서버 응답을 이긴다 --
    // 사용자가 방금 누른 값이 이 기기의 진실이다(판정은 src/items/pending-status.ts).
    const pendingStatusRow = pendingStatusIndex.get(item.id);
    return {
      item,
      rowItem: pendingStatusRow
        ? { ...item, status: effectiveItemStatus(item.status, pendingStatusRow) as ItemStatus }
        : item,
      pendingStatus: pendingItemStatusView(pendingStatusRow)
    };
  });
  const sessionRowById = new Map(sessionRows.map((row) => [row.item.id, row]));

  // 분류 섹션의 아이콘·색을 8타일 카탈로그에서 고르는 해석기(이름은 위 groupKeyOf가 낸다).
  const resolveTileCategory = buildTileCategoryResolver(categories.data?.categories);
  const categoryGroups: PreparationCategoryGroup[] = [];
  const seenGroupIds = new Set<string>();
  for (const { item } of sessionRows) {
    const groupId = groupKeyOf(item);
    if (seenGroupIds.has(groupId)) continue;
    seenGroupIds.add(groupId);
    // 아이콘·색은 8타일 카탈로그의 것을 쓴다. 서버 분류 UUID는 code를 거쳐 타일로 옮기고
    // (src/categories.ts buildTileCategoryResolver), 대응 타일이 없으면 중립 아이콘이다.
    const visual = expenseCategoryVisual(
      (item.categoryId ? resolveTileCategory(item.categoryId).tileCategoryId : null) ?? UNCATEGORIZED_GROUP_ID
    );
    categoryGroups.push({
      id: groupId,
      name: groupId,
      icon: visual.icon,
      tint: visual.iconBackgroundColor,
      color: visual.iconColor
    });
  }

  const parityItems: PreparationParityItem[] = sessionRows.map(({ rowItem }) => ({
    ...toPreparationParityItem(rowItem, {
      // 시기 버킷은 서버가 주는 값이 아니라 **지금 보고 있는 밴드 기준 판정**이다
      // (src/preparation/catalog-contract.ts -- 서버 now/soon 술어와 같은 규칙).
      timelineBucket: resolvePreparationTimelineBucket(rowItem, stageLabel)
    }),
    groupId: groupKeyOf(rowItem)
  }));

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.mainCoral}
          colors={[theme.colors.mainCoral]}
        />
      }
    >
      <PreparationListParity
        items={parityItems}
        categoryGroups={categoryGroups}
        // 원본의 "5개 미만 그룹 비노출"은 그때의 대형 카탈로그(그룹당 수십 개) 전제다. 이 앱의
        // 분류는 그보다 잘게 나뉘어 있어 같은 기준을 쓰면 실제로 있는 준비템이 목록 어디에서도
        // 보이지 않는다 -- 화면에서 사라지는 쪽이 정직하지 않다.
        minimumGroupSize={1}
        selectedContextKey={childId}
        selectedContextName={childScopeLabel ?? "우리 아이"}
        onBack={() => router.push("/(tabs)")}
        // 라운드 72 트랙 E: `onRetry`는 이식본의 조회 실패 가지에만 쓰였는데, 이 화면이 `error`를
        // 넘긴 적이 없어 그 가지는 도달할 수 없었다. 죽은 프롭과 함께 걷었다 — 다시 조회는 이
        // 화면의 당겨서 새로고침(RefreshControl)이 그대로 진다.
        onItemPress={(item) => router.push(`/items/${item.id}`)}
        onSearch={setSearchText}
        activeSearchQuery={searchText}
        onClearSearch={() => setSearchText("")}
        progress={parityProgress}
        topBarTrailing={
          /* 라운드 51 #10: 다자녀 가구에서만 헤더 우측에 아이 이름이 서고, 그것이 전환
             입구가 된다. 아이가 하나이거나 비세션이면 슬롯 자체가 비어 종전처럼 제목만
             남는다(리포트 탭과 같은 이중 게이트). */
          childSwitch.canSwitch && childScopeLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={childSwitchTriggerAccessibilityLabel(
                withSpokenChildScopeLabel("내 준비 목록", childScopeLabel)
              )}
              accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
              hitSlop={8}
              onPress={childSwitch.toggle}
              testID="items-child-switch-trigger"
              // 텍스트 한 줄(≈17dp) + hitSlop 8로는 ≈33dp라 48dp 최소 타깃에 못 미쳤다.
              style={{ justifyContent: "center", minHeight: theme.touchTarget }}
            >
              <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>
                {childScopeLabel} ⌄
              </Text>
            </Pressable>
          ) : null
        }
        beforeSegment={
          /* 스펙 §통합 지점: 찜 칩은 히어로와 세그먼트 사이 한 줄이다. 서버로 나가는 값이
             아니라 이미 받아 둔 스냅샷을 거르는 클라이언트 필터라 새 요청이 없다. */
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <CategoryChip
                label={INTERESTED_FILTER_LABEL}
                selected={showInterestedOnly}
                onPress={() => setShowInterestedOnly((on) => !on)}
              />
            </View>
            {/* C-01: 찜 목록이 시기 칩을 따르지 않는다는 사실을 그 자리에서 밝힌다 -- 말없이
                다른 규칙을 쓰면 "왜 이 시기가 아닌 물건이 보이지"가 된다. */}
            {showInterestedOnly ? (
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                {INTERESTED_FILTER_SCOPE_NOTE}
              </Text>
            ) : null}
          </View>
        }
        auxiliaryFilters={
          /* 스펙 §통합 지점: 필수도·출산 전은 보조 칩으로 내린다. 시기 밴드 칩도 같은 줄에
             선다 -- 이제 목록을 서버에서 좁히는 값이 아니라 "지금/곧/여유"를 가르는 기준이자
             준비율의 분모를 정하는 기준이다. */
          <View style={{ gap: 6 }}>
            {/* 라운드 69 트랙 C: 시기를 끝내 확인하지 못했을 때만, 칩 줄 **바로 위**에 한 줄.
                고를 대상(칩)이 바로 아래 있어야 "직접 골라 주세요"가 막다른 말이 되지 않는다.
                로딩 중에는 그리지 않는다(showStageBandUnresolvedNotice의 정착 판정). */}
            {showStageBandUnresolvedNotice ? (
              <Text
                accessibilityRole="text"
                style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}
              >
                {STAGE_BAND_UNRESOLVED_NOTICE}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {NECESSITY_FILTER_OPTIONS.map((option) => (
                <CategoryChip
                  key={option.value}
                  label={option.label}
                  selected={option.value === necessityFilter}
                  onPress={() => setNecessityFilter(option.value)}
                />
              ))}
              {/* 라운드 43 UX-V: "출산 전"만 보기. 임신 중인 아이의 세션에서만 나타난다.
                  라운드 49 QA(P3-3): 찜 목록을 보는 동안에는 적용되지 않으므로 비활성으로
                  그린다 -- 켜 둔 선택은 그대로 두어 찜을 끄면 보고 있던 좁히기가 돌아온다. */}
              {offersPreBirthFilter ? (
                <CategoryChip
                  label={PRE_BIRTH_FILTER_LABEL}
                  selected={preBirthFilterActive}
                  disabled={showInterestedOnly}
                  onPress={() => setPreBirthOnly((on) => !on)}
                />
              ) : null}
            </View>
          </View>
        }
        notices={
          <>
            {/* UX-E: 100% 축하 배너. 부드러운 축하 한 마디 + 다음 시기로 넘어갈 길만 제시하고,
                구매를 재촉하지 않는다(DNC-018). */}
            {showPrepCelebration ? (
              <View
                accessibilityRole="alert"
                style={{ backgroundColor: theme.colors.mint, borderRadius: theme.radii.card, gap: 8, padding: 14 }}
              >
                <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800", lineHeight: 22 }}>
                  {PREP_CELEBRATION_TITLE}
                </Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>{PREP_CELEBRATION_BODY}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {/* 다음 시기 보기는 새 화면이 아니라 **기존 시기 칩 선택**이다. */}
                  {nextStageBand ? (
                    <SecondaryButton
                      label={nextStageBandPreviewLabel(nextStageBand)}
                      accessibilityLabel={`${nextStageBand} 준비물 미리보기`}
                      onPress={() => {
                        setHasManualStageSelection(true);
                        setStageLabel(nextStageBand);
                        dismissPrepCelebration();
                      }}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                  <SecondaryButton
                    label={PREP_CELEBRATION_DISMISS_LABEL}
                    accessibilityLabel="준비 완료 축하 안내 닫기"
                    onPress={dismissPrepCelebration}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : null}

            {/* ITEM-124: 상태 변경 실패 배너 -- 누른 버튼이 있는 목록 바로 위에 둬서 무엇이
                저장되지 않았는지 그 자리에서 읽히게 한다(Toast tone="error" = accessibilityRole="alert"). */}
            {statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}

            {/* UX-E "다음에 챙길 것": 이름만 짚어 주는 한 줄. 같은 항목을 다시 그리면 목록에
                같은 물건이 두 번 보이므로, 타일은 제자리에 두고 배지로만 구분한다. 선정 근거는
                카탈로그 필수(essential) 표시 하나뿐이다(DNC-020). */}
            {prepFocusHint ? (
              <Text
                accessibilityRole="text"
                style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700", lineHeight: 18 }}
              >
                {prepFocusHint}
              </Text>
            ) : null}

            {/* 라운드 37 UX-I(detached): 준비했어요를 누른 항목이 목록에서 빠졌을 때의 같은 한 줄.
                어느 준비템인지 이름을 붙인다(타일 옆이 아니라 목록 위에 서 있으므로). */}
            {expenseLinkPlacement === "detached" && expenseLinkPrompt ? (
              <TextButton
                label={itemListExpenseLinkLabel(expenseLinkPlacement, expenseLinkPrompt.itemName)}
                accessibilityLabel={itemListExpenseLinkAccessibilityLabel(expenseLinkPrompt.itemName)}
                onPress={() => openExpenseLinkPrompt(expenseLinkPrompt)}
              />
            ) : null}
          </>
        }
        emptyState={
          showInterestedEmptyState ? (
            // C-01: 찜한 것이 하나도 없을 때. 찜을 안 한 것을 탓하지 않고(DNC-018), 원래 보던
            // 목록으로 돌아가는 길만 준다.
            <EmptyStateCard
              title={INTERESTED_FILTER_EMPTY_TEXT}
              actionLabel="준비템 목록 보기"
              onPress={() => setShowInterestedOnly(false)}
            />
          ) : isNarrowedByFilter ? (
            // 필터/검색 때문에 비었을 때는 홈으로 보내는 대신 조건을 풀 수 있게 한다.
            <EmptyStateCard
              title="검색·필터에 맞는 준비템이 없어요."
              actionLabel="필터 초기화"
              onPress={() => {
                setNecessityFilter("all");
                setSearchText("");
                setPreBirthOnly(false);
                // C-01: 찜 칩도 같은 "좁히기" 계열이라 함께 푼다 -- 하나만 남으면 초기화를
                // 눌러도 목록이 비어 있는 막다른 길이 된다.
                setShowInterestedOnly(false);
              }}
            />
          ) : (
            <EmptyStateCard
              title="아직 볼 수 있는 준비템이 없어요."
              actionLabel="홈으로 가기"
              onPress={() => router.push("/(tabs)")}
            />
          )
        }
        renderItemFooter={(parityItem) => {
          const row = sessionRowById.get(parityItem.id);
          if (!row) return null;
          const { item, rowItem, pendingStatus } = row;
          // UX-E: 서버 순서상 앞선 미준비 필수템이면 제자리에서 살짝 구분한다. 순서는 건드리지
          // 않는다. 스폰서 구분(DNC-011)과 헷갈리지 않도록 문구는 광고성 표현을 쓰지 않는다.
          const isPrepFocusItem = Boolean(prepFocusIds?.has(item.id));
          return (
            <View style={{ gap: 6 }}>
              {isPrepFocusItem ? (
                <Text style={{ color: theme.colors.coral[700], fontSize: 11, fontWeight: "700", lineHeight: 16 }}>
                  {NEXT_PREP_FOCUS_BADGE_LABEL}
                </Text>
              ) : null}
              {/* C-10: 낙관 반영과 짝을 이루는 정직한 한 줄 -- 바뀐 값은 이미 타일의 상태
                  pill에 보이고, 여기서는 그 값이 아직 이 기기에만 있다는 사실을 말한다.
                  문구는 기록 탭의 대기/실패 행과 **같은 단어**를 쓴다(src/offline/messages.ts). */}
              {pendingStatus ? (
                <View style={{ gap: 4 }}>
                  <StatusBadge label={pendingStatus.badgeLabel} tone="warning" />
                  <Text style={{ color: theme.colors.gray600, fontSize: 11, lineHeight: 16 }}>
                    {pendingStatus.noticeText}
                  </Text>
                </View>
              ) : null}
              {canUpdateStatus ? (
                <View style={{ gap: 6 }}>
                  {/* C-10: 요청 중 비활성이 없다 -- 저장이 로컬이라 기다릴 왕복이 없고, 같은
                      준비템을 다시 눌러도 대기 행이 최신 값으로 대체될 뿐이다(outbox-merge.ts). */}
                  <SecondaryButton
                    label="준비했어요"
                    accessibilityLabel={`${item.name} 준비했어요`}
                    onPress={() => requestStatusChange(rowItem, "prepared")}
                  />
                  <SecondaryButton
                    label="괜찮아요"
                    accessibilityLabel={`${item.name} 괜찮아요`}
                    onPress={() => requestStatusChange(rowItem, "not_needed")}
                  />
                </View>
              ) : null}
              {/* 라운드 37 UX-I(inline): 방금 준비했어요를 누른 그 항목에서만 뜨는 한 줄 링크.
                  카드나 모달을 세우지 않는다 -- 준비 상태를 정리하던 흐름을 끊지 않고, 이름은
                  바로 위 타일이 이미 말하고 있으므로 문구에 넣지 않는다.
                  무시해도 아무 일도 일어나지 않는 권유다(DNC-018). */}
              {isExpenseLinkPromptRow({
                placement: expenseLinkPlacement,
                prompt: expenseLinkPrompt,
                itemTemplateId: item.id
              }) ? (
                <TextButton
                  label={itemListExpenseLinkLabel(expenseLinkPlacement, item.name)}
                  accessibilityLabel={itemListExpenseLinkAccessibilityLabel(item.name)}
                  onPress={() =>
                    openExpenseLinkPrompt({
                      itemTemplateId: item.id,
                      itemName: item.name,
                      categoryId: item.categoryId
                    })
                  }
                />
              ) : null}
            </View>
          );
        }}
      />

      {childSwitch.canSwitch && childSwitch.isOpen ? (
        <ChildSwitchSheet
          testID="items-child-switch-sheet"
          options={childSwitch.options}
          currentChildId={childId}
          onSelect={childSwitch.switchTo}
          onClose={childSwitch.close}
        />
      ) : null}
    </AppScreen>
  );
}
