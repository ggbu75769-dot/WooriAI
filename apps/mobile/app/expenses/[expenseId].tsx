import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { deleteExpense, getExpense, LOCAL_SESSION_TOKEN, updateExpense } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { theme } from "../../src/theme";

const expenseDetailScreenId = "EXP-003";

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatAmount(digits: string) {
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
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

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountDigits(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
  }, [expense.data]);

  const amountKrw = Number(amountDigits || "0");
  const itemNameError = itemName.trim().length === 0 ? "품목을 입력해 주세요." : null;
  const amountError = amountDigits.length > 0 && amountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;
  const canSave = !itemNameError && !amountError && amountKrw > 0 && Boolean(authToken && expenseId);

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !expenseId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim()) {
        throw new Error("invalid expense");
      }
      return updateExpense(authToken, expenseId, { amountKrw, itemName: itemName.trim(), memo });
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
