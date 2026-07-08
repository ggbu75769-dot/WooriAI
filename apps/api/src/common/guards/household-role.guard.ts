import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MemberRole } from "@wooriai/domain";
import type { AuthenticatedRequest } from "../types/authenticated-request";

export const HOUSEHOLD_ROLES_KEY = "wooriai:household_roles";

export function RequireHouseholdRoles(...roles: MemberRole[]) {
  return SetMetadata(HOUSEHOLD_ROLES_KEY, roles);
}

function householdIdFrom(request: AuthenticatedRequest) {
  return (
    request.params?.householdId ??
    (typeof request.body?.householdId === "string" ? request.body.householdId : undefined) ??
    request.query?.householdId
  );
}

@Injectable()
export class HouseholdRoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles =
      this.reflector.getAllAndOverride<MemberRole[]>(HOUSEHOLD_ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const householdId = householdIdFrom(request);
    const membership = request.user?.households.find((household) => household.id === householdId);

    if (!householdId || !membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException("가구 접근 권한이 없어요.");
    }

    return true;
  }
}
