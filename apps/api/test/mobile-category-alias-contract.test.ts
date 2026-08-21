import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cross-app sync guard for the two hand-copied category lists:
 *
 *   server: apps/api/prisma/seed-data.ts   -> `mobileCategoryAliasSeeds`
 *   client: apps/mobile/src/categories.ts  -> `categoryCatalog`
 *
 * The mobile quick-expense tiles hardcode their `categoryId` UUID literals instead of fetching
 * them, and `POST /children/:childId/expenses` rejects a `categoryId` with no `categories` row
 * (requireExistingCategory). So a tile id that drifts out of the alias seed list makes every
 * expense created from that tile 400 against a real server -- silently, since neither list was
 * ever compared by a test. This file is that comparison.
 *
 * Path note: both files are located relative to this test's own URL (apps/api/test/), so the
 * paths below are the only thing to update if either file moves; `existsSync` assertions fail
 * with the full resolved path rather than a confusing empty-list mismatch.
 */
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(apiRoot, "..", "..");
const seedDataPath = join(apiRoot, "prisma", "seed-data.ts");
const mobileCategoriesPath = join(repoRoot, "apps", "mobile", "src", "categories.ts");

type MobileCategoryAliasSeed = {
  id: string;
  code: string;
  name: string;
  iconName: string;
  displayOrder: number;
};

async function loadAliasSeeds(): Promise<MobileCategoryAliasSeed[]> {
  expect(existsSync(seedDataPath), `${seedDataPath} must exist`).toBe(true);
  const seedData = (await import(pathToFileURL(seedDataPath).href)) as {
    mobileCategoryAliasSeeds: MobileCategoryAliasSeed[];
  };
  return seedData.mobileCategoryAliasSeeds;
}

type MobileCatalogEntry = { id: string; code: string; label: string };

/**
 * The mobile file is read as text rather than imported: apps/mobile is a separate
 * (React Native / Expo) TS project outside this app's tsconfig, so parsing the literal keeps
 * the api test suite free of any cross-app module resolution.
 */
function loadMobileCatalog(): MobileCatalogEntry[] {
  expect(existsSync(mobileCategoriesPath), `${mobileCategoriesPath} must exist`).toBe(true);
  const source = readFileSync(mobileCategoriesPath, "utf8");

  const arrayMatch = /export const categoryCatalog: CategoryCatalogEntry\[\] = \[([\s\S]*?)\n\];/.exec(source);
  expect(arrayMatch, `categoryCatalog literal not found in ${mobileCategoriesPath}`).not.toBeNull();

  const entries: MobileCatalogEntry[] = [];
  const entryPattern = /\{\s*id:\s*"([^"]+)",\s*code:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g;
  for (const entry of (arrayMatch?.[1] ?? "").matchAll(entryPattern)) {
    entries.push({ id: entry[1], code: entry[2], label: entry[3] });
  }
  return entries;
}

describe("mobile quick-expense catalog <-> mobileCategoryAliasSeeds contract", () => {
  it("parses both hand-maintained lists (guards this test against a silent no-op)", async () => {
    const aliasSeeds = await loadAliasSeeds();
    const catalog = loadMobileCatalog();

    expect(catalog.length).toBe(8);
    expect(aliasSeeds.length).toBe(catalog.length);
  });

  it("seeds exactly the category ids the mobile tiles send, in the same order", async () => {
    const aliasSeeds = await loadAliasSeeds();
    const catalog = loadMobileCatalog();

    // Order-sensitive on purpose: the displayOrder values (1001..) follow the tile order, so a
    // reordering that keeps the same id set still deserves a look.
    expect(aliasSeeds.map((seed) => seed.id)).toEqual(catalog.map((entry) => entry.id));
    // Set comparison too, so a mismatch reports which id is missing on which side.
    expect(new Set(aliasSeeds.map((seed) => seed.id))).toEqual(new Set(catalog.map((entry) => entry.id)));
    expect(new Set(aliasSeeds.map((seed) => seed.id)).size).toBe(aliasSeeds.length);
  });

  it("keeps the seeded category names identical to the tile labels users see", async () => {
    const aliasSeeds = await loadAliasSeeds();
    const catalog = loadMobileCatalog();

    // GET /categories serves these names to the report/CSV category label lookup
    // (apps/mobile/src/categories.ts buildCategoryNameLookup), so drift here would rename a
    // category between the tile the user tapped and the report/CSV row it lands in.
    expect(aliasSeeds.map((seed) => seed.name)).toEqual(catalog.map((entry) => entry.label));
  });

  it("uses UUID-shaped alias ids (the DTOs validate categoryId with @IsUUID) under distinct mobile_ codes", async () => {
    const aliasSeeds = await loadAliasSeeds();

    for (const seed of aliasSeeds) {
      expect(seed.id, `${seed.code} id must be a v4-shaped UUID literal`).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      // Prefixed so the aliases never collide with the locked 12 canonical `categorySeeds` codes.
      expect(seed.code.startsWith("mobile_"), `${seed.code} must be a mobile_ alias code`).toBe(true);
    }
    expect(new Set(aliasSeeds.map((seed) => seed.code)).size).toBe(aliasSeeds.length);
  });
});
