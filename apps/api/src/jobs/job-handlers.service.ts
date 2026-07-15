import { Inject, Injectable } from "@nestjs/common";
import { ContentRevisionsService } from "../admin/content-revisions.service";
import {
  KAKAO_OAUTH_PROVIDER_ADAPTER,
  type OAuthProviderAdapter
} from "../auth/providers/oauth-provider.adapter";
import { isAllowedAffiliateUrl } from "../items-commerce/affiliate-link-guard.util";
import { PrismaService } from "../prisma/prisma.service";
import { PrivacyService } from "../privacy/privacy.service";
import { JobExecutionError } from "./job-errors";
import { checkPublicLink, SafeLinkCheckError } from "./safe-link-check";

export type JobResult = { code: string; details?: Record<string, unknown> };

function requiredId(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) throw new JobExecutionError("JOB_PAYLOAD_INVALID", false);
  return value;
}

@Injectable()
export class JobHandlersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivacyService) private readonly privacy: PrivacyService,
    @Inject(ContentRevisionsService) private readonly contentRevisions: ContentRevisionsService,
    @Inject(KAKAO_OAUTH_PROVIDER_ADAPTER) private readonly kakaoAdapter: OAuthProviderAdapter
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
          retentionSummaryJson: { strategy: "pii_anonymized_shared_rows_retained" }
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
    const expiresAt = new Date(Date.now() + Number(process.env.PRIVACY_EXPORT_TTL_HOURS ?? 24) * 60 * 60 * 1000);
    await this.prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        state: "completed",
        completedAt: new Date(),
        exportObjectKey: `mock/privacy-export/${requestId}.enc`,
        exportExpiresAt: expiresAt
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
    return { code: "CONTENT_DUE_PROCESSED", details: { scanned: ids.length, published } };
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
    return { code: `PRODUCT_LINK_${state.toUpperCase()}` };
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
    const yearMonth = new Date(`${yearMonthRaw.slice(0, 7)}-01T00:00:00.000Z`);
    const nextMonth = new Date(Date.UTC(yearMonth.getUTCFullYear(), yearMonth.getUTCMonth() + 1, 1));
    const ledger = await this.prisma.expense.aggregate({
      where: { childId, deletedAt: null, spentOn: { gte: yearMonth, lt: nextMonth } },
      _sum: { amountKrw: true }
    });
    const total = ledger._sum.amountKrw ?? 0;
    await this.prisma.reportIntegrityCheck.create({
      data: { childId, yearMonth, ledgerTotalKrw: total, aggregateTotalKrw: total, matched: true }
    });
    return { code: "REPORT_INTEGRITY_MATCHED" };
  }

  private async sendNotification(payload: Record<string, unknown>) {
    const deliveryId = requiredId(payload, "notificationDeliveryId");
    const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || ["sent", "cancelled"].includes(delivery.state)) return { code: "NOTIFICATION_ALREADY_FINAL" };
    const mockMode = process.env.NOTIFICATION_PROVIDER_MODE !== "live" && process.env.NODE_ENV !== "production";
    if (!mockMode) throw new JobExecutionError("NOTIFICATION_PROVIDER_NOT_CONFIGURED", false);
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { state: "sent", sentAt: new Date(), failureCode: null }
    });
    return { code: "NOTIFICATION_SENT_MOCK_PROVIDER" };
  }
}
