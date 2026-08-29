import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Keyboard, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import type { CatalogPlanState, CatalogTimelineBucket } from "./catalog-contract";
import {
  AppIcon,
  EmptyStateCard,
  PreparationItemCard,
  TopAppBar,
  semanticColors,
  spacing,
  type AppIconName
} from "../design-system";
import { resolvePreparationItemVisual } from "./item-visuals";
import { pendingSearchSubmission, shouldSyncSearchDraft } from "./search-draft";
import { resolvePreparationDisplayGroupId, type PreparationDisplayGroupId } from "./preparation-grouping";
import { compactGridColumnCount, compactGridItemWidth } from "../design-system/responsive";

export type PreparationParityItem = {
  id: string;
  code: string;
  nameKo: string;
  timelineBucket?: CatalogTimelineBucket;
  dueWindowLabel?: string;
  plan?: { state: CatalogPlanState; dueDate?: string | null } | null;
  /**
   * DSN-053 P2-B: 분류 섹션을 **호출부가 정한 분류 축**으로 그릴 때 그 그룹 id.
   * `categoryGroups`를 넘기지 않으면 이 값은 쓰이지 않고 원본의 10그룹 라우팅
   * (`resolvePreparationDisplayGroupId`)이 그대로 돈다.
   */
  groupId?: string;
};

/**
 * DSN-053 P2-B — 분류 섹션 카드의 그룹 정의. 원본(c20deeb)은 카탈로그 도메인 코드
 * (`R4-C10-001`)로 10그룹을 라우팅했는데, 현재 준비템 계약에는 그 코드가 없다
 * (`ItemSummary`에 있는 분류 축은 지출 분류 `categoryId` 하나뿐이다). 그래서 그룹 목록을
 * 호출부가 넘길 수 있게 열어 둔다 — 원본 로직은 기본값으로 그대로 남는다.
 */
export type PreparationCategoryGroup = {
  id: string;
  name: string;
  icon: AppIconName;
  tint: string;
  color: string;
};

/**
 * DSN-053 P2-B — 진행률 히어로가 그릴 수치. 넘기지 않으면 원본대로 `items`에서 직접 센다.
 *
 * 준비템 탭은 이 값을 넘긴다: 화면에 이미 **정직하게 계산된** 준비율이 있고
 * (src/items/prep-progress.ts + prep-milestones.ts — 분모는 지금 시기 필수템, 표시 퍼센트는
 * 개수 판정에 맞춘 캡을 거친 값), 프레임만 승인 디자인으로 바뀌는 것이기 때문이다.
 */
export type PreparationProgressSummary = {
  totalCount: number;
  completedCount: number;
  /** 이미 캡(prepDisplayPercent)을 거친 0-100 정수. 이 컴포넌트는 다시 계산하지 않는다. */
  displayPercent: number;
  /**
   * 개수 줄을 대신할 한 문장. 없으면 승인 카피("N개 중 M개 완료")를 그대로 쓴다.
   *
   * 준비템 탭이 이 값을 넘기는 이유: 그 화면의 분모는 **지금 시기 필수템**이라, 목록에 수십
   * 개가 보이는 동안 "8개 중 6개 완료"만 적으면 무엇을 센 숫자인지 알 수 없다. 모듈이 만든
   * 문장은 그 범위를 함께 말한다(src/items/prep-milestones.ts headline).
   */
  summaryText?: string;
  accessibilityLabel: string;
  /** 바 아래 한 줄(구간 문구). */
  detailText: string;
};

type SortMode = "category" | "timing";

const completedStates = new Set<CatalogPlanState>(["owned", "borrowed", "rented", "gifted", "replaced"]);
const excludedStates = new Set<CatalogPlanState>(["not_needed", "retired", "ended"]);
const INITIAL_GROUP_LIMIT = 5;

export function nextPreparationGroupLimit(current: number, total: number) {
  if (current < 10) return Math.min(10, total);
  if (current < 20) return Math.min(20, total);
  if (current < 40) return Math.min(40, total);
  return total;
}

const displayGroups: ReadonlyArray<{
  id: PreparationDisplayGroupId;
  name: string;
  icon: AppIconName;
  tint: string;
  color: string;
}> = [
  { id: "health_care", name: "건강·진료", icon: "heart-pulse", tint: "#FFF0EC", color: "#C54A2C" },
  { id: "clothing", name: "의류·착용", icon: "tshirt-crew-outline", tint: "#FFF0F4", color: "#B8476C" },
  { id: "comfort_recovery", name: "편안함·회복", icon: "sleep", tint: "#EEE9FF", color: "#7157A8" },
  { id: "hygiene_bath", name: "위생·목욕", icon: "bathtub-outline", tint: "#E5F7F2", color: "#147A66" },
  { id: "hospital_birth", name: "입원·출산", icon: "bag-suitcase-outline", tint: "#EAF3FF", color: "#2866A3" },
  { id: "feeding", name: "수유·이유식", icon: "baby-bottle-outline", tint: "#FFF6DD", color: "#A86400" },
  { id: "sleep_home", name: "수면·공간", icon: "bed-outline", tint: "#F1EDFF", color: "#6553A3" },
  { id: "diaper_daily", name: "기저귀·생활", icon: "human-baby-changing-table", tint: "#EAF8F4", color: "#19735F" },
  { id: "outing_growth", name: "외출·놀이·교육", icon: "baby-carriage", tint: "#EEF5FF", color: "#3268A8" },
  { id: "family_records", name: "가족·기록", icon: "account-group-outline", tint: "#F7F1EA", color: "#8A5A2B" }
];

const timingBands: ReadonlyArray<{
  id: string;
  name: string;
  subtitle: string;
  buckets: readonly CatalogTimelineBucket[];
  icon: AppIconName;
  tint: string;
  color: string;
}> = [
  { id: "now", name: "지금 준비해요", subtitle: "이번 주에 확인해요", buckets: ["overdue", "this_week"], icon: "alarm", tint: "#FFF0EC", color: semanticColors.actionPrimary },
  { id: "soon", name: "곧 필요해요", subtitle: "이번 달에 준비해요", buckets: ["this_month"], icon: "clock-outline", tint: "#E5F7F2", color: semanticColors.brandSecondary },
  { id: "later", name: "여유 있게 준비해요", subtitle: "다음 성장 단계를 살펴봐요", buckets: ["next_stage"], icon: "calendar-blank-outline", tint: "#FFF6DD", color: semanticColors.warning },
  { id: "finished", name: "정리된 품목", subtitle: "준비 완료와 제외한 품목을 모았어요", buckets: ["completed", "not_needed"], icon: "check-circle-outline", tint: semanticColors.successSurface, color: semanticColors.success }
];

function SegmentedControl({ value, onChange }: { value: SortMode; onChange: (value: SortMode) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ backgroundColor: semanticColors.surfaceMuted, borderRadius: 14, flexDirection: "row", padding: 4 }}>
      {(["category", "timing"] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: selected ? semanticColors.surface : "transparent",
              borderRadius: 11,
              flex: 1,
              justifyContent: "center",
              minHeight: 48,
              opacity: pressed ? 0.76 : 1
            })}
          >
            <Text style={{ color: selected ? semanticColors.textPrimary : semanticColors.textSecondary, fontSize: 14, fontWeight: selected ? "800" : "600" }}>
              {option === "category" ? "분류별" : "시기별"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ItemGrid({
  items,
  columns,
  onItemPress,
  renderItemFooter
}: {
  items: PreparationParityItem[];
  columns: number;
  onItemPress: (item: PreparationParityItem) => void;
  renderItemFooter?: (item: PreparationParityItem) => ReactNode;
}) {
  return (
    <View accessibilityLabel={`${columns}열 준비 품목`} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {items.map((item) => {
        const visual = resolvePreparationItemVisual({ code: item.code, nameKo: item.nameKo, primaryCategory: null });
        return (
          <View key={item.id} style={{ gap: spacing.xxs, width: compactGridItemWidth(columns) }}>
            <PreparationItemCard
              hint={item.dueWindowLabel}
              icon={visual.icon}
              iconBackgroundColor={visual.iconBackgroundColor}
              iconColor={visual.iconColor}
              onPress={() => onItemPress(item)}
              status={item.plan?.state}
              title={item.nameKo}
            />
            {/* DSN-053 P2-B: 타일 아래 슬롯. 준비템 탭은 여기에 오프라인 대기 배지와 상태
                변경(준비했어요/괜찮아요)·"지출도 기록할까요?" 한 줄을 그린다 — 타일 자체는
                승인 디자인 그대로 두고(디자인 시스템 컴포넌트는 읽기 전용) 기존 기능이
                제자리를 잃지 않게 한다. 넘기지 않으면 원본 렌더 그대로다. */}
            {renderItemFooter ? renderItemFooter(item) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * 라운드 72 트랙 E — **죽은 프롭 셋을 걷었다.**
 *
 * 이식본에는 `loading` · `error`(+ 그 가지가 쓰던 `onRetry`) · `onMissingReport`가 남아 있었는데
 * 이 저장소의 **유일한 호출부**(`app/(tabs)/items.tsx`)는 그중 무엇도 넘기지 않았다. 즉 그 넷이
 * 여는 네 가지 — 로딩 카드 · 조회 실패 카드 · 검색 0건의 신고 갈래 · 목록 아래 누락 신고 줄 —
 * 은 **한 번도 렌더된 적이 없다**. 라운드 71 E가 그중 가짜 버튼 하나에 `onPress`를 달아 준 것도
 * 그 죽은 가지 안에서였다.
 *
 * 걷어도 화면은 **한 픽셀도 바뀌지 않는다**(호출부 0건이므로 도달 불가였다). 조회 로딩·실패는
 * 이 컴포넌트 밖 화면이 이미 자기 방식으로 말하고 있고(준비템 탭의 스켈레톤·조회 실패 카드),
 * 다시 시도는 화면의 당겨서 새로고침이 지고 있다.
 *
 * ⚠️ 살아 있는 가지는 전부 그대로다 — 진행률 히어로 · 세그먼트 · 검색 · 분류 섹션 · 시기 밴드 ·
 * 검색 0건("검색 지우기") · 그룹 0건 폴백. DSN-053 이식본이라 그 렌더는 **승인 디자인**이고,
 * 바꾸려면 디자인 변경 승인이 먼저다.
 */
export function PreparationListParity({
  items,
  selectedContextKey,
  selectedContextName,
  onBack,
  onItemPress,
  onSearch,
  activeSearchQuery = "",
  onClearSearch = () => undefined,
  categoryGroups,
  minimumGroupSize = INITIAL_GROUP_LIMIT,
  progress,
  topBarTrailing,
  beforeSegment,
  auxiliaryFilters,
  notices,
  emptyState,
  renderItemFooter
}: {
  items: PreparationParityItem[];
  selectedContextKey: string | null;
  selectedContextName: string;
  onBack: () => void;
  onItemPress: (item: PreparationParityItem) => void;
  onSearch: (query: string) => void;
  activeSearchQuery?: string;
  onClearSearch?: () => void;
  /** 분류 축을 호출부가 정할 때의 그룹 목록. 없으면 원본 10그룹. */
  categoryGroups?: readonly PreparationCategoryGroup[];
  /** 이 개수 미만인 그룹/밴드는 그리지 않는다(원본 기본값 5). */
  minimumGroupSize?: number;
  /** 진행률 히어로가 그릴 수치. 없으면 `items`에서 직접 센다(원본 동작). */
  progress?: PreparationProgressSummary | null;
  /** TopAppBar 우측 슬롯(준비템 탭은 아이 전환 입구를 둔다). */
  topBarTrailing?: ReactNode;
  /** 히어로와 세그먼트 사이 한 줄(스펙 §통합 지점의 찜 칩 자리). */
  beforeSegment?: ReactNode;
  /**
   * 세그먼트 바로 아래 보조 칩 줄(준비템 탭은 시기 밴드·필수도·출산 전 칩을 둔다).
   *
   * 스펙(§통합 지점)은 이 칩들을 "시기별 보조 칩"으로 격하하라고 하지만, **분류별에서도
   * 보이게** 둔다: 필수도·출산 전은 목록 자체를 좁히는 조건이라 세그먼트를 바꿨다고 적용이
   * 멈추지 않는다. 켜져 있는 좁히기를 화면에서 감추면 "왜 이 품목이 안 보이지"가 된다.
   */
  auxiliaryFilters?: ReactNode;
  /** 검색 아래, 목록 위 안내 슬롯(축하 배너·저장 실패 배너 등). */
  notices?: ReactNode;
  /** 그릴 그룹이 하나도 없을 때 원본 카드 대신 쓸 노드. */
  emptyState?: ReactNode;
  /** 타일 아래 슬롯. */
  renderItemFooter?: (item: PreparationParityItem) => ReactNode;
}) {
  const { fontScale, width } = useWindowDimensions();
  const columns = compactGridColumnCount(width, fontScale);
  const [sortMode, setSortMode] = useState<SortMode>("category");
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTimingBands, setExpandedTimingBands] = useState<Set<string>>(new Set(["now"]));
  const [groupLimits, setGroupLimits] = useState<Record<string, number>>({});
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchDraft, setSearchDraft] = useState("");
  const autoExpandedContext = useRef<string | null | undefined>(undefined);
  const submittedSearch = useRef("");

  const categories = useMemo(() => (categoryGroups ?? displayGroups)
    .map((group) => ({
      ...group,
      items: items.filter((item) =>
        (categoryGroups ? item.groupId : resolvePreparationDisplayGroupId(item)) === group.id
      )
    }))
    .filter((group) => group.items.length > 0 && group.items.length >= minimumGroupSize), [categoryGroups, items, minimumGroupSize]);
  const populatedTimingBands = useMemo(() => timingBands
    .map((band) => ({
      ...band,
      items: items.filter((item) => item.timelineBucket && band.buckets.includes(item.timelineBucket))
    }))
    .filter((band) => band.items.length > 0 && band.items.length >= minimumGroupSize), [items, minimumGroupSize]);

  useEffect(() => {
    const firstPopulatedCategory = categories.find((group) => group.items.length > 0);
    if (!firstPopulatedCategory || autoExpandedContext.current === selectedContextKey) return;
    autoExpandedContext.current = selectedContextKey;
    setExpandedGroups(new Set([firstPopulatedCategory.id]));
  }, [categories, selectedContextKey]);

  /**
   * 입력 디바운스. **빈 문자열도 하나의 검색어**다.
   *
   * 예전에는 `if (!query …) return`이라 입력칸을 다 지워도 `onSearch("")`가 나가지 않았다 --
   * 사용자는 검색어를 지웠는데 목록은 계속 걸러진 상태로 남아, 화면이 말하는 것과 입력칸이
   * 말하는 것이 어긋났다. 지금은 "직전에 보낸 검색어가 있었는데 지금 비었다"면 그 사실도
   * 그대로 보낸다. 처음부터 비어 있던 경우(둘 다 "")는 보낼 변화가 없으므로 그대로 넘어간다.
   */
  useEffect(() => {
    const query = pendingSearchSubmission(searchDraft, submittedSearch.current);
    if (query === null) return;
    const timer = setTimeout(() => {
      submittedSearch.current = query;
      onSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [onSearch, searchDraft]);

  /**
   * 밖에서 검색어가 바뀌면(예: "필터 초기화") 입력칸도 따라간다.
   *
   * 예전 조건은 `activeSearchQuery &&`라 **빈 값으로 초기화될 때만** 동기화를 건너뛰었다 --
   * 초기화 버튼을 눌러 목록은 전체로 돌아왔는데 입력칸에는 옛 검색어가 그대로 남아, 그 글자가
   * 지금 걸려 있는 필터라고 읽혔다. `submittedSearch`도 함께 맞춰 위 디바운스가 방금 반영된
   * 값을 되돌려 보내지 않게 한다.
   */
  useEffect(() => {
    setSearchLimit(20);
    if (shouldSyncSearchDraft(searchDraft, activeSearchQuery)) {
      submittedSearch.current = activeSearchQuery;
      setSearchDraft(activeSearchQuery);
    }
  }, [activeSearchQuery]);

  const trackedItems = items.filter((item) => item.plan && !excludedStates.has(item.plan.state));
  const completedItems = trackedItems.filter((item) => item.plan?.state && completedStates.has(item.plan.state));
  const plannedItems = trackedItems.filter((item) => !item.plan?.state || !completedStates.has(item.plan.state));
  // 히어로가 그릴 수치. `progress`가 오면 그 값이 유일한 근거다 -- 화면이 이미 정직하게 센 값을
  // 여기서 다시 세면 두 수치가 조용히 갈린다(같은 화면 안에서 서로를 부정하는 숫자 금지).
  const totalCount = progress ? progress.totalCount : trackedItems.length;
  const completedCount = progress ? progress.completedCount : completedItems.length;
  const progressPercent = progress
    ? progress.displayPercent
    : trackedItems.length
      ? Math.round((completedItems.length / trackedItems.length) * 100)
      : 0;
  const displayedItems = items;

  const toggleGroup = (id: string) => setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleTimingBand = (id: string) => setExpandedTimingBands((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const submitSearch = () => {
    const query = searchDraft.trim();
    if (!query) return;
    Keyboard.dismiss();
    submittedSearch.current = query;
    onSearch(query);
  };

  return (
    <View accessibilityLabel={`ITEM-001 내 준비 목록, 선택된 아이 ${selectedContextName}`} style={{ gap: 14 }}>
      <TopAppBar eyebrow="준비 홈" onBack={onBack} title="내 준비 목록" trailing={topBarTrailing} />

      <Pressable
        accessibilityHint="준비 상태별 품목을 펼치거나 접어요."
        accessibilityLabel={progress ? progress.accessibilityLabel : `나의 준비 진행률, ${totalCount}개 중 ${completedCount}개 완료`}
        accessibilityRole="button"
        accessibilityState={{ expanded: progressExpanded }}
        onPress={() => setProgressExpanded((value) => !value)}
        style={({ pressed }) => ({ backgroundColor: semanticColors.actionPrimary, borderRadius: 16, gap: 12, opacity: pressed ? 0.88 : 1, padding: 18 })}
      >
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: semanticColors.textInverse, fontSize: 15, fontWeight: "800" }}>나의 준비 진행률</Text>
            {/* opacity를 걷어냈다: actionPrimary 위 흰 12px에 0.88을 곱하면 약 3.9:1로 WCAG AA
                소형 텍스트 기준(4.5:1)에 못 미친다. 불투명한 흰색은 4.76:1이다. */}
            <Text style={{ color: semanticColors.textInverse, fontSize: 12 }}>
              {progress?.summaryText ?? (totalCount ? `${totalCount}개 중 ${completedCount}개 완료` : "아직 준비 상태를 정한 품목이 없어요")}
            </Text>
          </View>
          <AppIcon color={semanticColors.textInverse} name={progressExpanded ? "chevron-up" : "chevron-down"} size={24} />
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progressPercent }} style={{ backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 999, height: 9, overflow: "hidden" }}>
          <View style={{ backgroundColor: semanticColors.textInverse, borderRadius: 999, height: 9, width: `${progressPercent}%` }} />
        </View>
        {progressExpanded ? (
          <View style={{ borderTopColor: "rgba(255,255,255,0.28)", borderTopWidth: 1, gap: 8, paddingTop: 12 }}>
            {/* 접힌 히어로를 펼치면 지금 어디까지 왔는지 한 줄 + 이름 몇 개. 수치를 호출부가
                넘겨 준 경우에는 그 구간 문구를 쓴다 -- 여기서 개수를 다시 세면 바로 위 줄과
                분모가 다른 두 숫자가 한 카드 안에 함께 서게 된다. */}
            <Text style={{ color: semanticColors.textInverse, fontSize: 13, fontWeight: "800" }}>
              {progress ? progress.detailText : `준비 중 ${plannedItems.length}개 · 완료 ${completedItems.length}개`}
            </Text>
            {plannedItems.slice(0, 4).map((item) => <Text key={`planned-${item.id}`} style={{ color: semanticColors.textInverse, fontSize: 12 }}>• 준비 중 · {item.nameKo}</Text>)}
            {completedItems.slice(0, 4).map((item) => <Text key={`completed-${item.id}`} style={{ color: semanticColors.textInverse, fontSize: 12 }}>• 완료 · {item.nameKo}</Text>)}
          </View>
        ) : null}
      </Pressable>

      {beforeSegment}

      <SegmentedControl onChange={setSortMode} value={sortMode} />

      {auxiliaryFilters}

      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
        <TextInput
          accessibilityLabel="준비물 통합 검색"
          onChangeText={setSearchDraft}
          onSubmitEditing={submitSearch}
          placeholder="품목명·별칭·분류 검색"
          placeholderTextColor={semanticColors.textDisabled}
          returnKeyType="search"
          style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 14, borderWidth: 1, color: semanticColors.textPrimary, flex: 1, minHeight: 48, paddingHorizontal: 14 }}
          value={searchDraft}
        />
        <Pressable accessibilityLabel="준비물 검색 실행" accessibilityRole="button" hitSlop={6} onPress={submitSearch} style={({ pressed }) => ({ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 14, height: 48, justifyContent: "center", opacity: pressed ? 0.76 : 1, width: 48 })}>
          <AppIcon color={semanticColors.textInverse} name="magnify" size={23} />
        </Pressable>
      </View>

      {notices}

      {activeSearchQuery ? (
        <View style={{ gap: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 14, fontWeight: "800" }}>
              ‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개
            </Text>
            <Pressable accessibilityLabel="준비물 검색 닫기" accessibilityRole="button" onPress={() => {
              Keyboard.dismiss();
              setSearchDraft("");
              submittedSearch.current = "";
              onClearSearch();
            }} style={({ pressed }) => ({ justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1, paddingHorizontal: 8 })}>
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>검색 닫기</Text>
            </Pressable>
          </View>
          {displayedItems.length ? (
            <>
              <ItemGrid columns={columns} items={displayedItems.slice(0, searchLimit)} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />
              {searchLimit < displayedItems.length ? (
                <Pressable accessibilityRole="button" onPress={() => setSearchLimit((current) => Math.min(displayedItems.length, current * 2))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                  <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>검색 결과 더 보기 ({Math.min(searchLimit, displayedItems.length)}/{displayedItems.length})</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <EmptyStateCard actionLabel="검색 지우기" onPress={onClearSearch} title="검색 결과가 없어요." />
          )}
        </View>
      ) : displayedItems.length === 0 || (sortMode === "category" ? categories.length === 0 : populatedTimingBands.length === 0) ? (
        emptyState ?? <EmptyStateCard actionLabel="준비 홈" onPress={onBack} title="5개 이상 확인된 준비 품목 그룹이 없어요." />
      ) : sortMode === "category" ? (
        <View style={{ gap: 12 }}>
          {categories.map((group) => {
            const groupItems = group.items;
            const done = group.items.filter((item) => item.plan?.state && completedStates.has(item.plan.state)).length;
            const percentage = group.items.length ? Math.round((done / group.items.length) * 100) : 0;
            const expanded = expandedGroups.has(group.id);
            const limit = groupLimits[group.id] ?? INITIAL_GROUP_LIMIT;
            const visibleGroupItems = groupItems.slice(0, limit);
            return (
              <View key={group.id} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggleGroup(group.id)}
                  style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, opacity: pressed ? 0.76 : 1, padding: 14 })}
                >
                  <View style={{ alignItems: "center", backgroundColor: group.tint, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
                    <AppIcon color={group.color} name={group.icon} size={21} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ alignItems: "baseline", flexDirection: "row", gap: 7 }}>
                      <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "800" }}>{group.name}</Text>
                      <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{done}/{group.items.length} 보유</Text>
                    </View>
                    <View style={{ backgroundColor: "#F5E8DF", borderRadius: 999, height: 5, overflow: "hidden" }}>
                      <View style={{ backgroundColor: semanticColors.brandSecondary, borderRadius: 999, height: 5, width: `${percentage}%` }} />
                    </View>
                  </View>
                  <AppIcon color={semanticColors.textDisabled} name={expanded ? "chevron-up" : "chevron-down"} size={24} />
                </Pressable>
                {expanded ? (
                  <View style={{ gap: 8, paddingBottom: 14, paddingHorizontal: 14 }}>
                    <ItemGrid columns={columns} items={visibleGroupItems} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />
                    {visibleGroupItems.length < groupItems.length ? (
                      <Pressable accessibilityRole="button" onPress={() => setGroupLimits((current) => ({ ...current, [group.id]: nextPreparationGroupLimit(limit, groupItems.length) }))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                        <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>더 보기 ({visibleGroupItems.length}/{groupItems.length} · {groupItems.length - visibleGroupItems.length}개 남음)</Text>
                      </Pressable>
                    ) : null}
                    {limit > INITIAL_GROUP_LIMIT ? (
                      <Pressable accessibilityRole="button" onPress={() => setGroupLimits((current) => ({ ...current, [group.id]: INITIAL_GROUP_LIMIT }))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                        <Text style={{ color: semanticColors.textSecondary, fontSize: 13, fontWeight: "800" }}>5개로 접기</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {populatedTimingBands.map((band) => {
            const bandItems = band.items;
            const expanded = expandedTimingBands.has(band.id);
            const limitKey = `timing:${band.id}`;
            const limit = groupLimits[limitKey] ?? INITIAL_GROUP_LIMIT;
            const visibleBandItems = bandItems.slice(0, limit);
            return (
              <View key={band.id} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggleTimingBand(band.id)}
                  style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 72, opacity: pressed ? 0.76 : 1, padding: 14 })}
                >
                  <View style={{ alignItems: "center", backgroundColor: band.tint, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
                    <AppIcon color={band.color} name={band.icon} size={20} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ alignItems: "baseline", flexDirection: "row", gap: 7 }}>
                      <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "800" }}>{band.name}</Text>
                      <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{bandItems.length}개</Text>
                    </View>
                    <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{band.subtitle}</Text>
                  </View>
                  <AppIcon color={semanticColors.textDisabled} name={expanded ? "chevron-up" : "chevron-down"} size={24} />
                </Pressable>
                {expanded ? (
                  <View style={{ gap: 8, paddingBottom: 14, paddingHorizontal: 14 }}>
                    <ItemGrid columns={columns} items={visibleBandItems} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />
                    {visibleBandItems.length < bandItems.length ? (
                      <Pressable accessibilityRole="button" onPress={() => setGroupLimits((current) => ({ ...current, [limitKey]: nextPreparationGroupLimit(limit, bandItems.length) }))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                        <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>더 보기 ({visibleBandItems.length}/{bandItems.length} · {bandItems.length - visibleBandItems.length}개 남음)</Text>
                      </Pressable>
                    ) : null}
                    {limit > INITIAL_GROUP_LIMIT ? (
                      <Pressable accessibilityRole="button" onPress={() => setGroupLimits((current) => ({ ...current, [limitKey]: INITIAL_GROUP_LIMIT }))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                        <Text style={{ color: semanticColors.textSecondary, fontSize: 13, fontWeight: "800" }}>5개로 접기</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

    </View>
  );
}
