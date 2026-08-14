import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { getSeoulToday } from "@wooriai/domain";
import { getExpense, getExpensePlanLinkSuggestions, linkExpensePlan, listPaymentMethods, fixtureSessionToken, type Expense } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { TopAppBar } from "../../src/design-system";
import { buildRecentExpenseDateChips, EXPENSE_AMOUNT_MAX_DIGITS, EXPENSE_MEMO_MAX_LENGTH, formatExpenseAmountInput, formatExpenseDate, sanitizeExpenseAmountText, validateExpenseForm, validateExpenseMemo } from "../../src/expenses/form-contract";
import { formatKrw } from "../../src/money";
import { PaymentMethodPicker } from "../../src/expenses/PaymentMethodPicker";
import { useConfirmDiscardChanges } from "../../src/navigation/use-confirm-discard-changes";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { writableExpenseType } from "../../src/offline/expense-payload";
import { adoptServerExpense, deleteExpenseOffline, updateExpenseOffline } from "../../src/offline/sync-controller";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon, AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, SecondaryButton, Toast, type AppIconName } from "../../src/ui";
import { theme } from "../../src/theme";

const expenseDetailScreenId = "EXP-003";

export default function ExpenseDetailScreen() {
  const params = useLocalSearchParams<{ expenseId?: string }>();
  const expenseId = String(params.expenseId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const expense = useQuery({
    queryKey: ["expense", expenseId],
    enabled: Boolean(authToken && expenseId),
    queryFn: () => getExpense(authToken!, expenseId)
  });
  const paymentMethods = useQuery({
    queryKey: ["payment-methods"],
    enabled: Boolean(authToken),
    queryFn: () => listPaymentMethods(authToken!)
  });
  const linkSuggestions = useQuery({
    queryKey: ["expense-plan-link-suggestions", expenseId, expense.data?.version],
    enabled: Boolean(authToken && expense.data && !expense.data.linkedItemDefinitionId && !isTestSession),
    queryFn: () => getExpensePlanLinkSuggestions(authToken!, expenseId)
  });
  const [itemName, setItemName] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [memo, setMemo] = useState("");
  const [spentOnIso, setSpentOnIso] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expenseType, setExpenseType] = useState<Expense["expenseType"]>("expense");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [showDateOptions, setShowDateOptions] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  const recentDateChips = buildRecentExpenseDateChips(today);
  const maximumExpenseDate = new Date(`${recentDateChips[2]!.iso}T12:00:00`);
  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.4): an expense loaded here came from the normal
  // server/local-session getExpense call, so it has no offline local_expenses row yet. Editing
  // or deleting it needs to route through the same outbox/expectedVersion pipeline as an
  // offline-authored expense, so it's "adopted" into the local table (as an already-synced row)
  // the first time it loads -- see sync-controller.ts's adoptServerExpense.
  const [localExpenseId, setLocalExpenseId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryChipXById = useRef<Record<string, number>>({});
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
  }, []);

  const revealSelectedCategory = useCallback((selectedCategoryId: string) => {
    const chipX = categoryChipXById.current[selectedCategoryId];
    if (chipX === undefined) return;
    categoryScrollRef.current?.scrollTo({
      animated: false,
      x: Math.max(0, chipX - theme.spacing.card)
    });
  }, []);

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountDigits(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
    setSpentOnIso(expense.data.spentOn);
    setCategoryId(expense.data.categoryId);
    setExpenseType(expense.data.expenseType);
    setPaymentMethodId(expense.data.paymentMethodId ?? null);
    setAllowExit(false);
    setLocalExpenseId(null);
    void adoptServerExpense(expense.data).then((row) => setLocalExpenseId(row.localId));
  }, [expense.data]);

  useEffect(() => {
    if (categoryId) revealSelectedCategory(categoryId);
  }, [categoryId, revealSelectedCategory]);

  const formValidation = validateExpenseForm({ itemName, amountText: amountDigits, spentOn: spentOnIso });
  const { amountKrw, itemNameError } = formValidation;
  const amountError = amountDigits.length > 0 ? formValidation.amountError : null;
  const memoError = validateExpenseMemo(memo);
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  const hasChanges = Boolean(expense.data && (
    itemName.trim() !== expense.data.itemName ||
    amountKrw !== expense.data.amountKrw ||
    memo !== (expense.data.memo ?? "") ||
    spentOnIso !== expense.data.spentOn ||
    categoryId !== expense.data.categoryId ||
    paymentMethodId !== (expense.data.paymentMethodId ?? null) ||
    expenseType !== expense.data.expenseType
  ));
  const canSave = formValidation.valid && !memoError && hasChanges && Boolean(authToken && expenseId && localExpenseId);
  useConfirmDiscardChanges(hasChanges && !allowExit);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId || !formValidation.valid || memoError) {
        throw new Error("invalid expense");
      }
      return updateExpenseOffline(authToken, queryClient, localExpenseId, {
        amountKrw,
        itemName: itemName.trim(),
        memo,
        spentOn: spentOnIso || undefined,
        categoryId: categoryId || undefined,
        paymentMethodId,
        expenseType: writableExpenseType(expenseType)
      });
    },
    onSuccess: async () => {
      setAllowExit(true);
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        router.replace("/(tabs)/records");
      }, 250);
    }
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId) throw new Error("missing expense");
      return deleteExpenseOffline(authToken, queryClient, localExpenseId);
    },
    onSuccess: async () => {
      setAllowExit(true);
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        router.replace("/(tabs)/records");
      }, 250);
    }
  });
  const linkPlan = useMutation({
    mutationFn: (suggestion: { planId: string; reasonCodes: string[] }) => linkExpensePlan(authToken!, expenseId, {
      planId: suggestion.planId,
      expectedVersion: expense.data!.version,
      reasonCode: suggestion.reasonCodes[0] ?? "explicit_item"
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expense", expenseId] });
      await queryClient.invalidateQueries({ queryKey: ["report-v3"] });
    }
  });

  function confirmDelete() {
    const recordLabel = expense.data
      ? `${expense.data.itemName} · ${formatKrw(expense.data.amountKrw)} · ${formatExpenseDate(new Date(`${expense.data.spentOn}T00:00:00`)).label}`
      : "이 지출 기록";
    Alert.alert("지출 기록 삭제", `${recordLabel}\n삭제하면 기록 목록에서 사라집니다.`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => remove.mutate() }
    ]);
  }

  const registeredPaymentMethods = paymentMethods.data?.paymentMethods ?? [];
  const currentInactivePaymentMethod = registeredPaymentMethods.find(
    (method) => method.id === paymentMethodId && !method.active
  );
  const paymentMethodOptions = [
    { id: null, label: "미지정", active: true },
    ...registeredPaymentMethods.filter((method) => method.active),
    ...(currentInactivePaymentMethod ? [currentInactivePaymentMethod] : [])
  ];

  const selectExpenseCalendarDate = (date: Date | undefined) => {
    if (!date) return;
    setSpentOnIso(formatExpenseDate(date).iso);
    setShowIosDatePicker(false);
  };

  const openExpenseCalendar = () => {
    const value = new Date(`${spentOnIso || recentDateChips[1]!.iso}T12:00:00`);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        maximumDate: maximumExpenseDate,
        mode: "date",
        onChange: (_event, date) => selectExpenseCalendarDate(date)
      });
      return;
    }
    setShowIosDatePicker((visible) => !visible);
  };

  return (
    <AppScreen>
      <View accessibilityLabel={expenseDetailScreenId} testID="screen-EXP-003" style={{ gap: theme.spacing.section }}>
        <View style={{ gap: 4 }}>
          <TopAppBar eyebrow="지출 상세" onBack={() => router.back()} title="지출 수정" />
          <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body2.fontSize }}>품목과 금액을 확인하고 수정할 수 있어요.</Text>
        </View>

        {expense.isLoading ? (
          <EmptyStateCard title="불러오고 있어요." actionLabel="잠시만요" />
        ) : expense.isError ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => expense.refetch()}
          />
        ) : (
          <>
            <Card style={{ gap: theme.spacing.gap }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  품목
                </Text>
                <TextInput
                  accessibilityLabel="지출 품목명"
                  maxLength={80}
                  onChangeText={setItemName}
                  placeholder="품목명을 입력해 주세요"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: itemNameError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={itemName}
                />
                {itemNameError ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{itemNameError}</Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  금액
                </Text>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.beige,
                    borderColor: amountError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 4,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                >
                  <TextInput
                    accessibilityLabel="지출 금액"
                    accessibilityValue={{ text: formatExpenseAmountInput(amountDigits) || "미입력" }}
                    keyboardType="number-pad"
                    onChangeText={(value) => setAmountDigits(sanitizeExpenseAmountText(value).slice(0, EXPENSE_AMOUNT_MAX_DIGITS))}
                    placeholder="금액"
                    style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize }}
                    value={formatExpenseAmountInput(amountDigits)}
                  />
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    원
                  </Text>
                </View>
                {amountError ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  날짜
                </Text>
                <Pressable
                  accessibilityLabel={`지출 날짜 변경. 현재 ${spentOnLabel}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showDateOptions }}
                  onPress={() => setShowDateOptions((visible) => !visible)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: theme.colors.beige,
                    borderRadius: theme.radii.small,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: theme.touchTarget,
                    opacity: pressed ? 0.82 : 1,
                    paddingHorizontal: 14
                  })}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {spentOnLabel}
                  </Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>
                    {showDateOptions ? "닫기" : "날짜 변경"}
                  </Text>
                </Pressable>
                {showDateOptions ? (
                  <View style={{ gap: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {recentDateChips.map((chip) => (
                        <CategoryChip
                          key={chip.iso}
                          label={chip.shortLabel}
                          selected={chip.iso === spentOnIso}
                          onPress={() => {
                            setSpentOnIso(chip.iso);
                            setShowIosDatePicker(false);
                          }}
                        />
                      ))}
                    </ScrollView>
                    <Pressable
                      accessibilityLabel="달력에서 다른 지출 날짜 선택"
                      accessibilityRole="button"
                      onPress={openExpenseCalendar}
                      style={({ pressed }) => ({
                        alignItems: "center",
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        gap: 6,
                        minHeight: theme.touchTarget,
                        opacity: pressed ? 0.76 : 1
                      })}
                    >
                      <AppIcon color={theme.colors.mainCoral} name="calendar-blank-outline" size={20} />
                      <Text style={{ color: theme.colors.mainCoral, fontSize: 12, fontWeight: "700" }}>
                        달력에서 다른 날짜 선택
                      </Text>
                    </Pressable>
                    {Platform.OS === "ios" && showIosDatePicker ? (
                      <DateTimePicker
                        maximumDate={maximumExpenseDate}
                        mode="date"
                        onChange={(_event, date) => selectExpenseCalendarDate(date)}
                        value={new Date(`${spentOnIso || recentDateChips[1]!.iso}T12:00:00`)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  카테고리
                </Text>
                <ScrollView
                  ref={categoryScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {categoryCatalog.map((category) => (
                    <CategoryChip
                      icon={category.icon as AppIconName}
                      key={category.id}
                      label={category.label}
                      onLayout={(event) => {
                        categoryChipXById.current[category.id] = event.nativeEvent.layout.x;
                        if (category.id === categoryId) revealSelectedCategory(category.id);
                      }}
                      selected={category.id === categoryId}
                      onPress={() => setCategoryId(category.id)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  메모 (선택)
                </Text>
                <TextInput
                  accessibilityHint={memoError ?? `최대 ${EXPENSE_MEMO_MAX_LENGTH}자`}
                  accessibilityLabel="지출 메모"
                  maxLength={EXPENSE_MEMO_MAX_LENGTH}
                  onChangeText={(value) => setMemo(value.slice(0, EXPENSE_MEMO_MAX_LENGTH))}
                  placeholder="메모를 입력해 주세요"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: memoError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={memo}
                />
                <Text accessibilityLiveRegion="polite" style={{ color: memoError ? theme.colors.danger : theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "right" }}>
                  {memoError ?? `${memo.length}/${EXPENSE_MEMO_MAX_LENGTH}자`}
                </Text>
              </View>

              <PaymentMethodPicker
                onSelect={setPaymentMethodId}
                options={paymentMethodOptions.map((option) => ({ id: option.id, label: option.label, unavailable: !option.active }))}
                selectedId={paymentMethodId}
              />

              {expenseType === "refund" || expenseType === "support" ? (
                <View
                  accessibilityLabel={`${expenseType === "refund" ? "환불" : "지원금"} 기록. 유형은 유지됩니다.`}
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderRadius: 14,
                    gap: 4,
                    minHeight: theme.touchTarget,
                    padding: 14
                  }}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>
                    {expenseType === "refund" ? "환불 기록" : "지원금 기록"}
                  </Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>
                    금액과 메모를 수정해도 이 정산 유형은 유지돼요.
                  </Text>
                </View>
              ) : (
                <Pressable
                  accessibilityLabel="선물로 받았어요"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: expenseType === "gift" }}
                  onPress={() => setExpenseType((value) => value === "gift" ? "expense" : "gift")}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.white,
                    borderColor: "rgba(74, 63, 53, 0.10)",
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 10,
                    minHeight: theme.touchTarget,
                    padding: 14
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: expenseType === "gift" ? theme.colors.mainCoral : theme.colors.white,
                      borderColor: expenseType === "gift" ? theme.colors.mainCoral : theme.colors.gray300,
                      borderRadius: 6,
                      borderWidth: 2,
                      height: 22,
                      justifyContent: "center",
                      width: 22
                    }}
                  >
                    {expenseType === "gift" ? <AppIcon color={theme.colors.white} name="check" size={16} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>선물로 받았어요</Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>선물은 지출 합계에 포함되지 않아요</Text>
                  </View>
                </Pressable>
              )}
            </Card>

            {!isTestSession && expense.data?.linkedItemDefinitionId ? (
              <Card><Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>준비 계획과 연결됨</Text><Text style={{ color: theme.colors.gray600, fontSize: 13 }}>Report의 예정 대비 실제 비용에 바로 반영돼요.</Text></Card>
            ) : !isTestSession && linkSuggestions.data?.suggestions.length ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>관련 준비 계획 제안</Text>
                <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>자동 연결하지 않아요. 확인한 항목만 연결됩니다.</Text>
                {linkSuggestions.data.suggestions.slice(0, 3).map((suggestion) => (
                  <View key={suggestion.planId} style={{ gap: 6 }}>
                    <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{suggestion.itemName}</Text>
                    <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{suggestion.explanation}</Text>
                    <SecondaryButton label={linkPlan.isPending ? "연결하는 중" : "이 준비 계획과 연결"} disabled={linkPlan.isPending} onPress={() => linkPlan.mutate(suggestion)} />
                  </View>
                ))}
              </Card>
            ) : null}

            {save.isError ? <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}
            {remove.isError ? <Toast message="삭제하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}
            {linkPlan.isError ? <Toast message="준비 계획과 연결하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}
            {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}

            <PrimaryButton
              disabled={!canSave || save.isPending || remove.isPending}
              label={save.isPending ? "저장하는 중" : !localExpenseId ? "수정 준비 중" : !hasChanges ? "변경 없음" : "수정 저장"}
              onPress={() => save.mutate()}
            />
            <Pressable
              accessibilityLabel={expense.data ? `${expense.data.itemName} 지출 기록 삭제` : "지출 기록 삭제"}
              accessibilityRole="button"
              accessibilityState={{ disabled: remove.isPending || save.isPending, busy: remove.isPending }}
              disabled={remove.isPending || save.isPending}
              onPress={confirmDelete}
              style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
            >
              <Text style={{ color: remove.isPending || save.isPending ? theme.colors.gray300 : theme.colors.danger, fontWeight: "700" }}>
                {remove.isPending ? "삭제하는 중" : save.isPending ? "저장하는 중" : "이 지출 삭제하기"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </AppScreen>
  );
}
