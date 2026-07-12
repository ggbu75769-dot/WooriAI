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
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminTokenGuard } from "./admin-token.guard";
import { verifyAdminAccessToken } from "./admin-token-crypto";
import { ADMIN_ROLES_KEY } from "./require-admin-roles.decorator";

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Primary admin route guard. Accepts either:
 *  - `Authorization: Bearer <admin JWT>` — verified, cross-checked against the
 *    AdminUser row (must still be active), and subject to per-route RBAC via
 *    `@RequireAdminRoles(...)`.
 *  - No Authorization header — falls back to the legacy `x-admin-token` guard,
 *    which is itself development/test-only and bypasses RBAC (see AdminTokenGuard).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminTokenGuard) private readonly legacyGuard: AdminTokenGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = headerValue(request.headers?.authorization);

    if (authHeader?.startsWith("Bearer ")) {
      return this.activateWithAdminJwt(context, request, authHeader.slice("Bearer ".length).trim());
    }

    return this.legacyGuard.canActivate(context) as boolean;
  }

  private async activateWithAdminJwt(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    token: string
  ): Promise<boolean> {
    const payload = verifyAdminAccessToken(token);
    const adminUser = await this.prisma.adminUser.findUnique({ where: { id: payload.adminId } });
    if (!adminUser || !adminUser.active) {
      throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
    }

    const requiredRoles = this.reflector.get<AdminRole[] | undefined>(ADMIN_ROLES_KEY, context.getHandler());
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(adminUser.role)) {
      throw new ForbiddenException({ code: "ADMIN_FORBIDDEN", message: "Admin access is required." });
    }

    request.adminUser = { id: adminUser.id, email: adminUser.email, role: adminUser.role };
    return true;
  }
}
