import { SetMetadata } from "@nestjs/common";

export const ADMIN_MFA_EXEMPT_KEY = "adminMfaExempt";

/**
 * SEC-101 §9: marks a route as reachable by an admin who is authenticated (has a
 * valid session cookie) but has not yet completed MFA registration. Every other
 * `AdminAuthGuard`-protected route 403s for such an admin until they enroll.
 * Applied to: GET /admin/auth/me, POST /admin/auth/logout, and the MFA setup
 * start/verify endpoints (admin-auth.controller.ts) -- exactly the surface an
 * unregistered admin needs to complete enrollment or sign out.
 */
export const AdminMfaExempt = () => SetMetadata(ADMIN_MFA_EXEMPT_KEY, true);
