import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { deleteExpense, getExpense, updateExpense } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

export default function ExpenseDetailScreen() {
  const params = useLocalSearchParams<{ expenseId?: string }>();
  const expenseId = String(params.expenseId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const expense = useQuery({
    queryKey: ["expense", expenseId],
    enabled: Boolean(accessToken && expenseId),
    queryFn: () => getExpense(accessToken!, expenseId)
  });
  const [itemName, setItemName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountText(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
  }, [expense.data]);

  const save = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      if (!accessToken || !expenseId || !Number.isInteger(amountKrw) || amountKrw <= 0) {
        throw new Error("invalid expense");
      }
      return updateExpense(accessToken, expenseId, { amountKrw, itemName, memo });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)/records");
    }
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!accessToken || !expenseId) throw new Error("missing expense");
      return deleteExpense(accessToken, expenseId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)/records");
    }
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>EXP-003</Text>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>지출 상세 수정</Text>
      <TextInput
        onChangeText={setItemName}
        placeholder="품목"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={itemName}
      />
      <TextInput
        keyboardType="number-pad"
        onChangeText={setAmountText}
        placeholder="금액"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={amountText}
      />
      <TextInput
        onChangeText={setMemo}
        placeholder="메모"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={memo}
      />
      <Pressable
        onPress={() => save.mutate()}
        style={{ backgroundColor: theme.colors.primary500, borderRadius: 8, padding: 16 }}
      >
        <Text style={{ fontWeight: "700" }}>수정 저장</Text>
      </Pressable>
      <Pressable
        onPress={() => remove.mutate()}
        style={{ borderColor: theme.colors.danger, borderRadius: 8, borderWidth: 1, padding: 16 }}
      >
        <Text style={{ color: theme.colors.danger, fontWeight: "700" }}>삭제</Text>
      </Pressable>
    </View>
  );
}
