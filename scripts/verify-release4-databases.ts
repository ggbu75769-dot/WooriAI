import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const apiRoot = resolve(root, "apps/api");
const migrationsRoot = resolve(apiRoot, "prisma/migrations");
const pgBin = process.env.PGBIN ?? resolve(root, ".toolcache/pg16/pgsql/bin");
const user = "wooriai";
const password = "wooriai_dev_password";
const host = "localhost";
const port = "5432";
const freshDb = "wooriai_release4_fresh_verify";
const upgradeDb = "wooriai_release4_upgrade_verify";
const output = resolve(root, "docs/qa/evidence/release4-database-verification.json");
const keep = process.argv.includes("--keep");
const migrationNames = readdirSync(migrationsRoot)
  .filter((name) => /^\d{6}_.+/.test(name))
  .sort();
const expectedMigrationCount = migrationNames.length;
const expectedMigrationHead = migrationNames.at(-1);

if (!expectedMigrationHead) throw new Error("No Prisma migrations found");

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  household: "22222222-2222-4222-8222-222222222222",
  member: "33333333-3333-4333-8333-333333333333",
  child: "44444444-4444-4444-8444-444444444444",
  category: "55555555-5555-4555-8555-555555555555",
  item: "66666666-6666-4666-8666-666666666666",
  expense: "77777777-7777-4777-8777-777777777777",
  status: "88888888-8888-4888-8888-888888888888"
} as const;

function executable(name: string) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const bundled = resolve(pgBin, `${name}${suffix}`);
  return existsSync(bundled) ? bundled : name;
}

function databaseUrl(database: string) {
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function assertSafe(database: string) {
  if (!/^wooriai_release4_(fresh|upgrade)_verify$/.test(database)) throw new Error(`Unsafe verification database name: ${database}`);
}

function pgEnv() {
  return { ...process.env, PGPASSWORD: password };
}

function pnpm(args: string[], database?: string) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  execFileSync(command, commandArgs, {
    cwd: root,
    env: database ? { ...process.env, DATABASE_URL: databaseUrl(database), NODE_ENV: "test" } : process.env,
    stdio: "inherit"
  });
}

function pgAdmin(command: "createdb" | "dropdb", database: string) {
  assertSafe(database);
  const args = ["-U", user, "-h", host, "-p", port];
  if (command === "dropdb") args.push("--if-exists", "--force");
  args.push(database);
  execFileSync(executable(command), args, { env: pgEnv(), stdio: "inherit" });
}

function psql(database: string, sql: string) {
  assertSafe(database);
  return execFileSync(executable("psql"), ["-U", user, "-h", host, "-p", port, "-d", database, "-X", "-v", "ON_ERROR_STOP=1", "-tA"], {
    encoding: "utf8",
    env: pgEnv(),
    input: sql
  }).trim();
}

function ensurePostgres() {
  try {
    execFileSync(executable("pg_isready"), ["-h", host, "-p", port], { env: pgEnv(), stdio: "pipe" });
  } catch {
    pnpm(["db", "start"]);
  }
}

function recreate(database: string) {
  pgAdmin("dropdb", database);
  pgAdmin("createdb", database);
}

function applyMigrations(database: string, through?: number) {
  if (through === undefined) {
    pnpm(["--filter", "api", "prisma:deploy"], database);
    return;
  }
  const tempRoot = mkdtempSync(join(tmpdir(), "wooriai-release4-migrations-"));
  const tempPrisma = resolve(tempRoot, "prisma");
  const tempMigrations = resolve(tempPrisma, "migrations");
  mkdirSync(tempMigrations, { recursive: true });
  cpSync(resolve(apiRoot, "prisma/schema.prisma"), resolve(tempPrisma, "schema.prisma"));
  cpSync(resolve(migrationsRoot, "migration_lock.toml"), resolve(tempMigrations, "migration_lock.toml"));
  for (const name of readdirSync(migrationsRoot)) {
    const ordinal = Number(name.slice(0, 6));
    if (Number.isInteger(ordinal) && ordinal <= through) cpSync(resolve(migrationsRoot, name), resolve(tempMigrations, name), { recursive: true });
  }
  try {
    pnpm(["--filter", "api", "exec", "prisma", "migrate", "deploy", "--schema", resolve(tempPrisma, "schema.prisma")], database);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function seedRelease3Fixture(database: string) {
  psql(database, `
INSERT INTO users (id, auth_provider, provider_user_id, display_name)
VALUES ('${ids.user}', 'kakao', 'release4-upgrade-user', 'Release 3 User');
INSERT INTO households (id, name, owner_user_id)
VALUES ('${ids.household}', 'Release 3 Household', '${ids.user}');
INSERT INTO household_members (id, household_id, user_id, role, status, joined_at)
VALUES ('${ids.member}', '${ids.household}', '${ids.user}', 'owner', 'active', now());
INSERT INTO children (id, household_id, nickname, stage_mode, birth_date)
VALUES ('${ids.child}', '${ids.household}', 'Legacy Child', 'born', DATE '2024-01-01');
UPDATE households SET default_child_id = '${ids.child}' WHERE id = '${ids.household}';
INSERT INTO categories (id, code, name, display_order)
VALUES ('${ids.category}', 'legacy_upgrade_category', 'Legacy Category', 9000);
INSERT INTO item_templates (
  id, code, name, category_id, necessity_level, timing_label, price_min_krw,
  price_max_krw, reason_text, short_reason, reviewed_at, source_note,
  content_status, display_order
) VALUES (
  '${ids.item}', 'legacy_upgrade_item', 'Legacy Prepared Item', '${ids.category}',
  'essential', 'Release 3', 1000, 2000, 'Legacy reason survives Release 4.',
  'Legacy reason survives Release 4.', now(), 'Release 3 verified fixture', 'reviewed', 9000
);
INSERT INTO item_template_stages (item_template_id, stage_code, priority_weight)
VALUES ('${ids.item}', 'toddler_1_3', 1);
INSERT INTO expenses (
  id, household_id, child_id, created_by_user_id, category_id, amount_krw,
  spent_on, item_name, payment_method, source, linked_item_template_id
) VALUES (
  '${ids.expense}', '${ids.household}', '${ids.child}', '${ids.user}', '${ids.category}',
  1500, DATE '2026-07-01', 'Legacy Expense', 'card', 'manual', '${ids.item}'
);
INSERT INTO child_item_statuses (id, child_id, item_template_id, status, expense_id, updated_by_user_id)
VALUES ('${ids.status}', '${ids.child}', '${ids.item}', 'prepared', '${ids.expense}', '${ids.user}');
`);
}

function summary(database: string, upgrade: boolean) {
  const base = JSON.parse(psql(database, `SELECT json_build_object(
    'migrationCount', (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL),
    'migrationHead', (SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1),
    'topLevelCategories', (SELECT count(*) FROM catalog_nodes WHERE level = 'domain' AND active),
    'level2Categories', (SELECT count(*) FROM catalog_nodes WHERE level = 'category' AND active),
    'level3Categories', (SELECT count(*) FROM catalog_nodes WHERE level = 'subcategory' AND active),
    'canonicalItems', (SELECT count(*) FROM item_definitions),
    'aliases', (SELECT count(*) FROM item_synonyms),
    'evidenceSources', (SELECT count(*) FROM item_evidence_sources source JOIN item_definitions item ON item.id = source.item_definition_id WHERE item.code LIKE 'R4-%'),
    'draftEvidenceSources', (SELECT count(*) FROM item_evidence_sources source JOIN item_definitions item ON item.id = source.item_definition_id WHERE item.code LIKE 'R4-%' AND source.status = 'draft'),
    'reviewedEvidenceSources', (SELECT count(*) FROM item_evidence_sources source JOIN item_definitions item ON item.id = source.item_definition_id WHERE item.code LIKE 'R4-%' AND source.reviewed_by_admin_id IS NOT NULL),
    'highRiskItems', (SELECT count(*) FROM item_definitions WHERE safety_tier = 'high'),
    'publishedItems', (SELECT count(*) FROM item_definitions WHERE status = 'published'),
    'reviewRequiredItems', (SELECT count(*) FROM item_definitions WHERE status = 'in_review'),
    'orphanPrimaryItems', (SELECT count(*) FROM item_definitions item WHERE NOT EXISTS (SELECT 1 FROM item_definition_categories map WHERE map.item_definition_id = item.id AND map.is_primary)),
    'expenseCategories', (SELECT count(*) FROM expense_categories_v2 WHERE household_id IS NULL),
    'scenarioCodes', (SELECT count(DISTINCT context_code) FROM item_context_rules)
  )::text;`)) as Record<string, unknown>;
  if (!upgrade) return base;
  return {
    ...base,
    legacyExpensePreserved: psql(database, `SELECT count(*) = 1 FROM expenses WHERE id = '${ids.expense}' AND amount_krw = 1500;`) === "t",
    legacyExpenseMapped: psql(database, `SELECT count(*) = 1 FROM expenses WHERE id = '${ids.expense}' AND expense_category_v2_id IS NOT NULL AND linked_item_definition_id IS NOT NULL;`) === "t",
    legacyItemPreserved: psql(database, `SELECT count(*) = 1 FROM item_definitions WHERE legacy_item_template_id = '${ids.item}' AND reason_text = 'Legacy reason survives Release 4.';`) === "t",
    legacyPlanBackfilled: psql(database, `SELECT count(*) = 1 FROM user_item_plans WHERE child_id = '${ids.child}' AND state = 'owned' AND linked_expense_id = '${ids.expense}';`) === "t"
  };
}

function assertSummary(value: Record<string, unknown>, label: string) {
  const expected = {
    migrationCount: expectedMigrationCount,
    migrationHead: expectedMigrationHead,
    topLevelCategories: 24,
    level2Categories: 120,
    level3Categories: 360,
    canonicalItems: label === "upgrade" ? 410 : 409,
    aliases: label === "upgrade" ? 3288 : 3287,
    evidenceSources: 485,
    draftEvidenceSources: 485,
    reviewedEvidenceSources: 0,
    highRiskItems: 85,
    publishedItems: 0,
    reviewRequiredItems: label === "upgrade" ? 410 : 409,
    orphanPrimaryItems: 0,
    expenseCategories: 14,
    scenarioCodes: 25
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) throw new Error(`${label}.${key}: expected ${expectedValue}, got ${String(value[key])}`);
  }
  if (label === "upgrade") {
    for (const key of ["legacyExpensePreserved", "legacyExpenseMapped", "legacyItemPreserved", "legacyPlanBackfilled"]) {
      if (value[key] !== true) throw new Error(`upgrade.${key}: expected true`);
    }
  }
}

function main() {
  const startedAt = new Date().toISOString();
  pnpm(["--filter", "api", "prisma:generate"]);
  ensurePostgres();
  recreate(freshDb);
  recreate(upgradeDb);
  try {
    applyMigrations(freshDb);
    pnpm(["--filter", "api", "seed"], freshDb);
    pnpm(["--filter", "api", "seed"], freshDb);
    const fresh = summary(freshDb, false);
    assertSummary(fresh, "fresh");
    applyMigrations(upgradeDb, 12);
    seedRelease3Fixture(upgradeDb);
    applyMigrations(upgradeDb);
    pnpm(["--filter", "api", "seed"], upgradeDb);
    const upgrade = summary(upgradeDb, true);
    assertSummary(upgrade, "upgrade");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, startedAt, finishedAt: new Date().toISOString(), fresh, upgrade, result: "PASS" }, null, 2)}\n`, "utf8");
    console.log(`[release4-db] PASS ${output}`);
  } finally {
    if (!keep) {
      pgAdmin("dropdb", freshDb);
      pgAdmin("dropdb", upgradeDb);
    }
  }
}

main();
