import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { KoreanText as Text } from "../src/design-system/components/KoreanText";
import { fixtureSessionToken } from "../src/api/client";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  SYNC_STATUS_DISCARD_LABEL,
  SYNC_STATUS_RETRY_LABEL
} from "../src/offline/messages";
import {
  discardOfflineMutation,
  diffExpenseFieldsForDisplay,
  refreshOfflineSyncSnapshot,
  resolveConflictKeepChosenFields,
  resolveConflictKeepMine,
  resolveConflictKeepServer,
  retryOfflineMutation,
  retryLegacyQuarantineReconciliation,
  type OfflineSyncDisplayRow,
  useOfflineSyncSnapshot
} from "../src/offline/sync-controller";
import { groupSyncRecoveryRows, highestPriorityRecoveryState, resolveSyncDisplayState, syncDisplayMessage } from "../src/offline/sync-display-state";
import type { ExpensePayload } from "../src/offline/types";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen, Card, EmptyStateCard, ScreenHeader, SecondaryButton, StatusBadge, TextButton } from "../src/ui";
import { theme } from "../src/theme";

const syncStatusScreenId = "EXP-005";

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function SyncRow({ row, children }: { row: OfflineSyncDisplayRow; children?: React.ReactNode }) {
  const displayState = resolveSyncDisplayState(row);
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{row.payload.itemName}</Text>
        <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{formatKrw(row.payload.amountKrw)}</Text>
      </View>
      <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
        {syncDisplayMessage(displayState)}
      </Text>
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

function ConflictRow({ row, token, queryClient }: { row: OfflineSyncDisplayRow; token: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [sideBySide, setSideBySide] = useState(false);
  if (!row.conflictCurrent || row.conflictCurrent.deleted) {
    return (
      <SyncRow row={row}>
        <Text style={{ color: theme.colors.mainCoral, fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
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
      <Text style={{ color: theme.colors.mainCoral, fontSize: 12, fontWeight: "700" }}>{CONFLICT_BANNER_MESSAGE}</Text>
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
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const queryClient = useQueryClient();
  const snapshot = useOfflineSyncSnapshot();
  const [busyLocalId, setBusyLocalId] = useState<string | null>(null);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshOfflineSyncSnapshot();
  }, []);

  const groups = groupSyncRecoveryRows(snapshot.rows);
  const pendingRows = [...groups.pending, ...groups.retryWait, ...groups.syncing];
  const permanentRows = [...groups.permissionDenied, ...groups.permanentFailures];
  const highestPriority = highestPriorityRecoveryState(groups, snapshot.quarantine.total);
  const hasAny = highestPriority !== null;

  async function retry(row: OfflineSyncDisplayRow) {
    if (!authToken || busyLocalId) return;
    setBusyLocalId(row.localId);
    try {
      await retryOfflineMutation(authToken, queryClient, row.localId);
    } finally {
      setBusyLocalId(null);
    }
  }

  async function discard(row: OfflineSyncDisplayRow) {
    if (busyLocalId) return;
    setBusyLocalId(row.localId);
    try {
      await discardOfflineMutation(row.localId);
    } finally {
      setBusyLocalId(null);
    }
  }

  async function reconcileQuarantine() {
    if (!authToken || busyLocalId) return;
    setBusyLocalId("legacy-quarantine");
    setReconciliationMessage(null);
    try {
      const result = await retryLegacyQuarantineReconciliation(authToken);
      setReconciliationMessage(
        result.restored > 0
          ? `서버에서 소유권이 확인된 기록 ${result.restored}건을 복원했어요.`
          : "현재 계정 소유권이 새로 확인된 기록은 없어요."
      );
    } catch {
      setReconciliationMessage("소유권을 다시 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusyLocalId(null);
    }
  }

  return (
    <AppScreen>
      <View accessibilityLabel={syncStatusScreenId} testID="screen-EXP-005" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="동기화" onBack={() => router.back()} title="동기화 상태" subtitle="아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요." />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatusBadge label={`대기 ${pendingRows.length}`} tone={pendingRows.length > 0 ? "warning" : "neutral"} />
          <StatusBadge label={`실패 ${permanentRows.length + groups.retryExhausted.length + groups.authRequired.length}`} tone={permanentRows.length + groups.retryExhausted.length + groups.authRequired.length > 0 ? "warning" : "neutral"} />
          <StatusBadge label={`충돌 ${groups.conflicts.length}`} tone={groups.conflicts.length > 0 ? "warning" : "neutral"} />
        </View>

        {!hasAny ? <EmptyStateCard title="모든 기록이 동기화됐어요." actionLabel="닫기" onPress={() => router.back()} /> : null}

        {snapshot.quarantine.total > 0 ? (
          <Card style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>
              이전 버전 기록 {snapshot.quarantine.total}건을 안전하게 보관 중이에요.
            </Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
              계정 소유권을 확인할 수 없어 자동 전송하지 않습니다. 금액과 메모도 현재 계정에 표시하지 않아요.
            </Text>
            <SecondaryButton
              disabled={!authToken || Boolean(busyLocalId)}
              label={busyLocalId === "legacy-quarantine" ? "확인 중" : "서버에서 다시 확인"}
              onPress={() => void reconcileQuarantine()}
            />
            {reconciliationMessage ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.gray600, fontSize: 12 }}>{reconciliationMessage}</Text> : null}
          </Card>
        ) : null}

        {groups.authRequired.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>로그인 필요</Text>
            {groups.authRequired.map((row) => (
              <SyncRow key={row.localId} row={row}>
                <SecondaryButton label="로그인하기" onPress={() => router.push("/login")} />
              </SyncRow>
            ))}
          </View>
        ) : null}

        {groups.conflicts.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>충돌</Text>
            {groups.conflicts.map((row) => (
              <ConflictRow key={row.localId} row={row} token={authToken ?? ""} queryClient={queryClient} />
            ))}
          </View>
        ) : null}

        {groups.retryExhausted.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>자동 재시도 완료</Text>
            {groups.retryExhausted.map((row) => (
              <SyncRow key={row.localId} row={row}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <SecondaryButton
                    label={SYNC_STATUS_RETRY_LABEL}
                    disabled={Boolean(busyLocalId)}
                    onPress={() => void retry(row)}
                    style={{ flex: 1 }}
                  />
                  <SecondaryButton disabled={Boolean(busyLocalId)} label={SYNC_STATUS_DISCARD_LABEL} onPress={() => void discard(row)} style={{ flex: 1 }} />
                </View>
              </SyncRow>
            ))}
          </View>
        ) : null}

        {permanentRows.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>확인이 필요한 기록</Text>
            {permanentRows.map((row) => (
              <SyncRow key={row.localId} row={row}>
                <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>
                  {row.failureKind === "permission_denied"
                    ? "현재 계정에는 이 기록을 변경할 권한이 없어요."
                    : "입력값을 확인해야 해 자동으로 다시 보내지 않아요."}
                </Text>
                <SecondaryButton disabled={Boolean(busyLocalId)} label={SYNC_STATUS_DISCARD_LABEL} onPress={() => void discard(row)} />
              </SyncRow>
            ))}
          </View>
        ) : null}

        {pendingRows.length > 0 ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>대기 / 동기화 중</Text>
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
