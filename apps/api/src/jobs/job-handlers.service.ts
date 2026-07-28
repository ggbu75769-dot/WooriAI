import { Inject, Injectable } from "@nestjs/common";
import { ContentRevisionsService } from "../admin/content-revisions.service";
import {
  KAKAO_OAUTH_PROVIDER_ADAPTER,
  type OAuthProviderAdapter
} from "../auth/providers/oauth-provider.adapter";
import { isAllowedAffiliateUrl } from "../items-commerce/affiliate-link-guard.util";
import { PrismaService } from "../prisma/prisma.service";
import { PrivacyService } from "../privacy/privacy.service";
import { ReportsV2Service } from "../finance/reports-v2.service";
import { CatalogV2Service } from "../catalog-v2/catalog-v2.service";
import { JobExecutionError } from "./job-errors";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { checkPublicLink, SafeLinkCheckError } from "./safe-link-check";

export type JobResult = { code: string; details?: Record<string, unknown> };

function requiredId(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) throw new JobExecutionError("JOB_PAYLOAD_INVALID", false);
  return value;
}

const ACTIVE_TEMPORAL_PLAN_STATES = ["owned", "borrowed", "rented", "replacement_needed", "replacement_due"] as const;

function dateOnlyUtc(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

@Injectable()
export class JobHandlersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivacyService) private readonly privacy: PrivacyService,
    @Inject(ContentRevisionsService) private readonly contentRevisions: ContentRevisionsService,
    @Inject(KAKAO_OAUTH_PROVIDER_ADAPTER) private readonly kakaoAdapter: OAuthProviderAdapter,
    @Inject(ReportsV2Service) private readonly reportsV2: ReportsV2Service,
    @Inject(CatalogV2Service) private readonly catalogV2: CatalogV2Service,
    @Inject(NotificationDeliveryService) private readonly notificationDelivery: NotificationDeliveryService
  ) {}

  async handle(topic: string, payload: Record<string, unknown>): Promise<JobResult> {
    switch (topic) {
      case "privacy.delete": return await this.deleteAccount(payload);
      case "privacy.export": return await this.exportData(payload);
      case "processor.unlink": return await this.unlinkProcessor(payload);
      case "content.publish_due": return await this.publishDue(payload);
      case "product_link.health_check": return await this.checkProductLink(payload);
      case "cleanup.oauth_transaction": return await this.cleanupOauthTransactions();
      case "cleanup.refresh_token": return await this.cleanupRefreshTokens();
      case "cleanup.idempotency_key": return await this.cleanupIdempotencyKeys();
      case "cleanup.export_file": return await this.cleanupExportFiles();
      case "report.integrity_check": return await this.checkReport(payload);
      case "notification.send": return await this.sendNotification(payload);
      case "preparation.temporal_due": return await this.enqueueTemporalDue(payload);
      case "import.parse":
        throw new JobExecutionError("IMPORT_QUEUE_HANDLER_NOT_CONNECTED", false);
      default:
        throw new JobExecutionError("JOB_TOPIC_UNKNOWN", false);
    }
  }

  private async deleteAccount(payload: Record<string, unknown>): Promise<JobResult> {
    const requestId = requiredId(payload, "privacyRequestId");
    let request = await this.prisma.privacyRequest.findUnique({ where: { id: requestId } });
    if (!request || request.requestType !== "deletion") throw new JobExecutionError("PRIVACY_REQUEST_NOT_FOUND", false);
    if (request.state === "completed") return { code: "ALREADY_COMPLETED" };
    if (request.state === "cancelled") return { code: "DELETION_CANCELLED" };
    if (request.state === "requested") {
      request = await this.privacy.activateDueDeletion(requestId);
    }
    if (request.state === "failed" && request.failureCode === "OWNER_TRANSFER_REQUIRED") {
      return { code: "OWNER_TRANSFER_REQUIRED" };
    }
    if (request.state === "access_revoked") {
      request = await this.privacy.transition(requestId, "processor_delete_queued", "DELETE_JOB_ACCEPTED");
    }
    if (request.state === "processor_delete_queued" || request.state === "failed") {
      request = await this.privacy.transition(requestId, "purging", "DELETE_PURGE_STARTED");
    }
    if (request.state !== "purging" && request.state !== "retained_exception") {
      throw new JobExecutionError("PRIVACY_DELETE_STATE_INVALID", false);
    }

    const identities = await this.prisma.oAuthIdentity.findMany({ where: { userId: request.userId, unlinkedAt: null } });
    const mockMode = process.env.PRIVACY_PROCESSOR_MODE !== "live" && process.env.NODE_ENV !== "production";
    for (const identity of identities) {
      if (identity.provider !== "kakao") throw new JobExecutionError("OAUTH_PROVIDER_UNLINK_UNSUPPORTED", false);
      if (!mockMode) {
        try {
          await this.kakaoAdapter.unlinkIdentity({ providerSubject: identity.providerSubject });
        } catch {
          throw new JobExecutionError("OAUTH_PROVIDER_UNLINK_FAILED", true);
        }
      }
    }

    const completedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.oAuthIdentity.deleteMany({ where: { userId: request!.userId } });
      await tx.userDevice.deleteMany({ where: { userId: request!.userId } });
      await tx.receiptDraft.deleteMany({ where: { createdByUserId: request!.userId } });
      await tx.todayActionPreference.deleteMany({ where: { userId: request!.userId } });
      await tx.weeklyBriefing.deleteMany({ where: { userId: request!.userId } });
      await tx.notificationPreference.deleteMany({ where: { userId: request!.userId } });
      await tx.user.update({
        where: { id: request!.userId },
        data: {
          providerUserId: `withdrawn-${request!.userId}`,
          email: null,
          phone: null,
          displayName: "탈퇴 사용자",
          profileImageUrl: null,
          status: "withdrawn",
          deletedAt: completedAt
        }
      });
      const changed = await tx.privacyRequest.updateMany({
        where: { id: requestId, state: { in: ["purging", "retained_exception"] } },
        data: {
          state: "completed",
          completedAt,
          retentionSummaryJson: {
            strategy: "pii_anonymized_shared_rows_retained",
            release5: {
              purgedUserPrivate: [
                "receipt_drafts_and_extraction",
                "today_action_preferences",
                "weekly_briefings",
                "notification_preferences"
              ],
              retainedSharedAuditWithAnonymizedUser: [
                "custom_preparation_bundles",
                "custom_bundle_applications",
                "receipt_confirmations",
                "expense_plan_link_events"
              ]
            }
          }
        }
      });
      if (changed.count === 1) {
        await tx.privacyRequestEvent.create({
          data: {
            privacyRequestId: requestId,
            previousState: request!.state,
            nextState: "completed",
            actorType: "worker",
            eventCode: mockMode ? "DELETE_COMPLETED_MOCK_PROCESSOR" : "DELETE_COMPLETED"
          }
        });
      }
    });
    return { code: mockMode ? "DELETE_COMPLETED_MOCK_PROCESSOR" : "DELETE_COMPLETED" };
  }

  private async exportData(payload: Record<string, unknown>): Promise<JobResult> {
    const requestId = requiredId(payload, "privacyRequestId");
    let request = await this.prisma.privacyRequest.findUnique({ where: { id: requestId } });
    if (!request || request.requestType !== "export") throw new JobExecutionError("PRIVACY_REQUEST_NOT_FOUND", false);
    if (request.state === "completed") return { code: "ALREADY_COMPLETED" };
    const mockMode = process.env.PRIVACY_PROCESSOR_MODE !== "live" && process.env.NODE_ENV !== "production";
    if (!mockMode) throw new JobExecutionError("EXPORT_OBJECT_STORAGE_NOT_CONFIGURED", false);
    if (request.state === "requested") request = await this.privacy.transition(requestId, "processor_delete_queued", "EXPORT_JOB_ACCEPTED");
    if (request.state === "processor_delete_queued" || request.state === "failed") {
      request = await this.privacy.transition(requestId, "purging", "EXPORT_BUILD_STARTED");
    }
    const [
      todayActionPreferences,
      customPreparationBundles,
      customBundleApplications,
      weeklyBriefings,
      notificationPreferences,
      receiptDrafts,
      receiptConfirmations,
      expensePlanLinkEvents
    ] = await Promise.all([
      this.prisma.todayActionPreference.count({ where: { userId: request.userId } }),
      this.prisma.customPreparationBundle.count({ where: { createdByUserId: request.userId } }),
      this.prisma.customBundleApplication.count({ where: { requestedByUserId: request.userId } }),
      this.prisma.weeklyBriefing.count({ where: { userId: request.userId } }),
      this.prisma.notificationPreference.count({ where: { userId: request.userId } }),
      this.prisma.receiptDraft.count({ where: { createdByUserId: request.userId } }),
      this.prisma.receiptConfirmation.count({ where: { requestedByUserId: request.userId } }),
      this.prisma.expensePlanLinkEvent.count({ where: { actorUserId: request.userId } })
    ]);
    const release5Datasets = [
      { dataset: "today_action_preferences", recordCount: todayActionPreferences },
      { dataset: "custom_preparation_bundles", recordCount: customPreparationBundles },
      { dataset: "custom_bundle_applications", recordCount: customBundleApplications },
      { dataset: "weekly_briefings", recordCount: weeklyBriefings },
      { dataset: "notification_preferences", recordCount: notificationPreferences },
      { dataset: "receipt_drafts_and_extraction", recordCount: receiptDrafts },
      { dataset: "receipt_confirmations", recordCount: receiptConfirmations },
      { dataset: "expense_plan_link_events", recordCount: expensePlanLinkEvents }
    ];
    const expiresAt = new Date(Date.now() + Number(process.env.PRIVACY_EXPORT_TTL_HOURS ?? 24) * 60 * 60 * 1000);
    await this.prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        state: "completed",
        completedAt: new Date(),
        exportObjectKey: `mock/privacy-export/${requestId}.enc`,
        exportExpiresAt: expiresAt,
        retentionSummaryJson: {
          exportSchemaVersion: 5,
          includedRelease5Datasets: release5Datasets,
          localDeviceReceiptDrafts: "purged_on_logout_or_account_deletion_not_server_exported"
        }
      }
    });
    await this.prisma.privacyRequestEvent.create({
      data: {
        privacyRequestId: requestId,
        previousState: "purging",
        nextState: "completed",
        actorType: "worker",
        eventCode: "EXPORT_COMPLETED_MOCK_STORAGE"
      }
    });
    return { code: "EXPORT_COMPLETED_MOCK_STORAGE" };
  }

  private async unlinkProcessor(payload: Record<string, unknown>): Promise<JobResult> {
    const identityId = requiredId(payload, "oauthIdentityId");
    const identity = await this.prisma.oAuthIdentity.findUnique({ where: { id: identityId } });
    if (!identity || identity.unlinkedAt) return { code: "ALREADY_UNLINKED" };
    if (identity.provider !== "kakao") throw new JobExecutionError("OAUTH_PROVIDER_UNLINK_UNSUPPORTED", false);
    try {
      await this.kakaoAdapter.unlinkIdentity({ providerSubject: identity.providerSubject });
    } catch {
      throw new JobExecutionError("OAUTH_PROVIDER_UNLINK_FAILED", true);
    }
    await this.prisma.oAuthIdentity.update({ where: { id: identityId }, data: { unlinkedAt: new Date() } });
    return { code: "OAUTH_PROVIDER_UNLINKED" };
  }

  private async publishDue(payload: Record<string, unknown>): Promise<JobResult> {
    const requestedId = typeof payload.revisionId === "string" ? payload.revisionId : null;
    const ids = requestedId ? [requestedId] : await this.contentRevisions.dueRevisionIds();
    let published = 0;
    for (const id of ids) {
      const result = await this.contentRevisions.publishDue(id);
      if (result.status === "published") published += 1;
    }
    const catalog = requestedId ? { scanned: 0, published: 0, concurrent: 0, blocked: 0, results: [] } : await this.catalogV2.publishDueItems();
    return {
      code: "CONTENT_DUE_PROCESSED",
      details: {
        legacy: { scanned: ids.length, published },
        catalog: {
          scanned: catalog.scanned,
          published: catalog.published,
          concurrent: catalog.concurrent,
          blocked: catalog.blocked
        }
      }
    };
  }

  private async checkProductLink(payload: Record<string, unknown>): Promise<JobResult> {
    const productLinkId = requiredId(payload, "productLinkId");
    const link = await this.prisma.productLink.findUnique({ where: { id: productLinkId } });
    if (!link) throw new JobExecutionError("PRODUCT_LINK_NOT_FOUND", false);
    const url = link.affiliateUrl ?? link.url;
    if (!isAllowedAffiliateUrl(url)) throw new JobExecutionError("PRODUCT_LINK_DOMAIN_BLOCKED", false);
    let statusCode: number | null = null;
    let finalDomain: string | null = null;
    let state: "healthy" | "redirected" | "failed" = "failed";
    let failureReason: string | null = null;
    try {
      const result = await checkPublicLink(url, isAllowedAffiliateUrl);
      statusCode = result.statusCode;
      finalDomain = new URL(result.finalUrl).hostname;
      state = result.statusCode >= 200 && result.statusCode < 300 ? (result.redirected ? "redirected" : "healthy") : "failed";
      failureReason = state === "failed" ? "HTTP_CHECK_FAILED" : null;
    } catch (error) {
      state = "failed";
      failureReason = error instanceof SafeLinkCheckError ? error.code : "HTTP_CHECK_FAILED";
    }
    const prior = await this.prisma.productLinkHealth.findUnique({ where: { productLinkId } });
    await this.prisma.productLinkHealth.upsert({
      where: { productLinkId },
      create: {
        productLinkId,
        state,
        lastStatusCode: statusCode,
        finalDomain,
        checkedAt: new Date(),
        consecutiveFailures: state === "failed" ? 1 : 0,
        failureReason
      },
      update: {
        state,
        lastStatusCode: statusCode,
        finalDomain,
        checkedAt: new Date(),
        consecutiveFailures: state === "failed" ? (prior?.consecutiveFailures ?? 0) + 1 : 0,
        failureReason
      }
    });
    const syncedOffers = await this.prisma.productOffer.updateMany({
      where: { legacyProductLinkId: productLinkId },
      data: { healthState: state === "failed" ? "failed" : "healthy" }
    });
    return { code: `PRODUCT_LINK_${state.toUpperCase()}`, details: { productOffersSynced: syncedOffers.count } };
  }

  private async cleanupOauthTransactions() {
    const result = await this.prisma.oauthTransaction.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { code: "CLEANUP_OAUTH_TRANSACTION", details: { deleted: result.count } };
  }

  private async cleanupRefreshTokens() {
    const result = await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { code: "CLEANUP_REFRESH_TOKEN", details: { deleted: result.count } };
  }

  private async cleanupIdempotencyKeys() {
    const result = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { code: "CLEANUP_IDEMPOTENCY_KEY", details: { deleted: result.count } };
  }

  private async cleanupExportFiles() {
    const result = await this.prisma.privacyRequest.updateMany({
      where: { requestType: "export", exportExpiresAt: { lt: new Date() }, exportObjectKey: { not: null } },
      data: { exportObjectKey: null }
    });
    return { code: "CLEANUP_EXPORT_FILE", details: { expired: result.count } };
  }

  private async checkReport(payload: Record<string, unknown>) {
    const childId = requiredId(payload, "childId");
    const yearMonthRaw = requiredId(payload, "yearMonth");
    return this.reportsV2.refreshAndCheckIntegrity(childId, yearMonthRaw.slice(0, 7));
  }

  private async sendNotification(payload: Record<string, unknown>) {
    const deliveryId = requiredId(payload, "notificationDeliveryId");
    const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || ["sent", "cancelled"].includes(delivery.state)) return { code: "NOTIFICATION_ALREADY_FINAL" };
    if (delivery.householdId) {
      const activeMembership = await this.prisma.householdMember.findFirst({
        where: { householdId: delivery.householdId, userId: delivery.userId, status: "active" },
        select: { userId: true }
      });
      if (!activeMembership) {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { state: "cancelled", failureCode: "MEMBERSHIP_REVOKED" }
        });
        return { code: "NOTIFICATION_CANCELLED_MEMBERSHIP_REVOKED" };
      }
    }
    if (["replacement_due", "recurring_purchase_due"].includes(delivery.eventType)) {
      const parts = delivery.dedupeKey.split(":");
      const planId = parts.length === 5 && parts[0] === "preparation-due" ? parts[2] : null;
      const dueKey = parts.length === 5 ? parts[3] : null;
      const plan = planId ? await this.prisma.userItemPlan.findUnique({ where: { id: planId } }) : null;
      const currentDueKey = delivery.eventType === "replacement_due"
        ? dateOnlyUtc(plan?.replacementDueAt ?? null)
        : dateOnlyUtc(plan?.nextPurchaseDueAt ?? null);
      if (
        !plan ||
        !ACTIVE_TEMPORAL_PLAN_STATES.includes(plan.state as (typeof ACTIVE_TEMPORAL_PLAN_STATES)[number]) ||
        plan.householdId !== delivery.householdId ||
        plan.childId !== delivery.childId ||
        plan.itemDefinitionId !== delivery.targetId ||
        currentDueKey !== dueKey
      ) {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { state: "cancelled", failureCode: "STALE_TEMPORAL_DUE" }
        });
        return { code: "NOTIFICATION_CANCELLED_STALE_TEMPORAL_DUE" };
      }
    }
    const result = await this.notificationDelivery.deliver(deliveryId);
    if (delivery.eventType === "catalog_report_resolved" && delivery.dedupeKey.startsWith("catalog-report:")) {
      const reportId = delivery.dedupeKey.split(":")[1];
      if (reportId) await this.prisma.catalogItemReport.updateMany({ where: { id: reportId, userId: delivery.userId }, data: { userNotifiedAt: new Date() } });
    }
    return result;
  }

  private async enqueueTemporalDue(payload: Record<string, unknown>) {
    const raw = payload.referenceTime;
    const referenceTime = typeof raw === "string" && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : new Date();
    const result = await this.catalogV2.enqueueTemporalDueNotifications(referenceTime);
    return { code: "PREPARATION_TEMPORAL_DUE_SCANNED", details: result };
  }
}
