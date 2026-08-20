import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

// Ticket-specified retention: expired/consumed transactions older than 1 day.
const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * INF-006-lite job (c): OAuth transaction cleanup.
 *
 * Oauth transactions get a 10-minute TTL (TX_TTL_MS in
 * src/auth/kakao/kakao-auth.service.ts), which already opportunistically
 * deletes `expiresAt < now` rows on each begin() call — but only when logins
 * keep happening, and consumed rows are never deleted explicitly (they only
 * age out via that same expiresAt check). This job periodically deletes
 * transactions that expired or were consumed more than 1 day ago; the 1-day
 * lag keeps very recent rows around for debugging failed login flows.
 */
@Injectable()
export class OauthTransactionCleanupJob implements WorkerJob {
  readonly name = "oauth_transaction_cleanup";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const cutoff = new Date(now.getTime() - RETENTION_MS);
    const result = await this.prisma.oauthTransaction.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }] }
    });
    return { deleted: result.count };
  }
}
