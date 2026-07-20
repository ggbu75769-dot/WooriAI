import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { ExpenseAttributionField } from "../../src/expenses/ExpenseAttributionField";
import { buildRecentExpenseDateChips, formatExpenseDate, validateExpenseDateInput, validateExpenseForm } from "../../src/expenses/form-contract";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { createExpenseOffline } from "../../src/offline/sync-controller";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { formatKrw } from "../../src/money";
import { AppIcon, AppScreen, BottomSheetFrame, CategoryChip, PrimaryButton, SampleDataBanner, Toast, type AppIconName } from "../../src/ui";
import { theme } from "../../src/theme";
import { QuickExpensePixelStyles } from "../../src/pixelLock/styles";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";

const quickExpenseScreenId = pixelEvidenceId("EXP-001 EXP-001");
const isPixelLockMode = isPixelLockBuild();
const quickExpenseAmountPreview = "38,500원";
// Fixed date used only when there's no session (preview / pixel-lock capture mode) so the
// pixel-lock reference screenshot stays deterministic across runs. See src/android-native-ui-quality.test.ts.
const previewExpenseDate = { iso: "2025-05-24", label: "2025. 05. 24 (토)" };
const quickExpenseCategories = categoryCatalog;

function categoryFor(code: (typeof categoryCatalog)[number]["code"]) {
  return categoryCatalog.find((category) => category.code === code)!;
}

const quickExpenseItems: Array<{ label: string; icon: AppIconName; category: (typeof categoryCatalog)[number] }> = [
  { label: "기저귀", icon: "baby-face-outline", category: categoryFor("diaper_hygiene") },
  { label: "분유", icon: "baby-bottle-outline", category: categoryFor("feeding_babyfood") },
  { label: "이유식", icon: "food-apple-outline", category: categoryFor("feeding_babyfood") },
  { label: "병원비", icon: "hospital-box-outline", category: categoryFor("hospital_checkup") },
  { label: "약", icon: "pill", category: categoryFor("hospital_checkup") },
  { label: "의류", icon: "tshirt-crew-outline", category: categoryFor("clothes_laundry") },
  { label: "장난감", icon: "toy-brick-outline", category: categoryFor("toys_books") },
  { label: "책", icon: "book-open-page-variant-outline", category: categoryFor("toys_books") }
];

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
    justifyContent: "space-between",
    rowGap: 13
  }
});

const quickExpenseCategoryTileStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    flexBasis: "23%",
    gap: 7
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  iconBoxSelected: {
    backgroundColor: theme.colors.mainCoral,
    borderColor: theme.colors.mainCoral,
    shadowColor: theme.colors.mainCoral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12
  },
  iconText: {
    color: theme.colors.brown,
    fontSize: 20,
    fontWeight: "800"
  },
  iconTextSelected: {
    color: theme.colors.white
  },
  label: {
    color: theme.colors.brown,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  }
});

type QuickExpenseItem = (typeof quickExpenseItems)[number];

function ExpenseCategoryIconButton({
  item,
  onPress,
  selected
}: {
  item: QuickExpenseItem;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={quickExpenseCategoryTileStyle.button}>
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        <AppIcon color={selected ? theme.colors.white : theme.colors.brown} name={item.icon} size={22} />
      </View>
      <Text numberOfLines={1} style={quickExpenseCategoryTileStyle.label}>
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ itemName?: string; itemTemplateId?: string; itemDefinitionId?: string; evidence?: string }>();
  const showPaymentEvidence =
    isPixelLockBuild() && String(params.evidence ?? "") === "EXP-PAY-001";
  const linkedItemTemplateId = params.itemTemplateId ? String(params.itemTemplateId) : undefined;
  const linkedItemDefinitionId = params.itemDefinitionId ? String(params.itemDefinitionId) : undefined;
  const prefilledItemName = params.itemName ? String(params.itemName) : "";
  const prefilledQuickItem = quickExpenseItems.find((item) => item.label === prefilledItemName);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  // Preview/pixel-lock capture (no session) keeps the fixed "기저귀"/"38500" seed so the
  // reference screenshot stays deterministic. A real or test session starts blank so opening
  // the sheet never silently records a 38,500원 지출 the user didn't enter (see save-button
  // disabled guard below). A session that arrived from "준비템 -> 지출도 기록하기" prefills the
  // item name from the prepared-item template instead (see items/[itemTemplateId].tsx).
  const [itemName, setItemName] = useState(() => (authToken ? prefilledItemName : "기저귀"));
  const [amountText, setAmountText] = useState(() => (authToken ? "" : "38500"));
  const [memo, setMemo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(prefilledQuickItem?.category ?? categoryFor("diaper_hygiene"));
  const [paymentMethodIndex, setPaymentMethodIndex] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(showPaymentEvidence);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  // Kept literally as `authToken ? formatExpenseDate(today) : previewExpenseDate` (see
  // src/android-native-ui-quality.test.ts) -- this seeds the initial selected date; past-date
  // selection below can move `expenseDateIso` away from today for a real/test session.
  const initialExpenseDate = authToken ? formatExpenseDate(today) : previewExpenseDate;
  const [expenseDateIso, setExpenseDateIso] = useState(() => initialExpenseDate.iso);
  const expenseDate = authToken ? formatExpenseDate(new Date(`${expenseDateIso}T00:00:00`)) : previewExpenseDate;
  const recentDateChips = buildRecentExpenseDateChips(today);
  // Only meaningful while a real/test session is picking a manually-typed date; null means
  // either preview mode, chip-only selection, or an empty (not-yet-typed) custom field.
  const dateInputError =
    authToken && customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    enabled: Boolean(authToken),
    queryFn: () => listPaymentMethods(authToken!)
  });
  const paymentMethodOptions = [
    { id: null, type: "unknown" as const, label: "미지정", isDefault: false },
    ...(paymentMethodsQuery.data?.paymentMethods.filter((method) => method.active) ??
      (showPaymentEvidence
        ? [{ id: "pixel-payment-card", type: "card" as const, label: "생활비 카드", isDefault: true }]
        : []))
  ];
  const paymentMethod = paymentMethodOptions[paymentMethodIndex] ?? paymentMethodOptions[0];

  useEffect(() => {
    if (paymentMethodIndex !== 0) return;
    const defaultIndex = paymentMethodOptions.findIndex((method) => method.isDefault);
    if (defaultIndex > 0) setPaymentMethodIndex(defaultIndex);
  }, [paymentMethodIndex, paymentMethodOptions]);

  // Restores a saved quick-expense draft on mount, so a user who closes the sheet mid-entry
  // (e.g. interrupted by a call) doesn't lose what they typed. Skipped in pixel-lock capture
  // mode, and skipped whenever the sheet was opened with an explicit prefill (typed item name
  // or a "준비템 -> 지출도 기록하기" template link) so a stale draft never clobbers that intent.
  // Runs once on mount only -- guard conditions are read from the initial render's closure.
  useEffect(() => {
    if (!authToken) return;
    if (isPixelLockBuild()) return;
    if (prefilledItemName) return;
    if (linkedItemTemplateId || linkedItemDefinitionId) return;
    readQuickExpenseDraft().then((draft) => {
      if (!draft) return;
      setItemName(draft.itemName);
      setAmountText(draft.amountText);
      setMemo(draft.memo);
      const matchedCategory = quickExpenseCategories.find((category) => category.id === draft.categoryId);
      if (matchedCategory) setSelectedCategory(matchedCategory);
      if (draft.spentOnIso) setExpenseDateIso(draft.spentOnIso);
      setIsGift(draft.isGift);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft autosave: persists the in-progress quick-expense entry ~500ms after the
  // last edit, so it can be restored by the effect above if the sheet is closed before saving.
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const expenseShortcutsQuery = useQuery({
    queryKey: ["expense-shortcuts", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenseShortcuts(authToken!, childId!)
  });
  const recentItemChips = expenseShortcutsQuery.data?.shortcuts ?? [];
  const presetsQuery = useQuery({
    queryKey: ["expense-presets", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listQuickExpensePresets(authToken!, householdId!)
  });
  const savedPresets = presetsQuery.data?.presets ?? [];

  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.3): saves to the local offline store first --
  // this always "succeeds" as soon as the local write lands, well before the server has
  // confirmed anything, so the sheet shows OFFLINE_SAVED_MESSAGE here and never the
  // server-confirmed copy (that one only fires later, from a background flush -- see
  // src/offline/sync-controller.ts's flash-message wiring, surfaced on the records screen).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const saveExpense = useMutation({
    mutationFn: () => {
      const validation = validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso });
      if (!authToken || !childId || !validation.valid || Boolean(dateInputError)) {
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
    onSuccess: async () => {
      clearQuickExpenseDraft();
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      setTimeout(() => router.replace("/(tabs)/records"), 650);
    }
  });
  const formattedAmount = amountText === "38500" ? quickExpenseAmountPreview : formatKrw(Number(amountText || 0));
  // Guards the one-tap quick-expense sheet: with a real/test session, the save button stays
  // disabled until a positive amount has actually been entered (and any manually-typed date is
  // valid), so opening the sheet can never by itself create an expense. Preview mode (authToken
  // null) is unaffected -- amountText/itemName use fixed preview seeds there, so isSaveInvalid
  // is always false. A real/test session requires both the item name and a positive amount so
  // the button state matches the mutation's actual validation contract.
  const formValidation = validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso });
  const isSaveInvalid =
    Boolean(authToken) &&
    (!formValidation.valid || Boolean(dateInputError));

  return (
    <AppScreen>
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
            gap: 14,
            padding: 0,
            position: "relative"
          }}
        >
        {isTestSession ? <SampleDataBanner /> : null}
        <View accessibilityLabel={quickExpenseScreenId} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 40 }}>
          <Pressable
            accessibilityLabel="지출 기록 닫기"
            accessibilityRole="button"
            onPress={() => {
              clearQuickExpenseDraft();
              router.back();
            }}
            style={{ alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48 }}
          >
            <AppIcon color={theme.colors.gray900} name="close" size={24} />
          </Pressable>
          <Text style={{ color: theme.colors.gray900, fontSize: 18, fontWeight: "800" }}>지출 기록</Text>
          <View style={{ width: 36 }} />
        </View>

        <View
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.12)",
            borderRadius: 14,
            borderWidth: 1,
            gap: 12,
            padding: 16
          }}
        >
          {authToken ? (
            <Pressable
              accessibilityLabel="지출 날짜 변경"
              accessibilityRole="button"
              onPress={() => setShowDatePicker((value) => !value)}
              style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>{expenseDate.label}</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>{showDatePicker ? "닫기" : "날짜 변경"}</Text>
            </Pressable>
          ) : (
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>{expenseDate.label}</Text>
            </View>
          )}
          <View style={{ backgroundColor: "rgba(74, 63, 53, 0.12)", height: 1 }} />
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setAmountText(value.replace(/[^0-9]/g, ""))}
            style={{ color: theme.colors.gray900, fontSize: 30, fontWeight: "800", paddingVertical: 0 }}
            value={formattedAmount}
          />
        </View>

        {authToken && showDatePicker ? (
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentDateChips.map((chip) => (
                <CategoryChip
                  key={chip.iso}
                  label={chip.shortLabel}
                  selected={!customDateMode && chip.iso === expenseDateIso}
                  onPress={() => {
                    setExpenseDateIso(chip.iso);
                    setCustomDateMode(false);
                    setCustomDateText("");
                  }}
                />
              ))}
            </ScrollView>
            <Pressable onPress={() => setCustomDateMode((value) => !value)}>
              <Text style={{ color: theme.colors.mainCoral, fontSize: 12, fontWeight: "700" }}>
                {customDateMode ? "최근 날짜에서 선택" : "직접 입력"}
              </Text>
            </Pressable>
            {customDateMode ? (
              <View style={{ gap: 6 }}>
                <TextInput
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^0-9-]/g, "").slice(0, 10);
                    setCustomDateText(cleaned);
                    if (cleaned.length > 0) {
                      const error = validateExpenseDateInput(cleaned);
                      if (!error) setExpenseDateIso(cleaned);
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  style={{
                    backgroundColor: theme.colors.white,
                    borderColor: dateInputError ? theme.colors.danger : "rgba(74, 63, 53, 0.10)",
                    borderRadius: 14,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    minHeight: 44,
                    paddingHorizontal: 14
                  }}
                  value={customDateText}
                />
                {dateInputError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{dateInputError}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {authToken && savedPresets.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>고정 품목</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {savedPresets.map((preset) => (
                <CategoryChip
                  key={preset.id}
                  label={`${preset.pinned ? "고정 · " : ""}${preset.itemName}${preset.defaultAmountKrw ? ` · ${preset.defaultAmountKrw.toLocaleString("ko-KR")}원` : ""}`}
                  onPress={() => {
                    setItemName(preset.itemName);
                    if (preset.defaultAmountKrw) setAmountText(String(preset.defaultAmountKrw));
                    const matchedCategory = quickExpenseCategories.find((category) => category.id === preset.categoryId);
                    if (matchedCategory) setSelectedCategory(matchedCategory);
                    if (householdId) void recordQuickExpensePresetUse(authToken, householdId, preset.id).catch(() => undefined);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {authToken && recentItemChips.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>최근 품목</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentItemChips.map((chip) => (
                <CategoryChip
                  key={chip.itemName}
                   label={`${chip.itemName} · 지난번 ${chip.lastAmountKrw.toLocaleString("ko-KR")}원`}
                   onPress={() => {
                     setItemName(chip.itemName);
                     setAmountText("");
                    const matchedCategory = quickExpenseCategories.find((category) => category.id === chip.categoryId);
                    if (matchedCategory) setSelectedCategory(matchedCategory);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {authToken ? (
          <TextInput
            onChangeText={setItemName}
            placeholder="품목명 (예: 기저귀)"
            style={{
              backgroundColor: theme.colors.white,
              borderColor: "rgba(74, 63, 53, 0.10)",
              borderRadius: 14,
              borderWidth: 1,
              color: theme.colors.brown,
              fontSize: 14,
              fontWeight: "700",
              minHeight: 48,
              paddingHorizontal: 14
            }}
            value={itemName}
          />
        ) : (
          <View style={{ display: "none" }}>
            <TextInput onChangeText={setItemName} value={itemName} />
          </View>
        )}

        <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>빠른 품목</Text>
        <View style={quickExpenseCategoryGridStyle.grid}>
          {quickExpenseItems.map((item) => {
            const selected = item.label === itemName;
            return (
              <ExpenseCategoryIconButton
                key={item.label}
                selected={selected}
                item={item}
                onPress={() => {
                  setSelectedCategory(item.category);
                  setItemName(item.label);
                }}
              />
            );
          })}
        </View>

        <Pressable
          accessibilityLabel="추가 정보 열기"
          accessibilityRole="button"
          onPress={() => setShowAdditionalFields((value) => !value)}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: theme.touchTarget,
            paddingHorizontal: 4
          }}
        >
          <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>추가 정보</Text>
          <AppIcon name={showAdditionalFields ? "chevron-up" : "chevron-down"} size={22} />
        </Pressable>

        {showAdditionalFields ? <>
        {!showPaymentEvidence ? <>
        <ExpenseAttributionField />
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {quickExpenseCategories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.label}
                selected={selectedCategory.id === category.id}
                onPress={() => setSelectedCategory(category)}
              />
            ))}
          </ScrollView>
        </View>
        <TextInput
          onChangeText={setMemo}
          placeholder="메모를 입력해 주세요 (선택)"
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            color: theme.colors.brown,
            minHeight: 48,
            paddingHorizontal: 14
          }}
          value={memo}
        />
        </> : null}

        <View accessibilityLabel={showPaymentEvidence ? "EXP-PAY-001" : undefined}>
          <Pressable
            accessibilityLabel="결제 수단 변경"
            accessibilityRole="button"
            onPress={() => setPaymentMethodIndex((value) => (value + 1) % paymentMethodOptions.length)}
            style={{
              backgroundColor: theme.colors.white,
              borderColor: "rgba(74, 63, 53, 0.10)",
              borderRadius: 14,
              borderWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 16
            }}
          >
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>결제 수단</Text>
              <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{paymentMethod.label}</Text>
            </View>
            <AppIcon color={theme.colors.gray600} name="chevron-right" size={22} />
          </Pressable>
        </View>

        {authToken ? (
          <Pressable
            accessibilityLabel="선물로 받았어요"
            accessibilityRole="checkbox"
            onPress={() => setIsGift((value) => !value)}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.white,
              borderColor: "rgba(74, 63, 53, 0.10)",
              borderRadius: 14,
              borderWidth: 1,
              flexDirection: "row",
              gap: 10,
              padding: 14
            }}
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
        </> : null}

        {saveExpense.isError ? <Toast message="금액과 항목을 확인해 주세요." tone="error" /> : null}
        {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}
          <PrimaryButton
            disabled={saveExpense.isPending || isSaveInvalid}
            label={saveExpense.isPending ? "저장 중" : "저장하기"}
            onPress={() => saveExpense.mutate()}
          />
        </BottomSheetFrame>
      </View>
    </AppScreen>
  );
}
