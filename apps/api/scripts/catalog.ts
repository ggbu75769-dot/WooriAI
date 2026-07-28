import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { catalogCoverage, catalogStageCodes, catalogStageMinimums, validateCatalog } from "../src/catalog/catalog";
import {
  catalogScenarioCodes,
  childLifecycleCodes,
  motherLifecycleCodes,
  release4CatalogMetrics,
  validateRelease4Catalog
} from "@wooriai/domain";
import {
  categorySeeds,
  commerceCoreItemCodes,
  itemTemplateSeeds,
  productLinkSeeds
} from "../prisma/seed-data";
import { isDomainAllowed } from "../src/items-commerce/affiliate-link-guard.util";

const command = process.argv[2] ?? "validate";
const RELEASE4_ITEM_PREFIX = "R4-";

function normalizedTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

function countBy(values: string[]) {
  return Object.fromEntries(
    [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())]
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function requestedOutput(defaultRelativePath: string) {
  const outputIndex = process.argv.indexOf("--output");
  const requested = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  const repositoryRoot = resolve(process.cwd(), "../..");
  return resolve(repositoryRoot, requested ?? defaultRelativePath);
}

async function auditCatalogDatabase() {
  const prisma = new PrismaClient();
  try {
    const definitions = await prisma.itemDefinition.findMany({
      where: { code: { startsWith: RELEASE4_ITEM_PREFIX } },
      orderBy: { code: "asc" }
    });
    const itemIds = definitions.map((item) => item.id);
    const [
      nodes,
      categoryLinks,
      lifecycleRules,
      contextRules,
      synonyms,
      safetyRules,
      evidenceSources,
      expenseMappings,
      offers,
      coverageDecisions
    ] = await Promise.all([
      prisma.catalogNode.findMany({ orderBy: { code: "asc" } }),
      prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemLifecycleRule.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemContextRule.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemSynonym.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemSafetyRule.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemEvidenceSource.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.itemExpenseCategoryMapping.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.productOffer.findMany({ where: { itemDefinitionId: { in: itemIds } } }),
      prisma.catalogCoverageDecision.findMany()
    ]);

    const itemIdSet = new Set(itemIds);
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const taxonomyCycleCodes = new Set<string>();
    const invalidHierarchyRelations: Array<{ code: string; level: string; parentLevel: string | null }> = [];
    for (const node of nodes) {
      const visited = new Set<string>();
      let cursor: typeof node | undefined = node;
      while (cursor) {
        if (visited.has(cursor.id)) {
          taxonomyCycleCodes.add(node.code);
          break;
        }
        visited.add(cursor.id);
        cursor = cursor.parentId ? nodeById.get(cursor.parentId) : undefined;
      }
      const parentLevel = node.parentId ? nodeById.get(node.parentId)?.level ?? null : null;
      const validParent = node.level === "domain"
        ? node.parentId === null
        : node.level === "category"
          ? parentLevel === "domain"
          : parentLevel === "category";
      if (!validParent) invalidHierarchyRelations.push({ code: node.code, level: node.level, parentLevel });
    }
    const linksByItem = new Map<string, typeof categoryLinks>();
    const lifecyclesByItem = new Map<string, typeof lifecycleRules>();
    const safetyByItem = new Map<string, typeof safetyRules>();
    const evidenceByItem = new Map<string, typeof evidenceSources>();
    const mappingsByItem = new Map<string, typeof expenseMappings>();
    const offersByItem = new Map<string, typeof offers>();
    for (const link of categoryLinks) linksByItem.set(link.itemDefinitionId, [...(linksByItem.get(link.itemDefinitionId) ?? []), link]);
    for (const rule of lifecycleRules) lifecyclesByItem.set(rule.itemDefinitionId, [...(lifecyclesByItem.get(rule.itemDefinitionId) ?? []), rule]);
    for (const rule of safetyRules) safetyByItem.set(rule.itemDefinitionId, [...(safetyByItem.get(rule.itemDefinitionId) ?? []), rule]);
    for (const source of evidenceSources) evidenceByItem.set(source.itemDefinitionId, [...(evidenceByItem.get(source.itemDefinitionId) ?? []), source]);
    for (const mapping of expenseMappings) mappingsByItem.set(mapping.itemDefinitionId, [...(mappingsByItem.get(mapping.itemDefinitionId) ?? []), mapping]);
    for (const offer of offers) offersByItem.set(offer.itemDefinitionId, [...(offersByItem.get(offer.itemDefinitionId) ?? []), offer]);

    const duplicateNames = [...definitions.reduce((groups, item) => {
      const key = normalizedTerm(item.nameKo);
      groups.set(key, [...(groups.get(key) ?? []), item.code]);
      return groups;
    }, new Map<string, string[]>())]
      .filter(([, codes]) => codes.length > 1)
      .map(([normalizedName, itemCodes]) => ({ normalizedName, itemCodes }));
    const aliasCollisions = [...synonyms.reduce((groups, synonym) => {
      groups.set(synonym.normalizedSynonym, new Set([...(groups.get(synonym.normalizedSynonym) ?? []), synonym.itemDefinitionId]));
      return groups;
    }, new Map<string, Set<string>>())]
      .filter(([, ids]) => ids.size > 1)
      .map(([normalizedAlias, ids]) => ({ normalizedAlias, itemIds: [...ids] }));

    const missingRequiredMetadata = definitions.flatMap((item) => {
      const primaryLinks = (linksByItem.get(item.id) ?? []).filter((link) => link.isPrimary);
      const missing = [
        !item.nameKo.trim() && "nameKo",
        !item.shortDescription.trim() && "shortDescription",
        !item.reasonText.trim() && "reasonText",
        !item.timingSummary.trim() && "timingSummary",
        !item.sourceSummary.trim() && "sourceSummary",
        item.contentVersion < 1 && "contentVersion",
        primaryLinks.length !== 1 && "primaryCategory",
        (lifecyclesByItem.get(item.id) ?? []).length === 0 && "lifecycle",
        (evidenceByItem.get(item.id) ?? []).length === 0 && "evidenceSource",
        (mappingsByItem.get(item.id) ?? []).filter((mapping) => mapping.isDefault).length !== 1 && "defaultExpenseCategory"
      ].filter((field): field is string => Boolean(field));
      return missing.length ? [{ code: item.code, fields: missing }] : [];
    });

    const publishedMissingRequiredMetadata = missingRequiredMetadata.filter(({ code }) =>
      definitions.some((item) => item.code === code && item.status === "published")
    );
    const unsafePublishedItems = definitions.flatMap((item) => {
      if (item.status !== "published" || item.safetyTier !== "high") return [];
      const highRules = (safetyByItem.get(item.id) ?? []).filter((rule) => rule.severity === "high");
      const safe = Boolean(
        item.reviewedAt &&
        item.reviewedByAdminId &&
        highRules.length &&
        highRules.every((rule) => rule.reviewedAt) &&
        (evidenceByItem.get(item.id) ?? []).length
      );
      return safe ? [] : [item.code];
    });

    const lifecycleCounts = countBy(lifecycleRules.map((rule) => `${rule.axis}:${rule.lifecycleCode}`));
    const expectedLifecycleKeys = [
      ...motherLifecycleCodes.map((code) => `mother:${code}`),
      ...childLifecycleCodes.map((code) => `child:${code}`)
    ];
    const lifecycleGaps = expectedLifecycleKeys.filter((key) => !lifecycleCounts[key]);
    const domainNodes = nodes.filter((node) => node.level === "domain" && node.active);
    const itemCountByTopCategory = Object.fromEntries(domainNodes.map((node) => [node.code, 0]));
    for (const item of definitions) {
      const domainLink = (linksByItem.get(item.id) ?? []).find((link) => nodeById.get(link.catalogNodeId)?.level === "domain");
      if (domainLink) {
        const code = nodeById.get(domainLink.catalogNodeId)!.code;
        itemCountByTopCategory[code] = (itemCountByTopCategory[code] ?? 0) + 1;
      }
    }
    const topCategoryGaps = Object.entries(itemCountByTopCategory).filter(([, count]) => count === 0).map(([code]) => code);
    const primaryOtherItems = definitions.flatMap((item) => {
      const primary = (linksByItem.get(item.id) ?? []).find((link) => link.isPrimary);
      const node = primary ? nodeById.get(primary.catalogNodeId) : undefined;
      return node && /기타/.test(node.nameKo) ? [item.code] : [];
    });
    const scenarioCounts = countBy(contextRules.map((rule) => rule.contextCode));
    const scenarioGaps = catalogScenarioCodes.filter((code) => !scenarioCounts[code]);
    const orphanCount =
      nodes.filter((node) => node.parentId && !nodeIdSet.has(node.parentId)).length +
      categoryLinks.filter((link) => !itemIdSet.has(link.itemDefinitionId) || !nodeIdSet.has(link.catalogNodeId)).length +
      lifecycleRules.filter((rule) => !itemIdSet.has(rule.itemDefinitionId)).length +
      contextRules.filter((rule) => !itemIdSet.has(rule.itemDefinitionId)).length +
      synonyms.filter((synonym) => !itemIdSet.has(synonym.itemDefinitionId)).length +
      safetyRules.filter((rule) => !itemIdSet.has(rule.itemDefinitionId)).length +
      evidenceSources.filter((source) => !itemIdSet.has(source.itemDefinitionId)).length +
      expenseMappings.filter((mapping) => !itemIdSet.has(mapping.itemDefinitionId)).length +
      offers.filter((offer) => !itemIdSet.has(offer.itemDefinitionId)).length;

    const statusCounts = countBy(definitions.map((item) => item.status));
    const publishedCount = statusCounts.published ?? 0;
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      database: "DATABASE_URL target (credentials redacted)",
      counts: {
        catalogNodesByDepth: countBy(nodes.filter((node) => node.active).map((node) => node.level)),
        canonicalItems: definitions.length,
        statuses: statusCounts,
        publishedContentPercentage: definitions.length ? Math.round((publishedCount / definitions.length) * 10000) / 100 : 0,
        aliases: synonyms.length,
        evidenceSources: evidenceSources.length,
        itemsWithEvidence: definitions.filter((item) => (evidenceByItem.get(item.id)?.length ?? 0) > 0).length,
        evidenceSourceStatuses: countBy(evidenceSources.map((source) => source.status)),
        independentlyCapturedAndReviewedEvidenceSources: evidenceSources.filter((source) =>
          Boolean(
            source.capturedByAdminId &&
            source.reviewedByAdminId &&
            source.capturedByAdminId !== source.reviewedByAdminId
          )
        ).length,
        productOffers: offers.length,
        itemsWithoutOffers: definitions.filter((item) => !(offersByItem.get(item.id)?.length)).length,
        highRiskItems: definitions.filter((item) => item.safetyTier === "high").length,
        contextRules: contextRules.length,
        distinctContextCodes: new Set(contextRules.map((rule) => rule.contextCode)).size,
        coverageDecisionStates: countBy(coverageDecisions.map((decision) => decision.state)),
        coverageApplicability: countBy(coverageDecisions.map((decision) => decision.applicability)),
        coverageGapTypes: countBy(coverageDecisions.filter((decision) => decision.gapType).map((decision) => decision.gapType!)),
        coverageUnclassifiedApplicability: coverageDecisions.filter((decision) => !decision.applicability).length,
        coverageExternalReviewBlockers: coverageDecisions.filter((decision) => decision.applicability === "review_needed").length
      },
      coverage: {
        itemCountByLifecycle: lifecycleCounts,
        lifecycleGaps,
        itemCountByTopCategory,
        topCategoryGaps,
        itemCountByScenario: scenarioCounts,
        scenarioGaps
      },
      integrity: {
        orphanCount,
        taxonomyCycleCodes: [...taxonomyCycleCodes].sort(),
        invalidHierarchyRelations,
        duplicateCanonicalNames: duplicateNames,
        aliasCollisions,
        primaryOtherItems,
        missingRequiredMetadata,
        publishedMissingRequiredMetadata,
        unsafePublishedItems
      },
      gates: {
        structuralCompleteness:
          domainNodes.length >= 24 &&
          nodes.filter((node) => node.level === "category" && node.active).length >= 100 &&
          nodes.filter((node) => node.level === "subcategory" && node.active).length >= 300 &&
          definitions.length >= 400 &&
          synonyms.length >= 3000 &&
          lifecycleGaps.length === 0 &&
          topCategoryGaps.length === 0 &&
          scenarioGaps.length === 0 &&
          orphanCount === 0 &&
          taxonomyCycleCodes.size === 0 &&
          invalidHierarchyRelations.length === 0 &&
          duplicateNames.length === 0 &&
          aliasCollisions.length === 0 &&
          primaryOtherItems.length === 0 &&
          missingRequiredMetadata.length === 0 &&
          unsafePublishedItems.length === 0,
        publishedContentReady: publishedCount > 0 && (statusCounts.in_review ?? 0) === 0 && (statusCounts.draft ?? 0) === 0,
        scenarioPersonalizationReady: scenarioGaps.length === 0
      }
    };

    const output = requestedOutput("docs/qa/evidence/release4-catalog-audit.json");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output, ...report.counts, ...report.gates }, null, 2));
    if (!report.gates.structuralCompleteness) process.exitCode = 1;
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

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
  result.errors.push(...validateRelease4Catalog());
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  const release4 = release4CatalogMetrics();
  console.log(`Catalog valid: legacy=${result.uniqueItemCount}, release4=${release4.canonicalItems}, aliases=${release4.aliases}`);
  return result;
}

function printCoverage() {
  const coverage = catalogCoverage();
  const release4 = release4CatalogMetrics();
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
  console.log(`release4.domains: ${release4.domains}`);
  console.log(`release4.categories: ${release4.categories}`);
  console.log(`release4.subcategories: ${release4.subcategories}`);
  console.log(`release4.canonicalItems: ${release4.canonicalItems}`);
  console.log(`release4.aliases: ${release4.aliases}`);
  console.log(`release4.highRiskAwaitingProfessionalReview: ${release4.highRiskItemsAwaitingProfessionalReview}`);
  console.log(`release4.lifecycleGaps: ${release4.lifecycleGaps.length}`);
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
  else if (command === "audit") await auditCatalogDatabase();
  else if (command === "coverage") {
    validate();
    printCoverage();
  } else if (command === "import") await importCatalog();
  else throw new Error(`Unknown catalog command: ${command}`);
}

void main();
