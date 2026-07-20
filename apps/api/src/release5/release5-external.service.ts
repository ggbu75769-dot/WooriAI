import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AppConfigService } from "../app-config/app-config.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { ApproveSafetyAlternativeDto, MerchantFeedRowDto, PreviewMerchantFeedDto, RecallProviderEventDto, ReviewMerchantFeedRowDto, ReviewRecallEventDto } from "./dto/release5-external.dto";

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function publicHttps(value: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("URL_INVALID"); }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (parsed.protocol !== "https:" || host === "localhost" || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || [".localhost", ".test", ".example", ".invalid"].some((suffix) => host.endsWith(suffix))) {
    throw new Error("URL_BLOCKED");
  }
  return parsed.toString();
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
    const plans = await tx.userItemPlan.findMany({ where: { itemDefinitionId: itemId, state: { in: ["need", "researching", "planned", "ordered", "owned", "borrowed", "rented", "gift_expected", "gifted", "replacement_needed", "replacement_due"] } } });
    for (const plan of plans) {
      const alert = await tx.catalogSafetyAlert.upsert({
        where: { userItemPlanId_eventType_itemContentVersion: { userItemPlanId: plan.id, eventType: `provider_${event.eventStatus}`, itemContentVersion: item.contentVersion } },
        create: { itemDefinitionId: itemId, userItemPlanId: plan.id, eventType: `provider_${event.eventStatus}`, reason: event.normalizedGuidance, itemContentVersion: item.contentVersion },
        update: {}
      });
      const recipients = await tx.householdMember.findMany({ where: { householdId: plan.householdId, status: "active", role: { not: "gift_participant" } }, select: { userId: true } });
      for (const recipient of recipients) {
        const dedupeKey = `provider-recall:${alert.id}:${recipient.userId}`;
        const delivery = await tx.notificationDelivery.upsert({ where: { dedupeKey }, create: { userId: recipient.userId, householdId: plan.householdId, childId: plan.childId, targetType: "item", targetId: itemId, eventType: "catalog_item_recalled", dedupeKey, scheduledAt: new Date() }, update: {} });
        await tx.jobOutbox.upsert({ where: { topic_dedupeKey: { topic: "notification.send", dedupeKey } }, create: { topic: "notification.send", aggregateType: "notification_delivery", aggregateId: delivery.id, dedupeKey, payloadJson: { notificationDeliveryId: delivery.id } }, update: {} });
      }
    }
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

  async approveSafetyAlternative(adminId: string, itemId: string, input: ApproveSafetyAlternativeDto) {
    const [alternative, evidence] = await Promise.all([
      this.prisma.itemAlternative.findUnique({ where: { itemDefinitionId_alternativeItemDefinitionId: { itemDefinitionId: itemId, alternativeItemDefinitionId: input.alternativeItemDefinitionId } } }),
      this.prisma.itemEvidenceSource.findFirst({ where: { id: input.evidenceSourceId, itemDefinitionId: itemId, status: "reviewed", reviewedByAdminId: { not: null } } })
    ]);
    if (!alternative) throw new NotFoundException({ code: "SAFETY_ALTERNATIVE_NOT_FOUND", message: "Safety alternative mapping not found." });
    if (!evidence) throw new ConflictException({ code: "SAFETY_EVIDENCE_REQUIRED", message: "Reviewed safety evidence is required." });
    return this.prisma.itemAlternative.update({ where: { itemDefinitionId_alternativeItemDefinitionId: { itemDefinitionId: itemId, alternativeItemDefinitionId: input.alternativeItemDefinitionId } }, data: { evidenceSourceId: evidence.id, approvedByAdminId: adminId, safetyApprovedAt: new Date(), active: true } });
  }

  async safetyAlternatives(user: AuthenticatedUser, alertId: string) {
    const alert = await this.prisma.catalogSafetyAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException({ code: "SAFETY_ALERT_NOT_FOUND", message: "Safety alert not found." });
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: alert.userItemPlanId } });
    if (!plan || !user.households.some((household) => household.id === plan.householdId)) throw new ForbiddenException({ code: "SAFETY_ALERT_FORBIDDEN", message: "Safety alert access is not allowed." });
    if (!alert.eventType.includes("recalled")) return { state: "review_required", actionGuidance: "공식 안내를 확인해 주세요.", alternatives: [] };
    const rows = await this.prisma.itemAlternative.findMany({ where: { itemDefinitionId: alert.itemDefinitionId, active: true, safetyApprovedAt: { not: null }, evidenceSourceId: { not: null } } });
    const alternatives = await this.prisma.itemDefinition.findMany({ where: { id: { in: rows.map((row) => row.alternativeItemDefinitionId) }, status: "published" }, select: { id: true, nameKo: true, safetyNote: true } });
    const evidence = await this.prisma.itemEvidenceSource.findMany({ where: { id: { in: rows.flatMap((row) => row.evidenceSourceId ? [row.evidenceSourceId] : []) }, status: "reviewed" }, select: { id: true, title: true, publicUrl: true } });
    const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
    const rowByAlternative = new Map(rows.map((row) => [row.alternativeItemDefinitionId, row]));
    return { state: "recalled", actionGuidance: "사용을 중지하고 공식 안내를 확인해 주세요.", alternatives: alternatives.map((item) => { const row = rowByAlternative.get(item.id)!; return { ...item, reason: row.reason, evidence: row.evidenceSourceId ? evidenceById.get(row.evidenceSourceId) ?? null : null }; }) };
  }
}
