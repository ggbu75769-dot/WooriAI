import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaDir = join(apiRoot, "prisma");
const seedDataPath = join(prismaDir, "seed-data.ts");
const seedScriptPath = join(prismaDir, "seed.ts");

async function loadSeedData() {
  expect(existsSync(seedDataPath), `${seedDataPath} must exist`).toBe(true);
  if (!existsSync(seedDataPath)) {
    return { categorySeeds: [], itemTemplateSeeds: [], productLinkSeeds: [] };
  }

  return import(pathToFileURL(seedDataPath).href) as Promise<{
    categorySeeds: Array<{ code: string; name: string; iconName: string; displayOrder: number }>;
    itemTemplateSeeds: Array<{
      code: string;
      categoryCode: string;
      necessityLevel: string;
      reasonText: string;
      skipReasonText?: string | null;
      stageCodes: string[];
    }>;
    productLinkSeeds: Array<{
      itemTemplateCode: string;
      platform: string;
      url: string;
      affiliateUrl?: string | null;
      affiliatePartnerCode?: string | null;
      isAffiliate: boolean;
      isSponsored: boolean;
      sponsorLabel?: string | null;
      disclosureText?: string | null;
    }>;
  }>;
}

describe("Batch 03 seed data", () => {
  it("defines the locked 12 categories without duplicates", async () => {
    const { categorySeeds } = await loadSeedData();
    const expectedCodes = [
      "pregnancy_mother",
      "hospital_checkup",
      "birth_postpartum",
      "diaper_hygiene",
      "feeding_babyfood",
      "clothes_laundry",
      "sleep_furniture",
      "outing_mobility",
      "toys_books",
      "care_education",
      "insurance_savings",
      "etc"
    ];

    expect(categorySeeds.map((category) => category.code)).toEqual(expectedCodes);
    expect(new Set(categorySeeds.map((category) => category.code)).size).toBe(12);
    expect(categorySeeds.every((category) => category.name && category.iconName)).toBe(true);
  });

  it("covers stage-based item templates with all necessity levels and skip guidance", async () => {
    const { categorySeeds, itemTemplateSeeds } = await loadSeedData();
    const categoryCodes = new Set(categorySeeds.map((category) => category.code));
    const levels = new Set(itemTemplateSeeds.map((item) => item.necessityLevel));

    expect(levels).toEqual(new Set(["essential", "convenience", "optional"]));
    expect(itemTemplateSeeds.length).toBeGreaterThanOrEqual(6);
    expect(itemTemplateSeeds.every((item) => categoryCodes.has(item.categoryCode))).toBe(true);
    expect(itemTemplateSeeds.every((item) => item.reasonText.length > 0)).toBe(true);
    expect(itemTemplateSeeds.every((item) => item.stageCodes.length > 0)).toBe(true);
    expect(
      itemTemplateSeeds
        .filter((item) => item.necessityLevel !== "essential")
        .every((item) => Boolean(item.skipReasonText))
    ).toBe(true);
  });

  it("uses development-only product links with explicit affiliate and sponsored flags", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();
    const itemCodes = new Set(itemTemplateSeeds.map((item) => item.code));

    expect(productLinkSeeds.length).toBeGreaterThanOrEqual(3);
    expect(productLinkSeeds.every((link) => itemCodes.has(link.itemTemplateCode))).toBe(true);
    expect(productLinkSeeds.some((link) => link.isAffiliate)).toBe(true);
    expect(productLinkSeeds.some((link) => link.isSponsored && Boolean(link.sponsorLabel))).toBe(true);
    expect(productLinkSeeds.every((link) => link.url.startsWith("https://example.com/dev/"))).toBe(true);
    expect(productLinkSeeds.every((link) => link.affiliatePartnerCode == null)).toBe(true);
    expect(
      productLinkSeeds
        .filter((link) => link.isAffiliate)
        .every((link) => link.disclosureText?.includes("제휴"))
    ).toBe(true);
    expect(JSON.stringify(productLinkSeeds).toLowerCase()).not.toMatch(/secret|access_key|partner_id/);
    expect(JSON.stringify(productLinkSeeds).toLowerCase()).not.toMatch(/coupang\.com|naver\.com/);
  });

  it("keeps the seed script idempotent and out of expenses", () => {
    expect(existsSync(seedScriptPath), `${seedScriptPath} must exist`).toBe(true);
    const seedScript = existsSync(seedScriptPath) ? readFileSync(seedScriptPath, "utf8") : "";

    expect(seedScript).toContain("upsert");
    expect(seedScript).toContain("findFirst");
    expect(seedScript).not.toContain("expenses");
  });
});
