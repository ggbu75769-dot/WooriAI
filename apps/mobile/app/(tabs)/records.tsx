import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { listExpenses } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function RecordsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const expenses = useQuery({
    queryKey: ["expenses", childId],
    enabled: Boolean(accessToken && childId),
    queryFn: () => listExpenses(accessToken!, childId!)
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 14, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>EXP-004</Text>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>기록</Text>
      <Pressable
        onPress={() => router.push("/expenses/new")}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.primary500,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ fontWeight: "700" }}>빠른 지출 기록</Text>
      </Pressable>

      {expenses.data ? (
        <>
          <Text>이번 달 합계 {formatKrw(expenses.data.totalAmountKrw)}</Text>
          {expenses.data.expenses.map((expense) => (
            <Pressable
              key={expense.id}
              onPress={() => router.push(`/expenses/${expense.id}`)}
              style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
            >
              <Text style={{ fontWeight: "700" }}>{expense.itemName}</Text>
              <Text>{expense.spentOn} · {formatKrw(expense.amountKrw)}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <Text>{expenses.isLoading ? "불러오는 중" : "기록을 불러오지 못했어요."}</Text>
      )}
    </View>
  );
}
