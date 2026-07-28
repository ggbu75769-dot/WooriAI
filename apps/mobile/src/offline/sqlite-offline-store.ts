import * as SQLite from "expo-sqlite";
import { reconcileRemoteSyncPage } from "./delta-reconciliation";
import type {
  LegacyQuarantineSummary,
  LegacyQuarantineEntry,
  LocalExpenseRow,
  MutationOutboxRow,
  OfflineFailureKind,
  OfflineStore,
  RemoteSyncMetadata,
  SyncState
} from "./types";
import { LEGACY_UNSCOPED_SCOPE_KEY } from "./session-scope";
import {
  classifyLegacyOfflineRows,
  OFFLINE_SQLITE_SCHEMA_VERSION,
  type LegacyLocalExpenseSqlRow,
  type LegacyMutationSqlRow
} from "./sqlite-upgrade";

/**
 * expo-sqlite-backed `OfflineStore` (design doc §3.1's `local_expenses` / `mutation_outbox`
 * tables). Not exercised by vitest (no native SQLite binding in node) -- see
 * memory-offline-store.ts for the test-covered equivalent this mirrors 1:1. Only imported from
 * app runtime code (src/offline/sync-controller.ts), never from a test file.
 */

const DB_NAME = "wooriai-offline.db";
const REMOTE_SYNC_METADATA_PREFIX = "sync-v2:";

function remoteSyncMetadataKey(scopeKey: string): string {
  return `${REMOTE_SYNC_METADATA_PREFIX}${scopeKey}`;
}

function emptyRemoteSyncMetadata(): RemoteSyncMetadata {
  return {
    protocolVersion: 2,
    cursor: null,
    baselineComplete: false,
    lastSuccessfulPullAt: null,
    authorizationState: "unknown",
    authorizationCheckedAt: null
  };
}

function parseRemoteSyncMetadata(value: string | null | undefined): RemoteSyncMetadata {
  if (!value) return emptyRemoteSyncMetadata();
  try {
    const parsed = JSON.parse(value) as Partial<RemoteSyncMetadata>;
    if (
      parsed.protocolVersion !== 2 ||
      (parsed.cursor !== null && typeof parsed.cursor !== "string") ||
      typeof parsed.baselineComplete !== "boolean" ||
      (parsed.lastSuccessfulPullAt !== null &&
        typeof parsed.lastSuccessfulPullAt !== "string")
    ) {
      return emptyRemoteSyncMetadata();
    }
    return {
      protocolVersion: 2,
      cursor: parsed.cursor,
      baselineComplete: parsed.baselineComplete,
      lastSuccessfulPullAt: parsed.lastSuccessfulPullAt,
      authorizationState:
        parsed.authorizationState === "authorized" || parsed.authorizationState === "denied"
          ? parsed.authorizationState
          : "unknown",
      authorizationCheckedAt:
        typeof parsed.authorizationCheckedAt === "string"
          ? parsed.authorizationCheckedAt
          : null
    };
  } catch {
    return emptyRemoteSyncMetadata();
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

type MigrationDatabase = Pick<
  SQLite.SQLiteDatabase,
  "execAsync" | "getAllAsync" | "runAsync"
>;

async function ensureColumn(
  db: MigrationDatabase,
  table: "local_expenses" | "mutation_outbox",
  column: string,
  definition: string
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((entry) => entry.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function migrateOfflineDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS local_expenses (
          scope_key TEXT NOT NULL DEFAULT '${LEGACY_UNSCOPED_SCOPE_KEY}',
          local_id TEXT PRIMARY KEY NOT NULL,
          canonical_id TEXT,
          child_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          version INTEGER,
          sync_state TEXT NOT NULL CHECK (sync_state IN ('pending','syncing','synced','failed','conflict')),
          pending_delete INTEGER NOT NULL DEFAULT 0,
          conflict_current TEXT,
          last_error TEXT,
          failure_kind TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS mutation_outbox (
          scope_key TEXT NOT NULL DEFAULT '${LEGACY_UNSCOPED_SCOPE_KEY}',
          mutation_id TEXT PRIMARY KEY NOT NULL,
          idempotency_key TEXT NOT NULL,
          operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
          target_local_id TEXT NOT NULL,
          payload TEXT,
          expected_version INTEGER,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          in_flight INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS legacy_quarantine (
          id TEXT PRIMARY KEY NOT NULL,
          source_local_id TEXT NOT NULL,
          classification TEXT NOT NULL,
          reason_code TEXT NOT NULL,
          local_expense_json TEXT NOT NULL,
          outbox_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          quarantined_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS offline_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
    `);
    await ensureColumn(
      txn,
      "local_expenses",
      "scope_key",
      `TEXT NOT NULL DEFAULT '${LEGACY_UNSCOPED_SCOPE_KEY}'`
    );
    await ensureColumn(txn, "local_expenses", "failure_kind", "TEXT");
    await ensureColumn(
      txn,
      "mutation_outbox",
      "scope_key",
      `TEXT NOT NULL DEFAULT '${LEGACY_UNSCOPED_SCOPE_KEY}'`
    );
    await ensureColumn(txn, "mutation_outbox", "in_flight", "INTEGER NOT NULL DEFAULT 0");

    const legacyRows = await txn.getAllAsync<LegacyLocalExpenseSqlRow>(
      `SELECT * FROM local_expenses WHERE scope_key = ?`,
      LEGACY_UNSCOPED_SCOPE_KEY
    );
    const legacyMutations = await txn.getAllAsync<LegacyMutationSqlRow>(
      `SELECT * FROM mutation_outbox WHERE scope_key = ?`,
      LEGACY_UNSCOPED_SCOPE_KEY
    );
    const quarantinedAt = new Date().toISOString();
    for (const record of classifyLegacyOfflineRows(legacyRows, legacyMutations)) {
      await txn.runAsync(
          `INSERT OR IGNORE INTO legacy_quarantine
            (id, source_local_id, classification, reason_code, local_expense_json, outbox_json, created_at, quarantined_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          record.id,
          record.sourceLocalId,
          record.classification,
          record.reasonCode,
          record.localExpenseJson,
          record.outboxJson,
          record.createdAt,
          quarantinedAt
      );
    }
    await txn.runAsync(
      `DELETE FROM mutation_outbox WHERE scope_key = ?`,
      LEGACY_UNSCOPED_SCOPE_KEY
    );
    await txn.runAsync(
      `DELETE FROM local_expenses WHERE scope_key = ?`,
      LEGACY_UNSCOPED_SCOPE_KEY
    );
    const duplicateCanonicalGroups = await txn.getAllAsync<{
      scope_key: string;
      canonical_id: string;
    }>(`
      SELECT scope_key, canonical_id
        FROM local_expenses
       WHERE canonical_id IS NOT NULL
       GROUP BY scope_key, canonical_id
      HAVING COUNT(*) > 1
    `);
    for (const duplicate of duplicateCanonicalGroups) {
      const duplicateRows = await txn.getAllAsync<LocalExpenseSqlRow>(
        `SELECT * FROM local_expenses
          WHERE scope_key = ? AND canonical_id = ?
          ORDER BY CASE WHEN sync_state = 'synced' THEN 1 ELSE 0 END ASC,
                   version DESC,
                   updated_at DESC,
                   local_id ASC`,
        duplicate.scope_key,
        duplicate.canonical_id
      );
      for (const discarded of duplicateRows.slice(1)) {
        const discardedMutations = await txn.getAllAsync<MutationOutboxSqlRow>(
          `SELECT * FROM mutation_outbox
            WHERE scope_key = ? AND target_local_id = ?
            ORDER BY created_at ASC`,
          discarded.scope_key,
          discarded.local_id
        );
        const quarantineId = `canonical-duplicate:${discarded.scope_key}:${discarded.local_id}`;
        await txn.runAsync(
          `INSERT OR IGNORE INTO legacy_quarantine
            (id, source_local_id, classification, reason_code, local_expense_json, outbox_json, created_at, quarantined_at)
           VALUES (?, ?, 'ambiguous', 'DUPLICATE_CANONICAL_ID', ?, ?, ?, ?)`,
          quarantineId,
          discarded.local_id,
          JSON.stringify(discarded),
          JSON.stringify(discardedMutations),
          discarded.created_at,
          quarantinedAt
        );
        await txn.runAsync(
          `DELETE FROM mutation_outbox WHERE scope_key = ? AND target_local_id = ?`,
          discarded.scope_key,
          discarded.local_id
        );
        await txn.runAsync(
          `DELETE FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
          discarded.scope_key,
          discarded.local_id
        );
      }
    }
    // A process can stop after the request is sent but before the local acknowledgement is
    // persisted. Reopen makes the same idempotency key eligible again instead of leaving a
    // permanent in-flight state.
    await txn.execAsync(`
        UPDATE mutation_outbox SET in_flight = 0 WHERE in_flight <> 0;
        UPDATE local_expenses
          SET sync_state = 'pending'
          WHERE sync_state = 'syncing';
        CREATE INDEX IF NOT EXISTS idx_local_expenses_scope_child
          ON local_expenses(scope_key, child_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_local_expenses_scope_canonical
          ON local_expenses(scope_key, canonical_id)
          WHERE canonical_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_mutation_outbox_scope_target
          ON mutation_outbox(scope_key, target_local_id);
        CREATE INDEX IF NOT EXISTS idx_mutation_outbox_scope_created
          ON mutation_outbox(scope_key, created_at);
        CREATE INDEX IF NOT EXISTS idx_legacy_quarantine_classification
          ON legacy_quarantine(classification, created_at);
        PRAGMA user_version = ${OFFLINE_SQLITE_SCHEMA_VERSION};
    `);
  });
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      try {
        await migrateOfflineDatabase(db);
        return db;
      } catch (error) {
        dbPromise = null;
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    });
  }
  return dbPromise;
}

type LocalExpenseSqlRow = {
  scope_key: string;
  local_id: string;
  canonical_id: string | null;
  child_id: string;
  payload: string;
  version: number | null;
  sync_state: SyncState;
  pending_delete: number;
  conflict_current: string | null;
  last_error: string | null;
  failure_kind: OfflineFailureKind | null;
  created_at: string;
  updated_at: string;
};

type MutationOutboxSqlRow = {
  scope_key: string;
  mutation_id: string;
  idempotency_key: string;
  operation: MutationOutboxRow["operation"];
  target_local_id: string;
  payload: string | null;
  expected_version: number | null;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  in_flight: number;
};

type LegacyQuarantineSqlRow = {
  id: string;
  source_local_id: string;
  classification: LegacyQuarantineEntry["classification"];
  reason_code: string;
  local_expense_json: string;
  outbox_json: string;
  created_at: string;
};

function fromSqlLocalExpense(row: LocalExpenseSqlRow): LocalExpenseRow {
  return {
    scopeKey: row.scope_key,
    localId: row.local_id,
    canonicalId: row.canonical_id,
    childId: row.child_id,
    payload: JSON.parse(row.payload),
    version: row.version,
    syncState: row.sync_state,
    pendingDelete: Boolean(row.pending_delete),
    conflictCurrent: row.conflict_current ? JSON.parse(row.conflict_current) : null,
    lastError: row.last_error,
    failureKind: row.failure_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromSqlMutation(row: MutationOutboxSqlRow): MutationOutboxRow {
  return {
    scopeKey: row.scope_key,
    mutationId: row.mutation_id,
    idempotencyKey: row.idempotency_key,
    operation: row.operation,
    targetLocalId: row.target_local_id,
    payload: row.payload ? JSON.parse(row.payload) : null,
    expectedVersion: row.expected_version,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    inFlight: Boolean(row.in_flight)
  };
}

export function createSqliteOfflineStore(scopeKey: string): OfflineStore {
  return {
    scopeKey,
    async insertLocalExpense(row) {
      if (row.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO local_expenses
          (scope_key, local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, failure_kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        scopeKey,
        row.localId,
        row.canonicalId,
        row.childId,
        JSON.stringify(row.payload),
        row.version,
        row.syncState,
        row.pendingDelete ? 1 : 0,
        row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
        row.lastError,
        row.failureKind,
        row.createdAt,
        row.updatedAt
      );
    },

    async getLocalExpense(localId) {
      const db = await getDb();
      const row = await db.getFirstAsync<LocalExpenseSqlRow>(
        `SELECT * FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
        scopeKey,
        localId
      );
      return row ? fromSqlLocalExpense(row) : null;
    },

    async updateLocalExpense(localId, patch) {
      const existing = await this.getLocalExpense(localId);
      if (!existing) return;
      const merged: LocalExpenseRow = { ...existing, ...patch };
      if (merged.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      const db = await getDb();
      await db.runAsync(
        `UPDATE local_expenses SET
          canonical_id = ?, child_id = ?, payload = ?, version = ?, sync_state = ?,
          pending_delete = ?, conflict_current = ?, last_error = ?, failure_kind = ?, updated_at = ?
         WHERE scope_key = ? AND local_id = ?`,
        merged.canonicalId,
        merged.childId,
        JSON.stringify(merged.payload),
        merged.version,
        merged.syncState,
        merged.pendingDelete ? 1 : 0,
        merged.conflictCurrent ? JSON.stringify(merged.conflictCurrent) : null,
        merged.lastError,
        merged.failureKind,
        merged.updatedAt,
        scopeKey,
        localId
      );
    },

    async deleteLocalExpense(localId) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM local_expenses WHERE scope_key = ? AND local_id = ?`, scopeKey, localId);
    },

    async listLocalExpenses(childId) {
      const db = await getDb();
      const rows = childId
          ? await db.getAllAsync<LocalExpenseSqlRow>(
            `SELECT * FROM local_expenses WHERE scope_key = ? AND child_id = ? ORDER BY created_at ASC`,
            scopeKey,
            childId
          )
        : await db.getAllAsync<LocalExpenseSqlRow>(
            `SELECT * FROM local_expenses WHERE scope_key = ? ORDER BY created_at ASC`,
            scopeKey
          );
      return rows.map(fromSqlLocalExpense);
    },

    async insertOutboxMutation(row) {
      if (row.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO mutation_outbox
          (scope_key, mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        scopeKey,
        row.mutationId,
        row.idempotencyKey,
        row.operation,
        row.targetLocalId,
        row.payload ? JSON.stringify(row.payload) : null,
        row.expectedVersion,
        row.attemptCount,
        row.nextRetryAt,
        row.lastError,
        row.createdAt,
        row.inFlight ? 1 : 0
      );
    },

    async getOutboxMutation(mutationId) {
      const db = await getDb();
      const row = await db.getFirstAsync<MutationOutboxSqlRow>(
        `SELECT * FROM mutation_outbox WHERE scope_key = ? AND mutation_id = ?`,
        scopeKey,
        mutationId
      );
      return row ? fromSqlMutation(row) : null;
    },

    async updateOutboxMutation(mutationId, patch) {
      const existing = await this.getOutboxMutation(mutationId);
      if (!existing) return;
      const merged: MutationOutboxRow = { ...existing, ...patch };
      if (merged.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      const db = await getDb();
      await db.runAsync(
        `UPDATE mutation_outbox SET
          idempotency_key = ?, operation = ?, target_local_id = ?, payload = ?,
          expected_version = ?, attempt_count = ?, next_retry_at = ?, last_error = ?, in_flight = ?
         WHERE scope_key = ? AND mutation_id = ?`,
        merged.idempotencyKey,
        merged.operation,
        merged.targetLocalId,
        merged.payload ? JSON.stringify(merged.payload) : null,
        merged.expectedVersion,
        merged.attemptCount,
        merged.nextRetryAt,
        merged.lastError,
        merged.inFlight ? 1 : 0,
        scopeKey,
        mutationId
      );
    },

    async deleteOutboxMutation(mutationId) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM mutation_outbox WHERE scope_key = ? AND mutation_id = ?`, scopeKey, mutationId);
    },

    async listOutboxMutations() {
      const db = await getDb();
      const rows = await db.getAllAsync<MutationOutboxSqlRow>(
        `SELECT * FROM mutation_outbox WHERE scope_key = ? ORDER BY created_at ASC`,
        scopeKey
      );
      return rows.map(fromSqlMutation);
    },

    async listOutboxMutationsForLocalId(localId) {
      const db = await getDb();
      const rows = await db.getAllAsync<MutationOutboxSqlRow>(
        `SELECT * FROM mutation_outbox WHERE scope_key = ? AND target_local_id = ? ORDER BY created_at ASC`,
        scopeKey,
        localId
      );
      return rows.map(fromSqlMutation);
    },

    async commitLocalMutation(input) {
      if (
        (input.localRow && (
          input.localRow.scopeKey !== scopeKey ||
          input.localRow.localId !== input.targetLocalId
        )) ||
        input.upsertMutations.some(
          (mutation) =>
            mutation.scopeKey !== scopeKey ||
            mutation.targetLocalId !== input.targetLocalId
        )
      ) {
        throw new Error("OFFLINE_SCOPE_MISMATCH");
      }
      const db = await getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const currentLocalSql = await txn.getFirstAsync<LocalExpenseSqlRow>(
          `SELECT * FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
          scopeKey,
          input.targetLocalId
        );
        const currentLocalRow = currentLocalSql ? fromSqlLocalExpense(currentLocalSql) : null;
        const localRevision = (row: LocalExpenseRow | null) =>
          row
            ? JSON.stringify([
                row.scopeKey,
                row.localId,
                row.canonicalId,
                row.childId,
                row.payload,
                row.version,
                row.syncState,
                row.pendingDelete,
                row.conflictCurrent,
                row.lastError,
                row.failureKind,
                row.createdAt,
                row.updatedAt
              ])
            : null;
        const currentMutationRows = await txn.getAllAsync<MutationOutboxSqlRow>(
          `SELECT * FROM mutation_outbox
            WHERE scope_key = ? AND target_local_id = ?
            ORDER BY created_at ASC`,
          scopeKey,
          input.targetLocalId
        );
        const currentMutations = currentMutationRows.map((row) => ({
          mutationId: row.mutation_id,
          inFlight: row.in_flight === 1
        }));
        if (
          localRevision(currentLocalRow) !== localRevision(input.expectedLocalRow) ||
          JSON.stringify(currentMutations) !== JSON.stringify(input.expectedMutations)
        ) {
          throw new Error("OFFLINE_MUTATION_RACE");
        }

        if (input.localRow) {
          const row = input.localRow;
          await txn.runAsync(
            `INSERT INTO local_expenses
              (scope_key, local_id, canonical_id, child_id, payload, version, sync_state,
               pending_delete, conflict_current, last_error, failure_kind, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(local_id) DO UPDATE SET
               canonical_id = excluded.canonical_id,
               child_id = excluded.child_id,
               payload = excluded.payload,
               version = excluded.version,
               sync_state = excluded.sync_state,
               pending_delete = excluded.pending_delete,
               conflict_current = excluded.conflict_current,
               last_error = excluded.last_error,
               failure_kind = excluded.failure_kind,
               updated_at = excluded.updated_at`,
            scopeKey,
            row.localId,
            row.canonicalId,
            row.childId,
            JSON.stringify(row.payload),
            row.version,
            row.syncState,
            row.pendingDelete ? 1 : 0,
            row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
            row.lastError,
            row.failureKind,
            row.createdAt,
            row.updatedAt
          );
        } else {
          await txn.runAsync(
            `DELETE FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
            scopeKey,
            input.targetLocalId
          );
        }
        for (const mutationId of input.deleteMutationIds) {
          await txn.runAsync(
            `DELETE FROM mutation_outbox
              WHERE scope_key = ? AND target_local_id = ? AND mutation_id = ?`,
            scopeKey,
            input.targetLocalId,
            mutationId
          );
        }
        for (const mutation of input.upsertMutations) {
          await txn.runAsync(
            `INSERT INTO mutation_outbox
              (scope_key, mutation_id, idempotency_key, operation, target_local_id, payload,
               expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(mutation_id) DO UPDATE SET
               idempotency_key = excluded.idempotency_key,
               operation = excluded.operation,
               target_local_id = excluded.target_local_id,
               payload = excluded.payload,
               expected_version = excluded.expected_version,
               attempt_count = excluded.attempt_count,
               next_retry_at = excluded.next_retry_at,
               last_error = excluded.last_error,
               in_flight = excluded.in_flight`,
            scopeKey,
            mutation.mutationId,
            mutation.idempotencyKey,
            mutation.operation,
            mutation.targetLocalId,
            mutation.payload ? JSON.stringify(mutation.payload) : null,
            mutation.expectedVersion,
            mutation.attemptCount,
            mutation.nextRetryAt,
            mutation.lastError,
            mutation.createdAt,
            mutation.inFlight ? 1 : 0
          );
        }
      });
    },

    async acknowledgeOutboxMutation(input) {
      const db = await getDb();
      let remainingMutationCount = 0;
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `DELETE FROM mutation_outbox
            WHERE scope_key = ? AND target_local_id = ? AND mutation_id = ?`,
          scopeKey,
          input.targetLocalId,
          input.mutationId
        );
        const countRow = await txn.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM mutation_outbox
            WHERE scope_key = ? AND target_local_id = ?`,
          scopeKey,
          input.targetLocalId
        );
        remainingMutationCount = countRow?.count ?? 0;
        if (input.deleteLocalExpense && remainingMutationCount === 0) {
          await txn.runAsync(
            `DELETE FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
            scopeKey,
            input.targetLocalId
          );
          return;
        }
        const currentSql = await txn.getFirstAsync<LocalExpenseSqlRow>(
          `SELECT * FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
          scopeKey,
          input.targetLocalId
        );
        if (!currentSql) return;
        const current = fromSqlLocalExpense(currentSql);
        const safePatch: Partial<LocalExpenseRow> | undefined = input.rowPatch
          ? { ...input.rowPatch }
          : undefined;
        if (remainingMutationCount > 0 && safePatch) delete safePatch.payload;
        const merged: LocalExpenseRow = {
          ...current,
          ...safePatch,
          scopeKey,
          syncState:
            remainingMutationCount > 0 ? "pending" : safePatch?.syncState ?? "synced",
          updatedAt: input.acknowledgedAt
        };
        await txn.runAsync(
          `UPDATE local_expenses SET
            canonical_id = ?, child_id = ?, payload = ?, version = ?, sync_state = ?,
            pending_delete = ?, conflict_current = ?, last_error = ?, failure_kind = ?, updated_at = ?
           WHERE scope_key = ? AND local_id = ?`,
          merged.canonicalId,
          merged.childId,
          JSON.stringify(merged.payload),
          merged.version,
          merged.syncState,
          merged.pendingDelete ? 1 : 0,
          merged.conflictCurrent ? JSON.stringify(merged.conflictCurrent) : null,
          merged.lastError,
          merged.failureKind,
          merged.updatedAt,
          scopeKey,
          input.targetLocalId
        );
      });
      return { remainingMutationCount };
    },

    async getLegacyQuarantineSummary() {
      const db = await getDb();
      const rows = await db.getAllAsync<{ classification: string; count: number }>(
        `SELECT classification, COUNT(*) AS count
           FROM legacy_quarantine
          GROUP BY classification`
      );
      const summary: LegacyQuarantineSummary = {
        total: 0,
        awaitingReconciliation: 0,
        ambiguous: 0,
        corrupt: 0,
        duplicate: 0,
        alreadySynced: 0
      };
      for (const row of rows) {
        summary.total += row.count;
        if (row.classification === "awaiting_reconciliation") summary.awaitingReconciliation += row.count;
        else if (row.classification === "ambiguous") summary.ambiguous += row.count;
        else if (row.classification === "corrupt") summary.corrupt += row.count;
        else if (row.classification === "duplicate") summary.duplicate += row.count;
        else if (row.classification === "already_synced") summary.alreadySynced += row.count;
      }
      return summary;
    },

    async listLegacyQuarantineEntries(limit) {
      const db = await getDb();
      const rows = await db.getAllAsync<LegacyQuarantineSqlRow>(
        `SELECT id, source_local_id, classification, reason_code, local_expense_json, outbox_json, created_at
           FROM legacy_quarantine
          WHERE classification = 'awaiting_reconciliation'
          ORDER BY created_at ASC, id ASC
          LIMIT ?`,
        Math.max(1, Math.min(50, limit))
      );
      return rows.map((row) => ({
        id: row.id,
        sourceLocalId: row.source_local_id,
        classification: row.classification,
        reasonCode: row.reason_code,
        localExpenseJson: row.local_expense_json,
        outboxJson: row.outbox_json,
        createdAt: row.created_at
      }));
    },

    async updateLegacyQuarantineEntry(id, classification, reasonCode) {
      const db = await getDb();
      await db.runAsync(
        `UPDATE legacy_quarantine
            SET classification = ?, reason_code = ?
          WHERE id = ?`,
        classification,
        reasonCode,
        id
      );
    },

    async deleteLegacyQuarantineEntry(id) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM legacy_quarantine WHERE id = ?`, id);
    },

    async restoreLegacyQuarantineEntry(id, row, mutations) {
      if (row && row.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      if (mutations.some((mutation) => mutation.scopeKey !== scopeKey)) {
        throw new Error("OFFLINE_SCOPE_MISMATCH");
      }
      const db = await getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (row) {
          await txn.runAsync(
            `INSERT INTO local_expenses
              (scope_key, local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, failure_kind, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            scopeKey,
            row.localId,
            row.canonicalId,
            row.childId,
            JSON.stringify(row.payload),
            row.version,
            row.syncState,
            row.pendingDelete ? 1 : 0,
            row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
            row.lastError,
            row.failureKind,
            row.createdAt,
            row.updatedAt
          );
        }
        for (const mutation of mutations) {
          await txn.runAsync(
            `INSERT INTO mutation_outbox
              (scope_key, mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            scopeKey,
            mutation.mutationId,
            mutation.idempotencyKey,
            mutation.operation,
            mutation.targetLocalId,
            mutation.payload ? JSON.stringify(mutation.payload) : null,
            mutation.expectedVersion,
            mutation.attemptCount,
            mutation.nextRetryAt,
            mutation.lastError,
            mutation.createdAt,
            0
          );
        }
        await txn.runAsync(`DELETE FROM legacy_quarantine WHERE id = ?`, id);
      });
    },

    async getRemoteSyncMetadata() {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM offline_metadata WHERE key = ?`,
        remoteSyncMetadataKey(scopeKey)
      );
      return parseRemoteSyncMetadata(row?.value);
    },

    async resetRemoteSyncMetadata(input) {
      const db = await getDb();
      const reset = emptyRemoteSyncMetadata();
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        const currentRow = await txn.getFirstAsync<{ value: string }>(
          `SELECT value FROM offline_metadata WHERE key = ?`,
          remoteSyncMetadataKey(scopeKey)
        );
        const current = parseRemoteSyncMetadata(currentRow?.value);
        if (current.cursor !== input.expectedCursor) {
          throw new Error("SYNC_CURSOR_CAS_MISMATCH");
        }
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        await txn.runAsync(
          `INSERT INTO offline_metadata (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          remoteSyncMetadataKey(scopeKey),
          JSON.stringify(reset),
          input.resetAt
        );
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
      });
      return reset;
    },

    async setRemoteSyncAuthorization(input) {
      const db = await getDb();
      let committed: RemoteSyncMetadata | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        const currentRow = await txn.getFirstAsync<{ value: string }>(
          `SELECT value FROM offline_metadata WHERE key = ?`,
          remoteSyncMetadataKey(scopeKey)
        );
        committed = {
          ...parseRemoteSyncMetadata(currentRow?.value),
          authorizationState: input.state,
          authorizationCheckedAt: input.checkedAt
        };
        await txn.runAsync(
          `INSERT INTO offline_metadata (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          remoteSyncMetadataKey(scopeKey),
          JSON.stringify(committed),
          input.checkedAt
        );
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
      });
      if (!committed) throw new Error("SYNC_AUTHORIZATION_NOT_COMMITTED");
      return committed;
    },

    async applyRemoteSyncPage(input) {
      const db = await getDb();
      let committed:
        | {
            affectedChildIds: string[];
            metadata: RemoteSyncMetadata;
          }
        | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        const metadataRow = await txn.getFirstAsync<{ value: string }>(
          `SELECT value FROM offline_metadata WHERE key = ?`,
          remoteSyncMetadataKey(scopeKey)
        );
        const currentMetadata = parseRemoteSyncMetadata(metadataRow?.value);
        if (currentMetadata.cursor !== input.expectedCursor) {
          throw new Error("SYNC_CURSOR_CAS_MISMATCH");
        }
        const localRows = (
          await txn.getAllAsync<LocalExpenseSqlRow>(
            `SELECT * FROM local_expenses WHERE scope_key = ? ORDER BY created_at ASC`,
            scopeKey
          )
        ).map(fromSqlLocalExpense);
        const mutations = (
          await txn.getAllAsync<MutationOutboxSqlRow>(
            `SELECT * FROM mutation_outbox WHERE scope_key = ? ORDER BY created_at ASC`,
            scopeKey
          )
        ).map(fromSqlMutation);
        const reconciled = reconcileRemoteSyncPage(
          scopeKey,
          localRows,
          mutations,
          input
        );

        for (const mutationId of reconciled.deleteMutationIds) {
          await txn.runAsync(
            `DELETE FROM mutation_outbox WHERE scope_key = ? AND mutation_id = ?`,
            scopeKey,
            mutationId
          );
        }
        for (const localId of reconciled.deleteLocalIds) {
          await txn.runAsync(
            `DELETE FROM local_expenses WHERE scope_key = ? AND local_id = ?`,
            scopeKey,
            localId
          );
        }
        for (const row of reconciled.upserts) {
          await txn.runAsync(
            `INSERT INTO local_expenses
              (scope_key, local_id, canonical_id, child_id, payload, version, sync_state,
               pending_delete, conflict_current, last_error, failure_kind, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(local_id) DO UPDATE SET
               canonical_id = excluded.canonical_id,
               child_id = excluded.child_id,
               payload = excluded.payload,
               version = excluded.version,
               sync_state = excluded.sync_state,
               pending_delete = excluded.pending_delete,
               conflict_current = excluded.conflict_current,
               last_error = excluded.last_error,
               failure_kind = excluded.failure_kind,
               updated_at = excluded.updated_at`,
            scopeKey,
            row.localId,
            row.canonicalId,
            row.childId,
            JSON.stringify(row.payload),
            row.version,
            row.syncState,
            row.pendingDelete ? 1 : 0,
            row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
            row.lastError,
            row.failureKind,
            row.createdAt,
            row.updatedAt
          );
        }

        const metadata: RemoteSyncMetadata = {
          protocolVersion: 2,
          cursor: input.nextCursor,
          baselineComplete: !input.hasMore,
          lastSuccessfulPullAt: input.hasMore
            ? currentMetadata.lastSuccessfulPullAt
            : input.appliedAt,
          authorizationState: "authorized",
          authorizationCheckedAt: input.appliedAt
        };
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        await txn.runAsync(
          `INSERT INTO offline_metadata (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          remoteSyncMetadataKey(scopeKey),
          JSON.stringify(metadata),
          input.appliedAt
        );
        if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
          throw new Error("SYNC_OWNER_CHANGED");
        }
        committed = {
          affectedChildIds: reconciled.affectedChildIds,
          metadata
        };
      });
      if (!committed) throw new Error("SYNC_PAGE_NOT_COMMITTED");
      return committed;
    }
  };
}
