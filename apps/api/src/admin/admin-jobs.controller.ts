import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { DeadLetterActionDto } from "./dto/admin-jobs.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

@Controller("admin/jobs/dead-letter")
@UseGuards(AdminAuthGuard)
@RequireAdminRoles("admin")
export class AdminJobsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get()
  async list(@Query("state") state = "open") {
    const jobs = await this.prisma.deadLetterJob.findMany({
      where: state === "open" ? { resolvedAt: null, cancelledAt: null } : undefined,
      orderBy: { lastFailedAt: "desc" },
      take: 200
    });
    return { jobs };
  }

  @Post(":id/retry")
  @HttpCode(202)
  async retry(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(DeadLetterActionDto)) body: DeadLetterActionDto
  ) {
    const job = await this.prisma.deadLetterJob.findUnique({ where: { id } });
    if (!job || job.resolvedAt || job.cancelledAt) return { success: true, alreadyFinal: true };
    const retryDedupeKey = `${job.dedupeKey}:retry:${job.id}`.slice(0, 191);
    await this.prisma.$transaction(async (tx) => {
      await tx.jobOutbox.upsert({
        where: { topic_dedupeKey: { topic: job.topic, dedupeKey: retryDedupeKey } },
        create: {
          topic: job.topic,
          aggregateType: "dead_letter_retry",
          aggregateId: job.id,
          dedupeKey: retryDedupeKey,
          payloadJson: job.payloadJson as Prisma.InputJsonValue,
          visibleAt: new Date()
        },
        update: { publishedAt: null, claimedAt: null, visibleAt: new Date(), lastErrorCode: null }
      });
      await tx.deadLetterJob.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolvedByAdminId: request.adminUser!.id,
          resolutionNote: body.note ?? "manual retry requested"
        }
      });
    });
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "admin.dead_letter.retry",
      targetType: "dead_letter_jobs",
      targetId: id,
      after: { topic: job.topic, retryDedupeKey }
    });
    return { success: true, retryDedupeKey };
  }

  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(DeadLetterActionDto)) body: DeadLetterActionDto
  ) {
    const changed = await this.prisma.deadLetterJob.updateMany({
      where: { id, resolvedAt: null, cancelledAt: null },
      data: {
        cancelledAt: new Date(),
        resolvedAt: new Date(),
        resolvedByAdminId: request.adminUser!.id,
        resolutionNote: body.note ?? "cancelled by admin"
      }
    });
    if (changed.count === 1) {
      await this.audit.record({
        actorUserId: request.adminUser!.id,
        action: "admin.dead_letter.cancel",
        targetType: "dead_letter_jobs",
        targetId: id
      });
    }
    return { success: true, alreadyFinal: changed.count === 0 };
  }
}
