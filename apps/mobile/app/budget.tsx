import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import {
  getBudget,
  LOCAL_SESSION_TOKEN,
  upsertBudget,
  type Expense,
  type HomeSummary
} from "../src/api/client";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { amountDigitsOnly, formatAmountDigits, formatKrw } from "../src/money";
import {
  buildBudgetAdjustChips,
  buildBudgetUsageLine,
  resolveThisMonthUsedKrw,
  sumLastMonthActualKrw
} from "../src/home/budget-edit";
import { previousYearMonth } from "../src/home/last-month-comparison";
import { useLoadErrorCopy } from "../src/offline/use-load-error-copy";
import { useOfflineSyncSnapshot } from "../src/offline/sync-controller";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../src/ui";
import { SkeletonCard } from "../src/ui/Skeleton";
import { theme } from "../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (온보딩 예산·지출 수정 화면의 같은 사본들과 함께) 제거했다.

/**
 * BUD-001(라운드 38 UX-M): 예산을 얼마로 할지 정하려면 "지금까지 얼마 썼는지 · 얼마 남았는지 ·
 * 지난달엔 실제로 얼마 썼는지"가 필요한데 이 화면에는 하나도 없었다. 세 값을 **새 요청 없이**
 * 이 화면이 이미 받는 응답과 이미 채워진 react-query 캐시에서 읽는다:
 *  - 사용액: 이 화면의 budget 쿼리 응답 `usedAmountKrw`(선물·환불 제외 서버 집계, DNC-015)가
 *    1순위. 예산 미설정(budget.data === null)이라 응답이 없을 때만 `["home", childId]` 캐시의
 *    `monthly.usedAmountKrw`로 폴백한다. 예외는 하나 — 이번 달에 아직 서버가 모르는 로컬 변경
 *    (오프라인 대기·삭제 대기)이 있을 때만 이번 달 캐시 재조정 값이 앞선다(라운드 40 J-4).
 *  - 지난달 실지출: `["expenses", childId, 지난달]`(홈의 "지난달 같은 시점 대비" 한 줄과 기록
 *    탭이 공유하는 바로 그 캐시) + 이 기기의 오프라인 대기 행.
 * `getQueryData`는 구독이 아니라 **읽기**라 쿼리를 활성화하지 않는다 -- 캐시가 없으면
 * undefined가 오고, 그때는 줄과 칩을 만들지 않는다(0원으로 떨어뜨리면 확인한 적 없는 사실을
 * 말하게 된다. 판정과 문구는 전부 src/home/budget-edit.ts).
 *
 * 라운드 38 H-4: 사용액을 홈 캐시에서만 읽던 때는 알림 → `/budget` 직행처럼 홈이 한 번도
 * 마운트되지 않은 경로에서 판단 줄이 통째로 사라졌고, 카드 위쪽 "현재 예산"(방금 받은 응답)과
 * 아래 한 줄(예전 홈 캐시)이 서로 다른 시점을 섞어 말할 수도 있었다. 같은 응답에서 두 값을
 * 함께 읽으면 둘 다 사라진다.
 */

const budgetContextLineStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: 18
} as const;

const budgetChipRowStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8
} as const;

const budgetChipStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.primary100,
  borderRadius: theme.radii.pill,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: theme.touchTarget,
  paddingHorizontal: 14
} as const;

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

  // 새 요청 0: 캐시에 있으면 읽고, 없으면 undefined -> 줄/칩을 만들지 않는다.
  const offlineSnapshot = useOfflineSyncSnapshot();
  const cachedHome = childId ? queryClient.getQueryData<HomeSummary>(["home", childId]) : undefined;
  const lastYearMonth = previousYearMonth(getSeoulToday());
  const cachedLastMonth =
    childId && lastYearMonth
      ? queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, lastYearMonth])
      : undefined;

  const currentBudgetKrw = budget.data?.amountKrw ?? null;
  /**
   * 라운드 39 I-6 + 라운드 40 J-4: 이번 달 사용액을 무엇으로 말할지.
   *
   * I-6은 지난달 칩과 **같은 모집단**으로 말하려고 캐시 재조정 값을 1순위에 놓았다(아직
   * 올라가지 않은 오프라인 대기 지출이 이번 달에서만 빠지면 같은 화면의 두 숫자가 갈린다).
   * 그런데 그 우선순위가 무조건이라, 이번 달 캐시가 비었거나 낡았을 때는 방금 받은 서버 집계를
   * 이기고 "0원 사용"이라는 허위 표시를 만들었다(다른 기기에서 기록한 지출이 있는 경우).
   *
   * 이제 우선순위 판정은 순수 모듈 한 곳에 있다 — 그 달에 오프라인 대기·삭제 대기 행이 **실제로
   * 있을 때만** 캐시 재조정 값을 쓰고, 아니면 서버 집계(H-4의 직행 경로 폴백까지)를 쓴다.
   */
  const thisYearMonth = getSeoulToday().slice(0, 7);
  const cachedThisMonth = childId
    ? queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, thisYearMonth])
    : undefined;
  const usedKrw = resolveThisMonthUsedKrw({
    cachedExpenses: cachedThisMonth?.expenses ?? null,
    offline: { rows: offlineSnapshot.rows, childId, yearMonth: thisYearMonth },
    serverUsedKrw: budget.data?.usedAmountKrw,
    homeUsedKrw: cachedHome?.monthly.usedAmountKrw
  });
  const usageLine = buildBudgetUsageLine({
    budgetKrw: currentBudgetKrw,
    usedKrw
  });
  // 합산 술어는 기록 탭·홈 월 합계와 같은 countsTowardMonthlyTotal 한 곳에서만 온다(DNC-015).
  //
  // 라운드 38 H-1: 서버 캐시만 더하면 기록 탭이 같은 달에 보여 주는 합계와 갈라진다 -- 아직
  // 올라가지 않은 오프라인 대기 행이 빠지고 삭제 대기 행은 남는다. 기록 탭·지출 입력 맥락 줄과
  // 똑같이 이 기기의 오프라인 스냅숏을 childId로 걸러 함께 넘겨 재조정한다(새 요청 0).
  const lastMonthActualKrw = sumLastMonthActualKrw(
    cachedLastMonth?.expenses ?? null,
    lastYearMonth ? { rows: offlineSnapshot.rows, childId, yearMonth: lastYearMonth } : undefined
  );
  const adjustChips = buildBudgetAdjustChips({ amountDigits, currentBudgetKrw, lastMonthActualKrw });

  const save = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountDigits || budget.data?.amountKrw);
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0) {
        throw new Error("invalid budget");
      }
      return upsertBudget(authToken, childId, amountKrw);
    },
    onSuccess: async () => {
      // BUD-001: 예전에는 인자 없이 무효화를 불러 **앱 전체 캐시**를 날렸다 -- 준비템
      // 목록·카테고리·가족 구성원처럼 예산과 무관한 화면까지 전부 다시 받아, 저장 한 번에
      // 불필요한 요청이 줄줄이 붙었다. 예산 변경이 실제로 바꾸는 화면만 좁혀 무효화한다:
      //  - ["budget"]: 이 화면 자신.
      //  - ["home"]:   히어로 카드의 남은 예산·퍼센트·예산 넛지(budget-progress.ts).
      //  - ["report"]: 월간 리포트의 budgetAmountKrw.
      // 지출 목록(["expenses"])은 예산을 바꿔도 한 건도 달라지지 않으므로 건드리지 않는다.
      await Promise.all(
        [["budget"], ["home"], ["report"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
      router.replace("/(tabs)");
    }
  });

  const canSave = !amountError && Boolean(authToken && childId) && (amountDigits.length > 0 || Boolean(budget.data));

  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 -- 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(budget.isError);

  return (
    <AppScreen>
      <View testID="screen-BUD-001" style={{ gap: theme.spacing.section }}>
        {/* 라운드 39 I-8: 스택으로만 도달하는 화면이라 OS 헤더가 없다(전역 headerShown:false).
            알림함 → /budget 직행이 가장 갇히기 쉬운 경로였다 -- UX-Q(C)가 낸 ScreenHeader의
            onBack 슬롯을 그대로 쓴다(‹ 표기·"뒤로가기" 라벨·44dp 타깃이 한 곳에 있다). */}
        <ScreenHeader
          eyebrow="예산 관리"
          title="월 예산 수정"
          subtitle="필요할 때 언제든 예산을 조정할 수 있어요."
          onBack={() => router.back()}
        />

        {budget.isLoading ? (
          // MOB-119 (UX-5B-5 후속, D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
          // 현재 예산/새 예산 카드 2장 실루엣으로 본 화면 형태를 따라간다.
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : budget.isError ? (
          <EmptyStateCard
            title={loadErrorCopy.title}
            actionLabel={loadErrorCopy.actionLabel}
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
                    ? formatKrw(budget.data.amountKrw)
                    : "-"}
              </Text>
              {/* 사용액을 모르면(홈 캐시 없음) 이 줄은 아예 없다 -- 0원으로 떨어뜨리지 않는다. */}
              {usageLine ? (
                <Text testID="budget-usage-line" style={budgetContextLineStyle}>
                  {usageLine}
                </Text>
              ) : null}
            </Card>

            <Card style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                새 예산
              </Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <TextInput
                  accessibilityLabel="새 예산 입력"
                  keyboardType="number-pad"
                  onChangeText={(value) => setAmountDigits(amountDigitsOnly(value))}
                  placeholder="새 예산을 입력해 주세요"
                  style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, paddingVertical: 6 }}
                  value={formatAmountDigits(amountDigits)}
                />
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>원</Text>
              </View>
              {/* 조정 칩: 값을 손으로 다 치지 않고 한 탭으로 후보를 만든다. 칩은 입력을 대체하지
                  않고 채워 넣기만 하므로 탭한 뒤에도 키패드로 자유롭게 고칠 수 있다. */}
              <View testID="budget-adjust-chips" style={budgetChipRowStyle}>
                {adjustChips.map((chip) => (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="button"
                    accessibilityLabel={chip.accessibilityLabel}
                    hitSlop={4}
                    onPress={() => setAmountDigits(chip.nextDigits)}
                    style={budgetChipStyle}
                  >
                    {/* A11Y-117: 13px coral 텍스트는 coral[700]이어야 대비가 선다. */}
                    <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>{chip.label}</Text>
                  </Pressable>
                ))}
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
