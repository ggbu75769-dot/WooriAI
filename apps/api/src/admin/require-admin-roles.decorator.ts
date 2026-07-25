import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

export const ADMIN_ROLES_KEY = "adminRoles";

/**
 * Restricts a route to the given admin roles when authenticated via the admin JWT
 * (AdminAuthGuard). Routes without this decorator are open to any active admin
 * user regardless of role. The legacy dev/test `x-admin-token` fallback path is not
 * subject to this check — it grants full access, matching its dev-only purpose.
 */
export function RequireAdminRoles(firstRole: AdminRole, ...additionalRoles: AdminRole[]) {
  if (!firstRole) {
    throw new Error("RequireAdminRoles requires at least one role");
  }
  return SetMetadata(ADMIN_ROLES_KEY, [firstRole, ...additionalRoles]);
}
