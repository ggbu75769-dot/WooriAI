import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 라운드 57 #7/#8 — 로컬 SQLite 마이그레이션 러너.
 *
 * ## 왜 이 파일만 "진짜 SQL"로 도는가
 *
 * 이 저장소의 다른 오프라인 테스트는 memory-offline-store.ts를 쓴다. expo-sqlite에는 node용
 * 네이티브 바인딩이 없어 vitest에서 열 수 없기 때문이고, 그래서 sqlite-offline-store.ts의
 * 저장소 메서드는 지금까지 소스 대조(item-status-outbox.test.ts의 스키마 계약)로만 고정돼 왔다.
 *
 * 마이그레이션은 그 방식으로 검증할 수 없다. `CREATE TABLE IF NOT EXISTS`가 이미 있는 테이블을
 * 조용히 건너뛰는지, `ALTER TABLE ADD COLUMN`이 기존 행을 보존하는지, 실패한 마이그레이션이
 * `PRAGMA user_version`까지 통째로 롤백되는지는 **SQLite 엔진의 동작**이지 이 소스의 문자열이
 * 아니다. 문자열만 맞춰 두고 "구 기기에서 잘 되겠지"라고 믿는 것이 정확히 이 티켓이 없애려는
 * 종류의 위험이다(구 기기 전면 실패는 아직 서버에 못 보낸 지출을 들고 있는 사람에게 일어난다).
 *
 * 그래서 여기서는 **node 내장 SQLite**(`node:sqlite`)로 실제 DB를 만들어 v0 → v1 → v2를 돌린다.
 * 러너가 expo-sqlite를 모르는 순수 함수(`MigratableDatabase` 구조 타입만 받는다)라서 가능한
 * 일이고, `expo-sqlite` import는 vi.mock으로 막아 모듈이 로드되지 않게 한다.
 *
 * `node:sqlite`를 `import`가 아니라 `process.getBuiltinModule`로 가져오는 이유: vite는 이 내장
 * 모듈을 아직 externals 목록에 갖고 있지 않아 `import "node:sqlite"`가 해석 단계에서 실패한다.
 */

vi.mock("expo-sqlite", () => ({
  // 러너 테스트는 expo 바인딩을 건드리지 않는다. 실수로 getDb() 경로가 불리면 여기서 즉시 터진다.
  openDatabaseAsync: () => {
    throw new Error("expo-sqlite must not be opened in vitest");
  }
}));

import {
  OFFLINE_DB_MIGRATIONS,
  OFFLINE_DB_SCHEMA_VERSION,
  OfflineDbMigrationError,
  OfflineDbUserVersionError,
  runOfflineDbMigrations,
  type MigratableDatabase,
  type OfflineDbMigration
} from "./sqlite-offline-store";

type NodeSqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): unknown;
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

/** node의 동기 SQLite를 러너가 받는 최소 인터페이스로 감싼다. */
function openTestDb() {
  if (!nodeSqlite) throw new Error("node:sqlite unavailable");
  const raw = new nodeSqlite.DatabaseSync(":memory:");
  const db: MigratableDatabase = {
    async execAsync(source: string) {
      raw.exec(source);
    },
    async getFirstAsync<T>(source: string) {
      return (raw.prepare(source).get() ?? null) as T | null;
    }
  };
  return { db, raw };
}

function userVersion(raw: NodeSqliteDatabase): number {
  return Number(raw.prepare("PRAGMA user_version").get()?.user_version ?? -1);
}

function tableNames(raw: NodeSqliteDatabase): string[] {
  return raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name))
    .filter((name) => !name.startsWith("sqlite_"));
}

function columnNames(raw: NodeSqliteDatabase, table: string): string[] {
  return raw.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name));
}

/**
 * 라운드 57 이전에 배포된 스키마 그대로. 이 SQL은 **일부러 러너를 거치지 않고** 직접 실행해서
 * `user_version = 0`인 "구 기기" DB를 만든다 — v1 목록을 재사용하면 러너가 만든 DB를 러너로
 * 검증하는 동어반복이 되고, 정작 확인하려는 것(이미 테이블이 있는 기기에서 v0→v2가 안전한가)이
 * 검증되지 않는다.
 */
const LEGACY_SCHEMA_SQL = `
  CREATE TABLE local_expenses (
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
  CREATE TABLE mutation_outbox (
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
  CREATE INDEX idx_mutation_outbox_target ON mutation_outbox(target_local_id);
  CREATE INDEX idx_mutation_outbox_created ON mutation_outbox(created_at);
  CREATE TABLE sync_meta (
    meta_key TEXT PRIMARY KEY NOT NULL,
    meta_value TEXT NOT NULL
  );
  CREATE TABLE item_status_outbox (
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
  );
  CREATE INDEX idx_item_status_outbox_item ON item_status_outbox(child_id, item_template_id);
  CREATE INDEX idx_item_status_outbox_created ON item_status_outbox(created_at);
`;

/** 구 기기에 이미 쌓여 있던 대기분. 마이그레이션이 이 행들을 한 줄도 잃지 않아야 한다. */
function seedLegacyRows(raw: NodeSqliteDatabase): void {
  raw
    .prepare(
      `INSERT INTO local_expenses
        (local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      "local-1",
      null,
      "child-1",
      JSON.stringify({ childId: "child-1", itemName: "기저귀", amountKrw: 10_000 }),
      null,
      "failed",
      0,
      null,
      "권한이 없어요. 가족 구성원 여부와 내 역할을 확인해 주세요.",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z"
    );
  raw
    .prepare(
      `INSERT INTO mutation_outbox
        (mutation_id, idempotency_key, operation, target_local_id, payload, expected_version, attempt_count, next_retry_at, last_error, created_at, in_flight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run("mut-1", "idem-1", "create", "local-1", JSON.stringify({ itemName: "기저귀" }), null, 3, null, "서버 오류", "2026-08-01T00:00:00.000Z", 0);
  raw
    .prepare(
      `INSERT INTO item_status_outbox
        (mutation_id, child_id, item_template_id, status, item_name, sync_state, attempt_count, next_retry_at, last_error, created_at, updated_at, in_flight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run("item-mut-1", "child-1", "tpl-1", "prepared", "젖병", "pending", 0, null, null, "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", 0);
  raw.prepare(`INSERT INTO sync_meta (meta_key, meta_value) VALUES (?, ?)`).run("delta-cursor", "cursor-abc");
}

/**
 * 라운드 57 QA(P2-7) — **guard the guard.**
 *
 * 아래 두 describe는 `describe.skipIf(!nodeSqlite)`로 감싸여 있다. 그 스킵 조건이 어떤 이유로든
 * 참이 되면(빌트인 이름이 바뀌거나 `getBuiltinModule`이 사라지거나 러너가 바뀌면) **진짜 SQL로
 * 도는 검증 전부가 조용히 사라지고 파일은 초록으로 남는다** — 그리고 이 파일의 존재 이유는
 * 정확히 "문자열만 맞춰 두고 구 기기에서 잘 되겠지"를 없애는 것이었다. 그러니 스킵 자체를
 * 스킵할 수 없는 단언으로 막는다(a11y-contract.test.ts의 settings 스윕이 경로/글롭이 빗나가면
 * 공허하게 초록이 되는 것을 막는 것과 같은 관례).
 */
describe("라운드 57 QA(P2-7) — 실제 SQLite 검증이 조용히 스킵되지 않는다", () => {
  it("node:sqlite가 있어야 한다 (없으면 아래 러너 검증이 통째로 사라진다)", () => {
    expect(typeof builtin, "process.getBuiltinModule must exist in this runtime").toBe("function");
    expect(nodeSqlite, "node:sqlite must be loadable -- otherwise the runner tests below vanish").toBeDefined();
    expect(typeof nodeSqlite!.DatabaseSync).toBe("function");
    // 감싼 래퍼도 실제로 열려야 의미가 있다(모듈은 있는데 열 수 없는 경우까지 잡는다).
    const { raw } = openTestDb();
    expect(userVersion(raw)).toBe(0);
  });
});

describe("라운드 57 #7 — 마이그레이션 목록의 규약 (순수 값 검증)", () => {
  it("버전은 1부터 1씩 증가하고, 스키마 버전은 목록의 마지막이다", () => {
    const versions = OFFLINE_DB_MIGRATIONS.map((migration) => migration.version);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
    expect(OFFLINE_DB_SCHEMA_VERSION).toBe(versions[versions.length - 1]);
    // 이 티켓이 도달시키려는 버전. 늘어나는 것은 정상이고, 줄어들면 배포된 기기와 어긋난다.
    expect(OFFLINE_DB_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });

  it("v1은 전부 IF NOT EXISTS다 — 이미 테이블을 가진 구 기기에서 그대로 통과해야 한다", () => {
    const v1 = OFFLINE_DB_MIGRATIONS.find((migration) => migration.version === 1);
    expect(v1).toBeDefined();
    for (const statement of v1!.statements) {
      expect(statement).toMatch(/CREATE (TABLE|INDEX) IF NOT EXISTS/);
    }
  });

  it("v2는 파괴적이지 않은 ADD COLUMN만 쓴다 (행 보존이 계약이다)", () => {
    const v2 = OFFLINE_DB_MIGRATIONS.find((migration) => migration.version === 2);
    expect(v2).toBeDefined();
    for (const statement of v2!.statements) {
      expect(statement).toContain("ADD COLUMN");
      expect(statement).not.toContain("NOT NULL");
    }
    // 사유 컬럼은 실패 사유를 갖는 세 테이블 전부에 생긴다(sync_meta에는 실패 개념이 없다).
    const joined = v2!.statements.join("\n");
    for (const table of ["local_expenses", "mutation_outbox", "item_status_outbox"]) {
      expect(joined).toContain(`ALTER TABLE ${table} ADD COLUMN last_error_status INTEGER`);
      expect(joined).toContain(`ALTER TABLE ${table} ADD COLUMN last_error_code TEXT`);
    }
    expect(joined).not.toContain("sync_meta");
  });

  it("이미 배포된 버전의 SQL은 되돌릴 수 없다 — 목록에 DROP/RENAME이 없다", () => {
    const joined = OFFLINE_DB_MIGRATIONS.flatMap((migration) => migration.statements).join("\n");
    expect(joined).not.toContain("DROP TABLE");
    expect(joined).not.toContain("DROP COLUMN");
    expect(joined).not.toContain("RENAME");
  });
});

describe.skipIf(!nodeSqlite)("라운드 57 #7 — 러너를 실제 SQLite로 돌린다", () => {
  let db: MigratableDatabase;
  let raw: NodeSqliteDatabase;

  beforeEach(() => {
    ({ db, raw } = openTestDb());
  });

  it("신규 설치(v0, 빈 파일): 한 번에 최신 버전까지 올라가고 네 테이블이 모두 생긴다", async () => {
    expect(userVersion(raw)).toBe(0);

    const reached = await runOfflineDbMigrations(db);

    expect(reached).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(userVersion(raw)).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(tableNames(raw)).toEqual(["item_status_outbox", "local_expenses", "mutation_outbox", "sync_meta"]);
  });

  it("두 번째 실행은 아무것도 하지 않는다 (ALTER 재실행 = duplicate column이면 여기서 터진다)", async () => {
    await runOfflineDbMigrations(db);
    const columnsAfterFirst = columnNames(raw, "local_expenses");

    const reached = await runOfflineDbMigrations(db);

    expect(reached).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(columnNames(raw, "local_expenses")).toEqual(columnsAfterFirst);
  });

  it("v0 → v1 → v2를 단계로 나눠 올려도 결과가 같다 (버전별 순차 실행)", async () => {
    const onlyV1 = OFFLINE_DB_MIGRATIONS.filter((migration) => migration.version === 1);

    expect(await runOfflineDbMigrations(db, onlyV1)).toBe(1);
    expect(userVersion(raw)).toBe(1);
    // v1 시점에는 사유 컬럼이 아직 없다 -- 이 단계가 실제로 구별되고 있다는 증거다.
    expect(columnNames(raw, "local_expenses")).not.toContain("last_error_status");

    expect(await runOfflineDbMigrations(db)).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(columnNames(raw, "local_expenses")).toContain("last_error_status");
  });

  it("v2가 사유 컬럼을 세 테이블 모두에 만든다", async () => {
    await runOfflineDbMigrations(db);

    for (const table of ["local_expenses", "mutation_outbox", "item_status_outbox"]) {
      expect(columnNames(raw, table)).toEqual(expect.arrayContaining(["last_error_status", "last_error_code"]));
    }
    // sync_meta는 실패 사유를 갖지 않는 키-값 영역이라 그대로다.
    expect(columnNames(raw, "sync_meta")).toEqual(["meta_key", "meta_value"]);
  });

  it("사유 컬럼은 실제로 status/code를 왕복시킨다", async () => {
    await runOfflineDbMigrations(db);
    raw
      .prepare(
        `INSERT INTO local_expenses
          (local_id, canonical_id, child_id, payload, version, sync_state, pending_delete, conflict_current, last_error, last_error_status, last_error_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("local-9", null, "child-1", "{}", null, "failed", 0, null, "미래 날짜의 지출은 저장할 수 없어요.", 400, "EXPENSE_FUTURE_DATE", "t", "t");

    const row = raw.prepare("SELECT last_error_status, last_error_code FROM local_expenses WHERE local_id = 'local-9'").get();

    expect(row).toEqual({ last_error_status: 400, last_error_code: "EXPENSE_FUTURE_DATE" });
  });

  it("다운그레이드(기기 버전이 이 빌드보다 높음)에는 손대지 않는다", async () => {
    await runOfflineDbMigrations(db);
    raw.exec("PRAGMA user_version = 99");

    const reached = await runOfflineDbMigrations(db);

    expect(reached).toBe(99);
    expect(userVersion(raw)).toBe(99);
  });

  it("한 버전이 실패하면 그 버전은 통째로 롤백된다 (반쯤 적용된 스키마 금지)", async () => {
    await runOfflineDbMigrations(db);
    const brokenV3: OfflineDbMigration = {
      version: 3,
      statements: [
        // 앞 문장은 성공하고,
        `ALTER TABLE local_expenses ADD COLUMN half_applied TEXT`,
        // 뒤 문장이 실패한다. 트랜잭션이 없으면 딱 이 상태로 굳어 다음 실행마다 duplicate column이
        // 나 영원히 v3에 도달하지 못한다.
        `ALTER TABLE nonexistent_table ADD COLUMN nope TEXT`
      ]
    };

    await expect(runOfflineDbMigrations(db, [...OFFLINE_DB_MIGRATIONS, brokenV3])).rejects.toBeInstanceOf(
      OfflineDbMigrationError
    );

    expect(userVersion(raw)).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(columnNames(raw, "local_expenses")).not.toContain("half_applied");
    // 롤백 후에도 연결이 정상이다(트랜잭션이 열린 채로 남지 않았다).
    expect(await runOfflineDbMigrations(db)).toBe(OFFLINE_DB_SCHEMA_VERSION);
  });

  it("실패 오류는 어느 버전이 문제였는지와 원본 오류를 함께 들고 있다", async () => {
    const broken: OfflineDbMigration[] = [{ version: 1, statements: ["THIS IS NOT SQL"] }];

    const error = await runOfflineDbMigrations(db, broken).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OfflineDbMigrationError);
    expect((error as OfflineDbMigrationError).version).toBe(1);
    expect((error as OfflineDbMigrationError).reason).toBeInstanceOf(Error);
    expect(userVersion(raw)).toBe(0);
  });
});

describe.skipIf(!nodeSqlite)("라운드 57 #7 — 구 기기 시나리오 (v0 = 테이블은 있고 버전은 0)", () => {
  it("이미 쌓여 있던 대기/실패 행을 한 줄도 잃지 않고 v2에 도달한다", async () => {
    const { db, raw } = openTestDb();
    raw.exec(LEGACY_SCHEMA_SQL);
    seedLegacyRows(raw);
    // 구 기기의 진실: 테이블은 다 있는데 버전은 0이다(PRAGMA를 쓴 적이 없다).
    expect(userVersion(raw)).toBe(0);

    const reached = await runOfflineDbMigrations(db);

    expect(reached).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(userVersion(raw)).toBe(OFFLINE_DB_SCHEMA_VERSION);

    // 아직 서버에 못 보낸 것들이 그대로 있다 -- 이 보장이 무너지면 사용자의 기록이 사라진다.
    const expense = raw.prepare("SELECT * FROM local_expenses WHERE local_id = 'local-1'").get();
    expect(expense?.sync_state).toBe("failed");
    expect(expense?.child_id).toBe("child-1");
    expect(raw.prepare("SELECT COUNT(*) c FROM mutation_outbox").get()?.c).toBe(1);
    expect(raw.prepare("SELECT COUNT(*) c FROM item_status_outbox").get()?.c).toBe(1);
    expect(raw.prepare("SELECT meta_value FROM sync_meta WHERE meta_key = 'delta-cursor'").get()?.meta_value).toBe(
      "cursor-abc"
    );

    // 그 행들의 새 컬럼은 NULL = "모름"이다. 0이나 빈 문자열로 위장하지 않는다 --
    // permission-denied.ts가 그 NULL을 보고 예전 문자열 판정으로 폴백한다.
    expect(expense?.last_error_status).toBeNull();
    expect(expense?.last_error_code).toBeNull();
    // 그리고 예전 문구는 그대로 남아 있어야 폴백이 실제로 동작한다.
    expect(String(expense?.last_error)).toContain("권한이 없어요");
  });

  it("구 기기의 인덱스도 그대로 살아 있다 (IF NOT EXISTS가 덮어쓰지 않는다)", async () => {
    const { db, raw } = openTestDb();
    raw.exec(LEGACY_SCHEMA_SQL);

    await runOfflineDbMigrations(db);

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .all()
      .map((row) => String(row.name));
    expect(indexes).toEqual([
      "idx_item_status_outbox_created",
      "idx_item_status_outbox_item",
      "idx_mutation_outbox_created",
      "idx_mutation_outbox_target"
    ]);
  });

  it("준비템 테이블조차 없던 더 오래된 기기에서도 v2까지 간다", async () => {
    const { db, raw } = openTestDb();
    // 라운드 51 C-10 이전 스키마: 지출 두 테이블 + sync_meta만 있다.
    raw.exec(
      LEGACY_SCHEMA_SQL.slice(0, LEGACY_SCHEMA_SQL.indexOf("CREATE TABLE item_status_outbox"))
    );

    expect(await runOfflineDbMigrations(db)).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(tableNames(raw)).toContain("item_status_outbox");
    expect(columnNames(raw, "item_status_outbox")).toEqual(expect.arrayContaining(["last_error_status", "last_error_code"]));
  });
});

/**
 * 라운드 57 QA(P2-6) — 러너의 **두 방어선**.
 *  1. `PRAGMA user_version`을 읽지 못하면 0으로 위장하지 않고 던진다(0은 "새 기기"라는 구체적인
 *     사실이라, 그 폴백이 곧 거짓말이고 v2 이후에는 벽돌의 원인이 된다).
 *  2. `ALTER TABLE … ADD COLUMN`은 이미 있는 컬럼이면 건너뛴다 — SQLite에 `IF NOT EXISTS`가 없어
 *     러너 밖에서 어긋난 기기가 매 실행 duplicate column으로 영구 실패하는 것을 막는다.
 */
describe("라운드 57 QA(P2-6) — user_version 폴백과 ADD COLUMN 멱등성", () => {
  /** 위 openTestDb와 같은 래퍼지만 PRAGMA user_version 응답만 바꿔치기한다. */
  function dbWithUserVersionRow(row: unknown): MigratableDatabase {
    return {
      async execAsync() {},
      async getFirstAsync<T>(sql: string) {
        return (sql.includes("user_version") ? row : null) as T | null;
      }
    };
  }

  it("형식이 어긋난 user_version은 0으로 위장하지 않고 원인과 함께 던진다", async () => {
    for (const bad of [null, undefined, "", true, "열두", Number.NaN, -1, 1.5, {}]) {
      const error = await runOfflineDbMigrations(dbWithUserVersionRow({ user_version: bad })).catch(
        (caught: unknown) => caught
      );
      expect(error, String(bad)).toBeInstanceOf(OfflineDbUserVersionError);
      // 원인을 그대로 들고 다닌다 -- 진단의 전부다.
      expect((error as OfflineDbUserVersionError).raw, String(bad)).toBe(
        Number.isNaN(bad as number) ? (error as OfflineDbUserVersionError).raw : bad
      );
    }
    // 행 자체가 없는 경우도 같다(PRAGMA는 언제나 한 행을 준다 -- 없으면 우리가 모르는 상태다).
    await expect(runOfflineDbMigrations(dbWithUserVersionRow(null))).rejects.toBeInstanceOf(OfflineDbUserVersionError);
  });

  it("표현만 다른 정수(문자열·bigint)는 읽어 준다 -- 드라이버 차이지 '읽을 수 없는 값'이 아니다", async () => {
    // "2"·2n은 곧 2다: 이미 그 버전이므로 아래 목록의 문장은 하나도 실행되지 않는다
    // (실행되면 execAsync가 아무것도 안 하는 이 스텁에서도 버전이 올라가 값이 달라진다).
    for (const shaped of ["2", 2, BigInt(2)]) {
      const reached = await runOfflineDbMigrations(dbWithUserVersionRow({ user_version: shaped }), [
        { version: 1, statements: ["THIS WOULD THROW IF IT RAN"] },
        { version: 2, statements: ["THIS WOULD THROW IF IT RAN"] }
      ]);
      expect(reached, String(shaped)).toBe(2);
    }
  });
});

describe.skipIf(!nodeSqlite)("라운드 57 QA(P2-6) — ADD COLUMN 멱등성 (실제 SQLite)", () => {
  it("컬럼은 이미 있는데 user_version만 뒤로 밀린 기기에서도 벽돌이 되지 않는다", async () => {
    const { db, raw } = openTestDb();
    await runOfflineDbMigrations(db);
    const columnsAfterFirst = columnNames(raw, "local_expenses");
    // 러너 밖에서 어긋난 상태를 그대로 만든다: 컬럼은 v2인데 버전만 v1이다
    // (수기 SQL·백업 복구·user_version을 잃은 파일에서 실제로 생길 수 있는 조합).
    raw.exec("PRAGMA user_version = 1");

    const reached = await runOfflineDbMigrations(db);

    expect(reached).toBe(OFFLINE_DB_SCHEMA_VERSION);
    expect(userVersion(raw)).toBe(OFFLINE_DB_SCHEMA_VERSION);
    // 컬럼이 두 번 생기지도, 사라지지도 않았다.
    expect(columnNames(raw, "local_expenses")).toEqual(columnsAfterFirst);
    for (const table of ["local_expenses", "mutation_outbox", "item_status_outbox"]) {
      expect(columnNames(raw, table).filter((name) => name === "last_error_status")).toHaveLength(1);
    }
  });

  it("건너뛰는 것은 그 ALTER 한 문장뿐이다 -- 같은 버전의 나머지 문장은 그대로 실행된다", async () => {
    const { db, raw } = openTestDb();
    await runOfflineDbMigrations(db);
    raw.exec("ALTER TABLE local_expenses ADD COLUMN half_present TEXT");
    const partialV3: OfflineDbMigration = {
      version: 3,
      statements: [
        // 이미 있다 -> 건너뛴다.
        "ALTER TABLE local_expenses ADD COLUMN half_present TEXT",
        // 없다 -> 실행된다.
        "ALTER TABLE local_expenses ADD COLUMN brand_new TEXT"
      ]
    };

    const reached = await runOfflineDbMigrations(db, [...OFFLINE_DB_MIGRATIONS, partialV3]);

    expect(reached).toBe(3);
    expect(columnNames(raw, "local_expenses")).toEqual(expect.arrayContaining(["half_present", "brand_new"]));
    expect(columnNames(raw, "local_expenses").filter((name) => name === "half_present")).toHaveLength(1);
  });

  it("대상 테이블이 아예 없는 ALTER는 여전히 실패한다 (멱등화가 오류를 삼키지 않는다)", async () => {
    const { db, raw } = openTestDb();
    await runOfflineDbMigrations(db);
    const brokenV3: OfflineDbMigration = {
      version: 3,
      statements: ["ALTER TABLE nonexistent_table ADD COLUMN nope TEXT"]
    };

    await expect(runOfflineDbMigrations(db, [...OFFLINE_DB_MIGRATIONS, brokenV3])).rejects.toBeInstanceOf(
      OfflineDbMigrationError
    );
    expect(userVersion(raw)).toBe(OFFLINE_DB_SCHEMA_VERSION);
  });

  it("기존 행의 값은 멱등 경로에서도 한 줄도 다치지 않는다", async () => {
    const { db, raw } = openTestDb();
    raw.exec(LEGACY_SCHEMA_SQL);
    seedLegacyRows(raw);
    await runOfflineDbMigrations(db);
    raw.exec("PRAGMA user_version = 0");

    await runOfflineDbMigrations(db);

    const expense = raw.prepare("SELECT * FROM local_expenses WHERE local_id = 'local-1'").get();
    expect(expense?.sync_state).toBe("failed");
    expect(String(expense?.last_error)).toContain("권한이 없어요");
    expect(raw.prepare("SELECT COUNT(*) c FROM mutation_outbox").get()?.c).toBe(1);
  });
});
