import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  confirmImport,
  getImportJob,
  listImportRows,
  fixtureSessionToken,
  updateImportRow,
  type ConfirmImportResponse,
  type ImportJob,
  type ImportRow
} from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppIcon, AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, SecondaryButton, StatusBadge } from "../../src/ui";

const selectedRowIds = (rows: ImportRow[]) => rows.filter((row) => row.selected).map((row) => row.id);

const lowConfidenceThreshold = 0.7;

const statusCopy: Record<ImportJob["status"], { label: string; tone: "neutral" | "success" | "warning" }> = {
  uploaded: { label: "업로드 완료 · 분석 대기 중", tone: "neutral" },
  analyzing: { label: "분석 진행 중이에요", tone: "warning" },
  preview_ready: { label: "검수 대기 중이에요", tone: "warning" },
  confirmed: { label: "가져오기 완료", tone: "success" },
  failed: { label: "분석에 실패했어요", tone: "warning" },
  cancelled: { label: "가져오기가 취소됐어요", tone: "neutral" }
};

const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

function ImportRowCard({
  row,
  disabled,
  onToggle
}: {
  row: ImportRow;
  disabled: boolean;
  onToggle: () => void;
}) {
  const isLowConfidence = row.confidence < lowConfidenceThreshold || row.validationStatus === "low_confidence_duplicate_candidate";
  const needsAttention = row.validationStatus !== "valid";

  return (
    <Pressable disabled={disabled} onPress={onToggle} style={[rowCardStyle, row.selected ? rowCardSelectedStyle : null]}>
      <View style={rowHeaderStyle}>
        <View style={checkboxStyle(row.selected)}>{row.selected ? <AppIcon color={theme.colors.white} name="check" size={16} /> : null}</View>
        <Text style={rowTitleStyle}>{row.parsedItemName ?? "품목명을 확인해 주세요"}</Text>
      </View>
      <Text style={rowAmountStyle}>
        {row.parsedAmountKrw ? `${row.parsedAmountKrw.toLocaleString("ko-KR")}원` : "금액을 확인해 주세요"}
      </Text>
      {isLowConfidence ? <StatusBadge label="낮은 신뢰도 · 중복 확인 필요" tone="warning" /> : null}
      {!isLowConfidence && needsAttention ? <StatusBadge label="확인이 필요해요" tone="warning" /> : null}
    </Pressable>
  );
}

function CompletionSummaryCard({ summary, onDone }: { summary: { importedCount: number; skippedCount: number }; onDone: () => void }) {
  return (
    <Card style={{ gap: 12 }}>
      <Text style={summaryTitleStyle}>가져오기를 완료했어요</Text>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>가져온 항목</Text>
        <Text style={summaryValueStyle}>{summary.importedCount}건</Text>
      </View>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>제외한 항목</Text>
        <Text style={summaryValueStyle}>{summary.skippedCount}건</Text>
      </View>
      <PrimaryButton label="가계부에서 확인하기" onPress={onDone} />
    </Card>
  );
}

export default function ImportPreviewScreen() {
  const params = useLocalSearchParams<{ importJobId?: string }>();
  const importJobId = String(params.importJobId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const [completionSummary, setCompletionSummary] = useState<ConfirmImportResponse | null>(null);

  const job = useQuery({
    queryKey: ["import-job", importJobId],
    enabled: Boolean(authToken && importJobId),
    queryFn: () => getImportJob(authToken!, importJobId),
    refetchInterval: (query) => (query.state.data?.status === "analyzing" ? 1500 : false)
  });
  const rows = useQuery({
    queryKey: ["import-rows", importJobId],
    enabled: Boolean(authToken && importJobId && job.data?.status !== "analyzing"),
    queryFn: () => listImportRows(authToken!, importJobId)
  });
  const toggleRow = useMutation({
    mutationFn: (row: ImportRow) =>
      updateImportRow(authToken!, importJobId, row.id, {
        selected: !row.selected,
        categoryId: row.categoryId,
        parsedItemName: row.parsedItemName,
        parsedAmountKrw: row.parsedAmountKrw
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["import-rows", importJobId] });
    }
  });
  const confirm = useMutation({
    mutationFn: () => confirmImport(authToken!, importJobId, selectedRowIds(rows.data?.rows ?? [])),
    onSuccess: async (result) => {
      setCompletionSummary(result);
      await queryClient.invalidateQueries({ queryKey: ["import-job", importJobId] });
      // Import confirmation changes expense totals that feed every report tab (monthly,
      // category, cumulative, yearly all share the "report" key prefix), plus the home
      // summary, the records list, and budget "used" tracking — invalidate all of them so
      // nothing goes stale after a confirm.
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
    }
  });

  const rowList = rows.data?.rows ?? [];
  const selectedCount = selectedRowIds(rowList).length;
  const status = job.data?.status;
  const isPreviewReady = status === "preview_ready";
  const goToRecords = () => router.replace("/(tabs)/records");

  return (
    <AppScreen>
      <View testID="screen-IMP-003" accessibilityLabel="screen-IMP-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="데이터 가져오기" title="가져오기 진행 상황" subtitle="분석 결과를 확인하고 가져올 항목을 골라요" />

        {job.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {job.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
            <SecondaryButton label="다시 시도" onPress={() => job.refetch()} />
          </Card>
        ) : null}

        {job.data ? (
          <Card style={{ gap: 8 }}>
            <StatusBadge label={statusCopy[job.data.status].label} tone={statusCopy[job.data.status].tone} />
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>전체 행</Text>
              <Text style={summaryValueStyle}>{job.data.rowCount}건</Text>
            </View>
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>선택됨</Text>
              <Text style={summaryValueStyle}>{selectedCount}건</Text>
            </View>
          </Card>
        ) : null}
      </View>

      {status === "confirmed" && job.data ? (
        <CompletionSummaryCard
          summary={completionSummary ?? { importedCount: job.data.importedCount, skippedCount: job.data.rowCount - job.data.importedCount }}
          onDone={goToRecords}
        />
      ) : (
        <View testID="screen-IMP-004" accessibilityLabel="screen-IMP-004" style={{ gap: theme.spacing.gap }}>
          {rows.isLoading ? (
            <Card>
              <Text style={mutedTextStyle}>미리보기를 불러오는 중이에요...</Text>
            </Card>
          ) : null}

          {rows.isError ? (
            <Card style={{ gap: 10 }}>
              <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
              <SecondaryButton label="다시 시도" onPress={() => rows.refetch()} />
            </Card>
          ) : null}

          {!rows.isLoading && !rows.isError && rowList.length === 0 ? (
            <EmptyStateCard title="가져올 항목이 없어요" actionLabel="돌아가기" onPress={() => router.replace("/import")} />
          ) : null}

          {rowList.map((row) => (
            <ImportRowCard
              key={row.id}
              row={row}
              disabled={toggleRow.isPending}
              onToggle={() => toggleRow.mutate(row)}
            />
          ))}

          {toggleRow.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}

          <PrimaryButton
            label={confirm.isPending ? "가져오는 중..." : "선택한 항목 가져오기"}
            disabled={!isPreviewReady || !selectedCount || confirm.isPending}
            onPress={() => confirm.mutate()}
          />
          {confirm.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
        </View>
      )}
    </AppScreen>
  );
}

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const summaryRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const summaryLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700"
} as const;

const summaryValueStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "800"
} as const;

const summaryTitleStyle = {
  color: theme.colors.brown,
  fontSize: 16,
  fontWeight: "800"
} as const;

const rowCardStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  gap: 6,
  padding: theme.spacing.card
} as const;

const rowCardSelectedStyle = {
  borderColor: theme.colors.mainCoral
} as const;

const rowHeaderStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

function checkboxStyle(checked: boolean) {
  return {
    alignItems: "center",
    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.white,
    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20
  } as const;
}

const rowTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "800"
} as const;

const rowAmountStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;
