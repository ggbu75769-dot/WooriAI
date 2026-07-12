import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";
import { deleteExpense, getExpense, LOCAL_SESSION_TOKEN, updateExpense } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

const expenseDetailScreenId = "EXP-003";

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatAmount(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

// Calendar-valid check for a user-typed YYYY-MM-DD string -- `new Date(year, month-1, day)`
// silently rolls invalid days (e.g. 2026-02-31) into the following month, so we re-derive the
// parts from the constructed Date and require them to match the input exactly.
function isValidCalendarDate(dateOnly: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

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

export default function ExpenseDetailScreen() {
  const params = useLocalSearchParams<{ expenseId?: string }>();
  const expenseId = String(params.expenseId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const queryClient = useQueryClient();
  const expense = useQuery({
    queryKey: ["expense", expenseId],
    enabled: Boolean(authToken && expenseId),
    queryFn: () => getExpense(authToken!, expenseId)
  });
  const [itemName, setItemName] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [memo, setMemo] = useState("");
  const [spentOnIso, setSpentOnIso] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  const recentDateChips = buildRecentDateChips(today);

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountDigits(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
    setSpentOnIso(expense.data.spentOn);
    setCategoryId(expense.data.categoryId);
  }, [expense.data]);

  const amountKrw = Number(amountDigits || "0");
  const itemNameError = itemName.trim().length === 0 ? "품목을 입력해 주세요." : null;
  const amountError = amountDigits.length > 0 && amountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;
  const dateInputError = customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  const canSave = !itemNameError && !amountError && !dateInputError && amountKrw > 0 && Boolean(authToken && expenseId);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !expenseId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error("invalid expense");
      }
      return updateExpense(authToken, expenseId, {
        amountKrw,
        itemName: itemName.trim(),
        memo,
        spentOn: spentOnIso || undefined,
        categoryId: categoryId || undefined
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)/records");
    }
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!authToken || !expenseId) throw new Error("missing expense");
      return deleteExpense(authToken, expenseId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)/records");
    }
  });

  function confirmDelete() {
    Alert.alert("지출 삭제", "이 지출 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => remove.mutate() }
    ]);
  }

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
                    onChangeText={(value) => setAmountDigits(toDigits(value))}
                    placeholder="금액"
                    style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize }}
                    value={formatAmount(amountDigits)}
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
            </Card>

            {save.isError || remove.isError ? (
              <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." />
            ) : null}

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
