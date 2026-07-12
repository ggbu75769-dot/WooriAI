import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AdminUser } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * SEC-102 §5 "택1": fixed 12h absolute session lifetime from creation (no idle
 * sliding window). Chosen over an idle-refresh scheme for determinism -- a
 * session's expiry never silently changes on the wire, which makes the e2e
 * contract ("expires_at is exactly created_at + 12h") easy to assert and easy
 * to reason about for an internal admin tool with a small user count. `last_seen_at`
 * is still updated on every validated request (for the audit/ops trail) even
 * though it no longer extends `expires_at`.
 */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminSessionContext = {
  sessionId: string;
  admin: AdminUser;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AdminSessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Issues a new session for `adminUserId` and returns the raw (unhashed) token --
   * only ever held in memory here and in the Set-Cookie response, never persisted
   * or logged. Only `sha256(token)` is stored.
   */
  async createSession(params: {
    adminUserId: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);

    await this.prisma.adminSession.create({
      data: {
        adminUserId: params.adminUserId,
        tokenHash: hashToken(token),
        expiresAt,
        lastSeenAt: now,
        ip: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined
      }
    });

    return { token, expiresAt };
  }

  /**
   * Resolves a raw cookie token to its session + admin row. Returns null (never
   * throws) for anything that shouldn't authenticate: unknown token, revoked,
   * expired, or an admin that's been deactivated since the session was issued --
   * the guard is responsible for turning that into a 401. A deactivated admin's
   * session is opportunistically revoked here too (defense in depth, since there
   * is currently no admin-deactivation endpoint that revokes proactively).
   */
  async validateSession(token: string): Promise<AdminSessionContext | null> {
    if (!token) {
      return null;
    }
    const tokenHash = hashToken(token);
    const session = await this.prisma.adminSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: session.adminUserId } });
    if (!admin || !admin.active) {
      await this.prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return null;
    }

    await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { sessionId: session.id, admin };
  }

  async revokeSessionByToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.prisma.adminSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  /** Revokes every still-active session for an admin, e.g. on MFA disable or account deactivation. */
  async revokeAllForAdmin(adminUserId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: {
        adminUserId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
      },
      data: { revokedAt: new Date() }
    });
  }
}
