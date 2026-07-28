import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { CatalogPlanState, CatalogTimelineBucket } from "../api/client";
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
import { resolvePreparationDisplayGroupId, type PreparationDisplayGroupId } from "./preparation-grouping";

export type PreparationParityItem = {
  id: string;
  code: string;
  nameKo: string;
  timelineBucket?: CatalogTimelineBucket;
  dueWindowLabel?: string;
  plan?: { state: CatalogPlanState; dueDate?: string | null } | null;
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

function ItemGrid({ items, columns, onItemPress }: { items: PreparationParityItem[]; columns: number; onItemPress: (item: PreparationParityItem) => void }) {
  return (
    <View accessibilityLabel={`${columns}열 준비 품목`} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {items.map((item) => {
        const visual = resolvePreparationItemVisual({ code: item.code, nameKo: item.nameKo, primaryCategory: null });
        return (
          <View key={item.id} style={{ width: columns === 4 ? "23.4%" : "31.4%" }}>
            <PreparationItemCard
              hint={item.dueWindowLabel}
              icon={visual.icon}
              iconBackgroundColor={visual.iconBackgroundColor}
              iconColor={visual.iconColor}
              onPress={() => onItemPress(item)}
              status={item.plan?.state}
              title={item.nameKo}
            />
          </View>
        );
      })}
    </View>
  );
}

export function PreparationListParity({
  items,
  selectedContextKey,
  selectedContextName,
  loading = false,
  error = false,
  onBack,
  onRetry,
  onItemPress,
  onMissingReport,
  onSearch,
  activeSearchQuery = "",
  onClearSearch = () => undefined
}: {
  items: PreparationParityItem[];
  selectedContextKey: string | null;
  selectedContextName: string;
  loading?: boolean;
  error?: boolean;
  onBack: () => void;
  onRetry: () => void;
  onItemPress: (item: PreparationParityItem) => void;
  onMissingReport: () => void;
  onSearch: (query: string) => void;
  activeSearchQuery?: string;
  onClearSearch?: () => void;
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 3;
  const [sortMode, setSortMode] = useState<SortMode>("category");
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTimingBands, setExpandedTimingBands] = useState<Set<string>>(new Set(["now"]));
  const [groupLimits, setGroupLimits] = useState<Record<string, number>>({});
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchDraft, setSearchDraft] = useState("");
  const autoExpandedContext = useRef<string | null | undefined>(undefined);
  const submittedSearch = useRef("");

  const categories = useMemo(() => displayGroups
    .map((group) => ({
      ...group,
      items: items.filter((item) => resolvePreparationDisplayGroupId(item) === group.id)
    }))
    .filter((group) => group.items.length >= INITIAL_GROUP_LIMIT), [items]);
  const populatedTimingBands = useMemo(() => timingBands
    .map((band) => ({
      ...band,
      items: items.filter((item) => item.timelineBucket && band.buckets.includes(item.timelineBucket))
    }))
    .filter((band) => band.items.length >= INITIAL_GROUP_LIMIT), [items]);

  useEffect(() => {
    const firstPopulatedCategory = categories.find((group) => group.items.length > 0);
    if (!firstPopulatedCategory || autoExpandedContext.current === selectedContextKey) return;
    autoExpandedContext.current = selectedContextKey;
    setExpandedGroups(new Set([firstPopulatedCategory.id]));
  }, [categories, selectedContextKey]);

  useEffect(() => {
    const query = searchDraft.trim();
    if (!query || query === submittedSearch.current) return;
    const timer = setTimeout(() => {
      submittedSearch.current = query;
      onSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [onSearch, searchDraft]);

  useEffect(() => {
    setSearchLimit(20);
    if (activeSearchQuery && searchDraft !== activeSearchQuery) setSearchDraft(activeSearchQuery);
  }, [activeSearchQuery]);

  const trackedItems = items.filter((item) => item.plan && !excludedStates.has(item.plan.state));
  const completedItems = trackedItems.filter((item) => item.plan?.state && completedStates.has(item.plan.state));
  const plannedItems = trackedItems.filter((item) => !item.plan?.state || !completedStates.has(item.plan.state));
  const progress = trackedItems.length ? Math.round((completedItems.length / trackedItems.length) * 100) : 0;
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

  return (
    <View accessibilityLabel={`ITEM-001 내 준비 목록, 선택된 아이 ${selectedContextName}`} style={{ gap: 14 }}>
      <TopAppBar eyebrow="준비 홈" onBack={onBack} title="내 준비 목록" />

      <Pressable
        accessibilityHint="준비 상태별 품목을 펼치거나 접어요."
        accessibilityLabel={`나의 준비 진행률, ${trackedItems.length}개 중 ${completedItems.length}개 완료`}
        accessibilityRole="button"
        accessibilityState={{ expanded: progressExpanded }}
        onPress={() => setProgressExpanded((value) => !value)}
        style={({ pressed }) => ({ backgroundColor: semanticColors.actionPrimary, borderRadius: 16, gap: 12, opacity: pressed ? 0.88 : 1, padding: 18 })}
      >
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: semanticColors.textInverse, fontSize: 15, fontWeight: "800" }}>나의 준비 진행률</Text>
            <Text style={{ color: semanticColors.textInverse, fontSize: 12, opacity: 0.88 }}>
              {trackedItems.length ? `${trackedItems.length}개 중 ${completedItems.length}개 완료` : "아직 준비 상태를 정한 품목이 없어요"}
            </Text>
          </View>
          <AppIcon color={semanticColors.textInverse} name={progressExpanded ? "chevron-up" : "chevron-down"} size={24} />
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }} style={{ backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 999, height: 9, overflow: "hidden" }}>
          <View style={{ backgroundColor: semanticColors.textInverse, borderRadius: 999, height: 9, width: `${progress}%` }} />
        </View>
        {progressExpanded ? (
          <View style={{ borderTopColor: "rgba(255,255,255,0.28)", borderTopWidth: 1, gap: 8, paddingTop: 12 }}>
            <Text style={{ color: semanticColors.textInverse, fontSize: 13, fontWeight: "800" }}>준비 중 {plannedItems.length}개 · 완료 {completedItems.length}개</Text>
            {plannedItems.slice(0, 4).map((item) => <Text key={`planned-${item.id}`} style={{ color: semanticColors.textInverse, fontSize: 12 }}>• 준비 중 · {item.nameKo}</Text>)}
            {completedItems.slice(0, 4).map((item) => <Text key={`completed-${item.id}`} style={{ color: semanticColors.textInverse, fontSize: 12 }}>• 완료 · {item.nameKo}</Text>)}
          </View>
        ) : null}
      </Pressable>

      <SegmentedControl onChange={setSortMode} value={sortMode} />

      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
        <TextInput
          accessibilityLabel="준비물 통합 검색"
          onChangeText={setSearchDraft}
          onSubmitEditing={() => {
            const query = searchDraft.trim();
            if (query) {
              submittedSearch.current = query;
              onSearch(query);
            }
          }}
          placeholder="품목명·별칭·코드·분류 검색"
          placeholderTextColor={semanticColors.textDisabled}
          returnKeyType="search"
          style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 14, borderWidth: 1, color: semanticColors.textPrimary, flex: 1, minHeight: 48, paddingHorizontal: 14 }}
          value={searchDraft}
        />
        <Pressable accessibilityLabel="준비물 검색 실행" accessibilityRole="button" hitSlop={6} onPress={() => {
          const query = searchDraft.trim();
          if (query) {
            submittedSearch.current = query;
            onSearch(query);
          }
        }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 14, height: 48, justifyContent: "center", opacity: pressed ? 0.76 : 1, width: 48 })}>
          <AppIcon color={semanticColors.textInverse} name="magnify" size={23} />
        </Pressable>
      </View>

      {loading ? (
        <EmptyStateCard actionLabel="잠시만요" title="준비 품목을 불러오고 있어요." />
      ) : error ? (
        <EmptyStateCard actionLabel="다시 시도" onPress={onRetry} title="준비 품목을 불러오지 못했어요." />
      ) : activeSearchQuery ? (
        <View style={{ gap: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 14, fontWeight: "800" }}>
              ‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개
            </Text>
            <Pressable accessibilityRole="button" onPress={() => {
              setSearchDraft("");
              submittedSearch.current = "";
              onClearSearch();
            }} style={({ pressed }) => ({ justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1, paddingHorizontal: 8 })}>
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>검색 닫기</Text>
            </Pressable>
          </View>
          {displayedItems.length ? (
            <>
              <ItemGrid columns={columns} items={displayedItems.slice(0, searchLimit)} onItemPress={onItemPress} />
              {searchLimit < displayedItems.length ? (
                <Pressable accessibilityRole="button" onPress={() => setSearchLimit((current) => Math.min(displayedItems.length, current * 2))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
                  <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>검색 결과 더 보기 ({Math.min(searchLimit, displayedItems.length)}/{displayedItems.length})</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <EmptyStateCard actionLabel="없는 품목 신고" onPress={onMissingReport} title="검색 결과가 없어요." />
          )}
        </View>
      ) : displayedItems.length === 0 || (sortMode === "category" ? categories.length === 0 : populatedTimingBands.length === 0) ? (
        <EmptyStateCard actionLabel="준비 홈" onPress={onBack} title="5개 이상 확인된 준비 품목 그룹이 없어요." />
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
                    <ItemGrid columns={columns} items={visibleGroupItems} onItemPress={onItemPress} />
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
                    <ItemGrid columns={columns} items={visibleBandItems} onItemPress={onItemPress} />
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

      <Pressable accessibilityRole="button" onPress={onMissingReport} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>찾는 품목이 없나요? <Text style={{ color: semanticColors.actionPrimary, fontWeight: "800" }}>누락 신고하기</Text></Text>
      </Pressable>

    </View>
  );
}
