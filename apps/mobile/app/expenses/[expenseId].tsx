import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday, isFutureSeoulDate, isValidCalendarDate } from "@wooriai/domain";
import { getExpense, listCategories, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryCatalog, categoryNameFor, selectableCategories } from "../../src/categories";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { adoptServerExpense, deleteExpenseOffline, updateExpenseOffline } from "../../src/offline/sync-controller";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

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

// MOB-121: calendar validity comes from @wooriai/domain's isValidCalendarDate (same check the
// server/local-backend enforce). The wording intentionally differs from src/children/child-form.ts
// ("실제 존재하는 날짜인지 확인해 주세요.") — copy unification is out of scope (pixel-lock/test
// impact), so this screen keeps its existing message.
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
  // CAT-101/UX-5B-EXP: server-backed category list for the chip row (demo fixture categories in
  // a local test session -- see client.ts's listCategories). Categories are seed data that
  // changes rarely, so a generous staleTime avoids refetching on every edit-screen visit.
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listCategories(authToken!)
  });
  const [itemName, setItemName] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [memo, setMemo] = useState("");
  const [spentOnIso, setSpentOnIso] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  const recentDateChips = buildRecentDateChips(today);
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
    setIsGift(expense.data.expenseType === "gift");
    setLocalExpenseId(null);
    void adoptServerExpense(expense.data).then((row) => setLocalExpenseId(row.localId));
  }, [expense.data]);

  // Chip row source: the fetched category list when available; otherwise (query still loading,
  // or failing -- e.g. an offline real session) the static quick-expense catalog, so the row
  // never disappears and offline/preview editing keeps working. If the expense's current
  // categoryId isn't in whichever list is showing (legacy/inactive/demo-seed id), a chip for it
  // is prepended so preselection always has something to highlight and re-selecting it stays
  // possible.
  //
  // R20-B: the fetched list is passed through selectableCategories first -- `GET /categories`
  // returns all 21 active seed rows (12 canonical + 8 mobile aliases + 1 import stub), which put
  // "기타" on the row twice and offered the internal "가져오기 기본". The filter is display-only
  // (server response and every other screen are untouched) and always keeps this expense's
  // current categoryId, so the preselection above never loses its chip.
  const fetchedCategories = selectableCategories(categories.data?.categories ?? [], categoryId);
  const baseCategoryChips =
    fetchedCategories.length > 0
      ? fetchedCategories.map((category) => ({ id: category.id, label: category.name }))
      : categoryCatalog.map((category) => ({ id: category.id, label: `${category.icon} ${category.label}` }));
  const categoryChips =
    categoryId && !baseCategoryChips.some((chip) => chip.id === categoryId)
      ? [{ id: categoryId, label: categoryNameFor(categoryId) }, ...baseCategoryChips]
      : baseCategoryChips;

  const amountKrw = Number(amountDigits || "0");
  const itemNameError = itemName.trim().length === 0 ? "품목을 입력해 주세요." : null;
  const amountError = amountDigits.length > 0 && amountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;
  const dateInputError = customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  const canSave = !itemNameError && !amountError && !dateInputError && amountKrw > 0 && Boolean(authToken && expenseId && localExpenseId);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error("invalid expense");
      }
      return updateExpenseOffline(authToken, queryClient, localExpenseId, {
        amountKrw,
        itemName: itemName.trim(),
        memo,
        spentOn: spentOnIso || undefined,
        categoryId: categoryId || undefined,
        expenseType: isGift ? "gift" : "expense"
      });
    },
    onSuccess: async () => {
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["expense", expenseId] });
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
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setTimeout(() => router.replace("/(tabs)/records"), 650);
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
      <View testID="screen-EXP-003" style={{ gap: theme.spacing.section }}>
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
                  accessibilityLabel="품목 입력"
                  returnKeyType="done"
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
                    accessibilityLabel="지출 금액 입력"
                    keyboardType="number-pad"
                    returnKeyType="done"
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
                    <Pressable accessibilityRole="button" hitSlop={14} onPress={() => setCustomDateMode((value) => !value)}>
                      {/* A11Y-117: 12px 토글 텍스트 -- coral[500] 3.16:1(AA 미달) → coral[700] 5.56:1 */}
                      <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>
                        {customDateMode ? "최근 날짜에서 선택" : "직접 입력"}
                      </Text>
                    </Pressable>
                    {customDateMode ? (
                      <View style={{ gap: 6 }}>
                        <TextInput
                          accessibilityLabel="날짜 직접 입력"
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
                  {categoryChips.map((chip) => (
                    <CategoryChip
                      key={chip.id}
                      label={chip.label}
                      selected={chip.id === categoryId}
                      onPress={() => setCategoryId(chip.id)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  메모 (선택)
                </Text>
                <TextInput
                  accessibilityLabel="메모 입력 (선택)"
                  returnKeyType="done"
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
                accessibilityLabel="선물로 받았어요"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isGift }}
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
            </Card>

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
