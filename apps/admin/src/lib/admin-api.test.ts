import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  createAdminUser,
  isAuthError,
  isSelfUpdateForbiddenError,
  listAdminUsers,
  updateAdminUser,
  type AdminUserAccount
} from "./admin-api";

const SAMPLE_ADMIN: AdminUserAccount = {
  id: "9b2e8a76-1234-4cde-8f00-aabbccddeeff",
  email: "new-admin@example.com",
  displayName: "새 관리자",
  role: "editor",
  active: true,
  lastLoginAt: null,
  createdAt: "2026-08-14T00:00:00.000Z"
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ADM-006 admin-account endpoints: exercise the real request() wrapper (URL,
// method, CSRF double-submit header, credentials, error envelope mapping)
// against a stubbed fetch. `document` is stubbed because the CSRF token is
// read from the non-HttpOnly `admin_csrf` cookie.
describe("admin users API client (ADM-006)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123; other=1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /admin/users lists accounts without a CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { adminUsers: [SAMPLE_ADMIN] }));

    const result = await listAdminUsers();

    expect(result.adminUsers).toEqual([SAMPLE_ADMIN]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/users");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    // CSRF echo is only for state-changing methods.
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("POST /admin/users sends the CSRF header and returns the one-time tempPassword", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { admin: SAMPLE_ADMIN, tempPassword: "temp-secret-24chars" }));

    const result = await createAdminUser({ email: "new-admin@example.com", role: "editor", displayName: "새 관리자" });

    expect(result.admin).toEqual(SAMPLE_ADMIN);
    expect(result.tempPassword).toBe("temp-secret-24chars");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/users");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "new-admin@example.com",
      role: "editor",
      displayName: "새 관리자"
    });
  });

  it("PATCH /admin/users/:id sends the CSRF header and partial role/active input", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { admin: { ...SAMPLE_ADMIN, active: false } }));

    const result = await updateAdminUser(SAMPLE_ADMIN.id, { active: false });

    expect(result.admin.active).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`/api/v1/admin/users/${SAMPLE_ADMIN.id}`);
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(JSON.parse(String(init.body))).toEqual({ active: false });
  });

  it("maps the API error envelope onto AdminApiError with status, code, and message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "ADMIN_EMAIL_EXISTS", message: "이미 등록된 관리자 이메일이에요." } })
    );

    const failure = await createAdminUser({ email: "dup@example.com", role: "admin" }).catch((error) => error);

    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(409);
    expect((failure as AdminApiError).code).toBe("ADMIN_EMAIL_EXISTS");
    expect((failure as AdminApiError).message).toBe("이미 등록된 관리자 이메일이에요.");
  });

  it("recognizes the self-demotion/self-deactivation 403 via isSelfUpdateForbiddenError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        error: { code: "ADMIN_SELF_UPDATE_FORBIDDEN", message: "자기 자신의 권한 강등이나 비활성화는 할 수 없어요." }
      })
    );

    const failure = await updateAdminUser(SAMPLE_ADMIN.id, { role: "analyst" }).catch((error) => error);

    expect(isSelfUpdateForbiddenError(failure)).toBe(true);
    // A role-RBAC/CSRF/MFA 403 must never be treated as session expiry.
    expect(isAuthError(failure)).toBe(false);
  });

  it("isSelfUpdateForbiddenError ignores unrelated errors", () => {
    expect(isSelfUpdateForbiddenError(new AdminApiError(403, "forbidden", "FORBIDDEN"))).toBe(false);
    expect(isSelfUpdateForbiddenError(new AdminApiError(401, "unauthorized"))).toBe(false);
    expect(isSelfUpdateForbiddenError(new Error("network"))).toBe(false);
    expect(isSelfUpdateForbiddenError(null)).toBe(false);
  });
});
