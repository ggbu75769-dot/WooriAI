import { PrismaClient } from "@prisma/client";
import { catalogCoverage, catalogStageCodes, catalogStageMinimums, validateCatalog } from "../src/catalog/catalog";
import {
  categorySeeds,
  commerceCoreItemCodes,
  itemTemplateSeeds,
  productLinkSeeds
} from "../prisma/seed-data";
import { isDomainAllowed } from "../src/items-commerce/affiliate-link-guard.util";

const command = process.argv[2] ?? "validate";

function validateProductLinks(): string[] {
  const itemCodes = new Set(itemTemplateSeeds.map((item) => item.code));
  const itemByCode = new Map(itemTemplateSeeds.map((item) => [item.code, item]));
  const allowedDomains = (
    process.env.AFFILIATE_ALLOWED_DOMAINS ??
    "coupang.com,link.coupang.com,smartstore.naver.com,shopping.naver.com,brand.naver.com,example.com"
  )
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const errors: string[] = [];
  const identities = new Set<string>();

  for (const link of productLinkSeeds) {
    if (!itemCodes.has(link.itemTemplateCode)) errors.push(`${link.itemTemplateCode}: product link has no catalog item`);
    const identity = `${link.itemTemplateCode}:${link.platform}:${link.title.trim().toLocaleLowerCase("ko-KR")}`;
    if (identities.has(identity)) errors.push(`${link.itemTemplateCode}: duplicate product-link identity`);
    identities.add(identity);

    let productUrl: URL | null = null;
    try {
      productUrl = new URL(link.url);
    } catch {
      errors.push(`${link.itemTemplateCode}: product URL is invalid`);
    }
    if (productUrl?.protocol !== "https:") errors.push(`${link.itemTemplateCode}: product URL must use https`);
    if (productUrl && !isDomainAllowed(productUrl.hostname, allowedDomains)) {
      errors.push(`${link.itemTemplateCode}: product URL host is not allowlisted`);
    }

    let affiliateUrl: URL | null = null;
    if (link.affiliateUrl) {
      try {
        affiliateUrl = new URL(link.affiliateUrl);
      } catch {
        errors.push(`${link.itemTemplateCode}: affiliate URL is invalid`);
      }
    }
    if (affiliateUrl && affiliateUrl.protocol !== "https:") {
      errors.push(`${link.itemTemplateCode}: affiliate URL must use https`);
    }
    if (affiliateUrl && !isDomainAllowed(affiliateUrl.hostname, allowedDomains)) {
      errors.push(`${link.itemTemplateCode}: affiliate URL host is not allowlisted`);
    }
    if (link.isAffiliate && !link.disclosureText?.includes("제휴")) {
      errors.push(`${link.itemTemplateCode}: affiliate disclosure is required`);
    }
    if (link.isSponsored && (!link.sponsorLabel?.trim() || !link.disclosureText?.trim())) {
      errors.push(`${link.itemTemplateCode}: sponsored links require label and disclosure`);
    }
    if (link.platform === "naver" && productUrl && !isDomainAllowed(productUrl.hostname, ["naver.com"])) {
      errors.push(`${link.itemTemplateCode}: naver link must use a naver.com host`);
    }
    if (link.platform === "coupang" && productUrl && !isDomainAllowed(productUrl.hostname, ["coupang.com"])) {
      errors.push(`${link.itemTemplateCode}: coupang link must use a coupang.com host`);
    }
    if (
      link.platform === "custom" &&
      productUrl &&
      !productUrl.pathname.includes(link.itemTemplateCode.replaceAll("_", "-"))
    ) {
      errors.push(`${link.itemTemplateCode}: custom link path does not match its catalog item`);
    }

    const item = itemByCode.get(link.itemTemplateCode);
    if (
      item &&
      link.priceSnapshotKrw != null &&
      ((item.priceMinKrw != null && link.priceSnapshotKrw < item.priceMinKrw) ||
        (item.priceMaxKrw != null && link.priceSnapshotKrw > item.priceMaxKrw))
    ) {
      errors.push(`${link.itemTemplateCode}: link price is outside the catalog price range`);
    }
  }
  return errors;
}

function validate() {
  const result = validateCatalog(new Set(categorySeeds.map((category) => category.code)));
  result.errors.push(...validateProductLinks());
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  console.log(`Catalog valid: ${result.uniqueItemCount} unique items, ${productLinkSeeds.length} product links`);
  return result;
}

function printCoverage() {
  const coverage = catalogCoverage();
  const activeLinks = productLinkSeeds.filter((link) => link.active);
  const activeLinkCountByItem = new Map<string, number>();
  const platformCounts = new Map<string, number>();
  for (const link of activeLinks) {
    activeLinkCountByItem.set(link.itemTemplateCode, (activeLinkCountByItem.get(link.itemTemplateCode) ?? 0) + 1);
    platformCounts.set(link.platform, (platformCounts.get(link.platform) ?? 0) + 1);
  }
  const commerceEnabledCount = itemTemplateSeeds.filter((item) => (activeLinkCountByItem.get(item.code) ?? 0) > 0).length;
  const zeroLinkCount = itemTemplateSeeds.length - commerceEnabledCount;
  const oneLinkCount = itemTemplateSeeds.filter((item) => activeLinkCountByItem.get(item.code) === 1).length;
  const twoPlusLinkCount = itemTemplateSeeds.filter((item) => (activeLinkCountByItem.get(item.code) ?? 0) >= 2).length;
  const essentialItems = itemTemplateSeeds.filter((item) => item.necessityLevel === "essential");
  const essentialLinkedCount = essentialItems.filter((item) => (activeLinkCountByItem.get(item.code) ?? 0) > 0).length;
  const corePassingCount = commerceCoreItemCodes.filter((code) => (activeLinkCountByItem.get(code) ?? 0) >= 2).length;
  const categoryCounts = new Map<string, number>();
  for (const item of itemTemplateSeeds) {
    categoryCounts.set(item.categoryCode, (categoryCounts.get(item.categoryCode) ?? 0) + 1);
  }

  if (commerceCoreItemCodes.length !== 40 || corePassingCount !== 40 || activeLinks.length < 80) {
    throw new Error(
      `Commerce policy A failed: core=${commerceCoreItemCodes.length}, coreWithTwoPlus=${corePassingCount}, activeLinks=${activeLinks.length}`
    );
  }

  console.log("policy: A (40 core items with 2+ active links; 80+ active links total)");
  console.log(`uniqueItems: ${itemTemplateSeeds.length}`);
  console.log(`commerceEnabledItems: ${commerceEnabledCount}`);
  console.log(`activeLinks: ${activeLinks.length}`);
  console.log(`inactiveLinks: ${productLinkSeeds.length - activeLinks.length}`);
  console.log(`itemsWith0Links: ${zeroLinkCount}`);
  console.log(`itemsWith1Link: ${oneLinkCount}`);
  console.log(`itemsWith2PlusLinks: ${twoPlusLinkCount}`);
  console.log(`coreItemsWith2PlusLinks: ${corePassingCount}/${commerceCoreItemCodes.length}`);
  console.log(
    `essentialItemsWithLinks: ${essentialLinkedCount}/${essentialItems.length} (${(
      (essentialLinkedCount / essentialItems.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`platforms: ${JSON.stringify(Object.fromEntries([...platformCounts.entries()].sort()))}`);
  for (const stageCode of catalogStageCodes) {
    const stageItemCodes = new Set(
      itemTemplateSeeds.filter((item) => item.stageCodes.includes(stageCode)).map((item) => item.code)
    );
    const stageCommerceItems = [...stageItemCodes].filter((code) => (activeLinkCountByItem.get(code) ?? 0) > 0).length;
    const stageLinks = activeLinks.filter((link) => stageItemCodes.has(link.itemTemplateCode)).length;
    console.log(
      `${stageCode}: items=${coverage[stageCode]}/${catalogStageMinimums[stageCode]}, commerceItems=${stageCommerceItems}, activeLinks=${stageLinks}`
    );
  }
  for (const [categoryCode, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const ratio = count / itemTemplateSeeds.length;
    const warning = ratio > 0.15 ? " WARN_CONCENTRATION_GT_15_PERCENT" : "";
    console.log(`category.${categoryCode}: ${count} (${(ratio * 100).toFixed(1)}%)${warning}`);
  }
}

async function importCatalog() {
  validate();
  const prisma = new PrismaClient();
  try {
    const categories = await prisma.category.findMany({
      where: { code: { in: categorySeeds.map((category) => category.code) } },
      select: { id: true, code: true }
    });
    const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

    for (const item of itemTemplateSeeds) {
      const categoryId = categoryIdByCode.get(item.categoryCode);
      if (!categoryId) throw new Error(`Missing category in database: ${item.categoryCode}`);
      const saved = await prisma.itemTemplate.upsert({
        where: { code: item.code },
        update: {
          name: item.name,
          categoryId,
          necessityLevel: item.necessityLevel,
          timingLabel: item.timingLabel,
          priceMinKrw: item.priceMinKrw,
          priceMaxKrw: item.priceMaxKrw,
          shortReason: item.shortReason,
          reasonText: item.reasonText,
          skipReasonText: item.skipReasonText,
          usedSecondhandOk: item.usedSecondhandOk,
          safetyNote: item.safetyNote,
          medicalDisclaimerRequired: item.medicalDisclaimerRequired,
          displayOrder: item.displayOrder,
          active: item.active,
          reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
          reviewedByAdminId: item.reviewedByAdminId,
          nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null,
          sourceNote: item.sourceNote,
          contentStatus: item.contentStatus
        },
        create: {
          code: item.code,
          name: item.name,
          categoryId,
          necessityLevel: item.necessityLevel,
          timingLabel: item.timingLabel,
          priceMinKrw: item.priceMinKrw,
          priceMaxKrw: item.priceMaxKrw,
          shortReason: item.shortReason,
          reasonText: item.reasonText,
          skipReasonText: item.skipReasonText,
          usedSecondhandOk: item.usedSecondhandOk,
          safetyNote: item.safetyNote,
          medicalDisclaimerRequired: item.medicalDisclaimerRequired,
          displayOrder: item.displayOrder,
          active: item.active,
          reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
          reviewedByAdminId: item.reviewedByAdminId,
          nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null,
          sourceNote: item.sourceNote,
          contentStatus: item.contentStatus
        },
        select: { id: true }
      });
      await prisma.itemTemplateStage.deleteMany({
        where: { itemTemplateId: saved.id, stageCode: { notIn: item.stageCodes } }
      });
      for (const [index, stageCode] of item.stageCodes.entries()) {
        await prisma.itemTemplateStage.upsert({
          where: { itemTemplateId_stageCode: { itemTemplateId: saved.id, stageCode } },
          update: { priorityWeight: item.stageCodes.length - index },
          create: { itemTemplateId: saved.id, stageCode, priorityWeight: item.stageCodes.length - index }
        });
      }
    }
    console.log(`Imported ${itemTemplateSeeds.length} catalog items`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (command === "validate") validate();
  else if (command === "coverage") {
    validate();
    printCoverage();
  } else if (command === "import") await importCatalog();
  else throw new Error(`Unknown catalog command: ${command}`);
}

void main();
