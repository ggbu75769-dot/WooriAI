import { createRequire } from "node:module";
import { join } from "node:path";

type AuditPrismaClient = {
  $queryRawUnsafe<T>(query: string): Promise<T>;
  $disconnect(): Promise<void>;
};

// Prisma is owned by the API workspace rather than the repository root. Load
// it using that package's resolution context without making the root scripts
// compiler depend on pnpm hoisting or a second generated-client module ID.
const requireFromApi = createRequire(join(process.cwd(), "apps", "api", "package.json"));
const { PrismaClient } = requireFromApi("@prisma/client") as {
  PrismaClient: new () => AuditPrismaClient;
};

async function main() {
  const prisma = new PrismaClient();
  try {
  const legacyColumn = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'children' AND column_name = 'gender_legacy_text') AS present"
  );
  const genderValues = legacyColumn[0]?.present
    ? await prisma.$queryRawUnsafe<Array<{ gender: string | null; gender_legacy_text: string | null; count: number }>>(
        "SELECT gender::text, gender_legacy_text, COUNT(*)::int AS count FROM children GROUP BY gender, gender_legacy_text ORDER BY gender NULLS FIRST, gender_legacy_text NULLS FIRST"
      )
    : await prisma.$queryRawUnsafe<Array<{ gender: string | null; gender_legacy_text: string | null; count: number }>>(
        "SELECT gender::text, NULL::text AS gender_legacy_text, COUNT(*)::int AS count FROM children GROUP BY gender ORDER BY gender NULLS FIRST"
      );
  const migration = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; has_logs: boolean }>>(
    "SELECT migration_name, finished_at, rolled_back_at, logs IS NOT NULL AS has_logs FROM _prisma_migrations WHERE migration_name = '000040_release5v_child_sex_contract'"
  );
  const catalog = await prisma.$queryRawUnsafe<Array<{ canonical: number; in_review: number; published: number; high_risk: number }>>(
    "SELECT COUNT(*)::int AS canonical, COUNT(*) FILTER (WHERE status::text = 'in_review')::int AS in_review, COUNT(*) FILTER (WHERE status::text = 'published')::int AS published, COUNT(*) FILTER (WHERE safety_tier::text IN ('high', 'critical'))::int AS high_risk FROM item_definitions WHERE code LIKE 'R4-%'"
  );
  const offers = await prisma.$queryRawUnsafe<Array<{ approved_offers: number }>>(
    "SELECT COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL)::int AS approved_offers FROM product_offers"
  );
  process.stdout.write(`${JSON.stringify({ genderValues, migration, catalog: catalog[0], offers: offers[0] }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
