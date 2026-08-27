import type { MemberRole, UserStatus } from "@wooriai/domain";

/**
 * 요청을 수행하는 사용자. SEC-131 이후 이 객체의 **모든 필드는 DB에서 온다** —
 * `HouseholdRuntimeService.enrichUser`가 매 토큰 검증마다 users/household_members를
 * 읽어 새로 만든다. JWT 페이로드는 더 이상 displayName/email/households를 담지 않으며
 * (평문 base64url이라 헤더·로그에 PII가 상주했다), `sub`(사용자 id)만 이 조회의
 * 입력으로 쓰인다. 따라서 이 타입에 필드를 더할 때 "토큰 클레임에서 읽어 채우는"
 * 방식은 선택지가 아니다 — 조회 대상 테이블을 정해 enrichUser에서 채울 것.
 */
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
  // Populated by the real Express request at runtime (declared optional here since
  // this type also stands in for hand-built request fixtures in unit tests). Used by
  // COM-106's affiliate click logging to compute a salted IP hash — never the raw IP.
  ip?: string;
};
