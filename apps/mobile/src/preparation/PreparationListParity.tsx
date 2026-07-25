import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import type { CatalogPlanState, CatalogTimelineBucket } from "../api/client";
import {
  AppIcon,
  BottomSheet,
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

type ContextOption = { key: string; label: string };
type SortMode = "category" | "timing";

const completedStates = new Set<CatalogPlanState>(["owned", "borrowed", "rented", "gifted", "replaced"]);

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
  { id: "now", name: "지금 준비해요", subtitle: "7일 안에 확인해요", buckets: ["overdue", "this_week"], icon: "alarm", tint: "#FFF0EC", color: semanticColors.actionPrimary },
  { id: "soon", name: "곧 필요해요", subtitle: "이번 달에 준비해요", buckets: ["this_month"], icon: "clock-outline", tint: "#E5F7F2", color: semanticColors.brandSecondary },
  { id: "later", name: "여유 있게 준비해요", subtitle: "다음 성장 단계를 살펴봐요", buckets: ["next_stage"], icon: "calendar-blank-outline", tint: "#FFF6DD", color: semanticColors.warning },
  { id: "finished", name: "정리된 품목", subtitle: "준비 완료와 제외한 품목을 모았어요", buckets: ["completed", "not_needed"], icon: "check-circle-outline", tint: semanticColors.successSurface, color: semanticColors.success }
];

function isUrgent(item: PreparationParityItem) {
  return item.timelineBucket === "overdue" || item.timelineBucket === "this_week";
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? semanticColors.actionPrimary : semanticColors.surface,
        borderColor: selected ? semanticColors.actionPrimary : semanticColors.border,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 48,
        opacity: pressed ? 0.76 : 1,
        paddingHorizontal: 14
      })}
    >
      <Text style={{ color: selected ? semanticColors.textInverse : semanticColors.textSecondary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

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
  contextOptions,
  selectedContextKey,
  urgentOnly,
  loading = false,
  error = false,
  onBack,
  onSelectContext,
  onToggleUrgent,
  onRetry,
  onItemPress,
  onMissingReport
}: {
  items: PreparationParityItem[];
  contextOptions: ContextOption[];
  selectedContextKey: string | null;
  urgentOnly: boolean;
  loading?: boolean;
  error?: boolean;
  onBack: () => void;
  onSelectContext: (key: string) => void;
  onToggleUrgent: () => void;
  onRetry: () => void;
  onItemPress: (item: PreparationParityItem) => void;
  onMissingReport: () => void;
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 3;
  const [sortMode, setSortMode] = useState<SortMode>("category");
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTimingBands, setExpandedTimingBands] = useState<Set<string>>(new Set(["now"]));
  const autoExpandedContext = useRef<string | null | undefined>(undefined);
  const selectedContextLabel = contextOptions.find((option) => option.key === selectedContextKey)?.label ?? "준비 대상";

  const categories = useMemo(() => displayGroups.map((group) => ({
    ...group,
    items: items.filter((item) => resolvePreparationDisplayGroupId(item) === group.id)
  })), [items]);

  useEffect(() => {
    const firstPopulatedCategory = categories.find((group) => group.items.length > 0);
    if (!firstPopulatedCategory || autoExpandedContext.current === selectedContextKey) return;
    autoExpandedContext.current = selectedContextKey;
    setExpandedGroups(new Set([firstPopulatedCategory.id]));
  }, [categories, selectedContextKey]);

  const actionableItems = items.filter((item) => item.timelineBucket !== "not_needed");
  const completedCount = actionableItems.filter((item) => item.plan?.state && completedStates.has(item.plan.state)).length;
  const progress = actionableItems.length ? Math.round((completedCount / actionableItems.length) * 100) : 0;
  const displayedItems = urgentOnly ? items.filter(isUrgent) : items;

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
    <View accessibilityLabel="ITEM-001 내 준비 목록" style={{ gap: 14 }}>
      <TopAppBar eyebrow="준비 홈" onBack={onBack} title="내 준비 목록" />

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progress }}
        style={{ backgroundColor: semanticColors.actionPrimary, borderRadius: 16, gap: 12, padding: 18 }}
      >
        <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: semanticColors.textInverse, fontSize: 15, fontWeight: "800" }}>준비 진행률</Text>
          <Text style={{ color: semanticColors.textInverse, fontSize: 12, opacity: 0.88 }}>{actionableItems.length}개 중 {completedCount}개 보유</Text>
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 999, height: 9, overflow: "hidden" }}>
          <View style={{ backgroundColor: semanticColors.textInverse, borderRadius: 999, height: 9, width: `${progress}%` }} />
        </View>
        <Text style={{ color: semanticColors.textInverse, fontSize: 12, lineHeight: 17, opacity: 0.92 }}>필요한 것부터 차근차근 준비하고 있어요.</Text>
      </View>

      <SegmentedControl onChange={setSortMode} value={sortMode} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        <FilterChip label={selectedContextLabel} onPress={() => setContextPickerOpen(true)} selected />
        <FilterChip label="7일 안에" onPress={onToggleUrgent} selected={urgentOnly} />
      </View>

      {loading ? (
        <EmptyStateCard actionLabel="잠시만요" title="준비 품목을 불러오고 있어요." />
      ) : error ? (
        <EmptyStateCard actionLabel="다시 시도" onPress={onRetry} title="준비 품목을 불러오지 못했어요." />
      ) : displayedItems.length === 0 ? (
        <EmptyStateCard actionLabel={urgentOnly ? "전체 보기" : "준비 홈"} onPress={urgentOnly ? onToggleUrgent : onBack} title={urgentOnly ? "7일 안에 준비할 품목이 없어요." : "표시할 준비 품목이 없어요."} />
      ) : sortMode === "category" ? (
        <View style={{ gap: 12 }}>
          {categories.map((group) => {
            const groupItems = displayedItems.filter((item) => resolvePreparationDisplayGroupId(item) === group.id);
            if (urgentOnly && groupItems.length === 0) return null;
            const done = group.items.filter((item) => item.plan?.state && completedStates.has(item.plan.state)).length;
            const percentage = group.items.length ? Math.round((done / group.items.length) * 100) : 0;
            const expanded = groupItems.length > 0 && expandedGroups.has(group.id);
            return (
              <View key={group.id} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: groupItems.length === 0, expanded }}
                  disabled={groupItems.length === 0}
                  onPress={() => toggleGroup(group.id)}
                  style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, opacity: groupItems.length === 0 ? 0.5 : pressed ? 0.76 : 1, padding: 14 })}
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
                {expanded ? <View style={{ paddingBottom: 14, paddingHorizontal: 14 }}><ItemGrid columns={columns} items={groupItems} onItemPress={onItemPress} /></View> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {timingBands.map((band) => {
            const bandItems = displayedItems.filter((item) => item.timelineBucket && band.buckets.includes(item.timelineBucket));
            const expanded = bandItems.length > 0 && expandedTimingBands.has(band.id);
            return (
              <View key={band.id} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: bandItems.length === 0, expanded }}
                  disabled={bandItems.length === 0}
                  onPress={() => toggleTimingBand(band.id)}
                  style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 72, opacity: bandItems.length === 0 ? 0.5 : pressed ? 0.76 : 1, padding: 14 })}
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
                {expanded ? <View style={{ paddingBottom: 14, paddingHorizontal: 14 }}><ItemGrid columns={columns} items={bandItems} onItemPress={onItemPress} /></View> : null}
              </View>
            );
          })}
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={onMissingReport} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1 })}>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>찾는 품목이 없나요? <Text style={{ color: semanticColors.actionPrimary, fontWeight: "800" }}>누락 신고하기</Text></Text>
      </Pressable>

      <BottomSheet description="준비할 가족 구성원을 선택해 주세요." onClose={() => setContextPickerOpen(false)} title="준비 대상" visible={contextPickerOpen}>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.xs }}>
          {contextOptions.map((option) => {
            const selected = option.key === selectedContextKey;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.key}
                onPress={() => { onSelectContext(option.key); setContextPickerOpen(false); }}
                style={({ pressed }) => ({ alignItems: "center", borderColor: selected ? semanticColors.actionPrimary : semanticColors.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 48, opacity: pressed ? 0.76 : 1, paddingHorizontal: 12 })}
              >
                <AppIcon color={selected ? semanticColors.actionPrimary : semanticColors.textDisabled} name={selected ? "radiobox-marked" : "radiobox-blank"} size={22} />
                <Text style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
