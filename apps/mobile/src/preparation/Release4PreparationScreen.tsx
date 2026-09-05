import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CatalogScenarioCode } from "@wooriai/domain";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useScrollToTop } from "@react-navigation/native";
import { Redirect, router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import {
  listCatalogDomains,
  listCatalogItems,
  getCatalogTimeline,
  getPreparationContext,
  updatePreparationContext,
  getCatalogSafetyAlerts,
  getCatalogSafetyAlternatives,
  acknowledgeCatalogSafetyAlert,
  listCatalogBundles,
  applyCatalogBundle,
  reportMissingCatalogItem,
  getCatalogContexts,
  listChildren,
  fixtureSessionToken,
  putMotherItemPlan,
  putItemPlan,
  type CatalogItemSummary,
  type CatalogPlanState,
  type CatalogTimelineBucket
} from "../api/client";
import { AppIcon, BottomSheet, EmptyStateCard, ItemStatusControl, PageHeader, PreparationItemCard, PrimaryButton, SampleDataBanner, ScreenScaffold, SecondaryButton, SectionCard, SyncStatusBar, TopAppBar, semanticColors, spacing } from "../design-system";
import { useConnectivityStatus } from "../offline/connectivity";
import { useOfflineSyncSnapshot } from "../offline/sync-controller";
import { normalizeAppSyncStatus } from "../offline/sync-display-state";
import { invalidatePreparationMutationQueries } from "../query/mutation-invalidation";
import { openPublicEvidenceUrl } from "../security/public-evidence-url";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useCatalogSearchStore } from "../stores/catalog-search.store";
import { useSessionStore } from "../stores/session.store";
import {
  PreparationOverviewLinks,
  PreparationProgressCard,
  SafetyAlertSection,
  WeeklyPreparationSection
} from "./PreparationOverview";
import { resolvePreparationItemVisual } from "./item-visuals";
import { compactGridColumnCount, compactGridItemWidth } from "../design-system/responsive";
import { PreparationListParity } from "./PreparationListParity";
import {
  activeSafetyAlertAfterScopeChange,
  safetyAlternativeScopeKey,
  safetyAlternativesQueryKey
} from "./safety-query-scope";

type PreparationView = "personalized" | "all" | "active" | "mine";
type PreparationSurface = "overview" | "list" | "search" | "bundles" | "settings";
type AssignmentFilter = "all" | "assigned" | "unassigned";
type PreparationItem = CatalogItemSummary & {
  timelineBucket?: CatalogTimelineBucket;
  dueWindowLabel?: string;
  recommendationReason?: string;
};

const views: Array<{ value: PreparationView; label: string }> = [
  { value: "personalized", label: "맞춤" },
  { value: "all", label: "전체" },
  { value: "mine", label: "내 준비함" }
];

const activeStates = new Set<CatalogPlanState>(["researching", "planned", "ordered", "gift_expected", "replacement_needed"]);
const mineStates = new Set<CatalogPlanState>(["researching", "planned", "ordered", "owned", "borrowed", "rented", "gift_expected", "gifted", "not_needed", "replacement_needed"]);
const timelineBucketOrder = ["overdue", "this_week", "this_month", "next_stage", "completed", "not_needed"] as const;
const preparationContextOptions: Array<{ code: CatalogScenarioCode; label: string }> = [
  { code: "first_child", label: "첫째" },
  { code: "second_or_later", label: "둘째 이상" },
  { code: "multiple_birth", label: "다태아" },
  { code: "preterm_or_nicu", label: "미숙아·NICU (직접 선택)" },
  { code: "vaginal_delivery", label: "질식 분만 예정" },
  { code: "cesarean_delivery", label: "제왕절개 예정" },
  { code: "breastfeeding", label: "모유수유" },
  { code: "formula_feeding", label: "분유수유" },
  { code: "mixed_feeding", label: "혼합수유" },
  { code: "daycare", label: "어린이집" },
  { code: "kindergarten", label: "유치원" },
  { code: "school", label: "학교" },
  { code: "car_primary", label: "차량 이동 중심" },
  { code: "public_transport_primary", label: "대중교통 중심" },
  { code: "no_car", label: "차량 없음" },
  { code: "no_elevator", label: "엘리베이터 없음" },
  { code: "small_home", label: "작은 집·수납 적음" },
  { code: "pet_household", label: "반려동물과 생활" },
  { code: "secondhand_preferred", label: "중고 선호" },
  { code: "rental_preferred", label: "대여 선호" },
  { code: "frequent_travel", label: "여행 잦음" },
  { code: "summer_birth", label: "여름 출산·생일" },
  { code: "winter_birth", label: "겨울 출산·생일" },
  { code: "budget_saving", label: "절약 중심" }
];
const preparationContextExclusiveGroups: readonly (readonly CatalogScenarioCode[])[] = [
  ["first_child", "second_or_later"],
  ["vaginal_delivery", "cesarean_delivery"],
  ["breastfeeding", "formula_feeding", "mixed_feeding"],
  ["daycare", "kindergarten", "school"],
  ["car_primary", "no_car"],
  ["car_primary", "public_transport_primary"],
  ["summer_birth", "winter_birth"]
];

function timelineBucketLabel(value: CatalogTimelineBucket) {
  if (value === "overdue") return "준비가 늦었어요";
  if (value === "this_week") return "이번 주 준비";
  if (value === "this_month") return "이번 달 준비";
  if (value === "next_stage") return "다음 단계 준비";
  if (value === "completed") return "이미 완료";
  return "필요 없음";
}

function planLabel(state: CatalogPlanState | undefined) {
  if (state === "need") return "필요해요";
  if (state === "researching") return "알아보는 중";
  if (state === "planned") return "구매 예정";
  if (state === "ordered") return "주문 완료";
  if (state === "owned") return "이미 있어요";
  if (state === "borrowed") return "빌렸어요";
  if (state === "rented") return "대여했어요";
  if (state === "gift_expected") return "선물 예정";
  if (state === "gifted") return "선물 받음";
  if (state === "not_needed") return "필요 없어요";
  if (state === "replacement_needed") return "교체 필요";
  if (state === "replacement_due") return "교체 시기";
  if (state === "replaced") return "교체 완료";
  if (state === "retired" || state === "ended") return "사용 종료";
  return "미정";
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={onPress}
      style={{
        backgroundColor: selected ? semanticColors.actionPrimary : semanticColors.surface,
        borderColor: selected ? semanticColors.actionPrimary : semanticColors.borderSubtle,
        borderRadius: 999,
        borderWidth: 1,
        minHeight: 36,
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 9
      }}
    >
      <Text style={{ color: selected ? semanticColors.textInverse : semanticColors.textSecondary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function Release4PreparationScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { fontScale, width } = useWindowDimensions();
  const compactColumns = compactGridColumnCount(width, fontScale);
  const {
    surface: requestedSurface,
    contextType: requestedContextType,
    contextId: requestedContextId
  } = useLocalSearchParams<{ surface?: string; contextType?: string; contextId?: string }>();
  const [surface, setSurface] = useState<PreparationSurface>("list");
  const [view, setView] = useState<PreparationView>("personalized");
  const [domainCode, setDomainCode] = useState<string | undefined>();
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchReportMessage, setSearchReportMessage] = useState<string | null>(null);
  const recentSearches = useCatalogSearchStore((state) => state.recentSearches);
  const addRecentSearch = useCatalogSearchStore((state) => state.addRecentSearch);
  const clearRecentSearches = useCatalogSearchStore((state) => state.clearRecentSearches);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const sessionGeneration = useSessionStore((state) => state.sessionGeneration);
  const sessionUserId = useSessionStore((state) => state.userId);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const [contextKey, setContextKey] = useState<string | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedBundleItemIds, setSelectedBundleItemIds] = useState<string[]>([]);
  const [bundleWorking, setBundleWorking] = useState(false);
  const [bundleMessage, setBundleMessage] = useState<string | null>(null);
  const [preparationContextDraft, setPreparationContextDraft] = useState<CatalogScenarioCode[]>([]);
  const [preparationContextMessage, setPreparationContextMessage] = useState<string | null>(null);
  const [statusItem, setStatusItem] = useState<PreparationItem | null>(null);
  const [statusDraft, setStatusDraft] = useState<CatalogPlanState>("researching");
  const [activeSafetyAlertId, setActiveSafetyAlertId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const activeContextKey = contextKey ?? (childId ? `child:${childId}` : null);
  const [contextType, contextId] = activeContextKey?.split(":") ?? [];
  const activeChildId = contextType === "child" ? contextId : undefined;
  const activeMotherProfileId = contextType === "mother" ? contextId : undefined;
  const hasSession = Boolean(token && activeContextKey);
  const safetyScopeKey = safetyAlternativeScopeKey({
    sessionGeneration,
    userId: sessionUserId,
    defaultHouseholdId,
    isTestSession
  }, activeContextKey);
  const previousSafetyScopeKey = useRef(safetyScopeKey);

  useFocusEffect(
    useCallback(() => () => {
      setStatusItem(null);
    }, [])
  );

  useEffect(() => {
    if (requestedSurface === "overview") setSurface("overview");
  }, [requestedSurface]);

  useEffect(() => {
    const previous = previousSafetyScopeKey.current;
    if (previous === safetyScopeKey) return;
    setActiveSafetyAlertId((current) =>
      activeSafetyAlertAfterScopeChange(previous, safetyScopeKey, current)
    );
    void queryClient.removeQueries({
      queryKey: ["catalog-v2", "safety-alternatives", previous]
    });
    previousSafetyScopeKey.current = safetyScopeKey;
  }, [queryClient, safetyScopeKey]);

  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(token),
    queryFn: () => listChildren(token!)
  });
  useEffect(() => {
    if (
      requestedSurface !== "overview" ||
      requestedContextType !== "child" ||
      !requestedContextId
    ) return;
    const requestedChild = children.data?.children.find((entry) => entry.id === requestedContextId);
    if (!requestedChild) return;
    setContextKey(`child:${requestedChild.id}`);
    setSelectedChildId(requestedChild.id, requestedChild.householdId);
  }, [
    children.data?.children,
    requestedContextId,
    requestedContextType,
    requestedSurface,
    setSelectedChildId
  ]);
  const contexts = useQuery({
    queryKey: ["catalog-v2", "contexts"],
    enabled: Boolean(token),
    queryFn: () => getCatalogContexts(token!)
  });

  const domains = useQuery({
    queryKey: ["catalog-v2", "domains"],
    enabled: hasSession && surface === "search" && view !== "personalized",
    queryFn: () => listCatalogDomains(token!)
  });
  const items = useInfiniteQuery({
    queryKey: ["catalog-v2", "items", activeContextKey, view, domainCode, searchQuery],
    enabled: hasSession && (surface === "search" || (surface === "list" && view !== "personalized")),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listCatalogItems(token!, {
      childId: activeChildId,
      motherProfileId: activeMotherProfileId,
      lifecycleAxis: view === "personalized" ? (contextType as "child" | "mother") : undefined,
      domainCode,
      query: searchQuery || undefined,
      cursor: pageParam,
      limit: 100
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
  const timeline = useQuery({
    queryKey: ["catalog-v2", "timeline", activeContextKey],
    enabled: hasSession && view === "personalized",
    queryFn: () => getCatalogTimeline(token!, activeChildId, activeMotherProfileId)
  });
  const preparationContext = useQuery({
    queryKey: ["catalog-v2", "preparation-context", activeContextKey],
    enabled: hasSession && view === "personalized",
    queryFn: () => getPreparationContext(token!, activeChildId, activeMotherProfileId)
  });
  useEffect(() => {
    setPreparationContextDraft(preparationContext.data?.contextCodes ?? []);
    setPreparationContextMessage(null);
  }, [activeContextKey, preparationContext.data?.updatedAt]);
  const safetyAlerts = useQuery({
    queryKey: ["catalog-v2", "safety-alerts", activeContextKey],
    enabled: hasSession && surface === "overview",
    queryFn: () => getCatalogSafetyAlerts(token!, activeChildId, activeMotherProfileId)
  });
  const safetyAlternatives = useQuery({
    queryKey: safetyAlternativesQueryKey(safetyScopeKey, activeSafetyAlertId),
    enabled: hasSession && surface === "overview" && Boolean(activeSafetyAlertId),
    queryFn: () => getCatalogSafetyAlternatives(token!, activeSafetyAlertId!)
  });
  const bundles = useQuery({
    queryKey: ["catalog-v2", "bundles", activeChildId],
    enabled: hasSession && Boolean(activeChildId) && surface === "bundles",
    queryFn: () => listCatalogBundles(token!, activeChildId!)
  });

  const updatePlan = useMutation({
    mutationFn: ({ itemId, state, expectedVersion }: { itemId: string; state: CatalogPlanState; expectedVersion?: number }) => activeMotherProfileId
      ? putMotherItemPlan(token!, activeMotherProfileId, itemId, { state, expectedVersion })
      : putItemPlan(token!, activeChildId!, itemId, { state, expectedVersion }),
    onSuccess: async () => {
      await invalidatePreparationMutationQueries(queryClient, [activeContextKey!, activeChildId ?? activeMotherProfileId!]);
      setStatusItem(null);
    }
  });

  const openStatusSheet = (item: PreparationItem) => {
    const current = item.plan?.state;
    setStatusDraft(current ?? "researching");
    setStatusItem(item);
  };
  const statusChanged = Boolean(
    statusItem && statusDraft !== (statusItem.plan?.state ?? "researching")
  );

  const closeStatusSheet = () => {
    if (updatePlan.isPending) return false;
    if (!statusChanged) {
      setStatusItem(null);
      return true;
    }
    Alert.alert(
      "준비 상태를 저장하지 않았어요",
      "시트를 닫으면 선택한 상태가 사라집니다.",
      [
        { text: "계속 수정", style: "cancel" },
        { text: "저장하지 않고 닫기", style: "destructive", onPress: () => setStatusItem(null) }
      ]
    );
    return false;
  };

  const openStatusItemDetail = () => {
    if (!statusItem) return;
    const itemId = statusItem.id;
    const navigate = () => {
      setStatusItem(null);
      router.push({ pathname: "/items/[itemTemplateId]", params: { itemTemplateId: itemId, v: "2", contextType, contextId } });
    };
    if (!statusChanged) {
      navigate();
      return;
    }
    Alert.alert(
      "준비 상태를 저장하지 않았어요",
      "상세 화면으로 이동하면 선택한 상태가 사라집니다.",
      [
        { text: "계속 수정", style: "cancel" },
        { text: "저장하지 않고 이동", style: "destructive", onPress: navigate }
      ]
    );
  };
  const acknowledgeSafety = useMutation({
    mutationFn: ({ alertId, expectedVersion }: { alertId: string; expectedVersion: number }) => acknowledgeCatalogSafetyAlert(token!, alertId, expectedVersion),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["catalog-v2", "safety-alerts"] })
  });
  const savePreparationContext = useMutation({
    mutationFn: () => updatePreparationContext(token!, activeChildId, activeMotherProfileId, {
      contextCodes: preparationContextDraft,
      ...(preparationContext.data && preparationContext.data.version > 0 ? { expectedVersion: preparationContext.data.version } : {})
    }),
    onSuccess: async (saved) => {
      setPreparationContextDraft(saved.contextCodes);
      setPreparationContextMessage("선택한 상황을 추천에 반영했어요.");
      await queryClient.invalidateQueries({ queryKey: ["catalog-v2", "preparation-context", activeContextKey] });
      await queryClient.invalidateQueries({ queryKey: ["catalog-v2", "timeline", activeContextKey] });
    },
    onError: () => setPreparationContextMessage("다른 가족의 변경 여부를 확인한 뒤 다시 저장해 주세요.")
  });

  const togglePreparationContext = (code: CatalogScenarioCode) => {
    setPreparationContextMessage(null);
    setPreparationContextDraft((current) => {
      if (current.includes(code)) return current.filter((entry) => entry !== code);
      const incompatibleCodes = new Set(preparationContextExclusiveGroups.filter((group) => group.includes(code)).flat());
      return [...current.filter((entry) => !incompatibleCodes.has(entry)), code];
    });
  };

  const visibleItems = useMemo<PreparationItem[]>(() => {
    let result: PreparationItem[];
    if (view === "personalized") {
      const normalizedSearch = searchQuery.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "");
      result = timelineBucketOrder.flatMap((bucket) => timeline.data?.buckets[bucket] ?? [])
        .filter((item) => !normalizedSearch || item.nameKo.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s/g, "").includes(normalizedSearch))
        .map<PreparationItem>((item) => ({
          id: item.id,
          code: item.code,
          nameKo: item.nameKo,
          shortDescription: item.recommendationReason,
          targetSubject: timeline.data?.context.lifecycleAxis === "mother" ? "mother" : "child",
          necessity: item.necessity,
          recommendationState: item.safetyTier === "high" ? "professional_review_required" : "recommended",
          timingSummary: item.dueWindow.label,
          safetyTier: item.safetyTier,
          safetyNote: null,
          status: "in_review",
          primaryCategory: null,
          plan: item.plan,
          timelineBucket: item.bucket,
          dueWindowLabel: item.dueWindow.label,
          recommendationReason: item.recommendationReason
        }));
    } else {
      const rows = items.data?.pages.flatMap((page) => page.items) ?? [];
      result = view === "active"
        ? rows.filter((item) => activeStates.has(item.plan?.state ?? "not_considered"))
        : view === "mine"
          ? rows.filter((item) => mineStates.has(item.plan?.state ?? "not_considered"))
          : rows;
    }
    if (assignmentFilter !== "all") {
      result = result.filter((item) => assignmentFilter === "assigned" ? Boolean(item.plan?.assignedUserId) : !item.plan?.assignedUserId);
    }
    return result;
  }, [assignmentFilter, items.data?.pages, searchQuery, timeline.data, view]);
  const loadedItems = visibleItems;
  const plannedCount = loadedItems.filter((item) => activeStates.has(item.plan?.state ?? "not_considered")).length;
  const completedCount = loadedItems.filter((item) => ["owned", "borrowed", "rented", "gifted", "replaced"].includes(item.plan?.state ?? "")).length;
  const selectedBundle = bundles.data?.bundles.find((bundle) => bundle.id === selectedBundleId) ?? null;
  const selectedBundleItems = selectedBundle?.items.filter((item) => selectedBundleItemIds.includes(item.id)) ?? [];
  const selectedBundlePreparedCount = selectedBundleItems.filter((item) => mineStates.has(item.plan?.state ?? "not_considered")).length;
  const selectedBundleDuplicateCount = selectedBundleItems.filter((item) => ["ordered", "owned", "borrowed", "rented", "gift_expected", "gifted"].includes(item.plan?.state ?? "")).length;
  const preparationContextDirty = [...preparationContextDraft].sort().join("|") !== [...(preparationContext.data?.contextCodes ?? [])].sort().join("|");
  const weeklyItems = [
    ...(timeline.data?.buckets.overdue ?? []),
    ...(timeline.data?.buckets.this_week ?? []),
    ...(timeline.data?.buckets.this_month ?? [])
  ].slice(0, 5);

  const openSurface = (nextSurface: PreparationSurface) => {
    setSurface(nextSurface);
    setView(nextSurface === "search" ? "all" : "personalized");
    if (nextSurface !== "search") {
      setSearchDraft("");
      setSearchQuery("");
    }
  };

  const openListSearch = (query: string) => {
    setSearchDraft(query);
    setSearchQuery(query);
    setSearchReportMessage(null);
    setView("all");
    setSurface("list");
    addRecentSearch(query);
  };

  const closeListSearch = () => {
    setSearchDraft("");
    setSearchQuery("");
    setSearchReportMessage(null);
    setView("personalized");
  };

  const submitSearch = (value: string) => {
    const normalized = value.trim();
    setSearchDraft(normalized);
    setSearchQuery(normalized);
    setSearchReportMessage(null);
    if (normalized) addRecentSearch(normalized);
  };

  const resetFilters = () => {
    setView("all");
    setDomainCode(undefined);
    setAssignmentFilter("all");
    setSearchDraft("");
    setSearchQuery("");
    setSearchReportMessage(null);
  };

  const reportCurrentMissingItem = async () => {
    const requestedName = searchQuery.trim();
    if (!requestedName || !token) return;
    setSearchReportMessage("신고를 접수하고 있어요.");
    try {
      const result = await reportMissingCatalogItem(token, requestedName);
      setSearchReportMessage(result.idempotent ? "이미 접수된 신고가 있어요. 처리 결과를 알려드릴게요." : "없는 품목 신고를 접수했어요. 처리 결과를 알려드릴게요.");
    } catch {
      setSearchReportMessage("신고를 접수하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  };

  const chooseBundle = (bundleId: string) => {
    const bundle = bundles.data?.bundles.find((candidate) => candidate.id === bundleId);
    setSelectedBundleId(bundleId);
    setSelectedBundleItemIds(bundle?.items.map((item) => item.id) ?? []);
    setBundleMessage(null);
  };

  const toggleBundleItem = (itemId: string) => {
    setSelectedBundleItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  };

  const commitBundle = async (warningItemIds: string[] = []) => {
    if (!selectedBundle || !activeChildId) return;
    const entries = selectedBundle.items.filter((item) => selectedBundleItemIds.includes(item.id)).map((item) => ({
      itemId: item.id,
      state: "planned" as const,
      quantityNeeded: item.defaultQuantity ?? 1,
      expectedVersion: item.plan?.version
    }));
    setBundleWorking(true);
    try {
      const result = await applyCatalogBundle(token!, activeChildId, selectedBundle.id, { dryRun: false, items: entries, acknowledgeWarningItemIds: warningItemIds });
      setBundleMessage(`${result.appliedCount}개 품목을 준비함에 담았어요.`);
      await invalidatePreparationMutationQueries(queryClient, [activeContextKey!, activeChildId]);
    } catch {
      setBundleMessage("묶음을 적용하지 못했어요. 다른 기기의 변경을 확인해 주세요.");
    } finally {
      setBundleWorking(false);
    }
  };

  const previewAndApplyBundle = async () => {
    if (!selectedBundle || !activeChildId || selectedBundleItemIds.length === 0) return;
    const entries = selectedBundle.items.filter((item) => selectedBundleItemIds.includes(item.id)).map((item) => ({
      itemId: item.id,
      state: "planned" as const,
      quantityNeeded: item.defaultQuantity ?? 1,
      expectedVersion: item.plan?.version
    }));
    setBundleWorking(true);
    setBundleMessage(null);
    try {
      const preview = await applyCatalogBundle(token!, activeChildId, selectedBundle.id, { dryRun: true, items: entries });
      if (preview.warnings.length) {
        const warningItemIds = preview.warnings.map((warning) => warning.itemId);
        Alert.alert("중복 구매 가능성이 있어요", "이미 주문했거나 보유한 품목이 포함되어 있어요. 상태를 다시 계획으로 바꿀까요?", [
          { text: "취소", style: "cancel" },
          { text: "확인하고 적용", onPress: () => void commitBundle(warningItemIds) }
        ]);
      } else {
        await commitBundle();
      }
    } catch {
      setBundleMessage("묶음 미리보기를 만들지 못했어요.");
    } finally {
      setBundleWorking(false);
    }
  };

  if (!hasSession) return <Redirect href="/onboarding/child-status" />;

  const contextSelector = (
    <View accessibilityLabel="준비 대상을 선택하세요" style={{ gap: spacing.xs }}>
      <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "800" }}>누구의 준비인가요?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {(contexts.data?.motherProfiles ?? []).map((profile) => {
          const linkedChild = (children.data?.children ?? []).find((entry) => entry.id === profile.childId);
          const key = `mother:${profile.id}`;
          return <FilterChip key={key} label={`산모${linkedChild ? ` · ${linkedChild.nickname}` : ""}`} selected={activeContextKey === key} onPress={() => setContextKey(key)} />;
        })}
        {(children.data?.children ?? []).map((child) => {
          const key = `child:${child.id}`;
          return <FilterChip key={key} label={`아이 · ${child.nickname}`} selected={activeContextKey === key} onPress={() => { setContextKey(key); setSelectedChildId(child.id, child.householdId ?? null); }} />;
        })}
      </ScrollView>
    </View>
  );
  const listSelectedContextName = activeContextKey?.startsWith("child:")
    ? (children.data?.children.find((child) => `child:${child.id}` === activeContextKey)?.nickname ?? "선택된 아이")
    : "선택된 가족";
  if (surface === "overview") {
    return (
      <ScreenScaffold scrollRef={scrollRef} testID="release4-preparation-screen">
        {isTestSession ? <SampleDataBanner /> : null}
        <TopAppBar title="준비템" />
        {contextSelector}
        <PreparationProgressCard plannedCount={plannedCount} completedCount={completedCount} onPress={() => openSurface("list")} />
        <SafetyAlertSection
          alerts={(safetyAlerts.data?.alerts ?? []).filter((alert) => alert.state === "unread")}
          pending={acknowledgeSafety.isPending}
          alternativeAlertId={activeSafetyAlertId}
          alternatives={safetyAlternatives.data}
          alternativesPending={safetyAlternatives.isFetching}
          alternativesError={safetyAlternatives.isError}
          onAcknowledge={(alert) => acknowledgeSafety.mutate({ alertId: alert.id, expectedVersion: alert.version })}
          onShowAlternatives={(alert) => setActiveSafetyAlertId((current) => current === alert.id ? null : alert.id)}
          onRetryAlternatives={() => void safetyAlternatives.refetch()}
          onOpenAlternative={(itemId) => router.push({ pathname: "/items/[itemTemplateId]", params: { itemTemplateId: itemId, v: "2", contextType, contextId } })}
          onOpenEvidence={(url) => {
            void openPublicEvidenceUrl(url).catch(() => {
              Alert.alert("검증 근거를 열지 못했어요", "안전한 공개 HTTPS 주소인지 다시 확인해 주세요.");
            });
          }}
        />
        <WeeklyPreparationSection
          items={weeklyItems}
          loading={timeline.isLoading}
          error={timeline.isError}
          onRetry={() => void timeline.refetch()}
          onOpenList={() => openSurface("list")}
          onOpenItem={(item) => router.push({ pathname: "/items/[itemTemplateId]", params: { itemTemplateId: item.id, v: "2", contextType, contextId } })}
          onChangeState={(item, state) => updatePlan.mutate({ itemId: item.id, state, expectedVersion: item.plan?.version })}
        />
        <PreparationOverviewLinks
          onOpenList={() => openSurface("list")}
          onOpenSearch={() => openSurface("search")}
          onOpenBundles={() => openSurface("bundles")}
          onOpenSettings={() => openSurface("settings")}
        />
        <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scrollRef={scrollRef} testID="release4-preparation-screen">
      {isTestSession ? <SampleDataBanner /> : null}
      {surface !== "list" ? <Pressable
        accessibilityLabel="준비 홈으로 돌아가기"
        accessibilityRole="button"
        onPress={() => openSurface(surface === "search" ? "list" : "overview")}
        style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, minHeight: 48, paddingRight: 12 }}
      >
        <AppIcon color={semanticColors.actionPrimary} name="chevron-left" size={22} />
        <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>준비 홈</Text>
      </Pressable> : null}
      {surface !== "list" ? <PageHeader
        title={surface === "search" ? "준비물 검색" : surface === "bundles" ? "상황별 준비 묶음" : "가족 상황과 추천 설정"}
        subtitle={surface === "search" ? "품목명, 별칭과 초성으로 찾고 누락을 알려주세요." : surface === "bundles" ? "필요한 품목만 골라 기존 준비 상태에 안전하게 연결하세요." : "직접 선택한 가족 상황만 추천에 반영해요."}
      /> : null}

      {surface === "list" ? (
        <PreparationListParity
          error={view === "personalized" ? timeline.isError : items.isError}
          items={visibleItems}
          loading={view === "personalized" ? timeline.isLoading : items.isLoading}
          onBack={() => openSurface("overview")}
          onItemPress={(item) => {
            const preparationItem = visibleItems.find((candidate) => candidate.id === item.id);
            if (preparationItem) openStatusSheet(preparationItem);
          }}
          onMissingReport={() => openSurface("search")}
          onSearch={openListSearch}
          activeSearchQuery={searchQuery}
          onClearSearch={closeListSearch}
          onRetry={() => void (view === "personalized" ? timeline.refetch() : items.refetch())}
          selectedContextKey={activeContextKey}
          selectedContextName={listSelectedContextName}
        />
      ) : null}

      {surface === "bundles" && activeChildId ? (
        <SectionCard style={{ gap: spacing.sm }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
            <AppIcon color={semanticColors.actionPrimary} name="package-variant" size={24} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "900" }}>상황별 준비 묶음</Text>
              <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>필요한 품목만 선택해 기존 준비 상태에 연결해요.</Text>
            </View>
          </View>
          {bundles.isLoading ? <Text style={{ color: semanticColors.textSecondary }}>묶음을 불러오는 중...</Text> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {(bundles.data?.bundles ?? []).map((bundle) => <FilterChip key={bundle.id} label={`${bundle.nameKo} ${bundle.progress.percentage}%`} selected={selectedBundleId === bundle.id} onPress={() => chooseBundle(bundle.id)} />)}
            </ScrollView>
          )}
          {selectedBundle ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{selectedBundle.description}</Text>
              <View accessibilityLabel={`추가 선택 ${selectedBundleItemIds.length}개, 이미 준비 중 ${selectedBundlePreparedCount}개, 중복 가능 ${selectedBundleDuplicateCount}개`} style={{ backgroundColor: semanticColors.actionSecondary, borderRadius: 12, gap: 4, padding: 12 }}>
                <Text style={{ color: semanticColors.textPrimary, fontSize: 13, fontWeight: "900" }}>적용 전 변경 요약</Text>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>선택 {selectedBundleItemIds.length}개 · 이미 준비 중 {selectedBundlePreparedCount}개 · 중복 가능 {selectedBundleDuplicateCount}개</Text>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 11 }}>기존 상태는 미리보기와 확인 없이 덮어쓰지 않아요.</Text>
              </View>
              {selectedBundle.items.map((item) => {
                const selected = selectedBundleItemIds.includes(item.id);
                return (
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={item.id} onPress={() => toggleBundleItem(item.id)} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: 12 }}>
                    <AppIcon color={selected ? semanticColors.actionPrimary : semanticColors.textDisabled} name={selected ? "checkbox-marked" : "checkbox-blank-outline"} size={22} />
                    <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 13, fontWeight: "700" }}>{item.nameKo}</Text>
                    <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{planLabel(item.plan?.state)}</Text>
                  </Pressable>
                );
              })}
              <Pressable accessibilityRole="button" disabled={bundleWorking || selectedBundleItemIds.length === 0} onPress={() => void previewAndApplyBundle()} style={{ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 12, justifyContent: "center", minHeight: 48, opacity: bundleWorking ? 0.6 : 1 }}>
                <Text style={{ color: semanticColors.textInverse, fontSize: 14, fontWeight: "900" }}>{bundleWorking ? "확인 중..." : `선택 ${selectedBundleItemIds.length}개 준비함에 담기`}</Text>
              </Pressable>
              {bundleMessage ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{bundleMessage}</Text> : null}
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {surface !== "list" ? contextSelector : null}

      {surface === "settings" ? (
        <SectionCard style={{ gap: spacing.sm }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "900" }}>우리 가족 상황</Text>
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>
              직접 선택한 정보만 서버 추천 이유와 순위에 반영돼요. 상품·제휴 정보는 순위에 사용하지 않아요.
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {preparationContextOptions.map((option) => (
              <FilterChip
                key={option.code}
                label={option.label}
                selected={preparationContextDraft.includes(option.code)}
                onPress={() => togglePreparationContext(option.code)}
              />
            ))}
          </View>
          {(timeline.data?.context.derivedContextCodes.length ?? 0) > 0 ? (
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>
              출산예정일·생년월일에서 계절 조건을 자동 반영했어요: {timeline.data!.context.derivedContextCodes.map((code) => preparationContextOptions.find((option) => option.code === code)?.label ?? code).join(", ")}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !preparationContextDirty || savePreparationContext.isPending }}
            disabled={!preparationContextDirty || savePreparationContext.isPending}
            onPress={() => savePreparationContext.mutate()}
            style={{ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 12, justifyContent: "center", minHeight: 48, opacity: !preparationContextDirty || savePreparationContext.isPending ? 0.5 : 1 }}
          >
            <Text style={{ color: semanticColors.textInverse, fontSize: 14, fontWeight: "900" }}>
              {savePreparationContext.isPending ? "저장 중..." : "가족 상황 저장"}
            </Text>
          </Pressable>
          {preparationContextMessage ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{preparationContextMessage}</Text> : null}
        </SectionCard>
      ) : null}

      {surface === "search" ? (
        <>
      {surface === "search" ? <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <TextInput
          accessibilityLabel="준비 품목 검색"
          onChangeText={setSearchDraft}
          onSubmitEditing={() => submitSearch(searchDraft)}
          placeholder="품목·별칭 검색"
          placeholderTextColor={semanticColors.textDisabled}
          returnKeyType="search"
          style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 14, borderWidth: 1, color: semanticColors.textPrimary, flex: 1, minHeight: 48, paddingHorizontal: 14 }}
          value={searchDraft}
        />
        <Pressable
          accessibilityLabel="검색"
          accessibilityRole="button"
          onPress={() => submitSearch(searchDraft)}
          style={{ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 14, justifyContent: "center", width: 48 }}
        >
          <AppIcon color={semanticColors.textInverse} name="magnify" size={22} />
        </Pressable>
      </View> : null}

      {surface === "search" && recentSearches.length > 0 && !searchQuery ? (
        <View accessibilityLabel="최근 검색" style={{ gap: spacing.xs }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>최근 검색</Text>
            <Pressable accessibilityRole="button" onPress={clearRecentSearches} style={{ justifyContent: "center", minHeight: 48, paddingHorizontal: 8 }}>
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>모두 지우기</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {recentSearches.map((query) => <FilterChip key={query} label={query} selected={false} onPress={() => submitSearch(query)} />)}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        <FilterChip label="모든 영역" selected={!domainCode} onPress={() => setDomainCode(undefined)} />
        {(domains.data?.domains ?? []).map((domain) => (
          <FilterChip key={domain.code} label={domain.nameKo} selected={domainCode === domain.code} onPress={() => setDomainCode(domain.code)} />
        ))}
      </ScrollView>

      {(searchQuery || domainCode || view !== "all" || assignmentFilter !== "all") ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textSecondary, flex: 1, fontSize: 12 }}>
            {searchQuery ? `검색어 '${searchQuery}' · ` : ""}
            {domainCode ? `분류 ${domains.data?.domains.find((domain) => domain.code === domainCode)?.nameKo ?? "선택됨"} · ` : ""}
            {assignmentFilter === "assigned" ? "담당 지정 · " : assignmentFilter === "unassigned" ? "담당 미정 · " : ""}
            {views.find((entry) => entry.value === view)?.label}
          </Text>
          <Pressable accessibilityRole="button" onPress={resetFilters} style={{ alignItems: "center", justifyContent: "center", minHeight: 48, paddingHorizontal: 8 }}>
            <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>필터 초기화</Text>
          </Pressable>
        </View>
      ) : null}

      {(view === "personalized" ? timeline.isLoading : items.isLoading) ? (
        <EmptyStateCard title="준비 품목을 불러오고 있어요." actionLabel="잠시만요" />
      ) : (view === "personalized" ? timeline.isError : items.isError) ? (
        <EmptyStateCard title="준비 품목을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => void (view === "personalized" ? timeline.refetch() : items.refetch())} />
      ) : visibleItems.length === 0 ? (
        <EmptyStateCard
          title={searchQuery ? `'${searchQuery}' 검색 결과가 없어요.` : (view === "active" || view === "mine" ? "아직 이 상태로 정한 품목이 없어요." : "조건에 맞는 준비 품목이 없어요.")}
          description={searchQuery ? "찾는 품목이 카탈로그에 없으면 운영팀에 알려주세요." : undefined}
          actionLabel={searchQuery ? "없는 품목 신고" : "전체 보기"}
          onPress={searchQuery ? () => void reportCurrentMissingItem() : resetFilters}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View accessibilityLabel={`${width >= 600 ? 4 : 3}열 준비 품목`} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {visibleItems.map((item) => {
              const visual = resolvePreparationItemVisual(item);
              return (
                <View key={item.id} style={{ width: compactGridItemWidth(compactColumns) }}>
                  <PreparationItemCard
                    hint={item.timelineBucket ? `${timelineBucketLabel(item.timelineBucket)} · ${item.dueWindowLabel}` : item.primaryCategory?.nameKo}
                    icon={visual.icon}
                    iconBackgroundColor={visual.iconBackgroundColor}
                    iconColor={visual.iconColor}
                    onPress={() => openStatusSheet(item)}
                    status={item.plan?.state}
                    title={item.nameKo}
                  />
                </View>
              );
            })}
          </View>
          {view !== "personalized" && items.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              disabled={items.isFetchingNextPage}
              onPress={() => void items.fetchNextPage()}
              style={{ alignItems: "center", backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 14, borderWidth: 1, minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 14, fontWeight: "800" }}>{items.isFetchingNextPage ? "불러오는 중" : "품목 더 보기"}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {searchReportMessage ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{searchReportMessage}</Text> : null}
        </>
      ) : null}
      <BottomSheet
        description="준비 상태를 바꾸면 목록, 홈 넛지와 관련 리포트에 바로 반영돼요."
        onClose={closeStatusSheet}
        title={statusItem?.nameKo ?? "준비 상태"}
        visible={Boolean(statusItem)}
      >
        <ItemStatusControl disabled={updatePlan.isPending} onChange={(state) => setStatusDraft(state)} value={statusDraft} />
        {updatePlan.isError ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.danger, fontSize: 12 }}>완료하지 못했어요. 입력은 보존되었으니 다시 시도해 주세요.</Text> : null}
        <PrimaryButton
          busy={updatePlan.isPending}
          disabled={!statusItem || !statusChanged}
          label={updatePlan.isPending ? "저장하는 중" : statusChanged ? "준비 상태 저장" : "변경 없음"}
          onPress={() => statusItem && updatePlan.mutate({ itemId: statusItem.id, state: statusDraft, expectedVersion: statusItem.plan?.version })}
        />
        <SecondaryButton
          disabled={!statusItem || updatePlan.isPending}
          label="상세 · 구매 정보 보기"
          onPress={openStatusItemDetail}
        />
      </BottomSheet>
      <SyncStatusBar onPress={() => router.push("/sync-status" as Href)} status={syncStatus} />
    </ScreenScaffold>
  );
}
