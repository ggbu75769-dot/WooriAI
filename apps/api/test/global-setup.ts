import { PrismaClient } from "@prisma/client";
import { createLockDir, removeLockDir } from "./helpers/shared-db-lock";
import { DB_READY_ENV_FLAG, deployMigrations, seedDatabase } from "./helpers/test-db";

// 개발 DB(wooriai_dev)가 아니라 테스트 전용 DB를 기본값으로 쓴다 — 테스트가 만드는
// 사용자/준비템/클릭 데이터가 로컬 앱 화면에 섞여 보이는 오염을 막기 위함이다.
// CI나 다른 환경은 DATABASE_URL로 명시적으로 덮어쓸 수 있다.
const DEFAULT_DATABASE_URL = "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_test";

/**
 * Round 4 removed the in-memory fallback domain data used to have: every e2e/unit
 * test that exercises the API now needs a real Postgres database with migrations
 * applied. This vitest globalSetup makes that a fail-fast, clearly-explained
 * requirement instead of individual test files silently skipping themselves:
 *   1. Injects a sane local default DATABASE_URL if the environment doesn't set one.
 *   2. Verifies connectivity with `SELECT 1`.
 *   3. Applies any pending migrations (`prisma migrate deploy`) and seeds.
 * If either step fails, the whole test run aborts immediately with a Korean
 * explanation of what's missing, rather than letting individual suites skip.
 *
 * PERF-130 added a fourth job: preparing the shared-database readers/writer lock the
 * `db-lock.setup.ts` setup file uses to keep the few database-wide-delta suites from
 * overlapping with anything else. Both this and the migration flag are published to
 * the workers through `process.env`, which they inherit because globalSetup runs in
 * the main process before the worker pool is created.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      "\n[테스트 설정 실패] PostgreSQL 데이터베이스에 연결할 수 없어요.\n" +
        `- DATABASE_URL: ${process.env.DATABASE_URL}\n` +
        "- 로컬 PostgreSQL이 켜져 있는지, 접속 정보(호스트/포트/계정/비밀번호)가 올바른지 확인한 뒤 다시 실행해 주세요.\n" +
        `- 원인: ${reason}\n`
    );
    await prisma.$disconnect();
    throw new Error("DATABASE_UNAVAILABLE: 테스트를 실행하려면 PostgreSQL 연결이 필요해요.");
  }
  await prisma.$disconnect();

  try {
    deployMigrations();
    seedDatabase();
    // 워커들이 상속하는 플래그. 각 스위트의 beforeAll이 이미 끝난 migrate deploy를
    // 다시 돌리지 않게 한다(PERF-130 — 프로세스 스폰 비용 + 어드바이저리 락 경합).
    process.env[DB_READY_ENV_FLAG] = "1";
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`\n[테스트 설정 실패] 마이그레이션/시드 적용에 실패했어요.\n- 원인: ${reason}\n`);
    throw error;
  }

  createLockDir();

  return () => {
    removeLockDir();
  };
}
