import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 라운드 61 #4 — `local_expenses`의 synced 행 수명.
 *
 * ## 왜 이 파일도 "진짜 SQL"로 도는가
 *
 * sqlite-migrations.test.ts와 같은 이유이고 같은 장치다(그 파일 헤더 참고): 여기서 확인하려는
 * 것은 **SQLite 엔진이 이 DELETE로 무엇을 지우고 무엇을 남기는가**이지 소스의 문자열이 아니다.
 * 파기 제외 계약이 한 줄이라도 어긋나면 잃는 것은 아직 서버에 못 보낸 지출·사용자가 지운 기록·
 * 사용자가 아직 고르지 않은 충돌 선택지다 — 문자열 대조로는 절대 붙들 수 없는 종류의 사실이다.
 *
 * `node:sqlite`를 `process.getBuiltinModule`로 가져오는 이유도 그 파일과 같다(vite의 externals
 * 목록에 아직 없어 `import "node:sqlite"`가 해석 단계에서 실패한다).
 */

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: () => {
    throw new Error("expo-sqlite must not be opened in vitest");
  }
}));

import {
  OFFLINE_DB_MIGRATIONS,
  PURGE_EXPIRED_SYNCED_LOCAL_EXPENSES_SQL,
  purgeExpiredSyncedLocalExpenses,
  runOfflineDbMigrations,
  SYNCED_ROW_RETENTION_DAYS,
  syncedRowPurgeCutoff,
  type MigratableDatabase,
  type PurgeableDatabase
} from "./sqlite-offline-store";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

type NodeSqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): { changes?: number | bigint };
  };
};

const builtin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
const nodeSqlite = (() => {
  try {
    return builtin?.("node:sqlite") as { DatabaseSync: new (path: string) => NodeSqliteDatabase } | undefined;
  } catch {
    return undefined;
  }
})();

function openTestDb() {
  if (!nodeSqlite) throw new Error("node:sqlite unavailable");
  const raw = new nodeSqlite.DatabaseSync(":memory:");
  const db: MigratableDatabase & PurgeableDatabase = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (raw.prepare(sql).get() ?? null) as T | null;
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result?.changes ?? 0) };
    }
  };
  return { db, raw };
}

/** 파기 대상 판정에 실제로 쓰이는 값만 인자로 받는다(payload는 이 계약과 무관하다). */
type SeedRow = {
  localId: string;
  syncState?: string;
  canonicalId?: string | null;
  pendingDelete?: boolean;
  conflictCurrent?: string | null;
  updatedAt: string;
};

function insertRow(raw: NodeSqliteDatabase, row: SeedRow) {
  raw
    .prepare(
      `INSERT INTO local_expenses
        (local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.localId,
      row.canonicalId === undefined ? `srv-${row.localId}` : row.canonicalId,
      "child-1",
      JSON.stringify({ childId: "child-1", itemName: "기저귀", amountKrw: 10_000, spentOn: "2026-01-01" }),
      1,
      row.syncState ?? "synced",
      row.pendingDelete ? 1 : 0,
      row.conflictCurrent ?? null,
      null,
      row.updatedAt,
      row.updatedAt
    );
}

function insertOutbox(raw: NodeSqliteDatabase, mutationId: string, targetLocalId: string) {
  raw
    .prepare(
      `INSERT INTO mutation_outbox
        (mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
       VALUES (?, ?, 'update', ?, NULL, 1, 0, NULL, NULL, '2026-01-01T00:00:00.000Z', 0)`
    )
    .run(mutationId, `idem-${mutationId}`, targetLocalId);
}

function survivingIds(raw: NodeSqliteDatabase): string[] {
  return raw
    .prepare("SELECT local_id FROM local_expenses ORDER BY local_id")
    .all()
    .map((row) => String(row.local_id));
}

const OLD = "2020-01-01T00:00:00.000Z";
const CUTOFF = "2026-06-01T00:00:00.000Z";
const FRESH = "2026-08-01T00:00:00.000Z";

describe("라운드 61 #4 파기 제외 계약 (진짜 SQLite)", () => {
  let raw: NodeSqliteDatabase;
  let db: MigratableDatabase & PurgeableDatabase;

  beforeEach(async () => {
    const opened = openTestDb();
    raw = opened.raw;
    db = opened.db;
    await runOfflineDbMigrations(db, OFFLINE_DB_MIGRATIONS);
  });

  it("대상은 오직 오래된 synced 행뿐이다 — 나머지 상태는 아무리 오래돼도 남는다", async () => {
    insertRow(raw, { localId: "a-synced-old", updatedAt: OLD });
    for (const state of ["pending", "syncing", "failed", "conflict"]) {
      insertRow(raw, { localId: `b-${state}`, syncState: state, updatedAt: OLD });
    }

    const deleted = await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(deleted).toBe(1);
    expect(survivingIds(raw)).toEqual(["b-conflict", "b-failed", "b-pending", "b-syncing"]);
  });

  it("삭제 대기 행은 지우지 않는다 (사용자가 지운 기록이 되살아난다)", async () => {
    insertRow(raw, { localId: "pending-delete", pendingDelete: true, updatedAt: OLD });

    await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(survivingIds(raw)).toEqual(["pending-delete"]);
  });

  it("충돌 스냅샷을 든 행은 지우지 않는다 (사용자가 아직 고르지 않은 선택지가 그 안에 있다)", async () => {
    insertRow(raw, {
      localId: "carries-conflict",
      conflictCurrent: JSON.stringify({ deleted: false, expense: { id: "srv-1", version: 3 } }),
      updatedAt: OLD
    });

    await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(survivingIds(raw)).toEqual(["carries-conflict"]);
  });

  it("서버 id가 없는 행은 지우지 않는다 (로컬이 유일한 사본이다)", async () => {
    insertRow(raw, { localId: "never-uploaded", canonicalId: null, updatedAt: OLD });

    await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(survivingIds(raw)).toEqual(["never-uploaded"]);
  });

  it("미결 아웃박스가 걸린 행은 지우지 않는다 (flush가 고아 mutation을 버린다)", async () => {
    insertRow(raw, { localId: "has-outbox", updatedAt: OLD });
    insertRow(raw, { localId: "no-outbox", updatedAt: OLD });
    insertOutbox(raw, "mut-1", "has-outbox");

    const deleted = await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(deleted).toBe(1);
    expect(survivingIds(raw)).toEqual(["has-outbox"]);
    // 아웃박스 자체는 손대지 않는다.
    expect(raw.prepare("SELECT COUNT(*) AS n FROM mutation_outbox").get()?.n).toBe(1);
  });

  it("창 경계: cutoff보다 오래된 행만 지운다 (경계값 자신은 남는다)", async () => {
    insertRow(raw, { localId: "before", updatedAt: "2026-05-31T23:59:59.999Z" });
    insertRow(raw, { localId: "exactly-at", updatedAt: CUTOFF });
    insertRow(raw, { localId: "after", updatedAt: FRESH });

    const deleted = await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(deleted).toBe(1);
    expect(survivingIds(raw)).toEqual(["after", "exactly-at"]);
  });

  it("다른 테이블은 건드리지 않는다 (준비템 큐·sync_meta는 이 정리의 대상이 아니다)", async () => {
    insertRow(raw, { localId: "old", updatedAt: OLD });
    raw
      .prepare(
        `INSERT INTO item_status_outbox
          (mutation_id, child_id, item_template_id, status, item_name, sync_state, attempt_count, next_retry_at, last_error, created_at, updated_at, in_flight)
         VALUES ('is-1', 'child-1', 'tpl-1', 'prepared', '기저귀', 'pending', 0, NULL, NULL, ?, ?, 0)`
      )
      .run(OLD, OLD);
    raw.prepare(`INSERT INTO sync_meta (meta_key, meta_value) VALUES ('cursor', 'abc')`).run();

    await purgeExpiredSyncedLocalExpenses(db, CUTOFF);

    expect(survivingIds(raw)).toEqual([]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM item_status_outbox").get()?.n).toBe(1);
    expect(raw.prepare("SELECT meta_value FROM sync_meta WHERE meta_key = 'cursor'").get()?.meta_value).toBe("abc");
  });

  it("지울 것이 없으면 0을 돌려주고 아무것도 바꾸지 않는다", async () => {
    insertRow(raw, { localId: "fresh", updatedAt: FRESH });

    expect(await purgeExpiredSyncedLocalExpenses(db, CUTOFF)).toBe(0);
    expect(survivingIds(raw)).toEqual(["fresh"]);
  });
});

describe("라운드 61 #4 보관 창과 부팅 1회 배선", () => {
  it("창은 제안 모집단이 짝짓는 서버 두 달치보다 넓다 (suggest-source.ts의 이번 달 + 지난달)", () => {
    // 62일 = 31일 달 두 번. 월초 경계에서도 로컬 이력이 서버 캐시보다 좁아지지 않아야 한다.
    expect(SYNCED_ROW_RETENTION_DAYS).toBeGreaterThanOrEqual(62);
    expect(SYNCED_ROW_RETENTION_DAYS).toBe(90);
  });

  it("cutoff는 '지금'에서 창만큼 뺀 ISO 시각이다", () => {
    const now = Date.parse("2026-08-28T00:00:00.000Z");
    expect(syncedRowPurgeCutoff(now)).toBe("2026-05-30T00:00:00.000Z");
    expect(syncedRowPurgeCutoff(now, 1)).toBe("2026-08-27T00:00:00.000Z");
  });

  it("파기 SQL은 local_expenses의 DELETE 하나뿐이고 제외 조건 다섯을 모두 들고 있다", () => {
    expect(PURGE_EXPIRED_SYNCED_LOCAL_EXPENSES_SQL.startsWith("DELETE FROM local_expenses")).toBe(true);
    expect(PURGE_EXPIRED_SYNCED_LOCAL_EXPENSES_SQL.match(/DELETE FROM/g)).toHaveLength(1);
    for (const clause of [
      "sync_state = 'synced'",
      "pending_delete = 0",
      "conflict_current IS NULL",
      "canonical_id IS NOT NULL",
      "updated_at < ?",
      "NOT EXISTS"
    ]) {
      expect(PURGE_EXPIRED_SYNCED_LOCAL_EXPENSES_SQL).toContain(clause);
    }
  });

  it("부팅 1회: 마이그레이션 러너 **뒤**에서, 실패해도 저장소를 막지 않는다", () => {
    const sqlite = source("src/offline/sqlite-offline-store.ts");
    const openBody = sqlite.slice(
      sqlite.indexOf("const dbGate = createOneShotReopenGate"),
      sqlite.indexOf("async function getDb()")
    );
    expect(openBody).toContain("await runOfflineDbMigrations(db);");
    expect(openBody).toContain("await purgeExpiredSyncedLocalExpensesOnBoot(db);");
    // 순서가 뒤집히면(스키마 확정 전 파기) 이 SQL의 컬럼 이름이 의미를 잃는다.
    expect(openBody.indexOf("runOfflineDbMigrations")).toBeLessThan(openBody.indexOf("purgeExpiredSyncedLocalExpensesOnBoot"));
    // 청소 실패는 삼킨다 -- 저장소를 못 열게 만들면 아직 서버에 못 보낸 지출까지 잠긴다.
    const bootBody = sqlite.slice(
      sqlite.indexOf("async function purgeExpiredSyncedLocalExpensesOnBoot"),
      sqlite.indexOf("const dbGate = createOneShotReopenGate")
    );
    expect(bootBody).toContain("try {");
    expect(bootBody).toContain("} catch {");
    // 저장소 메서드 경로에서는 다시 돌지 않는다(부팅 1회 관례).
    expect(sqlite.match(/purgeExpiredSyncedLocalExpensesOnBoot\(/g)).toHaveLength(2); // 정의 1 + 호출 1
  });

  it("스냅샷 소비자 계약은 그대로다 — rows는 여전히 synced 행까지 담는다", () => {
    /*
     * 왜 rows를 비-synced로 좁히지 않았나(회귀 위험 최소 설계의 근거):
     *  - 그 행들을 실제로 읽는 소비자가 있다. `src/expenses/suggest-source.ts`(→ 최근 칩·품목/
     *    판매처 자동완성)는 synced 행을 "네트워크 없이 읽는 이력"으로 쓴다.
     *  - 나머지 소비자(reconciliation·정기 지출·리포트/CSV 고지·예산 경고)는 스스로
     *    `syncState !== "synced"`로 거르므로 rows가 넓어도 결과가 같다.
     *  - rows를 좁히면 그 이력을 따로 받는 배선이 필요하고, 그 배선은 8개 화면 파일에 걸린다
     *    (트랙 C의 금지 구역). 즉 좁히기는 이 트랙에서 **화면을 건드리지 않고는 불가능**하다.
     * 그래서 전량의 크기는 위 파기 창이 묶고, 의미는 한 글자도 바꾸지 않는다.
     */
    const controller = source("src/offline/sync-controller.ts");
    expect(controller).toContain("rows = await store.listLocalExpenses();");
    expect(controller).toContain('if (row.syncState === "synced") continue;');
    const reconciliation = source("src/offline/expense-list-reconciliation.ts");
    expect(reconciliation).toContain('row.syncState !== "synced"');
  });

  it("이 품목 이력의 모집단은 synced 행을 쓰지 않는다 (파기 창과 무관하다는 조사 결과)", () => {
    // item-history는 스냅숏 행을 reconcileMonthlyExpenses에 넘기고, 그 함수는 양쪽 갈래 모두에서
    // synced 행을 거른다 -- 그래서 이 화면의 이력은 서버 월 캐시가 만든다.
    const itemHistory = source("src/expenses/item-history.ts");
    expect(itemHistory).toContain("reconcileMonthlyExpenses(");
    const reconciliation = source("src/offline/expense-list-reconciliation.ts");
    const fnBody = reconciliation.slice(reconciliation.indexOf("const staleServerCanonicalIds"));
    expect(fnBody).toContain('row.canonicalId && row.syncState !== "synced"');
    expect(fnBody).toContain('row.syncState !== "synced" &&');
  });
});
