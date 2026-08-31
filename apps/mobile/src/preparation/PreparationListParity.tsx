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
import { pendingSearchSubmission, searchResultCountAnnouncement, shouldSyncSearchDraft } from "./search-draft";
import { announceForA11y } from "../ui";
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

/**
 * 라운드 81 트랙 C — 첫 펼침을 **다시 계산할지** 정하는 순수 판정.
 *
 * 예전에는 그 판정의 키가 `selectedContextKey`(= 아이 id) **하나**였다. 그런데 그리는 그룹
 * 목록을 갈아 끼우는 입력은 아이 말고도 넷이 더 있고(시기 밴드 칩·필수도 칩·찜 칩·검색어),
 * 무엇보다 **콜드 스타트에는 분류 캐시가 늦게 온다** — 분류 이름을 아직 모르는 프레임에서는
 * 모든 품목이 "기타" 한 그룹으로 묶이므로, 아이당 한 번뿐인 그 계산을 **곧 사라질 그룹**에
 * 써 버리고 ref가 잠겼다. 분류가 도착해 그룹이 여덟~열로 갈리면 펼쳐 둔 "기타"는 목록에
 * 없고, 사용자가 처음 보는 화면은 **접힌 헤더의 벽**이 된다(품목이 한 개도 보이지 않는다).
 *
 * 그래서 키를 *"지금 펼칠 그룹을 정하는 입력"* 으로 넓힌다 — 선택 컨텍스트 + 지금 그려질
 * 그룹 목록의 서명. 대신 **사용자가 접은 것을 앱이 되펼치지 않는다**: 같은 아이 안에서 목록만
 * 바뀐 경우, 펼쳐 둔 그룹 중 하나라도 새 목록에 살아 있으면 펼침 상태에 손대지 않고 키만
 * 갱신한다. 아이가 바뀐 경우는 예전 그대로 첫 그룹을 다시 펼친다(다른 아이의 화면이다).
 */
const AUTO_EXPAND_KEY_SEPARATOR = "\u0000";

export function preparationAutoExpandKey(contextKey: string | null, groupIds: readonly string[]) {
  // 그룹 id는 **호출부가 정하는 값**이다(준비템 탭은 분류 *이름*을 쓴다). 그 값의 폭에 아무
  // 가정을 두지 않으려고 JSON 인코딩으로 적는다 -- 어떤 문자가 와도 서로 다른 목록이 같은
  // 서명이 되지 않고, JSON은 NUL을 반드시 이스케이프하므로 구분자로 쓴 raw NUL은 값 안에
  // 나타날 수 없다(컨텍스트 부분과 그룹 부분이 섞이지 않는다).
  return `${JSON.stringify(contextKey)}${AUTO_EXPAND_KEY_SEPARATOR}${JSON.stringify(groupIds)}`;
}

/**
 * 라운드 81 리뷰(M-2·M-3) — 위 규율에 **두 가지가 더** 붙었다.
 *
 * **M-2. 전부 접은 상태는 사용자의 결정이다.** 종전 조건("펼쳐 둔 그룹 중 살아 있는 것이 0")은
 * 사용자가 손으로 **전부 접은** 화면에서도 참이라, 목록이 조금만 갈려도 앱이 첫 그룹을 다시
 * 펼쳤다 — 접는 데 여덟 번을 쓴 사람에게 되펼침은 그 여덟 번을 부정하는 동작이다. 같은 아이
 * 안에서 펼침이 0이면 그것은 "잃어버린 펼침"이 아니라 **의도한 상태**이므로 손대지 않고 키만
 * 갱신한다(체크표 #91과 known-limitations V-1이 약속한 "되펼치지 않는다"의 실제 의미다).
 *
 * **M-3. 검색 중에는 판정을 보류한다.** 검색이 켜져 있으면 화면은 그룹 섹션 대신 **평평한 검색
 * 결과 그리드**를 그린다 — 그 동안 목록 서명으로 자동 펼침을 다시 계산하면 *보이지도 않는
 * 화면의 상태*가 바뀌고, 검색을 닫는 순간 사용자가 만들어 둔 펼침이 검색 결과에서 고른 다른
 * 그룹으로 갈아치워진다(좁아졌다 넓어지는 왕복의 손실). 그래서 검색 중에는 **키도 갱신하지
 * 않고 펼침에도 손대지 않는다** — 검색을 닫으면 그때의 목록으로 판정이 한 번 돌고, 그 목록이
 * 검색 전과 같으면 서명도 같아 아무것도 바뀌지 않는다(왕복이 무손실이 되는 자리다).
 */
export type PreparationAutoExpandDecision = {
  /** ref에 새로 적을 키. */
  nextKey: string;
  /** 새로 펼칠 그룹 id. `null`이면 지금 펼침 상태를 그대로 두고 키만 갱신한다. */
  expandGroupId: string | null;
};

export function resolvePreparationAutoExpand({
  contextKey,
  expandedGroupIds,
  groupIds,
  previousKey,
  searchActive = false
}: {
  /** 선택된 아이(또는 호출부가 정한 컨텍스트). */
  contextKey: string | null;
  /** 지금 펼쳐져 있는 그룹 id들. */
  expandedGroupIds: readonly string[];
  /** 지금 그려질 그룹 id들(그리는 순서 그대로). */
  groupIds: readonly string[];
  /** 직전에 자동 펼침을 계산한 키. 아직 한 번도 계산하지 않았으면 `undefined`. */
  previousKey: string | undefined;
  /** 지금 검색어가 걸려 있는가 — 그렇다면 화면에 분류 섹션이 아예 그려지지 않는다. */
  searchActive?: boolean;
}): PreparationAutoExpandDecision | null {
  // 라운드 81 리뷰(M-3): 검색 중에는 그룹 섹션이 그려지지 않는다 -- 보이지 않는 화면의 펼침을
  // 바꾸지 않고, 키도 갱신하지 않는다(검색을 닫으면 그때의 목록으로 한 번 판정한다).
  if (searchActive) return null;
  const [firstGroupId] = groupIds;
  // 그릴 그룹이 하나도 없으면 예전과 같이 아무것도 하지 않는다(키도 잠그지 않는다) --
  // 조회가 끝나기 전의 빈 프레임에 그 한 번을 쓰지 않기 위한 예전 가드 그대로다.
  if (firstGroupId === undefined) return null;
  const nextKey = preparationAutoExpandKey(contextKey, groupIds);
  // 같은 아이 · 같은 그룹 목록이면 리렌더가 몇 번 오든 손대지 않는다(사용자가 접은 상태 보존).
  if (previousKey === nextKey) return null;
  const sameContext = previousKey !== undefined
    && previousKey.startsWith(`${JSON.stringify(contextKey)}${AUTO_EXPAND_KEY_SEPARATOR}`);
  if (!sameContext) return { expandGroupId: firstGroupId, nextKey };
  // 라운드 81 리뷰(M-2): 같은 아이 안에서 펼침이 하나도 없다 = 사용자가 전부 접었다. 되펼치지
  // 않는다(빈 배열에서는 아래 survives 판정이 언제나 false라, 이 갈래가 없으면 목록이 갈릴
  // 때마다 접어 둔 화면이 첫 그룹부터 다시 펼쳐졌다).
  if (expandedGroupIds.length === 0) return { expandGroupId: null, nextKey };
  const survivesInNextList = expandedGroupIds.some((id) => groupIds.includes(id));
  return { expandGroupId: survivesInNextList ? null : firstGroupId, nextKey };
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
  const autoExpandedKey = useRef<string | undefined>(undefined);
  const submittedSearch = useRef("");
  /**
   * 라운드 90 트랙 A(#1) — **직전에 소리로 내보낸 검색 결과 문장.**
   *
   * 아래 낭독 effect가 같은 문장을 두 번 읽지 않게 하는 유일한 근거다(재낭독 금지). 검색 결과가
   * 정확히 그 축이다 — 같은 질의가 같은 개수로 다시 서는 창(목록 재조회 · 필터 왕복 · 개발
   * 모드의 effect 이중 호출)이 실재하고, 그때 화면은 한 글자도 달라지지 않는데 소리만 두 번
   * 난다. 값이 아니라 **문장**을 기억하는 이유는 사람에게 닿는 단위가 문장이기 때문이다
   * (질의가 바뀌어도 개수가 같을 수 있고, 그때는 다시 읽어야 한다).
   */
  const announcedSearchResult = useRef<string | null>(null);

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
    const decision = resolvePreparationAutoExpand({
      contextKey: selectedContextKey,
      expandedGroupIds: [...expandedGroups],
      groupIds: categories.filter((group) => group.items.length > 0).map((group) => group.id),
      previousKey: autoExpandedKey.current,
      // 라운드 81 리뷰(M-3): 검색 중에는 이 목록이 화면에 서지 않는다 — 판정은 그 사실을 알아야
      // 보이지 않는 화면의 펼침을 건드리지 않는다(그래서 검색어가 의존성에도 함께 있다).
      searchActive: Boolean(activeSearchQuery)
    });
    if (!decision) return;
    autoExpandedKey.current = decision.nextKey;
    // 키만 갱신하는 갈래(살아 있는 그룹이 있다 · 또는 사용자가 전부 접었다) — 사용자가 만든
    // 펼침/접힘을 그대로 둔다.
    if (decision.expandGroupId === null) return;
    setExpandedGroups(new Set([decision.expandGroupId]));
  }, [activeSearchQuery, categories, expandedGroups, selectedContextKey]);

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

  /**
   * 라운드 90 트랙 A(#1) — **검색 결과 개수 줄이 두 플랫폼 다 소리로 나간다.**
   *
   * 아래 `activeSearchQuery` 갈래의 첫 줄에는 라운드 79~89가 남긴 `accessibilityLiveRegion="polite"`가
   * **반쪽으로** 걸려 있었다(짝인 `accessibilityRole="alert"`가 없고, 이 파일에 `announceForA11y`도
   * 0건이었다). 그 프롭은 RN 문서가 `@platform android`로 표시한 것이라 **안드로이드에서만**
   * 소리가 났다 — 준비템 탭에서 검색을 제출한 사람이 iOS에서는 *몇 개가 남았는지*를 듣지 못한다.
   * 핵심 루프 안(지출 기록 → 총액 → **준비템** → 구매 링크) 화면이고, 눈으로는 굵은 글씨 한 줄이
   * 서는데 소리로는 목록이 조용히 줄어들 뿐이었다.
   *
   * ⚠️ 이 `if`의 조건은 그 줄을 세우는 갈래와 **글자로 같다**(`activeSearchQuery`) —
   * a11y-contract.test.ts의 파생 판정이 자리를 감싸는 **최내곽 JSX 갈래**와 이 배선의 `if`
   * 조건을 문자열로 맞춰 보고, 갈리면 배선이 실재해도 `live-region`(= 안드로이드 한정)으로
   * 센다(라운드 88 리뷰 L-1이 이름 붙인 사각 · 라운드 89 A가 그 첫 소비자였다).
   *
   * ⚠️ **재낭독 금지.** 같은 문장이면 소리를 내지 않는다(위 `announcedSearchResult`). 의존 배열은
   * 그 갈래가 읽는 두 값뿐이지만, 같은 질의·같은 개수로 다시 서는 창이 실재하므로 조건 하나로는
   * 부족하다 — 라운드 89 리뷰 L-4가 이름 붙인 그 축이다.
   *
   * ⚠️ 읽어 주는 문장은 화면이 짓지 않는다 — 화면이 이미 그리는 두 값(질의 · 결과 수)에서
   * 문구 모듈이 짓는다(`./search-draft`의 `searchResultCountAnnouncement`). 그래서 이 파일에
   * 새 한국어는 0글자이고, 아래 렌더 줄은 한 바이트도 움직이지 않았다.
   *
   * ⚠️⚠️ **소스로는 여기까지다 — 안드로이드 이중 낭독은 실기기의 몫이다.** 프롭은 그대로 남고
   * (라운드 79~89의 기록이고, 안드로이드에서 들리던 것을 끄는 것이 이 배선의 목적이 아니다)
   * TalkBack에서는 라이브 리전과 이 배선이 **둘 다** 소리를 낸다. 큐가 겹치는지·앞의 것이
   * 잘리는지는 런타임 큐잉이 정하고 소스로 잴 수 없다(라운드 89 리뷰 L-3의 그 물음).
   */
  useEffect(() => {
    if (activeSearchQuery) {
      const announcement = searchResultCountAnnouncement(activeSearchQuery, displayedItems.length);
      if (announcedSearchResult.current === announcement) return;
      announcedSearchResult.current = announcement;
      announceForA11y(announcement);
    }
  }, [activeSearchQuery, displayedItems.length]);

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
