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

export type AuthenticatedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  user?: AuthenticatedUser;
};
