import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { safeCompare } from "../auth/token.service";
import { isDevOrTestEnv, requireSecret } from "../common/config/require-secret";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Legacy shared-secret admin guard (`x-admin-token`). Kept only as a development/test
 * convenience fallback — see AdminAuthGuard, which composes this guard with the
 * proper per-admin JWT + RBAC flow. Outside development/test this guard always
 * rejects, even if WOORIAI_ADMIN_TOKEN happens to be configured, so a
 * misconfigured production deploy can never be unlocked by the shared dev token.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Checked before touching the secret at all: outside development/test this
    // guard always rejects, so a production deploy with a missing
    // WOORIAI_ADMIN_TOKEN fails closed with a normal 403 here instead of a 500
    // from requireSecret's configuration-error throw.
    if (!isDevOrTestEnv()) {
      throw new ForbiddenException({ code: "ADMIN_FORBIDDEN", message: "Admin access is required." });
    }

    const token = headerValue(request.headers?.["x-admin-token"]);
    const expectedToken = requireSecret("WOORIAI_ADMIN_TOKEN", "dev-admin-token");

    if (typeof token !== "string" || !safeCompare(token, expectedToken)) {
      throw new ForbiddenException({ code: "ADMIN_FORBIDDEN", message: "Admin access is required." });
    }

    request.adminUser = { id: "dev-admin", email: "dev-admin@wooriai.local", role: "admin" };
    return true;
  }
}
