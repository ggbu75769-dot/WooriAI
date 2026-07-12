import type { MemberRole, UserStatus } from "@wooriai/domain";

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  email: string | null;
  status: UserStatus;
  households: Array<{
    id: string;
    name?: string;
    role: MemberRole;
  }>;
};

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  role: "admin" | "editor" | "analyst";
};

export type AuthenticatedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  user?: AuthenticatedUser;
  adminUser?: AuthenticatedAdmin;
  // Optional: only populated when the underlying Express request is used (true at
  // runtime for every HTTP route). Read by AdminAuthGuard to scope the CSRF
  // double-submit check to state-changing methods.
  method?: string;
  // SEC-101: id of the resolved admin_sessions row for this request, set by
  // AdminAuthGuard's cookie-session branch. Used by the MFA-disable endpoint to
  // revoke every *other* session without invalidating the one making the request.
  adminSessionId?: string;
};
