import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { KeyboardAvoidingView, InteractionManager, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { getSeoulToday } from "@wooriai/domain";
import {
  listExpenseShortcuts,
  listPaymentMethods,
  listQuickExpensePresets,
  fixtureSessionToken,
  recordQuickExpensePresetUse
} from "../../src/api/client";
import { pixelEvidenceId } from "../../src/api/fixture-runtime";
import { categoryCatalog } from "../../src/categories";
import { clearQuickExpenseDraft, readQuickExpenseDraft, writeQuickExpenseDraft } from "../../src/expenses/draft-storage";
import { buildRecentExpenseDateChips, EXPENSE_AMOUNT_MAX_DIGITS, EXPENSE_MEMO_MAX_LENGTH, formatExpenseDate, sanitizeExpenseAmountText, validateExpenseDateInput, validateExpenseForm, validateExpenseMemo } from "../../src/expenses/form-contract";
import { PaymentMethodPicker } from "../../src/expenses/PaymentMethodPicker";
import {
  amountAfterQuickExpenseSelection,
  defaultQuickExpenseItemIds,
  nextQuickExpenseLimit,
  quickExpenseCatalogItemForLabel,
  quickExpenseItemCatalog,
  quickExpenseItemsForCategory,
  searchQuickExpenseCatalog,
  type QuickExpenseCatalogItem
} from "../../src/expenses/quick-expense-catalog";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { createExpenseOffline, refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { useConnectivityStatus } from "../../src/offline/connectivity";
import { normalizeAppSyncStatus } from "../../src/offline/sync-display-state";
import { resolveOfflineScopeKey } from "../../src/offline/session-scope";
import {
  loadPurchaseFollowup,
  markPurchaseFollowupRecorded,
  removePurchaseFollowup
} from "../../src/purchase-followup/store";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../../src/api/fixture-identifiers";
import {
  householdIdForSelectedChildScope,
  useSelectedChildStore
} from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { formatKrw } from "../../src/money";
import { AppIcon, BottomSheetFrame, CategoryChip, PrimaryButton, SampleDataBanner, SecondaryButton, Toast, type AppIconName } from "../../src/ui";
import { compactGridColumnCount, compactGridItemWidth } from "../../src/design-system/responsive";
import { SyncStatusBar } from "../../src/design-system";
import { theme } from "../../src/theme";
import { QuickExpensePixelStyles } from "../../src/pixelLock/styles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";

const quickExpenseScreenId = pixelEvidenceId("EXP-001 EXP-001");
const isPixelLockMode = isPixelLockBuild();
const quickExpenseAmountPreview = "38,500원";
// Fixed date used only when there's no session (preview / pixel-lock capture mode) so the
// pixel-lock reference screenshot stays deterministic across runs. See src/android-native-ui-quality.test.ts.
const previewExpenseDate = { iso: "2025-05-24", label: "2025. 05. 24 (토)" };
const quickExpenseCategories = categoryCatalog;
const quickExpenseItems = quickExpenseItemCatalog;

function categoryFor(code: (typeof categoryCatalog)[number]["code"]) {
  return categoryCatalog.find((category) => category.code === code)!;
}

function categoryForId(categoryId: string) {
  return categoryCatalog.find((category) => category.id === categoryId) ?? categoryFor("etc");
}

function quickExpensePixelFrameStyle() {
  return {
    transform: [
      { translateX: QuickExpensePixelStyles.horizontalOffset },
      { translateY: QuickExpensePixelStyles.topOffset },
      { scale: QuickExpensePixelStyles.scale }
    ]
  } as const;
}

const quickExpenseCategoryGridStyle = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});

const quickExpenseCategoryTileStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    height: 144,
    justifyContent: "center",
    padding: 8
  },
  buttonSelected: {
    backgroundColor: theme.colors.coral[50],
    borderColor: theme.colors.mainCoral,
    borderWidth: 2
  },
  iconBox: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  label: {
    color: theme.colors.brown,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,
    textAlign: "center",
    textAlignVertical: "center"
  },
  hint: {
    color: theme.colors.gray600,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  }
});

function ExpenseCategoryIconButton({
  hint,
  icon,
  label,
  onPress,
  selected
}: {
  hint?: string;
  icon: AppIconName;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}${hint ? `. ${hint}` : ""}${selected ? ". 선택됨" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        quickExpenseCategoryTileStyle.button,
        selected ? quickExpenseCategoryTileStyle.buttonSelected : null,
        { opacity: pressed ? 0.76 : 1 }
      ]}
    >
      <View
        style={[
          quickExpenseCategoryTileStyle.iconBox,
          { backgroundColor: selected ? theme.colors.mainCoral : theme.colors.peach }
        ]}
      >
        <AppIcon color={selected ? theme.colors.white : theme.colors.mainCoral} name={icon} size={22} />
      </View>
      <Text style={quickExpenseCategoryTileStyle.label}>
        {label}
      </Text>
      {hint ? <Text style={quickExpenseCategoryTileStyle.hint}>{hint}</Text> : null}
    </Pressable>
  );
}

type QuickExpenseSelection = {
  key: string;
  label: string;
  icon: AppIconName;
  categoryId: string;
  hint?: string;
  defaultAmountText?: string;
  presetId?: string;
};

function ExpenseAppScreenScaffold({
  children,
  contentBottomPadding = 16,
  footer,
  scrollRef
}: {
  children: ReactNode;
  contentBottomPadding?: number;
  footer: ReactNode;
  scrollRef: RefObject<ScrollView | null>;
}) {
  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: contentBottomPadding }}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function NewExpenseScreen() {
  const { fontScale, height, width } = useWindowDimensions();
  const expenseGridColumns = compactGridColumnCount(width, fontScale);
  const expenseGridItemWidth = compactGridItemWidth(expenseGridColumns);
  const params = useLocalSearchParams<{
    itemName?: string;
    itemTemplateId?: string;
    itemDefinitionId?: string;
    purchaseIntentId?: string;
    evidence?: string;
  }>();
  const showPaymentEvidence =
    isPixelLockBuild() && String(params.evidence ?? "") === "EXP-PAY-001";
  const linkedItemTemplateId = params.itemTemplateId ? String(params.itemTemplateId) : undefined;
  const routeLinkedItemDefinitionId = params.itemDefinitionId ? String(params.itemDefinitionId) : undefined;
  const purchaseIntentId = params.purchaseIntentId ? String(params.purchaseIntentId) : undefined;
  const prefilledItemName = params.itemName ? String(params.itemName) : "";
  const prefilledQuickItem = quickExpenseCatalogItemForLabel(prefilledItemName);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const currentUserId = useSessionStore((state) => state.userId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const expenseHouseholdId = householdIdForSelectedChildScope(
    childId,
    selectedChildHouseholdId,
    householdId
  );
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const purchaseScopeKey = resolveOfflineScopeKey({
    accessToken,
    userId: currentUserId,
    defaultHouseholdId: expenseHouseholdId,
    isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
  // Preview/pixel-lock capture (no session) keeps the fixed "기저귀"/"38500" seed so the
  // reference screenshot stays deterministic. A real or test session starts blank so opening
  // the sheet never silently records a 38,500원 지출 the user didn't enter (see save-button
  // disabled guard below). A session that arrived from "준비템 -> 지출도 기록하기" prefills the
  // item name from the prepared-item template instead (see items/[itemTemplateId].tsx).
  const [itemName, setItemName] = useState(() => (authToken ? prefilledItemName : "기저귀"));
  const [amountText, setAmountText] = useState(() => (authToken ? "" : "38500"));
  const [memo, setMemo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(() =>
    categoryFor(prefilledQuickItem?.categoryCode ?? "diaper_hygiene")
  );
  const [expandedCategoryCode, setExpandedCategoryCode] = useState<(typeof categoryCatalog)[number]["code"] | "">(
    prefilledQuickItem?.categoryCode ?? "diaper_hygiene"
  );
  const [customItemMode, setCustomItemMode] = useState(
    Boolean(authToken && prefilledItemName && !prefilledQuickItem)
  );
  const [paymentMethodIndex, setPaymentMethodIndex] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(showPaymentEvidence);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
  const [hasEditedRequiredField, setHasEditedRequiredField] = useState(false);
  const amountInputRef = useRef<TextInput>(null);
  const customItemInputRef = useRef<TextInput>(null);
  const screenScrollRef = useRef<ScrollView>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsHeaderYRef = useRef(0);
  const detailsContentYRef = useRef(0);
  const detailsScrollGenerationRef = useRef(0);
  const didAutoExpandRecentCategoryRef = useRef(Boolean(prefilledQuickItem));
  const didApplyDefaultPaymentMethodRef = useRef(false);
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  // Kept literally as `authToken ? formatExpenseDate(today) : previewExpenseDate` (see
  // src/android-native-ui-quality.test.ts) -- this seeds the initial selected date; past-date
  // selection below can move `expenseDateIso` away from today for a real/test session.
  const initialExpenseDate = authToken ? formatExpenseDate(today) : previewExpenseDate;
  const [expenseDateIso, setExpenseDateIso] = useState(() => initialExpenseDate.iso);
  const expenseDate = authToken ? formatExpenseDate(new Date(`${expenseDateIso}T00:00:00`)) : previewExpenseDate;
  const recentDateChips = buildRecentExpenseDateChips(today);
  const dateInputError = authToken ? validateExpenseDateInput(expenseDateIso) : null;
  const maximumExpenseDate = new Date(`${recentDateChips[2]!.iso}T12:00:00`);
  const queryClient = useQueryClient();
  const syncSnapshot = useOfflineSyncSnapshot();
  const online = useConnectivityStatus();
  const syncStatus = normalizeAppSyncStatus(syncSnapshot.counts, online);
  const pendingSyncCount = syncSnapshot.counts.pending + syncSnapshot.counts.syncing + syncSnapshot.counts.retryWait;
  const attentionSyncCount = syncSnapshot.counts.failed + syncSnapshot.counts.conflict;
  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    enabled: Boolean(authToken),
    queryFn: () => listPaymentMethods(authToken!)
  });
  const paymentMethodOptions = useMemo(() => [
    { id: null, type: "unknown" as const, label: "미지정", isDefault: false },
    ...(paymentMethodsQuery.data?.paymentMethods.filter((method) => method.active) ??
      (showPaymentEvidence
        ? [{ id: "pixel-payment-card", type: "card" as const, label: "생활비 카드", isDefault: true }]
        : []))
  ], [paymentMethodsQuery.data?.paymentMethods, showPaymentEvidence]);
  const paymentMethod = paymentMethodOptions[paymentMethodIndex] ?? paymentMethodOptions[0];

  useEffect(() => {
    if (didApplyDefaultPaymentMethodRef.current || paymentMethodsQuery.isLoading) return;
    didApplyDefaultPaymentMethodRef.current = true;
    const defaultIndex = paymentMethodOptions.findIndex((method) => method.isDefault);
    if (defaultIndex > 0) setPaymentMethodIndex(defaultIndex);
  }, [paymentMethodOptions, paymentMethodsQuery.isLoading]);

  // Restores a saved quick-expense draft on mount, so a user who closes the sheet mid-entry
  // (e.g. interrupted by a call) doesn't lose what they typed. Skipped in pixel-lock capture
  // mode, and skipped whenever the sheet was opened with an explicit prefill (typed item name
  // or a "준비템 -> 지출도 기록하기" template link) so a stale draft never clobbers that intent.
  // Runs once on mount only -- guard conditions are read from the initial render's closure.
  useEffect(() => {
    if (!authToken) return;
    if (isPixelLockBuild()) return;
    if (prefilledItemName) return;
    if (linkedItemTemplateId || routeLinkedItemDefinitionId) return;
    readQuickExpenseDraft().then((draft) => {
      if (!draft) return;
      setItemName(draft.itemName);
      setAmountText(sanitizeExpenseAmountText(draft.amountText).slice(0, EXPENSE_AMOUNT_MAX_DIGITS));
      setMemo(draft.memo.slice(0, EXPENSE_MEMO_MAX_LENGTH));
      const matchedCategory = quickExpenseCategories.find((category) => category.id === draft.categoryId);
      if (matchedCategory) {
        setSelectedCategory(matchedCategory);
        setExpandedCategoryCode(matchedCategory.code);
      }
      setCustomItemMode(Boolean(draft.itemName && !quickExpenseCatalogItemForLabel(draft.itemName)));
      if (draft.spentOnIso) setExpenseDateIso(draft.spentOnIso);
      setIsGift(draft.isGift);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft autosave: persists the in-progress quick-expense entry ~500ms after the
  // last edit, so it can be restored by the effect above if the sheet is closed before saving.
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingQuickExpenseDraft = async () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    await clearQuickExpenseDraft();
  };
  useEffect(() => {
    if (!authToken) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      writeQuickExpenseDraft({
        itemName,
        amountText,
        memo,
        categoryId: selectedCategory.id,
        spentOnIso: expenseDateIso,
        isGift
      });
    }, 500);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [itemName, amountText, memo, selectedCategory.id, expenseDateIso, isGift, authToken]);

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
  }, []);

  const expenseShortcutsQuery = useQuery({
    queryKey: ["expense-shortcuts", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenseShortcuts(authToken!, childId!)
  });
  const recentItemChips = expenseShortcutsQuery.data?.shortcuts ?? [];
  const presetsQuery = useQuery({
    queryKey: ["expense-presets", expenseHouseholdId],
    enabled: Boolean(authToken && expenseHouseholdId),
    queryFn: () => listQuickExpensePresets(authToken!, expenseHouseholdId!)
  });
  const savedPresets = presetsQuery.data?.presets ?? [];
  const quickSelections = useMemo<QuickExpenseSelection[]>(() => {
    const selections: QuickExpenseSelection[] = [];
    const seenLabels = new Set<string>();
    const append = (selection: QuickExpenseSelection) => {
      const normalized = selection.label.trim().toLocaleLowerCase("ko-KR");
      if (!normalized || seenLabels.has(normalized) || selections.length >= 6) return;
      seenLabels.add(normalized);
      selections.push(selection);
    };

    for (const preset of [...savedPresets].sort((left, right) => Number(right.pinned) - Number(left.pinned))) {
      const category = categoryForId(preset.categoryId);
      const catalogItem = quickExpenseCatalogItemForLabel(preset.itemName);
      append({
        key: `preset:${preset.id}`,
        label: preset.itemName,
        icon: catalogItem?.icon ?? (category.icon as AppIconName),
        categoryId: category.id,
        hint: preset.defaultAmountKrw ? `기본 ${formatKrw(preset.defaultAmountKrw)}` : "고정",
        defaultAmountText: preset.defaultAmountKrw ? String(preset.defaultAmountKrw) : undefined,
        presetId: preset.id
      });
    }

    for (const shortcut of recentItemChips) {
      const category = categoryForId(shortcut.categoryId);
      const catalogItem = quickExpenseCatalogItemForLabel(shortcut.itemName);
      append({
        key: `recent:${shortcut.itemName}:${category.id}`,
        label: shortcut.itemName,
        icon: catalogItem?.icon ?? (category.icon as AppIconName),
        categoryId: category.id,
        hint: `지난번 ${formatKrw(shortcut.lastAmountKrw)}`
      });
    }

    for (const itemId of defaultQuickExpenseItemIds) {
      const item = quickExpenseItems.find((entry) => entry.id === itemId);
      if (!item) continue;
      append({
        key: `default:${item.id}`,
        label: item.label,
        icon: item.icon,
        categoryId: categoryFor(item.categoryCode).id
      });
    }
    return selections;
  }, [recentItemChips, savedPresets]);

  useEffect(() => {
    if (didAutoExpandRecentCategoryRef.current || recentItemChips.length === 0) return;
    didAutoExpandRecentCategoryRef.current = true;
    setExpandedCategoryCode(categoryForId(recentItemChips[0]!.categoryId).code);
  }, [recentItemChips]);

  const focusAmountInput = (selectAll = false, nextAmountText = amountText) => {
    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      if (!selectAll) return;
      const displayLength = nextAmountText
        ? Number(nextAmountText).toLocaleString("ko-KR").length
        : 0;
      amountInputRef.current?.setNativeProps({ selection: { start: 0, end: displayLength } });
    });
  };

  const selectExpenseItem = ({
    label,
    categoryId,
    defaultAmountText,
    presetId
  }: Pick<QuickExpenseSelection, "label" | "categoryId" | "defaultAmountText" | "presetId">) => {
    const nextAmountText = amountAfterQuickExpenseSelection({
      currentItemName: itemName,
      currentCategoryId: selectedCategory.id,
      currentAmountText: amountText,
      nextItemName: label,
      nextCategoryId: categoryId,
      defaultAmountText
    });
    setSelectedCategory(categoryForId(categoryId));
    setExpandedCategoryCode(categoryForId(categoryId).code);
    setCustomItemMode(false);
    setSearchOpen(false);
    setSearchText("");
    setItemName(label);
    setAmountText(nextAmountText);
    setHasEditedRequiredField(true);
    focusAmountInput(Boolean(defaultAmountText), nextAmountText);
    if (presetId && authToken && expenseHouseholdId) {
      void recordQuickExpensePresetUse(authToken, expenseHouseholdId, presetId).catch(() => undefined);
    }
  };

  const searchResults = useMemo(() => searchQuickExpenseCatalog(searchText), [searchText]);

  const selectExpenseCalendarDate = (date: Date | undefined) => {
    if (!date) return;
    const formatted = formatExpenseDate(date);
    const error = validateExpenseDateInput(formatted.iso);
    if (!error) setExpenseDateIso(formatted.iso);
  };

  const openExpenseCalendar = () => {
    if (!authToken) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: new Date(`${expenseDateIso}T12:00:00`),
        maximumDate: maximumExpenseDate,
        mode: "date",
        onChange: (_event, date) => selectExpenseCalendarDate(date)
      });
      return;
    }
    setShowIosDatePicker((value) => !value);
  };

  const startCustomItem = (category: (typeof categoryCatalog)[number], suggestedName = "") => {
    setSelectedCategory(category);
    setExpandedCategoryCode(category.code);
    setCustomItemMode(true);
    setItemName(suggestedName);
    setAmountText("");
    setHasEditedRequiredField(true);
    setSearchOpen(false);
    setSearchText("");
    requestAnimationFrame(() => customItemInputRef.current?.focus());
  };

  const startMissingSearchItem = () => {
    const suggestedName = searchText.trim();
    if (!suggestedName) return;
    if (authToken) {
      const queryLength = Array.from(suggestedName).length;
      trackAndFlushAnalyticsEvent(authToken, {
        eventName: "expense_catalog_search_missed",
        platform: Platform.OS === "android" ? "android" : "ios",
        payload: {
          categoryCode: selectedCategory.code,
          queryLengthBucket: queryLength <= 3 ? "1_3" : queryLength <= 7 ? "4_7" : "8_plus"
        }
      });
    }
    startCustomItem(selectedCategory, suggestedName);
  };

  const purchaseIntentQuery = useQuery({
    queryKey: ["purchase-followup", purchaseScopeKey, childId, purchaseIntentId],
    enabled: Boolean(purchaseIntentId && purchaseScopeKey && childId),
    queryFn: () =>
      loadPurchaseFollowup({
        intentId: purchaseIntentId!,
        scopeKey: purchaseScopeKey!,
        childId: childId!
      })
  });
  const actionablePurchaseIntent =
    purchaseIntentQuery.data?.state === "pending" ||
    purchaseIntentQuery.data?.state === "snoozed"
      ? purchaseIntentQuery.data
      : null;
  const linkedItemDefinitionId = purchaseIntentId
    ? actionablePurchaseIntent?.itemDefinitionId
    : routeLinkedItemDefinitionId;
  const purchaseIntentUnavailable = Boolean(
    purchaseIntentId &&
    (!purchaseScopeKey ||
      !childId ||
      purchaseIntentQuery.isError ||
      (!purchaseIntentQuery.isLoading && !actionablePurchaseIntent))
  );

  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.3): saves to the local offline store first --
  // this always "succeeds" as soon as the local write lands, well before the server has
  // confirmed anything, so the sheet shows OFFLINE_SAVED_MESSAGE here and never the
  // server-confirmed copy (that one only fires later, from a background flush -- see
  // src/offline/sync-controller.ts's flash-message wiring, surfaced on the records screen).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const saveExpense = useMutation({
    mutationFn: (continueAdding: boolean) => {
      const validation = validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso });
      const memoError = validateExpenseMemo(memo);
      if (
        !authToken ||
        !childId ||
        !validation.valid ||
        Boolean(memoError) ||
        Boolean(dateInputError) ||
        purchaseIntentUnavailable ||
        Boolean(purchaseIntentId && !linkedItemDefinitionId)
      ) {
        throw new Error("invalid expense");
      }
      return createExpenseOffline(authToken, queryClient, {
        childId,
        categoryId: selectedCategory.id,
        amountKrw: validation.amountKrw,
        spentOn: expenseDate.iso,
        itemName,
        paymentMethod: paymentMethod.type,
        ...(paymentMethod.id ? { paymentMethodId: paymentMethod.id } : {}),
        memo,
        expenseType: isGift ? "gift" : "expense",
        ...(linkedItemTemplateId ? { linkedItemTemplateId } : {}),
        ...(linkedItemDefinitionId ? { linkedItemDefinitionId } : {})
      });
    },
    onSuccess: async (row, continueAdding) => {
      setHasSaved(true);
      let completionMessage = OFFLINE_SAVED_MESSAGE;
      if (purchaseIntentId && purchaseScopeKey && childId && linkedItemDefinitionId) {
        try {
          const recorded = await markPurchaseFollowupRecorded({
            intentId: purchaseIntentId,
            scopeKey: purchaseScopeKey,
            childId,
            itemDefinitionId: linkedItemDefinitionId,
            localExpenseId: row.localId
          });
          if (!recorded) throw new Error("PURCHASE_FOLLOWUP_CONTEXT_MISMATCH");
          // The background flush starts immediately after the local write and may
          // finish before this callback marks the intent. Re-read the local row so
          // an already server-confirmed expense clears the follow-up at once.
          await refreshOfflineSyncSnapshot().catch(() => undefined);
        } catch {
          await removePurchaseFollowup(purchaseIntentId).catch(() => undefined);
          completionMessage = "지출은 기기에 저장했어요. 구매 안내 연결만 정리하지 못했지만 중복 저장은 막았어요.";
        }
      }
      await clearPendingQuickExpenseDraft();
      if (continueAdding) {
        setItemName("");
        setAmountText("");
        setMemo("");
        setIsGift(false);
        setCustomItemMode(false);
        setSearchOpen(false);
        setSearchText("");
        setHasEditedRequiredField(false);
        setSavedMessage(
          completionMessage === OFFLINE_SAVED_MESSAGE
            ? "기기에 안전하게 저장했어요. 다음 기록을 입력해 주세요."
            : `${completionMessage} 다음 기록을 입력해 주세요.`
        );
        setHasSaved(false);
        requestAnimationFrame(() => screenScrollRef.current?.scrollTo({ animated: true, y: 0 }));
        return;
      }
      setSavedMessage(completionMessage);
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        router.replace("/(tabs)/records");
      }, 250);
    }
  });
  const formattedAmount = amountText
    ? amountText === "38500"
      ? quickExpenseAmountPreview
      : formatKrw(Number(amountText))
    : "";
  const amountInputDisplay = amountText ? Number(amountText).toLocaleString("ko-KR") : "";
  // Guards the one-tap quick-expense sheet: with a real/test session, the save button stays
  // disabled until a positive amount has actually been entered (and any manually-typed date is
  // valid), so opening the sheet can never by itself create an expense. Preview mode (authToken
  // null) is unaffected -- amountText/itemName use fixed preview seeds there, so isSaveInvalid
  // is always false. A real/test session requires both the item name and a positive amount so
  // the button state matches the mutation's actual validation contract.
  const formValidation = validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso });
  const memoError = validateExpenseMemo(memo);
  const isSaveInvalid =
    Boolean(authToken) &&
    (
      !childId ||
      !formValidation.valid ||
      Boolean(memoError) ||
      Boolean(dateInputError) ||
      purchaseIntentUnavailable ||
      Boolean(purchaseIntentId && (purchaseIntentQuery.isLoading || !linkedItemDefinitionId))
    );
  const inlineValidationMessage = authToken && hasEditedRequiredField
    ? formValidation.itemNameError ??
      (!amountText ? "금액을 입력해 주세요." : formValidation.amountError) ??
      dateInputError ??
      formValidation.dateError
    : null;
  const canContinueAdding = Boolean(
    authToken &&
    !purchaseIntentId &&
    !linkedItemTemplateId &&
    !routeLinkedItemDefinitionId
  );

  return (
    <ExpenseAppScreenScaffold
      contentBottomPadding={showAdditionalFields ? 16 : Math.max(16, height - 160)}
      scrollRef={screenScrollRef}
      footer={(
        <View
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderTopWidth: 1,
            paddingHorizontal: width >= 600 ? 32 : 20,
            paddingVertical: 12
          }}
        >
          <View style={{ alignSelf: "center", gap: 10, maxWidth: 680, width: "100%" }}>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: 11, fontWeight: "700" }}>
                  {itemName || customItemMode ? selectedCategory.label : "품목 선택"}
                </Text>
                {customItemMode ? (
                  <TextInput
                    accessibilityLabel="직접 입력할 품목명"
                    accessibilityHint={formValidation.itemNameError ?? undefined}
                    blurOnSubmit={false}
                    maxLength={80}
                    onChangeText={(value) => {
                      setItemName(value);
                      setHasEditedRequiredField(true);
                    }}
                    onSubmitEditing={() => focusAmountInput()}
                    placeholder="품목명을 입력해 주세요"
                    ref={customItemInputRef}
                    returnKeyType="next"
                    style={{
                      borderBottomColor: theme.colors.mainCoral,
                      borderBottomWidth: 2,
                      color: theme.colors.brown,
                      fontSize: 15,
                      fontWeight: "800",
                      minHeight: 44,
                      paddingVertical: 6
                    }}
                    value={itemName}
                  />
                ) : (
                  <Pressable
                    accessibilityLabel={itemName ? `${itemName} 품목명 수정` : "품목을 먼저 선택해 주세요"}
                    accessibilityRole="button"
                    disabled={!itemName}
                    onPress={() => {
                      setCustomItemMode(true);
                      requestAnimationFrame(() => customItemInputRef.current?.focus());
                    }}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      flexDirection: "row",
                      gap: 6,
                      minHeight: 44,
                      opacity: !itemName ? 0.55 : pressed ? 0.76 : 1
                    })}
                  >
                    <Text
                      style={{ color: theme.colors.brown, flex: 1, fontSize: 15, fontWeight: "800" }}
                    >
                      {itemName || "품목을 선택해 주세요"}
                    </Text>
                    {itemName ? <AppIcon color={theme.colors.gray600} name="pencil-outline" size={18} /> : null}
                  </Pressable>
                )}
              </View>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.beige,
                  borderColor: amountText ? theme.colors.mainCoral : "transparent",
                  borderRadius: 14,
                  borderWidth: 1,
                  flexDirection: "row",
                  minHeight: 52,
                  paddingHorizontal: 12,
                  width: width >= 600 ? 220 : 148
                }}
              >
                <TextInput
                  accessibilityLabel="지출 금액"
                  accessibilityHint={inlineValidationMessage ?? undefined}
                  accessibilityValue={{ text: formattedAmount || "미입력" }}
                  editable={!authToken || Boolean(childId)}
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setAmountText(sanitizeExpenseAmountText(value).slice(0, EXPENSE_AMOUNT_MAX_DIGITS));
                    setHasEditedRequiredField(true);
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.colors.gray600}
                  ref={amountInputRef}
                  returnKeyType="done"
                  style={{
                    color: theme.colors.gray900,
                    flex: 1,
                    fontSize: 22,
                    fontVariant: ["tabular-nums"],
                    fontWeight: "800",
                    minHeight: 50,
                    paddingVertical: 0,
                    textAlign: "right"
                  }}
                  value={amountInputDisplay}
                />
                <Text style={{ color: theme.colors.gray600, fontSize: 14, fontWeight: "800" }}>원</Text>
              </View>
            </View>
            {inlineValidationMessage ? (
              <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}>
                {inlineValidationMessage}
              </Text>
            ) : null}
            {savedMessage ? (
              <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.success, fontSize: 12, fontWeight: "700" }}>
                {savedMessage}
              </Text>
            ) : null}
            {authToken && !isPixelLockMode && (pendingSyncCount > 0 || attentionSyncCount > 0 || syncStatus === "offline" || Boolean(savedMessage)) ? (
              <SyncStatusBar
                label={
                  attentionSyncCount > 0
                    ? `확인이 필요한 기록 ${attentionSyncCount}건`
                    : pendingSyncCount > 0
                      ? `기기에 저장됨 · 서버 반영 대기 ${pendingSyncCount}건`
                      : syncStatus === "offline"
                        ? "오프라인 · 기록은 기기에 안전하게 저장돼요"
                        : "모든 기록이 서버에 반영됐어요"
                }
                onPress={() => router.push("/sync-status" as Href)}
                status={syncStatus}
              />
            ) : null}
            {canContinueAdding ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <SecondaryButton
                  disabled={saveExpense.isPending || hasSaved || isSaveInvalid}
                  label={saveExpense.isPending ? "저장 중" : "저장하고 하나 더"}
                  onPress={() => saveExpense.mutate(true)}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  disabled={saveExpense.isPending || hasSaved || isSaveInvalid}
                  label={saveExpense.isPending || hasSaved ? "저장 중" : "저장하기"}
                  onPress={() => saveExpense.mutate(false)}
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <PrimaryButton
                disabled={saveExpense.isPending || hasSaved || isSaveInvalid}
                label={saveExpense.isPending || hasSaved ? "저장 중" : "저장하기"}
                onPress={() => saveExpense.mutate(false)}
              />
            )}
          </View>
        </View>
      )}
    >
      <View
        style={{
          alignSelf: "center",
          maxWidth: 680,
          paddingHorizontal: width >= 600 ? 32 : 20,
          width: "100%"
        }}
      >
        <View style={isPixelLockMode ? quickExpensePixelFrameStyle() : { gap: 14 }}>
          <BottomSheetFrame
            title=""
            showHandle={false}
            style={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              boxShadow: "none",
              elevation: 0,
              gap: 16,
              padding: 0,
              position: "relative"
            }}
          >
            {isTestSession ? <SampleDataBanner /> : null}
            <View
              accessibilityLabel={quickExpenseScreenId}
              style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 }}
            >
              <Pressable
                accessibilityLabel="지출 기록 닫기"
                accessibilityRole="button"
                onPress={() => {
                  void clearPendingQuickExpenseDraft().then(() => router.back());
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  minWidth: 48,
                  opacity: pressed ? 0.7 : 1
                })}
              >
                <AppIcon color={theme.colors.gray900} name="close" size={24} />
              </Pressable>
              <View style={{ alignItems: "center", gap: 2 }}>
                <Text accessibilityRole="header" style={{ color: theme.colors.gray900, fontSize: 19, fontWeight: "800" }}>
                  지출 기록
                </Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>품목을 고르고 금액만 입력하세요</Text>
              </View>
              <View style={{ width: 48 }} />
            </View>

            {canContinueAdding && !isPixelLockMode ? (
              <Pressable
                accessibilityLabel="엑셀로 여러 지출 기록 가져오기"
                accessibilityRole="button"
                onPress={() => router.push("/import" as Href)}
                style={({ pressed }) => ({ alignItems: "center", backgroundColor: theme.colors.white, borderColor: "rgba(74, 63, 53, 0.10)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, opacity: pressed ? 0.78 : 1, paddingHorizontal: 14 })}
              >
                <AppIcon color={theme.colors.mainCoral} name="file-excel-outline" size={20} />
                <Text style={{ color: theme.colors.brown, flex: 1, fontSize: 12, fontWeight: "800" }}>기록이 많다면 엑셀로 한 번에 가져오기</Text>
                <AppIcon color={theme.colors.gray600} name="chevron-right" size={20} />
              </Pressable>
            ) : null}

            <View accessibilityLabel={`지출 날짜 ${expenseDate.label}`} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
                {recentDateChips.map((chip) => (
                  <View key={chip.iso} style={{ flex: 1 }}>
                    <CategoryChip label={chip.shortLabel} selected={chip.iso === expenseDateIso} onPress={() => setExpenseDateIso(chip.iso)} />
                  </View>
                ))}
              </View>
              <Pressable accessibilityLabel="달력에서 날짜 선택" accessibilityRole="button" disabled={!authToken} onPress={openExpenseCalendar} style={({ pressed }) => ({ alignItems: "center", backgroundColor: theme.colors.white, borderColor: "rgba(74, 63, 53, 0.10)", borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", opacity: pressed ? 0.76 : 1, width: 48 })}>
                <AppIcon color={theme.colors.mainCoral} name="calendar-blank-outline" size={22} />
              </Pressable>
            </View>
            {authToken && Platform.OS === "ios" && showIosDatePicker ? (
              <DateTimePicker maximumDate={maximumExpenseDate} mode="date" onChange={(_event, date) => selectExpenseCalendarDate(date)} value={new Date(`${expenseDateIso}T12:00:00`)} />
            ) : null}

            {!showAdditionalFields && !isPixelLockMode ? (
              <Pressable
                accessibilityLabel="상세 입력 바로 열기"
                accessibilityRole="button"
                onPress={() => {
                  detailsScrollGenerationRef.current += 1;
                  setShowAdditionalFields(true);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: theme.colors.white,
                  borderColor: "rgba(74, 63, 53, 0.10)",
                  borderRadius: 14,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 10,
                  minHeight: 48,
                  opacity: pressed ? 0.78 : 1,
                  paddingHorizontal: 14
                })}
              >
                <AppIcon color={theme.colors.mainCoral} name="tune-variant" size={20} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>결제수단 · 메모 · 선물</Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>상세 입력을 바로 열어요</Text>
                </View>
                <AppIcon color={theme.colors.gray600} name="chevron-right" size={20} />
              </Pressable>
            ) : null}

            {authToken && !childId ? (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  backgroundColor: theme.colors.coral[50],
                  borderColor: theme.colors.coral[200],
                  borderRadius: 16,
                  borderWidth: 1,
                  gap: 10,
                  padding: 16
                }}
              >
                <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>아이 프로필을 먼저 선택해 주세요</Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                  지출은 현재 선택된 아이에게 자동으로 기록돼요.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/children" as Href)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    alignSelf: "flex-start",
                    backgroundColor: theme.colors.mainCoral,
                    borderRadius: 12,
                    justifyContent: "center",
                    minHeight: 48,
                    opacity: pressed ? 0.8 : 1,
                    paddingHorizontal: 16
                  })}
                >
                  <Text style={{ color: theme.colors.white, fontSize: 13, fontWeight: "800" }}>아이 프로필 선택</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ gap: 10 }}>
                  <View style={{ gap: 3 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>바로 기록</Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>고정·최근 품목부터 빠르게 골라요</Text>
                  </View>
                  <View accessibilityLabel="바로 기록 품목" style={quickExpenseCategoryGridStyle.grid}>
                    {quickSelections.map((selection) => (
                      <View
                        key={selection.key}
                        style={{ width: expenseGridItemWidth }}
                      >
                        <ExpenseCategoryIconButton
                          hint={selection.hint}
                          icon={selection.icon}
                          label={selection.label}
                          onPress={() => selectExpenseItem(selection)}
                          selected={!customItemMode && selection.label === itemName && selection.categoryId === selectedCategory.id}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>분류별 빠른 품목</Text>
                      <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>품목명·별칭·초성·분류명으로 찾을 수 있어요</Text>
                    </View>
                    <Pressable accessibilityLabel="지출 품목 검색" accessibilityRole="button" onPress={() => setSearchOpen((value) => !value)} style={({ pressed }) => ({ alignItems: "center", borderColor: theme.colors.gray300, borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", opacity: pressed ? 0.76 : 1, width: 48 })}>
                      <AppIcon color={theme.colors.mainCoral} name={searchOpen ? "close" : "magnify"} size={22} />
                    </Pressable>
                  </View>
                  {searchOpen ? (
                    <View style={{ gap: 10 }}>
                      <TextInput accessibilityLabel="지출 품목 검색어" autoFocus onChangeText={setSearchText} placeholder="예: 기저귀, 진료비, ㄱㅈㄱ" style={{ backgroundColor: theme.colors.white, borderColor: theme.colors.mainCoral, borderRadius: 14, borderWidth: 1, color: theme.colors.brown, minHeight: 48, paddingHorizontal: 14 }} value={searchText} />
                      {searchText.trim() && searchResults.length === 0 ? (
                        <View style={{ gap: 10 }}>
                          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>저장할 분류를 먼저 골라 주세요.</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {quickExpenseCategories.map((category) => (
                              <CategoryChip
                                key={`missing-${category.code}`}
                                label={category.label}
                                selected={selectedCategory.id === category.id}
                                onPress={() => setSelectedCategory(category)}
                              />
                            ))}
                          </ScrollView>
                          <Pressable accessibilityRole="button" onPress={startMissingSearchItem} style={({ pressed }) => ({ alignItems: "center", borderColor: theme.colors.gray300, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 52, opacity: pressed ? 0.76 : 1, paddingHorizontal: 12 })}>
                            <Text style={{ color: theme.colors.mainCoral, fontSize: 13, fontWeight: "800" }}>“{searchText.trim()}” 직접 입력하기</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={quickExpenseCategoryGridStyle.grid}>
                          {searchResults.slice(0, 24).map((item) => {
                            const category = categoryFor(item.categoryCode);
                            return (
                              <View key={`search-${item.id}`} style={{ width: expenseGridItemWidth }}>
                                <ExpenseCategoryIconButton icon={item.icon} label={item.label} onPress={() => selectExpenseItem({ label: item.label, categoryId: category.id })} selected={!customItemMode && item.label === itemName && category.id === selectedCategory.id} />
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : null}
                  {quickExpenseCategories.map((category) => {
                    const categoryItems = quickExpenseItemsForCategory(category.code);
                    const expanded = expandedCategoryCode === category.code;
                    const categoryLimit = categoryLimits[category.code] ?? 6;
                    const visibleCategoryItems = categoryItems.slice(0, categoryLimit);
                    return (
                      <View
                        key={category.id}
                        style={{
                          backgroundColor: theme.colors.white,
                          borderColor: expanded ? theme.colors.mainCoral : "rgba(74, 63, 53, 0.10)",
                          borderRadius: 16,
                          borderWidth: 1,
                          overflow: "hidden"
                        }}
                      >
                        <Pressable
                          accessibilityLabel={`${category.label}. 빠른 품목 ${categoryItems.length}개`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() => setExpandedCategoryCode((current) => current === category.code ? "" : category.code)}
                          style={({ pressed }) => ({
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 12,
                            minHeight: 68,
                            opacity: pressed ? 0.76 : 1,
                            paddingHorizontal: 14
                          })}
                        >
                          <View
                            style={{
                              alignItems: "center",
                              backgroundColor: theme.colors.categoryColors[category.code],
                              borderRadius: theme.radii.pill,
                              height: 42,
                              justifyContent: "center",
                              width: 42
                            }}
                          >
                            <AppIcon
                              color={theme.colors.brown}
                              name={categoryItems[0]?.icon ?? (category.icon as AppIconName)}
                              size={22}
                            />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>{category.label}</Text>
                            <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{categoryItems.length}개 품목</Text>
                          </View>
                          <AppIcon color={theme.colors.gray600} name={expanded ? "chevron-up" : "chevron-down"} size={22} />
                        </Pressable>
                        {expanded ? (
                          <View style={[quickExpenseCategoryGridStyle.grid, { paddingBottom: 14, paddingHorizontal: 14 }]}>
                            {visibleCategoryItems.map((item: QuickExpenseCatalogItem) => (
                              <View
                                key={item.id}
                                style={{ width: expenseGridItemWidth }}
                              >
                                <ExpenseCategoryIconButton
                                  icon={item.icon}
                                  label={item.label}
                                  onPress={() => selectExpenseItem({
                                    label: item.label,
                                    categoryId: category.id
                                  })}
                                  selected={!customItemMode && item.label === itemName && category.id === selectedCategory.id}
                                />
                              </View>
                            ))}
                            <View style={{ width: expenseGridItemWidth }}>
                              <ExpenseCategoryIconButton
                                icon="plus"
                                label="직접 입력"
                                onPress={() => startCustomItem(category)}
                                selected={customItemMode && selectedCategory.id === category.id}
                              />
                            </View>
                            {visibleCategoryItems.length < categoryItems.length ? (
                              <Pressable accessibilityRole="button" onPress={() => setCategoryLimits((current) => ({ ...current, [category.code]: nextQuickExpenseLimit(categoryLimit, categoryItems.length) }))} style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 48, opacity: pressed ? 0.76 : 1, width: "100%" })}>
                                <Text style={{ color: theme.colors.mainCoral, fontSize: 13, fontWeight: "800" }}>더 보기</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <Pressable
                  accessibilityLabel={showAdditionalFields ? "상세 입력 닫기" : "상세 입력 열기"}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAdditionalFields }}
                  onLayout={(event) => { detailsHeaderYRef.current = event.nativeEvent.layout.y; }}
                  onPress={() => setShowAdditionalFields((value) => {
                    const next = !value;
                    const generation = ++detailsScrollGenerationRef.current;
                    if (!next) {
                      InteractionManager.runAfterInteractions(() => {
                        requestAnimationFrame(() => {
                          if (generation !== detailsScrollGenerationRef.current) return;
                          screenScrollRef.current?.scrollTo({
                            y: Math.max(0, detailsHeaderYRef.current - 12),
                            animated: true
                          });
                        });
                      });
                    }
                    return next;
                  })}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: theme.touchTarget,
                    opacity: pressed ? 0.76 : 1,
                    paddingHorizontal: 4
                  })}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>상세 입력</Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>결제수단·메모·선물</Text>
                  </View>
                  <AppIcon name={showAdditionalFields ? "chevron-up" : "chevron-down"} size={22} />
                </Pressable>

                {showAdditionalFields ? (
                  <View
                    onLayout={(event) => {
                      detailsContentYRef.current = event.nativeEvent.layout.y;
                      const generation = detailsScrollGenerationRef.current;
                      InteractionManager.runAfterInteractions(() => {
                        requestAnimationFrame(() => {
                          if (generation !== detailsScrollGenerationRef.current) return;
                          screenScrollRef.current?.scrollTo({
                            y: Math.max(0, detailsContentYRef.current - 12),
                            animated: true
                          });
                        });
                      });
                    }}
                    style={{ gap: 10 }}
                  >
                    {!showPaymentEvidence ? (
                      <TextInput
                        accessibilityLabel="지출 메모"
                        accessibilityHint={memoError ?? `최대 ${EXPENSE_MEMO_MAX_LENGTH}자`}
                        maxLength={EXPENSE_MEMO_MAX_LENGTH}
                        onChangeText={(value) => setMemo(value.slice(0, EXPENSE_MEMO_MAX_LENGTH))}
                        placeholder="메모를 입력해 주세요 (선택)"
                        style={{
                          backgroundColor: theme.colors.white,
                          borderColor: memoError ? theme.colors.danger : "rgba(74, 63, 53, 0.10)",
                          borderRadius: 14,
                          borderWidth: 1,
                          color: theme.colors.brown,
                          minHeight: 48,
                          paddingHorizontal: 14
                        }}
                        value={memo}
                      />
                    ) : null}
                    {!showPaymentEvidence ? (
                      <Text accessibilityLiveRegion="polite" style={{ color: memoError ? theme.colors.danger : theme.colors.gray600, fontSize: 11, textAlign: "right" }}>
                        {memoError ?? `${memo.length}/${EXPENSE_MEMO_MAX_LENGTH}자`}
                      </Text>
                    ) : null}

                    {showPaymentEvidence ? (
                    <View accessibilityLabel="EXP-PAY-001">
                      <Pressable
                        accessibilityLabel="결제 수단 변경"
                        accessibilityRole="button"
                        onPress={() => {
                          didApplyDefaultPaymentMethodRef.current = true;
                          setPaymentMethodIndex((value) => (value + 1) % paymentMethodOptions.length);
                        }}
                        style={({ pressed }) => ({
                          alignItems: "center",
                          backgroundColor: theme.colors.white,
                          borderColor: "rgba(74, 63, 53, 0.10)",
                          borderRadius: 14,
                          borderWidth: 1,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          minHeight: 64,
                          opacity: pressed ? 0.76 : 1,
                          paddingHorizontal: 16
                        })}
                      >
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: theme.colors.gray600, fontSize: 11, fontWeight: "700" }}>결제 수단</Text>
                          <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{paymentMethod.label}</Text>
                        </View>
                        <AppIcon color={theme.colors.gray600} name="chevron-right" size={22} />
                      </Pressable>
                    </View>
                    ) : (
                      <PaymentMethodPicker
                        onSelect={(id) => {
                          const index = paymentMethodOptions.findIndex((option) => option.id === id);
                          if (index >= 0) {
                            didApplyDefaultPaymentMethodRef.current = true;
                            setPaymentMethodIndex(index);
                          }
                        }}
                        options={paymentMethodOptions.map((option) => ({ id: option.id, label: option.label }))}
                        selectedId={paymentMethod.id}
                      />
                    )}

                    {authToken ? (
                      <Pressable
                        accessibilityLabel="선물로 받았어요"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isGift }}
                        onPress={() => setIsGift((value) => !value)}
                        style={({ pressed }) => ({
                          alignItems: "center",
                          backgroundColor: theme.colors.white,
                          borderColor: "rgba(74, 63, 53, 0.10)",
                          borderRadius: 14,
                          borderWidth: 1,
                          flexDirection: "row",
                          gap: 10,
                          minHeight: 64,
                          opacity: pressed ? 0.76 : 1,
                          padding: 14
                        })}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: isGift ? theme.colors.mainCoral : theme.colors.white,
                            borderColor: isGift ? theme.colors.mainCoral : theme.colors.gray300,
                            borderRadius: 6,
                            borderWidth: 2,
                            height: 22,
                            justifyContent: "center",
                            width: 22
                          }}
                        >
                          {isGift ? <AppIcon color={theme.colors.white} name="check" size={15} /> : null}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>선물로 받았어요</Text>
                          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>선물은 지출 합계에 포함되지 않아요</Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}

            {purchaseIntentUnavailable ? (
              <Toast message="이 구매 안내는 현재 아이와 연결되지 않아 저장하지 않았어요. 홈에서 다시 시작해 주세요." tone="error" />
            ) : saveExpense.isError ? (
              <Toast message="품목과 금액을 확인한 뒤 다시 저장해 주세요." tone="error" />
            ) : null}
          </BottomSheetFrame>
        </View>
      </View>
    </ExpenseAppScreenScaffold>
  );
}
