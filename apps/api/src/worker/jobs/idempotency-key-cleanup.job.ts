import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

/**
 * INF-006-lite job (d): idempotency key cleanup.
 *
 * Every idempotency_keys row is written with its own `expiresAt` derived from
 * the TTLs the interceptor assumes (src/common/idempotency/
 * idempotency.interceptor.ts: IDEMPOTENCY_TTL_MS = 24h for completed rows,
 * PENDING_TTL_MS = 60s for in-flight reservations), so `expiresAt < now` is
 * exactly "older than the TTL the interceptor assumes" for both kinds of row.
 * The interceptor already runs the same opportunistic deleteMany on its hot
 * path when it inserts a new reservation; this job makes that cleanup periodic
 * so rows for endpoints that stop receiving traffic are still reclaimed.
 */
@Injectable()
export class IdempotencyKeyCleanupJob implements WorkerJob {
  readonly name = "idempotency_key_cleanup";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } }
    });
    return { deleted: result.count };
  }
}
