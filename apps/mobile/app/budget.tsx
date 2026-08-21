import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { getBudget, LOCAL_SESSION_TOKEN, upsertBudget } from "../src/api/client";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../src/ui";
import { theme } from "../src/theme";

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatAmount(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

export default function BudgetEditScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [amountDigits, setAmountDigits] = useState("");
  const queryClient = useQueryClient();
  const budget = useQuery({
    queryKey: ["budget", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getBudget(authToken!, childId!)
  });

  const typedAmountKrw = amountDigits ? Number(amountDigits) : null;
  const amountError = typedAmountKrw !== null && typedAmountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;

  const save = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountDigits || budget.data?.amountKrw);
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0) {
        throw new Error("invalid budget");
      }
      return upsertBudget(authToken, childId, amountKrw);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/(tabs)");
    }
  });

  const canSave = !amountError && Boolean(authToken && childId) && (amountDigits.length > 0 || Boolean(budget.data));

  return (
    <AppScreen>
      <View testID="screen-BUD-001" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="예산 관리" title="월 예산 수정" subtitle="필요할 때 언제든 예산을 조정할 수 있어요." />

        {budget.isLoading ? (
          <EmptyStateCard title="불러오고 있어요." actionLabel="잠시만요" />
        ) : budget.isError ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => budget.refetch()}
          />
        ) : (
          <>
            <Card style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                현재 예산
              </Text>
              <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
                {budget.data === null
                  ? "아직 예산이 없어요"
                  : budget.data?.amountKrw !== undefined
                    ? `${budget.data.amountKrw.toLocaleString("ko-KR")}원`
                    : "-"}
              </Text>
            </Card>

            <Card style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                새 예산
              </Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <TextInput
                  accessibilityLabel="새 예산 입력"
                  keyboardType="number-pad"
                  onChangeText={(value) => setAmountDigits(toDigits(value))}
                  placeholder="새 예산을 입력해 주세요"
                  style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, paddingVertical: 6 }}
                  value={formatAmount(amountDigits)}
                />
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>원</Text>
              </View>
              {amountError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
              ) : (
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                  비워두면 현재 예산이 그대로 유지돼요.
                </Text>
              )}
            </Card>

            {save.isError ? <Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}

            <PrimaryButton
              disabled={!canSave || save.isPending}
              label={save.isPending ? "저장하는 중" : "저장"}
              onPress={() => save.mutate()}
            />
          </>
        )}
      </View>
    </AppScreen>
  );
}
