import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CatalogNodeLevel, CatalogReviewStatus, ItemDefinition, Prisma, UserItemPlan, UserItemPlanState } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import {
  buildPreparationRecommendationReason,
  calculatePreparationLifecycle,
  catalogScenarioCodes,
  childLifecycleCodes,
  comparePreparationTimelineRank,
  isDuplicatePurchaseRisk,
  preparationDateKeyKst,
  preparationDueEvents,
  motherLifecycleCodes,
  type CatalogScenarioCode,
  type ChildStageCode,
  type PreparationTimelineRankInput,
  type Release4LifecycleCode
} from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { isDomainAllowed } from "../items-commerce/affiliate-link-guard.util";
import type { AdminListCatalogItemsDto, ApplyCatalogBundleDto, ApplyCatalogImportDto, ApproveProductOfferDto, ArchiveCatalogNodeDto, BulkItemPlanEntryDto, CatalogNodeReorderDto, CreateCatalogNodeDto, CreateItemPlanCommentDto, CreateProductOfferDto, ListCatalogItemsDto, PreviewCatalogApprovalManifestDto, PreviewCatalogImportDto, PublishCatalogItemDto, ReplaceCatalogAliasesDto, ReplaceCatalogMappingsDto, RequestCatalogItemReviewDto, ResolveCatalogItemReportsDto, ReviewCatalogItemDto, RollbackCatalogItemDto, TransitionCatalogItemDto, UpdateCatalogItemDraftDto, UpdateCatalogNodeDto, UpdateItemPlanDto, UpdatePreparationContextDto } from "./dto/catalog-v2.dto";

const RELEASE4_ITEM_PREFIX = "R4-";
const PREPARATION_CONTEXT_EXCLUSIVE_GROUPS = [
  ["first_child", "second_or_later"],
  ["vaginal_delivery", "cesarean_delivery"],
  ["breastfeeding", "formula_feeding", "mixed_feeding"],
  ["daycare", "kindergarten", "school"],
  ["car_primary", "no_car"],
  ["car_primary", "public_transport_primary"],
  ["summer_birth", "winter_birth"]
] as const;
const CATALOG_IMPORT_FIELDS = {
  nameKo: { min: 1, max: 120 },
  shortDescription: { min: 1, max: 240 },
  reasonText: { min: 1, max: 5000 },
  timingSummary: { min: 1, max: 240 },
  sourceSummary: { min: 1, max: 5000 }
} as const;

type CatalogImportField = keyof typeof CATALOG_IMPORT_FIELDS;
type CatalogImportChanges = Partial<Record<CatalogImportField, string>>;
type CatalogImportPreviewRow = {
  rowNumber: number;
  code: string;
  valid: boolean;
  errors: string[];
  changes: CatalogImportChanges;
  expectedVersion?: number;
  contentHash?: string;
  expectedStatus?: CatalogReviewStatus;
};
type CatalogImportPreview = {
  schemaVersion: 1;
  mode: "existing-item-editorial-update";
  summary: { total: number; valid: number; invalid: number };
  rows: CatalogImportPreviewRow[];
  appliedRowNumbers?: number[];
};
type CatalogApprovalManifestPreviewRow = PreviewCatalogApprovalManifestDto["entries"][number] & {
  rowNumber: number;
  itemId?: string;
  valid: boolean;
  errors: string[];
};
type CatalogApprovalManifestPreview = {
  schemaVersion: 1;
  kind: "catalog-approval-manifest";
  manifestId: string;
  reviewerEmail: string;
  issuedAt: string;
  expiresAt: string;
  summary: { total: number; valid: number; invalid: number };
  rows: CatalogApprovalManifestPreviewRow[];
  applyResult?: CatalogApprovalManifestApplyResult;
};
type CatalogApprovalManifestApplyResult = {
  idempotent: boolean;
  applied: number;
  failed: number;
  results: Array<{ rowNumber: number; itemCode: string; outcome: "approved" | "changes_requested" | "failed"; resultingStatus?: CatalogReviewStatus; code?: string }>;
};
type CatalogNodeDb = Pick<Prisma.TransactionClient, "catalogNode" | "itemDefinitionCategory" | "catalogCoverageDecision">;
type CatalogRevisionPayload = {
  item: {
    code: string; nameKo: string; shortDescription: string; targetSubject: ItemDefinition["targetSubject"];
    necessity: ItemDefinition["necessity"]; recommendationState: ItemDefinition["recommendationState"];
    reasonText: string; skipReasonText: string | null; quantityGuidance: string | null; timingSummary: string;
    priceMinKrw: number | null; priceMaxKrw: number | null; priceCheckedAt: string | null;
    secondhandPolicy: ItemDefinition["secondhandPolicy"]; rentalPolicy: ItemDefinition["rentalPolicy"];
    safetyTier: ItemDefinition["safetyTier"]; safetyNote: string | null; medicalDisclaimerRequired: boolean;
    sourceSummary: string; displayOrder: number;
  };
  aliases: Array<{ synonym: string; normalizedSynonym: string }>;
  categories: Array<{ catalogNodeId: string; isPrimary: boolean; displayOrder: number }>;
  lifecycles: Array<{ axis: "mother" | "child"; lifecycleCode: string; timingText: string | null; priorityWeight: number }>;
  contexts: Array<{ contextCode: string; weight: number; required: boolean }>;
  safetyRules: Array<{ ruleCode: string; severity: ItemDefinition["safetyTier"]; guidanceText: string; blocksRecommendation: boolean }>;
  sources: Array<{ sourceType: string; title: string; publicUrl: string; publisher: string | null; publishedAt: string | null; checkedAt: string }>;
};

function isUniqueConstraintViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN_ERROR";
  const response = (error as { response?: unknown }).response;
  if (response && typeof response === "object" && typeof (response as { code?: unknown }).code === "string") return (response as { code: string }).code;
  if (typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
  return "UNKNOWN_ERROR";
}

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

const KOREAN_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;

function koreanInitials(value: string) {
  return [...value.normalize("NFC")].map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11_172 ? KOREAN_INITIALS[Math.floor(code / 588)] : char;
  }).join("").replace(/[\s\p{P}\p{S}]/gu, "").toLocaleLowerCase("ko-KR");
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(current[rightIndex - 1]! + 1, previous[rightIndex]! + 1, previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length]!;
}

function commonPrefixLength(left: string, right: string) {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
  return length;
}

type CatalogSearchMatch = { score: number; reason: "canonical_exact" | "canonical_prefix" | "alias_exact" | "alias_contains" | "initials" | "typo" | "category"; matchedText: string };

type ComparisonField = { key: string; labelKo: string; valueType: "text" | "number" };

function comparisonSchema(nameKo: string): { schemaCode: string | null; fields: ComparisonField[] } {
  if (nameKo.includes("카시트")) return { schemaCode: "car_seat_v1", fields: [
    { key: "usageDirection", labelKo: "사용 방향", valueType: "text" },
    { key: "maxWeightKg", labelKo: "허용 체중(kg)", valueType: "number" },
    { key: "maxHeightCm", labelKo: "허용 신장(cm)", valueType: "number" },
    { key: "installationType", labelKo: "차량 설치 방식", valueType: "text" }
  ] };
  if (nameKo.includes("유모차")) return { schemaCode: "stroller_v1", fields: [
    { key: "weightKg", labelKo: "무게(kg)", valueType: "number" },
    { key: "foldedDimensions", labelKo: "접은 크기", valueType: "text" },
    { key: "usageRange", labelKo: "사용 범위", valueType: "text" }
  ] };
  if (nameKo.includes("젖병")) return { schemaCode: "bottle_v1", fields: [
    { key: "capacityMl", labelKo: "용량(ml)", valueType: "number" },
    { key: "material", labelKo: "소재", valueType: "text" },
    { key: "compatibility", labelKo: "호환 정보", valueType: "text" }
  ] };
  return { schemaCode: null, fields: [] };
}

function legacyEditorialHash(item: ItemDefinition) {
  const payload = {
    code: item.code,
    nameKo: item.nameKo,
    shortDescription: item.shortDescription,
    targetSubject: item.targetSubject,
    necessity: item.necessity,
    recommendationState: item.recommendationState,
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText,
    quantityGuidance: item.quantityGuidance,
    timingSummary: item.timingSummary,
    priceMinKrw: item.priceMinKrw,
    priceMaxKrw: item.priceMaxKrw,
    priceCheckedAt: item.priceCheckedAt,
    secondhandPolicy: item.secondhandPolicy,
    rentalPolicy: item.rentalPolicy,
    safetyTier: item.safetyTier,
    safetyNote: item.safetyNote,
    medicalDisclaimerRequired: item.medicalDisclaimerRequired,
    sourceSummary: item.sourceSummary,
    displayOrder: item.displayOrder
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function csvCell(value: string) {
  const formulaSafe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

function planDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function compactJson(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Prisma.InputJsonObject;
}

function kstDateOnly(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function dateOnlyUtc(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

@Injectable()
export class CatalogV2Service {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private visibleStatuses(): CatalogReviewStatus[] {
    const internalPreview = process.env.NODE_ENV !== "production" && process.env.CATALOG_INTERNAL_PREVIEW_ENABLED === "1";
    return internalPreview
      ? ["draft", "review_requested", "editorial_review", "domain_review", "safety_review", "changes_requested", "approved", "scheduled", "in_review", "published"]
      : ["published"];
  }

  private requireHousehold(user: AuthenticatedUser, householdId: string) {
    const membership = user.households.find((household) => household.id === householdId);
    if (!membership) {
      throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "Household access is required." });
    }
    return membership;
  }

  private requirePlanReader(user: AuthenticatedUser, householdId: string) {
    const membership = this.requireHousehold(user, householdId);
    if (membership.role === "gift_participant") {
      throw new ForbiddenException({ code: "ITEM_PLAN_PRIVATE", message: "Preparation details are not available to gift participants." });
    }
    return membership;
  }

  private requirePlanEditor(user: AuthenticatedUser, householdId: string) {
    const membership = this.requireHousehold(user, householdId);
    if (membership.role !== "owner" && membership.role !== "co_parent") {
      throw new ForbiddenException({ code: "ITEM_PLAN_EDIT_FORBIDDEN", message: "Owner or co-parent access is required." });
    }
    return membership;
  }

  private async requireChild(user: AuthenticatedUser, childId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, householdId: true, deletedAt: true }
    });
    if (!child || child.deletedAt) throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Child not found." });
    this.requireHousehold(user, child.householdId);
    return child;
  }

  private async requireMotherProfile(user: AuthenticatedUser, motherProfileId: string) {
    const profile = await this.prisma.motherProfile.findUnique({
      where: { id: motherProfileId },
      select: { id: true, householdId: true, childId: true, dueDate: true, active: true }
    });
    if (!profile || !profile.active) throw new NotFoundException({ code: "MOTHER_PROFILE_NOT_FOUND", message: "Mother profile not found." });
    this.requireHousehold(user, profile.householdId);
    return profile;
  }

  private async requirePlanScope(user: AuthenticatedUser, scope: { childId?: string; motherProfileId?: string }) {
    if (Boolean(scope.childId) === Boolean(scope.motherProfileId)) {
      throw new BadRequestException({ code: "ITEM_PLAN_CONTEXT_INVALID", message: "Choose exactly one child or maternal context." });
    }
    if (scope.childId) {
      const child = await this.requireChild(user, scope.childId);
      return { householdId: child.householdId, childId: child.id, motherProfileId: null } as const;
    }
    const profile = await this.requireMotherProfile(user, scope.motherProfileId!);
    return { householdId: profile.householdId, childId: null, motherProfileId: profile.id } as const;
  }

  private async planSummaryVisibility(user: AuthenticatedUser, context: { childId?: string; motherProfileId?: string }) {
    if (!context.childId && !context.motherProfileId) return "none" as const;
    const scope = await this.requirePlanScope(user, context);
    const membership = this.requireHousehold(user, scope.householdId);
    return membership.role === "gift_participant"
      ? "gift" as const
      : membership.role === "viewer"
        ? "viewer" as const
        : "full" as const;
  }

  async contexts(user: AuthenticatedUser) {
    const householdIds = user.households.map((household) => household.id);
    const profiles = await this.prisma.motherProfile.findMany({
      where: { householdId: { in: householdIds }, active: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { id: true, householdId: true, childId: true, dueDate: true, active: true }
    });
    return { motherProfiles: profiles.map((profile) => ({ ...profile, dueDate: profile.dueDate?.toISOString().slice(0, 10) ?? null })) };
  }

  private preparationScopeKey(scope: { childId: string | null; motherProfileId: string | null }) {
    return scope.childId ? `child:${scope.childId}` : `mother:${scope.motherProfileId}`;
  }

  async preparationContext(user: AuthenticatedUser, context: { childId?: string; motherProfileId?: string }) {
    const scope = await this.requirePlanScope(user, context);
    this.requirePlanReader(user, scope.householdId);
    const profile = await this.prisma.preparationContextProfile.findUnique({
      where: { householdId_scopeKey: { householdId: scope.householdId, scopeKey: this.preparationScopeKey(scope) } }
    });
    return {
      childId: scope.childId,
      motherProfileId: scope.motherProfileId,
      contextCodes: profile?.contextCodes ?? [],
      availableContextCodes: catalogScenarioCodes,
      version: profile?.version ?? 0,
      updatedAt: profile?.updatedAt.toISOString() ?? null
    };
  }

  async updatePreparationContext(
    user: AuthenticatedUser,
    context: { childId?: string; motherProfileId?: string },
    input: UpdatePreparationContextDto
  ) {
    const scope = await this.requirePlanScope(user, context);
    this.requirePlanEditor(user, scope.householdId);
    const scopeKey = this.preparationScopeKey(scope);
    const contextCodes = [...new Set(input.contextCodes)].sort();
    const contradictoryGroup = PREPARATION_CONTEXT_EXCLUSIVE_GROUPS.find((group) => group.filter((code) => contextCodes.includes(code)).length > 1);
    if (contradictoryGroup) {
      throw new BadRequestException({ code: "PREPARATION_CONTEXT_CONTRADICTORY", message: `Choose only one of: ${contradictoryGroup.join(", ")}.` });
    }
    const existing = await this.prisma.preparationContextProfile.findUnique({
      where: { householdId_scopeKey: { householdId: scope.householdId, scopeKey } }
    });
    if (!existing) {
      if (input.expectedVersion !== undefined && input.expectedVersion !== 0) {
        throw new ConflictException({ code: "PREPARATION_CONTEXT_STALE", message: "Preparation context changed. Reload and try again." });
      }
      try {
        return await this.prisma.preparationContextProfile.create({
          data: {
            householdId: scope.householdId,
            scopeKey,
            childId: scope.childId,
            motherProfileId: scope.motherProfileId,
            contextCodes,
            updatedByUserId: user.id
          }
        });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
          throw new ConflictException({ code: "PREPARATION_CONTEXT_STALE", message: "Preparation context changed. Reload and try again." });
        }
        throw error;
      }
    }
    if (input.expectedVersion !== existing.version) {
      throw new ConflictException({ code: "PREPARATION_CONTEXT_STALE", message: "Preparation context changed. Reload and try again." });
    }
    const updated = await this.prisma.preparationContextProfile.updateMany({
      where: { id: existing.id, version: existing.version },
      data: { contextCodes, updatedByUserId: user.id, version: { increment: 1 }, updatedAt: new Date() }
    });
    if (updated.count !== 1) {
      throw new ConflictException({ code: "PREPARATION_CONTEXT_STALE", message: "Preparation context changed. Reload and try again." });
    }
    return this.prisma.preparationContextProfile.findUniqueOrThrow({ where: { id: existing.id } });
  }

  async domains() {
    const nodes = await this.prisma.catalogNode.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }]
    });
    const childrenByParent = new Map<string, typeof nodes>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      childrenByParent.set(node.parentId, [...(childrenByParent.get(node.parentId) ?? []), node]);
    }
    return {
      domains: nodes.filter((node) => node.level === "domain").map((domain) => ({
        ...domain,
        children: (childrenByParent.get(domain.id) ?? []).map((category) => ({
          ...category,
          children: childrenByParent.get(category.id) ?? []
        }))
      }))
    };
  }

  private async filteredItemIds(user: AuthenticatedUser, query: ListCatalogItemsDto, searchIds?: string[]): Promise<string[] | null> {
    const filters: string[][] = [];
    if (query.childId && query.motherProfileId) {
      throw new BadRequestException({ code: "CATALOG_CONTEXT_AMBIGUOUS", message: "Choose a child or maternal context, not both." });
    }
    if (query.childId) await this.requireChild(user, query.childId);
    if (query.motherProfileId) await this.requireMotherProfile(user, query.motherProfileId);
    const planVisibility = await this.planSummaryVisibility(user, query);
    if (planVisibility === "gift") {
      const sharedPlans = await this.prisma.userItemPlan.findMany({
        where: { childId: query.childId ?? null, motherProfileId: query.motherProfileId ?? null, state: "gift_expected" },
        select: { itemDefinitionId: true }
      });
      filters.push(sharedPlans.map((plan) => plan.itemDefinitionId));
    }
    if (query.domainCode) {
      const domain = await this.prisma.catalogNode.findUnique({ where: { code: query.domainCode }, select: { id: true } });
      if (!domain) return [];
      const rows = await this.prisma.itemDefinitionCategory.findMany({
        where: { catalogNodeId: domain.id }, select: { itemDefinitionId: true }
      });
      filters.push(rows.map((row) => row.itemDefinitionId));
    }
    if (query.lifecycleAxis || query.lifecycleCode) {
      const rows = await this.prisma.itemLifecycleRule.findMany({
        where: {
          ...(query.lifecycleAxis ? { axis: query.lifecycleAxis } : {}),
          ...(query.lifecycleCode ? { lifecycleCode: query.lifecycleCode } : {})
        },
        select: { itemDefinitionId: true }
      });
      filters.push(rows.map((row) => row.itemDefinitionId));
    }
    if (query.contextCode) {
      const rows = await this.prisma.itemContextRule.findMany({
        where: { contextCode: query.contextCode },
        select: { itemDefinitionId: true }
      });
      filters.push(rows.map((row) => row.itemDefinitionId));
    }
    if (query.query?.trim()) filters.push(searchIds ?? []);
    if (query.state && (query.childId || query.motherProfileId)) {
      const plans = await this.prisma.userItemPlan.findMany({
        where: { childId: query.childId ?? null, motherProfileId: query.motherProfileId ?? null, state: query.state },
        select: { itemDefinitionId: true }
      });
      filters.push(plans.map((row) => row.itemDefinitionId));
    }
    if (!filters.length) return null;
    const [first, ...rest] = filters;
    return [...new Set(first)].filter((id) => rest.every((filter) => filter.includes(id)));
  }

  private async catalogSearchMatches(rawQuery: string) {
    const normalized = normalizeSearch(rawQuery);
    const initialQuery = koreanInitials(rawQuery);
    const definitions = await this.prisma.itemDefinition.findMany({ where: { code: { startsWith: RELEASE4_ITEM_PREFIX }, status: { in: this.visibleStatuses() } }, select: { id: true, nameKo: true } });
    const itemIds = definitions.map((item) => item.id);
    const [aliases, links] = await Promise.all([
      this.prisma.itemSynonym.findMany({ where: { itemDefinitionId: { in: itemIds } }, select: { itemDefinitionId: true, synonym: true, normalizedSynonym: true } }),
      this.prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: { in: itemIds } }, select: { itemDefinitionId: true, catalogNodeId: true } })
    ]);
    const nodes = await this.prisma.catalogNode.findMany({ where: { id: { in: [...new Set(links.map((link) => link.catalogNodeId))] }, active: true }, select: { id: true, nameKo: true } });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const aliasesByItem = new Map<string, typeof aliases>();
    for (const alias of aliases) aliasesByItem.set(alias.itemDefinitionId, [...(aliasesByItem.get(alias.itemDefinitionId) ?? []), alias]);
    const categoriesByItem = new Map<string, string[]>();
    for (const link of links) {
      const name = nodeById.get(link.catalogNodeId)?.nameKo;
      if (name) categoriesByItem.set(link.itemDefinitionId, [...(categoriesByItem.get(link.itemDefinitionId) ?? []), name]);
    }
    const matches = new Map<string, CatalogSearchMatch>();
    const consider = (itemId: string, match: CatalogSearchMatch) => {
      if (match.score > (matches.get(itemId)?.score ?? -1)) matches.set(itemId, match);
    };
    for (const item of definitions) {
      const canonical = normalizeSearch(item.nameKo);
      if (canonical === normalized) consider(item.id, { score: 100, reason: "canonical_exact", matchedText: item.nameKo });
      else if (canonical.startsWith(normalized) || normalized.startsWith(canonical)) consider(item.id, { score: 90, reason: "canonical_prefix", matchedText: item.nameKo });
      else if (canonical.includes(normalized)) consider(item.id, { score: 85, reason: "alias_contains", matchedText: item.nameKo });
      if (initialQuery.length >= 2 && koreanInitials(item.nameKo).includes(initialQuery)) consider(item.id, { score: 75, reason: "initials", matchedText: item.nameKo });
      for (const alias of aliasesByItem.get(item.id) ?? []) {
        if (alias.normalizedSynonym === normalized) consider(item.id, { score: 95, reason: "alias_exact", matchedText: alias.synonym });
        else if (alias.normalizedSynonym.includes(normalized)) consider(item.id, { score: 80, reason: "alias_contains", matchedText: alias.synonym });
        if (initialQuery.length >= 2 && koreanInitials(alias.synonym).includes(initialQuery)) consider(item.id, { score: 72, reason: "initials", matchedText: alias.synonym });
      }
      if (normalized.length >= 3 && !matches.has(item.id)) {
        const candidates = [canonical, ...(aliasesByItem.get(item.id) ?? []).map((alias) => alias.normalizedSynonym)].filter((candidate) => Math.abs(candidate.length - normalized.length) <= 2);
        const threshold = normalized.length >= 7 ? 2 : 1;
        const typo = candidates.map((candidate) => ({ candidate, distance: editDistance(candidate, normalized), prefix: commonPrefixLength(candidate, normalized) }))
          .filter((candidate) => candidate.distance <= threshold)
          .sort((left, right) => left.distance - right.distance || right.prefix - left.prefix || Math.abs(left.candidate.length - normalized.length) - Math.abs(right.candidate.length - normalized.length))[0];
        if (typo) consider(item.id, { score: 60 + (threshold - typo.distance) * 4 + Math.min(typo.prefix, 4), reason: "typo", matchedText: item.nameKo });
      }
      const category = (categoriesByItem.get(item.id) ?? []).find((name) => normalizeSearch(name).includes(normalized));
      if (category) consider(item.id, { score: 50, reason: "category", matchedText: category });
    }
    return matches;
  }

  async listItems(user: AuthenticatedUser, query: ListCatalogItemsDto) {
    const searchMatches = query.query?.trim() ? await this.catalogSearchMatches(query.query) : null;
    const filteredIds = await this.filteredItemIds(user, query, searchMatches ? [...searchMatches.keys()] : undefined);
    const where: Prisma.ItemDefinitionWhereInput = {
      code: { startsWith: RELEASE4_ITEM_PREFIX },
      status: { in: this.visibleStatuses() },
      ...(query.necessity ? { necessity: query.necessity } : {}),
      ...(query.safetyTier ? { safetyTier: query.safetyTier } : {}),
      ...(query.secondhandPolicy ? { secondhandPolicy: query.secondhandPolicy } : {}),
      ...(query.rentalPolicy ? { rentalPolicy: query.rentalPolicy } : {}),
      ...(filteredIds ? { id: { in: filteredIds } } : {})
    };
    const total = await this.prisma.itemDefinition.count({ where });
    const rows = searchMatches
      ? (await this.prisma.itemDefinition.findMany({ where })).sort((left, right) => (searchMatches.get(right.id)?.score ?? 0) - (searchMatches.get(left.id)?.score ?? 0) || left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
      : await this.prisma.itemDefinition.findMany({ where, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
    const start = query.cursor ? Math.max(0, rows.findIndex((row) => row.id === query.cursor) + 1) : 0;
    const window = rows.slice(start, start + query.limit + 1);
    const hasNext = window.length > query.limit;
    const page = hasNext ? window.slice(0, query.limit) : window;
    const planVisibility = await this.planSummaryVisibility(user, query);
    const summaries = await this.summaries(page, { childId: query.childId, motherProfileId: query.motherProfileId }, planVisibility);
    return {
      items: summaries.map((item) => ({ ...item, ...(searchMatches?.get(item.id) ? { searchMatch: searchMatches.get(item.id) } : {}) })),
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null,
      total,
      ...(searchMatches ? { search: { normalizedQueryLength: normalizeSearch(query.query!).length, matchedCount: total, rawQueryStored: false } } : {})
    };
  }

  async itemDetail(user: AuthenticatedUser, itemId: string, context: { childId?: string; motherProfileId?: string }) {
    if (context.childId && context.motherProfileId) throw new BadRequestException({ code: "CATALOG_CONTEXT_AMBIGUOUS", message: "Choose a child or maternal context, not both." });
    if (context.childId) await this.requireChild(user, context.childId);
    if (context.motherProfileId) await this.requireMotherProfile(user, context.motherProfileId);
    const definition = await this.prisma.itemDefinition.findFirst({
      where: { id: itemId, status: { in: this.visibleStatuses() } }
    });
    if (!definition) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const planVisibility = await this.planSummaryVisibility(user, context);
    const [summary] = await this.summaries([definition], context, planVisibility);
    if (planVisibility === "gift" && !summary.plan) {
      throw new ForbiddenException({ code: "GIFT_ITEM_NOT_SHARED", message: "This item is not on the shared gift list." });
    }
    const [categoryLinks, lifecycles, contexts, offers] = await Promise.all([
      this.prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: itemId }, orderBy: { displayOrder: "asc" } }),
      this.prisma.itemLifecycleRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: { priorityWeight: "desc" } }),
      this.prisma.itemContextRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: { weight: "desc" } }),
      this.prisma.productOffer.findMany({
        where: { itemDefinitionId: itemId, active: true, approvedAt: { not: null }, healthState: "healthy", recallState: "clear" },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }]
      })
    ]);
    const categories = categoryLinks.length
      ? await this.prisma.catalogNode.findMany({ where: { id: { in: categoryLinks.map((link) => link.catalogNodeId) } } })
      : [];
    return {
      ...summary,
      reasonText: definition.reasonText,
      skipReasonText: definition.skipReasonText,
      quantityGuidance: definition.quantityGuidance,
      priceMinKrw: definition.priceMinKrw,
      priceMaxKrw: definition.priceMaxKrw,
      secondhandPolicy: definition.secondhandPolicy,
      rentalPolicy: definition.rentalPolicy,
      medicalDisclaimerRequired: definition.medicalDisclaimerRequired,
      categories,
      lifecycles,
      contexts,
      offers,
      reviewPending: definition.status !== "published"
    };
  }

  async itemComparison(user: AuthenticatedUser, itemId: string) {
    const definition = await this.prisma.itemDefinition.findFirst({ where: { id: itemId, status: { in: this.visibleStatuses() } }, select: { id: true, code: true, nameKo: true } });
    if (!definition) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const schema = comparisonSchema(definition.nameKo);
    const offers = await this.prisma.productOffer.findMany({
      where: { itemDefinitionId: itemId, active: true, approvedAt: { not: null }, healthState: "healthy", recallState: "clear" },
      orderBy: [{ displayOrder: "asc" }, { approvedAt: "desc" }]
    });
    const allowedKeys = new Set(schema.fields.map((field) => field.key));
    const now = Date.now();
    return {
      item: definition,
      schema,
      rankingPolicy: "catalog_display_order_only_no_affiliate_or_sponsor_signal" as const,
      offers: offers.map((offer) => {
        const rawAttributes = offer.comparisonAttributesJson && typeof offer.comparisonAttributesJson === "object" && !Array.isArray(offer.comparisonAttributesJson)
          ? offer.comparisonAttributesJson as Record<string, unknown>
          : {};
        const checkedAt = offer.priceCheckedAt;
        const ageDays = checkedAt ? Math.max(0, Math.floor((now - checkedAt.getTime()) / 86_400_000)) : null;
        return {
          id: offer.id,
          seller: offer.seller,
          brand: offer.brand,
          modelName: offer.modelName,
          productName: offer.productName,
          publicUrl: offer.publicUrl,
          isAffiliate: offer.isAffiliate,
          isSponsored: offer.isSponsored,
          disclosureText: offer.disclosureText,
          priceSnapshotKrw: offer.priceSnapshotKrw,
          priceCheckedAt: checkedAt,
          priceFreshness: ageDays === null ? "unknown" : ageDays <= 30 ? "current" : "stale",
          priceAgeDays: ageDays,
          stockState: offer.stockState,
          certificationRefs: offer.certificationRefsJson,
          recallState: offer.recallState,
          attributes: Object.fromEntries(Object.entries(rawAttributes).filter(([key]) => allowedKeys.has(key)))
        };
      })
    };
  }

  async bundles(user: AuthenticatedUser, childId?: string) {
    if (childId) {
      const scope = await this.requirePlanScope(user, { childId });
      if (this.requireHousehold(user, scope.householdId).role === "gift_participant") {
        throw new ForbiddenException({ code: "GIFT_BUNDLE_PRIVATE", message: "Preparation bundles are not shared with gift participants." });
      }
    }
    const bundles = await this.prisma.itemBundle.findMany({
      where: { status: { in: this.visibleStatuses() } },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }]
    });
    const result = [];
    for (const bundle of bundles) {
      const members = await this.prisma.itemBundleMember.findMany({ where: { bundleId: bundle.id }, orderBy: { displayOrder: "asc" } });
      const definitions = await this.prisma.itemDefinition.findMany({
        where: { id: { in: members.map((member) => member.itemDefinitionId) }, status: { in: this.visibleStatuses() } }
      });
      const summaryById = new Map((await this.summaries(definitions, { childId }, childId ? "full" : "none")).map((item) => [item.id, item]));
      const items = members.flatMap((member) => {
        const item = summaryById.get(member.itemDefinitionId);
        return item ? [{ ...item, bundleNecessity: member.necessity, defaultQuantity: member.defaultQuantity }] : [];
      });
      const completedStates = new Set(["owned", "borrowed", "rented", "gifted", "replaced", "retired", "ended", "not_needed"]);
      const completedCount = items.filter((item) => item.plan && completedStates.has(item.plan.state)).length;
      result.push({ ...bundle, items, progress: { totalCount: items.length, completedCount, percentage: items.length ? Math.round(completedCount * 100 / items.length) : 0 } });
    }
    return { bundles: result };
  }

  async applyBundle(user: AuthenticatedUser, childId: string, bundleId: string, input: ApplyCatalogBundleDto) {
    const scope = await this.requirePlanScope(user, { childId });
    this.requirePlanEditor(user, scope.householdId);
    const bundle = await this.prisma.itemBundle.findFirst({ where: { id: bundleId, status: { in: this.visibleStatuses() } } });
    if (!bundle) throw new NotFoundException({ code: "CATALOG_BUNDLE_NOT_FOUND", message: "Preparation bundle not found." });
    const members = await this.prisma.itemBundleMember.findMany({ where: { bundleId } });
    const memberIds = new Set(members.map((member) => member.itemDefinitionId));
    const selectedIds = input.items.map((item) => item.itemId);
    if (new Set(selectedIds).size !== selectedIds.length) throw new BadRequestException({ code: "CATALOG_BUNDLE_ITEMS_DUPLICATED", message: "Bundle item ids must be unique." });
    const invalidIds = selectedIds.filter((itemId) => !memberIds.has(itemId));
    if (invalidIds.length) throw new BadRequestException({ code: "CATALOG_BUNDLE_ITEM_INVALID", message: "Every selected item must belong to the bundle.", itemIds: invalidIds });
    const assigneeIds = [...new Set(input.items.flatMap((item) => item.assignedUserId ? [item.assignedUserId] : []))];
    if (assigneeIds.length) {
      const allowed = await this.prisma.householdMember.count({ where: { householdId: scope.householdId, userId: { in: assigneeIds }, status: "active", role: { not: "gift_participant" } } });
      if (allowed !== assigneeIds.length) throw new ForbiddenException({ code: "ITEM_PLAN_ASSIGNEE_FORBIDDEN", message: "Every assignee must be an active non-gift household member." });
    }
    const [existingPlans, definitions] = await Promise.all([
      this.prisma.userItemPlan.findMany({ where: { householdId: scope.householdId, motherProfileId: null, itemDefinitionId: { in: selectedIds } } }),
      this.prisma.itemDefinition.findMany({ where: { id: { in: selectedIds } }, select: { id: true, targetSubject: true } })
    ]);
    const currentByItem = new Map(existingPlans.filter((plan) => plan.childId === childId).map((plan) => [plan.itemDefinitionId, plan]));
    const definitionByItem = new Map(definitions.map((definition) => [definition.id, definition]));
    const warnings = input.items.flatMap((entry) => {
      const definition = definitionByItem.get(entry.itemId);
      if (!definition) return [];
      const match = existingPlans.find((current) => isDuplicatePurchaseRisk({
        canonicalItemId: entry.itemId,
        targetSubject: definition.targetSubject,
        childId,
        requestedState: entry.state,
        existing: { canonicalItemId: current.itemDefinitionId, childId: current.childId, state: current.state }
      }));
      return match ? [{ code: "DUPLICATE_PURCHASE_RISK" as const, itemId: entry.itemId, currentState: match.state, requestedState: entry.state }] : [];
    });
    if (input.dryRun) return { bundleId, childId, selectedCount: input.items.length, excludedCount: members.length - input.items.length, warnings, appliedCount: 0, plans: [] };
    const acknowledged = new Set(input.acknowledgeWarningItemIds ?? []);
    const unacknowledged = warnings.filter((warning) => !acknowledged.has(warning.itemId));
    if (unacknowledged.length) throw new ConflictException({ code: "CATALOG_BUNDLE_WARNING_ACK_REQUIRED", message: "Duplicate purchase warnings must be acknowledged before applying the bundle.", warnings: unacknowledged });

    const plans = await this.prisma.$transaction(async (tx) => {
      const results: UserItemPlan[] = [];
      for (const entry of input.items) {
        const current = currentByItem.get(entry.itemId);
        if (current && entry.expectedVersion !== current.version) throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "Preparation state changed after bundle preview.", current });
        if (!current && entry.expectedVersion !== undefined) throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "A version was supplied for a new preparation state." });
        const data = { state: entry.state, desiredQuantity: entry.quantityNeeded, assignedUserId: entry.assignedUserId, dueDate: planDate(entry.dueDate), budgetKrw: entry.budgetKrw, note: entry.note };
        if (current) {
          const changed = await tx.userItemPlan.updateMany({ where: { id: current.id, version: entry.expectedVersion }, data: { ...data, version: { increment: 1 } } });
          if (changed.count !== 1) throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "Preparation state changed during bundle apply." });
          const plan = await tx.userItemPlan.findUniqueOrThrow({ where: { id: current.id } });
          await tx.userItemPlanHistory.create({ data: { planId: plan.id, actorUserId: user.id, fromVersion: current.version, toVersion: plan.version, changesJson: compactJson({ source: "bundle", bundleId, ...entry }) } });
          results.push(plan);
        } else {
          const plan = await tx.userItemPlan.create({ data: { householdId: scope.householdId, childId, motherProfileId: null, itemDefinitionId: entry.itemId, ...data } });
          await tx.userItemPlanHistory.create({ data: { planId: plan.id, actorUserId: user.id, fromVersion: null, toVersion: plan.version, changesJson: compactJson({ source: "bundle", bundleId, ...entry }) } });
          results.push(plan);
        }
      }
      return results;
    });
    return { bundleId, childId, selectedCount: input.items.length, excludedCount: members.length - input.items.length, warnings, appliedCount: plans.length, plans: plans.map((plan) => this.planContract(plan)) };
  }

  private lifecycleForAge(input: { stageMode: "pregnant" | "born" | "manual"; dueDate: Date | null; birthDate: Date | null; manualStage: string | null }) {
    const result = calculatePreparationLifecycle({
      stageMode: input.stageMode,
      dueDate: input.dueDate ? dateOnlyUtc(input.dueDate) : null,
      birthDate: input.birthDate ? dateOnlyUtc(input.birthDate) : null,
      manualStage: input.manualStage as ChildStageCode | null,
      today: kstDateOnly()
    });
    if (!result.available) {
      throw new BadRequestException({
        code: "CATALOG_LIFECYCLE_UNAVAILABLE",
        message: "출산 예정일, 생년월일 또는 직접 선택한 성장 단계를 확인해 주세요."
      });
    }
    return result;
  }

  async timeline(user: AuthenticatedUser, context: { childId?: string; motherProfileId?: string }) {
    if (Boolean(context.childId) === Boolean(context.motherProfileId)) {
      throw new BadRequestException({ code: "CATALOG_CONTEXT_INVALID", message: "Choose exactly one child or maternal context." });
    }
    const scope = await this.requirePlanScope(user, context);
    const membership = this.requirePlanReader(user, scope.householdId);
    const canViewPrivatePlan = membership.role === "owner" || membership.role === "co_parent";
    let lifecycle: { axis: "mother" | "child"; code: Release4LifecycleCode; nextCode: Release4LifecycleCode | null };
    let seasonDate: Date | null;
    if (context.motherProfileId) {
      const profile = await this.prisma.motherProfile.findUniqueOrThrow({ where: { id: context.motherProfileId }, select: { dueDate: true } });
      lifecycle = this.lifecycleForAge({ stageMode: "pregnant", dueDate: profile.dueDate, birthDate: null, manualStage: null });
      seasonDate = profile.dueDate;
    } else {
      const child = await this.prisma.child.findUniqueOrThrow({ where: { id: context.childId }, select: { stageMode: true, dueDate: true, birthDate: true, manualStage: true } });
      lifecycle = this.lifecycleForAge(child);
      seasonDate = child.birthDate ?? child.dueDate;
    }
    const contextProfile = await this.prisma.preparationContextProfile.findUnique({
      where: { householdId_scopeKey: { householdId: scope.householdId, scopeKey: this.preparationScopeKey(scope) } }
    });
    const seasonMonth = seasonDate ? seasonDate.getUTCMonth() + 1 : null;
    const derivedContextCodes = seasonMonth && [6, 7, 8].includes(seasonMonth)
      ? ["summer_birth"]
      : seasonMonth && [12, 1, 2].includes(seasonMonth)
        ? ["winter_birth"]
        : [];
    const activeContextCodes = [...new Set([...(contextProfile?.contextCodes ?? []), ...derivedContextCodes])];
    const lifecycleCodes = [lifecycle.code, ...(lifecycle.nextCode ? [lifecycle.nextCode] : [])];
    const rules = await this.prisma.itemLifecycleRule.findMany({
      where: { axis: lifecycle.axis, lifecycleCode: { in: lifecycleCodes } },
      orderBy: { priorityWeight: "desc" }
    });
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId }
    });
    const definitions = await this.prisma.itemDefinition.findMany({
      where: { id: { in: [...new Set([...rules.map((rule) => rule.itemDefinitionId), ...plans.map((plan) => plan.itemDefinitionId)])] }, status: { in: this.visibleStatuses() } }
    });
    const matchingContextRules = activeContextCodes.length
      ? await this.prisma.itemContextRule.findMany({
          where: { itemDefinitionId: { in: definitions.map((item) => item.id) }, contextCode: { in: activeContextCodes } },
          orderBy: { weight: "desc" }
        })
      : [];
    const matchedContextsByItem = new Map<string, string[]>();
    const matchedContextWeightByItem = new Map<string, number>();
    const matchedContextRequiredIds = new Set<string>();
    for (const rule of matchingContextRules) {
      matchedContextsByItem.set(rule.itemDefinitionId, [...(matchedContextsByItem.get(rule.itemDefinitionId) ?? []), rule.contextCode]);
      matchedContextWeightByItem.set(rule.itemDefinitionId, (matchedContextWeightByItem.get(rule.itemDefinitionId) ?? 0) + rule.weight);
      if (rule.required) matchedContextRequiredIds.add(rule.itemDefinitionId);
    }
    const planByItem = new Map(plans.map((plan) => [plan.itemDefinitionId, plan]));
    const lifecyclePriorityByItem = new Map<string, number>();
    for (const rule of rules) {
      lifecyclePriorityByItem.set(rule.itemDefinitionId, Math.max(lifecyclePriorityByItem.get(rule.itemDefinitionId) ?? 0, rule.priorityWeight));
    }
    const currentIds = new Set(rules.filter((rule) => rule.lifecycleCode === lifecycle.code && rule.priorityWeight > 0).map((rule) => rule.itemDefinitionId));
    const displayOrderByItem = new Map(definitions.map((item) => [item.id, item.displayOrder]));
    const today = new Date(`${kstDateOnly()}T00:00:00.000Z`);
    const weekEnd = addDays(today, 6);
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    const completedStates = new Set<UserItemPlanState>(["owned", "borrowed", "rented", "gifted", "replaced", "retired", "ended"]);
    const items = definitions.filter((item) => (lifecyclePriorityByItem.get(item.id) ?? 0) > 0 || planByItem.has(item.id)).map((item) => {
      const plan = planByItem.get(item.id);
      const userDue = plan?.dueDate ?? plan?.replacementDueAt ?? plan?.nextPurchaseDueAt ?? null;
      const isComplete = plan ? completedStates.has(plan.state) : false;
      const bucket = (plan?.state === "not_needed" ? "not_needed"
        : isComplete ? "completed"
          : userDue && userDue < today ? "overdue"
            : userDue && userDue <= weekEnd ? "this_week"
              : currentIds.has(item.id) && (item.necessity === "required" || matchedContextRequiredIds.has(item.id)) ? "this_week"
                : currentIds.has(item.id) ? "this_month"
                  : "next_stage") as PreparationTimelineRankInput["bucket"];
      const dueWindow = bucket === "next_stage"
        ? { start: null, end: null, label: "다음 생애주기", derivedFrom: "lifecycle" as const }
        : userDue
          ? { start: dateOnlyUtc(userDue), end: dateOnlyUtc(userDue), label: bucket === "overdue" ? "사용자가 정한 날짜가 지났어요" : "사용자가 정한 날짜", derivedFrom: plan?.dueDate ? "user_due" as const : plan?.replacementDueAt ? "replacement" as const : "repeat_purchase" as const }
          : bucket === "this_week"
            ? { start: dateOnlyUtc(today), end: dateOnlyUtc(weekEnd), label: "이번 주", derivedFrom: "lifecycle" as const }
            : { start: dateOnlyUtc(today), end: dateOnlyUtc(monthEnd), label: "이번 달", derivedFrom: "lifecycle" as const };
      const matchedContextCodes = (matchedContextsByItem.get(item.id) ?? []) as CatalogScenarioCode[];
      const reason = buildPreparationRecommendationReason({
        lifecycleCode: lifecycle.code,
        nextLifecycleCode: lifecycle.nextCode,
        matchedContextCodes,
        bucket,
        dueWindow
      });
      return {
        id: item.id,
        code: item.code,
        nameKo: item.nameKo,
        necessity: item.necessity,
        safetyTier: item.safetyTier,
        matchedContextCodes,
        bucket,
        dueWindow,
        ...reason,
        plan: plan ? canViewPrivatePlan ? this.planContract(plan) : {
          state: plan.state,
          desiredQuantity: null,
          ownedQuantity: null,
          quantityNeeded: null,
          quantityOwned: null,
          dueDate: null,
          acquisitionMode: null,
          acquisitionType: null,
          assignedUserId: null,
          budgetKrw: null,
          note: null,
          notes: null,
          size: null,
          variant: null,
          purchasedAt: null,
          openedAt: null,
          expiresAt: null,
          replacementDueAt: null,
          usageEndedAt: null,
          storageLocation: null,
          recurringIntervalDays: null,
          nextPurchaseDueAt: null,
          version: plan.version
        } : null
      };
    }).sort((left, right) => {
      const leftPlan = planByItem.get(left.id);
      const rightPlan = planByItem.get(right.id);
      const rankInput = (item: typeof left, plan: typeof leftPlan) => ({
        bucket: item.bucket,
        hasPlan: Boolean(plan),
        userDueTime: (plan?.dueDate ?? plan?.replacementDueAt ?? plan?.nextPurchaseDueAt)?.getTime() ?? null,
        lifecyclePriority: lifecyclePriorityByItem.get(item.id) ?? 0,
        contextWeight: matchedContextWeightByItem.get(item.id) ?? 0,
        necessity: item.necessity,
        displayOrder: displayOrderByItem.get(item.id) ?? 0,
        code: item.code
      });
      return comparePreparationTimelineRank(rankInput(left, leftPlan), rankInput(right, rightPlan));
    });
    return {
      context: { ...context, lifecycleAxis: lifecycle.axis, lifecycleCode: lifecycle.code, nextLifecycleCode: lifecycle.nextCode, selectedContextCodes: contextProfile?.contextCodes ?? [], derivedContextCodes, activeContextCodes, contextVersion: contextProfile?.version ?? 0 },
      generatedAt: new Date().toISOString(),
      rankingPolicy: "user_due_then_timeline_then_lifecycle_priority_then_context_then_necessity_no_commerce_signal",
      buckets: Object.fromEntries((["this_week", "this_month", "next_stage", "overdue", "completed", "not_needed"] as const).map((bucket) => [bucket, items.filter((item) => item.bucket === bucket)]))
    };
  }

  async coverageSummary() {
    const [states, applicability, gapTypes, domains, items, aliases, highRiskPending] = await Promise.all([
      this.prisma.catalogCoverageDecision.groupBy({ by: ["state"], _count: { _all: true } }),
      this.prisma.catalogCoverageDecision.groupBy({ by: ["applicability"], _count: { _all: true } }),
      this.prisma.catalogCoverageDecision.groupBy({ by: ["gapType"], _count: { _all: true } }),
      this.prisma.catalogNode.count({ where: { level: "domain", active: true } }),
      this.prisma.itemDefinition.count({ where: { code: { startsWith: RELEASE4_ITEM_PREFIX } } }),
      this.prisma.itemSynonym.count({ where: { itemDefinitionId: { in: (await this.prisma.itemDefinition.findMany({ where: { code: { startsWith: RELEASE4_ITEM_PREFIX } }, select: { id: true } })).map((item) => item.id) } } }),
      this.prisma.itemDefinition.count({ where: { code: { startsWith: RELEASE4_ITEM_PREFIX }, safetyTier: "high", status: { not: "published" } } })
    ]);
    return {
      domains,
      canonicalItems: items,
      aliases,
      highRiskAwaitingProfessionalReview: highRiskPending,
      matrix: Object.fromEntries(states.map((state) => [state.state, state._count._all])),
      applicability: Object.fromEntries(applicability.map((entry) => [entry.applicability, entry._count._all])),
      gapTypes: Object.fromEntries(gapTypes.map((entry) => [entry.gapType ?? "none", entry._count._all])),
      unclassifiedApplicability: 0,
      externalReviewBlockers: applicability.find((entry) => entry.applicability === "review_needed")?._count._all ?? 0,
      publishBlocked: states.some((state) => state.state === "gap" && state._count._all > 0) || highRiskPending > 0
    };
  }

  async reportItem(user: AuthenticatedUser, itemId: string, reasonCode: string, detail?: string) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    return this.prisma.catalogItemReport.create({ data: { itemDefinitionId: itemId, userId: user.id, reasonCode, detail } });
  }

  async reportMissingItem(user: AuthenticatedUser, requestedName: string, detail?: string) {
    const normalizedName = normalizeSearch(requestedName);
    if (!normalizedName) throw new BadRequestException({ code: "CATALOG_MISSING_ITEM_NAME_REQUIRED", message: "A requested item name is required." });
    const queryHash = createHash("sha256").update(normalizedName).digest("hex");
    const existing = await this.prisma.catalogItemReport.findFirst({ where: { itemDefinitionId: null, userId: user.id, queryHash, state: "open" } });
    if (existing) return { report: existing, idempotent: true };
    const report = await this.prisma.catalogItemReport.create({
      data: { itemDefinitionId: null, userId: user.id, reasonCode: "missing_item", reportedText: requestedName.trim(), queryHash, detail: detail?.trim() || null }
    });
    return { report, idempotent: false };
  }

  async safetyAlerts(user: AuthenticatedUser, input: { childId?: string; motherProfileId?: string }) {
    const scope = await this.requirePlanScope(user, input);
    this.requirePlanReader(user, scope.householdId);
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId },
      select: { id: true, itemDefinitionId: true, state: true }
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const alerts = await this.prisma.catalogSafetyAlert.findMany({
      where: { userItemPlanId: { in: plans.map((plan) => plan.id) } },
      orderBy: [{ state: "desc" }, { createdAt: "desc" }],
      take: 100
    });
    const definitions = await this.prisma.itemDefinition.findMany({
      where: { id: { in: [...new Set(alerts.map((alert) => alert.itemDefinitionId))] } },
      select: { id: true, code: true, nameKo: true, safetyTier: true, safetyNote: true, status: true }
    });
    const itemById = new Map(definitions.map((item) => [item.id, item]));
    return {
      alerts: alerts.map((alert) => ({
        ...alert,
        planState: planById.get(alert.userItemPlanId)?.state ?? null,
        item: itemById.get(alert.itemDefinitionId) ?? null,
        actionGuidance: "공식 출처와 제품 식별 정보를 확인할 때까지 사용 여부를 보류해 주세요.",
        sourceStatus: "official_or_professional_source_required" as const
      }))
    };
  }

  async acknowledgeSafetyAlert(user: AuthenticatedUser, alertId: string, expectedVersion: number) {
    const alert = await this.prisma.catalogSafetyAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException({ code: "CATALOG_SAFETY_ALERT_NOT_FOUND", message: "Safety alert not found." });
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: alert.userItemPlanId }, select: { householdId: true } });
    if (!plan) throw new NotFoundException({ code: "ITEM_PLAN_NOT_FOUND", message: "Preparation plan not found." });
    this.requirePlanReader(user, plan.householdId);
    if (alert.state === "acknowledged" && alert.acknowledgedByUserId === user.id && alert.version === expectedVersion) return alert;
    const changed = await this.prisma.catalogSafetyAlert.updateMany({
      where: { id: alertId, state: "unread", version: expectedVersion },
      data: { state: "acknowledged", acknowledgedByUserId: user.id, acknowledgedAt: new Date(), version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_SAFETY_ALERT_CONFLICT", message: "Safety alert acknowledgement changed on another device." });
    return this.prisma.catalogSafetyAlert.findUniqueOrThrow({ where: { id: alertId } });
  }

  async listPlans(user: AuthenticatedUser, childId: string) {
    return this.listPlansForScope(user, { childId });
  }

  async listMotherPlans(user: AuthenticatedUser, motherProfileId: string) {
    return this.listPlansForScope(user, { motherProfileId });
  }

  private async listPlansForScope(user: AuthenticatedUser, input: { childId?: string; motherProfileId?: string }) {
    const scope = await this.requirePlanScope(user, input);
    const membership = this.requirePlanReader(user, scope.householdId);
    const planVisibility = membership.role === "viewer" ? "viewer" as const : "full" as const;
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId },
      orderBy: { updatedAt: "desc" }
    });
    const definitions = await this.prisma.itemDefinition.findMany({ where: { id: { in: plans.map((plan) => plan.itemDefinitionId) } } });
    const summaries = await this.summaries(definitions, input, planVisibility);
    const itemById = new Map(summaries.map((item) => [item.id, item]));
    return {
      plans: plans.map((plan) => ({
        ...(planVisibility === "full" ? this.planContract(plan) : {
          state: plan.state,
          desiredQuantity: null,
          ownedQuantity: null,
          quantityNeeded: null,
          quantityOwned: null,
          dueDate: null,
          acquisitionMode: null,
          acquisitionType: null,
          assignedUserId: null,
          budgetKrw: null,
          note: null,
          notes: null,
          size: null,
          variant: null,
          purchasedAt: null,
          openedAt: null,
          expiresAt: null,
          replacementDueAt: null,
          usageEndedAt: null,
          storageLocation: null,
          recurringIntervalDays: null,
          nextPurchaseDueAt: null,
          version: plan.version
        }),
        item: itemById.get(plan.itemDefinitionId)
      }))
    };
  }

  private planContract(plan: UserItemPlan) {
    return {
      ...plan,
      quantityNeeded: plan.desiredQuantity,
      quantityOwned: plan.ownedQuantity,
      acquisitionType: plan.acquisitionMode,
      notes: plan.note
    };
  }

  async putPlan(user: AuthenticatedUser, childId: string, itemId: string, input: UpdateItemPlanDto) {
    return this.putPlanForScope(user, { childId }, itemId, input);
  }

  async putMotherPlan(user: AuthenticatedUser, motherProfileId: string, itemId: string, input: UpdateItemPlanDto) {
    return this.putPlanForScope(user, { motherProfileId }, itemId, input);
  }

  private async putPlanForScope(user: AuthenticatedUser, inputScope: { childId?: string; motherProfileId?: string }, itemId: string, input: UpdateItemPlanDto) {
    const scope = await this.requirePlanScope(user, inputScope);
    this.requirePlanEditor(user, scope.householdId);
    const definition = await this.prisma.itemDefinition.findFirst({ where: { id: itemId, status: { in: this.visibleStatuses() } }, select: { id: true } });
    if (!definition) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    if (input.assignedUserId) {
      const assignee = await this.prisma.householdMember.findFirst({
        where: { householdId: scope.householdId, userId: input.assignedUserId, status: "active", role: { not: "gift_participant" } },
        select: { userId: true }
      });
      if (!assignee) {
        throw new ForbiddenException({ code: "ITEM_PLAN_ASSIGNEE_FORBIDDEN", message: "Assignee must be an active non-gift household member." });
      }
    }
    if (input.linkedExpenseId) {
      const linkedExpense = await this.prisma.expense.findUnique({
        where: { id: input.linkedExpenseId },
        select: { householdId: true, childId: true, deletedAt: true }
      });
      if (!linkedExpense || linkedExpense.deletedAt || linkedExpense.householdId !== scope.householdId || (scope.childId && linkedExpense.childId !== scope.childId)) {
        throw new ForbiddenException({ code: "ITEM_PLAN_EXPENSE_FORBIDDEN", message: "Linked expense must belong to the same household and child context." });
      }
    }
    const existing = await this.prisma.userItemPlan.findFirst({
      where: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId, itemDefinitionId: itemId }
    });
    if (existing && input.expectedVersion !== existing.version) {
      throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "Preparation state changed on another device.", current: existing });
    }
    if (input.quantityNeeded !== undefined && input.desiredQuantity !== undefined && input.quantityNeeded !== input.desiredQuantity) {
      throw new BadRequestException({ code: "ITEM_PLAN_QUANTITY_AMBIGUOUS", message: "quantityNeeded and desiredQuantity must agree when both are supplied." });
    }
    if (input.quantityOwned !== undefined && input.ownedQuantity !== undefined && input.quantityOwned !== input.ownedQuantity) {
      throw new BadRequestException({ code: "ITEM_PLAN_QUANTITY_AMBIGUOUS", message: "quantityOwned and ownedQuantity must agree when both are supplied." });
    }
    if (input.acquisitionType && input.acquisitionMode && input.acquisitionType !== input.acquisitionMode) {
      throw new BadRequestException({ code: "ITEM_PLAN_ACQUISITION_AMBIGUOUS", message: "acquisitionType and acquisitionMode must agree when both are supplied." });
    }
    if (input.notes !== undefined && input.note !== undefined && input.notes !== input.note) {
      throw new BadRequestException({ code: "ITEM_PLAN_NOTES_AMBIGUOUS", message: "notes and note must agree when both are supplied." });
    }
    const purchasedAt = planDate(input.purchasedAt);
    const openedAt = planDate(input.openedAt);
    const expiresAt = planDate(input.expiresAt);
    const replacementDueAt = planDate(input.replacementDueAt);
    const usageEndedAt = planDate(input.usageEndedAt);
    if (purchasedAt && openedAt && openedAt < purchasedAt) throw new BadRequestException({ code: "ITEM_PLAN_DATE_ORDER_INVALID", message: "openedAt cannot be before purchasedAt." });
    if (openedAt && expiresAt && expiresAt < openedAt) throw new BadRequestException({ code: "ITEM_PLAN_DATE_ORDER_INVALID", message: "expiresAt cannot be before openedAt." });
    if (purchasedAt && replacementDueAt && replacementDueAt < purchasedAt) throw new BadRequestException({ code: "ITEM_PLAN_DATE_ORDER_INVALID", message: "replacementDueAt cannot be before purchasedAt." });
    if (purchasedAt && usageEndedAt && usageEndedAt < purchasedAt) throw new BadRequestException({ code: "ITEM_PLAN_DATE_ORDER_INVALID", message: "usageEndedAt cannot be before purchasedAt." });
    const nextPurchaseDueAt = planDate(input.nextPurchaseDueAt)
      ?? (purchasedAt && input.recurringIntervalDays ? new Date(purchasedAt.getTime() + input.recurringIntervalDays * 86_400_000) : undefined);
    const data = {
      state: input.state,
      desiredQuantity: input.quantityNeeded ?? input.desiredQuantity,
      ownedQuantity: input.quantityOwned ?? input.ownedQuantity,
      dueDate: planDate(input.dueDate),
      acquisitionMode: input.acquisitionType ?? input.acquisitionMode,
      assignedUserId: input.assignedUserId,
      budgetKrw: input.budgetKrw,
      note: input.notes ?? input.note,
      linkedExpenseId: input.linkedExpenseId,
      size: input.size,
      variant: input.variant,
      purchasedAt,
      openedAt,
      expiresAt,
      replacementDueAt,
      usageEndedAt,
      storageLocation: input.storageLocation,
      recurringIntervalDays: input.recurringIntervalDays,
      nextPurchaseDueAt
    };
    const changesJson = compactJson({ ...input, expectedVersion: undefined });
    if (existing) {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.userItemPlan.updateMany({
          where: { id: existing.id, version: input.expectedVersion },
          data: { ...data, version: { increment: 1 } }
        });
        if (updated.count !== 1) return null;
        const plan = await tx.userItemPlan.findUniqueOrThrow({ where: { id: existing.id } });
        await tx.userItemPlanHistory.create({ data: { planId: plan.id, actorUserId: user.id, fromVersion: existing.version, toVersion: plan.version, changesJson } });
        if (plan.assignedUserId && plan.assignedUserId !== user.id && plan.assignedUserId !== existing.assignedUserId) {
          await this.queuePlanAssignmentNotification(tx, plan, itemId);
        }
        return plan;
      });
      if (!result) {
        const current = await this.prisma.userItemPlan.findUnique({ where: { id: existing.id } });
        throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "Preparation state changed on another device.", current });
      }
      return this.planContract(result);
    }
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const plan = await tx.userItemPlan.create({
          data: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId, itemDefinitionId: itemId, ...data }
        });
        await tx.userItemPlanHistory.create({ data: { planId: plan.id, actorUserId: user.id, fromVersion: null, toVersion: plan.version, changesJson } });
        if (plan.assignedUserId && plan.assignedUserId !== user.id) {
          await this.queuePlanAssignmentNotification(tx, plan, itemId);
        }
        return plan;
      });
      return this.planContract(created);
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const current = await this.prisma.userItemPlan.findFirst({
        where: { householdId: scope.householdId, childId: scope.childId, motherProfileId: scope.motherProfileId, itemDefinitionId: itemId }
      });
      if (!current) throw error;
      throw new ConflictException({ code: "ITEM_PLAN_VERSION_CONFLICT", message: "Preparation state was created on another device.", current });
    }
  }

  private async queuePlanAssignmentNotification(
    tx: Prisma.TransactionClient,
    plan: UserItemPlan,
    itemId: string
  ) {
    if (!plan.assignedUserId) return;
    const dedupeKey = `item-plan-assigned:${plan.id}:${plan.version}:${plan.assignedUserId}`;
    const delivery = await tx.notificationDelivery.upsert({
      where: { dedupeKey },
      create: {
        userId: plan.assignedUserId,
        householdId: plan.householdId,
        childId: plan.childId,
        targetType: "item",
        targetId: itemId,
        eventType: "item_plan_assigned",
        dedupeKey,
        scheduledAt: new Date()
      },
      update: {}
    });
    await tx.jobOutbox.upsert({
      where: { topic_dedupeKey: { topic: "notification.send", dedupeKey } },
      create: {
        topic: "notification.send",
        aggregateType: "notification_delivery",
        aggregateId: delivery.id,
        dedupeKey,
        payloadJson: { notificationDeliveryId: delivery.id }
      },
      update: {}
    });
  }

  async planActivity(user: AuthenticatedUser, childId: string, itemId: string) {
    const scope = await this.requirePlanScope(user, { childId });
    const membership = this.requirePlanReader(user, scope.householdId);
    const plan = await this.prisma.userItemPlan.findFirst({ where: { householdId: scope.householdId, childId, itemDefinitionId: itemId } });
    if (!plan) throw new NotFoundException({ code: "ITEM_PLAN_NOT_FOUND", message: "Preparation plan not found." });
    const [history, comments] = await Promise.all([
      this.prisma.userItemPlanHistory.findMany({ where: { planId: plan.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 }),
      this.prisma.userItemPlanComment.findMany({ where: { planId: plan.id, deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 })
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set([...history.flatMap((entry) => entry.actorUserId ? [entry.actorUserId] : []), ...comments.map((entry) => entry.authorUserId)])] } }, select: { id: true, displayName: true } });
    const nameById = new Map(users.map((entry) => [entry.id, entry.displayName ?? "가족"]));
    return {
      plan: membership.role === "viewer" ? this.viewerPlanContract(plan) : this.planContract(plan),
      history: history.map((entry) => ({
        ...entry,
        changesJson: membership.role === "viewer" ? this.redactPlanChanges(entry.changesJson) : entry.changesJson,
        actorDisplayName: entry.actorUserId ? nameById.get(entry.actorUserId) ?? "가족" : "탈퇴한 가족"
      })),
      comments: comments.map((entry) => ({ ...entry, authorDisplayName: nameById.get(entry.authorUserId) ?? "가족" }))
    };
  }

  async addPlanComment(user: AuthenticatedUser, childId: string, itemId: string, input: CreateItemPlanCommentDto) {
    const scope = await this.requirePlanScope(user, { childId });
    this.requirePlanEditor(user, scope.householdId);
    const plan = await this.prisma.userItemPlan.findFirst({ where: { householdId: scope.householdId, childId, itemDefinitionId: itemId } });
    if (!plan) throw new NotFoundException({ code: "ITEM_PLAN_NOT_FOUND", message: "Preparation plan not found." });
    const body = input.body.trim();
    const commentId = input.clientMutationId ?? randomUUID();
    const existing = await this.prisma.userItemPlanComment.findUnique({ where: { id: commentId } });
    if (existing) {
      if (existing.planId === plan.id && existing.authorUserId === user.id && existing.body === body) return existing;
      throw new ConflictException({ code: "ITEM_PLAN_COMMENT_IDEMPOTENCY_CONFLICT", message: "The comment mutation id was already used." });
    }
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.userItemPlanComment.create({ data: { id: commentId, planId: plan.id, authorUserId: user.id, body } });
      const recipients = await tx.householdMember.findMany({
        where: {
          householdId: scope.householdId,
          status: "active",
          userId: { not: user.id },
          OR: [
            { role: "owner" },
            ...(plan.assignedUserId ? [{ userId: plan.assignedUserId }] : [])
          ]
        },
        select: { userId: true }
      });
      for (const recipientId of [...new Set(recipients.map((entry) => entry.userId))]) {
        const dedupeKey = `item-plan-comment:${comment.id}:${recipientId}`;
        const delivery = await tx.notificationDelivery.upsert({
          where: { dedupeKey },
          create: {
            userId: recipientId,
            householdId: scope.householdId,
            childId,
            targetType: "item",
            targetId: itemId,
            eventType: "item_plan_comment",
            dedupeKey,
            scheduledAt: new Date()
          },
          update: {}
        });
        await tx.jobOutbox.upsert({
          where: { topic_dedupeKey: { topic: "notification.send", dedupeKey } },
          create: {
            topic: "notification.send",
            aggregateType: "notification_delivery",
            aggregateId: delivery.id,
            dedupeKey,
            payloadJson: { notificationDeliveryId: delivery.id }
          },
          update: {}
        });
      }
      return comment;
    });
  }

  async enqueueTemporalDueNotifications(referenceTime: Date) {
    const todayKey = preparationDateKeyKst(referenceTime);
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const plans = await this.prisma.userItemPlan.findMany({
      where: {
        state: { in: ["owned", "borrowed", "rented", "replacement_needed", "replacement_due"] },
        OR: [
          { replacementDueAt: { lte: today } },
          { nextPurchaseDueAt: { lte: today } }
        ]
      },
      select: {
        id: true,
        householdId: true,
        childId: true,
        itemDefinitionId: true,
        state: true,
        assignedUserId: true,
        replacementDueAt: true,
        nextPurchaseDueAt: true
      }
    });
    const householdIds = [...new Set(plans.map((plan) => plan.householdId))];
    const memberships = householdIds.length
      ? await this.prisma.householdMember.findMany({
          where: { householdId: { in: householdIds }, status: "active" },
          select: { householdId: true, userId: true, role: true }
        })
      : [];
    const membersByHousehold = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const entries = membersByHousehold.get(membership.householdId) ?? [];
      entries.push(membership);
      membersByHousehold.set(membership.householdId, entries);
    }
    let logicalEvents = 0;
    for (const plan of plans) {
      const recipients = (membersByHousehold.get(plan.householdId) ?? []).filter((membership) =>
        membership.role === "owner" || membership.userId === plan.assignedUserId
      );
      const dueEvents = preparationDueEvents({
        state: plan.state,
        replacementDueAt: plan.replacementDueAt,
        nextPurchaseDueAt: plan.nextPurchaseDueAt,
        referenceTime
      });
      for (const event of dueEvents) {
        for (const userId of [...new Set(recipients.map((membership) => membership.userId))]) {
          const dedupeKey = `preparation-due:${event.eventType}:${plan.id}:${event.dueKey}:${userId}`;
          const created = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.notificationDelivery.findUnique({ where: { dedupeKey }, select: { id: true } });
            if (existing) return false;
            const delivery = await tx.notificationDelivery.create({
              data: {
                userId,
                householdId: plan.householdId,
                childId: plan.childId,
                targetType: "item",
                targetId: plan.itemDefinitionId,
                eventType: event.eventType,
                dedupeKey,
                scheduledAt: referenceTime
              }
            });
            await tx.jobOutbox.create({
              data: {
                topic: "notification.send",
                aggregateType: "notification_delivery",
                aggregateId: delivery.id,
                dedupeKey,
                payloadJson: { notificationDeliveryId: delivery.id }
              }
            });
            return true;
          }).catch((error) => {
            if (isUniqueConstraintViolation(error)) return false;
            throw error;
          });
          if (created) logicalEvents += 1;
        }
      }
    }
    return { scannedPlans: plans.length, logicalEvents, referenceDateKst: todayKey };
  }

  private viewerPlanContract(plan: UserItemPlan) {
    return {
      ...this.planContract(plan),
      desiredQuantity: null,
      ownedQuantity: null,
      quantityNeeded: null,
      quantityOwned: null,
      dueDate: null,
      acquisitionMode: null,
      acquisitionType: null,
      assignedUserId: null,
      budgetKrw: null,
      note: null,
      notes: null,
      size: null,
      variant: null,
      purchasedAt: null,
      openedAt: null,
      expiresAt: null,
      replacementDueAt: null,
      usageEndedAt: null,
      storageLocation: null,
      recurringIntervalDays: null,
      nextPurchaseDueAt: null,
      linkedExpenseId: null
    };
  }

  private redactPlanChanges(value: Prisma.JsonValue): Prisma.JsonValue {
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    const sensitive = new Set([
      "desiredQuantity", "ownedQuantity", "quantityNeeded", "quantityOwned", "dueDate", "acquisitionMode",
      "acquisitionType", "assignedUserId", "budgetKrw", "note", "notes", "size", "variant", "purchasedAt",
      "openedAt", "expiresAt", "replacementDueAt", "usageEndedAt", "storageLocation", "recurringIntervalDays",
      "nextPurchaseDueAt", "linkedExpenseId"
    ]);
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.has(key))) as Prisma.JsonObject;
  }

  async bulkPlans(user: AuthenticatedUser, childId: string, entries: BulkItemPlanEntryDto[]) {
    if (!entries.length) return { plans: [] };
    const plans = [];
    for (const entry of entries) plans.push(await this.putPlan(user, childId, entry.itemId, entry));
    return { plans };
  }

  async bulkMotherPlans(user: AuthenticatedUser, motherProfileId: string, entries: BulkItemPlanEntryDto[]) {
    if (!entries.length) return { plans: [] };
    const plans = [];
    for (const entry of entries) plans.push(await this.putMotherPlan(user, motherProfileId, entry.itemId, entry));
    return { plans };
  }

  async expenseCategories(user: AuthenticatedUser, householdId?: string) {
    if (householdId) this.requireHousehold(user, householdId);
    return {
      categories: await this.prisma.expenseCategoryV2.findMany({
        where: householdId
          ? { hidden: false, OR: [{ householdId: null }, { householdId }] }
          : { householdId: null, hidden: false },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }]
      })
    };
  }

  private async summaries(
    definitions: ItemDefinition[],
    context: { childId?: string; motherProfileId?: string } = {},
    planVisibility: "none" | "full" | "viewer" | "gift" = "none"
  ) {
    if (!definitions.length) return [];
    const ids = definitions.map((definition) => definition.id);
    const [primaryLinks, plans] = await Promise.all([
      this.prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: { in: ids }, isPrimary: true } }),
      planVisibility !== "none" && (context.childId || context.motherProfileId)
        ? this.prisma.userItemPlan.findMany({ where: { childId: context.childId ?? null, motherProfileId: context.motherProfileId ?? null, itemDefinitionId: { in: ids }, ...(planVisibility === "gift" ? { state: "gift_expected" as const } : {}) } })
        : Promise.resolve([])
    ]);
    const categoryIds = primaryLinks.map((link) => link.catalogNodeId);
    const categories = categoryIds.length ? await this.prisma.catalogNode.findMany({ where: { id: { in: categoryIds } } }) : [];
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const primaryByItem = new Map(primaryLinks.map((link) => [link.itemDefinitionId, categoryById.get(link.catalogNodeId) ?? null]));
    const planByItem = new Map(plans.map((plan) => [plan.itemDefinitionId, plan]));
    return definitions.map((definition) => {
      const plan = planByItem.get(definition.id);
      return {
        id: definition.id,
        code: definition.code,
        nameKo: definition.nameKo,
        shortDescription: definition.shortDescription,
        targetSubject: definition.targetSubject,
        necessity: definition.necessity,
        recommendationState: definition.recommendationState,
        timingSummary: definition.timingSummary,
        safetyTier: definition.safetyTier,
        safetyNote: definition.safetyNote,
        status: definition.status,
        primaryCategory: primaryByItem.get(definition.id) ?? null,
        plan: plan ? planVisibility === "gift" ? {
          state: plan.state,
          desiredQuantity: plan.desiredQuantity,
          ownedQuantity: null,
          quantityNeeded: plan.desiredQuantity,
          quantityOwned: null,
          dueDate: null,
          acquisitionMode: "gift",
          acquisitionType: "gift",
          size: null,
          variant: null,
          purchasedAt: null,
          openedAt: null,
          expiresAt: null,
          replacementDueAt: null,
          usageEndedAt: null,
          storageLocation: null,
          recurringIntervalDays: null,
          nextPurchaseDueAt: null,
          assignedUserId: null,
          budgetKrw: null,
          note: null,
          notes: null,
          version: plan.version
        } : planVisibility === "viewer" ? {
          state: plan.state,
          desiredQuantity: null,
          ownedQuantity: null,
          quantityNeeded: null,
          quantityOwned: null,
          dueDate: null,
          acquisitionMode: null,
          acquisitionType: null,
          size: null,
          variant: null,
          purchasedAt: null,
          openedAt: null,
          expiresAt: null,
          replacementDueAt: null,
          usageEndedAt: null,
          storageLocation: null,
          recurringIntervalDays: null,
          nextPurchaseDueAt: null,
          assignedUserId: null,
          budgetKrw: null,
          note: null,
          notes: null,
          version: plan.version
        } : {
          state: plan.state,
          desiredQuantity: plan.desiredQuantity,
          ownedQuantity: plan.ownedQuantity,
          quantityNeeded: plan.desiredQuantity,
          quantityOwned: plan.ownedQuantity,
          dueDate: plan.dueDate,
          acquisitionMode: plan.acquisitionMode,
          acquisitionType: plan.acquisitionMode,
          size: plan.size,
          variant: plan.variant,
          purchasedAt: plan.purchasedAt,
          openedAt: plan.openedAt,
          expiresAt: plan.expiresAt,
          replacementDueAt: plan.replacementDueAt,
          usageEndedAt: plan.usageEndedAt,
          storageLocation: plan.storageLocation,
          recurringIntervalDays: plan.recurringIntervalDays,
          nextPurchaseDueAt: plan.nextPurchaseDueAt,
          assignedUserId: plan.assignedUserId,
          budgetKrw: plan.budgetKrw,
          note: plan.note,
          notes: plan.note,
          version: plan.version
        } : null
      };
    });
  }

  async adminCoverage() {
    const rows = await this.prisma.catalogCoverageDecision.findMany({
      orderBy: [{ state: "asc" }, { lifecycleAxis: "asc" }, { lifecycleCode: "asc" }]
    });
    return { summary: await this.coverageSummary(), cells: rows };
  }

  async adminTaxonomyTree() {
    const rows = await this.prisma.catalogNode.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }]
    });
    const ids = rows.map((node) => node.id);
    const links = ids.length
      ? await this.prisma.itemDefinitionCategory.findMany({ where: { catalogNodeId: { in: ids } }, select: { catalogNodeId: true } })
      : [];
    const directItemCounts = new Map<string, number>();
    for (const link of links) directItemCounts.set(link.catalogNodeId, (directItemCounts.get(link.catalogNodeId) ?? 0) + 1);
    const childrenByParent = new Map<string, typeof rows>();
    for (const node of rows) {
      if (!node.parentId) continue;
      childrenByParent.set(node.parentId, [...(childrenByParent.get(node.parentId) ?? []), node]);
    }
    const flattened: Array<(typeof rows)[number] & { depth: number; directChildCount: number; directItemCount: number; descendantItemCount: number }> = [];
    const visit = (node: (typeof rows)[number], depth: number): number => {
      const children = childrenByParent.get(node.id) ?? [];
      const directItemCount = directItemCounts.get(node.id) ?? 0;
      const index = flattened.length;
      flattened.push({ ...node, depth, directChildCount: children.length, directItemCount, descendantItemCount: directItemCount });
      const descendantItemCount = directItemCount + children.reduce((count, child) => count + visit(child, depth + 1), 0);
      flattened[index] = { ...flattened[index]!, descendantItemCount };
      return descendantItemCount;
    };
    for (const root of rows.filter((node) => node.parentId === null)) visit(root, 0);
    return { nodes: flattened };
  }

  async createCatalogNode(input: CreateCatalogNodeDto) {
    if (!input.nameKo.trim()) {
      throw new BadRequestException({ code: "CATALOG_NODE_NAME_REQUIRED", message: "Catalog node name cannot be blank." });
    }
    const existing = await this.prisma.catalogNode.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictException({ code: "CATALOG_NODE_CODE_EXISTS", message: "Catalog node code already exists." });
    const parent = await this.validateCatalogNodeParent(this.prisma, input.level, input.parentId, input.code);
    const displayOrder = input.displayOrder ?? ((await this.prisma.catalogNode.aggregate({
      where: { parentId: parent?.id ?? null, active: true },
      _max: { displayOrder: true }
    }))._max.displayOrder ?? 0) + 10;
    return this.prisma.catalogNode.create({
      data: {
        code: input.code,
        level: input.level,
        parentId: parent?.id ?? null,
        nameKo: input.nameKo.trim(),
        description: input.description?.trim() || null,
        iconKey: input.iconKey?.trim() || null,
        displayOrder
      }
    });
  }

  async updateCatalogNode(nodeId: string, input: UpdateCatalogNodeDto) {
    if (input.nameKo === undefined && input.description === undefined && input.iconKey === undefined) {
      throw new BadRequestException({ code: "CATALOG_NODE_CHANGE_REQUIRED", message: "At least one catalog node field must change." });
    }
    if (input.nameKo !== undefined && !input.nameKo.trim()) {
      throw new BadRequestException({ code: "CATALOG_NODE_NAME_REQUIRED", message: "Catalog node name cannot be blank." });
    }
    const current = await this.prisma.catalogNode.findUnique({ where: { id: nodeId } });
    if (!current || !current.active) throw new NotFoundException({ code: "CATALOG_NODE_NOT_FOUND", message: "Active catalog node not found." });
    const changed = await this.prisma.catalogNode.updateMany({
      where: { id: nodeId, active: true, version: input.expectedVersion },
      data: {
        ...(input.nameKo !== undefined ? { nameKo: input.nameKo.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey.trim() || null } : {}),
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_NODE_VERSION_CONFLICT", message: "Catalog node changed after it was loaded." });
    return this.prisma.catalogNode.findUniqueOrThrow({ where: { id: nodeId } });
  }

  async previewCatalogNodeArchive(nodeId: string) {
    const impact = await this.catalogNodeArchiveImpact(this.prisma, nodeId);
    return { ...impact, canArchive: impact.blockers.length === 0 };
  }

  async archiveCatalogNode(nodeId: string, input: ArchiveCatalogNodeDto) {
    return this.prisma.$transaction(async (tx) => {
      const impact = await this.catalogNodeArchiveImpact(tx, nodeId);
      if (impact.node.version !== input.expectedVersion) {
        throw new ConflictException({ code: "CATALOG_NODE_VERSION_CONFLICT", message: "Catalog node changed after preview." });
      }
      if (impact.blockers.length > 0) {
        throw new BadRequestException({ code: "CATALOG_NODE_ARCHIVE_BLOCKED", message: "Catalog node still has active references.", details: impact.blockers });
      }
      const archived = await tx.catalogNode.updateMany({
        where: { id: nodeId, active: true, version: input.expectedVersion },
        data: { active: false, version: { increment: 1 } }
      });
      if (archived.count !== 1) throw new ConflictException({ code: "CATALOG_NODE_VERSION_CONFLICT", message: "Catalog node changed before archive." });
      return tx.catalogNode.findUniqueOrThrow({ where: { id: nodeId } });
    });
  }

  async previewCatalogNodeReorder(input: CatalogNodeReorderDto) {
    return this.buildCatalogNodeReorderPreview(this.prisma, input);
  }

  async applyCatalogNodeReorder(input: CatalogNodeReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      const preview = await this.buildCatalogNodeReorderPreview(tx, input);
      if (preview.changes.length === 0) {
        throw new BadRequestException({ code: "CATALOG_NODE_REORDER_NO_CHANGES", message: "Catalog node order is already current." });
      }
      for (const change of preview.changes) {
        const updated = await tx.catalogNode.updateMany({
          where: { id: change.id, parentId: input.parentId ?? null, active: true, version: change.version },
          data: { displayOrder: change.nextOrder, version: { increment: 1 } }
        });
        if (updated.count !== 1) throw new ConflictException({ code: "CATALOG_NODE_VERSION_CONFLICT", message: "Catalog node changed during reorder." });
      }
      return { ...preview, appliedCount: preview.changes.length };
    });
  }

  private async validateCatalogNodeParent(db: Pick<Prisma.TransactionClient, "catalogNode">, level: CatalogNodeLevel, parentId: string | undefined, code: string) {
    if (level === "domain") {
      if (parentId) throw new BadRequestException({ code: "CATALOG_DOMAIN_PARENT_FORBIDDEN", message: "Domain nodes cannot have a parent." });
      if (!/^C\d{2}$/.test(code)) throw new BadRequestException({ code: "CATALOG_NODE_CODE_LEVEL_MISMATCH", message: "Domain code must be C plus two digits." });
      return null;
    }
    if (!parentId) throw new BadRequestException({ code: "CATALOG_NODE_PARENT_REQUIRED", message: "Category and subcategory nodes require a parent." });
    const parent = await db.catalogNode.findUnique({ where: { id: parentId } });
    if (!parent || !parent.active) throw new NotFoundException({ code: "CATALOG_NODE_PARENT_NOT_FOUND", message: "Active catalog parent not found." });
    const expectedParentLevel = level === "category" ? "domain" : "category";
    if (parent.level !== expectedParentLevel || !code.startsWith(`${parent.code}-`) || code.split("-").length !== parent.code.split("-").length + 1) {
      throw new BadRequestException({ code: "CATALOG_NODE_HIERARCHY_INVALID", message: "Catalog node level and code must extend its parent." });
    }
    return parent;
  }

  private async catalogNodeArchiveImpact(db: CatalogNodeDb, nodeId: string) {
    const node = await db.catalogNode.findUnique({ where: { id: nodeId } });
    if (!node || !node.active) throw new NotFoundException({ code: "CATALOG_NODE_NOT_FOUND", message: "Active catalog node not found." });
    const [activeChildCount, directItemCount, coverageDecisionCount] = await Promise.all([
      db.catalogNode.count({ where: { parentId: nodeId, active: true } }),
      db.itemDefinitionCategory.count({ where: { catalogNodeId: nodeId } }),
      db.catalogCoverageDecision.count({ where: { domainNodeId: nodeId } })
    ]);
    const blockers = [
      ...(activeChildCount ? [{ code: "ACTIVE_CHILDREN", count: activeChildCount }] : []),
      ...(directItemCount ? [{ code: "ITEM_MAPPINGS", count: directItemCount }] : []),
      ...(coverageDecisionCount ? [{ code: "COVERAGE_DECISIONS", count: coverageDecisionCount }] : [])
    ];
    return { node, activeChildCount, directItemCount, coverageDecisionCount, blockers };
  }

  private async buildCatalogNodeReorderPreview(db: Pick<Prisma.TransactionClient, "catalogNode">, input: CatalogNodeReorderDto) {
    if (input.parentId) {
      const parent = await db.catalogNode.findUnique({ where: { id: input.parentId } });
      if (!parent || !parent.active) throw new NotFoundException({ code: "CATALOG_NODE_PARENT_NOT_FOUND", message: "Active catalog parent not found." });
    }
    const siblings = await db.catalogNode.findMany({
      where: { parentId: input.parentId ?? null, active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }]
    });
    const inputIds = input.nodes.map((entry) => entry.id);
    if (new Set(inputIds).size !== inputIds.length) {
      throw new BadRequestException({ code: "CATALOG_NODE_REORDER_DUPLICATE", message: "Catalog reorder cannot contain duplicate nodes." });
    }
    const siblingById = new Map(siblings.map((node) => [node.id, node]));
    if (siblings.length !== input.nodes.length || input.nodes.some((entry) => !siblingById.has(entry.id))) {
      throw new BadRequestException({ code: "CATALOG_NODE_REORDER_INCOMPLETE", message: "Catalog reorder must include every active sibling exactly once." });
    }
    for (const entry of input.nodes) {
      if (siblingById.get(entry.id)!.version !== entry.expectedVersion) {
        throw new ConflictException({ code: "CATALOG_NODE_VERSION_CONFLICT", message: "Catalog node changed after the tree was loaded." });
      }
    }
    const changes = input.nodes.flatMap((entry, index) => {
      const node = siblingById.get(entry.id)!;
      const nextOrder = (index + 1) * 10;
      return node.displayOrder === nextOrder ? [] : [{ id: node.id, code: node.code, nameKo: node.nameKo, currentOrder: node.displayOrder, nextOrder, version: node.version }];
    });
    return { parentId: input.parentId ?? null, siblingCount: siblings.length, changes, canApply: changes.length > 0, itemMappingsAffected: 0 };
  }

  async adminListItems(query: AdminListCatalogItemsDto) {
    const where: Prisma.ItemDefinitionWhereInput = {
      code: { startsWith: RELEASE4_ITEM_PREFIX },
      ...(query.status ? { status: query.status } : {}),
      ...(query.safetyTier ? { safetyTier: query.safetyTier } : {}),
      ...(query.query?.trim() ? { OR: [{ code: { contains: query.query.trim(), mode: "insensitive" } }, { nameKo: { contains: query.query.trim(), mode: "insensitive" } }] } : {})
    };
    const total = await this.prisma.itemDefinition.count({ where });
    const rows = await this.prisma.itemDefinition.findMany({
      where,
      orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { id: "asc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1
    });
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    const ids = page.map((item) => item.id);
    const [aliasCounts, reportCounts, offerCounts] = await Promise.all([
      this.prisma.itemSynonym.groupBy({ by: ["itemDefinitionId"], where: { itemDefinitionId: { in: ids } }, _count: { _all: true } }),
      this.prisma.catalogItemReport.groupBy({ by: ["itemDefinitionId"], where: { itemDefinitionId: { in: ids }, state: "open" }, _count: { _all: true } }),
      this.prisma.productOffer.groupBy({ by: ["itemDefinitionId"], where: { itemDefinitionId: { in: ids } }, _count: { _all: true } })
    ]);
    const aliasByItem = new Map(aliasCounts.map((entry) => [entry.itemDefinitionId, entry._count._all]));
    const reportByItem = new Map(reportCounts.map((entry) => [entry.itemDefinitionId, entry._count._all]));
    const offerByItem = new Map(offerCounts.map((entry) => [entry.itemDefinitionId, entry._count._all]));
    return {
      items: page.map((item) => ({ ...item, aliasCount: aliasByItem.get(item.id) ?? 0, openReportCount: reportByItem.get(item.id) ?? 0, offerCount: offerByItem.get(item.id) ?? 0 })),
      total,
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null
    };
  }

  async adminItem(itemId: string) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const [categories, lifecycles, contexts, aliases, safetyRules, evidence, offers, reports] = await Promise.all([
      this.prisma.itemDefinitionCategory.findMany({ where: { itemDefinitionId: itemId }, orderBy: { displayOrder: "asc" } }),
      this.prisma.itemLifecycleRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ axis: "asc" }, { priorityWeight: "desc" }] }),
      this.prisma.itemContextRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ required: "desc" }, { weight: "desc" }] }),
      this.prisma.itemSynonym.findMany({ where: { itemDefinitionId: itemId }, orderBy: { normalizedSynonym: "asc" } }),
      this.prisma.itemSafetyRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: { severity: "desc" } }),
      this.prisma.itemEvidenceSource.findMany({ where: { itemDefinitionId: itemId }, orderBy: { checkedAt: "desc" } }),
      this.prisma.productOffer.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ active: "desc" }, { displayOrder: "asc" }] }),
      this.prisma.catalogItemReport.findMany({ where: { itemDefinitionId: itemId }, orderBy: { createdAt: "desc" }, take: 100 })
    ]);
    const categoryNodes = await this.prisma.catalogNode.findMany({ where: { id: { in: categories.map((entry) => entry.catalogNodeId) } } });
    const categoryById = new Map(categoryNodes.map((entry) => [entry.id, entry]));
    return { item, categories: categories.map((entry) => ({ ...entry, node: categoryById.get(entry.catalogNodeId) })), lifecycles, contexts, aliases, safetyRules, evidence, offers, reports };
  }

  async itemRevisions(itemId: string) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true, contentVersion: true, contentHash: true } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const [revisions, approvals, events] = await Promise.all([
      this.prisma.catalogItemRevision.findMany({ where: { itemDefinitionId: itemId }, orderBy: { revision: "desc" }, select: { revision: true, contentHash: true, authoredByAdminId: true, createdAt: true } }),
      this.prisma.catalogItemApproval.findMany({ where: { itemDefinitionId: itemId }, orderBy: { createdAt: "desc" }, select: { revision: true, contentHash: true, approvalType: true, reviewedByAdminId: true, evidenceUrl: true, evidenceTitle: true, expiresAt: true, createdAt: true } }),
      this.prisma.catalogItemWorkflowEvent.findMany({ where: { itemDefinitionId: itemId }, orderBy: { createdAt: "desc" }, take: 200 })
    ]);
    return { current: item, revisions, approvals, events };
  }

  async previewItemRollback(itemId: string, targetRevision: number, input: RollbackCatalogItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.itemDefinition.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
      this.assertRevision(current, input);
      if (targetRevision >= current.contentVersion) {
        throw new BadRequestException({ code: "CATALOG_ROLLBACK_TARGET_INVALID", message: "Rollback must target an older revision." });
      }
      const target = await tx.catalogItemRevision.findUnique({ where: { itemDefinitionId_revision: { itemDefinitionId: itemId, revision: targetRevision } } });
      if (!target) throw new NotFoundException({ code: "CATALOG_REVISION_NOT_FOUND", message: "Catalog revision not found." });
      const currentSnapshot = await this.itemRevisionSnapshot(tx, itemId);
      const targetPayload = target.payloadJson as unknown as CatalogRevisionPayload;
      const changes = this.catalogRevisionDiff(currentSnapshot.payload as unknown as CatalogRevisionPayload, targetPayload);
      return {
        itemId,
        currentRevision: current.contentVersion,
        currentContentHash: current.contentHash,
        targetRevision,
        targetContentHash: target.contentHash,
        resultRevision: current.contentVersion + 1,
        resultStatus: "draft" as const,
        invalidatesApprovals: true,
        publishesDirectly: false,
        changes
      };
    });
  }

  async rollbackItemAsNewRevision(adminId: string, itemId: string, targetRevision: number, input: RollbackCatalogItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      const current = await tx.itemDefinition.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
      this.assertRevision(current, input);
      if (targetRevision >= current.contentVersion) {
        throw new BadRequestException({ code: "CATALOG_ROLLBACK_TARGET_INVALID", message: "Rollback must target an older revision." });
      }
      const target = await tx.catalogItemRevision.findUnique({ where: { itemDefinitionId_revision: { itemDefinitionId: itemId, revision: targetRevision } } });
      if (!target) throw new NotFoundException({ code: "CATALOG_REVISION_NOT_FOUND", message: "Catalog revision not found." });
      const payload = target.payloadJson as unknown as CatalogRevisionPayload;
      if (payload.item.code !== current.code) throw new ConflictException({ code: "CATALOG_ROLLBACK_CODE_MISMATCH", message: "Revision payload belongs to a different catalog item." });
      const validNodeCount = await tx.catalogNode.count({ where: { id: { in: payload.categories.map((entry) => entry.catalogNodeId) }, active: true } });
      if (validNodeCount !== new Set(payload.categories.map((entry) => entry.catalogNodeId)).size) {
        throw new ConflictException({ code: "CATALOG_ROLLBACK_TAXONOMY_INVALID", message: "One or more historical taxonomy nodes are no longer active." });
      }

      const changed = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion, contentHash: input.contentHash, status: current.status },
        data: {
          ...payload.item,
          priceCheckedAt: payload.item.priceCheckedAt,
          contentVersion: { increment: 1 },
          contentHash: null,
          status: "draft",
          reviewedAt: null,
          reviewedByAdminId: null,
          lastEditedByAdminId: adminId,
          publishedByAdminId: null,
          publishedAt: null,
          scheduledAt: null
        }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed during rollback." });

      await Promise.all([
        tx.itemSynonym.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemContextRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemSafetyRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemEvidenceSource.deleteMany({ where: { itemDefinitionId: itemId } })
      ]);
      if (payload.aliases.length) await tx.itemSynonym.createMany({ data: payload.aliases.map((entry) => ({ itemDefinitionId: itemId, ...entry })) });
      if (payload.categories.length) await tx.itemDefinitionCategory.createMany({ data: payload.categories.map((entry) => ({ itemDefinitionId: itemId, ...entry })) });
      if (payload.lifecycles.length) await tx.itemLifecycleRule.createMany({ data: payload.lifecycles.map((entry) => ({ itemDefinitionId: itemId, ...entry })) });
      if (payload.contexts.length) await tx.itemContextRule.createMany({ data: payload.contexts.map((entry) => ({ itemDefinitionId: itemId, ...entry })) });
      if (payload.safetyRules.length) await tx.itemSafetyRule.createMany({ data: payload.safetyRules.map((entry) => ({ itemDefinitionId: itemId, ...entry, reviewedAt: null, expiresAt: null })) });
      if (payload.sources.length) await tx.itemEvidenceSource.createMany({ data: payload.sources.map((entry) => ({ itemDefinitionId: itemId, ...entry })) });

      const revision = await this.recordItemRevision(tx, itemId, adminId);
      await this.workflowEvent(tx, {
        itemDefinitionId: itemId,
        actorAdminId: adminId,
        revision: revision.revision,
        contentHash: revision.contentHash,
        fromStatus: current.status,
        toStatus: "draft",
        metadata: { rollbackFromRevision: current.contentVersion, rollbackSourceRevision: targetRevision, approvalsInvalidated: true }
      });
      return { item: await tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } }), rollbackSourceRevision: targetRevision, approvalsInvalidated: true, publishesDirectly: false };
    });
  }

  private catalogRevisionDiff(current: CatalogRevisionPayload, target: CatalogRevisionPayload) {
    const changes: Array<{ field: string; current: unknown; restored: unknown }> = [];
    for (const field of Object.keys(target.item) as Array<keyof CatalogRevisionPayload["item"]>) {
      if (JSON.stringify(current.item[field]) !== JSON.stringify(target.item[field])) changes.push({ field: `item.${field}`, current: current.item[field], restored: target.item[field] });
    }
    for (const field of ["aliases", "categories", "lifecycles", "contexts", "safetyRules", "sources"] as const) {
      if (JSON.stringify(current[field]) !== JSON.stringify(target[field])) changes.push({ field, current: current[field], restored: target[field] });
    }
    return changes;
  }

  async previewDraftImport(adminId: string, input: PreviewCatalogImportDto) {
    const requestedCodes = input.rows.map((row) => row.code?.trim() ?? "").filter(Boolean);
    const items = await this.prisma.itemDefinition.findMany({
      where: { code: { in: [...new Set(requestedCodes)] } }
    });
    const itemByCode = new Map(items.map((item) => [item.code, item]));
    const codeCounts = new Map<string, number>();
    for (const code of requestedCodes) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);

    const rows: CatalogImportPreviewRow[] = input.rows.map((row, index) => {
      const rowNumber = index + 1;
      const code = row.code?.trim() ?? "";
      const item = itemByCode.get(code);
      const errors: string[] = [];
      const changes: CatalogImportChanges = {};
      let providedFieldCount = 0;

      if (!code) errors.push("CODE_REQUIRED");
      else {
        if (code.length > 100) errors.push("CODE_TOO_LONG");
        if (!code.startsWith(RELEASE4_ITEM_PREFIX)) errors.push("CODE_NOT_RELEASE4");
      }
      if (code && (codeCounts.get(code) ?? 0) > 1) errors.push("DUPLICATE_CODE");
      if (code && !item) errors.push("ITEM_NOT_FOUND");

      for (const field of Object.keys(CATALOG_IMPORT_FIELDS) as CatalogImportField[]) {
        const raw = row[field];
        if (raw === undefined) continue;
        providedFieldCount += 1;
        const value = raw.trim();
        const bounds = CATALOG_IMPORT_FIELDS[field];
        if (value.length < bounds.min) errors.push(`${field.toUpperCase()}_REQUIRED`);
        else if (value.length > bounds.max) errors.push(`${field.toUpperCase()}_TOO_LONG`);
        else if (item && item[field] !== value) changes[field] = value;
      }

      if (providedFieldCount === 0) errors.push("NO_EDITABLE_FIELDS");
      else if (item && errors.length === 0 && Object.keys(changes).length === 0) errors.push("NO_CHANGES");
      return {
        rowNumber,
        code,
        valid: errors.length === 0,
        errors,
        changes,
        ...(item ? { expectedVersion: item.contentVersion, contentHash: item.contentHash ?? legacyEditorialHash(item), expectedStatus: item.status } : {})
      };
    });

    const preview: CatalogImportPreview = {
      schemaVersion: 1,
      mode: "existing-item-editorial-update",
      summary: {
        total: rows.length,
        valid: rows.filter((row) => row.valid).length,
        invalid: rows.filter((row) => !row.valid).length
      },
      rows
    };
    const state = preview.summary.valid > 0 ? "ready" : "rejected";
    const existing = await this.prisma.catalogImport.findUnique({ where: { sourceHash: input.sourceHash } });
    if (existing?.state === "applied") {
      return { import: existing, preview: this.readImportPreview(existing.validationJson), idempotent: true };
    }
    const catalogImport = existing
      ? await this.prisma.catalogImport.update({
          where: { id: existing.id },
          data: { requestedByAdminId: adminId, sourceName: input.sourceName, rowCount: rows.length, state, validationJson: preview as unknown as Prisma.InputJsonValue, version: { increment: 1 }, lastErrorCode: null }
        })
      : await this.prisma.catalogImport.create({
          data: { requestedByAdminId: adminId, sourceName: input.sourceName, sourceHash: input.sourceHash, rowCount: rows.length, state, validationJson: preview as unknown as Prisma.InputJsonValue }
        });
    return { import: catalogImport, preview, idempotent: false };
  }

  async applyDraftImport(adminId: string, importId: string, input: ApplyCatalogImportDto) {
    const requestedRowNumbers = [...new Set(input.rowNumbers)].sort((left, right) => left - right);
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      const before = await tx.catalogImport.findUnique({ where: { id: importId } });
      if (!before) throw new NotFoundException({ code: "CATALOG_IMPORT_NOT_FOUND", message: "Catalog import not found." });
      if (before.state === "applied") {
        const appliedPreview = this.readImportPreview(before.validationJson);
        if (JSON.stringify(appliedPreview.appliedRowNumbers ?? []) !== JSON.stringify(requestedRowNumbers)) {
          throw new ConflictException({ code: "CATALOG_IMPORT_ALREADY_APPLIED", message: "Catalog import was already applied with different rows." });
        }
        return { import: before, appliedCount: requestedRowNumbers.length, appliedRowNumbers: requestedRowNumbers, idempotent: true };
      }
      const claim = await tx.catalogImport.updateMany({
        where: { id: importId, state: "ready", version: input.expectedVersion },
        data: { state: "applying", version: { increment: 1 }, applyAttemptCount: { increment: 1 }, lastErrorCode: null }
      });
      if (claim.count !== 1) {
        throw new ConflictException({ code: "CATALOG_IMPORT_NOT_READY", message: "Catalog import is not ready to apply." });
      }
      const catalogImport = await tx.catalogImport.findUniqueOrThrow({ where: { id: importId } });
      const preview = this.readImportPreview(catalogImport.validationJson);
      const rowByNumber = new Map(preview.rows.map((row) => [row.rowNumber, row]));
      const selected = requestedRowNumbers.map((rowNumber) => rowByNumber.get(rowNumber));
      if (selected.some((row) => !row || !row.valid)) {
        throw new BadRequestException({ code: "CATALOG_IMPORT_ROW_INVALID", message: "Only valid preview rows can be applied." });
      }
      for (const row of selected as CatalogImportPreviewRow[]) {
        const current = await tx.itemDefinition.findUnique({ where: { code: row.code } });
        const currentHash = current ? current.contentHash ?? legacyEditorialHash(current) : null;
        if (!current || row.expectedVersion !== current.contentVersion || row.contentHash !== currentHash || row.expectedStatus !== current.status) {
          throw new ConflictException({ code: "CATALOG_IMPORT_REVISION_CONFLICT", message: `Catalog item ${row.code} changed after preview.` });
        }
        const updated = await tx.itemDefinition.updateMany({
          where: { id: current.id, contentVersion: row.expectedVersion, status: row.expectedStatus },
          data: {
            ...row.changes,
            contentVersion: { increment: 1 },
            contentHash: null,
            status: "draft",
            reviewedAt: null,
            reviewedByAdminId: null,
            lastEditedByAdminId: adminId,
            publishedByAdminId: null,
            publishedAt: null,
            scheduledAt: null
          }
        });
        if (updated.count !== 1) throw new ConflictException({ code: "CATALOG_IMPORT_REVISION_CONFLICT", message: `Catalog item ${row.code} changed during apply.` });
        await this.recordItemRevision(tx, current.id, adminId);
      }
      const appliedPreview: CatalogImportPreview = { ...preview, appliedRowNumbers: requestedRowNumbers };
      const appliedImport = await tx.catalogImport.update({
        where: { id: importId },
        data: { state: "applied", appliedAt: new Date(), validationJson: appliedPreview as unknown as Prisma.InputJsonValue, version: { increment: 1 } }
      });
      return { import: appliedImport, appliedCount: requestedRowNumbers.length, appliedRowNumbers: requestedRowNumbers, idempotent: false };
    });
  }

  async previewApprovalManifest(adminId: string, input: PreviewCatalogApprovalManifestDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active || admin.disabledAt || admin.email.toLocaleLowerCase() !== input.reviewerEmail.toLocaleLowerCase()) {
      throw new ForbiddenException({ code: "CATALOG_MANIFEST_REVIEWER_MISMATCH", message: "The signed-in reviewer must match the manifest reviewer identity." });
    }
    const issuedAt = new Date(input.issuedAt);
    const expiresAt = new Date(input.expiresAt);
    const now = new Date();
    if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || issuedAt > new Date(now.getTime() + 5 * 60_000) || expiresAt <= now || expiresAt.getTime() - issuedAt.getTime() > 30 * 86_400_000) {
      throw new BadRequestException({ code: "CATALOG_MANIFEST_EXPIRY_INVALID", message: "Approval manifests must be currently valid and expire within 30 days of issue." });
    }
    const existing = await this.prisma.catalogImport.findUnique({ where: { sourceHash: input.sourceHash } });
    if (existing) {
      const existingPreview = existing.validationJson as unknown as CatalogApprovalManifestPreview | null;
      if (existingPreview?.kind !== "catalog-approval-manifest" || existingPreview.manifestId !== input.manifestId || existing.requestedByAdminId !== adminId) {
        throw new ConflictException({ code: "CATALOG_MANIFEST_HASH_COLLISION", message: "This source hash belongs to a different import." });
      }
      return { import: existing, preview: existingPreview, idempotent: true };
    }

    const itemCodes = [...new Set(input.entries.map((entry) => entry.itemCode))];
    const [items, credentials] = await Promise.all([
      this.prisma.itemDefinition.findMany({ where: { code: { in: itemCodes } } }),
      this.prisma.catalogReviewerCredential.findMany({ where: { adminId, active: true } })
    ]);
    const itemByCode = new Map(items.map((item) => [item.code, item]));
    const activeCredentials = new Set(credentials.filter((credential) => !credential.expiresAt || credential.expiresAt > now).map((credential) => credential.approvalType));
    const codeCounts = new Map<string, number>();
    for (const entry of input.entries) codeCounts.set(entry.itemCode, (codeCounts.get(entry.itemCode) ?? 0) + 1);
    const hasHighRiskApproval = input.entries.some((entry) => itemByCode.get(entry.itemCode)?.safetyTier === "high" && entry.decision === "approved");

    const rows: CatalogApprovalManifestPreviewRow[] = input.entries.map((entry, index) => {
      const item = itemByCode.get(entry.itemCode);
      const errors: string[] = [];
      if (!item) errors.push("ITEM_NOT_FOUND");
      if ((codeCounts.get(entry.itemCode) ?? 0) > 1) errors.push("DUPLICATE_ITEM_CODE");
      if (!activeCredentials.has(entry.reviewType)) errors.push("REVIEWER_CREDENTIAL_INACTIVE");
      if (item && (item.contentVersion !== entry.revision || item.contentHash !== entry.contentHash)) errors.push("REVISION_OR_HASH_MISMATCH");
      if (item?.lastEditedByAdminId === adminId) errors.push("SELF_REVIEW_FORBIDDEN");
      const allowedStatuses: Record<typeof entry.reviewType, CatalogReviewStatus[]> = {
        editorial: ["review_requested", "editorial_review", "in_review"],
        domain: ["domain_review"],
        safety: ["safety_review"]
      };
      if (item && !allowedStatuses[entry.reviewType].includes(item.status)) errors.push("REVIEW_STATE_MISMATCH");
      if (entry.decision === "changes_requested" && !entry.reason?.trim()) errors.push("CHANGE_REASON_REQUIRED");
      if (entry.reviewType === "safety") {
        if (item?.safetyTier !== "high") errors.push("SAFETY_REVIEW_NOT_REQUIRED");
        if (!entry.professionalReviewConfirmed || !entry.evidenceUrl || !entry.evidenceTitle) errors.push("PROFESSIONAL_EVIDENCE_REQUIRED");
      }
      if (entry.reviewExpiresOn && new Date(`${entry.reviewExpiresOn}T23:59:59.999Z`) <= now) errors.push("REVIEW_EXPIRY_INVALID");
      if (hasHighRiskApproval && input.entries.length > 1) errors.push("HIGH_RISK_BULK_APPROVAL_FORBIDDEN");
      return { ...entry, rowNumber: index + 1, itemId: item?.id, valid: errors.length === 0, errors };
    });
    const preview: CatalogApprovalManifestPreview = {
      schemaVersion: 1,
      kind: "catalog-approval-manifest",
      manifestId: input.manifestId,
      reviewerEmail: admin.email,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      summary: { total: rows.length, valid: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length },
      rows
    };
    const catalogImport = await this.prisma.catalogImport.create({
      data: {
        requestedByAdminId: adminId,
        state: preview.summary.valid > 0 ? "ready" : "rejected",
        sourceName: `approval-manifest:${input.manifestId}`,
        sourceHash: input.sourceHash,
        rowCount: rows.length,
        validationJson: preview as unknown as Prisma.InputJsonValue
      }
    });
    return { import: catalogImport, preview, idempotent: false };
  }

  async applyApprovalManifest(adminId: string, importId: string) {
    const before = await this.prisma.catalogImport.findUnique({ where: { id: importId } });
    if (!before) throw new NotFoundException({ code: "CATALOG_IMPORT_NOT_FOUND", message: "Approval manifest not found." });
    const beforePreview = before.validationJson as unknown as CatalogApprovalManifestPreview | null;
    if (beforePreview?.kind !== "catalog-approval-manifest") throw new BadRequestException({ code: "CATALOG_IMPORT_KIND_INVALID", message: "The import is not an approval manifest." });
    if (before.state === "applied" && beforePreview.applyResult) return { ...beforePreview.applyResult, idempotent: true };
    if (before.requestedByAdminId !== adminId) throw new ForbiddenException({ code: "CATALOG_MANIFEST_REVIEWER_MISMATCH", message: "Only the mapped reviewer can apply this manifest." });
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active || admin.disabledAt || admin.email.toLocaleLowerCase() !== beforePreview.reviewerEmail.toLocaleLowerCase()) {
      throw new ForbiddenException({ code: "CATALOG_MANIFEST_REVIEWER_MISMATCH", message: "The active reviewer identity no longer matches the manifest." });
    }
    if (new Date(beforePreview.expiresAt) <= new Date()) throw new ConflictException({ code: "CATALOG_MANIFEST_EXPIRED", message: "The approval manifest expired before apply." });
    const claimed = await this.prisma.catalogImport.updateMany({ where: { id: importId, state: "ready" }, data: { state: "validating" } });
    if (claimed.count !== 1) throw new ConflictException({ code: "CATALOG_MANIFEST_NOT_READY", message: "Another apply is running or this manifest is not ready." });

    const results: CatalogApprovalManifestApplyResult["results"] = [];
    for (const row of beforePreview.rows) {
      if (!row.valid || !row.itemId) {
        results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "failed", code: row.errors[0] ?? "INVALID_PREVIEW_ROW" });
        continue;
      }
      try {
        const result = row.decision === "approved"
          ? await this.reviewItem(adminId, row.itemId, {
              reviewType: row.reviewType,
              expectedVersion: row.revision,
              contentHash: row.contentHash,
              professionalReviewConfirmed: row.professionalReviewConfirmed ?? false,
              evidenceUrl: row.evidenceUrl,
              evidenceTitle: row.evidenceTitle,
              reviewExpiresOn: row.reviewExpiresOn
            })
          : await this.transitionItem(adminId, row.itemId, {
              expectedVersion: row.revision,
              contentHash: row.contentHash,
              toStatus: "changes_requested",
              reason: row.reason
            });
        results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: row.decision, resultingStatus: result.status });
      } catch (error) {
        results.push({ rowNumber: row.rowNumber, itemCode: row.itemCode, outcome: "failed", code: errorCode(error) });
      }
    }
    const applyResult: CatalogApprovalManifestApplyResult = {
      idempotent: false,
      applied: results.filter((result) => result.outcome !== "failed").length,
      failed: results.filter((result) => result.outcome === "failed").length,
      results
    };
    await this.prisma.catalogImport.update({
      where: { id: importId },
      data: { state: "applied", appliedAt: new Date(), validationJson: { ...beforePreview, applyResult } as unknown as Prisma.InputJsonValue }
    });
    return applyResult;
  }

  async importErrorsCsv(importId: string) {
    const catalogImport = await this.prisma.catalogImport.findUnique({ where: { id: importId } });
    if (!catalogImport) throw new NotFoundException({ code: "CATALOG_IMPORT_NOT_FOUND", message: "Catalog import not found." });
    const preview = this.readImportPreview(catalogImport.validationJson);
    const lines = ["rowNumber,code,errors"];
    for (const row of preview.rows.filter((entry) => !entry.valid)) {
      lines.push([String(row.rowNumber), row.code, row.errors.join("|")].map(csvCell).join(","));
    }
    return `\uFEFF${lines.join("\r\n")}\r\n`;
  }

  private readImportPreview(value: Prisma.JsonValue | null): CatalogImportPreview {
    const preview = value as unknown as CatalogImportPreview | null;
    if (!preview || preview.schemaVersion !== 1 || preview.mode !== "existing-item-editorial-update" || !Array.isArray(preview.rows)) {
      throw new BadRequestException({ code: "CATALOG_IMPORT_PREVIEW_MISSING", message: "Catalog import preview is missing or unsupported." });
    }
    return preview;
  }

  private async itemRevisionSnapshot(db: Prisma.TransactionClient, itemId: string) {
    const [item, aliases, categories, lifecycles, contexts, safetyRules, sources] = await Promise.all([
      db.itemDefinition.findUnique({
        where: { id: itemId },
        select: {
          id: true, code: true, nameKo: true, shortDescription: true, targetSubject: true, necessity: true,
          recommendationState: true, reasonText: true, skipReasonText: true, quantityGuidance: true,
          timingSummary: true, priceMinKrw: true, priceMaxKrw: true, priceCheckedAt: true,
          secondhandPolicy: true, rentalPolicy: true, safetyTier: true, safetyNote: true,
          medicalDisclaimerRequired: true, sourceSummary: true, displayOrder: true, contentVersion: true
        }
      }),
      db.itemSynonym.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ normalizedSynonym: "asc" }, { synonym: "asc" }], select: { synonym: true, normalizedSynonym: true } }),
      db.itemDefinitionCategory.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ displayOrder: "asc" }, { catalogNodeId: "asc" }], select: { catalogNodeId: true, isPrimary: true, displayOrder: true } }),
      db.itemLifecycleRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ axis: "asc" }, { lifecycleCode: "asc" }], select: { axis: true, lifecycleCode: true, timingText: true, priorityWeight: true } }),
      db.itemContextRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: { contextCode: "asc" }, select: { contextCode: true, weight: true, required: true } }),
      db.itemSafetyRule.findMany({ where: { itemDefinitionId: itemId }, orderBy: { ruleCode: "asc" }, select: { ruleCode: true, severity: true, guidanceText: true, blocksRecommendation: true } }),
      db.itemEvidenceSource.findMany({ where: { itemDefinitionId: itemId }, orderBy: [{ checkedAt: "asc" }, { id: "asc" }], select: { sourceType: true, title: true, publicUrl: true, publisher: true, publishedAt: true, checkedAt: true } })
    ]);
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const { id: _itemId, contentVersion: _contentVersion, ...content } = item;
    const payload = { item: content, aliases, categories, lifecycles, contexts, safetyRules, sources };
    const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return { item, payload, contentHash };
  }

  private async recordItemRevision(db: Prisma.TransactionClient, itemId: string, adminId: string) {
    const snapshot = await this.itemRevisionSnapshot(db, itemId);
    const existing = await db.catalogItemRevision.findUnique({
      where: { itemDefinitionId_revision: { itemDefinitionId: itemId, revision: snapshot.item.contentVersion } }
    });
    if (existing && existing.contentHash !== snapshot.contentHash) {
      throw new ConflictException({ code: "CATALOG_REVISION_HASH_CONFLICT", message: "Catalog content changed without a new revision." });
    }
    if (!existing) {
      await db.catalogItemRevision.create({
        data: {
          itemDefinitionId: itemId,
          revision: snapshot.item.contentVersion,
          contentHash: snapshot.contentHash,
          payloadJson: snapshot.payload as unknown as Prisma.InputJsonValue,
          authoredByAdminId: adminId
        }
      });
    }
    await db.itemDefinition.update({ where: { id: itemId }, data: { contentHash: snapshot.contentHash } });
    return { revision: snapshot.item.contentVersion, contentHash: snapshot.contentHash };
  }

  private assertRevision(item: { contentVersion: number; contentHash: string | null }, input: { expectedVersion: number; contentHash: string }) {
    if (item.contentVersion !== input.expectedVersion || !item.contentHash || item.contentHash !== input.contentHash) {
      throw new ConflictException({
        code: "CATALOG_REVISION_CONFLICT",
        message: "Catalog content changed after this operation was prepared.",
        current: { contentVersion: item.contentVersion, contentHash: item.contentHash }
      });
    }
  }

  private async requireActiveAdmin(db: Prisma.TransactionClient, adminId: string, role?: "admin") {
    const admin = await db.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active || admin.disabledAt || (role && admin.role !== role)) {
      throw new ForbiddenException({ code: "CATALOG_ADMIN_INACTIVE", message: "An active authorized admin account is required." });
    }
    return admin;
  }

  private async requireReviewerCredential(db: Prisma.TransactionClient, adminId: string, reviewType: "editorial" | "domain" | "safety") {
    await this.requireActiveAdmin(db, adminId);
    const now = new Date();
    const credential = await db.catalogReviewerCredential.findUnique({
      where: { adminId_approvalType: { adminId, approvalType: reviewType } }
    });
    if (!credential || !credential.active || (credential.expiresAt && credential.expiresAt <= now)) {
      throw new ForbiddenException({ code: "CATALOG_REVIEWER_INACTIVE", message: `An active ${reviewType} reviewer credential is required.` });
    }
    return credential;
  }

  private workflowEvent(
    db: Prisma.TransactionClient,
    input: { itemDefinitionId: string; actorAdminId: string; revision: number; contentHash: string; fromStatus: CatalogReviewStatus; toStatus: CatalogReviewStatus; metadata?: Prisma.InputJsonValue }
  ) {
    return db.catalogItemWorkflowEvent.create({
      data: {
        itemDefinitionId: input.itemDefinitionId,
        actorAdminId: input.actorAdminId,
        revision: input.revision,
        contentHash: input.contentHash,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        metadataJson: input.metadata
      }
    });
  }

  async updateItemDraft(adminId: string, itemId: string, input: UpdateCatalogItemDraftDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      const { expectedVersion, ...changes } = input;
      const updated = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: expectedVersion },
        data: {
          ...changes,
          contentVersion: { increment: 1 },
          contentHash: null,
          status: "draft",
          reviewedAt: null,
          reviewedByAdminId: null,
          lastEditedByAdminId: adminId,
          publishedByAdminId: null,
          publishedAt: null,
          scheduledAt: null
        }
      });
      if (updated.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed before the draft update." });
      await this.recordItemRevision(tx, itemId, adminId);
      return tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    });
  }

  async replaceAliases(adminId: string, itemId: string, input: ReplaceCatalogAliasesDto) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true, contentVersion: true } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    const aliases = [...new Map(input.aliases.map((alias) => [normalizeSearch(alias), alias.trim()])).entries()]
      .filter(([normalized, alias]) => normalized && alias)
      .map(([normalizedSynonym, synonym]) => ({ normalizedSynonym, synonym }));
    if (!aliases.length) throw new BadRequestException({ code: "CATALOG_ALIAS_REQUIRED", message: "At least one non-empty alias is required." });
    const collision = await this.prisma.itemSynonym.findFirst({
      where: { normalizedSynonym: { in: aliases.map((alias) => alias.normalizedSynonym) }, itemDefinitionId: { not: itemId } },
      select: { normalizedSynonym: true, itemDefinitionId: true }
    });
    if (collision) throw new ConflictException({ code: "CATALOG_ALIAS_COLLISION", message: "Alias already belongs to another item.", collision });
    await this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      await tx.itemSynonym.deleteMany({ where: { itemDefinitionId: itemId } });
      await tx.itemSynonym.createMany({ data: aliases.map((alias) => ({ itemDefinitionId: itemId, ...alias })) });
      const updated = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion },
        data: {
          contentVersion: { increment: 1 }, contentHash: null, status: "draft", reviewedAt: null,
          reviewedByAdminId: null, lastEditedByAdminId: adminId, publishedByAdminId: null, publishedAt: null, scheduledAt: null
        }
      });
      if (updated.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed before aliases were replaced." });
      await this.recordItemRevision(tx, itemId, adminId);
    });
    return this.adminItem(itemId);
  }

  async replaceMappings(adminId: string, itemId: string, input: ReplaceCatalogMappingsDto) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true, contentVersion: true } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    for (const lifecycle of input.lifecycles) {
      const valid = lifecycle.axis === "mother" ? motherLifecycleCodes.includes(lifecycle.lifecycleCode as never) : childLifecycleCodes.includes(lifecycle.lifecycleCode as never);
      if (!valid) throw new BadRequestException({ code: "CATALOG_LIFECYCLE_INVALID", message: `Unknown ${lifecycle.axis} lifecycle: ${lifecycle.lifecycleCode}` });
    }
    const allowedContexts = new Set(["all", ...catalogScenarioCodes]);
    const invalidContext = input.contextCodes.find((code) => !allowedContexts.has(code as never));
    if (invalidContext) throw new BadRequestException({ code: "CATALOG_CONTEXT_INVALID", message: `Unknown context: ${invalidContext}` });
    const categoryCodes = [...new Set([input.primaryCategoryCode, ...(input.additionalCategoryCodes ?? [])])];
    const nodes = await this.prisma.catalogNode.findMany({ where: { code: { in: categoryCodes }, active: true } });
    if (nodes.length !== categoryCodes.length || nodes.find((node) => node.code === input.primaryCategoryCode)?.level !== "subcategory") {
      throw new BadRequestException({ code: "CATALOG_CATEGORY_INVALID", message: "Every category must exist and the primary category must be a level-3 category." });
    }
    const mappingNodes = new Map(nodes.map((node) => [node.id, node]));
    let parentIds = [...new Set(nodes.map((node) => node.parentId).filter((id): id is string => Boolean(id)))];
    while (parentIds.length) {
      const parents = await this.prisma.catalogNode.findMany({ where: { id: { in: parentIds }, active: true } });
      for (const parent of parents) mappingNodes.set(parent.id, parent);
      parentIds = [...new Set(parents.map((parent) => parent.parentId).filter((id): id is string => Boolean(id) && !mappingNodes.has(id!)))];
    }
    const levelOrder: Record<CatalogNodeLevel, number> = { domain: 0, category: 1, subcategory: 2 };
    const completeNodes = [...mappingNodes.values()].sort((left, right) => levelOrder[left.level] - levelOrder[right.level] || left.code.localeCompare(right.code));
    await this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      await Promise.all([
        tx.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        tx.itemContextRule.deleteMany({ where: { itemDefinitionId: itemId } })
      ]);
      await tx.itemDefinitionCategory.createMany({ data: completeNodes.map((node, index) => ({ itemDefinitionId: itemId, catalogNodeId: node.id, isPrimary: node.code === input.primaryCategoryCode, displayOrder: index })) });
      await tx.itemLifecycleRule.createMany({ data: input.lifecycles.map((rule) => ({ itemDefinitionId: itemId, axis: rule.axis, lifecycleCode: rule.lifecycleCode, timingText: rule.timingText, priorityWeight: rule.priorityWeight ?? 0 })) });
      await tx.itemContextRule.createMany({ data: [...new Set(["all", ...input.contextCodes])].map((contextCode) => ({ itemDefinitionId: itemId, contextCode, weight: 0, required: false })) });
      const updated = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion },
        data: {
          contentVersion: { increment: 1 }, contentHash: null, status: "draft", reviewedAt: null,
          reviewedByAdminId: null, lastEditedByAdminId: adminId, publishedByAdminId: null, publishedAt: null, scheduledAt: null
        }
      });
      if (updated.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed before mappings were replaced." });
      await this.recordItemRevision(tx, itemId, adminId);
    });
    return this.adminItem(itemId);
  }

  private assertOfferUrl(value: string) {
    const parsed = new URL(value);
    const allowedDomains = (process.env.AFFILIATE_ALLOWED_DOMAINS ?? "coupang.com,link.coupang.com,smartstore.naver.com,shopping.naver.com,brand.naver.com,example.com")
      .split(",").map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    if (parsed.protocol !== "https:" || !isDomainAllowed(parsed.hostname, allowedDomains)) {
      throw new BadRequestException({ code: "PRODUCT_OFFER_URL_BLOCKED", message: "Product offer URL is not allowlisted." });
    }
  }

  async createOffer(itemId: string, input: CreateProductOfferDto, adminId?: string) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true, nameKo: true } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    this.assertOfferUrl(input.publicUrl);
    if (input.affiliateUrl) this.assertOfferUrl(input.affiliateUrl);
    if (input.isAffiliate && !input.affiliateUrl) {
      throw new BadRequestException({ code: "PRODUCT_OFFER_AFFILIATE_URL_REQUIRED", message: "Affiliate offers require a separate allowlisted affiliate URL." });
    }
    if ((input.isAffiliate || input.isSponsored) && !input.disclosureText?.includes("제휴") && !input.disclosureText?.includes("광고")) {
      throw new BadRequestException({ code: "PRODUCT_OFFER_DISCLOSURE_REQUIRED", message: "Affiliate or sponsored offers require adjacent disclosure text." });
    }
    if ((input.priceSnapshotKrw === undefined) !== (input.priceCheckedAt === undefined)) {
      throw new BadRequestException({ code: "PRODUCT_OFFER_PRICE_PROVENANCE_REQUIRED", message: "A price snapshot and its checked timestamp must be supplied together." });
    }
    const priceCheckedAt = input.priceCheckedAt ? new Date(input.priceCheckedAt) : undefined;
    if (priceCheckedAt && (!Number.isFinite(priceCheckedAt.getTime()) || priceCheckedAt.getTime() > Date.now() + 5 * 60_000)) {
      throw new BadRequestException({ code: "PRODUCT_OFFER_PRICE_TIMESTAMP_INVALID", message: "The price checked timestamp must be a valid non-future instant." });
    }
    const schema = comparisonSchema(item.nameKo);
    const allowedFields = new Map(schema.fields.map((field) => [field.key, field]));
    for (const [key, value] of Object.entries(input.comparisonAttributes ?? {})) {
      const field = allowedFields.get(key);
      if (!field) throw new BadRequestException({ code: "PRODUCT_OFFER_COMPARISON_FIELD_FORBIDDEN", message: `Comparison field ${key} is not defined for this catalog item.` });
      if (field.valueType === "number" ? typeof value !== "number" || !Number.isFinite(value) : typeof value !== "string" || value.length > 160) {
        throw new BadRequestException({ code: "PRODUCT_OFFER_COMPARISON_VALUE_INVALID", message: `Comparison field ${key} has an invalid value.` });
      }
    }
    const { comparisonAttributes, priceCheckedAt: _priceCheckedAt, ...offerInput } = input;
    return this.prisma.productOffer.create({
      data: {
        itemDefinitionId: itemId,
        ...offerInput,
        priceCheckedAt,
        comparisonAttributesJson: comparisonAttributes as Prisma.InputJsonValue | undefined,
        createdByAdminId: adminId,
        active: false,
        healthState: "stale",
        recallState: "unknown",
        stockState: "unknown"
      }
    });
  }

  async approveOffer(adminId: string, offerId: string, input: ApproveProductOfferDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId, "admin");
      const offer = await tx.productOffer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException({ code: "PRODUCT_OFFER_NOT_FOUND", message: "Product offer not found." });
      if (offer.createdByAdminId === adminId) throw new ForbiddenException({ code: "PRODUCT_OFFER_SELF_APPROVAL_FORBIDDEN", message: "The offer author cannot approve the offer." });
      const item = await tx.itemDefinition.findUnique({ where: { id: offer.itemDefinitionId }, select: { status: true } });
      const blockers = [
        ...(item?.status === "published" ? [] : ["CATALOG_ITEM_NOT_PUBLISHED"]),
        ...(offer.healthState === "healthy" ? [] : ["LINK_HEALTH_NOT_HEALTHY"]),
        ...(offer.recallState === "clear" ? [] : ["RECALL_STATE_NOT_CLEAR"]),
        ...(offer.priceSnapshotKrw === null || (offer.priceCheckedAt && offer.priceCheckedAt >= new Date(Date.now() - 30 * 86_400_000)) ? [] : ["PRICE_STALE_OR_UNDATED"]),
        ...((offer.isAffiliate || offer.isSponsored) && !offer.disclosureText ? ["DISCLOSURE_REQUIRED"] : [])
      ];
      if (blockers.length) throw new ConflictException({ code: "PRODUCT_OFFER_APPROVAL_BLOCKED", message: "Product offer is not ready for approval.", blockers });
      const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
      const approvedAt = new Date();
      const changed = await tx.productOffer.updateMany({
        where: { id: offerId, updatedAt: expectedUpdatedAt, active: false },
        data: { active: true, approvedByAdminId: adminId, approvedAt }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "PRODUCT_OFFER_VERSION_CONFLICT", message: "Product offer changed before approval." });
      return tx.productOffer.findUniqueOrThrow({ where: { id: offerId } });
    });
  }

  async blockOffer(offerId: string, reason: "blocked" | "recalled") {
    const offer = await this.prisma.productOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException({ code: "PRODUCT_OFFER_NOT_FOUND", message: "Product offer not found." });
    return this.prisma.productOffer.update({ where: { id: offerId }, data: { active: false, ...(reason === "recalled" ? { recallState: "recalled" } : { healthState: "blocked" }) } });
  }

  async adminQueues() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 30 * 86_400_000);
    const items = await this.prisma.itemDefinition.findMany({
      where: { code: { startsWith: RELEASE4_ITEM_PREFIX } },
      select: { id: true, code: true, nameKo: true, status: true, safetyTier: true, reviewedAt: true, reviewedByAdminId: true, shortDescription: true, reasonText: true, timingSummary: true, sourceSummary: true }
    });
    const itemIds = items.map((item) => item.id);
    const itemById = new Map(items.map((item) => [item.id, item]));
    const target = (itemDefinitionId: string) => {
      const item = itemById.get(itemDefinitionId);
      return item ? { itemId: item.id, itemCode: item.code, itemName: item.nameKo } : null;
    };
    const [expiredRules, brokenOfferRows, staleOfferRows, reportRows] = await Promise.all([
      this.prisma.itemSafetyRule.findMany({ where: { itemDefinitionId: { in: itemIds }, expiresAt: { lt: now } }, select: { id: true, itemDefinitionId: true, expiresAt: true, severity: true } }),
      this.prisma.productOffer.findMany({ where: { itemDefinitionId: { in: itemIds }, OR: [{ healthState: { in: ["failed", "blocked"] } }, { recallState: { in: ["check_required", "recalled"] } }] }, orderBy: { updatedAt: "desc" }, take: 200 }),
      this.prisma.productOffer.findMany({ where: { itemDefinitionId: { in: itemIds }, OR: [{ priceCheckedAt: null }, { priceCheckedAt: { lt: staleBefore } }] }, orderBy: { updatedAt: "desc" }, take: 200 }),
      // A bounded operations queue must retain the newest actionable reports.
      // Oldest-first silently hides every new report once 200 rows accumulate.
      this.prisma.catalogItemReport.findMany({ where: { state: "open", OR: [{ itemDefinitionId: { in: itemIds } }, { itemDefinitionId: null }] }, orderBy: { createdAt: "desc" }, take: 200 })
    ]);
    const healthTopic = "product_link.health_check";
    const healthDedupeKey = (offer: (typeof brokenOfferRows)[number]) => `product-offer:${offer.id}:health:${offer.updatedAt.getTime()}`;
    const healthDedupeKeys = brokenOfferRows.map(healthDedupeKey);
    const healthOutboxes = healthDedupeKeys.length ? await this.prisma.jobOutbox.findMany({
      where: { topic: healthTopic, dedupeKey: { in: healthDedupeKeys } },
      select: { id: true, dedupeKey: true, publishedAt: true }
    }) : [];
    const healthOutboxByDedupe = new Map(healthOutboxes.map((outbox) => [outbox.dedupeKey, outbox]));
    const openHealthDlqKeys = healthDedupeKeys.length ? new Set((await this.prisma.deadLetterJob.findMany({
      where: { topic: healthTopic, dedupeKey: { in: healthDedupeKeys }, resolvedAt: null, cancelledAt: null },
      select: { dedupeKey: true }
    })).map((job) => job.dedupeKey)) : new Set<string>();
    const normalized = new Map<string, typeof items>();
    for (const item of items) normalized.set(normalizeSearch(item.nameKo), [...(normalized.get(normalizeSearch(item.nameKo)) ?? []), item]);
    const duplicateCandidates = [...normalized.entries()]
      .filter(([, candidates]) => candidates.length > 1)
      .map(([normalizedName, candidates]) => ({ normalizedName, targets: candidates.map((item) => ({ itemId: item.id, itemCode: item.code, itemName: item.nameKo })) }));
    const missingMetadata = items.flatMap((item) => {
      const missingFields = [
        ...(!item.shortDescription.trim() ? ["shortDescription"] : []),
        ...(!item.reasonText.trim() ? ["reasonText"] : []),
        ...(!item.timingSummary.trim() ? ["timingSummary"] : []),
        ...(!item.sourceSummary.trim() ? ["sourceSummary"] : [])
      ];
      return missingFields.length ? [{ ...target(item.id)!, missingFields }] : [];
    });
    const reviewRequired = items.filter((item) => item.status === "in_review" || (item.safetyTier === "high" && (!item.reviewedAt || !item.reviewedByAdminId)))
      .map((item) => ({ ...target(item.id)!, status: item.status, safetyTier: item.safetyTier, professionalReviewRequired: item.safetyTier === "high" && (!item.reviewedAt || !item.reviewedByAdminId) }));
    const expiredReviews = expiredRules.flatMap((rule) => {
      const itemTarget = target(rule.itemDefinitionId);
      return itemTarget ? [{ ...itemTarget, safetyRuleId: rule.id, severity: rule.severity, expiresAt: rule.expiresAt!.toISOString() }] : [];
    });
    const brokenOffers = brokenOfferRows.flatMap((offer) => {
      const itemTarget = target(offer.itemDefinitionId);
      if (!itemTarget) return [];
      const processorEligible = offer.healthState === "failed" && Boolean(offer.legacyProductLinkId) && offer.recallState !== "recalled";
      const dedupeKey = healthDedupeKey(offer);
      const outbox = healthOutboxByDedupe.get(dedupeKey);
      const healthCheckState = openHealthDlqKeys.has(dedupeKey) ? "dead_letter" : outbox?.publishedAt ? "processing" : outbox ? "queued" : processorEligible ? "available" : "unavailable";
      const retryEligible = healthCheckState === "available";
      const retryBlockedReason = healthCheckState === "queued" ? "HEALTH_RETRY_QUEUED"
        : healthCheckState === "processing" ? "HEALTH_RETRY_PROCESSING"
          : healthCheckState === "dead_letter" ? "HEALTH_RETRY_DEAD_LETTER"
            : retryEligible ? null
        : offer.recallState === "recalled" ? "RECALLED_OFFER_REQUIRES_MANUAL_REVIEW"
          : offer.healthState === "blocked" ? "BLOCKED_OFFER_REQUIRES_MANUAL_REVIEW"
            : !offer.legacyProductLinkId ? "NATIVE_OFFER_HEALTH_PROCESSOR_NOT_CONNECTED" : "HEALTH_RETRY_NOT_APPLICABLE";
      return [{ ...itemTarget, offerId: offer.id, seller: offer.seller, productName: offer.productName, healthState: offer.healthState, recallState: offer.recallState, healthCheckState, retryEligible, retryBlockedReason, updatedAt: offer.updatedAt.toISOString() }];
    });
    const staleOffers = staleOfferRows.flatMap((offer) => {
      const itemTarget = target(offer.itemDefinitionId);
      return itemTarget ? [{ ...itemTarget, offerId: offer.id, seller: offer.seller, productName: offer.productName, priceSnapshotKrw: offer.priceSnapshotKrw, priceCheckedAt: offer.priceCheckedAt?.toISOString() ?? null, refreshAvailable: false, refreshBlockedReason: "PRICE_PROVIDER_NOT_CONNECTED" }] : [];
    });
    const openReports = reportRows.flatMap((report) => {
      const itemTarget = report.itemDefinitionId ? target(report.itemDefinitionId) : null;
      return itemTarget || report.reasonCode === "missing_item"
        ? [{ ...(itemTarget ?? { itemId: null, itemCode: null, itemName: report.reportedText ?? "없는 품목 신고" }), reportId: report.id, reasonCode: report.reasonCode, detail: report.detail, createdAt: report.createdAt.toISOString() }]
        : [];
    });
    return {
      summary: {
        missingMetadata: missingMetadata.length, reviewRequired: reviewRequired.length,
        expiredReviews: expiredReviews.length, duplicateCandidates: duplicateCandidates.length,
        brokenOffers: brokenOffers.length, staleOffers: staleOffers.length, openReports: openReports.length
      },
      missingMetadata, reviewRequired, expiredReviews, duplicateCandidates, brokenOffers, staleOffers, openReports,
      capabilities: { offerHealthRetry: "legacy_product_link_only", priceRefresh: false }
    };
  }

  async retryOfferHealthCheck(offerId: string) {
    const offer = await this.prisma.productOffer.findUnique({
      where: { id: offerId },
      select: { id: true, legacyProductLinkId: true, healthState: true, recallState: true, updatedAt: true }
    });
    if (!offer) throw new NotFoundException({ code: "PRODUCT_OFFER_NOT_FOUND", message: "Product offer not found." });
    if (offer.healthState !== "failed") throw new ConflictException({ code: "PRODUCT_OFFER_HEALTH_RETRY_NOT_APPLICABLE", message: "Only failed offer health checks can be retried." });
    if (offer.recallState === "recalled") throw new ConflictException({ code: "PRODUCT_OFFER_RECALLED", message: "Recalled offers require manual review." });
    if (!offer.legacyProductLinkId) throw new ConflictException({ code: "PRODUCT_OFFER_HEALTH_PROCESSOR_UNAVAILABLE", message: "No health processor is connected for this offer." });
    const topic = "product_link.health_check";
    const dedupeKey = `product-offer:${offer.id}:health:${offer.updatedAt.getTime()}`;
    const existing = await this.prisma.jobOutbox.findUnique({ where: { topic_dedupeKey: { topic, dedupeKey } } });
    if (existing) {
      const inDeadLetter = await this.prisma.deadLetterJob.findFirst({ where: { topic, dedupeKey, resolvedAt: null, cancelledAt: null }, select: { id: true } });
      if (inDeadLetter) throw new ConflictException({ code: "PRODUCT_OFFER_HEALTH_RETRY_IN_DLQ", message: "Use the dead-letter workflow for this failed job." });
      return { queued: true, alreadyQueued: true, outboxId: existing.id, state: existing.publishedAt ? "processing" as const : "queued" as const };
    }
    const outbox = await this.prisma.jobOutbox.upsert({
      where: { topic_dedupeKey: { topic, dedupeKey } },
      create: { topic, aggregateType: "product_offer", aggregateId: offer.id, dedupeKey, payloadJson: { productLinkId: offer.legacyProductLinkId, productOfferId: offer.id } },
      update: { publishedAt: null, claimedAt: null, claimedBy: null, claimExpiresAt: null, visibleAt: new Date(), lastErrorCode: null }
    });
    return { queued: true, alreadyQueued: false, outboxId: outbox.id, state: "queued" as const };
  }

  async resolveItemReports(adminId: string, input: ResolveCatalogItemReportsDto) {
    const reportIds = [...new Set(input.reportIds)];
    if (reportIds.length !== input.reportIds.length) {
      throw new BadRequestException({ code: "CATALOG_REPORT_IDS_DUPLICATED", message: "Report ids must be unique." });
    }
    return this.prisma.$transaction(async (tx) => {
      const reports = await tx.catalogItemReport.findMany({ where: { id: { in: reportIds }, state: "open" }, select: { id: true, itemDefinitionId: true, userId: true } });
      if (reports.length !== reportIds.length) {
        throw new ConflictException({ code: "CATALOG_REPORT_SET_CHANGED", message: "One or more reports are no longer open." });
      }
      const linkedItemIds = [...new Set(reports.flatMap((report) => report.itemDefinitionId ? [report.itemDefinitionId] : []))];
      const release4Items = await tx.itemDefinition.count({ where: { id: { in: linkedItemIds }, code: { startsWith: RELEASE4_ITEM_PREFIX } } });
      if (release4Items !== linkedItemIds.length) {
        throw new BadRequestException({ code: "CATALOG_REPORT_NOT_RELEASE4", message: "Every report must belong to a Release 4 item." });
      }
      const resolvedAt = new Date();
      const changed = await tx.catalogItemReport.updateMany({
        where: { id: { in: reportIds }, state: "open" },
        data: { state: "resolved", resolvedByAdminId: adminId, resolvedAt, resolutionNote: input.note?.trim() || null }
      });
      if (changed.count !== reportIds.length) throw new ConflictException({ code: "CATALOG_REPORT_SET_CHANGED", message: "Report state changed during resolution." });
      let notificationQueuedCount = 0;
      for (const report of reports) {
        if (!report.userId) continue;
        const dedupeKey = `catalog-report:${report.id}:resolved`;
        const delivery = await tx.notificationDelivery.upsert({
          where: { dedupeKey },
          create: {
            userId: report.userId,
            targetType: report.itemDefinitionId ? "item" : null,
            targetId: report.itemDefinitionId,
            eventType: "catalog_report_resolved",
            dedupeKey,
            scheduledAt: resolvedAt
          },
          update: {}
        });
        await tx.jobOutbox.upsert({
          where: { topic_dedupeKey: { topic: "notification.send", dedupeKey } },
          create: { topic: "notification.send", aggregateType: "notification_delivery", aggregateId: delivery.id, dedupeKey, payloadJson: { notificationDeliveryId: delivery.id } },
          update: {}
        });
        notificationQueuedCount += 1;
      }
      return { resolvedCount: changed.count, reportIds, resolvedAt, notificationQueuedCount };
    });
  }

  async resolveItemReport(adminId: string, reportId: string) {
    const report = await this.prisma.catalogItemReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException({ code: "CATALOG_ITEM_REPORT_NOT_FOUND", message: "Catalog item report not found." });
    await this.resolveItemReports(adminId, { reportIds: [reportId] });
    return this.prisma.catalogItemReport.findUniqueOrThrow({ where: { id: reportId } });
  }

  private async queueSafetyImpact(
    tx: Prisma.TransactionClient,
    item: ItemDefinition,
    eventType: "blocked" | "recalled",
    reason: string
  ) {
    const affectedPlans = await tx.userItemPlan.findMany({
      where: {
        itemDefinitionId: item.id,
        state: { in: ["need", "researching", "planned", "ordered", "owned", "borrowed", "rented", "gift_expected", "gifted", "replacement_needed", "replacement_due"] }
      },
      select: { id: true, householdId: true, childId: true }
    });
    for (const plan of affectedPlans) {
      await tx.catalogSafetyAlert.upsert({
        where: { userItemPlanId_eventType_itemContentVersion: { userItemPlanId: plan.id, eventType, itemContentVersion: item.contentVersion } },
        create: { itemDefinitionId: item.id, userItemPlanId: plan.id, eventType, reason, itemContentVersion: item.contentVersion },
        update: {}
      });
    }
    const householdIds = [...new Set(affectedPlans.map((plan) => plan.householdId))];
    const recipients = householdIds.length ? await tx.householdMember.findMany({
      where: { householdId: { in: householdIds }, status: "active", role: { not: "gift_participant" } },
      select: { householdId: true, userId: true }
    }) : [];
    const recipientsByHousehold = new Map<string, string[]>();
    for (const recipient of recipients) {
      recipientsByHousehold.set(recipient.householdId, [
        ...(recipientsByHousehold.get(recipient.householdId) ?? []),
        recipient.userId
      ]);
    }
    let notificationQueuedCount = 0;
    for (const plan of affectedPlans) {
      for (const userId of [...new Set(recipientsByHousehold.get(plan.householdId) ?? [])]) {
        const dedupeKey = `catalog-safety:${eventType}:${item.id}:${plan.id}:${item.contentVersion}:${userId}`;
        const delivery = await tx.notificationDelivery.upsert({
          where: { dedupeKey },
          create: {
            userId,
            householdId: plan.householdId,
            childId: plan.childId,
            targetType: "item",
            targetId: item.id,
            eventType: eventType === "recalled" ? "catalog_item_recalled" : "catalog_item_blocked",
            dedupeKey,
            scheduledAt: new Date()
          },
          update: {}
        });
        await tx.jobOutbox.upsert({
          where: { topic_dedupeKey: { topic: "notification.send", dedupeKey } },
          create: { topic: "notification.send", aggregateType: "notification_delivery", aggregateId: delivery.id, dedupeKey, payloadJson: { notificationDeliveryId: delivery.id } },
          update: {}
        });
        notificationQueuedCount += 1;
      }
    }
    return { affectedPlanCount: affectedPlans.length, alertCount: affectedPlans.length, notificationQueuedCount };
  }

  async transitionItem(adminId: string, itemId: string, input: TransitionCatalogItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemDefinition.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
      this.assertRevision(item, input);
      const allowlist: Partial<Record<CatalogReviewStatus, CatalogReviewStatus[]>> = {
        review_requested: ["editorial_review", "changes_requested"],
        editorial_review: ["changes_requested"],
        domain_review: ["changes_requested"],
        safety_review: ["changes_requested"],
        in_review: ["editorial_review", "changes_requested"],
        changes_requested: ["draft"],
        approved: ["scheduled", "archived"],
        scheduled: ["approved", "suspended"],
        published: ["suspended", "recalled"],
        suspended: ["approved", "archived"],
        recalled: ["archived"],
        retired: ["archived"]
      };
      if (!allowlist[item.status]?.includes(input.toStatus)) {
        throw new ConflictException({ code: "CATALOG_TRANSITION_FORBIDDEN", message: `${item.status} cannot transition to ${input.toStatus}.` });
      }
      if (input.toStatus === "editorial_review") {
        await this.requireReviewerCredential(tx, adminId, "editorial");
        if (item.lastEditedByAdminId === adminId) throw new ForbiddenException({ code: "CATALOG_SELF_REVIEW_FORBIDDEN", message: "The revision author cannot claim review." });
      } else if (input.toStatus === "changes_requested") {
        const reviewType = item.status === "domain_review" ? "domain" : item.status === "safety_review" ? "safety" : "editorial";
        await this.requireReviewerCredential(tx, adminId, reviewType);
        if (item.lastEditedByAdminId === adminId) throw new ForbiddenException({ code: "CATALOG_SELF_REVIEW_FORBIDDEN", message: "The revision author cannot review their own change." });
        if (!input.reason) throw new BadRequestException({ code: "CATALOG_TRANSITION_REASON_REQUIRED", message: "Changes requested requires a reason." });
      } else if (input.toStatus === "draft") {
        await this.requireActiveAdmin(tx, adminId);
        if (item.lastEditedByAdminId !== adminId) throw new ForbiddenException({ code: "CATALOG_AUTHOR_MISMATCH", message: "Only the revision author can resume a requested change." });
      } else if (input.toStatus === "scheduled") {
        await this.requireActiveAdmin(tx, adminId, "admin");
        const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
        if (!scheduledAt || scheduledAt <= new Date()) throw new BadRequestException({ code: "CATALOG_SCHEDULE_FUTURE_REQUIRED", message: "Scheduled publication requires a future timestamp." });
        const approvals = await tx.catalogItemApproval.findMany({ where: { itemDefinitionId: itemId, revision: item.contentVersion, contentHash: input.contentHash } });
        if (item.lastEditedByAdminId === adminId || approvals.some((approval) => approval.reviewedByAdminId === adminId)) {
          throw new ForbiddenException({ code: "CATALOG_PUBLISHER_SEPARATION_REQUIRED", message: "The author and reviewers cannot schedule publication." });
        }
      } else {
        await this.requireActiveAdmin(tx, adminId, "admin");
        if ((input.toStatus === "recalled" || (item.status === "published" && input.toStatus === "suspended")) && !input.reason) throw new BadRequestException({ code: "CATALOG_TRANSITION_REASON_REQUIRED", message: "Safety suspension or recall requires a reason." });
      }
      const safetyEvent = item.status === "published" && input.toStatus === "recalled" ? "recalled" as const
        : item.status === "published" && input.toStatus === "suspended" ? "blocked" as const
          : null;
      const scheduledAt = input.toStatus === "scheduled" ? new Date(input.scheduledAt!) : input.toStatus === "approved" ? null : item.scheduledAt;
      const changed = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion, contentHash: input.contentHash, status: item.status },
        data: {
          status: input.toStatus,
          scheduledAt,
          ...(safetyEvent ? { recommendationState: "recalled_or_blocked" as const } : {})
        }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed during transition." });
      await this.workflowEvent(tx, {
        itemDefinitionId: itemId, actorAdminId: adminId, revision: item.contentVersion, contentHash: input.contentHash,
        fromStatus: item.status, toStatus: input.toStatus,
        metadata: { reason: input.reason ?? null, scheduledAt: input.scheduledAt ?? null }
      });
      const safetyImpact = safetyEvent ? await this.queueSafetyImpact(tx, item, safetyEvent, input.reason!) : null;
      const updated = await tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
      return { ...updated, safetyImpact };
    });
  }

  async requestItemReview(adminId: string, itemId: string, input: RequestCatalogItemReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId);
      const item = await tx.itemDefinition.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
      this.assertRevision(item, input);
      if (!["draft", "changes_requested", "in_review"].includes(item.status)) {
        throw new ConflictException({ code: "CATALOG_TRANSITION_FORBIDDEN", message: `Cannot request review from ${item.status}.` });
      }
      if (item.lastEditedByAdminId && item.lastEditedByAdminId !== adminId) {
        throw new ForbiddenException({ code: "CATALOG_AUTHOR_MISMATCH", message: "Only the current revision author can request review." });
      }
      const changed = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion, contentHash: input.contentHash, status: item.status },
        data: { status: "review_requested", lastEditedByAdminId: adminId }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed before review was requested." });
      await this.workflowEvent(tx, {
        itemDefinitionId: itemId, actorAdminId: adminId, revision: input.expectedVersion, contentHash: input.contentHash,
        fromStatus: item.status, toStatus: "review_requested"
      });
      return tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    });
  }

  async reviewItem(adminId: string, itemId: string, input: ReviewCatalogItemDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.itemDefinition.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
        this.assertRevision(item, input);
        await this.requireReviewerCredential(tx, adminId, input.reviewType);
        if (item.lastEditedByAdminId === adminId) {
          throw new ForbiddenException({ code: "CATALOG_SELF_REVIEW_FORBIDDEN", message: "The revision author cannot review their own catalog change." });
        }
        const allowedStatuses: Record<typeof input.reviewType, CatalogReviewStatus[]> = {
          editorial: ["review_requested", "editorial_review", "in_review"],
          domain: ["domain_review"],
          safety: ["safety_review"]
        };
        if (!allowedStatuses[input.reviewType].includes(item.status)) {
          throw new ConflictException({ code: "CATALOG_TRANSITION_FORBIDDEN", message: `${input.reviewType} review is not allowed from ${item.status}.` });
        }
        if (input.reviewType === "safety" && item.safetyTier !== "high") {
          throw new BadRequestException({ code: "CATALOG_SAFETY_REVIEW_NOT_REQUIRED", message: "Safety review is reserved for high-risk items." });
        }
        if (input.reviewType === "safety" && (!input.professionalReviewConfirmed || !input.evidenceUrl || !input.evidenceTitle)) {
          throw new BadRequestException({ code: "PROFESSIONAL_REVIEW_REQUIRED", message: "High-risk items require explicit professional confirmation and evidence." });
        }
        const reviewedAt = new Date();
        const expiresAt = input.reviewExpiresOn ? new Date(`${input.reviewExpiresOn}T23:59:59.999Z`) : null;
        await tx.catalogItemApproval.create({
          data: {
            itemDefinitionId: itemId, revision: item.contentVersion, contentHash: input.contentHash,
            approvalType: input.reviewType, reviewedByAdminId: adminId,
            evidenceUrl: input.evidenceUrl, evidenceTitle: input.evidenceTitle, expiresAt
          }
        });
        if (input.reviewType === "safety" && input.evidenceUrl && input.evidenceTitle) {
          await tx.itemEvidenceSource.create({
            data: { itemDefinitionId: itemId, sourceType: "professional_review", title: input.evidenceTitle, publicUrl: input.evidenceUrl, checkedAt: reviewedAt }
          });
          await tx.itemSafetyRule.updateMany({
            where: { itemDefinitionId: itemId, severity: "high" }, data: { reviewedAt, expiresAt }
          });
        }
        const nextStatus: CatalogReviewStatus = input.reviewType === "editorial"
          ? "domain_review"
          : input.reviewType === "domain" && item.safetyTier === "high"
            ? "safety_review"
            : "approved";
        const changed = await tx.itemDefinition.updateMany({
          where: { id: itemId, contentVersion: input.expectedVersion, contentHash: input.contentHash, status: item.status },
          data: { status: nextStatus, reviewedAt, reviewedByAdminId: adminId }
        });
        if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Catalog item changed during review." });
        await this.workflowEvent(tx, {
          itemDefinitionId: itemId, actorAdminId: adminId, revision: item.contentVersion, contentHash: input.contentHash,
          fromStatus: item.status, toStatus: nextStatus, metadata: { reviewType: input.reviewType }
        });
        return tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException({ code: "CATALOG_APPROVAL_ALREADY_RECORDED", message: "This revision already has that approval type." });
      }
      throw error;
    }
  }

  async publishItem(adminId: string, itemId: string, input: PublishCatalogItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireActiveAdmin(tx, adminId, "admin");
      const item = await tx.itemDefinition.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
      this.assertRevision(item, input);
      if (item.status !== "approved" && item.status !== "scheduled") {
        throw new ConflictException({ code: "CATALOG_TRANSITION_FORBIDDEN", message: `Cannot publish from ${item.status}.` });
      }
      if (item.status === "scheduled" && (!item.scheduledAt || item.scheduledAt > new Date())) {
        throw new ConflictException({ code: "CATALOG_SCHEDULE_NOT_DUE", message: "Scheduled publication is not due yet." });
      }
      const [categoryCount, lifecycleCount, highRules, evidenceCount, approvals] = await Promise.all([
        tx.itemDefinitionCategory.count({ where: { itemDefinitionId: itemId, isPrimary: true } }),
        tx.itemLifecycleRule.count({ where: { itemDefinitionId: itemId } }),
        tx.itemSafetyRule.findMany({ where: { itemDefinitionId: itemId, severity: "high" } }),
        tx.itemEvidenceSource.count({ where: { itemDefinitionId: itemId } }),
        tx.catalogItemApproval.findMany({ where: { itemDefinitionId: itemId, revision: item.contentVersion, contentHash: input.contentHash } })
      ]);
      const requiredTypes = item.safetyTier === "high" ? ["editorial", "domain", "safety"] as const : ["editorial", "domain"] as const;
      const errors: string[] = [];
      if (!item.reasonText.trim() || !item.timingSummary.trim() || !item.sourceSummary.trim()) errors.push("required editorial fields");
      if (categoryCount !== 1) errors.push("exactly one primary category");
      if (lifecycleCount < 1) errors.push("at least one lifecycle");
      if (requiredTypes.some((type) => !approvals.some((approval) => approval.approvalType === type))) errors.push("current revision approvals");
      if (approvals.some((approval) => approval.expiresAt && approval.expiresAt <= new Date())) errors.push("unexpired approvals");
      if (item.safetyTier === "high" && (evidenceCount < 1 || highRules.some((rule) => !rule.reviewedAt || (rule.expiresAt && rule.expiresAt <= new Date())))) errors.push("professional safety evidence");
      if (
        item.safetyTier === "high" &&
        !["professional_review_required", "not_recommended", "recalled_or_blocked"].includes(item.recommendationState)
      ) {
        errors.push("high-risk recommendation state");
      }
      if (errors.length) throw new BadRequestException({ code: "CATALOG_PUBLISH_GATE_FAILED", message: "Catalog publish gate failed.", details: errors });
      if (item.lastEditedByAdminId === adminId || approvals.some((approval) => approval.reviewedByAdminId === adminId)) {
        throw new ForbiddenException({ code: "CATALOG_PUBLISHER_SEPARATION_REQUIRED", message: "The author and reviewers cannot publish this revision." });
      }
      for (const approval of approvals) {
        await this.requireReviewerCredential(tx, approval.reviewedByAdminId, approval.approvalType);
      }
      const publishedAt = new Date();
      const changed = await tx.itemDefinition.updateMany({
        where: { id: itemId, contentVersion: input.expectedVersion, contentHash: input.contentHash, status: item.status },
        data: { status: "published", publishedByAdminId: adminId, publishedAt, scheduledAt: null }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_PUBLISH_CONFLICT", message: "Catalog item was published or changed concurrently." });
      await this.workflowEvent(tx, {
        itemDefinitionId: itemId, actorAdminId: adminId, revision: item.contentVersion, contentHash: input.contentHash,
        fromStatus: item.status, toStatus: "published"
      });
      return tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    });
  }

  async publishDueItems(limit = 50) {
    const dueItems = await this.prisma.itemDefinition.findMany({
      where: { status: "scheduled", scheduledAt: { lte: new Date() } },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: Math.max(1, Math.min(limit, 100)),
      select: { id: true, code: true, contentVersion: true, contentHash: true }
    });
    const results: Array<{ itemId: string; code: string; status: "published" | "concurrent" | "blocked"; reason?: string }> = [];
    for (const item of dueItems) {
      const scheduleEvent = await this.prisma.catalogItemWorkflowEvent.findFirst({
        where: {
          itemDefinitionId: item.id,
          revision: item.contentVersion,
          contentHash: item.contentHash ?? "",
          toStatus: "scheduled"
        },
        orderBy: { createdAt: "desc" },
        select: { actorAdminId: true }
      });
      if (!item.contentHash || !scheduleEvent) {
        results.push({ itemId: item.id, code: item.code, status: "blocked", reason: "CATALOG_SCHEDULE_PROVENANCE_MISSING" });
        continue;
      }
      try {
        await this.publishItem(scheduleEvent.actorAdminId, item.id, {
          expectedVersion: item.contentVersion,
          contentHash: item.contentHash
        });
        results.push({ itemId: item.id, code: item.code, status: "published" });
      } catch (error) {
        if (error instanceof ConflictException) {
          results.push({ itemId: item.id, code: item.code, status: "concurrent", reason: "CATALOG_PUBLISH_CONFLICT" });
          continue;
        }
        if (error instanceof BadRequestException || error instanceof ForbiddenException) {
          const response = error.getResponse();
          const reason = typeof response === "object" && response && "code" in response && typeof response.code === "string"
            ? response.code
            : "CATALOG_SCHEDULE_PUBLISH_BLOCKED";
          results.push({ itemId: item.id, code: item.code, status: "blocked", reason });
          continue;
        }
        throw error;
      }
    }
    return {
      scanned: dueItems.length,
      published: results.filter((result) => result.status === "published").length,
      concurrent: results.filter((result) => result.status === "concurrent").length,
      blocked: results.filter((result) => result.status === "blocked").length,
      results
    };
  }
}
