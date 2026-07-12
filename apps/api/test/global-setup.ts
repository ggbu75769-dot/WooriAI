import { PrismaClient } from "@prisma/client";
import { deployMigrations } from "./helpers/test-db";

const DEFAULT_DATABASE_URL = "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";

/**
 * Round 4 removed the in-memory fallback domain data used to have: every e2e/unit
 * test that exercises the API now needs a real Postgres database with migrations
 * applied. This vitest globalSetup makes that a fail-fast, clearly-explained
 * requirement instead of individual test files silently skipping themselves:
 *   1. Injects a sane local default DATABASE_URL if the environment doesn't set one.
 *   2. Verifies connectivity with `SELECT 1`.
 *   3. Applies any pending migrations (`prisma migrate deploy`).
 * If either step fails, the whole test run aborts immediately with a Korean
 * explanation of what's missing, rather than letting individual suites skip.
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`\n[테스트 설정 실패] 마이그레이션 적용에 실패했어요.\n- 원인: ${reason}\n`);
    throw error;
  }
}
