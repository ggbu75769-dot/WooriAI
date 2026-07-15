import { Controller, Get, Headers, Inject, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { renderRequestMetrics } from "./metrics.registry";

@Controller("internal")
export class MetricsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("metrics")
  async metrics(@Headers("x-internal-token") internalToken: string | undefined, @Res() response: Response) {
    if (process.env.NODE_ENV === "production") {
      const expected = process.env.INTERNAL_METRICS_TOKEN;
      if (!expected || internalToken !== expected) throw new UnauthorizedException("Internal authentication is required.");
    }
    const [pendingOutbox, oldestOutbox, dlq, failedPrivacy, oldestPrivacy, failedLinks, notificationStates, integrityMismatch, scheduledPublishFailures] = await Promise.all([
      this.prisma.jobOutbox.count({ where: { publishedAt: null } }),
      this.prisma.jobOutbox.findFirst({ where: { publishedAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      this.prisma.deadLetterJob.count({ where: { resolvedAt: null, cancelledAt: null } }),
      this.prisma.privacyRequest.count({ where: { state: "failed" } }),
      this.prisma.privacyRequest.findFirst({ where: { state: { notIn: ["completed", "cancelled"] } }, orderBy: { requestedAt: "asc" }, select: { requestedAt: true } }),
      this.prisma.productLinkHealth.count({ where: { state: "failed" } }),
      this.prisma.notificationDelivery.groupBy({ by: ["state"], _count: { _all: true } }),
      this.prisma.reportIntegrityCheck.count({ where: { matched: false } }),
      this.prisma.contentRevision.count({ where: { publishErrorCode: { not: null } } })
    ]);
    const ageSeconds = (date?: Date) => date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000)) : 0;
    const lines = [
      ...renderRequestMetrics(),
      "# TYPE wooriai_outbox_pending gauge", `wooriai_outbox_pending ${pendingOutbox}`,
      "# TYPE wooriai_outbox_oldest_age_seconds gauge", `wooriai_outbox_oldest_age_seconds ${ageSeconds(oldestOutbox?.createdAt)}`,
      "# TYPE wooriai_dlq_open gauge", `wooriai_dlq_open ${dlq}`,
      "# TYPE wooriai_privacy_failed gauge", `wooriai_privacy_failed ${failedPrivacy}`,
      "# TYPE wooriai_privacy_oldest_open_age_seconds gauge", `wooriai_privacy_oldest_open_age_seconds ${ageSeconds(oldestPrivacy?.requestedAt)}`,
      "# TYPE wooriai_product_link_failed gauge", `wooriai_product_link_failed ${failedLinks}`,
      "# TYPE wooriai_scheduled_publish_failed gauge", `wooriai_scheduled_publish_failed ${scheduledPublishFailures}`,
      "# TYPE wooriai_notification_delivery gauge",
      "# TYPE wooriai_report_integrity_mismatch gauge", `wooriai_report_integrity_mismatch ${integrityMismatch}`
    ];
    for (const state of notificationStates) {
      lines.push(`wooriai_notification_delivery{state="${state.state}"} ${state._count._all}`);
    }
    response.type("text/plain; version=0.0.4").send(`${lines.join("\n")}\n`);
  }
}
