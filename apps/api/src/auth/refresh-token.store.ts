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
  /**
   * SEC-131: 이 토큰이 속한 family가 **처음 만들어진**(= 로그인한) 시각. 회전으로
   * 새 행을 만들 때 그대로 물려받으므로 family 안의 모든 행이 같은 값을 갖는다.
   *
   * `MIN(created_at)`으로 유도하지 않는 이유: 로그인 시 만들어진 첫 행은 30일 뒤
   * expiresAt이 지나면 `deleteExpired`가 지운다. 절대 수명 상한(90일)이 30일보다
   * 길어서, 상한 판정이 필요한 시점에는 family의 최초 행이 이미 사라지고 없을 수
   * 있다 — 남은 행들의 MIN(created_at)은 "마지막 회전 시각"에 가까워 상한이 계속
   * 뒤로 밀린다(= 상한이 사실상 없는 것과 같다).
   */
  familyStartedAt: Date;
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

  /**
   * Inserts the first token of a brand-new family (login). `familyStartedAt` defaults
   * to now — i.e. the absolute-lifetime clock (SEC-131) starts at login. Callers that
   * revive an existing `familyId` must pass the family's original start so reusing a
   * familyId can never reset that clock.
   */
  async create(params: {
    userId: string;
    familyId: string;
    jti: string;
    token: string;
    expiresAt: Date;
    familyStartedAt?: Date;
  }) {
    this.requireDb();
    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        familyId: params.familyId,
        jti: params.jti,
        tokenHash: RefreshTokenStore.hashToken(params.token),
        expiresAt: params.expiresAt,
        familyStartedAt: params.familyStartedAt ?? new Date()
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
          revokedAt: row.revokedAt,
          familyStartedAt: row.familyStartedAt
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
    /** SEC-131: 회전 결과 행은 family의 최초 생성 시각을 그대로 물려받는다. */
    familyStartedAt: Date;
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
          expiresAt: params.newExpiresAt,
          familyStartedAt: params.familyStartedAt
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
