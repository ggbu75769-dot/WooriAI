import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
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

/**
 * `admin_sessions.ip`의 컬럼 폭 — schema.prisma의 `ip String? @db.VarChar(64)`.
 * import 하지 않고 리터럴로 다시 적는다: 스키마 폭을 바꾸는 판단은 아래 주석의
 * "64자를 넘으면 IP일 수 없다"는 논거도 함께 다시 봐야 하는 판단이다.
 */
const ADMIN_SESSION_IP_MAX_LENGTH = 64;

/**
 * 종전에는 `@Ip()`가 준 문자열을 그대로 컬럼에 넣었다 — **그때는 참이었다**: TRUST_PROXY가
 * 꺼져 있으면 Express의 `req.ip`는 소켓의 원격 주소뿐이라 언제나 진짜 IP였고, 64자를 넘길
 * 방법이 없었다.
 *
 * 이제는 아니다. 운영은 `TRUST_PROXY=1`이 기본이고(.env.example:5 · fly.toml [env] ·
 * docs/5차/day1-deploy-runbook.md — per-IP 레이트리밋의 성립 조건이라 반드시 켠다),
 * 그러면 bootstrap.ts의 `set("trust proxy", 1)` 때문에 `req.ip`는 `X-Forwarded-For`의
 * 마지막 항목이 된다. Express는 그 항목이 IP인지 **검사하지 않는다**. 그래서 클라이언트가
 * 붙인 임의 문자열이 이 칸까지 흘러 Postgres 22001(Prisma P2000)을 내고,
 * **비밀번호가 맞은 로그인이 500 INTERNAL_SERVER_ERROR로 끝난다**(실측:
 * `X-Forwarded-For: 10.0.0.1, <200자>` → 500, 세션 행 0개 — 즉 그 관리자는 어드민 콘솔에
 * 아예 들어갈 수 없다). 그래서 폭을 넘는 값은 여기서 null로 떨어뜨린다.
 *
 * 세 갈래 중 null을 고른 근거:
 *  - **400 거절이 아닌 이유**: 이 값은 사용자가 입력한 것이 아니라 프록시가 붙인 헤더다.
 *    거절당한 관리자는 이유를 알 수도, 고칠 수도 없다. 게다가 이 칸은 인증에 쓰이지
 *    않는 감사용 메타데이터다 — 자격증명이 맞은 로그인을 메타데이터 때문에 막으면,
 *    사고를 수습하러 들어오는 바로 그 도구가 닫힌다.
 *  - **자르지 않는 이유**: 이 저장소에 slice 선례가 있지만(households/household-runtime.service.ts의
 *    `providerUserId` `.slice(0,191)`, common/idempotency/idempotency.interceptor.ts의
 *    `endpoint` `.slice(0,120)`) 그 둘은 잘려도 여전히 **같은 것을 가리키는 식별자**다.
 *    이 칸은 다르다: IPv4는 최대 15자, IPv6는 45자, 포트를 붙여도 54자이므로
 *    **64자를 넘는 값은 정의상 IP가 아니다**. 앞 64자만 남기면 "IP" 칸에 IP가 아닌
 *    문자열의 앞토막이 앉고, 사고 조사자는 그것이 주소인지 잘린 위조 문자열인지
 *    구분할 수 없다 — 감사 칸이 거짓을 말하게 된다.
 *  - **null이 잃는 것**: 진짜 주소는 한 번도 잃지 않는다(위 폭 논거). 종전에는 이 경우
 *    500이라 세션 행 자체가 없었으므로 "그 시각 어느 IP였나"의 답도 없었고, 이제는
 *    최소한 세션 행·시각·User-Agent가 남는다. 즉 감사 가치는 줄지 않고 늘어난다.
 *    누가 언제 로그인했는가는 원래 이 표가 아니라 audit_logs(`admin.login`, 730일)가
 *    보존한다 — worker/jobs/admin-session-cleanup.job.ts 머리말 참고.
 */
function sessionIpOrNull(ip: string | null, logger: Logger): string | null {
  if (ip === null || ip.length <= ADMIN_SESSION_IP_MAX_LENGTH) {
    return ip;
  }
  // 값 자체는 로그에 싣지 않는다(클라이언트가 통제하는 문자열 — 로그 주입 방지). 길이만
  // 남겨도 "이 세션의 ip가 null인 이유"를 조사자가 되짚기에는 충분하다.
  logger.warn(
    `X-Forwarded-For에서 온 클라이언트 주소가 ${ip.length}자여서 admin_sessions.ip에 기록하지 않았어요 ` +
      `(상한 ${ADMIN_SESSION_IP_MAX_LENGTH}자 — IP 주소일 수 없는 길이). 세션은 정상 발급됐어요.`
  );
  return null;
}

@Injectable()
export class AdminSessionService {
  private readonly logger = new Logger(AdminSessionService.name);

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
        ip: sessionIpOrNull(params.ip, this.logger) ?? undefined,
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
