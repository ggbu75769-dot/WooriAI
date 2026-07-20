import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const evidenceRoot = `${workspaceRoot}/docs/qa/evidence`;
const reportRoot = `${workspaceRoot}/docs/5차`;

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function groupByItem<T extends { itemDefinitionId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(row.itemDefinitionId, [...(grouped.get(row.itemDefinitionId) ?? []), row]);
  return grouped;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot, encoding: "utf8" }).trim();
  const baseItems = await prisma.itemDefinition.findMany({
    where: { code: { startsWith: "R4-" } },
    orderBy: { code: "asc" }
  });
  const itemIds = baseItems.map((item) => item.id);
  const [categoryRows, nodes, lifecycleRows, contextRows, synonymRows, safetyRows, evidenceRows, approvalRows] = await Promise.all([
    prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { displayOrder: "asc" } }),
    prisma.catalogNode.findMany(),
    prisma.itemLifecycleRule.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: [{ axis: "asc" }, { priorityWeight: "desc" }] }),
    prisma.itemContextRule.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { contextCode: "asc" } }),
    prisma.itemSynonym.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { synonym: "asc" } }),
    prisma.itemSafetyRule.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { ruleCode: "asc" } }),
    prisma.itemEvidenceSource.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { createdAt: "asc" } }),
    prisma.catalogItemApproval.findMany({ where: { itemDefinitionId: { in: itemIds } }, orderBy: { createdAt: "asc" } })
  ]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const categoriesByItem = groupByItem(categoryRows);
  const lifecyclesByItem = groupByItem(lifecycleRows);
  const contextsByItem = groupByItem(contextRows);
  const synonymsByItem = groupByItem(synonymRows);
  const safetyByItem = groupByItem(safetyRows);
  const evidenceByItem = groupByItem(evidenceRows);
  const approvalsByItem = groupByItem(approvalRows);
  const items = baseItems.map((item) => ({
    ...item,
    categories: (categoriesByItem.get(item.id) ?? []).map((mapping) => ({ ...mapping, catalogNode: nodeById.get(mapping.catalogNodeId)! })),
    lifecycleRules: lifecyclesByItem.get(item.id) ?? [],
    contextRules: contextsByItem.get(item.id) ?? [],
    synonyms: synonymsByItem.get(item.id) ?? [],
    safetyRules: safetyByItem.get(item.id) ?? [],
    evidenceSources: evidenceByItem.get(item.id) ?? [],
    approvals: approvalsByItem.get(item.id) ?? []
  }));
  const nameOwners = new Map<string, string[]>();
  const aliasOwners = new Map<string, Set<string>>();
  for (const item of items) {
    const nameKey = normalized(item.nameKo);
    nameOwners.set(nameKey, [...(nameOwners.get(nameKey) ?? []), item.id]);
    for (const alias of item.synonyms) {
      const key = normalized(alias.synonym);
      const owners = aliasOwners.get(key) ?? new Set<string>();
      owners.add(item.id);
      aliasOwners.set(key, owners);
    }
  }

  const inventory = items.map((item) => {
    const requiredMetadata = [item.nameKo, item.shortDescription, item.reasonText, item.timingSummary, item.sourceSummary];
    const metadataComplete = requiredMetadata.every((value) => Boolean(value?.trim()));
    const structurallyValid = metadataComplete && item.categories.length > 0 && item.lifecycleRules.length > 0 && item.contextRules.length > 0;
    const currentApprovals = item.contentHash
      ? item.approvals.filter((approval) => approval.revision === item.contentVersion && approval.contentHash === item.contentHash && (!approval.expiresAt || approval.expiresAt > new Date()))
      : [];
    const editorialApproved = currentApprovals.some((approval) => approval.approvalType === "editorial");
    const domainApproved = currentApprovals.some((approval) => approval.approvalType === "domain");
    const safetyApproved = item.safetyTier !== "high" || currentApprovals.some((approval) => approval.approvalType === "safety");
    const sourceReady = item.evidenceSources.length > 0;
    const duplicateSuspicion = (nameOwners.get(normalized(item.nameKo))?.length ?? 0) > 1 || item.synonyms.some((alias) => (aliasOwners.get(normalized(alias.synonym))?.size ?? 0) > 1);
    const blockers = [
      ...(!structurallyValid ? ["STRUCTURE_OR_METADATA_INCOMPLETE"] : []),
      ...(!item.contentHash ? ["REVISION_HASH_NOT_ESTABLISHED"] : []),
      ...(!sourceReady ? ["SOURCE_EVIDENCE_REVIEW_REQUIRED"] : []),
      ...(!editorialApproved ? ["EDITORIAL_APPROVAL_REQUIRED"] : []),
      ...(!domainApproved ? ["DOMAIN_APPROVAL_REQUIRED"] : []),
      ...(!safetyApproved ? ["EXTERNAL_SAFETY_APPROVAL_REQUIRED"] : []),
      ...(duplicateSuspicion ? ["DUPLICATE_REVIEW_REQUIRED"] : [])
    ];
    return {
      id: item.id,
      code: item.code,
      nameKo: item.nameKo,
      revision: item.contentVersion,
      contentHash: item.contentHash,
      status: item.status,
      risk: item.safetyTier,
      audience: item.targetSubject,
      lifecycle: item.lifecycleRules.map((rule) => ({ axis: rule.axis, code: rule.lifecycleCode, timingText: rule.timingText, priorityWeight: rule.priorityWeight })),
      category: item.categories.map((mapping) => ({ code: mapping.catalogNode.code, nameKo: mapping.catalogNode.nameKo, level: mapping.catalogNode.level, primary: mapping.isPrimary })),
      contextCodes: item.contextRules.map((rule) => rule.contextCode),
      sourceReadiness: sourceReady ? "evidence_attached_review_required" : item.sourceSummary ? "summary_only_review_required" : "missing",
      editorialReadiness: metadataComplete ? editorialApproved ? "approved" : "content_complete_review_required" : "missing_metadata",
      domainReadiness: domainApproved ? "approved" : "review_required",
      safetyReadiness: item.safetyTier === "high" ? safetyApproved ? "approved" : "external_review_required" : "not_required",
      duplicateSuspicion,
      structurallyValid,
      publishBlockers: blockers
    };
  });
  const inventorySummary = {
    total: inventory.length,
    structurallyValid: inventory.filter((item) => item.structurallyValid).length,
    editorialContentComplete: inventory.filter((item) => item.editorialReadiness !== "missing_metadata").length,
    sourceEvidenceAttached: inventory.filter((item) => item.sourceReadiness === "evidence_attached_review_required").length,
    domainApproved: inventory.filter((item) => item.domainReadiness === "approved").length,
    safetyApprovedOrNotRequired: inventory.filter((item) => item.safetyReadiness !== "external_review_required").length,
    approved: inventory.filter((item) => item.status === "approved" || item.status === "scheduled" || item.status === "published").length,
    published: inventory.filter((item) => item.status === "published").length,
    highRisk: inventory.filter((item) => item.risk === "high").length,
    duplicateSuspicion: inventory.filter((item) => item.duplicateSuspicion).length,
    status: countBy(inventory.map((item) => item.status)),
    risk: countBy(inventory.map((item) => item.risk))
  };

  const coverageRows = await prisma.catalogCoverageDecision.findMany({
    orderBy: [{ lifecycleAxis: "asc" }, { lifecycleCode: "asc" }, { necessity: "asc" }]
  });
  const coverage = coverageRows.map((row) => ({
    id: row.id,
    domain: { code: nodeById.get(row.domainNodeId)?.code ?? "unknown", nameKo: nodeById.get(row.domainNodeId)?.nameKo ?? "unknown" },
    lifecycleAxis: row.lifecycleAxis,
    lifecycleCode: row.lifecycleCode,
    contextCode: row.contextCode,
    necessity: row.necessity,
    state: row.state,
    applicability: row.applicability,
    gapType: row.gapType,
    reason: row.reason,
    externalReviewBlocked: row.applicability === "review_needed"
  }));
  const coverageSummary = {
    total: coverage.length,
    state: countBy(coverage.map((row) => row.state)),
    applicability: countBy(coverage.map((row) => row.applicability)),
    gapType: countBy(coverage.filter((row) => row.gapType).map((row) => row.gapType!)),
    unclassified: coverage.filter((row) => !row.applicability).length,
    criticalRequiredGaps: coverage.filter((row) => row.state === "gap" && row.necessity === "required").length,
    criticalRequiredExternalReviewBlocked: coverage.filter((row) => row.state === "gap" && row.necessity === "required" && row.externalReviewBlocked).length
  };

  mkdirSync(evidenceRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });
  writeFileSync(`${evidenceRoot}/release4c-catalog-review-inventory.json`, `${JSON.stringify({ schemaVersion: 1, generatedAt, sourceHead, summary: inventorySummary, items: inventory }, null, 2)}\n`, "utf8");
  writeFileSync(`${evidenceRoot}/release4c-coverage-matrix.json`, `${JSON.stringify({ schemaVersion: 1, generatedAt, sourceHead, summary: coverageSummary, cells: coverage }, null, 2)}\n`, "utf8");
  writeFileSync(`${reportRoot}/release4c-catalog-review-worklist.md`, `# Release 4C catalog review worklist\n\nGenerated: ${generatedAt}\n\n- Inventory: ${inventorySummary.total}/408 classified\n- Structurally valid: ${inventorySummary.structurallyValid}\n- Editorial content complete but approval still required: ${inventorySummary.editorialContentComplete}\n- Source evidence attached, still requiring review: ${inventorySummary.sourceEvidenceAttached}\n- Domain approved: ${inventorySummary.domainApproved}\n- High risk: ${inventorySummary.highRisk}\n- Approved: ${inventorySummary.approved}\n- Published: ${inventorySummary.published}\n\nNo item was approved or published by this evidence generator. The machine-readable worklist is \`docs/qa/evidence/release4c-catalog-review-inventory.json\`.\n`, "utf8");
  writeFileSync(`${reportRoot}/release4c-coverage-applicability.md`, `# Release 4C coverage applicability\n\nGenerated: ${generatedAt}\n\n- Coverage cells: ${coverageSummary.total}\n- Covered: ${coverageSummary.state.covered ?? 0}\n- Gaps: ${coverageSummary.state.gap ?? 0}\n- Unclassified applicability: ${coverageSummary.unclassified}\n- Review needed: ${coverageSummary.applicability.review_needed ?? 0}\n- Critical required gaps: ${coverageSummary.criticalRequiredGaps}\n- Critical required gaps explicitly external-review blocked: ${coverageSummary.criticalRequiredExternalReviewBlocked}\n\n\`review_needed\` is a deliberate fail-closed applicability classification, not an approval. No synthetic canonical items or unsupported \`not_applicable\` decisions were created to reduce the gap count.\n`, "utf8");
  console.log(JSON.stringify({ inventory: inventorySummary, coverage: coverageSummary }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
