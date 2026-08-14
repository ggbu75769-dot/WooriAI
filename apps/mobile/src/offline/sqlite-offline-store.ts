import * as SQLite from "expo-sqlite";
import type { LocalExpenseRow, MutationOutboxRow, OfflineStore, SyncState } from "./types";

/**
 * expo-sqlite-backed `OfflineStore` (design doc §3.1's `local_expenses` / `mutation_outbox`
 * tables). Not exercised by vitest (no native SQLite binding in node) -- see
 * memory-offline-store.ts for the test-covered equivalent this mirrors 1:1. Only imported from
 * app runtime code (src/offline/sync-controller.ts), never from a test file.
 */

const DB_NAME = "wooriai-offline.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS local_expenses (
          local_id TEXT PRIMARY KEY NOT NULL,
          canonical_id TEXT,
          child_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          version INTEGER,
          sync_state TEXT NOT NULL CHECK (sync_state IN ('pending','syncing','synced','failed','conflict')),
          pending_delete INTEGER NOT NULL DEFAULT 0,
          conflict_current TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS mutation_outbox (
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
        CREATE INDEX IF NOT EXISTS idx_mutation_outbox_target ON mutation_outbox(target_local_id);
        CREATE INDEX IF NOT EXISTS idx_mutation_outbox_created ON mutation_outbox(created_at);
        CREATE TABLE IF NOT EXISTS sync_meta (
          meta_key TEXT PRIMARY KEY NOT NULL,
          meta_value TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

type LocalExpenseSqlRow = {
  local_id: string;
  canonical_id: string | null;
  child_id: string;
  payload: string;
  version: number | null;
  sync_state: SyncState;
  pending_delete: number;
  conflict_current: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type MutationOutboxSqlRow = {
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

function fromSqlLocalExpense(row: LocalExpenseSqlRow): LocalExpenseRow {
  return {
    localId: row.local_id,
    canonicalId: row.canonical_id,
    childId: row.child_id,
    payload: JSON.parse(row.payload),
    version: row.version,
    syncState: row.sync_state,
    pendingDelete: Boolean(row.pending_delete),
    conflictCurrent: row.conflict_current ? JSON.parse(row.conflict_current) : null,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromSqlMutation(row: MutationOutboxSqlRow): MutationOutboxRow {
  return {
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

export function createSqliteOfflineStore(): OfflineStore {
  return {
    async insertLocalExpense(row) {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO local_expenses
          (local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.localId,
        row.canonicalId,
        row.childId,
        JSON.stringify(row.payload),
        row.version,
        row.syncState,
        row.pendingDelete ? 1 : 0,
        row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
        row.lastError,
        row.createdAt,
        row.updatedAt
      );
    },

    async getLocalExpense(localId) {
      const db = await getDb();
      const row = await db.getFirstAsync<LocalExpenseSqlRow>(
        `SELECT * FROM local_expenses WHERE local_id = ?`,
        localId
      );
      return row ? fromSqlLocalExpense(row) : null;
    },

    async updateLocalExpense(localId, patch) {
      const existing = await this.getLocalExpense(localId);
      if (!existing) return;
      const merged: LocalExpenseRow = { ...existing, ...patch };
      const db = await getDb();
      await db.runAsync(
        `UPDATE local_expenses SET
          canonical_id = ?, child_id = ?, payload = ?, version = ?, sync_state = ?,
          pending_delete = ?, conflict_current = ?, last_error = ?, updated_at = ?
         WHERE local_id = ?`,
        merged.canonicalId,
        merged.childId,
        JSON.stringify(merged.payload),
        merged.version,
        merged.syncState,
        merged.pendingDelete ? 1 : 0,
        merged.conflictCurrent ? JSON.stringify(merged.conflictCurrent) : null,
        merged.lastError,
        merged.updatedAt,
        localId
      );
    },

    async deleteLocalExpense(localId) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM local_expenses WHERE local_id = ?`, localId);
    },

    async listLocalExpenses(childId) {
      const db = await getDb();
      const rows = childId
        ? await db.getAllAsync<LocalExpenseSqlRow>(
            `SELECT * FROM local_expenses WHERE child_id = ? ORDER BY created_at ASC`,
            childId
          )
        : await db.getAllAsync<LocalExpenseSqlRow>(`SELECT * FROM local_expenses ORDER BY created_at ASC`);
      return rows.map(fromSqlLocalExpense);
    },

    async getMeta(key) {
      const db = await getDb();
      const row = await db.getFirstAsync<{ meta_value: string }>(
        `SELECT meta_value FROM sync_meta WHERE meta_key = ?`,
        key
      );
      return row ? row.meta_value : null;
    },

    async setMeta(key, value) {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO sync_meta (meta_key, meta_value) VALUES (?, ?)
         ON CONFLICT(meta_key) DO UPDATE SET meta_value = excluded.meta_value`,
        key,
        value
      );
    },

    async deleteMeta(key) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM sync_meta WHERE meta_key = ?`, key);
    },

    async insertOutboxMutation(row) {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO mutation_outbox
          (mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        `SELECT * FROM mutation_outbox WHERE mutation_id = ?`,
        mutationId
      );
      return row ? fromSqlMutation(row) : null;
    },

    async updateOutboxMutation(mutationId, patch) {
      const existing = await this.getOutboxMutation(mutationId);
      if (!existing) return;
      const merged: MutationOutboxRow = { ...existing, ...patch };
      const db = await getDb();
      await db.runAsync(
        `UPDATE mutation_outbox SET
          idempotency_key = ?, operation = ?, target_local_id = ?, payload = ?,
          expected_version = ?, attempt_count = ?, next_retry_at = ?, last_error = ?, in_flight = ?
         WHERE mutation_id = ?`,
        merged.idempotencyKey,
        merged.operation,
        merged.targetLocalId,
        merged.payload ? JSON.stringify(merged.payload) : null,
        merged.expectedVersion,
        merged.attemptCount,
        merged.nextRetryAt,
        merged.lastError,
        merged.inFlight ? 1 : 0,
        mutationId
      );
    },

    async deleteOutboxMutation(mutationId) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM mutation_outbox WHERE mutation_id = ?`, mutationId);
    },

    async listOutboxMutations() {
      const db = await getDb();
      const rows = await db.getAllAsync<MutationOutboxSqlRow>(`SELECT * FROM mutation_outbox ORDER BY created_at ASC`);
      return rows.map(fromSqlMutation);
    },

    async listOutboxMutationsForLocalId(localId) {
      const db = await getDb();
      const rows = await db.getAllAsync<MutationOutboxSqlRow>(
        `SELECT * FROM mutation_outbox WHERE target_local_id = ? ORDER BY created_at ASC`,
        localId
      );
      return rows.map(fromSqlMutation);
    }
  };
}
