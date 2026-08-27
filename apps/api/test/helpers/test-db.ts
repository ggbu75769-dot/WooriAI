import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));

let availabilityCache: boolean | null = null;

/**
 * Checks whether a real Postgres database is reachable via DATABASE_URL. Result is
 * cached for the lifetime of the test process (connection state isn't expected to
 * flap mid-run). Used by DB-dependent test files to `describe.skipIf` themselves
 * out, printing the reason so a skipped run is never silent.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (availabilityCache !== null) {
    return availabilityCache;
  }

  if (!process.env.DATABASE_URL) {
    console.warn("[test-db] Skipping DB-dependent tests: DATABASE_URL is not set.");
    availabilityCache = false;
    return false;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    availabilityCache = true;
  } catch (error) {
    console.warn(
      `[test-db] Skipping DB-dependent tests: could not connect to the database. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    availabilityCache = false;
  } finally {
    await prisma.$disconnect();
  }

  return availabilityCache;
}

/**
 * Env flag set by `test/global-setup.ts` once it has applied migrations and seeded
 * for this run. globalSetup executes in vitest's main process before any worker is
 * spawned, so workers inherit it through `process.env` (the same mechanism the
 * DATABASE_URL default already relies on).
 */
export const DB_READY_ENV_FLAG = "WOORIAI_TEST_DB_READY";

/**
 * Applies all pending migrations via `prisma migrate deploy`. Invokes the locally
 * installed prisma CLI binary directly (not through `pnpm exec`) to sidestep
 * environment-specific package-manager shim issues; this only ever runs against a
 * database already confirmed reachable by `isDatabaseAvailable`.
 *
 * No-ops when globalSetup already migrated this run. Two reasons this matters now
 * that test files run in parallel (PERF-130):
 *   - Cost: ~20 suites call this in `beforeAll`, and every call spawned a fresh
 *     prisma CLI process against an already-up-to-date database.
 *   - Correctness: `prisma migrate deploy` takes a Postgres advisory lock, so
 *     concurrent invocations from several workers would serialize and can time out.
 * Kept callable (rather than deleted from the suites) so a suite run without
 * globalSetup still migrates itself.
 */
export function deployMigrations() {
  if (process.env[DB_READY_ENV_FLAG] === "1") {
    return;
  }

  const prismaBin = join(
    apiRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.CMD" : "prisma"
  );
  execSync(`"${prismaBin}" migrate deploy --schema prisma/schema.prisma`, {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env
  });
}

/**
 * Runs the idempotent seed (categories, item templates, product links,
 * disclosures, dev admin). The dedicated test database starts empty, and the
 * e2e suites assume this reference data exists just like a freshly
 * bootstrapped dev environment.
 */
export function seedDatabase() {
  const binName = process.platform === "win32" ? "tsx.CMD" : "tsx";
  // tsx는 워크스페이스 루트 devDependency라 루트 node_modules/.bin에 호이스팅된다.
  const candidates = [
    join(apiRoot, "node_modules", ".bin", binName),
    join(apiRoot, "..", "..", "node_modules", ".bin", binName)
  ];
  const tsxBin = candidates.find((candidate) => existsSync(candidate));
  if (!tsxBin) {
    throw new Error(`tsx 실행 파일을 찾을 수 없어요: ${candidates.join(", ")}`);
  }
  execSync(`"${tsxBin}" prisma/seed.ts`, {
    cwd: apiRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" }
  });
}

// Intentionally no table-truncate helper here: vitest runs test files in parallel,
// and other suites (e.g. admin-settings.e2e.test.ts) write to these same tables
// (audit_logs, refresh_tokens, ...) against the same database. A blanket
// TRUNCATE would randomly break whichever suite happens to be mid-test. DB test
// files must instead scope every assertion/cleanup to identifiers unique to that
// test (a fresh randomized providerToken/email, a specific targetId, etc.).
