import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyLegacyOfflineRows,
  OFFLINE_SQLITE_SCHEMA_VERSION,
  type LegacyLocalExpenseSqlRow,
  type LegacyMutationSqlRow
} from "./sqlite-upgrade";

const sqliteCandidates = [
  process.env.SQLITE3_PATH,
  "C:\\Users\\nj970\\AppData\\Local\\Android\\Sdk\\platform-tools\\sqlite3.exe",
  "sqlite3"
].filter((value): value is string => Boolean(value));

function sqlitePath(): string | null {
  for (const candidate of sqliteCandidates) {
    if (candidate === "sqlite3" || existsSync(candidate)) return candidate;
  }
  return null;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(executable: string, database: string, sql: string): string {
  return execFileSync(executable, [database, sql], { encoding: "utf8" })
    .replaceAll("\r\n", "\n")
    .trim();
}

function runSqlStatus(executable: string, database: string, sql: string): number {
  return spawnSync(executable, [database, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).status ?? -1;
}

function localRow(overrides: Partial<LegacyLocalExpenseSqlRow> = {}): LegacyLocalExpenseSqlRow {
  return {
    local_id: "local-1",
    canonical_id: null,
    child_id: "child-1",
    payload: JSON.stringify({
      childId: "child-1",
      categoryId: "category-1",
      amountKrw: 12_000,
      spentOn: "2026-07-17",
      itemName: "기저귀",
      expenseType: "refund"
    }),
    version: null,
    sync_state: "pending",
    pending_delete: 0,
    conflict_current: null,
    last_error: null,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
    ...overrides
  };
}

function mutationRow(overrides: Partial<LegacyMutationSqlRow> = {}): LegacyMutationSqlRow {
  return {
    mutation_id: "mutation-1",
    idempotency_key: "idem-1",
    operation: "create",
    target_local_id: "local-1",
    payload: localRow().payload,
    expected_version: null,
    attempt_count: 0,
    next_retry_at: null,
    last_error: null,
    created_at: "2026-07-17T00:00:00.000Z",
    in_flight: 0,
    ...overrides
  };
}

function seedLegacyDatabase(
  executable: string,
  database: string,
  row: LegacyLocalExpenseSqlRow,
  mutation: LegacyMutationSqlRow
) {
  runSql(executable, database, `
    CREATE TABLE local_expenses (
      local_id TEXT PRIMARY KEY NOT NULL, canonical_id TEXT, child_id TEXT NOT NULL,
      payload TEXT NOT NULL, version INTEGER, sync_state TEXT NOT NULL,
      pending_delete INTEGER NOT NULL DEFAULT 0, conflict_current TEXT, last_error TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE mutation_outbox (
      mutation_id TEXT PRIMARY KEY NOT NULL, idempotency_key TEXT NOT NULL, operation TEXT NOT NULL,
      target_local_id TEXT NOT NULL, payload TEXT, expected_version INTEGER, attempt_count INTEGER NOT NULL,
      next_retry_at TEXT, last_error TEXT, created_at TEXT NOT NULL, in_flight INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO local_expenses VALUES (
      ${sqlString(row.local_id)}, NULL, ${sqlString(row.child_id)}, ${sqlString(row.payload)},
      NULL, ${sqlString(row.sync_state)}, 0, NULL, NULL,
      ${sqlString(row.created_at)}, ${sqlString(row.updated_at)}
    );
    INSERT INTO mutation_outbox VALUES (
      ${sqlString(mutation.mutation_id)}, ${sqlString(mutation.idempotency_key)},
      ${sqlString(mutation.operation)}, ${sqlString(mutation.target_local_id)},
      ${sqlString(mutation.payload!)}, NULL, 0, NULL, NULL,
      ${sqlString(mutation.created_at)}, 1
    );
  `);
}

function fixtureMigrationSql(
  record: ReturnType<typeof classifyLegacyOfflineRows>[number]
) {
  return `
    BEGIN IMMEDIATE;
    ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
    ALTER TABLE local_expenses ADD COLUMN failure_kind TEXT;
    ALTER TABLE mutation_outbox ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
    CREATE TABLE legacy_quarantine (
      id TEXT PRIMARY KEY NOT NULL, source_local_id TEXT NOT NULL, classification TEXT NOT NULL,
      reason_code TEXT NOT NULL, local_expense_json TEXT NOT NULL, outbox_json TEXT NOT NULL,
      created_at TEXT NOT NULL, quarantined_at TEXT NOT NULL
    );
    INSERT INTO legacy_quarantine VALUES (
      ${sqlString(record.id)}, ${sqlString(record.sourceLocalId)}, ${sqlString(record.classification)},
      ${sqlString(record.reasonCode)}, ${sqlString(record.localExpenseJson)},
      ${sqlString(record.outboxJson)}, ${sqlString(record.createdAt)}, ${sqlString(record.createdAt)}
    );
    DELETE FROM mutation_outbox WHERE scope_key = '__legacy_unscoped__';
    DELETE FROM local_expenses WHERE scope_key = '__legacy_unscoped__';
    CREATE INDEX idx_legacy_quarantine_classification
      ON legacy_quarantine(classification, created_at);
    PRAGMA user_version = ${OFFLINE_SQLITE_SCHEMA_VERSION};
    COMMIT;
  `;
}

const tempFiles: string[] = [];

afterEach(() => {
  for (const path of tempFiles.splice(0)) {
    rmSync(path, { force: true });
  }
});

describe("legacy SQLite scope upgrade", () => {
  it("classifies only server-reconcilable rows as awaiting reconciliation", () => {
    const rows = [
      localRow(),
      localRow({ local_id: "local-ambiguous", sync_state: "pending" }),
      localRow({ local_id: "local-synced", sync_state: "synced" }),
      localRow({ local_id: "local-corrupt", payload: "{" }),
      localRow({ local_id: "local-duplicate" })
    ];
    const mutations = [
      mutationRow(),
      mutationRow({
        mutation_id: "mutation-duplicate",
        target_local_id: "local-duplicate"
      })
    ];

    const classified = classifyLegacyOfflineRows(rows, mutations);
    expect(classified.map((row) => [row.sourceLocalId, row.classification])).toEqual([
      ["local-1", "awaiting_reconciliation"],
      ["local-ambiguous", "ambiguous"],
      ["local-synced", "already_synced"],
      ["local-corrupt", "corrupt"],
      ["local-duplicate", "duplicate"]
    ]);
    expect(JSON.parse(JSON.parse(classified[0].localExpenseJson).payload)).toMatchObject({
      amountKrw: 12_000,
      expenseType: "refund"
    });
  });

  it("keeps schema and rows unchanged after a transaction failure, then upgrades idempotently", () => {
    const executable = sqlitePath();
    if (!executable) return;
    const database = join(tmpdir(), `wooriai-release4f-${process.pid}-${Date.now()}.db`);
    tempFiles.push(database);
    const row = localRow();
    const mutation = mutationRow();
    seedLegacyDatabase(executable, database, row, mutation);

    expect(
      runSqlStatus(executable, database, `
        BEGIN IMMEDIATE;
        ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        SELECT no_such_release4f_failure_hook();
        COMMIT;
      `)
    ).not.toBe(0);
    expect(runSql(executable, database, "PRAGMA user_version; SELECT COUNT(*) FROM local_expenses;"))
      .toBe("0\n1");

    const [record] = classifyLegacyOfflineRows([row], [mutation]);
    runSql(executable, database, fixtureMigrationSql(record));
    expect(
      runSql(
        executable,
        database,
        "PRAGMA integrity_check; PRAGMA user_version; SELECT COUNT(*) FROM local_expenses; SELECT COUNT(*) FROM legacy_quarantine;"
      )
    ).toBe(`ok\n${OFFLINE_SQLITE_SCHEMA_VERSION}\n0\n1`);

    for (let reopen = 0; reopen < 30; reopen += 1) {
      expect(runSql(executable, database, "PRAGMA integrity_check; PRAGMA user_version;"))
        .toBe(`ok\n${OFFLINE_SQLITE_SCHEMA_VERSION}`);
    }
  });

  it("rolls back and reopens cleanly at five migration failure boundaries", () => {
    const executable = sqlitePath();
    if (!executable) return;
    const row = localRow();
    const mutation = mutationRow();
    const [record] = classifyLegacyOfflineRows([row], [mutation]);
    const boundaries = [
      "SELECT no_such_release4f_before_schema();",
      `
        ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        SELECT no_such_release4f_after_schema();
      `,
      `
        ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        ALTER TABLE mutation_outbox ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        CREATE TABLE legacy_quarantine (
          id TEXT PRIMARY KEY NOT NULL, source_local_id TEXT NOT NULL, classification TEXT NOT NULL,
          reason_code TEXT NOT NULL, local_expense_json TEXT NOT NULL, outbox_json TEXT NOT NULL,
          created_at TEXT NOT NULL, quarantined_at TEXT NOT NULL
        );
        INSERT INTO legacy_quarantine VALUES (
          ${sqlString(record.id)}, ${sqlString(record.sourceLocalId)}, ${sqlString(record.classification)},
          ${sqlString(record.reasonCode)}, ${sqlString(record.localExpenseJson)},
          ${sqlString(record.outboxJson)}, ${sqlString(record.createdAt)}, ${sqlString(record.createdAt)}
        );
        SELECT no_such_release4f_after_row_half();
      `,
      `
        ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        ALTER TABLE mutation_outbox ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        CREATE TABLE legacy_quarantine (
          id TEXT PRIMARY KEY NOT NULL, source_local_id TEXT NOT NULL, classification TEXT NOT NULL,
          reason_code TEXT NOT NULL, local_expense_json TEXT NOT NULL, outbox_json TEXT NOT NULL,
          created_at TEXT NOT NULL, quarantined_at TEXT NOT NULL
        );
        DELETE FROM mutation_outbox WHERE scope_key = '__legacy_unscoped__';
        DELETE FROM local_expenses WHERE scope_key = '__legacy_unscoped__';
        SELECT no_such_release4f_before_index();
      `,
      `
        ALTER TABLE local_expenses ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        ALTER TABLE mutation_outbox ADD COLUMN scope_key TEXT NOT NULL DEFAULT '__legacy_unscoped__';
        CREATE TABLE legacy_quarantine (
          id TEXT PRIMARY KEY NOT NULL, source_local_id TEXT NOT NULL, classification TEXT NOT NULL,
          reason_code TEXT NOT NULL, local_expense_json TEXT NOT NULL, outbox_json TEXT NOT NULL,
          created_at TEXT NOT NULL, quarantined_at TEXT NOT NULL
        );
        INSERT INTO legacy_quarantine VALUES (
          ${sqlString(record.id)}, ${sqlString(record.sourceLocalId)}, ${sqlString(record.classification)},
          ${sqlString(record.reasonCode)}, ${sqlString(record.localExpenseJson)},
          ${sqlString(record.outboxJson)}, ${sqlString(record.createdAt)}, ${sqlString(record.createdAt)}
        );
        DELETE FROM mutation_outbox WHERE scope_key = '__legacy_unscoped__';
        DELETE FROM local_expenses WHERE scope_key = '__legacy_unscoped__';
        CREATE INDEX idx_legacy_quarantine_classification
          ON legacy_quarantine(classification, created_at);
        PRAGMA user_version = ${OFFLINE_SQLITE_SCHEMA_VERSION};
        SELECT no_such_release4f_before_commit();
      `
    ];

    boundaries.forEach((body, index) => {
      const database = join(
        tmpdir(),
        `wooriai-release4f-boundary-${process.pid}-${Date.now()}-${index}.db`
      );
      tempFiles.push(database);
      seedLegacyDatabase(executable, database, row, mutation);
      expect(runSqlStatus(executable, database, `BEGIN IMMEDIATE; ${body} COMMIT;`))
        .not.toBe(0);
      expect(runSql(
        executable,
        database,
        `
          PRAGMA integrity_check;
          PRAGMA user_version;
          SELECT COUNT(*) FROM local_expenses;
          SELECT COUNT(*) FROM mutation_outbox;
          SELECT COUNT(*) FROM pragma_table_info('local_expenses') WHERE name = 'scope_key';
          SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'legacy_quarantine';
        `
      )).toBe("ok\n0\n1\n1\n0\n0");

      runSql(executable, database, fixtureMigrationSql(record));
      expect(runSql(
        executable,
        database,
        `
          PRAGMA integrity_check;
          PRAGMA user_version;
          SELECT COUNT(*) FROM local_expenses;
          SELECT COUNT(*) FROM mutation_outbox;
          SELECT COUNT(*) FROM legacy_quarantine;
        `
      )).toBe(`ok\n${OFFLINE_SQLITE_SCHEMA_VERSION}\n0\n0\n1`);
    });
  });
});
