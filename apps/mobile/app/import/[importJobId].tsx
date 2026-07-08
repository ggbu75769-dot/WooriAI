import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { confirmImport, getImportJob, listImportRows, updateImportRow, type ImportRow } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

const selectedRowIds = (rows: ImportRow[]) => rows.filter((row) => row.selected).map((row) => row.id);

export default function ImportPreviewScreen() {
  const params = useLocalSearchParams<{ importJobId?: string }>();
  const importJobId = String(params.importJobId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();
  const job = useQuery({
    queryKey: ["import-job", importJobId],
    enabled: Boolean(accessToken && importJobId),
    queryFn: () => getImportJob(accessToken!, importJobId)
  });
  const rows = useQuery({
    queryKey: ["import-rows", importJobId],
    enabled: Boolean(accessToken && importJobId),
    queryFn: () => listImportRows(accessToken!, importJobId)
  });
  const toggleRow = useMutation({
    mutationFn: (row: ImportRow) =>
      updateImportRow(accessToken!, importJobId, row.id, {
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
    mutationFn: () => confirmImport(accessToken!, importJobId, selectedRowIds(rows.data?.rows ?? [])),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home", childId] });
      await queryClient.invalidateQueries({ queryKey: ["expenses", childId] });
      await queryClient.invalidateQueries({ queryKey: ["monthly-report", childId] });
      router.replace("/(tabs)/records");
    }
  });
  const selectedCount = selectedRowIds(rows.data?.rows ?? []).length;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <View style={{ gap: 14, padding: 24 }}>
        <Text style={{ color: theme.colors.textSecondary }}>IMP-003 / IMP-004</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          Import preview
        </Text>
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: 8, gap: 6, padding: 14 }}>
          <Text>Status: {job.data?.status ?? "loading"}</Text>
          <Text>Rows: {job.data?.rowCount ?? 0}</Text>
          <Text>Selected: {selectedCount}</Text>
        </View>

        {(rows.data?.rows ?? []).map((row) => (
          <Pressable
            key={row.id}
            onPress={() => toggleRow.mutate(row)}
            style={{
              backgroundColor: row.selected ? theme.colors.primary100 : theme.colors.surface,
              borderRadius: 8,
              gap: 6,
              padding: 14
            }}
          >
            <Text style={{ fontWeight: "700" }}>
              {row.selected ? "Selected" : "Skipped"} row {row.rowIndex + 1}
            </Text>
            <Text>{row.parsedItemName ?? "Needs item name"}</Text>
            <Text>{row.parsedAmountKrw ? `${row.parsedAmountKrw.toLocaleString("ko-KR")} KRW` : "Needs amount"}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>
              Confidence {Math.round(row.confidence * 100)}% / {row.validationStatus}
            </Text>
          </Pressable>
        ))}

        <Pressable
          disabled={!selectedCount || confirm.isPending}
          onPress={() => confirm.mutate()}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.primary500,
            borderRadius: 8,
            height: theme.ctaHeight,
            justifyContent: "center",
            opacity: !selectedCount || confirm.isPending ? 0.5 : 1
          }}
        >
          <Text style={{ fontWeight: "700" }}>
            {confirm.isPending ? "Saving selected rows..." : "Confirm selected rows"}
          </Text>
        </Pressable>
        {confirm.error ? <Text style={{ color: theme.colors.danger }}>Confirm failed</Text> : null}
      </View>
    </ScrollView>
  );
}
