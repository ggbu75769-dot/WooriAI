import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminRole } from "@prisma/client";
import { safeCompare } from "../auth/token.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER, ADMIN_SESSION_COOKIE, parseCookieHeader } from "./admin-cookies";
import { ADMIN_MFA_EXEMPT_KEY } from "./admin-mfa-exempt.decorator";
import { AdminSessionService } from "./admin-session.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { ADMIN_ROLES_KEY } from "./require-admin-roles.decorator";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Primary admin route guard (SEC-102). Accepts either:
 *  - An `admin_session` HttpOnly cookie -- the real per-admin session issued by
 *    POST /admin/auth/login (or .../mfa/verify-login). Subject to CSRF
 *    double-submit verification on state-changing methods, per-route RBAC via
 *    `@RequireAdminRoles(...)`, and the SEC-101 MFA-enrollment gate (routes must
 *    opt out with `@AdminMfaExempt()` to be reachable before an admin finishes
 *    TOTP registration).
 *  - No `admin_session` cookie — falls back to the legacy `x-admin-token` guard,
 *    which is itself development/test-only and bypasses RBAC/MFA entirely (see
 *    AdminTokenGuard).
 *
 * Bearer-JWT admin auth (the pre-SEC-102 scheme) has been removed; admin API
 * access is cookie-session-only outside the dev/test legacy fallback.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
    @Inject(AdminTokenGuard) private readonly legacyGuard: AdminTokenGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = parseCookieHeader(headerValue(request.headers?.cookie));
    const sessionToken = cookies[ADMIN_SESSION_COOKIE];

    if (sessionToken) {
      return this.activateWithSession(context, request, sessionToken, cookies);
    }

    return this.legacyGuard.canActivate(context) as boolean;
  }

  private async activateWithSession(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    sessionToken: string,
    cookies: Record<string, string>
  ): Promise<boolean> {
    const resolved = await this.sessions.validateSession(sessionToken);
    if (!resolved) {
      throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
    }
    const { admin, sessionId } = resolved;

    this.assertCsrfSafe(request, cookies);

    const mfaExempt = this.reflector.get<boolean | undefined>(ADMIN_MFA_EXEMPT_KEY, context.getHandler());
    if (!admin.mfaEnabledAt && !mfaExempt) {
      throw new ForbiddenException({
        code: "ADMIN_MFA_SETUP_REQUIRED",
        message: "먼저 2단계 인증(MFA)을 등록해주세요."
      });
    }

    const requiredRoles = this.reflector.get<AdminRole[] | undefined>(ADMIN_ROLES_KEY, context.getHandler());
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(admin.role)) {
      throw new ForbiddenException({ code: "ADMIN_FORBIDDEN", message: "Admin access is required." });
    }

    request.adminUser = { id: admin.id, email: admin.email, role: admin.role };
    request.adminSessionId = sessionId;
    return true;
  }

  /**
   * SEC-102 §4 double-submit CSRF check: on state-changing methods, the
   * `X-CSRF-Token` header must match the non-HttpOnly `admin_csrf` cookie value.
   * A cross-site attacker can trigger the request (ambient cookie auth) but can't
   * read the CSRF cookie to put its value in the header (same-origin policy), so
   * a mismatch/missing pair means the request didn't originate from the admin
   * web app itself. GET/HEAD/OPTIONS are exempt (no state change).
   */
  private assertCsrfSafe(request: AuthenticatedRequest, cookies: Record<string, string>) {
    const method = (request.method ?? "GET").toUpperCase();
    if (!STATE_CHANGING_METHODS.has(method)) {
      return;
    }

    const csrfCookie = cookies[ADMIN_CSRF_COOKIE];
    const csrfHeader = headerValue(request.headers?.[ADMIN_CSRF_HEADER]);
    if (!csrfCookie || !csrfHeader || !safeCompare(csrfCookie, csrfHeader)) {
      throw new ForbiddenException({ code: "ADMIN_CSRF_INVALID", message: "요청을 다시 시도해주세요." });
    }
  }
}
