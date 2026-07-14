import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { commerceCoreItemCodes } from "../apps/api/prisma/seed-data";

const repoRoot = resolve(__dirname, "..");
const apiRoot = resolve(repoRoot, "apps/api");
const migrationsRoot = resolve(apiRoot, "prisma/migrations");
const pgBin = process.env.PGBIN ?? resolve(repoRoot, ".toolcache/pg16/pgsql/bin");
const dbUser = "wooriai";
const dbPassword = "wooriai_dev_password";
const host = "localhost";
const port = "5432";
const freshDatabase = "wooriai_sprint2_fresh_verify";
const upgradeDatabase = "wooriai_sprint2_upgrade_verify";
const keepDatabases = process.argv.includes("--keep");

const legacyIds = {
  user: "11111111-1111-4111-8111-111111111111",
  household: "22222222-2222-4222-8222-222222222222",
  member: "33333333-3333-4333-8333-333333333333",
  child: "44444444-4444-4444-8444-444444444444",
  category: "55555555-5555-4555-8555-555555555555",
  item: "66666666-6666-4666-8666-666666666666",
  expense: "77777777-7777-4777-8777-777777777777",
  status: "88888888-8888-4888-8888-888888888888",
  paymentOne: "99999999-9999-4999-8999-999999999991",
  paymentTwo: "99999999-9999-4999-8999-999999999992"
} as const;

function executable(name: string): string {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const bundled = resolve(pgBin, `${name}${suffix}`);
  return existsSync(bundled) ? bundled : name;
}

function pgEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: dbPassword };
}

function databaseUrl(database: string): string {
  return `postgresql://${dbUser}:${dbPassword}@${host}:${port}/${database}`;
}

function assertSafeDatabaseName(database: string): void {
  if (!/^wooriai_sprint2_(fresh|upgrade)_verify$/.test(database)) {
    throw new Error(`Refusing to modify unexpected database: ${database}`);
  }
}

function pnpm(args: string[], database?: string): void {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: database ? { ...process.env, DATABASE_URL: databaseUrl(database), NODE_ENV: "test" } : process.env
  });
}

function pgAdmin(command: "createdb" | "dropdb", database: string): void {
  assertSafeDatabaseName(database);
  const args = ["-U", dbUser, "-h", host, "-p", port];
  if (command === "dropdb") args.push("--if-exists", "--force");
  args.push(database);
  execFileSync(executable(command), args, { env: pgEnv(), stdio: "inherit" });
}

function ensureDatabaseServer(): void {
  const ready = execFileSync(executable("pg_isready"), ["-h", host, "-p", port], {
    env: pgEnv(),
    encoding: "utf8",
    stdio: "pipe"
  });
  if (String(ready).includes("accepting connections")) {
    console.log(`[sprint2-db] PostgreSQL ready at ${host}:${port}`);
    return;
  }
  pnpm(["db", "start"]);
}

function psql(database: string, sql: string, options: ExecFileSyncOptions = {}): string {
  assertSafeDatabaseName(database);
  return execFileSync(
    executable("psql"),
    ["-U", dbUser, "-h", host, "-p", port, "-d", database, "-X", "-v", "ON_ERROR_STOP=1", "-tA"],
    {
      env: pgEnv(),
      encoding: "utf8",
      input: sql,
      ...options
    }
  ) as string;
}

function recreateDatabase(database: string): void {
  pgAdmin("dropdb", database);
  pgAdmin("createdb", database);
}

function applyCurrentMigrations(database: string): void {
  pnpm(["--filter", "api", "prisma:deploy"], database);
}

function applySprint1Migrations(database: string): void {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "wooriai-sprint1-migrations-"));
  const temporaryPrisma = resolve(temporaryRoot, "prisma");
  const temporaryMigrations = resolve(temporaryPrisma, "migrations");
  mkdirSync(temporaryMigrations, { recursive: true });
  cpSync(resolve(apiRoot, "prisma/schema.prisma"), resolve(temporaryPrisma, "schema.prisma"));
  const migrationLock = resolve(migrationsRoot, "migration_lock.toml");
  if (existsSync(migrationLock)) {
    cpSync(migrationLock, resolve(temporaryMigrations, "migration_lock.toml"));
  }
  for (const migrationName of readdirSync(migrationsRoot).filter((name) => /^00000[1-8]_/.test(name))) {
    cpSync(resolve(migrationsRoot, migrationName), resolve(temporaryMigrations, migrationName), { recursive: true });
  }
  try {
    pnpm(
      ["--filter", "api", "exec", "prisma", "migrate", "deploy", "--schema", resolve(temporaryPrisma, "schema.prisma")],
      database
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function seedAndReimportTwice(database: string): void {
  pnpm(["--filter", "api", "seed"], database);
  pnpm(["catalog:import"], database);
  pnpm(["--filter", "api", "seed"], database);
  pnpm(["catalog:import"], database);
}

function seedSprint1Fixture(database: string): void {
  psql(
    database,
    `
INSERT INTO users (id, auth_provider, provider_user_id, display_name)
VALUES ('${legacyIds.user}', 'kakao', 'sprint1-upgrade-user', 'Sprint 1 User');
INSERT INTO households (id, name, owner_user_id)
VALUES ('${legacyIds.household}', 'Sprint 1 Household', '${legacyIds.user}');
INSERT INTO household_members (id, household_id, user_id, role, status, joined_at)
VALUES ('${legacyIds.member}', '${legacyIds.household}', '${legacyIds.user}', 'owner', 'active', now());
INSERT INTO children (id, household_id, nickname, stage_mode, birth_date)
VALUES ('${legacyIds.child}', '${legacyIds.household}', 'Legacy Child', 'born', DATE '2024-01-01');
UPDATE households SET default_child_id = '${legacyIds.child}' WHERE id = '${legacyIds.household}';
INSERT INTO categories (id, code, name, display_order)
VALUES ('${legacyIds.category}', 'legacy_upgrade_category', 'Legacy Category', 9000);
INSERT INTO item_templates (
  id, code, name, category_id, necessity_level, timing_label,
  price_min_krw, price_max_krw, reason_text, display_order
)
VALUES (
  '${legacyIds.item}', 'legacy_upgrade_item', 'Legacy Prepared Item', '${legacyIds.category}',
  'essential', 'Sprint 1', 1000, 2000, 'Legacy reason survives Sprint 2.', 9000
);
INSERT INTO item_template_stages (item_template_id, stage_code, priority_weight)
VALUES ('${legacyIds.item}', 'toddler_1_3', 1);
INSERT INTO expenses (
  id, household_id, child_id, created_by_user_id, category_id,
  amount_krw, spent_on, item_name, payment_method, source, linked_item_template_id
)
VALUES (
  '${legacyIds.expense}', '${legacyIds.household}', '${legacyIds.child}', '${legacyIds.user}',
  '${legacyIds.category}', 1500, DATE '2026-07-01', 'Legacy Expense', 'card', 'manual', '${legacyIds.item}'
);
INSERT INTO child_item_statuses (
  id, child_id, item_template_id, status, expense_id, updated_by_user_id
)
VALUES (
  '${legacyIds.status}', '${legacyIds.child}', '${legacyIds.item}', 'prepared',
  '${legacyIds.expense}', '${legacyIds.user}'
);
`
  );
}

function verifyDefaultUniquenessAndInactiveHistory(database: string): void {
  psql(
    database,
    `INSERT INTO user_payment_methods (id, user_id, type, label, is_default)
     VALUES ('${legacyIds.paymentOne}', '${legacyIds.user}', 'card', 'Legacy default', true);`
  );
  let duplicateDefaultRejected = false;
  try {
    psql(
      database,
      `INSERT INTO user_payment_methods (id, user_id, type, label, is_default)
       VALUES ('${legacyIds.paymentTwo}', '${legacyIds.user}', 'cash', 'Second default', true);`,
      { stdio: "pipe" }
    );
  } catch {
    duplicateDefaultRejected = true;
  }
  if (!duplicateDefaultRejected) throw new Error("Expected the one-active-default constraint to reject a second default");
  psql(
    database,
    `UPDATE user_payment_methods SET active = false WHERE id = '${legacyIds.paymentOne}';
     INSERT INTO user_payment_methods (id, user_id, type, label, is_default)
     VALUES ('${legacyIds.paymentTwo}', '${legacyIds.user}', 'cash', 'Second default', true);`
  );
}

function freshSummary(database: string): Record<string, unknown> {
  return JSON.parse(
    psql(
      database,
      `SELECT json_build_object(
        'catalogItems', (SELECT count(*) FROM item_templates),
        'activeProductLinks', (SELECT count(*) FROM product_links WHERE active = true),
        'activeReviewedItems', (SELECT count(*) FROM item_templates WHERE active = true AND content_status = 'reviewed'),
        'duplicateCodes', (SELECT count(*) FROM (SELECT code FROM item_templates GROUP BY code HAVING count(*) > 1) duplicates)
      )::text;`
    ).trim()
  ) as Record<string, unknown>;
}

function upgradeSummary(database: string): Record<string, unknown> {
  return JSON.parse(
    psql(
      database,
      `SELECT json_build_object(
        'catalogItems', (SELECT count(*) FROM item_templates WHERE code <> 'legacy_upgrade_item'),
        'activeProductLinks', (SELECT count(*) FROM product_links WHERE active = true),
        'legacyExpenseCompatible', (SELECT count(*) = 1 FROM expenses WHERE id = '${legacyIds.expense}' AND payment_method = 'card' AND payment_method_id IS NULL),
        'legacyItemBackfilled', (SELECT count(*) = 1 FROM item_templates WHERE id = '${legacyIds.item}' AND content_status = 'reviewed' AND reviewed_at IS NOT NULL AND short_reason <> ''),
        'legacyStatusLinked', (SELECT count(*) = 1 FROM child_item_statuses WHERE id = '${legacyIds.status}' AND expense_id = '${legacyIds.expense}' AND item_template_id = '${legacyIds.item}'),
        'activeDefaults', (SELECT count(*) FROM user_payment_methods WHERE user_id = '${legacyIds.user}' AND active = true AND is_default = true),
        'inactivePaymentHistory', (SELECT count(*) FROM user_payment_methods WHERE user_id = '${legacyIds.user}' AND active = false)
      )::text;`
    ).trim()
  ) as Record<string, unknown>;
}

function assertSummary(summary: Record<string, unknown>, expected: Record<string, unknown>, label: string): void {
  for (const [key, value] of Object.entries(expected)) {
    if (summary[key] !== value) {
      throw new Error(`${label}.${key}: expected ${String(value)}, found ${String(summary[key])}`);
    }
  }
}

function verifyCoreCoverageInDatabase(database: string): void {
  const quotedCodes = commerceCoreItemCodes.map((code) => `'${code.replaceAll("'", "''")}'`).join(",");
  const passing = Number(
    psql(
      database,
      `SELECT count(*) FROM (
         SELECT item_templates.code
         FROM item_templates
         JOIN product_links ON product_links.item_template_id = item_templates.id AND product_links.active = true
         WHERE item_templates.code IN (${quotedCodes})
         GROUP BY item_templates.code
         HAVING count(*) >= 2
       ) core;`
    ).trim()
  );
  if (passing !== 40) throw new Error(`Database commerce core coverage: expected 40, found ${passing}`);
}

function main(): void {
  pnpm(["--filter", "api", "prisma:generate"]);
  try {
    ensureDatabaseServer();
  } catch {
    pnpm(["db", "start"]);
  }
  recreateDatabase(freshDatabase);
  recreateDatabase(upgradeDatabase);

  try {
    console.log("[sprint2-db] fresh install");
    applyCurrentMigrations(freshDatabase);
    seedAndReimportTwice(freshDatabase);
    const fresh = freshSummary(freshDatabase);
    verifyCoreCoverageInDatabase(freshDatabase);
    assertSummary(
      fresh,
      { catalogItems: 160, activeProductLinks: 98, activeReviewedItems: 160, duplicateCodes: 0 },
      "fresh"
    );
    console.log(`[sprint2-db] fresh PASS ${JSON.stringify(fresh)}`);

    console.log("[sprint2-db] Sprint 1 -> Sprint 2 upgrade");
    applySprint1Migrations(upgradeDatabase);
    seedSprint1Fixture(upgradeDatabase);
    applyCurrentMigrations(upgradeDatabase);
    seedAndReimportTwice(upgradeDatabase);
    verifyDefaultUniquenessAndInactiveHistory(upgradeDatabase);
    verifyCoreCoverageInDatabase(upgradeDatabase);
    const upgrade = upgradeSummary(upgradeDatabase);
    assertSummary(
      upgrade,
      {
        catalogItems: 160,
        activeProductLinks: 98,
        legacyExpenseCompatible: true,
        legacyItemBackfilled: true,
        legacyStatusLinked: true,
        activeDefaults: 1,
        inactivePaymentHistory: 1
      },
      "upgrade"
    );
    console.log(`[sprint2-db] upgrade PASS ${JSON.stringify(upgrade)}`);
  } finally {
    if (keepDatabases) {
      console.log(`[sprint2-db] kept ${freshDatabase} and ${upgradeDatabase}`);
    } else {
      pgAdmin("dropdb", freshDatabase);
      pgAdmin("dropdb", upgradeDatabase);
    }
  }
}

main();
