import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportSourceKind, ReportSourcesContract } from "@wooriai/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { fixtureSessionToken, getReportV3Sources, type ReportV2Period } from "../../src/api/client";
import { ScreenScaffold, SectionCard, TopAppBar } from "../../src/design-system";
import { formatKrw } from "../../src/money";
import { householdIdForFeatureScope, useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { reportSourceScopeMatches } from "../../src/reports/source-navigation";
import { EmptyStateCard, ListRow, PrimaryButton } from "../../src/ui";
import { theme } from "../../src/theme";

const labels: Record<ReportSourceKind, string> = {
  planned: "준비 예정비용",
  unscheduled_planned: "일정 미지정 준비비용",
  recurring_planned: "월 반복 예정비용",
  actual_preparation: "실제 준비 지출",
  household_net: "가족 순지출",
  gift: "선물",
  refund: "환불",
  support: "지원금"
};

function validPeriod(value: string | undefined): value is ReportV2Period {
  return value === "month" || value === "quarter" || value === "year";
}

function validKind(value: string | undefined): value is ReportSourceKind {
  return Boolean(value && value in labels);
}

export default function ReportSourcesScreen() {
  const params = useLocalSearchParams<{
    householdId?: string;
    childId?: string;
    period?: string;
    anchor?: string;
    kind?: string;
  }>();
  const accessToken = useSessionStore((state) => state.accessToken);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const activeHouseholdId = householdIdForFeatureScope(
    selectedChildId,
    selectedChildHouseholdId,
    defaultHouseholdId,
    isTestSession
  );
  const [pages, setPages] = useState<ReportSourcesContract[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const period = validPeriod(params.period) ? params.period : null;
  const kind = validKind(params.kind) ? params.kind : null;
  const enabled = Boolean(
    authToken &&
    params.householdId &&
    params.householdId === activeHouseholdId &&
    params.childId &&
    params.childId === selectedChildId &&
    params.anchor &&
    period &&
    kind
  );
  const sources = useQuery({
    queryKey: ["report-v3-sources", params.householdId, params.childId, period, params.anchor, kind, cursor ?? null],
    enabled,
    queryFn: () => getReportV3Sources(
      authToken!,
      params.childId!,
      period!,
      params.anchor!,
      kind!,
      cursor
    )
  });

  useEffect(() => {
    setPages([]);
    setCursor(undefined);
  }, [params.childId, period, params.anchor, kind]);

  useEffect(() => {
    if (!sources.data) return;
    if (!reportSourceScopeMatches(sources.data.period, {
      householdId: params.householdId!,
      childId: params.childId!,
      period: period!,
      anchor: params.anchor!
    })) return;
    setPages((current) =>
      current.some((page) => page.items[0]?.id === sources.data!.items[0]?.id)
        ? current
        : [...current, sources.data!]
    );
  }, [params.anchor, params.childId, params.householdId, period, sources.data]);

  if (!enabled || !kind) {
    return (
      <ScreenScaffold>
        <EmptyStateCard
          title="금액 근거를 열 수 없어요."
          actionLabel="리포트로 돌아가기"
          onPress={() => router.back()}
        />
      </ScreenScaffold>
    );
  }

  const items = pages.flatMap((page) => page.items);
  const totals = pages[0]?.totals ?? sources.data?.totals;
  const loadedPageTotals = pages.reduce(
    (result, page) => ({
      amountKrw: result.amountKrw + page.pageTotals.amountKrw,
      signedAmountKrw: result.signedAmountKrw + page.pageTotals.signedAmountKrw,
      recordCount: result.recordCount + page.pageTotals.recordCount
    }),
    { amountKrw: 0, signedAmountKrw: 0, recordCount: 0 }
  );
  const nextCursor = pages[pages.length - 1]?.nextCursor ?? sources.data?.nextCursor;
  const displayTotal = kind === "gift" || kind === "refund" || kind === "support"
    ? totals?.amountKrw
    : totals?.signedAmountKrw;

  return (
    <ScreenScaffold testID="report-source-screen">
      <View style={{ gap: theme.spacing.section }}>
        <TopAppBar eyebrow="리포트" onBack={() => router.back()} title={labels[kind]} />
        <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>
          리포트와 같은 아이·기간·가족 범위의 원본만 보여드려요.
        </Text>
        {totals ? (
          <SectionCard>
            <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
              {kind === "household_net" ? "예정 제외 완료 기록" : "관련 기록"} {totals.recordCount}건
            </Text>
            <Text style={{ color: theme.colors.brown, fontSize: 28, fontWeight: "800" }}>
              {formatKrw(displayTotal ?? 0)}
            </Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
              현재 불러온 {loadedPageTotals.recordCount}건 · 전체 합계와 페이지 합계를 구분해 표시해요.
            </Text>
            {kind === "household_net" ? (
              <Text style={{ color: theme.colors.gray600, fontSize: 12, lineHeight: 18 }}>
                선물은 0원으로 표시하고, 환불과 지원금은 순지출에서 차감해요.
              </Text>
            ) : null}
          </SectionCard>
        ) : null}
        {sources.isLoading && items.length === 0 ? (
          <EmptyStateCard title="금액 근거를 불러오고 있어요." actionLabel="잠시만요" />
        ) : sources.isError && items.length === 0 ? (
          <EmptyStateCard
            title="금액 근거를 불러오지 못했어요. 권한과 연결 상태를 확인해 주세요."
            actionLabel="다시 시도"
            onPress={() => sources.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyStateCard
            title="이 합계에 포함된 기록이 없어요."
            actionLabel="리포트로 돌아가기"
            onPress={() => router.back()}
          />
        ) : (
          <View style={{ gap: theme.spacing.gap }}>
            {items.map((item) => (
              <ListRow
                key={`${item.sourceType}:${item.id}`}
                title={item.itemName}
                subtitle={
                  item.sourceType === "expense"
                    ? `${item.spentOn} · ${item.payerDisplayName}`
                    : item.dueDate
                      ? `준비일 ${item.dueDate}`
                      : "일정 미지정"
                }
                value={formatKrw(item.signedAmountKrw)}
                onPress={() =>
                  item.sourceType === "expense"
                    ? router.push(`/expenses/${item.id}`)
                    : router.push(`/items/${item.itemDefinitionId}`)
                }
              />
            ))}
          </View>
        )}
        {nextCursor ? (
          <PrimaryButton
            disabled={sources.isFetching}
            label={sources.isFetching ? "불러오는 중" : "더 보기"}
            onPress={() => setCursor(nextCursor)}
          />
        ) : null}
      </View>
    </ScreenScaffold>
  );
}
