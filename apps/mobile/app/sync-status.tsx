import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { LOCAL_SESSION_TOKEN } from "../src/api/client";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  syncStatusBadgeLabel,
  SYNC_STATUS_CONFLICT_LABEL,
  SYNC_STATUS_DISCARD_LABEL,
  SYNC_STATUS_FAILED_LABEL,
  SYNC_STATUS_PENDING_LABEL,
  SYNC_STATUS_RETRY_LABEL,
  SYNC_STATUS_SYNCING_LABEL
} from "../src/offline/messages";
import {
  discardOfflineMutation,
  diffExpenseFieldsForDisplay,
  refreshOfflineSyncSnapshot,
  resolveConflictKeepChosenFields,
  resolveConflictKeepMine,
  resolveConflictKeepServer,
  retryOfflineMutation,
  useOfflineSyncSnapshot
} from "../src/offline/sync-controller";
import type { ExpensePayload, LocalExpenseRow } from "../src/offline/types";
import { formatKrw } from "../src/money";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, ScreenHeader, SecondaryButton, StatusBadge, TextButton } from "../src/ui";
import { theme } from "../src/theme";

function SyncRow({ row, children }: { row: LocalExpenseRow; children?: React.ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{row.payload.itemName}</Text>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{formatKrw(row.payload.amountKrw)}</Text>
      </View>
      {row.lastError ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{row.lastError}</Text> : null}
      {children}
    </Card>
  );
}

function ConflictFieldPicker({
  local,
  server,
  onConfirm
}: {
  local: ExpensePayload;
  server: ExpensePayload;
  onConfirm: (merged: ExpensePayload) => void;
}) {
  const diff = diffExpenseFieldsForDisplay(local, server);
  const [chosenFromServer, setChosenFromServer] = useState<Set<string>>(new Set());

  return (
    <View style={{ gap: 10 }}>
      {diff.map((entry) => (
        <View key={entry.field} style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>{entry.fieldLabel}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !chosenFromServer.has(entry.field) }}
              onPress={() =>
                setChosenFromServer((prev) => {
                  const next = new Set(prev);
                  next.delete(entry.field);
                  return next;
                })
              }
              style={{
                borderColor: chosenFromServer.has(entry.field) ? theme.colors.gray300 : theme.colors.mainCoral,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 12, textAlign: "center" }}>내 값: {String(entry.localValue ?? "-")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: chosenFromServer.has(entry.field) }}
              onPress={() =>
                setChosenFromServer((prev) => {
                  const next = new Set(prev);
                  next.add(entry.field);
                  return next;
                })
              }
              style={{
                borderColor: chosenFromServer.has(entry.field) ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                flex: 1,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 12, textAlign: "center" }}>다른 기기 값: {String(entry.serverValue ?? "-")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <SecondaryButton
        label="이 조합으로 저장"
        onPress={() => {
          const merged: ExpensePayload = { ...local };
          for (const entry of diff) {
            if (chosenFromServer.has(entry.field)) {
              (merged as Record<string, unknown>)[entry.field] = entry.serverValue;
            }
          }
          onConfirm(merged);
        }}
      />
    </View>
  );
}

function ConflictRow({ row, token, queryClient }: { row: LocalExpenseRow; token: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [sideBySide, setSideBySide] = useState(false);
  if (!row.conflictCurrent || row.conflictCurrent.deleted) {
    return (
      <SyncRow row={row}>
        {/* A11Y-117: 12px 배너 -- coral[500]은 흰 카드 위 3.16:1(AA 미달), coral[700]은 5.56:1 */}
        <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>다른 기기에서 이 기록을 삭제했어요.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton
            label={CONFLICT_OPTION_ADOPT_SERVER_LABEL}
            onPress={() => resolveConflictKeepServer(queryClient, row.localId)}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label={CONFLICT_OPTION_REAPPLY_MINE_LABEL}
            onPress={() => resolveConflictKeepMine(token, queryClient, row.localId)}
            style={{ flex: 1 }}
          />
        </View>
      </SyncRow>
    );
  }

  return (
    <SyncRow row={row}>
      {/* A11Y-117: 12px 배너 -- coral[500]은 흰 카드 위 3.16:1(AA 미달), coral[700]은 5.56:1 */}
      <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
      {sideBySide ? (
        <ConflictFieldPicker
          local={row.payload}
          server={row.conflictCurrent.expense}
          onConfirm={(merged) => {
            setSideBySide(false);
            resolveConflictKeepChosenFields(token, queryClient, row.localId, merged);
          }}
        />
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SecondaryButton
              label={CONFLICT_OPTION_ADOPT_SERVER_LABEL}
              onPress={() => resolveConflictKeepServer(queryClient, row.localId)}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={CONFLICT_OPTION_REAPPLY_MINE_LABEL}
              onPress={() => resolveConflictKeepMine(token, queryClient, row.localId)}
              style={{ flex: 1 }}
            />
          </View>
          <TextButton label={CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL} onPress={() => setSideBySide(true)} />
        </View>
      )}
    </SyncRow>
  );
}

export default function SyncStatusScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const queryClient = useQueryClient();
  const snapshot = useOfflineSyncSnapshot();

  useEffect(() => {
    void refreshOfflineSyncSnapshot();
  }, []);

  const pendingRows = snapshot.rows.filter((row) => row.syncState === "pending" || row.syncState === "syncing");
  const failedRows = snapshot.rows.filter((row) => row.syncState === "failed");
  const conflictRows = snapshot.rows.filter((row) => row.syncState === "conflict");
  const hasAny = pendingRows.length + failedRows.length + conflictRows.length > 0;

  return (
    <AppScreen>
      <View testID="screen-EXP-005" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="동기화" title="동기화 상태" subtitle="아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요." />

        {/* REC-123(H4): 배지/섹션 제목 문구는 기록 탭과 같은 src/offline/messages.ts에서 온다. */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatusBadge label={syncStatusBadgeLabel("pending", pendingRows.length)} tone={pendingRows.length > 0 ? "warning" : "neutral"} />
          <StatusBadge label={syncStatusBadgeLabel("failed", failedRows.length)} tone={failedRows.length > 0 ? "warning" : "neutral"} />
          <StatusBadge label={syncStatusBadgeLabel("conflict", conflictRows.length)} tone={conflictRows.length > 0 ? "warning" : "neutral"} />
        </View>

        {!hasAny ? <EmptyStateCard title="모든 기록이 동기화됐어요." actionLabel="닫기" onPress={() => router.back()} /> : null}

        {conflictRows.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{SYNC_STATUS_CONFLICT_LABEL}</Text>
            {conflictRows.map((row) => (
              <ConflictRow key={row.localId} row={row} token={authToken ?? ""} queryClient={queryClient} />
            ))}
          </View>
        ) : null}

        {failedRows.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{SYNC_STATUS_FAILED_LABEL}</Text>
            {failedRows.map((row) => (
              <SyncRow key={row.localId} row={row}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <SecondaryButton
                    label={SYNC_STATUS_RETRY_LABEL}
                    onPress={() => authToken && retryOfflineMutation(authToken, queryClient, row.localId)}
                    style={{ flex: 1 }}
                  />
                  <SecondaryButton label={SYNC_STATUS_DISCARD_LABEL} onPress={() => discardOfflineMutation(row.localId)} style={{ flex: 1 }} />
                </View>
              </SyncRow>
            ))}
          </View>
        ) : null}

        {pendingRows.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>
              {`${SYNC_STATUS_PENDING_LABEL} / ${SYNC_STATUS_SYNCING_LABEL}`}
            </Text>
            {pendingRows.map((row) => (
              <SyncRow key={row.localId} row={row}>
                <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
                  {row.syncState === "syncing" ? "동기화 중이에요." : "연결되면 자동으로 반영할게요."}
                </Text>
              </SyncRow>
            ))}
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}
