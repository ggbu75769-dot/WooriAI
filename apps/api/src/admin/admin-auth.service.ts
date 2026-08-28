import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AdminUser } from "@prisma/client";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionService } from "./admin-session.service";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { signAdminMfaPendingToken, verifyAdminMfaPendingToken } from "./admin-token-crypto";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const DUMMY_PASSWORD = "wooriai-dummy-password-for-constant-time-login";
let dummyPasswordHash: string | null = null;

/**
 * The hash that a login attempt for an email with no matching admin is verified
 * against, so a "no such admin" response takes roughly the same wall-clock time as
 * a "wrong password" response -- without it the two cases are trivially
 * distinguishable by timing (one does a full scrypt verify, the other does none),
 * which leaks which admin emails exist.
 *
 * Computed on first use and memoized, rather than at module load: `hashAdminPassword`
 * is a ~16-32MB scrypt derivation, and paying it at import time charged it to every
 * process that merely *loads* AdminModule -- notably each vitest worker booting a Nest
 * app, which is why the api suite had to be pinned to a single thread (many workers
 * deriving simultaneously could exhaust memory: "Deriving bits failed" / worker OOM).
 *
 * The constant-time property is preserved because `login` calls this unconditionally,
 * before it knows whether the email resolves to an admin: the one-time derivation is
 * charged to the first login attempt of the process whichever branch it takes, and
 * every attempt after that -- existing email or not -- costs exactly one scrypt verify.
 */
function getDummyPasswordHash(): string {
  dummyPasswordHash ??= hashAdminPassword(DUMMY_PASSWORD);
  return dummyPasswordHash;
}

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

export type AdminProfile = { id: string; email: string; displayName: string; role: AdminUser["role"] };

export type AdminLoginResult =
  | { status: "mfa_required"; mfaToken: string; expiresIn: number }
  | {
      status: "ok";
      admin: AdminProfile;
      mfaEnabled: boolean;
      mfaRecoveryCodesRemaining: number;
      session: { token: string; expiresAt: Date };
    };

function toProfile(admin: AdminUser): AdminProfile {
  return { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role };
}

/**
 * 라운드 64 D(#7) — 이 계정에 **남은 복구 코드 장수**.
 *
 * 개수만이다. 값도 해시도 절대 응답에 싣지 않는다(`mfaRecoveryCodes`에는 sha256 해시가
 * 들어 있고, 그것을 내보낼 이유가 하나도 없다). 라운드 63 #3이 재등록 입구를 세우면서
 * 화면이 "복구 코드는 한 번만 쓸 수 있어요"라고 말하기 시작했는데, 서버는 잔량을 알고
 * 있으면서도(로그인 때 쓴 코드를 목록에서 빼고 남은 배열을 다시 쓴다 — verifyMfaCode)
 * 세션 응답이 나르는 것은 `mfaEnabled` 불리언 하나뿐이라 화면이 물어볼 자리가 없었다.
 * 그 결과 폰을 바꾼 운영자는 **마지막 한 장을 쓴 사실을 다 쓴 뒤에야** 알았고, 그 시점엔
 * 재등록 입구(MfaDisableForm)조차 코드를 요구하므로 `admin_users` 직접 UPDATE 말고는
 * 길이 없었다 — 라운드 63이 없애려던 바로 그 상태다.
 *
 * 잔량 노출이 공격자에게 주는 정보는 "몇 번 더 시도할 수 있나"가 아니다: 복구 코드는
 * 추측 대상이 아니라 소지 대상이고, 이 값은 **로그인을 마친 세션에만** 보인다(login의 ok
 * 분기 · verify-login · me — 셋 다 세션이 발급된 뒤다). 다음 라운드가 이 판단을 되돌리지
 * 않도록 근거를 여기에 남긴다.
 */
function recoveryCodesRemaining(admin: AdminUser): number {
  return Array.isArray(admin.mfaRecoveryCodes) ? admin.mfaRecoveryCodes.length : 0;
}

function requestContext(ip: string | null, userAgent: string | null) {
  return { ip, userAgent };
}

@Injectable()
export class AdminAuthService {
  private readonly limiter = new LoginAttemptLimiter();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
    @Inject(AdminMfaService) private readonly mfa: AdminMfaService
  ) {}

  async login(email: string, password: string, ip: string, userAgent: string | null): Promise<AdminLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `${normalizedEmail}:${ip}`;
    this.limiter.assertAllowed(rateLimitKey);

    // Resolved before the lookup, so the memoized first-use derivation is charged to
    // whichever branch happens to be the process's first login attempt rather than
    // only to the unknown-email one (see getDummyPasswordHash).
    const fallbackHash = getDummyPasswordHash();

    const admin = await this.prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    // Always runs a scrypt verification, even when no admin matches the email, so
    // the two failure cases (unknown email vs. wrong password) take comparable time.
    const passwordOk = admin
      ? verifyAdminPassword(password, admin.passwordHash)
      : verifyAdminPassword(password, fallbackHash);

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
    // MFA 미등록 분기라 복구 코드도 아직 없다(등록을 마칠 때 10장이 발급된다).
    return { status: "ok", admin: toProfile(admin), mfaEnabled: false, mfaRecoveryCodesRemaining: 0, session };
  }

  async verifyLoginMfa(
    mfaToken: string,
    code: string,
    ip: string,
    userAgent: string | null
  ): Promise<{
    admin: AdminProfile;
    mfaEnabled: true;
    mfaRecoveryCodesRemaining: number;
    session: { token: string; expiresAt: Date };
  }> {
    const payload = verifyAdminMfaPendingToken(mfaToken);
    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminId } });
    if (!admin || !admin.active || !admin.mfaEnabledAt || !admin.totpSecret) {
      throw new UnauthorizedException({ code: "ADMIN_MFA_TOKEN_INVALID", message: "다시 로그인해주세요." });
    }

    const { valid, recoveryCodeUsed, recoveryCodesRemaining: remaining } = await this.verifyMfaCode(admin, code);
    if (!valid) {
      this.recordMfaFailure(admin.id);
      await this.auditLogger.record({
        actorUserId: admin.id,
        action: "admin.mfa_login_failed",
        targetType: "admin_users",
        targetId: admin.id
      });
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }

    this.mfa.limiter.reset(admin.id);
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
    // 라운드 64 D(#7): 잔량은 **이번 로그인에서 소모한 뒤**의 값이다 — `admin` 행은 코드
    // 소모 전에 읽은 스냅샷이라 그 배열을 다시 세면 방금 태운 한 장이 남아 있는 것처럼
    // 보인다. 그래서 verifyMfaCode가 갱신 후 개수를 함께 돌려준다.
    return { admin: toProfile(admin), mfaEnabled: true, mfaRecoveryCodesRemaining: remaining, session };
  }

  async startMfaSetup(admin: AdminUser): Promise<{ otpauthUrl: string; secret: string; email: string }> {
    if (admin.mfaEnabledAt) {
      throw new HttpException(
        { code: "ADMIN_MFA_ALREADY_ENABLED", message: "이미 MFA가 등록되어 있어요. 먼저 해제한 뒤 다시 등록해주세요." },
        HttpStatus.BAD_REQUEST
      );
    }

    // Idempotent: re-visiting the setup screen before finalizing reuses the same
    // secret instead of rotating it, so a previously-scanned QR code stays valid.
    const secret = admin.totpSecret ?? this.mfa.generateSecret();
    if (secret !== admin.totpSecret) {
      await this.prisma.adminUser.update({ where: { id: admin.id }, data: { totpSecret: secret } });
    }

    return { otpauthUrl: this.mfa.buildOtpauthUrl(admin.email, secret), secret, email: admin.email };
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

    this.mfa.limiter.assertNotLocked(admin.id);
    const valid = await this.mfa.verifyTotp(admin.totpSecret, code);
    if (!valid) {
      this.recordMfaFailure(admin.id);
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }
    this.mfa.limiter.reset(admin.id);

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
      this.recordMfaFailure(admin.id);
      throw new UnauthorizedException({ code: "ADMIN_MFA_INVALID", message: "인증 코드를 다시 확인해주세요." });
    }
    this.mfa.limiter.reset(admin.id);

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

  /**
   * ADM-007: self-service password change for the logged-in admin. Fixes the
   * "temp password is permanent" gap from ADM-006's create flow. Deliberately
   * reachable before MFA enrollment (the controller marks the route
   * @AdminMfaExempt, same precedent as the mfa/setup endpoints) so a freshly
   * created admin can rotate their one-time temp password immediately.
   *
   * The current password is re-verified with the same constant-time scrypt
   * comparison as login; on success the hash is replaced and every OTHER
   * session of this admin is revoked (the session performing the change stays
   * valid). Neither password ever reaches the audit log.
   */
  async changePassword(
    admin: AdminUser,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!verifyAdminPassword(currentPassword, admin.passwordHash)) {
      await this.auditLogger.record({
        actorUserId: admin.id,
        action: "admin.password_change_failed",
        targetType: "admin_users",
        targetId: admin.id
      });
      throw new UnauthorizedException({
        code: "ADMIN_PASSWORD_INVALID",
        message: "현재 비밀번호를 다시 확인해주세요."
      });
    }
    if (verifyAdminPassword(newPassword, admin.passwordHash)) {
      throw new HttpException(
        { code: "ADMIN_PASSWORD_UNCHANGED", message: "새 비밀번호는 기존 비밀번호와 달라야 해요." },
        HttpStatus.BAD_REQUEST
      );
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: hashAdminPassword(newPassword) }
    });
    // 비밀번호가 바뀌면 다른 곳에서 살아 있던 세션은 전부 폐기한다(탈취 대비).
    // 지금 변경을 수행한 세션만 유지.
    await this.sessions.revokeAllForAdmin(admin.id, currentSessionId);

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.password_changed",
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

  me(admin: AdminUser): { admin: AdminProfile; mfaEnabled: boolean; mfaRecoveryCodesRemaining: number } {
    return {
      admin: toProfile(admin),
      mfaEnabled: !!admin.mfaEnabledAt,
      // 후방 호환 가산 필드 — `mfaEnabled` 불리언은 그대로다(구버전 어드민 번들 무영향).
      mfaRecoveryCodesRemaining: recoveryCodesRemaining(admin)
    };
  }

  private async verifyMfaCode(
    admin: AdminUser,
    code: string
  ): Promise<{ valid: boolean; recoveryCodeUsed: boolean; recoveryCodesRemaining: number }> {
    this.mfa.limiter.assertNotLocked(admin.id);
    const remainingBefore = recoveryCodesRemaining(admin);

    if (admin.totpSecret && (await this.mfa.verifyTotp(admin.totpSecret, code))) {
      return { valid: true, recoveryCodeUsed: false, recoveryCodesRemaining: remainingBefore };
    }

    const storedRecoveryCodes = Array.isArray(admin.mfaRecoveryCodes) ? (admin.mfaRecoveryCodes as string[]) : [];
    if (storedRecoveryCodes.length > 0) {
      const { matched, remaining } = this.mfa.consumeRecoveryCode(storedRecoveryCodes, code);
      if (matched) {
        await this.prisma.adminUser.update({ where: { id: admin.id }, data: { mfaRecoveryCodes: remaining } });
        // 방금 태운 한 장을 뺀 값(라운드 64 D #7). 호출부의 `admin` 행은 소모 전 스냅샷이다.
        return { valid: true, recoveryCodeUsed: true, recoveryCodesRemaining: remaining.length };
      }
    }

    return { valid: false, recoveryCodeUsed: false, recoveryCodesRemaining: remainingBefore };
  }

  private recordMfaFailure(adminId: string) {
    this.mfa.limiter.recordFailure(adminId);
    if (this.mfa.limiter.isNowLocked(adminId)) {
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
