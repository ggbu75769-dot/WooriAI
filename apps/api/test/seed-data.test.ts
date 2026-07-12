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
      safetyNote?: string | null;
      medicalDisclaimerRequired: boolean;
      active: boolean;
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

// Original 7 batch-03 items were seeded before every item was required to have a
// product link; they're grandfathered out of the "every item needs a link" rule
// added when the catalog was expanded to cover all life stages (see below).
const LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT = [
  "pregnancy_vitamin",
  "car_seat",
  "diaper_stock",
  "baby_bath",
  "stroller",
  "baby_food_maker",
  "first_books"
];

const ALL_STAGE_CODES = [
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "newborn_0_3",
  "infant_4_6",
  "infant_7_12",
  "toddler_1_3",
  "kid_4_7",
  "elementary",
  "middle_school"
];

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

  it("covers every child stage with at least 5 active prepared items", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const activeItems = itemTemplateSeeds.filter((item) => item.active);

    for (const stageCode of ALL_STAGE_CODES) {
      const count = activeItems.filter((item) => item.stageCodes.includes(stageCode)).length;
      expect(count, `stage ${stageCode} should be covered by >=5 active items, found ${count}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("requires skip guidance for every convenience/optional item", async () => {
    const { itemTemplateSeeds } = await loadSeedData();

    const nonEssential = itemTemplateSeeds.filter(
      (item) => item.necessityLevel === "convenience" || item.necessityLevel === "optional"
    );

    for (const item of nonEssential) {
      expect(
        Boolean(item.skipReasonText && item.skipReasonText.trim().length > 0),
        `${item.code} (${item.necessityLevel}) must have skipReasonText`
      ).toBe(true);
    }
  });

  it("requires a safety note whenever a medical disclaimer is required", async () => {
    const { itemTemplateSeeds } = await loadSeedData();

    const medicalItems = itemTemplateSeeds.filter((item) => item.medicalDisclaimerRequired);
    expect(medicalItems.length).toBeGreaterThan(0);

    for (const item of medicalItems) {
      expect(
        Boolean(item.safetyNote && item.safetyNote.trim().length > 0),
        `${item.code} has medicalDisclaimerRequired=true but no safetyNote`
      ).toBe(true);
    }
  });

  it("gives every non-legacy item at least one product link", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    const itemsRequiringLinks = itemTemplateSeeds.filter(
      (item) => !LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT.includes(item.code)
    );

    for (const item of itemsRequiringLinks) {
      expect(linkedCodes.has(item.code), `${item.code} should have >=1 product link`).toBe(true);
    }
  });

  it("has no duplicate item template codes", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const codes = itemTemplateSeeds.map((item) => item.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses https URLs for every product link", async () => {
    const { productLinkSeeds } = await loadSeedData();

    for (const link of productLinkSeeds) {
      expect(link.url.startsWith("https://"), `${link.itemTemplateCode} link must use https`).toBe(true);
    }
  });
});
