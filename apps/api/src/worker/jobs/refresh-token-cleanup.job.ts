import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

// Matches the 30-day refresh TTL tokens are issued with
// (REFRESH_TOKEN_TTL_SECONDS in src/auth/token.service.ts).
export const DEFAULT_TOKEN_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * INF-006-lite job (b): expired/revoked refresh token cleanup.
 *
 * Refresh tokens are issued with a 30-day TTL (token.service.ts) and
 * RefreshTokenStore.deleteExpired() exists as best-effort immediate deletion,
 * but nothing runs it periodically, and rows revoked *before* expiry (family
 * revocation on replay, revokeAllForUser on logout) linger until their
 * expiresAt passes anyway. This job deletes rows whose expiry or revocation is
 * older than a retention window (WORKER_TOKEN_RETENTION_DAYS, default 30 days)
 * rather than deleting at the moment of expiry: recently
 * expired/revoked/rotated rows are deliberately kept because the rotation
 * replay detection (RefreshTokenStore.rotate's used-token CAS + revokeFamily)
 * and incident forensics both read them. Rows that are merely *used* (rotated)
 * but not yet expired/revoked are never touched.
 */
@Injectable()
export class RefreshTokenCleanupJob implements WorkerJob {
  readonly name = "refresh_token_cleanup";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const retentionDays = this.retentionDays();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const result = await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] }
    });
    return { deleted: result.count, retentionDays };
  }

  private retentionDays(): number {
    const raw = Number(process.env.WORKER_TOKEN_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TOKEN_RETENTION_DAYS;
  }
}
