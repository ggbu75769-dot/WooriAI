import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, CategoryChip, EmptyStateCard, ListRow, PrimaryButton, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

const recordsScreenId = "EXP-004";

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatSpentOn(spentOn: string) {
  const parts = spentOn.split("-");
  if (parts.length !== 3) return spentOn;
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function yearMonthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const baseDate = new Date(`${getSeoulToday()}T00:00:00`);
  const recordsDate = addMonths(baseDate, monthOffset);
  const recordsYearMonth = yearMonthOf(recordsDate);
  const recordsMonthLabel = `${recordsDate.getFullYear()}년 ${recordsDate.getMonth() + 1}월`;

  const expenses = useQuery({
    queryKey: ["expenses", childId, recordsYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenses(authToken!, childId!, recordsYearMonth)
  });

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleExpenses = (expenses.data?.expenses ?? []).filter((expense) => {
    if (selectedCategoryId && expense.categoryId !== selectedCategoryId) return false;
    if (!normalizedSearch) return true;
    const haystack = `${expense.itemName} ${expense.memo ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
  const hasSearchQuery = normalizedSearch.length > 0;

  return (
    <AppScreen>
      <View accessibilityLabel={recordsScreenId} testID="screen-EXP-004" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="지출 기록" title="기록" subtitle="이번 달 지출 내역을 한눈에 확인해 보세요." />

        <PrimaryButton label="빠른 지출 기록" onPress={() => router.push("/expenses/new")} />

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 6
          }}
        >
          <Pressable accessibilityLabel="이전 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value - 1)}>
            <Text style={{ color: theme.colors.gray900, fontSize: 22, fontWeight: "900" }}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>
          <Pressable accessibilityLabel="다음 달" accessibilityRole="button" hitSlop={12} onPress={() => setMonthOffset((value) => value + 1)}>
            <Text style={{ color: theme.colors.gray900, fontSize: 22, fontWeight: "900" }}>›</Text>
          </Pressable>
        </View>

        <TextInput
          onChangeText={setSearchText}
          placeholder="품목명, 메모로 검색"
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: theme.radii.small,
            borderWidth: 1,
            color: theme.colors.brown,
            fontSize: theme.typography.body1.fontSize,
            minHeight: theme.touchTarget,
            paddingHorizontal: 14
          }}
          value={searchText}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <CategoryChip label="전체" selected={selectedCategoryId === null} onPress={() => setSelectedCategoryId(null)} />
          {categoryCatalog.map((category) => (
            <CategoryChip
              key={category.id}
              label={`${category.icon} ${category.label}`}
              selected={category.id === selectedCategoryId}
              onPress={() => setSelectedCategoryId(category.id)}
            />
          ))}
        </ScrollView>

        {expenses.isLoading ? (
          <EmptyStateCard title="기록을 불러오고 있어요." actionLabel="잠시만요" />
        ) : expenses.isError ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => expenses.refetch()}
          />
        ) : expenses.data && expenses.data.expenses.length > 0 ? (
          visibleExpenses.length > 0 ? (
            <>
              <Card>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  {recordsMonthLabel} 합계
                </Text>
                <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
                  {formatKrw(expenses.data.totalAmountKrw)}
                </Text>
              </Card>

              <View style={{ gap: theme.spacing.gap }}>
                {visibleExpenses.map((expense) => (
                  <ListRow
                    key={expense.id}
                    title={expense.itemName}
                    subtitle={
                      expense.expenseType === "gift"
                        ? `선물 · ${formatSpentOn(expense.spentOn)}`
                        : formatSpentOn(expense.spentOn)
                    }
                    value={formatKrw(expense.amountKrw)}
                    onPress={() => router.push(`/expenses/${expense.id}`)}
                  />
                ))}
              </View>
            </>
          ) : (
            <EmptyStateCard
              title={selectedCategoryId ? "이 카테고리의 기록이 없어요." : "검색 결과가 없어요."}
              actionLabel={selectedCategoryId ? "카테고리 필터 해제" : "검색어 지우기"}
              onPress={() => {
                if (selectedCategoryId) setSelectedCategoryId(null);
                else setSearchText("");
              }}
            />
          )
        ) : (
          <EmptyStateCard
            title={hasSearchQuery ? "검색 결과가 없어요." : "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."}
            actionLabel={hasSearchQuery ? "검색어 지우기" : "기록하기"}
            onPress={() => (hasSearchQuery ? setSearchText("") : router.push("/expenses/new"))}
          />
        )}
      </View>
    </AppScreen>
  );
}
