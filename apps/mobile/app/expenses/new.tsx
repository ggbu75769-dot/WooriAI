import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildExpenseRecordedPayload } from "../../src/analytics/events";
import { listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { clearQuickExpenseDraft, readQuickExpenseDraft, writeQuickExpenseDraft } from "../../src/expenses/draft-storage";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { createExpenseOffline } from "../../src/offline/sync-controller";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, BottomSheetFrame, CategoryChip, PrimaryButton, Toast } from "../../src/ui";
import { theme } from "../../src/theme";
import { QuickExpensePixelStyles } from "../../src/pixelLock/styles";

const quickExpenseScreenId = "pixel-screen-EXP-001 EXP-001";
const quickExpenseAmountPreview = "₩ 38,500";
// Fixed date used only when there's no session (preview / pixel-lock capture mode) so the
// pixel-lock reference screenshot stays deterministic across runs. See src/android-native-ui-quality.test.ts.
const previewExpenseDate = { iso: "2025-05-24", label: "2025. 05. 24 (토)" };
// Single source of truth for the 8 category tiles lives in src/categories.ts -- each entry
// has a distinct, deterministic `id` so tapping different tiles records different categoryIds
// (previously all 8 shared one literal id and broke category aggregation).
const quickExpenseCategories = categoryCatalog;
// UX-5B-3: 결제 수단은 서버에 enum으로 저장된다 (createExpense body.paymentMethod) --
// 실제 저장 값과 무관한 가짜 은행명("카카오뱅크") 대신 저장되는 값 그대로의 라벨을 보여준다.
const quickExpensePaymentMethods = [
  { value: "card", label: "카드" },
  { value: "cash", label: "현금" },
  { value: "transfer", label: "계좌 이체" },
  { value: "mobile_pay", label: "모바일 결제" }
] as const;

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

// Calendar-valid check for a user-typed YYYY-MM-DD string: `new Date(year, month-1, day)` silently
// rolls invalid days (e.g. 2026-02-31) into the following month, so we re-derive the parts from the
// constructed Date and require them to match the input exactly.
function isValidCalendarDate(dateOnly: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Validates a manually-typed expense date: format, calendar validity, then future-date rejection
// (reusing the same isFutureSeoulDate the server/local-backend enforce so the two never disagree).
function validateExpenseDateInput(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(dateOnly)) return "존재하지 않는 날짜예요.";
  try {
    if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";
  } catch {
    return "날짜를 다시 확인해 주세요.";
  }
  return null;
}

function buildRecentDateChips(today: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const formatted = formatExpenseDate(date);
    const shortLabel = index === 0 ? "오늘" : index === 1 ? "어제" : index === 2 ? "그제" : `${date.getMonth() + 1}/${date.getDate()}`;
    return { iso: formatted.iso, shortLabel };
  });
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

type QuickExpenseCategory = (typeof quickExpenseCategories)[number];

function ExpenseCategoryIconButton({
  category,
  onPress,
  selected
}: {
  category: QuickExpenseCategory;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={quickExpenseCategoryTileStyle.button}>
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        <Text style={[quickExpenseCategoryTileStyle.iconText, selected ? quickExpenseCategoryTileStyle.iconTextSelected : null]}>{category.icon}</Text>
      </View>
      <Text numberOfLines={1} style={quickExpenseCategoryTileStyle.label}>
        {category.label}
      </Text>
    </Pressable>
  );
}

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ itemName?: string; itemTemplateId?: string }>();
  const linkedItemTemplateId = params.itemTemplateId ? String(params.itemTemplateId) : undefined;
  const prefilledItemName = params.itemName ? String(params.itemName) : "";
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  // Preview/pixel-lock capture (no session) keeps the fixed "기저귀"/"38500" seed so the
  // reference screenshot stays deterministic. A real or test session starts blank so opening
  // the sheet never silently records a 38,500원 지출 the user didn't enter (see save-button
  // disabled guard below). A session that arrived from "준비템 -> 지출도 기록하기" prefills the
  // item name from the prepared-item template instead (see items/[itemTemplateId].tsx).
  const [itemName, setItemName] = useState(() => (authToken ? prefilledItemName : "기저귀"));
  const [amountText, setAmountText] = useState(() => (authToken ? "" : "38500"));
  const [memo, setMemo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(quickExpenseCategories[0]);
  const [paymentMethodIndex, setPaymentMethodIndex] = useState(0);
  const [isGift, setIsGift] = useState(false);
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
  const recentDateChips = buildRecentDateChips(today);
  // Only meaningful while a real/test session is picking a manually-typed date; null means
  // either preview mode, chip-only selection, or an empty (not-yet-typed) custom field.
  const dateInputError =
    authToken && customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const paymentMethod = quickExpensePaymentMethods[paymentMethodIndex];
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();

  // Restores a saved quick-expense draft on mount, so a user who closes the sheet mid-entry
  // (e.g. interrupted by a call) doesn't lose what they typed. Skipped in pixel-lock capture
  // mode, and skipped whenever the sheet was opened with an explicit prefill (typed item name
  // or a "준비템 -> 지출도 기록하기" template link) so a stale draft never clobbers that intent.
  // Runs once on mount only -- guard conditions are read from the initial render's closure.
  useEffect(() => {
    if (!authToken) return;
    if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") return;
    if (prefilledItemName) return;
    if (linkedItemTemplateId) return;
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

  // Recent expense items for the "최근 품목" reuse chips -- reuses the existing listExpenses
  // query (current month) instead of a dedicated endpoint; deduped by itemName, capped at 5.
  const recentExpensesQuery = useQuery({
    queryKey: ["expenses", "recent-items", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenses(authToken!, childId!)
  });
  const recentItemChips = (() => {
    const seen = new Set<string>();
    const chips: Array<{ itemName: string; amountKrw: number; categoryId: string }> = [];
    for (const expense of recentExpensesQuery.data?.expenses ?? []) {
      if (seen.has(expense.itemName)) continue;
      seen.add(expense.itemName);
      chips.push({ itemName: expense.itemName, amountKrw: expense.amountKrw, categoryId: expense.categoryId });
      if (chips.length >= 5) break;
    }
    return chips;
  })();

  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.3): saves to the local offline store first --
  // this always "succeeds" as soon as the local write lands, well before the server has
  // confirmed anything, so the sheet shows OFFLINE_SAVED_MESSAGE here and never the
  // server-confirmed copy (that one only fires later, from a background flush -- see
  // src/offline/sync-controller.ts's flash-message wiring, surfaced on the records screen).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const saveExpense = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error("invalid expense");
      }
      return createExpenseOffline(authToken, queryClient, {
        childId,
        categoryId: selectedCategory.id,
        amountKrw,
        spentOn: expenseDate.iso,
        itemName,
        paymentMethod: paymentMethod.value,
        memo,
        expenseType: isGift ? "gift" : "expense",
        ...(linkedItemTemplateId ? { linkedItemTemplateId } : {})
      });
    },
    onSuccess: async () => {
      clearQuickExpenseDraft();
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      // ANA-103: expense_recorded fires once per successful (local-first) create. The payload is
      // PII-safe by construction (src/analytics/events.ts): the raw amount is bucketed and the
      // categoryId mapped to the coarse enum on-device; itemName/memo never enter it. `source`
      // distinguishes the "준비템 -> 지출도 기록하기" follow-up flow from a plain manual entry,
      // and `offline` reports the connectivity at record time (the create itself always succeeds
      // locally first -- see createExpenseOffline). A no-op without ANA-102 consent.
      const recordedAmountKrw = Number(amountText);
      const recordedCategoryId = selectedCategory.id;
      const recordedSource = linkedItemTemplateId ? "followup" : "manual";
      void isCurrentlyOnline().then((online) => {
        trackAndFlushAnalyticsEvent(authToken, {
          eventName: "expense_recorded",
          payload: buildExpenseRecordedPayload({
            categoryId: recordedCategoryId,
            amountKrw: recordedAmountKrw,
            source: recordedSource,
            offline: !online
          }),
          platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
        });
      });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      setTimeout(() => router.replace("/(tabs)/records"), 650);
    }
  });
  const formattedAmount = amountText === "38500" ? quickExpenseAmountPreview : `₩ ${Number(amountText || 0).toLocaleString("ko-KR")}`;
  // Guards the one-tap quick-expense sheet: with a real/test session, the save button stays
  // disabled until a positive amount has actually been entered (and any manually-typed date is
  // valid), so opening the sheet can never by itself create an expense. Preview mode (authToken
  // null) is unaffected -- amountText is always the fixed "38500" seed there, so isAmountInvalid
  // is always false.
  const amountKrwValue = Number(amountText);
  const isAmountInvalid =
    Boolean(authToken) && (!amountText || !Number.isInteger(amountKrwValue) || amountKrwValue <= 0 || Boolean(dateInputError));

  return (
    <AppScreen>
      <View style={quickExpensePixelFrameStyle()}>
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
        <View accessibilityLabel={quickExpenseScreenId} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 40 }}>
          <Pressable
            onPress={() => {
              clearQuickExpenseDraft();
              router.back();
            }}
            style={{ minWidth: 36 }}
          >
            <Text style={{ color: theme.colors.gray900, fontSize: 24 }}>×</Text>
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

        {authToken && recentItemChips.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>최근 품목</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentItemChips.map((chip) => (
                <CategoryChip
                  key={chip.itemName}
                  label={`${chip.itemName} · ${chip.amountKrw.toLocaleString("ko-KR")}원`}
                  onPress={() => {
                    setItemName(chip.itemName);
                    setAmountText(String(chip.amountKrw));
                    const matchedCategory = quickExpenseCategories.find((category) => category.id === chip.categoryId);
                    if (matchedCategory) setSelectedCategory(matchedCategory);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={quickExpenseCategoryGridStyle.grid}>
          {quickExpenseCategories.map((category) => {
            const selected = category.label === selectedCategory.label;
            return (
              <ExpenseCategoryIconButton
                key={`${category.id}-${category.label}`}
                selected={selected}
                category={category}
                onPress={() => {
                  setSelectedCategory(category);
                  setItemName(category.label);
                }}
              />
            );
          })}
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

        <Pressable
          accessibilityLabel="결제 수단 변경"
          accessibilityRole="button"
          onPress={() => setPaymentMethodIndex((value) => (value + 1) % quickExpensePaymentMethods.length)}
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
          <Text style={{ color: theme.colors.gray600, fontSize: 18 }}>›</Text>
        </Pressable>

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
              {isGift ? <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "900" }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>선물로 받았어요</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>선물은 지출 합계에 포함되지 않아요</Text>
            </View>
          </Pressable>
        ) : null}

        {saveExpense.isError ? <Toast message="금액과 항목을 확인해 주세요." tone="error" /> : null}
        {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}
          <PrimaryButton
            disabled={saveExpense.isPending || isAmountInvalid}
            label={saveExpense.isPending ? "저장 중" : "저장하기"}
            onPress={() => saveExpense.mutate()}
          />
        </BottomSheetFrame>
      </View>
    </AppScreen>
  );
}
