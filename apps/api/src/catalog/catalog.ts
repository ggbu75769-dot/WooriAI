import pregnancyEarly from "../../../../content/item-catalog/v1/pregnancy-early.json";
import pregnancyMid from "../../../../content/item-catalog/v1/pregnancy-mid.json";
import pregnancyLate from "../../../../content/item-catalog/v1/pregnancy-late.json";
import newbornZeroToThree from "../../../../content/item-catalog/v1/newborn-0-3.json";
import infantFourToSix from "../../../../content/item-catalog/v1/infant-4-6.json";
import infantSevenToTwelve from "../../../../content/item-catalog/v1/infant-7-12.json";
import toddlerOneToThree from "../../../../content/item-catalog/v1/toddler-1-3.json";
import kidFourToSeven from "../../../../content/item-catalog/v1/kid-4-7.json";
import elementary from "../../../../content/item-catalog/v1/elementary.json";
import middleSchool from "../../../../content/item-catalog/v1/middle-school.json";

export const catalogStageCodes = [
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
] as const;

export type CatalogStageCode = (typeof catalogStageCodes)[number];
export type CatalogContentStatus = "draft" | "reviewed" | "retired";

export type CatalogItem = {
  code: string;
  name: string;
  categoryCode: string;
  necessityLevel: "essential" | "convenience" | "optional";
  stageCodes: CatalogStageCode[];
  timingLabel: string;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  shortReason: string;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  medicalDisclaimerRequired: boolean;
  displayOrder: number;
  active: boolean;
  reviewedAt: string | null;
  reviewedByAdminId: string | null;
  nextReviewAt: string | null;
  sourceNote: string | null;
  contentStatus: CatalogContentStatus;
};

export const catalogStageMinimums: Record<CatalogStageCode, number> = {
  pregnancy_early: 15,
  pregnancy_mid: 15,
  pregnancy_late: 25,
  newborn_0_3: 25,
  infant_4_6: 18,
  infant_7_12: 18,
  toddler_1_3: 20,
  kid_4_7: 18,
  elementary: 15,
  middle_school: 12
};

export const catalogItems = [
  ...pregnancyEarly,
  ...pregnancyMid,
  ...pregnancyLate,
  ...newbornZeroToThree,
  ...infantFourToSix,
  ...infantSevenToTwelve,
  ...toddlerOneToThree,
  ...kidFourToSeven,
  ...elementary,
  ...middleSchool
] as unknown as CatalogItem[];

export type CatalogValidationResult = {
  errors: string[];
  warnings: string[];
  coverage: Record<CatalogStageCode, number>;
  uniqueItemCount: number;
};

export function catalogCoverage(items: CatalogItem[] = catalogItems): Record<CatalogStageCode, number> {
  return Object.fromEntries(
    catalogStageCodes.map((stageCode) => [
      stageCode,
      items.filter(
        (item) => item.active && item.contentStatus === "reviewed" && item.stageCodes.includes(stageCode)
      ).length
    ])
  ) as Record<CatalogStageCode, number>;
}

function normalizedEditorialName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}]/gu, "");
}

function levenshteinDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
  }
  return rows[left.length][right.length];
}

export function validateCatalog(
  supportedCategoryCodes: ReadonlySet<string>,
  items: CatalogItem[] = catalogItems
): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const codes = new Set<string>();
  const names = new Map<string, string>();
  const editorialNames: Array<{ code: string; name: string; normalized: string }> = [];
  const skipReasonOwners = new Map<string, string[]>();
  const stageCodeSet = new Set<string>(catalogStageCodes);

  for (const [index, item] of items.entries()) {
    const label = item.code || `index:${index}`;
    const normalizedCode = item.code.trim();
    const normalizedName = normalizedEditorialName(item.name.trim());

    if (!normalizedCode) errors.push(`${label}: code is required`);
    else if (codes.has(normalizedCode)) errors.push(`${label}: duplicate code`);
    else codes.add(normalizedCode);

    if (!normalizedName) errors.push(`${label}: name is required`);
    else if (names.has(normalizedName)) {
      errors.push(`${label}: duplicate name with ${names.get(normalizedName)}`);
    } else {
      names.set(normalizedName, label);
      editorialNames.push({ code: label, name: item.name.trim(), normalized: normalizedName });
    }

    if (!supportedCategoryCodes.has(item.categoryCode)) errors.push(`${label}: unsupported category ${item.categoryCode}`);
    if (!(["essential", "convenience", "optional"] as const).includes(item.necessityLevel)) {
      errors.push(`${label}: invalid necessity level`);
    }
    if (!item.stageCodes.length) errors.push(`${label}: at least one stage is required`);
    for (const stageCode of item.stageCodes) {
      if (!stageCodeSet.has(stageCode)) errors.push(`${label}: unsupported stage ${stageCode}`);
    }
    if (!item.reasonText.trim()) errors.push(`${label}: reasonText is required`);
    if (!item.shortReason.trim()) errors.push(`${label}: shortReason is required`);
    if (
      (item.necessityLevel === "convenience" || item.necessityLevel === "optional") &&
      !item.skipReasonText?.trim()
    ) {
      errors.push(`${label}: skipReasonText is required for ${item.necessityLevel}`);
    }
    if (item.skipReasonText?.trim()) {
      const normalizedSkipReason = item.skipReasonText.trim();
      skipReasonOwners.set(normalizedSkipReason, [
        ...(skipReasonOwners.get(normalizedSkipReason) ?? []),
        label
      ]);
    }
    if (item.priceMinKrw != null && item.priceMaxKrw != null && item.priceMinKrw > item.priceMaxKrw) {
      errors.push(`${label}: priceMinKrw must not exceed priceMaxKrw`);
    }
    if (item.medicalDisclaimerRequired && !item.safetyNote?.trim()) {
      errors.push(`${label}: medical items require a safety note`);
    }
    if (item.active && item.contentStatus === "reviewed" && !item.reviewedAt) {
      errors.push(`${label}: active reviewed items require reviewedAt`);
    }
    if (!(["draft", "reviewed", "retired"] as const).includes(item.contentStatus)) {
      errors.push(`${label}: invalid contentStatus`);
    }
  }

  for (let leftIndex = 0; leftIndex < editorialNames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < editorialNames.length; rightIndex += 1) {
      const left = editorialNames[leftIndex];
      const right = editorialNames[rightIndex];
      const shorterLength = Math.min(left.normalized.length, right.normalized.length);
      const similarity =
        1 - levenshteinDistance(left.normalized, right.normalized) / Math.max(left.normalized.length, right.normalized.length);
      const contains =
        shorterLength >= 3 &&
        (left.normalized.includes(right.normalized) || right.normalized.includes(left.normalized));
      if (contains || similarity >= 0.72) {
        warnings.push(
          `similar-name review: ${left.code} (${left.name}) <> ${right.code} (${right.name})`
        );
      }
    }
  }
  for (const [skipReason, owners] of skipReasonOwners) {
    if (owners.length > 1) {
      warnings.push(`repeated skipReasonText (${owners.length} items): ${skipReason}`);
    }
  }

  const coverage = catalogCoverage(items);
  for (const stageCode of catalogStageCodes) {
    if (coverage[stageCode] < catalogStageMinimums[stageCode]) {
      errors.push(
        `${stageCode}: requires ${catalogStageMinimums[stageCode]} reviewed active items, found ${coverage[stageCode]}`
      );
    }
  }
  if (codes.size < 160) errors.push(`catalog requires at least 160 unique items, found ${codes.size}`);

  return { errors, warnings, coverage, uniqueItemCount: codes.size };
}

export function assertValidCatalog(supportedCategoryCodes: ReadonlySet<string>): CatalogValidationResult {
  const result = validateCatalog(supportedCategoryCodes);
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  return result;
}
