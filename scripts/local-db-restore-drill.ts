import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");
const composeFile = resolve(repoRoot, "infra/docker/docker-compose.yml");
const reportPath = resolve(repoRoot, "artifacts/db-restore-drill/latest.json");
const debugSourceSchemaPath = resolve(reportPath, "../debug-source-schema.sql");
const debugRestoredSchemaPath = resolve(reportPath, "../debug-restored-schema.sql");
const developmentDatabase = "wooriai_dev";
const databaseUser = "wooriai";
const databasePassword = "wooriai_dev_password";
const portablePgBin = process.env.PGBIN ?? resolve(repoRoot, ".toolcache/pg16/pgsql/bin");
const runId = `${Date.now()}_${process.pid}`;
const sourceDatabase = `wooriai_restore_source_${runId}`;
const targetDatabase = `wooriai_restore_target_${runId}`;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function dockerAvailable() {
  try {
    execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "pipe", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

function pgExe(name: string) {
  return resolve(portablePgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
}

function portableAvailable() {
  return existsSync(pgExe("psql")) && existsSync(pgExe("pg_dump"));
}

function assertSafeTarget(name: string) {
  if (!/^wooriai_restore_(source|target)_\d+_\d+$/.test(name) || name === developmentDatabase) {
    throw new Error(`UNSAFE_RESTORE_DRILL_DATABASE ${name}`);
  }
}

function normalizeSchemaDump(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !/^-- (Dumped|Started|Completed)/.test(line) && !/^\\(un)?restrict\b/.test(line))
    .join("\n")
    .trim();
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function main() {
  assertSafeTarget(targetDatabase);
  const useDocker = dockerAvailable();
  if (!useDocker && !portableAvailable()) {
    throw new Error("POSTGRES_TOOLING_NOT_AVAILABLE");
  }
  const backend = useDocker ? "docker" : "portable";
  const portableEnv = { ...process.env, PGPASSWORD: databasePassword };
  const dockerBase = ["compose", "-f", composeFile, "exec", "-T", "postgres"];

  function postgres(command: string, args: string[], input?: string) {
    if (useDocker) {
      return execFileSync("docker", [...dockerBase, command, ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        input,
        maxBuffer: 512 * 1024 * 1024
      });
    }
    return execFileSync(pgExe(command), args, {
      cwd: repoRoot,
      encoding: "utf8",
      env: portableEnv,
      input,
      maxBuffer: 512 * 1024 * 1024
    });
  }

  function psql(database: string, sql: string) {
    return postgres("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-U", databaseUser, "-h", "localhost", "-d", database, "-c", sql]).trim();
  }

  function dump(database: string, schemaOnly = false) {
    return postgres("pg_dump", [
      "-U", databaseUser,
      "-h", "localhost",
      "-d", database,
      ...(schemaOnly ? ["--schema-only"] : ["--clean", "--if-exists"]),
      "--no-owner",
      "--no-privileges"
    ]);
  }

  function tableCounts(database: string) {
    const tables = psql(database, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
      .split(/\r?\n/)
      .filter(Boolean);
    return Object.fromEntries(tables.map((table) => [
      table,
      Number(psql(database, `SELECT count(*) FROM public.${quoteIdentifier(table)};`))
    ]));
  }

  function schemaCatalogFingerprint(database: string) {
    const queries = [
      "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.ordinal_position),'[]'::jsonb) FROM (SELECT table_name,ordinal_position,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public') x;",
      "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.constraint_name),'[]'::jsonb) FROM (SELECT conrelid::regclass::text AS table_name,conname AS constraint_name,contype,conkey::text,confrelid::regclass::text AS referenced_table,confkey::text,condeferrable,condeferred,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace) x;",
      "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.index_name),'[]'::jsonb) FROM (SELECT table_class.relname AS table_name,index_class.relname AS index_name,index_data.indisunique,index_data.indisprimary,index_data.indisvalid,index_data.indkey::text FROM pg_index index_data JOIN pg_class table_class ON table_class.oid=index_data.indrelid JOIN pg_class index_class ON index_class.oid=index_data.indexrelid JOIN pg_namespace namespace ON namespace.oid=table_class.relnamespace WHERE namespace.nspname='public') x;",
      "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.type_name,x.sort_order),'[]'::jsonb) FROM (SELECT type_name.typname AS type_name,enum_value.enumsortorder AS sort_order,enum_value.enumlabel AS label FROM pg_type type_name JOIN pg_enum enum_value ON enum_value.enumtypid=type_name.oid JOIN pg_namespace namespace ON namespace.oid=type_name.typnamespace WHERE namespace.nspname='public') x;",
      "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.function_name,x.arguments),'[]'::jsonb) FROM (SELECT procedure.proname AS function_name,procedure.proargtypes::text AS arguments,procedure.prorettype::regtype::text AS return_type,procedure.prosrc AS source FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace WHERE namespace.nspname='public') x;"
    ];
    return sha256(queries.map((query) => psql(database, query)).join("\n"));
  }

  function runApiScript(script: "prisma:deploy" | "seed", database: string) {
    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli || !existsSync(pnpmCli)) throw new Error("PNPM_CLI_NOT_FOUND");
    execFileSync(process.execPath, [pnpmCli, "--filter", "api", script], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://${databaseUser}:${databasePassword}@localhost:5432/${database}`
      },
      maxBuffer: 64 * 1024 * 1024
    });
  }

  let sourceCreated = false;
  let targetCreated = false;
  let cleanup = "NOT_NEEDED";
  const startedAt = Date.now();
  try {
    psql("postgres", `CREATE DATABASE ${quoteIdentifier(sourceDatabase)};`);
    sourceCreated = true;
    psql("postgres", `CREATE DATABASE ${quoteIdentifier(targetDatabase)};`);
    targetCreated = true;
    runApiScript("prisma:deploy", sourceDatabase);
    runApiScript("seed", sourceDatabase);
    const sourceDump = dump(sourceDatabase);
    postgres("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-U", databaseUser, "-h", "localhost", "-d", targetDatabase], sourceDump);

    const normalizedSourceSchema = normalizeSchemaDump(dump(sourceDatabase, true));
    const normalizedRestoredSchema = normalizeSchemaDump(dump(targetDatabase, true));
    const sourceSchemaSha256 = sha256(normalizedSourceSchema);
    const restoredSchemaSha256 = sha256(normalizedRestoredSchema);
    const sourceCatalogSha256 = schemaCatalogFingerprint(sourceDatabase);
    const restoredCatalogSha256 = schemaCatalogFingerprint(targetDatabase);
    const sourceCounts = tableCounts(sourceDatabase);
    const restoredCounts = tableCounts(targetDatabase);
    const sourceRowsSha256 = sha256(JSON.stringify(sourceCounts));
    const restoredRowsSha256 = sha256(JSON.stringify(restoredCounts));
    const schemaDumpTextMatches = sourceSchemaSha256 === restoredSchemaSha256;
    const schemaMatches = sourceCatalogSha256 === restoredCatalogSha256;
    const rowsMatch = sourceRowsSha256 === restoredRowsSha256;
    if (!schemaMatches || !rowsMatch) {
      mkdirSync(resolve(reportPath, ".."), { recursive: true });
      writeFileSync(debugSourceSchemaPath, `${normalizedSourceSchema}\n`, "utf8");
      writeFileSync(debugRestoredSchemaPath, `${normalizedRestoredSchema}\n`, "utf8");
      throw new Error(`RESTORE_DRILL_MISMATCH schema=${schemaMatches} rows=${rowsMatch}`);
    }

    mkdirSync(resolve(reportPath, ".."), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: "PASS",
      qualification: "LOCAL_ISOLATED_RESTORE_DRILL",
      productionRestoreProven: false,
      backend,
      sourceDatabase,
      targetDatabase,
      developmentDatabaseUsedAsSource: false,
      currentMigrationsAndSeedApplied: true,
      rawBackupRetained: false,
      sourceSchemaSha256,
      restoredSchemaSha256,
      schemaDumpTextMatches,
      sourceCatalogSha256,
      restoredCatalogSha256,
      sourceRowsSha256,
      restoredRowsSha256,
      schemaMatches,
      rowsMatch,
      tableCount: Object.keys(sourceCounts).length,
      totalRows: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0),
      durationMs: Date.now() - startedAt,
      cleanup: "PENDING"
    }, null, 2)}\n`, "utf8");
    if (existsSync(debugSourceSchemaPath)) unlinkSync(debugSourceSchemaPath);
    if (existsSync(debugRestoredSchemaPath)) unlinkSync(debugRestoredSchemaPath);
  } finally {
    if (targetCreated) {
      psql("postgres", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${targetDatabase}' AND pid <> pg_backend_pid();`);
      psql("postgres", `DROP DATABASE IF EXISTS ${quoteIdentifier(targetDatabase)};`);
      cleanup = "DROPPED_ISOLATED_SOURCE_AND_TARGET";
    }
    if (sourceCreated) {
      psql("postgres", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${sourceDatabase}' AND pid <> pg_backend_pid();`);
      psql("postgres", `DROP DATABASE IF EXISTS ${quoteIdentifier(sourceDatabase)};`);
    }
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
  report.cleanup = cleanup;
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[db restore drill] PASS; backend=${backend}; tables=${report.tableCount}; rows=${report.totalRows}`);
  console.log(`[db restore drill] evidence=${reportPath}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
