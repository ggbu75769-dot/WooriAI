import { HttpException, HttpStatus, Inject, Injectable, type OnModuleDestroy, UnauthorizedException } from "@nestjs/common";
import type { AdminUser } from "@prisma/client";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionService } from "./admin-session.service";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { signAdminMfaPendingToken, verifyAdminMfaPendingToken } from "./admin-token-crypto";
import { DistributedAttemptLimiter } from "../common/security/distributed-attempt-limiter";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Computed once at module load (not per-login) so the scrypt cost is paid a single
// time up front. Verified against on every login attempt for an email that doesn't
// resolve to a real admin, so a "no such admin" response takes roughly the same
// wall-clock time as a "wrong password" response -- without this, the two cases are
// trivially distinguishable by timing (one does a full scrypt verify, the other does
// none), which leaks which admin emails exist.
const DUMMY_PASSWORD_HASH = hashAdminPassword("wooriai-dummy-password-for-constant-time-login");

export type AdminProfile = { id: string; email: string; displayName: string; role: AdminUser["role"] };

export type AdminLoginResult =
  | { status: "mfa_required"; mfaToken: string; expiresIn: number }
  | { status: "ok"; admin: AdminProfile; mfaEnabled: boolean; session: { token: string; expiresAt: Date } };

function toProfile(admin: AdminUser): AdminProfile {
  return { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role };
}

function requestContext(ip: string | null, userAgent: string | null) {
  return { ip, userAgent };
}

@Injectable()
export class AdminAuthService implements OnModuleDestroy {
  private readonly limiter = new DistributedAttemptLimiter("admin-login", MAX_ATTEMPTS, WINDOW_MS);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
    @Inject(AdminMfaService) private readonly mfa: AdminMfaService
  ) {}

  onModuleDestroy() {
    this.limiter.close();
  }

  async login(email: string, password: string, ip: string, userAgent: string | null): Promise<AdminLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `${normalizedEmail}:${ip}`;
    await this.limiter.assertAllowed(rateLimitKey, "ADMIN_LOGIN_RATE_LIMITED", "너무 많이 시도되었습니다. 잠시 후 다시 시도해주세요.");

    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    // Always runs a scrypt verification, even when no admin matches the email, so
    // the two failure cases (unknown email vs. wrong password) take comparable time.
    const passwordOk = admin
      ? verifyAdminPassword(password, admin.passwordHash)
      : verifyAdminPassword(password, DUMMY_PASSWORD_HASH);

    if (!admin || !admin.active || !passwordOk) {
      await this.limiter.recordFailure(rateLimitKey);
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

    await this.limiter.reset(rateLimitKey);
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.login",
      targetType: "admin_users",
      targetId: admin.id
    });

    // SEC-101 §9: an admin who has completed MFA registration must pass the TOTP
    // step before any session cookie is issued. An admin who hasn't registered yet
    // gets a full session immediately -- the AdminAuthGuard is what then restricts
    // them to the MFA-setup endpoints until they enroll (see admin-auth.guard.ts).
    if (admin.mfaEnabledAt) {
      const { token, expiresIn } = signAdminMfaPendingToken({ adminId: admin.id });
      return { status: "mfa_required", mfaToken: token, expiresIn };
    }

    const session = await this.sessions.createSession({
      adminUserId: admin.id,
      ...requestContext(ip, userAgent)
    });
    return { status: "ok", admin: toProfile(admin), mfaEnabled: false, session };
  }

  async verifyLoginMfa(
    mfaToken: string,
    code: string,
    ip: string,
    userAgent: string | null
  ): Promise<{ admin: AdminProfile; mfaEnabled: true; session: { token: string; expiresAt: Date } }> {
    const payload = verifyAdminMfaPendingToken(mfaToken);
    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminId } });
    if (!admin || !admin.active || !admin.mfaEnabledAt || !admin.totpSecret) {
      throw new UnauthorizedException({ code: "ADMIN_MFA_TOKEN_INVALID", message: "다시 로그인해주세요." });
    }

    const { valid, recoveryCodeUsed } = await this.verifyMfaCode(admin, code);
    if (!valid) {
      await this.recordMfaFailure(admin.id);
      await this.auditLogger.record({
        actorUserId: admin.id,
        action: "admin.mfa_login_failed",
        targetType: "admin_users",
        targetId: admin.id
      });
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }

    await this.mfa.limiter.reset(admin.id);
    if (recoveryCodeUsed) {
      await this.auditLogger.record({
        actorUserId: admin.id,
        action: "admin.mfa_recovery_code_used",
        targetType: "admin_users",
        targetId: admin.id
      });
    }

    const session = await this.sessions.createSession({
      adminUserId: admin.id,
      ...requestContext(ip, userAgent)
    });
    return { admin: toProfile(admin), mfaEnabled: true, session };
  }

  async startMfaSetup(admin: AdminUser): Promise<{ otpauthUrl: string; secret: string; email: string }> {
    if (admin.mfaEnabledAt) {
      throw new HttpException(
        { code: "ADMIN_MFA_ALREADY_ENABLED", message: "이미 MFA가 등록되어 있어요. 먼저 해제한 뒤 다시 등록해주세요." },
        HttpStatus.BAD_REQUEST
      );
    }

    // The browser can issue overlapping setup requests while the route is
    // mounting. Persist a secret with compare-and-set, then read the winner so
    // every request renders the exact secret that verification will use.
    if (!admin.totpSecret) {
      const candidate = this.mfa.generateSecret();
      await this.prisma.adminUser.updateMany({
        where: { id: admin.id, totpSecret: null, mfaEnabledAt: null },
        data: { totpSecret: candidate }
      });
    }
    const current = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    if (current.mfaEnabledAt) {
      throw new HttpException(
        { code: "ADMIN_MFA_ALREADY_ENABLED", message: "이미 MFA가 등록되어 있어요. 먼저 해제한 뒤 다시 등록해주세요." },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!current.totpSecret) {
      throw new HttpException(
        { code: "ADMIN_MFA_SETUP_UNAVAILABLE", message: "MFA 등록을 다시 시작해주세요." },
        HttpStatus.CONFLICT
      );
    }

    return { otpauthUrl: this.mfa.buildOtpauthUrl(current.email, current.totpSecret), secret: current.totpSecret, email: current.email };
  }

  async verifyMfaSetup(admin: AdminUser, code: string): Promise<{ recoveryCodes: string[] }> {
    if (admin.mfaEnabledAt) {
      throw new HttpException(
        { code: "ADMIN_MFA_ALREADY_ENABLED", message: "이미 MFA가 등록되어 있어요." },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!admin.totpSecret) {
      throw new HttpException(
        { code: "ADMIN_MFA_SETUP_NOT_STARTED", message: "먼저 MFA 등록을 시작해주세요." },
        HttpStatus.BAD_REQUEST
      );
    }

    await this.mfa.limiter.assertAllowed(admin.id, "ADMIN_MFA_LOCKED", "인증 시도가 너무 많습니다. 15분 후 다시 시도해주세요.");
    const valid = await this.mfa.verifyTotp(admin.totpSecret, code);
    if (!valid) {
      await this.recordMfaFailure(admin.id);
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }
    await this.mfa.limiter.reset(admin.id);

    const { plain, hashed } = this.mfa.generateRecoveryCodes();
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { mfaEnabledAt: new Date(), mfaRecoveryCodes: hashed }
    });

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.mfa_enabled",
      targetType: "admin_users",
      targetId: admin.id
    });

    return { recoveryCodes: plain };
  }

  async disableMfa(admin: AdminUser, currentSessionId: string, code: string): Promise<void> {
    if (!admin.mfaEnabledAt || !admin.totpSecret) {
      throw new HttpException(
        { code: "ADMIN_MFA_NOT_ENABLED", message: "MFA가 등록되어 있지 않아요." },
        HttpStatus.BAD_REQUEST
      );
    }

    const { valid } = await this.verifyMfaCode(admin, code);
    if (!valid) {
      await this.recordMfaFailure(admin.id);
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }
    await this.mfa.limiter.reset(admin.id);

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [] }
    });
    await this.sessions.revokeAllForAdmin(admin.id, currentSessionId);

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.mfa_disabled",
      targetType: "admin_users",
      targetId: admin.id
    });
  }

  async logout(token: string, admin: AdminUser): Promise<void> {
    await this.sessions.revokeSessionByToken(token);
    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.logout",
      targetType: "admin_users",
      targetId: admin.id
    });
  }

  me(admin: AdminUser): { admin: AdminProfile; mfaEnabled: boolean } {
    return { admin: toProfile(admin), mfaEnabled: !!admin.mfaEnabledAt };
  }

  private async verifyMfaCode(admin: AdminUser, code: string): Promise<{ valid: boolean; recoveryCodeUsed: boolean }> {
    await this.mfa.limiter.assertAllowed(admin.id, "ADMIN_MFA_LOCKED", "인증 시도가 너무 많습니다. 15분 후 다시 시도해주세요.");

    if (admin.totpSecret && (await this.mfa.verifyTotp(admin.totpSecret, code))) {
      return { valid: true, recoveryCodeUsed: false };
    }

    const storedRecoveryCodes = Array.isArray(admin.mfaRecoveryCodes) ? (admin.mfaRecoveryCodes as string[]) : [];
    if (storedRecoveryCodes.length > 0) {
      const { matched, remaining } = this.mfa.consumeRecoveryCode(storedRecoveryCodes, code);
      if (matched) {
        await this.prisma.adminUser.update({ where: { id: admin.id }, data: { mfaRecoveryCodes: remaining } });
        return { valid: true, recoveryCodeUsed: true };
      }
    }

    return { valid: false, recoveryCodeUsed: false };
  }

  private async recordMfaFailure(adminId: string) {
    if (await this.mfa.limiter.recordFailure(adminId)) {
      // Fire-and-forget: locking out an admin shouldn't be delayed by (or fail
      // because of) audit persistence, and the caller is about to throw either way.
      void this.auditLogger.record({
        actorUserId: adminId,
        action: "admin.mfa_locked",
        targetType: "admin_users",
        targetId: adminId
      });
    }
  }
}
