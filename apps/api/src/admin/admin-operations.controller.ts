import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { Prisma, type PrivacyRequestState } from "@prisma/client";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { PrivacyService } from "../privacy/privacy.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { hashAdminPassword } from "./admin-password";
import { CreateAdminAccountDto, PrivacyRetryDto, UpdateAdminRoleDto } from "./dto/admin-operations.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVACY_STATES = new Set<PrivacyRequestState>(["requested", "access_revoked", "processor_delete_queued", "purging", "retained_exception", "completed", "failed", "cancelled"]);

@Controller("admin/operations")
@UseGuards(AdminAuthGuard)
export class AdminOperationsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivacyService) private readonly privacy: PrivacyService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get("privacy-requests")
  async privacyRequests(@Query("state") state?: string) {
    if (state && !PRIVACY_STATES.has(state as PrivacyRequestState)) {
      throw new BadRequestException({ code: "PRIVACY_STATE_INVALID", message: "개인정보 요청 상태가 올바르지 않아요." });
    }
    const requests = await this.prisma.privacyRequest.findMany({
      where: state ? { state: state as PrivacyRequestState } : undefined,
      orderBy: { requestedAt: "desc" },
      take: 200,
      select: {
        id: true, requestType: true, state: true, requestedAt: true, dueAt: true,
        completedAt: true, failureCode: true, retentionSummaryJson: true
      }
    });
    return { requests };
  }

  @Post("privacy-requests/:id/retry")
  @HttpCode(202)
  @RequireAdminRoles("admin")
  async retryPrivacy(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(PrivacyRetryDto)) body: PrivacyRetryDto
  ) {
    const privacyRequest = await this.prisma.privacyRequest.findUnique({ where: { id } });
    if (!privacyRequest) throw new ConflictException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
    if (privacyRequest.state !== "failed" && privacyRequest.state !== "retained_exception") {
      throw new ConflictException({ code: "PRIVACY_REQUEST_NOT_RETRYABLE", message: "재시도할 수 있는 상태가 아니에요." });
    }
    const next = privacyRequest.requestType === "deletion" ? "processor_delete_queued" : "purging";
    await this.privacy.transition(id, next, "ADMIN_RETRY_REQUESTED", {
      actorType: "admin",
      metadata: body.note ? { note: body.note } : undefined
    });
    const topic = privacyRequest.requestType === "deletion" ? "privacy.delete" : "privacy.export";
    await this.prisma.jobOutbox.create({
      data: {
        topic,
        aggregateType: "privacy_request",
        aggregateId: id,
        dedupeKey: `${id}:admin-retry:${Date.now()}`,
        payloadJson: { privacyRequestId: id, userId: privacyRequest.userId }
      }
    });
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "admin.privacy_request.retry",
      targetType: "privacy_requests",
      targetId: id,
      after: { topic }
    });
    return { success: true };
  }

  @Get("link-health")
  async linkHealth() {
    const links = await this.prisma.productLink.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    const health = await this.prisma.productLinkHealth.findMany({ where: { productLinkId: { in: links.map((link) => link.id) } } });
    const byId = new Map(health.map((row) => [row.productLinkId, row]));
    return { links: links.map((link) => ({ id: link.id, title: link.title, active: link.active, health: byId.get(link.id) ?? null })) };
  }

  @Get("scheduled-content")
  async scheduledContent() {
    return { revisions: await this.prisma.contentRevision.findMany({
      where: { scheduledFor: { not: null } }, orderBy: { scheduledFor: "desc" }, take: 200,
      select: { id: true, entityType: true, entityId: true, status: true, scheduledFor: true, publishedAt: true, publishErrorCode: true }
    }) };
  }

  @Get("notification-summary")
  async notificationSummary() {
    return { states: await this.prisma.notificationDelivery.groupBy({ by: ["state"], _count: { _all: true } }) };
  }

  @Get("integrity-mismatches")
  async integrityMismatches() {
    return { checks: await this.prisma.reportIntegrityCheck.findMany({
      where: { matched: false }, orderBy: { checkedAt: "desc" }, take: 200
    }) };
  }

  @Get("runtime")
  async runtime() {
    const [pendingOutbox, openDlq, failedPrivacy] = await Promise.all([
      this.prisma.jobOutbox.count({ where: { publishedAt: null } }),
      this.prisma.deadLetterJob.count({ where: { resolvedAt: null, cancelledAt: null } }),
      this.prisma.privacyRequest.count({ where: { state: "failed" } })
    ]);
    return {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      adapters: {
        redisConfigured: Boolean(process.env.REDIS_URL),
        objectStorageConfigured: Boolean(process.env.S3_BUCKET && process.env.S3_ENDPOINT),
        notificationProviderConfigured: process.env.NOTIFICATION_PROVIDER_MODE === "live",
        privacyProcessorLive: process.env.PRIVACY_PROCESSOR_MODE === "live"
      },
      queues: { pendingOutbox, openDlq, failedPrivacy }
    };
  }

  @Get("admin-accounts")
  @RequireAdminRoles("admin")
  async adminAccounts() {
    return { admins: await this.prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, displayName: true, role: true, active: true, disabledAt: true, mfaEnabledAt: true, lastLoginAt: true }
    }) };
  }

  @Post("admin-accounts")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async createAdmin(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreateAdminAccountDto)) body: CreateAdminAccountDto
  ) {
    const inviterId = UUID_PATTERN.test(request.adminUser!.id) ? request.adminUser!.id : null;
    const created = await this.prisma.adminUser.create({
      data: {
        email: body.email.trim().toLowerCase(),
        displayName: body.displayName.trim(),
        role: body.role,
        passwordHash: hashAdminPassword(body.initialPassword),
        invitedByAdminId: inviterId
      },
      select: { id: true, email: true, displayName: true, role: true, active: true }
    });
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "admin.account.create", targetType: "admin_users", targetId: created.id, after: { role: created.role } });
    return created;
  }

  @Patch("admin-accounts/:id/role")
  @RequireAdminRoles("admin")
  async updateRole(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(UpdateAdminRoleDto)) body: UpdateAdminRoleDto
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('wooriai-admin-authority')::bigint)`;
      const target = await tx.adminUser.findUnique({ where: { id } });
      if (!target) throw new ConflictException({ code: "ADMIN_NOT_FOUND", message: "관리자를 찾을 수 없어요." });
      await this.assertNotRemovingLastAdmin(tx, target.role === "admin" && body.role !== "admin");
      const row = await tx.adminUser.update({ where: { id }, data: { role: body.role } });
      await tx.adminSession.updateMany({ where: { adminUserId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return { row, previousRole: target.role };
    });
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "admin.account.role_change", targetType: "admin_users", targetId: id, before: { role: updated.previousRole }, after: { role: updated.row.role } });
    return { id: updated.row.id, role: updated.row.role };
  }

  @Post("admin-accounts/:id/disable")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async disableAdmin(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (request.adminUser!.id === id) throw new ConflictException({ code: "ADMIN_SELF_DISABLE_FORBIDDEN", message: "현재 로그인한 계정은 비활성화할 수 없어요." });
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('wooriai-admin-authority')::bigint)`;
      const target = await tx.adminUser.findUnique({ where: { id } });
      if (!target) throw new ConflictException({ code: "ADMIN_NOT_FOUND", message: "관리자를 찾을 수 없어요." });
      await this.assertNotRemovingLastAdmin(tx, target.role === "admin" && target.active);
      await tx.adminUser.update({ where: { id }, data: { active: false, disabledAt: new Date() } });
      await tx.adminSession.updateMany({ where: { adminUserId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "admin.account.disable", targetType: "admin_users", targetId: id });
    return { success: true };
  }

  @Post("admin-accounts/:id/reset-mfa")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async resetMfa(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id }, data: { totpSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: Prisma.DbNull } }),
      this.prisma.adminSession.updateMany({ where: { adminUserId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "admin.account.mfa_reset", targetType: "admin_users", targetId: id });
    return { success: true };
  }

  private async assertNotRemovingLastAdmin(tx: Prisma.TransactionClient, removingAdmin: boolean) {
    if (!removingAdmin) return;
    const count = await tx.adminUser.count({ where: { role: "admin", active: true, disabledAt: null } });
    if (count <= 1) throw new ConflictException({ code: "LAST_ADMIN_REQUIRED", message: "마지막 활성 admin 권한은 제거할 수 없어요." });
  }
}
