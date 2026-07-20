import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { release4SearchAcceptanceCorpus } from "@wooriai/domain";
import { CatalogV2Service } from "../apps/api/src/catalog-v2/catalog-v2.service";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import type { AuthenticatedUser } from "../apps/api/src/common/types/authenticated-request";

const root = resolve(__dirname, "..");
const output = resolve(root, "docs/qa/evidence/release4-catalog-performance.json");
process.env.DATABASE_URL ??= "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";
process.env.NODE_ENV = "test";
process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";

const actor: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Performance fixture",
  email: null,
  status: "active",
  households: []
};

function percentile(values: number[], target: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * target) - 1)] ?? 0;
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const catalog = new CatalogV2Service(prisma);
    for (const entry of release4SearchAcceptanceCorpus.slice(0, 5)) {
      await catalog.listItems(actor, { query: entry.query, limit: 20 });
    }
    const timings: number[] = [];
    const misses: Array<{ query: string; expected: string; actual: string | null }> = [];
    for (const entry of release4SearchAcceptanceCorpus) {
      const started = performance.now();
      const result = await catalog.listItems(actor, { query: entry.query, limit: 20 });
      timings.push(performance.now() - started);
      const actual = result.items[0]?.nameKo ?? null;
      if (actual !== entry.expectedNameKo) misses.push({ query: entry.query, expected: entry.expectedNameKo, actual });
    }
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      runtime: process.version,
      profile: "local PostgreSQL API service layer, explicit non-production internal preview, after 5-query warm-up",
      catalogQueries: timings.length,
      acceptanceMisses: misses,
      milliseconds: {
        average: Number((timings.reduce((sum, value) => sum + value, 0) / timings.length).toFixed(2)),
        p50: Number(percentile(timings, 0.5).toFixed(2)),
        p95: Number(percentile(timings, 0.95).toFixed(2)),
        maximum: Number(Math.max(...timings).toFixed(2))
      },
      threshold: { p95Milliseconds: 500, acceptanceMisses: 0 },
      result: misses.length === 0 && percentile(timings, 0.95) < 500 ? "PASS" : "FAIL"
    };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    if (report.result !== "PASS") process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
