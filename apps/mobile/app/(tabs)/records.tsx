import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { listExpenses, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, ListRow, PrimaryButton, ScreenHeader } from "../../src/ui";
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

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const expenses = useQuery({
    queryKey: ["expenses", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => listExpenses(authToken!, childId!)
  });

  return (
    <AppScreen>
      <View accessibilityLabel={recordsScreenId} testID="screen-EXP-004" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="지출 기록" title="기록" subtitle="이번 달 지출 내역을 한눈에 확인해 보세요." />

        <PrimaryButton label="빠른 지출 기록" onPress={() => router.push("/expenses/new")} />

        {expenses.isLoading ? (
          <EmptyStateCard title="기록을 불러오고 있어요." actionLabel="잠시만요" />
        ) : expenses.isError ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => expenses.refetch()}
          />
        ) : expenses.data && expenses.data.expenses.length > 0 ? (
          <>
            <Card>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                이번 달 합계
              </Text>
              <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
                {formatKrw(expenses.data.totalAmountKrw)}
              </Text>
            </Card>

            <View style={{ gap: theme.spacing.gap }}>
              {expenses.data.expenses.map((expense) => (
                <ListRow
                  key={expense.id}
                  title={expense.itemName}
                  subtitle={formatSpentOn(expense.spentOn)}
                  value={formatKrw(expense.amountKrw)}
                  onPress={() => router.push(`/expenses/${expense.id}`)}
                />
              ))}
            </View>
          </>
        ) : (
          <EmptyStateCard
            title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
            actionLabel="기록하기"
            onPress={() => router.push("/expenses/new")}
          />
        )}
      </View>
    </AppScreen>
  );
}
