import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { getBudget, upsertBudget } from "../src/api/client";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";

export default function BudgetEditScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [amountText, setAmountText] = useState("");
  const queryClient = useQueryClient();
  const budget = useQuery({
    queryKey: ["budget", childId],
    enabled: Boolean(accessToken && childId),
    queryFn: () => getBudget(accessToken!, childId!)
  });

  const save = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText || budget.data?.amountKrw);
      if (!accessToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0) {
        throw new Error("invalid budget");
      }
      return upsertBudget(accessToken, childId, amountKrw);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)");
    }
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 12, padding: 24 }}>
      <Text style={{ color: theme.colors.textSecondary }}>BUD-001</Text>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>월 예산 수정</Text>
      <Text>현재 예산 {budget.data?.amountKrw?.toLocaleString("ko-KR") ?? "-"}원</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setAmountText}
        placeholder="새 예산"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 8, padding: 14 }}
        value={amountText}
      />
      <Pressable
        onPress={() => save.mutate()}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.primary500,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ fontWeight: "700" }}>저장</Text>
      </Pressable>
    </View>
  );
}
