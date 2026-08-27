// CON-115: 이 스크립트는 스텁이다 — OpenAPI 문서 존재만 확인하고 아무 타입도 생성하지 않는다.
// 계약 타입의 단일 소스는 packages/contracts의 수기 zod 스키마이며, 계약 변경 시 그쪽을 직접 현행화한다.
import { existsSync } from "node:fs";

const sourcePath = "docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml";

if (!existsSync(sourcePath)) {
  console.error(`[contracts] OpenAPI source not found: ${sourcePath}`);
  process.exit(1);
}

console.log(
  "[contracts] OpenAPI type generation is a permanent no-op stub (CON-115) — " +
    "contract types live in packages/contracts as hand-written zod schemas."
);
