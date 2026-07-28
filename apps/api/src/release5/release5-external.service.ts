import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type ItemAlternative } from "@prisma/client";
import { AppConfigService } from "../app-config/app-config.service";
import { requirePlanReader } from "../common/authorization/plan-reader";
import { normalizePublicHttpsUrl } from "../common/security/public-https-url";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { ApproveSafetyAlternativeDto, CreateSafetyAlternativeDto, MerchantFeedRowDto, PreviewMerchantFeedDto, RecallProviderEventDto, ReviewMerchantFeedRowDto, ReviewRecallEventDto } from "./dto/release5-external.dto";
import {
  currentReviewedEvidenceWhere,
  evidenceHasClaim,
  evidenceHasIndependentCaptureAndReview,
  safetyAlternativeClaim,
  safetyApprovalHasIndependentActors
} from "./item-evidence-policy";

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function publicHttps(value: string) {
  return normalizePublicHttpsUrl(value);
}

function isSerializationFailure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === "P2034" ||
      (error.code === "P2010" && String(error.meta?.code ?? "") === "40001")
    );
  }
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "40001"
  );
}

function alternativeSnapshot(row: ItemAlternative | null) {
  if (!row) return null;
  return {
    itemDefinitionId: row.itemDefinitionId,
    alternativeItemDefinitionId: row.alternativeItemDefinitionId,
    reason: row.reason,
    evidenceSourceId: row.evidenceSourceId,
    approvedByAdminId: row.approvedByAdminId,
    safetyApprovedAt: row.safetyApprovedAt?.toISOString() ?? null,
    active: row.active
  };
}

export function recallSigningPayload(input: Omit<RecallProviderEventDto, "signature">) {
  return JSON.stringify({
    providerKey: input.providerKey,
    eventId: input.eventId,
    eventVersion: input.eventVersion,
    status: input.status,
    canonicalItemId: input.canonicalItemId ?? null,
    title: input.title,
    guidance: input.guidance,
    sourceUrl: input.sourceUrl ?? null,
    occurredAt: input.occurredAt,
    payload: input.payload
  });
}

@Injectable()
export class Release5ExternalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfig: AppConfigService
  ) {}

  private async lockSafetyAlternative(
    tx: Prisma.TransactionClient,
    itemDefinitionId: string,
    alternativeItemDefinitionId: string
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT TRUE AS locked
      FROM (
        SELECT pg_advisory_xact_lock(
          hashtext(${`${itemDefinitionId}:${alternativeItemDefinitionId}`})
        )
      ) AS acquired
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT item_definition_id
      FROM item_alternatives
      WHERE item_definition_id = ${itemDefinitionId}::uuid
        AND alternative_item_definition_id = ${alternativeItemDefinitionId}::uuid
      FOR UPDATE
    `);
  }

  private async lockSafetyApprovalInputs(
    tx: Prisma.TransactionClient,
    itemDefinitionId: string,
    alternativeItemDefinitionId: string,
    evidenceSourceId: string
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM item_definitions
      WHERE id IN (
        ${Prisma.sql`${itemDefinitionId}::uuid`},
        ${Prisma.sql`${alternativeItemDefinitionId}::uuid`}
      )
      ORDER BY id
      FOR SHARE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM item_evidence_sources
      WHERE id = ${evidenceSourceId}::uuid
      FOR SHARE
    `);
  }

  private async auditSafetyAlternative(
    tx: Prisma.TransactionClient,
    input: {
      actorAdminId: string;
      action: "create" | "replace" | "deactivate" | "activate";
      itemDefinitionId: string;
      before: ItemAlternative | null;
      after: ItemAlternative;
      evidence?: {
        id: string;
        contentHash: string | null;
        revision: number;
        capturedByAdminId: string | null;
        reviewedByAdminId: string | null;
      };
    }
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorAdminId,
        action: `release5.safety-alternative.${input.action}`,
        targetType: "item_alternative",
        targetId: input.itemDefinitionId,
        beforeJson: alternativeSnapshot(input.before) as Prisma.InputJsonValue,
        afterJson: {
          mapping: alternativeSnapshot(input.after),
          ...(input.evidence
            ? {
                evidence: {
                  ...input.evidence,
                  activatorAdminId: input.actorAdminId
                }
              }
            : {})
        } as Prisma.InputJsonValue
      }
    });
  }

  private async requireExternal(flag: "external_recall_provider" | "merchant_offer_comparison", integration: "recall" | "merchant") {
    if (process.env.NODE_ENV !== "production" && process.env.RELEASE5_INTERNAL_FEATURES === "1") return "SANDBOX" as const;
    const current = await this.appConfig.get();
    if (current.source !== "database" || !current.config.featureFlags[flag]) throw new NotFoundException({ code: "FEATURE_DISABLED", message: "This integration is not active." });
    const ready = integration === "recall"
      ? process.env.RECALL_PROVIDER_MODE === "live" && Boolean(process.env.RECALL_PROVIDER_WEBHOOK_SECRET)
      : process.env.MERCHANT_FEED_MODE === "live" && Boolean(process.env.MERCHANT_FEED_CREDENTIAL);
    if (!ready) throw new ServiceUnavailableException({ code: "EXTERNAL_CREDENTIAL_MISSING", message: "The external integration is not configured." });
    return "LIVE" as const;
  }

  async ingestRecall(input: RecallProviderEventDto) {
    const providerMode = await this.requireExternal("external_recall_provider", "recall");
    const secret = process.env.RECALL_PROVIDER_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException({ code: "RECALL_SIGNATURE_SECRET_MISSING", message: "Recall signature validation is unavailable." });
    const { signature, ...unsigned } = input;
    const expected = createHmac("sha256", secret).update(recallSigningPayload(unsigned)).digest("hex");
    const left = Buffer.from(signature, "hex");
    const right = Buffer.from(expected, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ForbiddenException({ code: "RECALL_SIGNATURE_INVALID", message: "Recall signature is invalid." });
    const sourceUrl = input.sourceUrl ? (() => { try { return publicHttps(input.sourceUrl); } catch { throw new BadRequestException({ code: "RECALL_SOURCE_URL_BLOCKED", message: "Recall source must use a public HTTPS URL." }); } })() : null;
    const item = input.canonicalItemId ? await this.prisma.itemDefinition.findUnique({ where: { id: input.canonicalItemId }, select: { id: true } }) : null;
    if (input.canonicalItemId && !item) throw new BadRequestException({ code: "RECALL_CANONICAL_ITEM_NOT_FOUND", message: "Canonical item not found." });
    const normalized = { ...unsigned, canonicalItemId: item?.id ?? null, sourceUrl };
    const payloadHash = sha256(normalized);
    const duplicate = await this.prisma.recallProviderEvent.findUnique({ where: { providerKey_providerEventId_providerVersion: { providerKey: input.providerKey, providerEventId: input.eventId, providerVersion: input.eventVersion } } });
    if (duplicate) {
      if (duplicate.payloadHash !== payloadHash) throw new ConflictException({ code: "RECALL_EVENT_VERSION_CONFLICT", message: "The provider reused an event version with different content." });
      return { duplicate: true, providerMode, event: duplicate };
    }
    const latest = await this.prisma.recallProviderEvent.findFirst({ where: { providerKey: input.providerKey, providerEventId: input.eventId }, orderBy: { providerVersion: "desc" } });
    if (latest && input.eventVersion <= latest.providerVersion) throw new ConflictException({ code: "RECALL_EVENT_VERSION_STALE", message: "Recall event version must increase." });
    const created = await this.prisma.recallProviderEvent.create({
      data: {
        providerKey: input.providerKey,
        providerEventId: input.eventId,
        providerVersion: input.eventVersion,
        eventStatus: input.status,
        payloadHash,
        rawPayloadJson: normalized as unknown as Prisma.InputJsonValue,
        rawPayloadExpiresAt: new Date(Date.now() + 90 * 86_400_000),
        signatureValid: true,
        itemDefinitionId: item?.id ?? null,
        matchConfidence: item ? 1 : 0,
        reviewState: "pending",
        normalizedGuidance: input.guidance.trim(),
        sourceUrl,
        occurredAt: new Date(input.occurredAt)
      }
    });
    return { duplicate: false, providerMode, event: created };
  }

  async recallWorklist() {
    return { events: await this.prisma.recallProviderEvent.findMany({ where: { reviewState: "pending" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 }) };
  }

  async reviewRecall(adminId: string, eventId: string, input: ReviewRecallEventDto) {
    const event = await this.prisma.recallProviderEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException({ code: "RECALL_EVENT_NOT_FOUND", message: "Recall event not found." });
    if (event.eventStatus === "unknown" && input.decision === "approve") throw new ConflictException({ code: "RECALL_UNKNOWN_NOT_SAFE", message: "Unknown recall state cannot be approved as safe." });
    const itemId = input.canonicalItemId ?? event.itemDefinitionId;
    if (input.decision === "approve" && !itemId) throw new ConflictException({ code: "RECALL_ITEM_MATCH_REQUIRED", message: "Manual canonical item matching is required." });
    if (itemId && !(await this.prisma.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true } }))) throw new BadRequestException({ code: "RECALL_CANONICAL_ITEM_NOT_FOUND", message: "Canonical item not found." });
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.recallProviderEvent.updateMany({ where: { id: event.id, version: input.expectedVersion, reviewState: "pending" }, data: { reviewState: input.decision === "approve" ? "approved" : "rejected", itemDefinitionId: itemId, reviewedByAdminId: adminId, reviewedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException({ code: "RECALL_REVIEW_CONFLICT", message: "Recall event changed before review." });
      if (input.decision === "approve" && itemId && ["recalled", "corrected"].includes(event.eventStatus)) await this.queueRecallImpact(tx, itemId, event);
      return tx.recallProviderEvent.findUniqueOrThrow({ where: { id: event.id } });
    });
  }

  private async queueRecallImpact(tx: Prisma.TransactionClient, itemId: string, event: { normalizedGuidance: string; eventStatus: string }) {
    const item = await tx.itemDefinition.findUniqueOrThrow({ where: { id: itemId }, select: { contentVersion: true } });
    const eventType = `provider_${event.eventStatus}`;
    const plans = await tx.userItemPlan.findMany({
      where: { itemDefinitionId: itemId, state: { in: ["need", "researching", "planned", "ordered", "owned", "borrowed", "rented", "gift_expected", "gifted", "replacement_needed", "replacement_due"] } },
      select: { id: true, householdId: true, childId: true }
    });
    if (plans.length === 0) return;

    await tx.catalogSafetyAlert.createMany({
      data: plans.map((plan) => ({ itemDefinitionId: itemId, userItemPlanId: plan.id, eventType, reason: event.normalizedGuidance, itemContentVersion: item.contentVersion })),
      skipDuplicates: true
    });
    const alerts = await tx.catalogSafetyAlert.findMany({
      where: { userItemPlanId: { in: plans.map((plan) => plan.id) }, eventType, itemContentVersion: item.contentVersion },
      select: { id: true, userItemPlanId: true }
    });
    const householdIds = [...new Set(plans.map((plan) => plan.householdId))];
    const members = await tx.householdMember.findMany({
      where: { householdId: { in: householdIds }, status: "active", role: { not: "gift_participant" } },
      select: { householdId: true, userId: true }
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const membersByHousehold = new Map<string, typeof members>();
    for (const member of members) {
      const householdMembers = membersByHousehold.get(member.householdId) ?? [];
      householdMembers.push(member);
      membersByHousehold.set(member.householdId, householdMembers);
    }
    const scheduledAt = new Date();
    const deliveryRows = alerts.flatMap((alert) => {
      const plan = planById.get(alert.userItemPlanId);
      if (!plan) return [];
      return (membersByHousehold.get(plan.householdId) ?? []).map((member) => {
        const dedupeKey = `provider-recall:${alert.id}:${member.userId}`;
        return { userId: member.userId, householdId: plan.householdId, childId: plan.childId, targetType: "item", targetId: itemId, eventType: "catalog_item_recalled", dedupeKey, scheduledAt };
      });
    });
    if (deliveryRows.length === 0) return;

    await tx.notificationDelivery.createMany({ data: deliveryRows, skipDuplicates: true });
    const deliveries = await tx.notificationDelivery.findMany({
      where: { dedupeKey: { in: deliveryRows.map((delivery) => delivery.dedupeKey) } },
      select: { id: true, dedupeKey: true }
    });
    await tx.jobOutbox.createMany({
      data: deliveries.map((delivery) => ({
        topic: "notification.send",
        aggregateType: "notification_delivery",
        aggregateId: delivery.id,
        dedupeKey: delivery.dedupeKey,
        payloadJson: { notificationDeliveryId: delivery.id }
      })),
      skipDuplicates: true
    });
  }

  async previewMerchantFeed(adminId: string, input: PreviewMerchantFeedDto) {
    await this.requireExternal("merchant_offer_comparison", "merchant");
    const itemIds = [...new Set(input.rows.map((row) => row.itemDefinitionId))];
    const items = await this.prisma.itemDefinition.findMany({ where: { id: { in: itemIds } }, select: { id: true } });
    const existingItems = new Set(items.map((item) => item.id));
    const prepared = input.rows.map((row, rowIndex) => this.validateMerchantRow(row, rowIndex, existingItems));
    const sourceHash = sha256({ sourceName: input.sourceName.trim(), rows: prepared.map((row) => row.contentHash) });
    const existing = await this.prisma.merchantFeedImport.findUnique({ where: { sourceHash } });
    if (existing) return { duplicate: true, import: existing, rows: await this.prisma.merchantFeedRow.findMany({ where: { importId: existing.id }, orderBy: { rowIndex: "asc" } }) };
    const created = await this.prisma.$transaction(async (tx) => {
      const feed = await tx.merchantFeedImport.create({ data: { requestedByAdminId: adminId, sourceName: input.sourceName.trim(), sourceHash, state: "preview_ready", resultJson: { valid: prepared.filter((row) => row.errors.length === 0).length, invalid: prepared.filter((row) => row.errors.length > 0).length } } });
      await tx.merchantFeedRow.createMany({
        data: prepared.map((row) => ({
          importId: feed.id,
          rowIndex: row.rowIndex,
          merchantIdentity: row.input.merchantIdentity,
          itemDefinitionId: existingItems.has(row.input.itemDefinitionId) ? row.input.itemDefinitionId : null,
          productName: row.input.productName.trim(),
          publicUrl: row.publicUrl,
          priceKrw: row.input.priceKrw,
          currency: row.input.currency,
          stockState: row.input.stockState,
          shippingJson: row.input.shipping as Prisma.InputJsonValue | undefined,
          affiliate: row.input.affiliate ?? false,
          disclosureText: row.input.disclosureText?.trim() || null,
          priceCheckedAt: new Date(row.input.priceCheckedAt),
          contentHash: row.contentHash,
          validationState: row.errors.length ? "invalid" : "valid",
          validationErrors: row.errors
        }))
      });
      return feed;
    });
    return { duplicate: false, import: created, rows: await this.prisma.merchantFeedRow.findMany({ where: { importId: created.id }, orderBy: { rowIndex: "asc" } }) };
  }

  private validateMerchantRow(input: MerchantFeedRowDto, rowIndex: number, existingItems: Set<string>) {
    const errors: string[] = [];
    let publicUrl = input.publicUrl;
    try { publicUrl = publicHttps(input.publicUrl); } catch { errors.push("PUBLIC_URL_BLOCKED"); }
    if (!existingItems.has(input.itemDefinitionId)) errors.push("CANONICAL_ITEM_NOT_FOUND");
    if (input.priceKrw < 0) errors.push("PRICE_INVALID");
    if (input.currency !== "KRW") errors.push("CURRENCY_UNSUPPORTED");
    const checkedAt = new Date(input.priceCheckedAt);
    if (checkedAt.getTime() > Date.now() + 300_000 || checkedAt.getTime() < Date.now() - 30 * 86_400_000) errors.push("PRICE_STALE_OR_FUTURE");
    if (input.affiliate && !input.disclosureText?.trim()) errors.push("AFFILIATE_DISCLOSURE_REQUIRED");
    return { input, rowIndex, publicUrl, errors, contentHash: sha256({ ...input, publicUrl }) };
  }

  async reviewMerchantRow(adminId: string, rowId: string, input: ReviewMerchantFeedRowDto) {
    const row = await this.prisma.merchantFeedRow.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException({ code: "MERCHANT_FEED_ROW_NOT_FOUND", message: "Merchant feed row not found." });
    const feed = await this.prisma.merchantFeedImport.findUniqueOrThrow({ where: { id: row.importId } });
    if (feed.requestedByAdminId === adminId) throw new ForbiddenException({ code: "MERCHANT_FEED_SELF_REVIEW_FORBIDDEN", message: "Feed importer cannot review their own rows." });
    if (input.decision === "approve" && row.validationState !== "valid") throw new ConflictException({ code: "MERCHANT_FEED_ROW_INVALID", message: "Invalid feed rows cannot be approved." });
    const changed = await this.prisma.merchantFeedRow.updateMany({ where: { id: row.id, reviewState: "pending" }, data: { reviewState: input.decision === "approve" ? "approved" : "rejected", reviewedByAdminId: adminId, reviewedAt: new Date() } });
    if (changed.count !== 1) throw new ConflictException({ code: "MERCHANT_FEED_REVIEW_CONFLICT", message: "Feed row was already reviewed." });
    return this.prisma.merchantFeedRow.findUniqueOrThrow({ where: { id: row.id } });
  }

  async publishMerchantRow(adminId: string, rowId: string) {
    await this.requireExternal("merchant_offer_comparison", "merchant");
    const row = await this.prisma.merchantFeedRow.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException({ code: "MERCHANT_FEED_ROW_NOT_FOUND", message: "Merchant feed row not found." });
    const feed = await this.prisma.merchantFeedImport.findUniqueOrThrow({ where: { id: row.importId } });
    if (!row.itemDefinitionId || row.reviewState !== "approved" || !row.reviewedByAdminId) throw new ConflictException({ code: "MERCHANT_FEED_ROW_NOT_APPROVED", message: "Only approved mapped rows can be published." });
    if ([feed.requestedByAdminId, row.reviewedByAdminId].includes(adminId)) throw new ForbiddenException({ code: "MERCHANT_FEED_PUBLISHER_SEPARATION_REQUIRED", message: "Importer, reviewer, and publisher must be separate operators." });
    const item = await this.prisma.itemDefinition.findUniqueOrThrow({ where: { id: row.itemDefinitionId }, select: { status: true } });
    if (item.status !== "published") throw new ConflictException({ code: "MERCHANT_OFFER_ITEM_NOT_PUBLISHED", message: "Offers cannot publish before the canonical item." });
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.productOffer.create({ data: { itemDefinitionId: row.itemDefinitionId!, seller: row.merchantIdentity, merchantIdentity: row.merchantIdentity, productName: row.productName, publicUrl: row.publicUrl, priceSnapshotKrw: row.priceKrw, currency: row.currency, priceCheckedAt: row.priceCheckedAt, freshnessExpiresAt: new Date(row.priceCheckedAt.getTime() + 30 * 86_400_000), stockState: row.stockState as "in_stock" | "out_of_stock" | "preorder" | "discontinued" | "unknown", shippingJson: row.shippingJson ?? Prisma.JsonNull, isAffiliate: row.affiliate, disclosureText: row.disclosureText, contentHash: row.contentHash, active: false, createdByAdminId: feed.requestedByAdminId, approvedByAdminId: adminId, approvedAt: new Date(), healthState: "stale", recallState: "unknown" } });
      await tx.merchantFeedRow.update({ where: { id: row.id }, data: { reviewState: "published", publishedByAdminId: adminId, productOfferId: offer.id } });
      return { offer, public: false, blockers: ["LINK_HEALTH_NOT_HEALTHY", "RECALL_STATE_NOT_CLEAR"] };
    });
  }

  async upsertSafetyAlternative(
    adminId: string,
    itemId: string,
    input: CreateSafetyAlternativeDto,
    options: { allowActiveReplace: boolean }
  ) {
    const reason = input.reason.trim().replace(/\s+/g, " ");
    if (!reason) throw new BadRequestException({ code: "SAFETY_ALTERNATIVE_REASON_REQUIRED", message: "A safety alternative reason is required." });
    if (itemId === input.alternativeItemDefinitionId) {
      throw new BadRequestException({ code: "SAFETY_ALTERNATIVE_SELF_FORBIDDEN", message: "An item cannot be its own safety alternative." });
    }
    return this.prisma.$transaction(async (tx) => {
      const [source, alternativeItem] = await Promise.all([
        tx.itemDefinition.findUnique({ where: { id: itemId }, select: { id: true } }),
        tx.itemDefinition.findUnique({
          where: { id: input.alternativeItemDefinitionId },
          select: { id: true, status: true }
        })
      ]);
      if (!source) throw new NotFoundException({ code: "SAFETY_ALTERNATIVE_SOURCE_NOT_FOUND", message: "Source item not found." });
      if (!alternativeItem || alternativeItem.status !== "published") {
        throw new ConflictException({ code: "SAFETY_ALTERNATIVE_ITEM_NOT_PUBLISHED", message: "The alternative item must be published." });
      }
      await this.lockSafetyAlternative(tx, itemId, input.alternativeItemDefinitionId);
      const key = {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: itemId,
          alternativeItemDefinitionId: input.alternativeItemDefinitionId
        }
      };
      const existing = await tx.itemAlternative.findUnique({ where: key });
      if (existing?.reason === reason) return existing;
      if (existing?.active && !options.allowActiveReplace) {
        throw new ForbiddenException({ code: "SAFETY_ALTERNATIVE_ACTIVE_ADMIN_REQUIRED", message: "Only an administrator can replace an active safety alternative." });
      }
      const updated = existing
        ? await tx.itemAlternative.update({
            where: key,
            data: {
              reason,
              evidenceSourceId: null,
              approvedByAdminId: null,
              safetyApprovedAt: null,
              active: false
            }
          })
        : await tx.itemAlternative.create({
            data: {
              itemDefinitionId: itemId,
              alternativeItemDefinitionId: input.alternativeItemDefinitionId,
              reason
            }
          });
      await this.auditSafetyAlternative(tx, {
        actorAdminId: adminId,
        action: existing ? "replace" : "create",
        itemDefinitionId: itemId,
        before: existing,
        after: updated
      });
      return updated;
    });
  }

  async deactivateSafetyAlternative(adminId: string, itemId: string, alternativeItemDefinitionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSafetyAlternative(tx, itemId, alternativeItemDefinitionId);
      const key = {
        itemDefinitionId_alternativeItemDefinitionId: { itemDefinitionId: itemId, alternativeItemDefinitionId }
      };
      const existing = await tx.itemAlternative.findUnique({ where: key });
      if (!existing) throw new NotFoundException({ code: "SAFETY_ALTERNATIVE_NOT_FOUND", message: "Safety alternative mapping not found." });
      if (!existing.active && !existing.evidenceSourceId && !existing.approvedByAdminId) return existing;
      const updated = await tx.itemAlternative.update({
        where: key,
        data: {
          evidenceSourceId: null,
          approvedByAdminId: null,
          safetyApprovedAt: null,
          active: false
        }
      });
      await this.auditSafetyAlternative(tx, {
        actorAdminId: adminId,
        action: "deactivate",
        itemDefinitionId: itemId,
        before: existing,
        after: updated
      });
      return updated;
    });
  }

  async approveSafetyAlternative(adminId: string, itemId: string, input: ApproveSafetyAlternativeDto) {
    const expectedMapping = await this.prisma.itemAlternative.findUnique({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: itemId,
          alternativeItemDefinitionId: input.alternativeItemDefinitionId
        }
      }
    });
    if (!expectedMapping) {
      throw new NotFoundException({ code: "SAFETY_ALTERNATIVE_NOT_FOUND", message: "Safety alternative mapping not found." });
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockSafetyAlternative(tx, itemId, input.alternativeItemDefinitionId);
      await this.lockSafetyApprovalInputs(
        tx,
        itemId,
        input.alternativeItemDefinitionId,
        input.evidenceSourceId
      );
      const now = new Date();
      const key = {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: itemId,
          alternativeItemDefinitionId: input.alternativeItemDefinitionId
        }
      };
      const [alternative, sourceItem, alternativeItem, evidence] = await Promise.all([
        tx.itemAlternative.findUnique({ where: key }),
        tx.itemDefinition.findUnique({ where: { id: itemId }, select: { contentVersion: true } }),
        tx.itemDefinition.findUnique({
          where: { id: input.alternativeItemDefinitionId },
          select: { status: true }
        }),
        tx.itemEvidenceSource.findFirst({
          where: {
            id: input.evidenceSourceId,
            itemDefinitionId: itemId,
            ...currentReviewedEvidenceWhere(now, { safetySourcesOnly: true })
          }
        })
      ]);
      if (!alternative) throw new NotFoundException({ code: "SAFETY_ALTERNATIVE_NOT_FOUND", message: "Safety alternative mapping not found." });
      if (
        alternative.reason !== expectedMapping.reason ||
        alternative.active !== expectedMapping.active ||
        alternative.evidenceSourceId !== expectedMapping.evidenceSourceId ||
        alternative.approvedByAdminId !== expectedMapping.approvedByAdminId ||
        alternative.safetyApprovedAt?.getTime() !== expectedMapping.safetyApprovedAt?.getTime()
      ) {
        throw new ConflictException({ code: "SAFETY_ALTERNATIVE_REVISION_CONFLICT", message: "The safety alternative changed before activation." });
      }
      if (!sourceItem || !alternativeItem || alternativeItem.status !== "published") {
        throw new ConflictException({ code: "SAFETY_ALTERNATIVE_ITEM_NOT_PUBLISHED", message: "The source and alternative item must remain publishable." });
      }
      if (
        !evidence ||
        evidence.revision !== sourceItem.contentVersion ||
        !evidenceHasClaim(evidence.applicableClaimsJson, safetyAlternativeClaim(input.alternativeItemDefinitionId))
      ) {
        throw new ConflictException({ code: "SAFETY_EVIDENCE_REQUIRED", message: "Current reviewed safety evidence for this exact alternative is required." });
      }
      if (!evidenceHasIndependentCaptureAndReview(evidence)) {
        throw new ConflictException({
          code: "SAFETY_EVIDENCE_INDEPENDENCE_REQUIRED",
          message: "Safety evidence requires separate identified capture and review operators."
        });
      }
      if (evidence.capturedByAdminId === adminId) {
        throw new ForbiddenException({ code: "SAFETY_ACTIVATOR_CAPTURER_SEPARATION_REQUIRED", message: "The evidence capturer cannot activate the alternative." });
      }
      if (evidence.reviewedByAdminId === adminId) {
        throw new ForbiddenException({ code: "SAFETY_ACTIVATOR_REVIEWER_SEPARATION_REQUIRED", message: "The evidence reviewer cannot activate the alternative." });
      }
      if (
        alternative.active &&
        alternative.evidenceSourceId === evidence.id &&
        alternative.approvedByAdminId === adminId
      ) return alternative;
      const updated = await tx.itemAlternative.update({
        where: key,
        data: {
          evidenceSourceId: evidence.id,
          approvedByAdminId: adminId,
          safetyApprovedAt: now,
          active: true
        }
      });
      await this.auditSafetyAlternative(tx, {
        actorAdminId: adminId,
        action: "activate",
        itemDefinitionId: itemId,
        before: alternative,
        after: updated,
        evidence: {
          id: evidence.id,
          contentHash: evidence.contentHash,
          revision: evidence.revision,
          capturedByAdminId: evidence.capturedByAdminId,
          reviewedByAdminId: evidence.reviewedByAdminId
        }
      });
      return updated;
    });
  }

  private async readSafetyAlternativesSnapshot(user: AuthenticatedUser, alertId: string) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.catalogSafetyAlert.findUnique({ where: { id: alertId } });
      if (!alert) throw new NotFoundException({ code: "SAFETY_ALERT_NOT_FOUND", message: "Safety alert not found." });
      const plan = await tx.userItemPlan.findUnique({ where: { id: alert.userItemPlanId } });
      if (!plan) throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "Household access is required." });
      requirePlanReader(user, plan.householdId);
      if (!alert.eventType.includes("recalled")) {
        return { state: "review_required" as const, actionGuidance: "공식 안내를 확인해 주세요.", alternatives: [] };
      }
      await tx.$queryRaw(Prisma.sql`
        SELECT item_definition_id
        FROM item_alternatives
        WHERE item_definition_id = ${alert.itemDefinitionId}::uuid
          AND active = TRUE
        FOR SHARE
      `);
      const rows = await tx.itemAlternative.findMany({
        where: {
          itemDefinitionId: alert.itemDefinitionId,
          active: true,
          safetyApprovedAt: { not: null },
          evidenceSourceId: { not: null },
          approvedByAdminId: { not: null }
        }
      });
      const evidenceIds = rows.flatMap((row) => row.evidenceSourceId ? [row.evidenceSourceId] : []);
      if (evidenceIds.length) {
        await tx.$queryRaw(Prisma.sql`
          SELECT id
          FROM item_evidence_sources
          WHERE id IN (${Prisma.join(evidenceIds.map((id) => Prisma.sql`${id}::uuid`))})
          ORDER BY id
          FOR SHARE
        `);
      }
      const now = new Date();
      const evidence = await tx.itemEvidenceSource.findMany({
        where: {
          id: { in: evidenceIds },
          itemDefinitionId: alert.itemDefinitionId,
          revision: alert.itemContentVersion,
          ...currentReviewedEvidenceWhere(now, { safetySourcesOnly: true })
        },
        select: {
          id: true,
          title: true,
          publicUrl: true,
          applicableClaimsJson: true,
          capturedByAdminId: true,
          reviewedByAdminId: true
        }
      });
      const evidenceById = new Map(evidence.flatMap((entry) => {
        try {
          return [[entry.id, { ...entry, publicUrl: publicHttps(entry.publicUrl) }] as const];
        } catch {
          return [];
        }
      }));
      const eligibleRows = rows.filter((row) => {
        if (!row.evidenceSourceId) return false;
        const proof = evidenceById.get(row.evidenceSourceId);
        return Boolean(
          proof &&
          safetyApprovalHasIndependentActors(proof, row.approvedByAdminId) &&
          evidenceHasClaim(
            proof.applicableClaimsJson,
            safetyAlternativeClaim(row.alternativeItemDefinitionId)
          )
        );
      });
      const alternatives = await tx.itemDefinition.findMany({
        where: {
          id: { in: eligibleRows.map((row) => row.alternativeItemDefinitionId) },
          status: "published"
        },
        select: { id: true, nameKo: true, safetyNote: true }
      });
      const itemById = new Map(alternatives.map((item) => [item.id, item]));
      return {
        state: "recalled" as const,
        actionGuidance: "사용을 중지하고 공식 안내를 확인해 주세요.",
        alternatives: eligibleRows.flatMap((row) => {
          const item = itemById.get(row.alternativeItemDefinitionId);
          const proof = row.evidenceSourceId ? evidenceById.get(row.evidenceSourceId) : null;
          return item && proof
            ? [{
                ...item,
                reason: row.reason,
                evidence: { id: proof.id, title: proof.title, publicUrl: proof.publicUrl }
              }]
            : [];
        })
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async safetyAlternatives(user: AuthenticatedUser, alertId: string) {
    let lastSerializationFailure: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.readSafetyAlternativesSnapshot(user, alertId);
      } catch (error) {
        if (!isSerializationFailure(error)) throw error;
        lastSerializationFailure = error;
      }
    }
    throw lastSerializationFailure;
  }
}
