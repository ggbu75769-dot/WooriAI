import { existsSync } from "node:fs";

const sourcePath = "docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml";

if (!existsSync(sourcePath)) {
  console.error(`[contracts] OpenAPI source not found: ${sourcePath}`);
  process.exit(1);
}

console.log("[contracts] OpenAPI type generation is deferred to Batch 02.");
