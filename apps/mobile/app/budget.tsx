import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { getBudget, fixtureSessionToken, listHouseholdMembers, upsertBudget } from "../src/api/client";
import { AppIcon, AppScreen, Card, EmptyStateCard, MoneyField, PrimaryButton, Toast, TopAppBar } from "../src/design-system";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";

function toDigits(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export default function BudgetEditScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [amountDigits, setAmountDigits] = useState("");
  const queryClient = useQueryClient();
  const budget = useQuery({ queryKey: ["budget", childId], enabled: Boolean(token && childId), queryFn: () => getBudget(token!, childId!) });
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(token && householdId && !isTestSession),
    queryFn: () => listHouseholdMembers(token!, householdId!)
  });
  const ownRole = isTestSession ? "owner" : members.data?.members.find((member) => member.userId === userId && member.status === "active")?.role;
  const canEdit = ownRole === "owner" || ownRole === "co_parent";

  useEffect(() => {
    if (budget.data?.amountKrw) setAmountDigits(String(budget.data.amountKrw));
  }, [budget.data?.amountKrw]);

  const amountKrw = amountDigits ? Number(amountDigits) : 0;
  const amountError = !Number.isSafeInteger(amountKrw) || amountKrw <= 0 ? "0보다 큰 원화 정수를 입력해 주세요." : null;
  const save = useMutation({
    mutationFn: () => {
      if (!token || !childId || !canEdit || amountError) throw new Error("BUDGET_INPUT_INVALID");
      return upsertBudget(token, childId, amountKrw);
    },
    onSuccess: async (value) => {
      queryClient.setQueryData(["budget", childId], value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["home", childId] }),
        queryClient.invalidateQueries({ queryKey: ["report"] }),
        queryClient.invalidateQueries({ queryKey: ["report-v3"] }),
        queryClient.invalidateQueries({ queryKey: ["budget-variance-explanation"] })
      ]);
      router.replace("/(tabs)/more");
    }
  });

  return (
    <AppScreen>
      <View accessibilityLabel="PF-04 월 예산 설정" testID="screen-PF-04" style={{ gap: theme.spacing.section }}>
        <TopAppBar eyebrow="프로필" onBack={() => router.back()} title="월 예산 설정" />
        {budget.isLoading || members.isLoading ? <EmptyStateCard title="예산을 불러오고 있어요." actionLabel="잠시만요" /> : budget.isError || members.isError ? <EmptyStateCard title="예산을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => { void budget.refetch(); void members.refetch(); }} /> : !canEdit ? <EmptyStateCard title="보기 전용 권한에서는 예산을 변경할 수 없어요." actionLabel="프로필로 돌아가기" onPress={() => router.replace("/(tabs)/more")} /> : (
          <>
            <MoneyField
              error={amountError}
              helper="매월 1일 기준으로 관리돼요. 변경한 값은 이번 달부터 적용돼요."
              label="월 예산"
              onChangeText={(value) => setAmountDigits(toDigits(value))}
              placeholder="예: 500,000"
              value={amountDigits ? Number(amountDigits).toLocaleString("ko-KR") : ""}
            />
            <Card style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
              <View style={{ alignItems: "center", backgroundColor: theme.colors.sky, borderRadius: 14, height: 42, justifyContent: "center", width: 42 }}>
                <AppIcon color={theme.colors.semantic.info} name="information-outline" size={22} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" }}>이번 달 지출 {budget.data?.usedAmountKrw.toLocaleString("ko-KR") ?? 0}원</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>과거 월 리포트에는 당시 예산이 그대로 유지돼요.</Text>
              </View>
            </Card>
            {save.isError ? <Toast message="예산을 저장하지 못했어요. 입력은 그대로 두었으니 다시 시도해 주세요." tone="error" /> : null}
            <PrimaryButton busy={save.isPending} disabled={Boolean(amountError)} label={save.isPending ? "저장하는 중" : "저장하기"} onPress={() => save.mutate()} />
          </>
        )}
      </View>
    </AppScreen>
  );
}
