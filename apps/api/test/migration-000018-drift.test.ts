import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importStubCategorySeeds, mobileCategoryAliasSeeds } from "../prisma/seed-data";

/**
 * R26 리뷰 후속: 마이그레이션 000018의 UPDATE는 code 목록을 명시한다(LIKE 오탐 방지가
 * 명시된 설계 근거). fresh DB에서는 시드보다 먼저 돌아 0행에 적용되므로 어떤 테스트도
 * 이 목록을 실행하지 않는다 — seed-data에 별칭이 추가/제거되면 목록이 조용히 어긋난다.
 * 기능 영향은 없지만(새 행은 seed.ts가 selectable=false로 만든다) 업그레이드 경로의
 * 정합을 커밋 시점에 잡는 드리프트 가드다. DB 불필요.
 */
describe("000018 categories.selectable 마이그레이션 드리프트 가드", () => {
  it("UPDATE의 code 목록이 seed-data의 별칭·스텁 코드와 정확히 일치한다", () => {
    const sql = readFileSync(
      join(__dirname, "..", "prisma", "migrations", "000018_categories_selectable", "migration.sql"),
      "utf8"
    );
    // 주석 줄의 여는/닫는 괄호에 걸리지 않도록 IN 목록의 끝은 `);`로 잡는다.
    const inList = sql.match(/AND code IN \(([\s\S]*?)\);/);
    expect(inList).not.toBeNull();
    const migrationCodes = [...inList![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const seedCodes = [...mobileCategoryAliasSeeds, ...importStubCategorySeeds].map((seed) => seed.code).sort();
    expect(migrationCodes).toEqual(seedCodes);
  });
});
