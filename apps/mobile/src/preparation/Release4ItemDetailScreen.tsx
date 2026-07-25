import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams, useNavigation } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { formatKrw } from "../money";
import { addItemPlanComment, getCatalogItem, getCatalogItemComparison, getChild, getItemPlanActivity, getRecurringPrediction, isApiErrorCode, listHouseholdMembers, fixtureSessionToken, newClientMutationId, putItemPlan, putMotherItemPlan, type CatalogItemPlan, type CatalogPlanState } from "../api/client";
import { AffiliateDisclosure, AppIcon, EmptyStateCard, PrimaryButton, SampleDataBanner, ScreenScaffold, SecondaryButton, SectionCard, Toast, semanticColors, spacing } from "../design-system";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { invalidatePreparationMutationQueries } from "../query/mutation-invalidation";
import { isValidDateOnly, itemPlanDraftChanged, itemPlanFieldVisibility } from "./item-plan-form";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../api/fixture-identifiers";
import { resolveOfflineScopeKey } from "../offline/session-scope";
import { canManagePurchaseFollowup } from "../purchase-followup/store";
import { resolveVerifiedPurchaseRole } from "../purchase-followup/access-context";
import { PurchaseOfferAction, type PurchaseOfferAccessState } from "../purchase-followup/PurchaseOfferAction";

const planChoices: Array<{ state: CatalogPlanState; label: string }> = [
  { state: "not_considered", label: "아직 결정 전" },
  { state: "researching", label: "알아보는 중" },
  { state: "planned", label: "구매 예정" },
  { state: "ordered", label: "주문 완료" },
  { state: "owned", label: "이미 있음" },
  { state: "borrowed", label: "빌림" },
  { state: "rented", label: "대여" },
  { state: "gift_expected", label: "선물 예정" },
  { state: "gifted", label: "선물 받음" },
  { state: "not_needed", label: "필요 없음" },
  { state: "replacement_needed", label: "교체 필요" },
  { state: "retired", label: "사용 종료" }
];

const acquisitionChoices: Array<{ value: NonNullable<CatalogItemPlan["acquisitionMode"]>; label: string }> = [
  { value: "new_purchase", label: "새 상품" }, { value: "secondhand", label: "중고" }, { value: "rental", label: "대여" },
  { value: "borrow", label: "빌림" }, { value: "gift", label: "선물" }, { value: "existing", label: "기존 보유" }, { value: "undecided", label: "미정" }
];

function policyLabel(value: string) {
  if (value === "allowed") return "중고 가능";
  if (value === "inspect") return "상태 확인 후 중고 가능";
  if (value === "avoid") return "중고 비권장";
  if (value === "prohibited") return "중고 사용 금지";
  if (value === "suitable") return "대여 적합";
  if (value === "conditional") return "조건 확인 후 대여";
  return "대여 비권장";
}

function PlanTextField({ label, value, onChangeText, keyboardType = "default", placeholder }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "number-pad"; placeholder?: string }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, gap: 5, minWidth: 140 }}>
      <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={semanticColors.textDisabled} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, color: semanticColors.textPrimary, minHeight: 48, paddingHorizontal: 12 }} value={value} />
    </View>
  );
}

export function Release4ItemDetailScreen() {
  const { itemTemplateId, contextType, contextId } = useLocalSearchParams<{ itemTemplateId?: string; contextType?: string; contextId?: string }>();
  const itemId = String(itemTemplateId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const currentUserId = useSessionStore((state) => state.userId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const activeMotherProfileId = contextType === "mother" ? String(contextId ?? "") : undefined;
  const activeChildId = activeMotherProfileId ? undefined : String(contextType === "child" ? contextId ?? childId ?? "" : childId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [quantityNeeded, setQuantityNeeded] = useState("");
  const [quantityOwned, setQuantityOwned] = useState("");
  const [size, setSize] = useState("");
  const [variant, setVariant] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [purchasedAt, setPurchasedAt] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [replacementDueAt, setReplacementDueAt] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [budgetKrw, setBudgetKrw] = useState("");
  const [recurringIntervalDays, setRecurringIntervalDays] = useState("");
  const [notes, setNotes] = useState("");
  const [acquisitionType, setAcquisitionType] = useState<CatalogItemPlan["acquisitionMode"]>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [replacementEnabled, setReplacementEnabled] = useState(false);
  const [hasVersionConflict, setHasVersionConflict] = useState(false);
  const skipUnsavedGuardOnce = useRef(false);
  const commentMutationId = useRef<string | null>(null);
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const hasSession = Boolean(token && (activeChildId || activeMotherProfileId) && itemId);
  const detail = useQuery({
    queryKey: ["catalog-v2", "detail", activeChildId, activeMotherProfileId, itemId],
    enabled: hasSession,
    queryFn: () => getCatalogItem(token!, itemId, activeChildId, activeMotherProfileId)
  });
  const comparison = useQuery({
    queryKey: ["catalog-v2", "comparison", itemId],
    enabled: hasSession,
    queryFn: () => getCatalogItemComparison(token!, itemId)
  });
  const childContext = useQuery({
    queryKey: ["children", activeChildId],
    enabled: Boolean(token && activeChildId),
    queryFn: () => getChild(token!, activeChildId!)
  });
  const selectedHouseholdId = isTestSession
    ? LOCAL_HOUSEHOLD_ID
    : childContext.data?.householdId ?? null;
  const members = useQuery({
    queryKey: ["household-members", selectedHouseholdId],
    enabled: Boolean(token && selectedHouseholdId && !isTestSession),
    queryFn: () => listHouseholdMembers(token!, selectedHouseholdId!)
  });
  const activity = useQuery({
    queryKey: ["catalog-v2", "plan-activity", activeChildId, itemId],
    enabled: Boolean(token && activeChildId && detail.data?.plan),
    queryFn: () => getItemPlanActivity(token!, activeChildId!, itemId)
  });
  const prediction = useQuery({
    queryKey: ["recurring-prediction", detail.data?.plan?.id, detail.data?.plan?.version],
    enabled: Boolean(token && !isTestSession && activeChildId && detail.data?.plan?.id && detail.data?.plan?.recurringIntervalDays),
    queryFn: () => getRecurringPrediction(token!, detail.data!.plan!.id!)
  });
  const updatePlan = useMutation({
    mutationFn: (state: CatalogPlanState) => activeMotherProfileId
      ? putMotherItemPlan(token!, activeMotherProfileId, itemId, { state, expectedVersion: detail.data?.plan?.version })
      : putItemPlan(token!, activeChildId!, itemId, { state, expectedVersion: detail.data?.plan?.version }),
    onSuccess: async (plan) => {
      setMessage(`준비 상태를 '${planChoices.find((choice) => choice.state === plan.state)?.label ?? plan.state}'으로 저장했어요.`);
      await invalidatePreparationMutationQueries(queryClient, [
        activeChildId ? `child:${activeChildId}` : `mother:${activeMotherProfileId}`,
        activeChildId ?? activeMotherProfileId!
      ]);
    }
  });
  const saveInventory = useMutation({
    mutationFn: () => {
      const body = {
        state: detail.data?.plan?.state ?? "planned" as CatalogPlanState,
        quantityNeeded: quantityNeeded ? Number(quantityNeeded) : undefined,
        quantityOwned: quantityOwned ? Number(quantityOwned) : undefined,
        size: size.trim() || undefined,
        variant: variant.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        purchasedAt: purchasedAt.trim() || undefined,
        openedAt: openedAt.trim() || undefined,
        replacementDueAt: replacementEnabled ? replacementDueAt.trim() || undefined : undefined,
        storageLocation: storageLocation.trim() || undefined,
        budgetKrw: budgetKrw ? Number(budgetKrw) : undefined,
        recurringIntervalDays: recurringEnabled && recurringIntervalDays ? Number(recurringIntervalDays) : undefined,
        notes: notes.trim() || undefined,
        acquisitionType: acquisitionType ?? undefined,
        assignedUserId: assignedUserId ?? undefined,
        expectedVersion: detail.data?.plan?.version
      };
      return activeMotherProfileId ? putMotherItemPlan(token!, activeMotherProfileId, itemId, body) : putItemPlan(token!, activeChildId!, itemId, body);
    },
    onSuccess: async () => {
      setHasVersionConflict(false);
      setMessage("수량·재고·담당자·예산 정보를 저장했어요.");
      await invalidatePreparationMutationQueries(queryClient, [
        activeChildId ? `child:${activeChildId}` : `mother:${activeMotherProfileId}`,
        activeChildId ?? activeMotherProfileId!
      ]);
    },
    onError: (error) => {
      if (isApiErrorCode(error, "VERSION_CONFLICT")) {
        setHasVersionConflict(true);
        setMessage("다른 가족이 먼저 수정했어요. 입력한 내용은 유지했으니 최신 값을 확인해 주세요.");
        return;
      }
      setMessage("입력값을 확인한 뒤 다시 저장해 주세요.");
    }
  });
  const addComment = useMutation({
    mutationFn: () => {
      commentMutationId.current ??= newClientMutationId();
      return addItemPlanComment(token!, activeChildId!, itemId, commentDraft, commentMutationId.current);
    },
    onSuccess: async () => { commentMutationId.current = null; setCommentDraft(""); await activity.refetch(); },
    onError: () => setMessage("댓글을 저장하지 못했어요.")
  });

  useEffect(() => {
    const plan = detail.data?.plan;
    if (!plan) return;
    setQuantityNeeded(plan.quantityNeeded?.toString() ?? plan.desiredQuantity?.toString() ?? "");
    setQuantityOwned(plan.quantityOwned?.toString() ?? plan.ownedQuantity?.toString() ?? "");
    setSize(plan.size ?? "");
    setVariant(plan.variant ?? "");
    setDueDate(plan.dueDate?.slice(0, 10) ?? "");
    setPurchasedAt(plan.purchasedAt?.slice(0, 10) ?? "");
    setOpenedAt(plan.openedAt?.slice(0, 10) ?? "");
    setReplacementDueAt(plan.replacementDueAt?.slice(0, 10) ?? "");
    setStorageLocation(plan.storageLocation ?? "");
    setBudgetKrw(plan.budgetKrw?.toString() ?? "");
    setRecurringIntervalDays(plan.recurringIntervalDays?.toString() ?? "");
    setRecurringEnabled(Boolean(plan.recurringIntervalDays));
    setReplacementEnabled(Boolean(plan.replacementDueAt || plan.state === "replacement_needed"));
    setNotes(plan.notes ?? plan.note ?? "");
    setAcquisitionType(plan.acquisitionType ?? plan.acquisitionMode ?? null);
    setAssignedUserId(plan.assignedUserId ?? null);
  }, [detail.data?.plan?.version]);

  const currentRole = activeChildId
    ? resolveVerifiedPurchaseRole({
        expectedChildId: activeChildId,
        child: childContext.data,
        queriedHouseholdId: selectedHouseholdId,
        currentUserId,
        members: members.data?.members ?? []
      })
    : null;
  const canViewPrivatePlan = isTestSession || currentRole === "owner" || currentRole === "co_parent";
  const canCreatePurchaseFollowup = canManagePurchaseFollowup({
    childContext: Boolean(activeChildId),
    isTestSession,
    role: currentRole
  });
  const purchaseScopeKey = resolveOfflineScopeKey({
    accessToken,
    userId: currentUserId,
    defaultHouseholdId: selectedHouseholdId,
    isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
  const currentState = detail.data?.plan?.state;
  const fieldVisibility = itemPlanFieldVisibility({
    state: currentState,
    recurringEnabled,
    replacementEnabled,
    canViewPrivatePlan
  });
  const inventoryNumbersValid = [quantityNeeded, quantityOwned, budgetKrw, recurringIntervalDays].every((value) => !value || /^\d+$/.test(value));
  const inventoryDatesValid = [dueDate, purchasedAt, openedAt, replacementDueAt].every(isValidDateOnly);
  const inventoryChanged = itemPlanDraftChanged(detail.data?.plan, {
    quantityNeeded,
    quantityOwned,
    assignedUserId,
    budgetKrw,
    size,
    variant,
    dueDate,
    purchasedAt,
    openedAt,
    replacementDueAt: replacementEnabled ? replacementDueAt : "",
    storageLocation,
    recurringIntervalDays: recurringEnabled ? recurringIntervalDays : "",
    acquisitionType,
    notes
  });

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (skipUnsavedGuardOnce.current) {
      skipUnsavedGuardOnce.current = false;
      return;
    }
    if (!inventoryChanged) return;
    event.preventDefault();
    Alert.alert("변경 내용을 저장하지 않았어요", "이 화면을 나가면 입력한 내용이 사라집니다.", [
      { text: "계속 입력", style: "cancel" },
      { text: "나가기", style: "destructive", onPress: () => {
        skipUnsavedGuardOnce.current = true;
        navigation.dispatch(event.data.action);
      } }
    ]);
  }), [inventoryChanged, navigation]);

  const goBack = () => {
    if (!inventoryChanged) {
      router.back();
      return;
    }
    Alert.alert("변경 내용을 저장하지 않았어요", "이 화면을 나가면 입력한 내용이 사라집니다.", [
      { text: "계속 입력", style: "cancel" },
      { text: "나가기", style: "destructive", onPress: () => {
        skipUnsavedGuardOnce.current = true;
        router.back();
      } }
    ]);
  };

  const savePlan = () => {
    if (!inventoryChanged) {
      setMessage("변경된 내용이 없어요.");
      return;
    }
    if (!inventoryNumbersValid || !inventoryDatesValid) return;
    saveInventory.mutate();
  };

  const purchaseOfferAccessState: PurchaseOfferAccessState =
    activeChildId && !isTestSession && (childContext.isLoading || members.isLoading)
      ? "checking"
      : activeChildId &&
          !isTestSession &&
          (childContext.isError ||
            members.isError ||
            !selectedHouseholdId ||
            !currentRole)
        ? "blocked"
        : activeChildId && canCreatePurchaseFollowup && purchaseScopeKey
          ? "followup"
          : "direct";

  if (!hasSession) return <Redirect href="/onboarding/child-status" />;
  if (detail.isLoading) return <ScreenScaffold><EmptyStateCard title="품목 정보를 불러오고 있어요." actionLabel="잠시만요" /></ScreenScaffold>;
  if (detail.isError || !detail.data) return <ScreenScaffold><EmptyStateCard title="품목 정보를 불러오지 못했어요." actionLabel="다시 시도" onPress={() => detail.refetch()} /></ScreenScaffold>;

  const item = detail.data;
  return (
    <ScreenScaffold testID="release4-item-detail-screen">
      {isTestSession ? <SampleDataBanner /> : null}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="뒤로 가기" accessibilityRole="button" onPress={goBack} style={{ alignItems: "center", backgroundColor: semanticColors.surface, borderRadius: 24, height: 48, justifyContent: "center", width: 48 }}>
          <AppIcon color={semanticColors.textPrimary} name="chevron-left" size={24} />
        </Pressable>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 16, fontWeight: "800" }}>준비 품목 상세</Text>
        <View style={{ width: 48 }} />
      </View>

      <SectionCard style={{ gap: spacing.sm }}>
        <View style={{ alignItems: "center", backgroundColor: semanticColors.actionSecondary, borderRadius: 18, height: 72, justifyContent: "center", width: 72 }}>
          <AppIcon color={semanticColors.actionPrimary} name="package-variant-closed" size={38} />
        </View>
        <Text accessibilityRole="header" style={{ color: semanticColors.textPrimary, fontSize: 25, fontWeight: "900" }}>{item.nameKo}</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{item.primaryCategory?.nameKo ?? "준비 품목"} · {item.timingSummary}</Text>
        <Text style={{ color: semanticColors.actionPrimary, fontSize: 12, fontWeight: "800" }}>{activeMotherProfileId ? "선택한 산모 준비에 연결" : "선택한 아이 준비에 연결"}</Text>
        {item.reviewPending ? <Text style={{ color: semanticColors.warning, fontSize: 12, fontWeight: "800" }}>콘텐츠 검수 진행 중</Text> : null}
      </SectionCard>

      {item.safetyTier === "high" || item.medicalDisclaimerRequired ? (
        <SectionCard style={{ backgroundColor: semanticColors.warningSurface, gap: spacing.xs }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
            <AppIcon color={semanticColors.warning} name="alert-circle-outline" size={22} />
            <Text style={{ color: semanticColors.warning, fontSize: 15, fontWeight: "900" }}>전문가 확인 우선</Text>
          </View>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 20 }}>{item.safetyNote}</Text>
        </SectionCard>
      ) : item.safetyNote ? (
        <SectionCard><Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 20 }}>{item.safetyNote}</Text></SectionCard>
      ) : null}

      <SectionCard style={{ gap: spacing.xs }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>왜 확인해요</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 14, lineHeight: 21 }}>{item.reasonText}</Text>
        {item.skipReasonText ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 20 }}>준비하지 않아도 되는 경우 · {item.skipReasonText}</Text> : null}
      </SectionCard>

      <SectionCard style={{ gap: spacing.xs }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>언제·얼마나 준비해요</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 20 }}>{item.quantityGuidance ?? "가족 상황에 맞춰 수량을 정하세요."}</Text>
        <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{policyLabel(item.secondhandPolicy)} · {policyLabel(item.rentalPolicy)}</Text>
      </SectionCard>

      {fieldVisibility.showPrivatePlan ? <SectionCard style={{ gap: spacing.sm }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>내 준비 상태</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {planChoices.map((choice) => {
            const selected = item.plan?.state === choice.state;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={choice.state}
                onPress={() => updatePlan.mutate(choice.state)}
                style={{ alignItems: "center", backgroundColor: selected ? semanticColors.actionPrimary : semanticColors.surface, borderColor: selected ? semanticColors.actionPrimary : semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 }}
              >
                <Text style={{ color: selected ? semanticColors.textInverse : semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>{choice.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard> : (
        <SectionCard style={{ gap: spacing.xs }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 16, fontWeight: "900" }}>준비 정보는 가족 관리자만 볼 수 있어요</Text>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 19 }}>비용, 재고와 가족 메모는 owner 또는 co-parent에게만 표시됩니다.</Text>
        </SectionCard>
      )}

      {fieldVisibility.showPrivatePlan ? (
        <SectionCard style={{ gap: spacing.sm }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>준비 계획</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <PlanTextField keyboardType="number-pad" label="필요 수량" onChangeText={setQuantityNeeded} value={quantityNeeded} />
            <PlanTextField keyboardType="number-pad" label="보유 수량" onChangeText={setQuantityOwned} value={quantityOwned} />
            <PlanTextField keyboardType="number-pad" label="예정 비용(원)" onChangeText={setBudgetKrw} value={budgetKrw} />
          </View>
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "700" }}>담당 가족</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {(members.data?.members ?? []).filter((member) => member.status === "active" && member.role !== "gift_participant" && member.role !== "viewer").map((member) => <Pressable accessibilityRole="button" accessibilityState={{ selected: assignedUserId === member.userId }} key={member.id} onPress={() => setAssignedUserId(member.userId)} style={{ alignItems: "center", backgroundColor: assignedUserId === member.userId ? semanticColors.actionSecondary : semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 }}><Text style={{ color: assignedUserId === member.userId ? semanticColors.actionPrimary : semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>{member.displayName}</Text></Pressable>)}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedExpanded }}
            onPress={() => setAdvancedExpanded((value) => !value)}
            style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 12 }}
          >
            <Text style={{ color: semanticColors.actionPrimary, fontSize: 13, fontWeight: "900" }}>{advancedExpanded ? "세부 정보 접기" : "세부 정보 더 입력"}</Text>
            <AppIcon color={semanticColors.actionPrimary} name={advancedExpanded ? "chevron-up" : "chevron-down"} size={22} />
          </Pressable>

          {advancedExpanded ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: semanticColors.textSecondary, fontSize: 12, lineHeight: 18 }}>교체·반복 구매 알림은 사용자가 입력한 제품 정보에 근거하며 의료 판단이 아니에요.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <PlanTextField label="사이즈" onChangeText={setSize} value={size} />
                <PlanTextField label="옵션·변형" onChangeText={setVariant} value={variant} />
                <PlanTextField label="준비 예정일 YYYY-MM-DD" onChangeText={setDueDate} placeholder="2026-07-16" value={dueDate} />
                {fieldVisibility.showAcquiredFields ? (
                  <>
                    <PlanTextField label="실제 구매일 YYYY-MM-DD" onChangeText={setPurchasedAt} placeholder="2026-07-16" value={purchasedAt} />
                    <PlanTextField label="개봉일 YYYY-MM-DD" onChangeText={setOpenedAt} placeholder="2026-07-16" value={openedAt} />
                    <PlanTextField label="보관 위치" onChangeText={setStorageLocation} value={storageLocation} />
                  </>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: recurringEnabled, disabled: Boolean(item.plan?.recurringIntervalDays) }} disabled={Boolean(item.plan?.recurringIntervalDays)} onPress={() => setRecurringEnabled((value) => !value)} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 48, paddingHorizontal: 12 }}>
                  <AppIcon color={recurringEnabled ? semanticColors.actionPrimary : semanticColors.textDisabled} name={recurringEnabled ? "checkbox-marked" : "checkbox-blank-outline"} size={20} />
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>반복 구매 품목</Text>
                </Pressable>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: replacementEnabled, disabled: Boolean(item.plan?.replacementDueAt) }} disabled={Boolean(item.plan?.replacementDueAt)} onPress={() => setReplacementEnabled((value) => !value)} style={{ alignItems: "center", borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 48, paddingHorizontal: 12 }}>
                  <AppIcon color={replacementEnabled ? semanticColors.actionPrimary : semanticColors.textDisabled} name={replacementEnabled ? "checkbox-marked" : "checkbox-blank-outline"} size={20} />
                  <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>교체 일정 관리</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {fieldVisibility.showRecurringField ? <PlanTextField keyboardType="number-pad" label="재구매 주기(일)" onChangeText={setRecurringIntervalDays} value={recurringIntervalDays} /> : null}
                {fieldVisibility.showReplacementField ? <PlanTextField label="교체 예정일 YYYY-MM-DD" onChangeText={setReplacementDueAt} placeholder="2026-07-16" value={replacementDueAt} /> : null}
              </View>

              <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "700" }}>준비 방식</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {acquisitionChoices.map((choice) => <Pressable accessibilityRole="button" accessibilityState={{ selected: acquisitionType === choice.value }} key={choice.value} onPress={() => setAcquisitionType(choice.value)} style={{ alignItems: "center", backgroundColor: acquisitionType === choice.value ? semanticColors.actionSecondary : semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 }}><Text style={{ color: acquisitionType === choice.value ? semanticColors.actionPrimary : semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>{choice.label}</Text></Pressable>)}
              </View>
              <TextInput accessibilityLabel="준비 메모" multiline onChangeText={setNotes} placeholder="가족이 함께 볼 준비 메모" placeholderTextColor={semanticColors.textDisabled} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, color: semanticColors.textPrimary, minHeight: 96, padding: 12, textAlignVertical: "top" }} value={notes} />
            </View>
          ) : null}

          {!inventoryNumbersValid ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.danger, fontSize: 12 }}>수량·비용·주기는 0 이상의 숫자로 입력해 주세요.</Text> : null}
          {!inventoryDatesValid ? <Text accessibilityLiveRegion="polite" style={{ color: semanticColors.danger, fontSize: 12 }}>날짜를 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.</Text> : null}
          {hasVersionConflict ? (
            <Pressable accessibilityRole="button" onPress={() => void detail.refetch()} style={{ alignItems: "center", borderColor: semanticColors.warning, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48 }}>
              <Text style={{ color: semanticColors.warning, fontSize: 13, fontWeight: "900" }}>최신 값 다시 불러오기</Text>
            </Pressable>
          ) : null}
          <PrimaryButton disabled={!inventoryNumbersValid || !inventoryDatesValid || saveInventory.isPending} label={saveInventory.isPending ? "저장 중" : "준비 계획 저장"} onPress={savePlan} />
        </SectionCard>
      ) : null}

      {!isTestSession && prediction.data ? (
        <SectionCard style={{ gap: spacing.xs }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>반복구매 예상</Text>
          {prediction.data.confirmedDueDate ? <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>확정한 다음 구매일 · {prediction.data.confirmedDueDate}</Text> : null}
          {prediction.data.prediction ? <>
            <Text style={{ color: semanticColors.textPrimary, fontSize: 14, fontWeight: "800" }}>최근 구매 간격을 기준으로 {prediction.data.prediction.predictedDate} 전후에 다시 필요할 가능성이 있어요.</Text>
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>신뢰도 {prediction.data.prediction.confidence} · 예측이며 확정 일정이 아니에요.</Text>
          </> : <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>신뢰 가능한 실제 구매가 {prediction.data.minimumPurchaseCount}회 모이면 예상을 보여드려요. 현재 {prediction.data.historyCount}회예요.</Text>}
        </SectionCard>
      ) : null}

      {fieldVisibility.showPrivatePlan && activeChildId && item.plan ? (
        <SectionCard style={{ gap: spacing.sm }}>
          <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>가족 공동 준비 기록</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <TextInput accessibilityLabel="가족 댓글" onChangeText={setCommentDraft} placeholder="변경 이유나 준비 상황을 남겨요" placeholderTextColor={semanticColors.textDisabled} style={{ backgroundColor: semanticColors.surface, borderColor: semanticColors.borderSubtle, borderRadius: 12, borderWidth: 1, color: semanticColors.textPrimary, flex: 1, minHeight: 48, paddingHorizontal: 12 }} value={commentDraft} />
            <Pressable accessibilityRole="button" disabled={!commentDraft.trim() || addComment.isPending} onPress={() => addComment.mutate()} style={{ alignItems: "center", backgroundColor: semanticColors.actionPrimary, borderRadius: 12, justifyContent: "center", minHeight: 48, minWidth: 64, opacity: !commentDraft.trim() ? 0.5 : 1 }}><Text style={{ color: semanticColors.textInverse, fontSize: 12, fontWeight: "900" }}>등록</Text></Pressable>
          </View>
          {(activity.data?.comments ?? []).map((comment) => <View key={comment.id} style={{ borderTopColor: semanticColors.borderSubtle, borderTopWidth: 1, gap: 3, paddingTop: 8 }}><Text style={{ color: semanticColors.textPrimary, fontSize: 13, fontWeight: "800" }}>{comment.authorDisplayName}</Text><Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>{comment.body}</Text></View>)}
          <Text style={{ color: semanticColors.textSecondary, fontSize: 12, fontWeight: "800" }}>최근 변경</Text>
          {(activity.data?.history ?? []).slice(0, 5).map((entry) => <Text key={entry.id} style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{entry.actorDisplayName} · v{entry.fromVersion ?? 0}→v{entry.toVersion} · {new Date(entry.createdAt).toLocaleString("ko-KR")}</Text>)}
        </SectionCard>
      ) : null}

      <SectionCard style={{ gap: spacing.sm }}>
        <Text style={{ color: semanticColors.textPrimary, fontSize: 17, fontWeight: "900" }}>판매 상품 비교</Text>
        {comparison.isLoading ? (
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13 }}>승인된 상품 정보를 확인하고 있어요.</Text>
        ) : comparison.isError || !comparison.data || comparison.data.offers.length === 0 ? (
          <Text style={{ color: semanticColors.textSecondary, fontSize: 13, lineHeight: 20 }}>검증된 판매 제안이 아직 없어요. 상품이 없어도 준비 상태와 예산은 계속 관리할 수 있어요.</Text>
        ) : comparison.data.offers.map((offer) => (
          <View key={offer.id} style={{ borderTopColor: semanticColors.borderSubtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm }}>
            <Text style={{ color: semanticColors.textPrimary, fontSize: 14, fontWeight: "800" }}>{offer.productName}</Text>
            <Text style={{ color: semanticColors.textSecondary, fontSize: 12 }}>
              {offer.seller} · {offer.priceSnapshotKrw == null ? "판매처에서 가격 확인" : `${formatKrw(offer.priceSnapshotKrw)} · ${offer.priceCheckedAt ? `${new Date(offer.priceCheckedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 확인` : "확인 시점 없음"}`} · {offer.priceFreshness === "current" ? "최근 가격" : offer.priceFreshness === "stale" ? "가격 재확인 필요" : "가격 시점 미확인"}
            </Text>
            {comparison.data.schema.fields.map((field) => offer.attributes[field.key] === undefined ? null : (
              <Text key={field.key} style={{ color: semanticColors.textSecondary, fontSize: 12 }}>{field.labelKo} · {String(offer.attributes[field.key])}</Text>
            ))}
            {offer.isAffiliate ? <AffiliateDisclosure text={offer.disclosureText ?? undefined} /> : null}
            <PurchaseOfferAction
              accessState={purchaseOfferAccessState}
              childId={activeChildId ?? null}
              itemDefinitionId={itemId}
              offer={offer}
              onMessage={setMessage}
              scopeKey={purchaseScopeKey}
            />
          </View>
        ))}
      </SectionCard>

      <SecondaryButton label="이 품목으로 지출 기록" onPress={() => router.push({ pathname: "/expenses/new", params: { itemName: item.nameKo, itemDefinitionId: item.id } })} />
      {message ? <Toast message={message} /> : null}
    </ScreenScaffold>
  );
}
