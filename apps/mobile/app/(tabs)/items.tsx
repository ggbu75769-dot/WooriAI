import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Image, Platform, RefreshControl, Text, TextInput, View, type ImageSourcePropType } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildItemStatusChangedPayload } from "../../src/analytics/events";
import { getHome, listItems, LOCAL_SESSION_TOKEN, updateItemStatus, type ItemStatus, type ItemSummary } from "../../src/api/client";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, CategoryChip, EmptyStateCard, ProductCard, SecondaryButton, TextButton, Toast } from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { resolveScreenPhase } from "../../src/screen-phase";
import { theme } from "../../src/theme";
import { ItemListPixelStyles } from "../../src/pixelLock/styles";
import { bandDefinitions, resolveDefaultStageLabel, type StageBandLabel } from "../../src/items/stage-bands";
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
  filterItems,
  hasActiveItemFilter,
  NECESSITY_FILTER_OPTIONS,
  type NecessityFilter
} from "../../src/items/item-filters";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  itemStatusMutationErrorMessage
} from "../../src/items/status-mutation-messages";

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
  // ITEM-124: 상태 변경 실패 문구. 이 목록 버튼은 지출 기록과 달리 오프라인 아웃박스를 타지
  // 않아 실패가 곧 유실이다 -- 조용히 넘어가면 사용자는 바뀐 줄 알고 떠난다
  // (src/items/status-mutation-messages.ts).
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
  // ITEM-124(L6): 지금 요청이 날아가 있는 행의 itemTemplateId 집합. react-query 뮤테이션 하나를
  // 목록 전체가 공유하므로 `updateStatus.variables`는 **마지막으로 누른 행**만 가리킨다 -- 그
  // 값으로 비활성을 판정하면 A행 요청 중에 B행을 누르는 순간 A 버튼이 다시 활성화되어 같은 행에
  // 중복 PATCH가 나간다. 행 단위 진행 상태는 화면이 직접 들고 있어야 경합에 견딘다.
  const [pendingStatusIds, setPendingStatusIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  // 라운드 37 UX-I: 방금 "준비했어요"를 누른 행. 그 행에서만 "지출도 기록할까요?" 한 줄이 뜬다
  // (카드/모달 없이 텍스트 링크 하나). 한 번에 하나만 기억하므로 다른 행을 누르면 이전 줄은
  // 조용히 사라진다 -- 목록에 안내가 쌓이지 않게 하기 위해서다. 노출 판정과 문구는 전부
  // 순수 모듈(src/items/expense-link-prompt.ts)에 있다.
  //
  // 라운드 37 G-3: 이 줄은 **어느 목록을 보다가 남긴 것인지**(아이·시기 밴드·필수도·검색어)를
  // 함께 들고 있다. 특히 아이를 바꾸고 돌아왔을 때 남아 있던 줄을 누르면 다른 아이의 지출로
  // 기록되고 서버가 그 아이의 준비템까지 준비 완료로 바꿔 버렸다(R19-B) -- 사용자가 시킨 적
  // 없는 데이터 변경이다.
  const [expenseLinkPrompt, setExpenseLinkPrompt] = useState<ExpenseLinkPrompt | null>(null);
  // UX-E: 100% 축하 배너를 닫은 시기 밴드들. 축하는 "도달했다"는 사실을 한 번 알리는 것이지
  // 계속 붙어 있는 라벨이 아니다 -- 닫으면 이 화면이 살아 있는 동안 같은 밴드에서는 다시
  // 뜨지 않는다(밴드별로 기억하므로 다른 시기를 100% 채우면 그때는 다시 축하한다).
  // 전역 모듈 상태 대신 화면 상태를 쓰는 이유: 테스트/재진입 사이에 남는 가변 전역이 없다.
  const [dismissedCelebrationBands, setDismissedCelebrationBands] = useState<ReadonlySet<StageBandLabel>>(
    () => new Set<StageBandLabel>()
  );
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  // UX-R(M): "지출도 기록할까요?"는 지출 생성 화면으로 가는 입구다. 보기 전용 참여자에게는
  // 서버가 그 저장을 403으로 막으므로, 여기서 같은 판정으로 안내한다
  // (준비 상태 변경 자체는 이 라운드 범위 밖이라 건드리지 않는다).
  const expenseGate = useExpenseEntryGate();
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
  // 라운드 37 G-3: "지출도 기록할까요?" 줄이 살아 있어도 되는 화면 좌표. 목록을 갈아 끼우는
  // 입력(아이·시기 밴드·필수도 칩·검색어)만 담는다 -- 상태 탭은 일부러 빠져 있다(모듈 주석 참고:
  // 준비완료 탭으로 옮겨 간 그 항목을 보러 가는 이동은 프롬프트를 버리는 행동이 아니다).
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
  const updateStatus = useMutation({
    mutationFn: ({ itemTemplateId, status }: { itemTemplateId: string; itemName: string; status: ItemStatus }) =>
      updateItemStatus(authToken!, childId!, itemTemplateId, status),
    onMutate: (variables) => {
      setStatusErrorMessage(null);
      // 새 조작이 시작되면 앞선 행의 "지출도 기록할까요?" 줄은 걷는다(한 행에서만 보인다).
      setExpenseLinkPrompt(null);
      // 여러 행이 동시에 날아갈 수 있으므로 집합에 더한다(새 Set으로 갈아 끼워 리렌더를 보장).
      setPendingStatusIds((ids) => {
        const next = new Set(ids);
        next.add(variables.itemTemplateId);
        return next;
      });
    },
    onSettled: (_data, _error, variables) => {
      // 성공·실패 어느 쪽이든 그 행만 푼다 -- 다른 행의 진행 중 상태를 건드리지 않는다.
      setPendingStatusIds((ids) => {
        if (!ids.has(variables.itemTemplateId)) return ids;
        const next = new Set(ids);
        next.delete(variables.itemTemplateId);
        return next;
      });
    },
    onError: (error, variables) => {
      setStatusErrorMessage(itemStatusMutationErrorMessage(variables.status === "prepared" ? "prepare" : "skip", error));
    },
    onSuccess: async (_data, variables) => {
      // 라운드 37 UX-I: 서버가 확인한 뒤에만 남긴다. "괜찮아요"(not_needed)에는 남기지 않는다 --
      // 사지 않기로 한 판단에 지출 기록을 권하면 판단을 되묻는 잔소리가 된다(DNC-018).
      // 캐시 무효화(await)보다 **먼저** 세워 둬야 목록이 갱신되는 동안에도 줄이 유지된다.
      setExpenseLinkPrompt(
        nextExpenseLinkPrompt({
          itemTemplateId: variables.itemTemplateId,
          itemName: variables.itemName,
          status: variables.status,
          // G-3: 지금 보고 있는 목록의 좌표를 함께 박아 둔다.
          scope: { childId, stageLabel, necessityFilter, searchText }
        })
      );
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

  // ITEM-124(L6): 항목 단위 진행 중 판정 -- onMutate/onSettled가 관리하는 in-flight 집합만 본다.
  // 뮤테이션의 공유 variables를 쓰던 예전 판정은 두 행을 잇달아 누르면 먼저 누른 행이 요청 중인데도
  // 다시 눌리는 구멍이 있었다.
  const isStatusUpdatePending = (itemTemplateId: string) => pendingStatusIds.has(itemTemplateId);

  /**
   * 리뷰 F2: gifted/prepared/not_needed는 서로 배타적인 단일 status 컬럼이라, 준비완료 탭에서
   * "선물 받음" 배지를 단 행의 준비했어요/괜찮아요를 누르면 선물 받았다는 기록이 아무 말 없이
   * 사라진다. 지금 상태가 gifted인 행에서만 확인을 한 번 거치고(문구는 상세 화면과 같은
   * 단일 소스), 그 밖에는 예전처럼 바로 실행한다.
   */
  const requestStatusChange = (
    item: { id: string; name: string; status: ItemStatus },
    status: "prepared" | "not_needed"
  ) => {
    const kind = status === "prepared" ? "prepare" : "skip";
    const run = () => updateStatus.mutate({ itemTemplateId: item.id, itemName: item.name, status });
    if (item.status !== "gifted") {
      run();
      return;
    }
    Alert.alert(GIFTED_RESET_CONFIRM_TITLE, giftedResetConfirmMessage(kind), [
      { text: GIFTED_RESET_CONFIRM_CANCEL_LABEL, style: "cancel" },
      { text: GIFTED_RESET_CONFIRM_ACTION_LABEL, onPress: run }
    ]);
  };

  // MOB-117 당겨서 새로고침: ["items"] 접두어 invalidate로 현재 상태 탭 목록 + ITEM-114
  // 준비율 스냅샷을 함께 갱신하고, 기본 시기 칩이 읽는 ["home"] 캐시도 갱신한다.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] })
    ])
  );

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const itemsPhase = resolveScreenPhase({ isPending: items.isPending, isError: items.isError, hasData: Boolean(items.data) });
  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 — 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(items.isError);

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
  // UX-E: 준비율을 "여정"으로 읽히게 하는 파생값들. 전부 순수 모듈(src/items/prep-milestones.ts)이
  // 계산하고, 화면은 그리기만 한다. prepProgress 자체가 hasSession + !isPixelLockMode 게이트를
  // 이미 통과한 값이라 ITEM-001 픽셀 락 캡처(비세션 미리보기)에는 어느 것도 나오지 않는다.
  const prepMilestone = buildPrepMilestoneView(prepProgress);
  // 라운드 35 F9 → 36 F8: 화면에 **그리는** 퍼센트(개수와 어긋나지 않게 캡한 값)는 이제 순수
  // 모듈이 `displayPercent`로 준다. 예전에는 이 캡이 화면에만 있어서, 모듈이 미리 만든
  // accessibilityLabel은 캡 이전 값("199/200 → 100%")을 담은 채 아무도 쓰지 않고 남아 있었다.
  // 화면은 재조립을 그만두고 모듈의 한 값을 그대로 쓴다 -- 표시 퍼센트 규칙이 한 곳이 된다.
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
  // 한다(클라이언트 재정렬 없음). 같은 항목을 카드로 다시 그리지 않고, 목록 위 한 줄 안내 +
  // 제자리 배지로만 구분한다.
  const prepFocusIds = hasSession && !isPixelLockMode ? nextPrepFocusIds(listedItems) : null;
  const prepFocusHint = hasSession && !isPixelLockMode ? nextPrepFocusHintText(listedItems) : null;
  // 라운드 37 UX-I: "지출도 기록할까요?" 한 줄을 어디에 그릴지. 준비했어요를 누른 행은 상태 탭이
  // "지금 필요"면 준비완료 탭으로 옮겨 가 **목록에서 사라지므로**(가장 흔한 경로), 행이 남아 있으면
  // 그 행 아래(inline), 사라졌으면 목록 위 한 줄(detached)로 자리만 옮긴다. 판정은 순수 모듈이 한다.
  // G-3: 좌표가 어긋난 프롬프트(다른 아이·다른 밴드·다른 필터에서 남은 줄)는 "none"으로 떨어져
  // 한 프레임도 그려지지 않는다.
  const expenseLinkPlacement = expenseLinkPromptPlacement({
    hasSession,
    prompt: expenseLinkPrompt,
    scope: expenseLinkPromptScope,
    visibleItemIds: listedItems.map((item) => item.id)
  });
  const openExpenseLinkPrompt = expenseGate.guard((prompt: { itemTemplateId: string; itemName: string }) => {
    setExpenseLinkPrompt(null);
    router.push({
      pathname: "/expenses/new",
      params: expenseLinkParams({ itemName: prompt.itemName, itemTemplateId: prompt.itemTemplateId })
    });
  });

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

          {/* UX-E: 100% 축하 배너. 부드러운 축하 한 마디 + 다음 시기로 넘어갈 길만 제시하고,
              구매를 재촉하지 않는다(DNC-018). 닫으면 이 화면이 살아 있는 동안 같은 밴드에서
              다시 뜨지 않는다. 세션이 있을 때만 계산되는 prepMilestone에 걸려 있어 ITEM-001
              픽셀 락 캡처에는 존재하지 않는다. */}
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
                {/* 다음 시기 보기는 새 화면이 아니라 **기존 시기 칩 선택**이다 -- 칩을 직접 누른
                    것과 똑같이 동작한다(수동 선택 표시 + 라벨 변경). */}
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

          {/* ITEM-114 → UX-E: 리스트 상단 준비율. 여전히 정보는 텍스트가 전달하고 바는 보조
              시각화다(색만으로 의미 전달 금지). progressbar 롤 + accessibilityValue로 스크린
              리더에도 개수·퍼센트·구간 문구를 한 번에 읽어 준다. UX-E에서 더해진 것은 구간
              (25/50/75/100%) 문구 한 줄뿐이고, 수치는 기존 ITEM-114 스냅샷 그대로다.
              DNC-002/003: 탭·리스트 구조는 그대로다. */}
          {prepMilestone ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={prepMilestone.accessibilityLabel}
              accessibilityValue={{ min: 0, max: 100, now: prepMilestone.displayPercent }}
              style={{ gap: 6 }}
            >
              <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
                  {prepMilestone.headline}
                </Text>
                <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "700", lineHeight: 20 }}>
                  {prepMilestone.displayPercent}%
                </Text>
              </View>
              <View style={{ backgroundColor: theme.colors.peach, borderRadius: theme.radii.pill, height: 8, overflow: "hidden" }}>
                <View
                  style={{
                    backgroundColor: theme.colors.mainCoral,
                    borderRadius: theme.radii.pill,
                    height: 8,
                    width: `${prepMilestone.displayPercent}%`
                  }}
                />
              </View>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>{prepMilestone.tierText}</Text>
            </View>
          ) : null}

          {/* ITEM-124: 상태 변경 실패 배너 -- 누른 버튼이 있는 목록 바로 위에 둬서 무엇이
              저장되지 않았는지 그 자리에서 읽히게 한다(Toast tone="error" = accessibilityRole="alert"). */}
          {statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}

          {/* UX-E "다음에 챙길 것": 이름만 짚어 주는 한 줄. 같은 항목을 카드로 다시 그리면 목록에
              같은 물건이 두 번 보이므로, 실제 카드는 목록 안 제자리에 그대로 두고 배지로만
              구분한다. 선정 근거는 카탈로그 필수(essential) 표시 하나뿐이다(DNC-020). */}
          {prepFocusHint ? (
            <Text
              accessibilityRole="text"
              style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700", lineHeight: 18 }}
            >
              {prepFocusHint}
            </Text>
          ) : null}

          {/* 라운드 37 UX-I(detached): 준비했어요를 누른 행이 상태 탭이 바뀌며 목록에서 빠졌을 때의
              같은 한 줄. 어느 준비템인지 이름을 붙인다(행 옆이 아니라 목록 위에 서 있으므로). */}
          {expenseLinkPlacement === "detached" && expenseLinkPrompt ? (
            <TextButton
              label={itemListExpenseLinkLabel(expenseLinkPlacement, expenseLinkPrompt.itemName)}
              accessibilityLabel={itemListExpenseLinkAccessibilityLabel(expenseLinkPrompt.itemName)}
              onPress={() => openExpenseLinkPrompt(expenseLinkPrompt)}
            />
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
                // UX-E: 서버 순서상 앞선 미준비 필수템이면 제자리에서 살짝 구분한다. 순서는
                // 건드리지 않는다 -- 강조는 배경/라벨로만 한다. 스폰서 구분(DNC-011)과 헷갈리지
                // 않도록 문구는 "먼저 챙기면 좋아요"로 광고성 표현을 쓰지 않는다.
                const isPrepFocusItem = Boolean(prepFocusIds?.has(item.id));

                return (
                  <View
                    key={item.id}
                    style={
                      isPrepFocusItem
                        ? { backgroundColor: theme.colors.coral[50], borderRadius: theme.radii.card, gap: 8, padding: 10 }
                        : { gap: 8 }
                    }
                  >
                    {isPrepFocusItem ? (
                      <Text style={{ color: theme.colors.coral[700], fontSize: 11, fontWeight: "700", lineHeight: 16 }}>
                        {NEXT_PREP_FOCUS_BADGE_LABEL}
                      </Text>
                    ) : null}
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
                        {/* ITEM-124: 비활성은 항목 단위다 -- 한 행의 요청이 나가는 동안 다른 행까지
                            잠기면 목록 전체가 멈춘 것처럼 보인다. */}
                        <SecondaryButton
                          disabled={isStatusUpdatePending(item.id)}
                          label="준비했어요"
                          accessibilityLabel={`${item.name} 준비했어요`}
                          onPress={() => requestStatusChange(item, "prepared")}
                          style={{ flex: 1 }}
                        />
                        <SecondaryButton
                          disabled={isStatusUpdatePending(item.id)}
                          label="괜찮아요"
                          accessibilityLabel={`${item.name} 괜찮아요`}
                          onPress={() => requestStatusChange(item, "not_needed")}
                          style={{ flex: 1 }}
                        />
                      </View>
                    ) : null}
                    {/* 라운드 37 UX-I(inline): 방금 준비했어요를 누른 그 행에서만 뜨는 한 줄 링크.
                        카드나 모달을 세우지 않는다 -- 준비 상태를 정리하던 흐름을 끊지 않고, 이름은
                        바로 위 카드가 이미 말하고 있으므로 문구에 넣지 않는다(행 높이 변화 최소화).
                        무시해도 아무 일도 일어나지 않는 권유다(DNC-018). */}
                    {isExpenseLinkPromptRow({
                      placement: expenseLinkPlacement,
                      prompt: expenseLinkPrompt,
                      itemTemplateId: item.id
                    }) ? (
                      <TextButton
                        label={itemListExpenseLinkLabel(expenseLinkPlacement, item.name)}
                        accessibilityLabel={itemListExpenseLinkAccessibilityLabel(item.name)}
                        onPress={() => openExpenseLinkPrompt({ itemTemplateId: item.id, itemName: item.name })}
                      />
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
