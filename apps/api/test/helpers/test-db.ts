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
 *
 * ⚠️ 두 시점(라운드 107 트랙 E). 시드의 **기본 동작이 바뀌었다**: 있는 행은 더 이상
 * 고치지 않는다(어드민 편집분을 배포가 되돌리던 정찰 S5 D3). 그런데 이 자리는 그 반대를
 * 원한다 — 공유 test DB는 **버려도 되는 환경**이고, 여기서만은 시드가 콘텐츠의 단일
 * 소스라는 전제가 참이다. 스위트들은 오래전부터 "실행을 시작할 때 시드 기준선이 복원된다"에
 * 기대어 왔다.
 *
 * 이 기대가 필요했던 실측(라운드 107 E, wooriai_test):
 *   `admin-settings.e2e.test.ts:148`이 **시드 키** `affiliate_purchase`의 문구를
 *   "Batch10 affiliate disclosure near CTA."로 바꾸고 되돌리지 않았다. 그 값이 DB에 남으면
 *   `items-commerce.e2e.test.ts`의 고지 계약 3건이 "수수료"를 찾지 못해 빨개진다.
 *   종전에는 매 실행 첫머리의 시드가 그것을 지웠다.
 * 그래서 이 호출만 명시적으로 덮어쓰기를 켠다. **배포 경로는 켜지 않는다**
 * (`scripts/deploy/oracle-bootstrap.sh` 8단계 주석).
 *
 * ⚠️ 두 시점(라운드 107 F). 종전(그때는 참): 위 오염은 이 플래그가 **가리는** 것이지 사라진
 * 것이 아니었다 — 한 실행 안에서 admin-settings가 먼저 돌면 그대로 깨졌다(실측: 3건 빨강).
 * 이제: 그 스위트는 시드 고지를 아예 건드리지 않고 자기 접두의 자기 키만 쓰며, 시드 행이
 * 그대로임을 그 자리에서 스스로 단언한다 — 두 순서 모두 초록으로 실측됐다. 즉 **이 저장소가
 * 아는 순서 의존은 남아 있지 않다.**
 *
 * 그럼에도 이 플래그를 끄지 않는 이유는 역할이 하나 더 있기 때문이다: 공유 test DB에는
 * **이 저장소가 모르는 오염**이 쌓인다(과거 실행이 중간에 죽으며 남긴 값, 다른 브랜치의
 * 시드 데이터, 손으로 만진 행). 시드 행의 콘텐츠를 기준선으로 되돌리는 경로는 이 한 줄뿐이고,
 * 끄면 그런 DB를 만난 사람에게 남는 길은 파괴적인 reset밖에 없다. 실측 근거: 라운드 107 F의
 * 재현 실행이 남긴 오염된 `affiliate_purchase`를 다음 실행의 이 플래그가 씻어 냈다.
 * 끄려면 먼저 "이 플래그 없이 전체 스위트가 초록"을 실측해야 한다(라운드 107 F는 파일 지정
 * 실행만 허용돼 그 실측을 하지 못했다).
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
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "test",
      // 위 문단 참조 — 공유 test DB의 시드 기준선을 실행 첫머리에 복원한다.
      SEED_OVERWRITE_CONTENT: "1"
    }
  });
}

// Intentionally no table-truncate helper here: vitest runs test files in parallel,
// and other suites (e.g. admin-settings.e2e.test.ts) write to these same tables
// (audit_logs, refresh_tokens, ...) against the same database. A blanket
// TRUNCATE would randomly break whichever suite happens to be mid-test. DB test
// files must instead scope every assertion/cleanup to identifiers unique to that
// test (a fresh randomized providerToken/email, a specific targetId, etc.).
