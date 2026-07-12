import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { signAdminAccessToken } from "./admin-token-crypto";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Computed once at module load (not per-login) so the scrypt cost is paid a single
// time up front. Verified against on every login attempt for an email that doesn't
// resolve to a real admin, so a "no such admin" response takes roughly the same
// wall-clock time as a "wrong password" response -- without this, the two cases are
// trivially distinguishable by timing (one does a full scrypt verify, the other does
// none), which leaks which admin emails exist.
const DUMMY_PASSWORD_HASH = hashAdminPassword("wooriai-dummy-password-for-constant-time-login");

/**
 * In-memory brute-force limiter keyed by `email:ip`. Prototype-grade (no
 * persistence, no cross-instance sharing) — acceptable for the current
 * single-instance deployment; a durable/shared limiter can replace this later
 * without changing the AdminAuthService interface.
 */
class LoginAttemptLimiter {
  private readonly attempts = new Map<string, { count: number; windowStart: number }>();

  assertAllowed(key: string) {
    const entry = this.attempts.get(key);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.windowStart > WINDOW_MS) {
      this.attempts.delete(key);
      return;
    }
    if (entry.count >= MAX_ATTEMPTS) {
      throw new HttpException(
        { code: "ADMIN_LOGIN_RATE_LIMITED", message: "너무 많이 시도했어요. 잠시 후 다시 시도해주세요." },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  recordFailure(key: string) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.attempts.set(key, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }

  reset(key: string) {
    this.attempts.delete(key);
  }
}

@Injectable()
export class AdminAuthService {
  private readonly limiter = new LoginAttemptLimiter();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  async login(email: string, password: string, ip: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `${normalizedEmail}:${ip}`;
    this.limiter.assertAllowed(rateLimitKey);

    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    // Always runs a scrypt verification, even when no admin matches the email, so
    // the two failure cases (unknown email vs. wrong password) take comparable time.
    const passwordOk = admin
      ? verifyAdminPassword(password, admin.passwordHash)
      : verifyAdminPassword(password, DUMMY_PASSWORD_HASH);

    if (!admin || !admin.active || !passwordOk) {
      this.limiter.recordFailure(rateLimitKey);
      await this.auditLogger.record({
        action: "admin.login_failed",
        targetType: "admin_users",
        targetId: admin?.id ?? null,
        // Email is recorded for investigation of brute-force/credential-stuffing
        // attempts; the password itself must never be logged.
        after: { email: normalizedEmail }
      });
      throw new UnauthorizedException({
        code: "ADMIN_LOGIN_FAILED",
        message: "이메일 또는 비밀번호를 다시 확인해주세요."
      });
    }

    this.limiter.reset(rateLimitKey);
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.login",
      targetType: "admin_users",
      targetId: admin.id
    });

    const { token, expiresIn } = signAdminAccessToken({ adminId: admin.id, role: admin.role });
    return {
      accessToken: token,
      expiresIn,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role
      }
    };
  }
}
