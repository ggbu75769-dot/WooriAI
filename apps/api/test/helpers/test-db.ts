import { execSync } from "node:child_process";
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
 * Applies all pending migrations via `prisma migrate deploy`. Invokes the locally
 * installed prisma CLI binary directly (not through `pnpm exec`) to sidestep
 * environment-specific package-manager shim issues; this only ever runs against a
 * database already confirmed reachable by `isDatabaseAvailable`.
 */
export function deployMigrations() {
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

// Intentionally no table-truncate helper here: vitest runs test files in parallel,
// and other suites (e.g. admin-settings.e2e.test.ts) write to these same tables
// (audit_logs, refresh_tokens, ...) against the same database. A blanket
// TRUNCATE would randomly break whichever suite happens to be mid-test. DB test
// files must instead scope every assertion/cleanup to identifiers unique to that
// test (a fresh randomized providerToken/email, a specific targetId, etc.).
