import * as SQLite from "expo-sqlite";
import type {
  ItemStatusOutboxRow,
  ItemStatusSyncState,
  ItemStatusValue,
  LocalExpenseRow,
  MutationOutboxRow,
  OfflineStore,
  SyncState
} from "./types";

/**
 * expo-sqlite-backed `OfflineStore` (design doc §3.1's `local_expenses` / `mutation_outbox`
 * tables). The store *methods* are not exercised by vitest (no native SQLite binding in node) --
 * see memory-offline-store.ts for the test-covered equivalent they mirror 1:1. Only imported from
 * app runtime code (src/offline/sync-controller.ts), never from a test file.
 *
 * 예외가 하나 있다: 아래 **마이그레이션 러너와 SQL 목록**은 expo-sqlite를 몰라도 되는 순수한
 * 값/함수(구조 타입 `MigratableDatabase`만 받는다)라, sqlite-migrations.test.ts가 node의 내장
 * SQLite로 v0→v1→v2를 실제로 돌려 본다 — 그 파일은 `expo-sqlite`를 vi.mock으로 막고 이 모듈에서
 * 러너와 목록만 가져간다(저장소 팩토리는 건드리지 않는다).
 */

const DB_NAME = "wooriai-offline.db";

/**
 * 라운드 57 #7 — 로컬 저장소 마이그레이션 장치.
 *
 * ## 없어서 무슨 일이 일어날 뻔했나
 *
 * 이 파일에는 `CREATE TABLE IF NOT EXISTS` 네 벌만 있었고 버전 개념이 전혀 없었다. 그래서
 * **테이블을 새로 추가하는 변경**은 우연히 안전했지만(없으면 만들고, 있으면 건너뛴다), **기존
 * 테이블에 컬럼을 더하는 변경**은 방법 자체가 없었다: 이미 그 테이블을 들고 있는 기기에서는
 * CREATE가 통째로 건너뛰어지므로 새 컬럼이 영원히 생기지 않고, 그 컬럼을 읽고 쓰는 새 코드가
 * 실행되는 순간 `no such column`으로 **모든 오프라인 쓰기가 실패**한다. 앱을 새로 깔면 되는
 * 종류의 실패가 아니다 — 이 DB에는 아직 서버에 못 보낸 지출이 들어 있다.
 *
 * ## 규약
 *
 * - 버전의 진실은 `PRAGMA user_version`(SQLite가 파일 헤더에 들고 다니는 정수) 하나다.
 * - v1 = **지금까지의 스키마 그대로**다. 기존 기기는 user_version이 0이지만 테이블은 이미 있으므로,
 *   v0→v1을 `CREATE TABLE IF NOT EXISTS`로 두어 "만들거나 / 이미 있으면 그냥 넘어가거나" 양쪽을
 *   같은 문장으로 처리한다. 신규 설치는 이 한 단계로 스키마 전체를 얻는다.
 * - 새 변경은 **언제나 새 버전 번호를 하나 더 붙인다**. 이미 배포된 버전의 SQL은 고치지 않는다
 *   (그 SQL은 남의 기기에서 이미 실행됐다).
 * - 각 버전은 **한 트랜잭션**이다. 중간에 실패하면 그 버전의 문장도 user_version도 통째로 롤백되고
 *   러너는 던진다 — 반쯤 적용된 스키마로 앱이 계속 도는 상태를 만들지 않는다.
 */
export type OfflineDbMigration = {
  /** 1부터 1씩 증가. 이 값이 성공 후 `PRAGMA user_version`에 그대로 들어간다. */
  version: number;
  /**
   * 한 문장씩 나눠 담는다(한 덩어리 문자열이 아니라). 실패했을 때 어느 문장이 문제였는지가
   * 그대로 드러나고, 러너가 문장 사이에 트랜잭션 경계를 넣을 수 있다.
   */
  statements: string[];
};

export const OFFLINE_DB_MIGRATIONS: readonly OfflineDbMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS local_expenses (
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
        )`,
      `CREATE TABLE IF NOT EXISTS mutation_outbox (
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
        )`,
      `CREATE INDEX IF NOT EXISTS idx_mutation_outbox_target ON mutation_outbox(target_local_id)`,
      `CREATE INDEX IF NOT EXISTS idx_mutation_outbox_created ON mutation_outbox(created_at)`,
      `CREATE TABLE IF NOT EXISTS sync_meta (
          meta_key TEXT PRIMARY KEY NOT NULL,
          meta_value TEXT NOT NULL
        )`,
      /*
       * 라운드 51 C-10 — 준비템 상태 큐. 왜 mutation_outbox에 합치지 않았는지는
       * src/offline/types.ts의 ItemStatusOutboxRow 주석 참고.
       *
       * sync_state CHECK 집합이 지출과 다른 것(conflict·synced 없음)도 의도다: 상태 변경에는
       * 버전 충돌 개념이 없고, 성공한 행은 남기지 않고 지운다.
       */
      `CREATE TABLE IF NOT EXISTS item_status_outbox (
          mutation_id TEXT PRIMARY KEY NOT NULL,
          child_id TEXT NOT NULL,
          item_template_id TEXT NOT NULL,
          status TEXT NOT NULL,
          item_name TEXT NOT NULL,
          sync_state TEXT NOT NULL CHECK (sync_state IN ('pending','syncing','failed')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          in_flight INTEGER NOT NULL DEFAULT 0
        )`,
      `CREATE INDEX IF NOT EXISTS idx_item_status_outbox_item ON item_status_outbox(child_id, item_template_id)`,
      `CREATE INDEX IF NOT EXISTS idx_item_status_outbox_created ON item_status_outbox(created_at)`
    ]
  },
  {
    /**
     * 라운드 57 #8 — 실패 사유의 구조화. 지금까지 실패 행이 남기는 것은 사람이 읽는 문장
     * (`last_error`) 하나뿐이었고, "이 행을 다시 보내면 성공하나"라는 질문의 답이 그 문자열과
     * 표 문구의 글자 단위 비교에 매달려 있었다(src/offline/permission-denied.ts).
     *
     * 컬럼을 더하는 첫 마이그레이션이기도 하다 — 위 러너 주석이 말하는, 예전 구조로는 아예
     * 불가능했던 종류의 변경이 정확히 이것이다.
     *
     * NULL 허용이고 DEFAULT가 없다: 이 컬럼이 생기기 전에 실패한 행의 값은 **모름**이며, 그
     * 사실을 0이나 빈 문자열로 위장하지 않는다(판정은 NULL일 때만 예전 문자열 비교로 폴백한다).
     */
    version: 2,
    statements: [
      `ALTER TABLE local_expenses ADD COLUMN last_error_status INTEGER`,
      `ALTER TABLE local_expenses ADD COLUMN last_error_code TEXT`,
      `ALTER TABLE mutation_outbox ADD COLUMN last_error_status INTEGER`,
      `ALTER TABLE mutation_outbox ADD COLUMN last_error_code TEXT`,
      `ALTER TABLE item_status_outbox ADD COLUMN last_error_status INTEGER`,
      `ALTER TABLE item_status_outbox ADD COLUMN last_error_code TEXT`
    ]
  }
];

/** 이 빌드가 기대하는 스키마 버전 = 목록의 마지막 번호. */
export const OFFLINE_DB_SCHEMA_VERSION =
  OFFLINE_DB_MIGRATIONS[OFFLINE_DB_MIGRATIONS.length - 1]?.version ?? 0;

/**
 * 한 버전의 마이그레이션이 실패했다. 원본 오류를 `reason`으로 그대로 들고 다닌다 — 어느 버전의
 * 어느 문장이 문제였는지가 진단의 전부이기 때문이다.
 */
export class OfflineDbMigrationError extends Error {
  readonly version: number;
  readonly reason: unknown;
  constructor(version: number, reason: unknown) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    super(`offline db migration v${version} failed: ${detail}`);
    this.name = "OfflineDbMigrationError";
    this.version = version;
    this.reason = reason;
  }
}

/**
 * 러너가 필요로 하는 최소한의 DB. expo-sqlite의 `SQLiteDatabase`가 구조적으로 이 모양을
 * 만족하고, 테스트는 node 내장 SQLite를 이 모양으로 감싸 **진짜 SQL로** 왕복을 검증한다.
 */
export type MigratableDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
};

async function readUserVersion(db: MigratableDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version?: unknown }>("PRAGMA user_version");
  const value = row?.user_version;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * `PRAGMA user_version`부터 목록의 마지막 버전까지 **순서대로** 적용하고, 도달한 버전을 돌려준다.
 *
 * 실패 안전성: 각 버전은 `BEGIN … COMMIT` 한 덩어리이고, 그 안에서 문장 하나라도 던지면 `ROLLBACK`
 * 후 `OfflineDbMigrationError`로 중단한다. SQLite는 DDL도 user_version도 트랜잭션의 일부라
 * (둘 다 같은 파일 헤더/스키마 페이지를 쓴다) 롤백 후의 DB는 그 버전을 시작하기 전과 **완전히**
 * 같다. 그래서 "컬럼은 생겼는데 user_version은 그대로"(다음 실행에서 duplicate column으로 영구
 * 실패)나 그 반대 같은 반쯤 적용 상태가 생길 수 없다.
 *
 * 다운그레이드(기기의 user_version이 이 빌드가 아는 마지막 버전보다 큰 경우 — 새 버전을 쓰다가
 * 구버전 APK로 되돌린 사용자)에는 **아무것도 하지 않는다.** 되돌릴 SQL을 실행하는 쪽이 훨씬
 * 위험하다: 이 빌드가 모르는 컬럼을 지우면 새 빌드로 돌아갔을 때 그 데이터가 이미 없다. 모르는
 * 컬럼이 몇 개 더 있는 테이블은 이 빌드의 INSERT/UPDATE(컬럼을 명시적으로 나열한다)에 아무런
 * 영향을 주지 않으므로 그대로 두는 편이 안전하다.
 */
export async function runOfflineDbMigrations(
  db: MigratableDatabase,
  migrations: readonly OfflineDbMigration[] = OFFLINE_DB_MIGRATIONS
): Promise<number> {
  let version = await readUserVersion(db);
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      // user_version은 SQL 리터럴로 들어가므로(PRAGMA는 파라미터 바인딩을 받지 않는다) 숫자임을
      // 여기서 못 박는다. 목록은 이 파일의 상수라 실제로는 도달할 수 없는 방어선이다.
      throw new OfflineDbMigrationError(migration.version, new Error("migration version must be a positive integer"));
    }
    try {
      await db.execAsync("BEGIN");
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      await db.execAsync("COMMIT");
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK");
      } catch {
        // BEGIN 자체가 실패했거나 SQLite가 이미 되돌린 경우다. 원본 실패를 덮지 않는다.
      }
      throw new OfflineDbMigrationError(migration.version, error);
    }
    version = migration.version;
  }
  return version;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      // WAL은 트랜잭션 안에서 바꿀 수 없으므로 마이그레이션 **밖**에서, 열자마자 한 번 건다.
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
      // 실패하면 이 promise가 거부된 채로 남아 이후 모든 저장소 호출이 같은 오류로 실패한다.
      // 의도한 동작이다: 스키마가 코드의 기대와 어긋난 채로 쓰기를 계속하는 것보다, 명확히
      // 멈추고 sync-controller의 오류 경로로 넘기는 편이 데이터에 안전하다.
      await runOfflineDbMigrations(db);
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
  /** v2. 이 컬럼이 생기기 전에 실패한 행에서는 NULL = 모름(types.ts의 lastErrorStatus 주석). */
  last_error_status: number | null;
  last_error_code: string | null;
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
  /** v2. 위와 같은 계약. */
  last_error_status: number | null;
  last_error_code: string | null;
  created_at: string;
  in_flight: number;
};

type ItemStatusOutboxSqlRow = {
  mutation_id: string;
  child_id: string;
  item_template_id: string;
  status: ItemStatusValue;
  item_name: string;
  sync_state: ItemStatusSyncState;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  /** v2. 위와 같은 계약. */
  last_error_status: number | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  in_flight: number;
};

/**
 * v2 컬럼은 마이그레이션 이후에도 **행 단위로 NULL일 수 있다**(그 전에 실패해 남아 있는 행).
 * `?? null`로 접어 "모름"을 하나의 값으로 통일한다 — undefined와 null이 섞이면 판정부가 두 가지
 * 빈 값을 각각 다뤄야 한다.
 */
function fromSqlErrorReason(row: { last_error_status: number | null; last_error_code: string | null }) {
  return {
    lastErrorStatus: typeof row.last_error_status === "number" ? row.last_error_status : null,
    lastErrorCode: row.last_error_code ?? null
  };
}

function fromSqlItemStatus(row: ItemStatusOutboxSqlRow): ItemStatusOutboxRow {
  return {
    mutationId: row.mutation_id,
    childId: row.child_id,
    itemTemplateId: row.item_template_id,
    status: row.status,
    itemName: row.item_name,
    syncState: row.sync_state,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
    ...fromSqlErrorReason(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    inFlight: Boolean(row.in_flight)
  };
}

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
    ...fromSqlErrorReason(row),
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
    ...fromSqlErrorReason(row),
    createdAt: row.created_at,
    inFlight: Boolean(row.in_flight)
  };
}

/** 행 patch가 사유를 안 건드릴 때(대부분의 patch) 기존 값을 그대로 다시 쓰기 위한 정규화.
 * `undefined`("이 patch는 이 필드를 말하지 않았다")와 `null`("모름")을 여기서 하나로 접는다. */
function toSqlErrorReason(row: { lastErrorStatus?: number | null; lastErrorCode?: string | null }) {
  return {
    status: typeof row.lastErrorStatus === "number" ? row.lastErrorStatus : null,
    code: row.lastErrorCode ?? null
  };
}

export function createSqliteOfflineStore(): OfflineStore {
  return {
    async insertLocalExpense(row) {
      const db = await getDb();
      const reason = toSqlErrorReason(row);
      await db.runAsync(
        `INSERT INTO local_expenses
          (local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, last_error_status, last_error_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.localId,
        row.canonicalId,
        row.childId,
        JSON.stringify(row.payload),
        row.version,
        row.syncState,
        row.pendingDelete ? 1 : 0,
        row.conflictCurrent ? JSON.stringify(row.conflictCurrent) : null,
        row.lastError,
        reason.status,
        reason.code,
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
      const reason = toSqlErrorReason(merged);
      const db = await getDb();
      await db.runAsync(
        `UPDATE local_expenses SET
          canonical_id = ?, child_id = ?, payload = ?, version = ?, sync_state = ?,
          pending_delete = ?, conflict_current = ?, last_error = ?, last_error_status = ?,
          last_error_code = ?, updated_at = ?
         WHERE local_id = ?`,
        merged.canonicalId,
        merged.childId,
        JSON.stringify(merged.payload),
        merged.version,
        merged.syncState,
        merged.pendingDelete ? 1 : 0,
        merged.conflictCurrent ? JSON.stringify(merged.conflictCurrent) : null,
        merged.lastError,
        reason.status,
        reason.code,
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

    async clearAll() {
      // PRIV-104 session teardown: all four tables in one transaction so a crash mid-wipe can
      // never leave a half-cleared state (e.g. expenses gone but their outbox mutations still
      // queued for the next account's flush pass). 라운드 51 C-10에서 item_status_outbox가
      // 같은 트랜잭션에 합류한다 -- 준비 상태 변경도 계정 단위 상태다.
      const db = await getDb();
      await db.execAsync(`
        BEGIN;
        DELETE FROM local_expenses;
        DELETE FROM mutation_outbox;
        DELETE FROM item_status_outbox;
        DELETE FROM sync_meta;
        COMMIT;
      `);
    },

    async insertOutboxMutation(row) {
      const db = await getDb();
      const reason = toSqlErrorReason(row);
      await db.runAsync(
        `INSERT INTO mutation_outbox
          (mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, last_error_status, last_error_code, created_at, in_flight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.mutationId,
        row.idempotencyKey,
        row.operation,
        row.targetLocalId,
        row.payload ? JSON.stringify(row.payload) : null,
        row.expectedVersion,
        row.attemptCount,
        row.nextRetryAt,
        row.lastError,
        reason.status,
        reason.code,
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
      const reason = toSqlErrorReason(merged);
      const db = await getDb();
      await db.runAsync(
        `UPDATE mutation_outbox SET
          idempotency_key = ?, operation = ?, target_local_id = ?, payload = ?,
          expected_version = ?, attempt_count = ?, next_retry_at = ?, last_error = ?,
          last_error_status = ?, last_error_code = ?, in_flight = ?
         WHERE mutation_id = ?`,
        merged.idempotencyKey,
        merged.operation,
        merged.targetLocalId,
        merged.payload ? JSON.stringify(merged.payload) : null,
        merged.expectedVersion,
        merged.attemptCount,
        merged.nextRetryAt,
        merged.lastError,
        reason.status,
        reason.code,
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
    },

    async insertItemStatusMutation(row) {
      const db = await getDb();
      const reason = toSqlErrorReason(row);
      await db.runAsync(
        `INSERT INTO item_status_outbox
          (mutation_id, child_id, item_template_id, status, item_name, sync_state, attempt_count, next_retry_at, last_error, last_error_status, last_error_code, created_at, updated_at, in_flight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.mutationId,
        row.childId,
        row.itemTemplateId,
        row.status,
        row.itemName,
        row.syncState,
        row.attemptCount,
        row.nextRetryAt,
        row.lastError,
        reason.status,
        reason.code,
        row.createdAt,
        row.updatedAt,
        row.inFlight ? 1 : 0
      );
    },

    async updateItemStatusMutation(mutationId, patch) {
      const db = await getDb();
      const existing = await db.getFirstAsync<ItemStatusOutboxSqlRow>(
        `SELECT * FROM item_status_outbox WHERE mutation_id = ?`,
        mutationId
      );
      if (!existing) return;
      const merged: ItemStatusOutboxRow = { ...fromSqlItemStatus(existing), ...patch };
      const reason = toSqlErrorReason(merged);
      await db.runAsync(
        `UPDATE item_status_outbox SET
          child_id = ?, item_template_id = ?, status = ?, item_name = ?, sync_state = ?,
          attempt_count = ?, next_retry_at = ?, last_error = ?, last_error_status = ?,
          last_error_code = ?, updated_at = ?, in_flight = ?
         WHERE mutation_id = ?`,
        merged.childId,
        merged.itemTemplateId,
        merged.status,
        merged.itemName,
        merged.syncState,
        merged.attemptCount,
        merged.nextRetryAt,
        merged.lastError,
        reason.status,
        reason.code,
        merged.updatedAt,
        merged.inFlight ? 1 : 0,
        mutationId
      );
    },

    async deleteItemStatusMutation(mutationId) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM item_status_outbox WHERE mutation_id = ?`, mutationId);
    },

    async listItemStatusMutations() {
      const db = await getDb();
      const rows = await db.getAllAsync<ItemStatusOutboxSqlRow>(
        `SELECT * FROM item_status_outbox ORDER BY created_at ASC`
      );
      return rows.map(fromSqlItemStatus);
    },

    async listItemStatusMutationsForItem(childId, itemTemplateId) {
      const db = await getDb();
      const rows = await db.getAllAsync<ItemStatusOutboxSqlRow>(
        `SELECT * FROM item_status_outbox WHERE child_id = ? AND item_template_id = ? ORDER BY created_at ASC`,
        childId,
        itemTemplateId
      );
      return rows.map(fromSqlItemStatus);
    }
  };
}
