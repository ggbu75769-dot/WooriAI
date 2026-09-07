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

/**
 * 한 어드민 **계정**을 향한 실패 로그인의 상한(같은 15분 창).
 *
 * 종전에는 이 상수가 없었고 상한이 `MAX_ATTEMPTS`(5) 하나뿐이었다 — 그때 그 5회는
 * `(이메일, IP)` **쌍**마다 따로 세어졌고, 그것이 이 파일이 가진 유일한 계정 방향 상한이었다.
 * 즉 IP를 바꾸면 같은 이메일에 대해 카운터가 새로 시작했고, 겹치는 다른 상한도
 * `auth:<ip>` 버킷(30회/분/IP, common/security/rate-limit.middleware.ts)뿐이라 **한 계정을
 * 향한 시도 총량에는 상한이 아예 없었다**. MFA 잠금(admin-mfa.service.ts)은 `adminId` 단일
 * 키라 계정 단위지만 비밀번호를 이미 통과한 뒤의 2단계이고, 갓 만들어진 어드민은
 * 임시 비밀번호 + MFA 미등록이라 그 2단계 자체가 없다.
 *
 * 이제 이메일 단독 버킷을 하나 더 두고 쌍 버킷과 **AND**로 묶는다(둘 다 통과해야 시도가 된다).
 * 예산을 `MAX_ATTEMPTS * 5`로 잡은 근거(이 저장소에서 실측한 값들):
 *  - scrypt(N=16384,r=8,p=1) 검증 1회 ≈ 51ms → 한 코어가 낼 수 있는 상한이 ≈ 19.6회/초
 *    (≈1,176회/분). 종전에는 IP만 40여 개면 그 CPU 상한까지 닿았다(40 × 30회/분).
 *    즉 하루 ≈1.69M 추측이 가능했고, 흔한 10만 개짜리 사전은 **약 85분**이면 소진됐다.
 *  - 이제 계정당 25회/15분 = 2,400회/일이라 같은 10만 사전이 **약 42일**이다(≈700배).
 *    로그인 DTO는 최소 길이도 강제하지 않고(AdminLoginDto는 IsNotEmpty뿐), 변경 DTO의
 *    하한도 10자·복잡도 규칙 없음이라 사람이 고른 비밀번호가 사전에 들어 있을 여지가 있다.
 *    지켜야 하는 것은 "며칠 안에 뚫리지 않는다"이지 "이론상 불가능"이 아니다.
 *
 * ⚠️ 이메일 단독 버킷은 **서비스 거부를 만든다**: 공격자가 남의 이메일로 일부러 25번 틀리면
 * 그 사람은 최대 15분 로그인하지 못한다(종전에는 이 거부가 아예 불가능했다 — 상한이 없었으니).
 * 그 대가를 이 값으로 고른 이유:
 *  - 5회/15분(정찰이 제안한 값)이면 거부 비용이 요청 5개로 떨어진다. 반대로 보안 이득은
 *    42일 → 208일로 5배 늘 뿐이다. 이미 "몇 주" 구간에 들어온 뒤의 5배는 실익이 없고,
 *    거부 비용의 5배 하락은 실질 손해다. 50회/15분은 그 반대 방향으로 같은 이유로 탈락.
 *  - 25회는 정상 운영자가 자력으로 닿을 수 없는 값이다. 쌍 버킷이 IP마다 5회에서 먼저 막으므로,
 *    집·사무실·폰 세 곳에서 전부 틀려도 15회다.
 *  - 거부의 최대 길이는 15분이고(창이 지나면 스스로 풀린다) 대상은 **내부 운영 콘솔**이다.
 *    핵심 사용자 루프(지출 기록→준비템→구매)는 이 게이트 뒤에 없다. 반대로 어드민 자격증명이
 *    털리면 카탈로그 쓰기·제휴 URL·스폰서 표시(DNC-011)·사용자 조회까지 한 번에 넘어가고
 *    그쪽은 시간이 지나도 저절로 복구되지 않는다.
 *  - "잠금 대신 지연"은 이 문제를 풀지 못해서 버렸다: 지연은 총량을 묶지 못한다(공격자는
 *    연결을 병렬로 늘려 흡수한다). R-1이 지적한 결함이 정확히 "총량에 상한이 없다"이므로
 *    거절만이 답이고, 대신 성공 로그인 때 이 버킷을 비워(아래 `reset`) 정상 사용자가
 *    공격자의 누적을 스스로 지울 수 있게 했다.
 * 값은 상수 하나이므로, 실제 거부 사건이 관측되면 여기만 고치면 된다.
 */
const EMAIL_MAX_ATTEMPTS = MAX_ATTEMPTS * 5;

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
 * In-memory brute-force limiter. Prototype-grade (no persistence, no
 * cross-instance sharing) — acceptable for the current single-instance
 * deployment; a durable/shared limiter can replace this later without changing
 * the AdminAuthService interface.
 *
 * 종전에는 키가 `email:ip` **한 종류뿐**이었고(그때는 참), 한도도 코드도 `MAX_ATTEMPTS` ·
 * `ADMIN_LOGIN_RATE_LIMITED` 하나로 이 클래스 안에 박혀 있었다. 이제 세 종류가 산다 —
 * `login:<email>:<ip>`(쌍) · `login-email:<email>`(계정, EMAIL_MAX_ATTEMPTS) ·
 * `password-change:<adminId>`(비밀번호 재확인) — 그래서 한도와 에러 코드를 호출부가 정한다.
 * 근거는 각각 EMAIL_MAX_ATTEMPTS 주석과 `changePassword` 주석에 있다.
 *
 * 키에 접두사를 붙인 이유: 접두사가 없으면 `<email>:<ip>`와 이메일 단독 키가 한 이름공간에
 * 살아, 콜론을 품은 로컬파트("a:b"@example.com은 RFC 5321이 허용한다)에서 두 키가 겹칠 수 있다.
 * 겹치면 한쪽 버킷이 다른 쪽 카운터를 소모해 상한이 조용히 무너진다.
 */
class LoginAttemptLimiter {
  private readonly attempts = new Map<string, { count: number; windowStart: number }>();

  assertAllowed(key: string, max: number = MAX_ATTEMPTS, code = "ADMIN_LOGIN_RATE_LIMITED") {
    const entry = this.attempts.get(key);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.windowStart > WINDOW_MS) {
      this.attempts.delete(key);
      return;
    }
    if (entry.count >= max) {
      throw new HttpException(
        { code, message: "너무 많이 시도했어요. 잠시 후 다시 시도해주세요." },
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

/** 종전 `${normalizedEmail}:${ip}` 문자열 그 자리. 이제 접두사가 붙어 아래 두 키와 이름공간이 갈린다. */
function loginPairKey(normalizedEmail: string, ip: string): string {
  return `login:${normalizedEmail}:${ip}`;
}

/**
 * 계정 방향 키. **정규화한 이메일 문자열만** 보고, admin 행을 찾기 전에 판정한다 —
 * 존재하는 이메일에만 버킷을 달면 429/401의 차이가 곧 "그 어드민이 있다"는 신호가 되어,
 * 이 파일이 더미 해시(getDummyPasswordHash)까지 두고 막고 있는 이메일 열거가 되살아난다.
 */
function loginEmailKey(normalizedEmail: string): string {
  return `login-email:${normalizedEmail}`;
}

/** 비밀번호 **재확인**(changePassword) 전용 키. 로그인 버킷과 섞이지 않는다 — 근거는 changePassword 주석. */
function passwordChangeKey(adminId: string): string {
  return `password-change:${adminId}`;
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
    // 종전에는 여기서 쌍 키 하나만 봤고(그때는 참) 그것이 로그인의 유일한 계정 방향 상한이었다.
    // 이제 계정 키를 AND로 더 본다 — 두 버킷 다 통과해야 시도가 된다. 값과 서비스 거부
    // 저울질은 EMAIL_MAX_ATTEMPTS 주석에 있다. 순서는 쌍 → 계정: 같은 IP에서 5번 틀린
    // 흔한 경우의 응답이 종전과 글자 그대로 같게 유지된다(코드·문구·상태 전부 동일).
    const pairKey = loginPairKey(normalizedEmail, ip);
    const emailKey = loginEmailKey(normalizedEmail);
    this.limiter.assertAllowed(pairKey);
    this.limiter.assertAllowed(emailKey, EMAIL_MAX_ATTEMPTS);

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
      // 두 버킷 모두에 센다. 계정 키를 **존재하지 않는 이메일에도 똑같이** 세는 것이 중요하다 —
      // 실재하는 이메일에만 세면 25회째부터 401/429가 갈려 이메일 열거 오라클이 된다.
      this.limiter.recordFailure(pairKey);
      this.limiter.recordFailure(emailKey);
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

    // 계정 키도 함께 비운다: 이것이 이메일 단독 버킷의 서비스 거부 대가를 실제로 깎는 장치다 —
    // 정상 운영자가 한 번 로그인하는 순간 공격자가 쌓아 둔 실패 누적이 사라진다.
    this.limiter.reset(pairKey);
    this.limiter.reset(emailKey);
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
   *
   * 라운드 R-2 — 종전에는 이 재확인에 **시도 제한이 없었다**(그때는 참): 실패하면 감사 로그
   * `admin.password_change_failed` 한 줄만 남고 `limiter.recordFailure` 호출이 없어서,
   * 유일한 상한이 `auth:<ip>` 버킷(30회/분/IP)이었다. 세션을 이미 손에 넣은 자 — 탈취한
   * 쿠키, 또는 자리를 비운 브라우저 — 가 현재 비밀번호를 분당 30회씩 **무한히** 추측할 수
   * 있었고, 알아내면 그 비밀번호의 재사용을 통해 다른 시스템까지 이어졌다. 세션은 IP에
   * 묶여 있지도 않아(admin-session.service.ts는 ip를 기록만 한다) IP를 바꾸면 30회/분도
   * 곱해졌다. 이제 계정 단위(`password-change:<adminId>`) 5회/15분으로 묶는다.
   *
   * 키를 `adminId` 하나로 잡은 것이 로그인 쪽(이메일+IP AND)과 다른 이유는, 여기에는
   * **서비스 거부 대가가 없기 때문이다**: 이 자리에 닿으려면 이미 그 계정의 유효한 세션과
   * CSRF 토큰을 들고 있어야 하므로, 모르는 사람이 남의 계정을 잠글 수 없다. 그래서 IP 축을
   * 섞어 예산을 늘릴 이유가 없고 값도 기본 MAX_ATTEMPTS(5회/15분) 그대로다.
   *
   * 에러 코드는 로그인의 `ADMIN_LOGIN_RATE_LIMITED`가 아니라 전용
   * `ADMIN_PASSWORD_RATE_LIMITED`다 — 어드민 웹은 429를 코드가 아니라 메시지로 보여주므로
   * 화면은 달라지지 않지만, 운영자가 로그에서 "로그인이 막혔다"와 "세션 안에서 비밀번호
   * 재확인이 막혔다"를 구분해야 한다. 후자는 곧 세션 탈취 의심 신호다.
   */
  async changePassword(
    admin: AdminUser,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const attemptKey = passwordChangeKey(admin.id);
    this.limiter.assertAllowed(attemptKey, MAX_ATTEMPTS, "ADMIN_PASSWORD_RATE_LIMITED");
    if (!verifyAdminPassword(currentPassword, admin.passwordHash)) {
      this.limiter.recordFailure(attemptKey);
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
    // 현재 비밀번호를 맞힌 시점에 비운다(아래 정책 검사 400보다 **앞**이다): 새 비밀번호가
    // 정책에 걸려 되돌아온 것은 추측 실패가 아니므로, 그 왕복이 카운터를 태우면 정상 사용자가
    // 자기 오타로 스스로 잠긴다.
    this.limiter.reset(attemptKey);
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
