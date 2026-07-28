import { Pressable, Text, View } from "react-native";
import type { CatalogSafetyAlert, CatalogSafetyAlternativesResponse, CatalogTimelineItem, CatalogPlanState } from "../api/client";
import { AppIcon, EmptyStateCard, SectionCard, semanticColors, spacing, type AppIconName } from "../design-system";

function planLabel(state: CatalogPlanState | undefined) {
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
  return "상태 미정";
}

function OverviewLink({
  icon,
  title,
  description,
  onPress
}: {
  icon: AppIconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: semanticColors.surface,
        borderColor: semanticColors.borderSubtle,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.sm,
        minHeight: 64,
        paddingHorizontal: 14,
        paddingVertical: 10
      }}
    >
      <AppIcon color={semanticColors.actionPrimary} name={icon} size={23} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 14, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{description}</Text>
      </View>
      <AppIcon color={semanticColors.textDisabled} name="chevron-right" size={21} />
    </Pressable>
  );
}

export function PreparationProgressCard({
  plannedCount,
  completedCount,
  onPress
}: {
  plannedCount: number;
  completedCount: number;
  onPress?: () => void;
}) {
  const total = plannedCount + completedCount;
  const percentage = total ? Math.round((completedCount / total) * 100) : 0;
  return (
    <Pressable
      accessibilityHint={onPress ? "준비 상태별 목록을 열어요." : undefined}
      accessibilityLabel={`나의 준비 진행률 ${percentage}퍼센트. 완료 ${completedCount}개, 준비 중 ${plannedCount}개`}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <SectionCard style={{ gap: spacing.sm }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
        <AppIcon color={semanticColors.actionPrimary} name="check-circle-outline" size={24} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "800" }}>나의 준비 진행률 {percentage}%</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>준비 중 {plannedCount}개 · 완료 {completedCount}개</Text>
        </View>
        {onPress ? <AppIcon color={semanticColors.textDisabled} name="chevron-right" size={22} /> : null}
      </View>
      <View style={{ backgroundColor: semanticColors.borderSubtle, borderRadius: 999, height: 8, overflow: "hidden" }}>
        <View style={{ backgroundColor: semanticColors.actionPrimary, height: 8, width: `${percentage}%` }} />
      </View>
      </SectionCard>
    </Pressable>
  );
}

export function SafetyAlertSection({
  alerts,
  pending,
  alternativeAlertId,
  alternatives,
  alternativesPending,
  alternativesError,
  onAcknowledge,
  onShowAlternatives,
  onOpenAlternative,
  onOpenEvidence,
  onRetryAlternatives
}: {
  alerts: CatalogSafetyAlert[];
  pending: boolean;
  alternativeAlertId: string | null;
  alternatives: CatalogSafetyAlternativesResponse | undefined;
  alternativesPending: boolean;
  alternativesError: boolean;
  onAcknowledge: (alert: CatalogSafetyAlert) => void;
  onShowAlternatives: (alert: CatalogSafetyAlert) => void;
  onOpenAlternative: (itemId: string) => void;
  onOpenEvidence: (url: string) => void;
  onRetryAlternatives: () => void;
}) {
  const title = (eventType: CatalogSafetyAlert["eventType"]) => {
    if (eventType === "recalled" || eventType === "provider_recalled") return "리콜 알림";
    if (eventType === "provider_corrected") return "리콜 정정 안내";
    return "긴급 안전 차단";
  };
  const recalled = (eventType: CatalogSafetyAlert["eventType"]) => eventType === "recalled" || eventType === "provider_recalled";
  return alerts.map((alert) => {
    const expanded = alternativeAlertId === alert.id;
    return (
      <SectionCard key={alert.id} style={{ backgroundColor: semanticColors.warningSurface, gap: spacing.sm }}>
        <View accessibilityRole="alert" style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.sm }}>
          <AppIcon color={semanticColors.warning} name="alert-octagon-outline" size={24} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: semanticColors.warning, fontSize: 15, fontWeight: "900" }}>{title(alert.eventType)} · {alert.item?.nameKo ?? "준비 품목"}</Text>
            <Text style={{ color: semanticColors.textPrimary, fontSize: 13, lineHeight: 19 }}>{alert.reason}</Text>
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{alert.actionGuidance}</Text>
          </View>
        </View>
        {recalled(alert.eventType) ? <Pressable
          accessibilityLabel={`${alert.item?.nameKo ?? "준비 품목"}의 검증된 안전 대체 품목 ${expanded ? "접기" : "보기"}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          disabled={alternativesPending && expanded}
          onPress={() => onShowAlternatives(alert)}
          style={{ alignItems: "center", borderColor: semanticColors.warning, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }}
        >
          <Text style={{ color: semanticColors.warning, fontSize: 13, fontWeight: "900" }}>
            {alternativesPending && expanded
              ? "안전 대체 품목 확인 중..."
              : `검증된 안전 대체 품목 ${expanded ? "접기" : "보기"}`}
          </Text>
        </Pressable> : null}
        {expanded && alternativesError ? <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="alert" style={{ color: semanticColors.warning, fontSize: 13 }}>안전 대체 품목을 불러오지 못했어요.</Text>
          <Pressable accessibilityRole="button" onPress={onRetryAlternatives} style={{ justifyContent: "center", minHeight: 48 }}>
            <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>다시 시도</Text>
          </Pressable>
        </View> : null}
        {expanded && alternatives && !alternativesPending && !alternativesError ? (
          alternatives.alternatives.length === 0
            ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>현재 검증 완료된 대체 품목이 없어요. 검증 근거와 최신 안내를 확인해 주세요.</Text>
            : alternatives.alternatives.map((item) => (
              <View key={item.id} style={{ backgroundColor: semanticColors.surface, borderRadius: 12, gap: spacing.xs, padding: 12 }}>
                <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, fontSize: 15, fontWeight: "900" }}>{item.nameKo}</Text>
                <Text style={{ color: semanticColors.textPrimary, fontSize: 13, lineHeight: 19 }}>{item.reason}</Text>
                {item.safetyNote ? <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>{item.safetyNote}</Text> : null}
                <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>검증 근거 · {item.evidence.title}</Text>
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  <Pressable accessibilityRole="button" onPress={() => onOpenAlternative(item.id)} style={{ alignItems: "center", borderColor: semanticColors.actionPrimary, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }}>
                    <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>대체 품목 보기</Text>
                  </Pressable>
                  <Pressable accessibilityRole="link" onPress={() => onOpenEvidence(item.evidence.publicUrl)} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }}>
                    <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>검증 근거 열기</Text>
                  </Pressable>
                </View>
              </View>
            ))
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => onAcknowledge(alert)}
          style={{ alignItems: "center", alignSelf: "flex-end", borderColor: semanticColors.warning, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }}
        >
          <Text style={{ color: semanticColors.warning, fontSize: 13, fontWeight: "900" }}>확인했어요</Text>
        </Pressable>
      </SectionCard>
    );
  });
}

export function WeeklyPreparationSection({
  items,
  loading,
  error,
  onRetry,
  onOpenItem,
  onChangeState,
  onOpenList
}: {
  items: CatalogTimelineItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenItem: (item: CatalogTimelineItem) => void;
  onChangeState: (item: CatalogTimelineItem, state: CatalogPlanState) => void;
  onOpenList: () => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, fontSize: 19, fontWeight: "900" }}>이번 주 준비</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>지금 처리할 항목만 최대 5개 보여드려요.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenList} style={{ alignItems: "center", justifyContent: "center", minHeight: 48, paddingHorizontal: 8 }}>
          <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "800" }}>전체 보기</Text>
        </Pressable>
      </View>
      {loading ? (
        <EmptyStateCard title="이번 주 준비를 불러오고 있어요." actionLabel="잠시만요" />
      ) : error ? (
        <EmptyStateCard title="이번 주 준비를 불러오지 못했어요." actionLabel="다시 시도" onPress={onRetry} />
      ) : items.length === 0 ? (
        <EmptyStateCard title="이번 주에 꼭 준비할 항목은 없어요." description="내 준비 목록에서 다음 항목을 확인해 보세요." actionLabel="내 준비 목록" onPress={onOpenList} />
      ) : items.map((item) => (
        <SectionCard key={item.id} style={{ gap: spacing.sm }}>
          <Pressable
            accessibilityLabel={`${item.nameKo}. ${item.recommendationReason}. ${item.dueWindow.label}. ${planLabel(item.plan?.state)}. ${item.plan?.assignedUserId ? "담당자 지정됨" : "담당자 미정"}`}
            accessibilityRole="button"
            onPress={() => onOpenItem(item)}
            style={{ gap: 6 }}
          >
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: semanticColors.textPrimary, fontSize: 16, fontWeight: "900" }}>{item.nameKo}</Text>
                <Text numberOfLines={2} style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 19 }}>{item.recommendationReason}</Text>
                <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>{item.dueWindow.label} · {planLabel(item.plan?.state)}</Text>
                <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>
                  필요 {item.plan?.quantityNeeded ?? item.plan?.desiredQuantity ?? 0} · 보유 {item.plan?.quantityOwned ?? item.plan?.ownedQuantity ?? 0} · {item.plan?.assignedUserId ? "담당자 지정됨" : "담당자 미정"}
                </Text>
              </View>
              <AppIcon color={semanticColors.textDisabled} name="chevron-right" size={22} />
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <Pressable accessibilityRole="button" disabled={item.plan?.state === "planned"} onPress={() => onChangeState(item, "planned")} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }}>
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>준비할래요</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={item.plan?.state === "owned"} onPress={() => onChangeState(item, "owned")} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }}>
              <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>이미 있어요</Text>
            </Pressable>
          </View>
        </SectionCard>
      ))}
    </View>
  );
}

export function PreparationOverviewLinks({
  onOpenList,
  onOpenSearch,
  onOpenBundles,
  onOpenSettings
}: {
  onOpenList: () => void;
  onOpenSearch: () => void;
  onOpenBundles: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <OverviewLink icon="format-list-checks" title="내 준비 목록" description="상태, 담당자, 수량과 예정일을 확인해요." onPress={onOpenList} />
      <OverviewLink icon="magnify" title="준비물 검색" description="다른 이름으로 찾고 없는 품목을 알려주세요." onPress={onOpenSearch} />
      <OverviewLink icon="package-variant" title="상황별 준비 묶음" description="입원 가방, 첫 외출 등 필요한 묶음을 골라요." onPress={onOpenBundles} />
      <OverviewLink icon="tune-variant" title="가족 상황과 추천 설정" description="필요할 때만 펼쳐 추천 조건을 조정해요." onPress={onOpenSettings} />
    </View>
  );
}
