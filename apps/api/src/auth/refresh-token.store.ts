import { createHash } from "node:crypto";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type RefreshTokenRecord = {
  userId: string;
  familyId: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

/**
 * Persistent (Postgres-backed) store for refresh token rotation state.
 *
 * Round 4 removes the transitional in-memory fallback this store used to have
 * while domain data was still in-memory: now that every domain entity (users,
 * households, refresh tokens, ...) lives in Postgres, an in-memory refresh token
 * would be meaningless anyway (its associated user/session state wouldn't exist),
 * so a missing database is surfaced honestly as a 503 rather than silently
 * degrading to per-process, non-durable rotation tracking.
 *
 * Rotation model: a refresh token can be redeemed exactly once (`usedAt` gets set).
 * All refresh tokens descended from the same login share a `familyId`. If a token
 * that was already marked used is presented again (replay of a stolen/old token),
 * the entire family is revoked so every descendant session is invalidated.
 */
@Injectable()
export class RefreshTokenStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  static hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(params: { userId: string; familyId: string; jti: string; token: string; expiresAt: Date }) {
    this.requireDb();
    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        familyId: params.familyId,
        jti: params.jti,
        tokenHash: RefreshTokenStore.hashToken(params.token),
        expiresAt: params.expiresAt
      }
    });
  }

  async findByJti(jti: string): Promise<RefreshTokenRecord | null> {
    this.requireDb();
    const row = await this.prisma.refreshToken.findUnique({ where: { jti } });
    return row
      ? {
          userId: row.userId,
          familyId: row.familyId,
          jti: row.jti,
          tokenHash: row.tokenHash,
          expiresAt: row.expiresAt,
          usedAt: row.usedAt,
          revokedAt: row.revokedAt
        }
      : null;
  }

  /**
   * Atomically claims the presented (old) refresh token and inserts the newly
   * issued (rotated) refresh token in a single Prisma transaction.
   *
   * Claiming uses a compare-and-swap `updateMany` (`usedAt: null, revokedAt: null`
   * in the WHERE clause) rather than an unconditional `update`, so when two
   * concurrent requests present the same single-use refresh token, only the first
   * one to reach Postgres can ever claim it — Postgres's row-level locking
   * serializes the two `updateMany` calls, and the loser's WHERE clause no longer
   * matches once it re-evaluates against the winner's committed write, so its
   * `count` comes back 0 and it returns `false` without inserting a new row. The
   * caller (see AuthService.refresh) treats a `false` result the same as replay of
   * an already-used token: the whole family gets revoked.
   *
   * A Postgres transaction-scoped advisory lock keyed on `familyId` additionally
   * serializes this method against `revokeFamily` for the same family. Without it,
   * a `revokeFamily` call racing a `rotate` call for a *different* token in the same
   * family could take its full-family snapshot before `rotate`'s new row exists and
   * commits after, leaving that freshly-rotated row un-revoked despite the family
   * having just been marked compromised.
   */
  async rotate(params: {
    oldJti: string;
    userId: string;
    familyId: string;
    newJti: string;
    newToken: string;
    newExpiresAt: Date;
  }): Promise<boolean> {
    this.requireDb();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.familyId})::bigint)`;

      const claimed = await tx.refreshToken.updateMany({
        where: { jti: params.oldJti, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() }
      });
      if (claimed.count === 0) {
        return false;
      }

      await tx.refreshToken.create({
        data: {
          userId: params.userId,
          familyId: params.familyId,
          jti: params.newJti,
          tokenHash: RefreshTokenStore.hashToken(params.newToken),
          expiresAt: params.newExpiresAt
        }
      });
      return true;
    });
  }

  /**
   * Revokes every not-yet-revoked token in the family. Takes the same
   * `familyId`-keyed advisory lock as `rotate` so the two can never interleave in a
   * way that leaves a concurrently-inserted rotated token un-revoked (see `rotate`'s
   * doc comment for the failure mode this prevents).
   */
  async revokeFamily(familyId: string) {
    this.requireDb();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${familyId})::bigint)`;
      await tx.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });
  }

  async revokeAllForUser(userId: string) {
    this.requireDb();
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async deleteExpired() {
    this.requireDb();
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  private requireDb() {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "일시적으로 서비스를 이용할 수 없어요. 잠시 후 다시 시도해주세요."
      });
    }
  }
}
