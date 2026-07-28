import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getExpense, getExpensePlanLinkSuggestions, linkExpensePlan, listPaymentMethods, fixtureSessionToken, type Expense } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { buildRecentExpenseDateChips, formatExpenseAmountInput, formatExpenseDate, sanitizeExpenseAmountText, validateExpenseDateInput, validateExpenseForm } from "../../src/expenses/form-contract";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { writableExpenseType } from "../../src/offline/expense-payload";
import { adoptServerExpense, deleteExpenseOffline, updateExpenseOffline } from "../../src/offline/sync-controller";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon, AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, ScreenHeader, SecondaryButton, Toast } from "../../src/ui";
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  const recentDateChips = buildRecentExpenseDateChips(today);
  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.4): an expense loaded here came from the normal
  // server/local-session getExpense call, so it has no offline local_expenses row yet. Editing
  // or deleting it needs to route through the same outbox/expectedVersion pipeline as an
  // offline-authored expense, so it's "adopted" into the local table (as an already-synced row)
  // the first time it loads -- see sync-controller.ts's adoptServerExpense.
  const [localExpenseId, setLocalExpenseId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountDigits(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
    setSpentOnIso(expense.data.spentOn);
    setCategoryId(expense.data.categoryId);
    setExpenseType(expense.data.expenseType);
    setPaymentMethodId(expense.data.paymentMethodId ?? null);
    setLocalExpenseId(null);
    void adoptServerExpense(expense.data).then((row) => setLocalExpenseId(row.localId));
  }, [expense.data]);

  const formValidation = validateExpenseForm({ itemName, amountText: amountDigits, spentOn: spentOnIso });
  const { amountKrw, itemNameError } = formValidation;
  const amountError = amountDigits.length > 0 ? formValidation.amountError : null;
  const dateInputError = customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  const canSave = formValidation.valid && !dateInputError && Boolean(authToken && expenseId && localExpenseId);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId || !formValidation.valid || Boolean(dateInputError)) {
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
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      setTimeout(() => router.replace("/(tabs)/records"), 650);
    }
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId) throw new Error("missing expense");
      return deleteExpenseOffline(authToken, queryClient, localExpenseId);
    },
    onSuccess: async () => {
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      setTimeout(() => router.replace("/(tabs)/records"), 650);
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
    Alert.alert("지출 삭제", "이 지출 기록을 삭제할까요?", [
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
  const selectedPaymentMethod = paymentMethodOptions.find((method) => method.id === paymentMethodId) ?? paymentMethodOptions[0];
  const cyclePaymentMethod = () => {
    const currentIndex = paymentMethodOptions.findIndex((method) => method.id === selectedPaymentMethod.id);
    const next = paymentMethodOptions[(currentIndex + 1) % paymentMethodOptions.length];
    setPaymentMethodId(next.id);
  };

  return (
    <AppScreen>
      <View accessibilityLabel={expenseDetailScreenId} testID="screen-EXP-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="지출 상세" title="지출 수정" subtitle="품목과 금액을 확인하고 수정할 수 있어요." />

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
                  onChangeText={setItemName}
                  placeholder="품목"
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
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{itemNameError}</Text>
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
                    keyboardType="number-pad"
                    onChangeText={(value) => setAmountDigits(sanitizeExpenseAmountText(value))}
                    placeholder="금액"
                    style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize }}
                    value={formatExpenseAmountInput(amountDigits)}
                  />
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    원
                  </Text>
                </View>
                {amountError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  날짜
                </Text>
                <Pressable
                  accessibilityLabel="지출 날짜 변경"
                  accessibilityRole="button"
                  onPress={() => setShowDatePicker((value) => !value)}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.beige,
                    borderRadius: theme.radii.small,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {spentOnLabel}
                  </Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>
                    {showDatePicker ? "닫기" : "날짜 변경"}
                  </Text>
                </Pressable>
                {showDatePicker ? (
                  <View style={{ gap: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {recentDateChips.map((chip) => (
                        <CategoryChip
                          key={chip.iso}
                          label={chip.shortLabel}
                          selected={!customDateMode && chip.iso === spentOnIso}
                          onPress={() => {
                            setSpentOnIso(chip.iso);
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
                              if (!error) setSpentOnIso(cleaned);
                            }
                          }}
                          placeholder="YYYY-MM-DD"
                          style={{
                            backgroundColor: theme.colors.beige,
                            borderColor: dateInputError ? theme.colors.danger : "transparent",
                            borderRadius: theme.radii.small,
                            borderWidth: 1,
                            color: theme.colors.brown,
                            minHeight: theme.touchTarget,
                            paddingHorizontal: 14
                          }}
                          value={customDateText}
                        />
                        {dateInputError ? (
                          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>
                            {dateInputError}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  카테고리
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categoryCatalog.map((category) => (
                    <CategoryChip
                      key={category.id}
                      label={`${category.icon} ${category.label}`}
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
                  onChangeText={setMemo}
                  placeholder="메모를 입력해 주세요"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderRadius: theme.radii.small,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={memo}
                />
              </View>

              <Pressable
                accessibilityLabel="결제수단 변경"
                accessibilityRole="button"
                onPress={cyclePaymentMethod}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.beige,
                  borderRadius: theme.radii.small,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  minHeight: theme.touchTarget,
                  paddingHorizontal: 14
                }}
              >
                <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>결제수단</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>
                    {selectedPaymentMethod.label}{selectedPaymentMethod.active ? "" : " (숨김)"}
                  </Text>
                  <AppIcon color={theme.colors.brown} name="chevron-right" size={20} />
                </View>
              </Pressable>

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
                    <SecondaryButton label="이 준비 계획과 연결" disabled={linkPlan.isPending} onPress={() => linkPlan.mutate(suggestion)} />
                  </View>
                ))}
              </Card>
            ) : null}

            {save.isError || remove.isError ? (
              <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" />
            ) : null}
            {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}

            <PrimaryButton
              disabled={!canSave || save.isPending}
              label={save.isPending ? "저장하는 중" : "수정 저장"}
              onPress={() => save.mutate()}
            />
            <Pressable
              accessibilityRole="button"
              disabled={remove.isPending}
              onPress={confirmDelete}
              style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
            >
              <Text style={{ color: remove.isPending ? theme.colors.gray300 : theme.colors.danger, fontWeight: "700" }}>
                {remove.isPending ? "삭제하는 중" : "이 지출 삭제하기"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </AppScreen>
  );
}
