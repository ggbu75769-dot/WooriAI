import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  AdminApiTimeoutError,
  adminChangePassword,
  adminLogin,
  adminLogout,
  adminMfaDisable,
  adminMfaSetupStart,
  adminMfaSetupVerify,
  adminVerifyMfaLogin,
  bulkPreviewProductLinks,
  CONNECTION_FAILURE_CODE,
  isConnectionFailureError,
  createAdminUser,
  createItemTemplate,
  createProductLink,
  DEFAULT_FETCH_TIMEOUT_MS,
  getAdminDashboardSummary,
  isAuthError,
  isIdempotentTimeoutError,
  isRetryUnsafeTimeoutError,
  isSelfUpdateForbiddenError,
  isTimeoutError,
  listAdminUsers,
  listAuditLogs,
  listProductLinks,
  updateAdminUser,
  updateDisclosure,
  updateItemTemplate,
  WRITE_FETCH_TIMEOUT_MS,
  bulkApplyProductLinks,
  timeoutMsForMethod,
  type AdminDashboardSummary,
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

  // ADM-007: self-service password change for the logged-in admin.
  it("POST /admin/auth/change-password sends both passwords with the CSRF header and maps the wrong-current-password 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true }));

    const result = await adminChangePassword("old-password-1", "new-password-2");

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/auth/change-password");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: "old-password-1", newPassword: "new-password-2" });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: "ADMIN_PASSWORD_INVALID", message: "현재 비밀번호를 다시 확인해주세요." } })
    );
    const failure = await adminChangePassword("wrong", "new-password-2").catch((error) => error);
    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(401);
    expect((failure as AdminApiError).code).toBe("ADMIN_PASSWORD_INVALID");
  });

  // ADM-008: dashboard home summary strip.
  it("GET /admin/dashboard/summary returns the ops counters without a CSRF header", async () => {
    const summary: AdminDashboardSummary = {
      activeUsers: 120,
      households: 80,
      childrenCount: 95,
      expensesTotal: 4321,
      affiliateClicks7d: 67,
      analyticsEvents7d: 890,
      pendingContentRevisions: 3,
      productLinksBrokenCount: 2,
      productLinksActiveCount: 58,
      productLinksUncheckedCount: 34
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, summary));

    const result = await getAdminDashboardSummary();

    expect(result).toEqual(summary);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/dashboard/summary");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    // Read-only endpoint: no CSRF echo on GET.
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("maps a dashboard-summary failure onto AdminApiError without treating a 403 as session expiry", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: "ADMIN_MFA_SETUP_REQUIRED", message: "먼저 2단계 인증(MFA)을 등록해주세요." } })
    );

    const failure = await getAdminDashboardSummary().catch((error) => error);

    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(403);
    expect((failure as AdminApiError).code).toBe("ADMIN_MFA_SETUP_REQUIRED");
    expect(isAuthError(failure)).toBe(false);
  });

  it("isSelfUpdateForbiddenError ignores unrelated errors", () => {
    expect(isSelfUpdateForbiddenError(new AdminApiError(403, "forbidden", "FORBIDDEN"))).toBe(false);
    expect(isSelfUpdateForbiddenError(new AdminApiError(401, "unauthorized"))).toBe(false);
    expect(isSelfUpdateForbiddenError(new Error("network"))).toBe(false);
    expect(isSelfUpdateForbiddenError(null)).toBe(false);
  });
});

// ADM-117: fetch timeout hardening -- mirrors the mobile client's
// DEFAULT_FETCH_TIMEOUT_MS + AbortController precedent so a hung request
// settles as a typed Korean timeout error instead of leaving the admin UI on
// "처리 중..." forever.
describe("admin API fetch timeout (ADM-117)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Simulates real fetch behavior against a hung server: never settles until
   * the AbortController signal fires, then rejects with an AbortError-shaped
   * error, exactly as the platform fetch does. */
  function hangingFetch(_url: string, init: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  }

  it("passes an AbortSignal to fetch on every request", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ auditLogs: [], pageInfo: { total: 0, limit: 100, offset: 0, hasMore: false } }), {
        status: 200
      })
    );

    await listAuditLogs({ limit: 100, offset: 0 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts a hung GET after 10s and rejects with the typed Korean timeout error", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);

    const pending = listAuditLogs().catch((error) => error);
    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    const failure = await pending;

    expect(failure).toBeInstanceOf(AdminApiTimeoutError);
    // Subclass of AdminApiError -> existing error display paths keep working.
    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(0);
    expect((failure as AdminApiError).code).toBe("TIMEOUT");
    expect((failure as AdminApiError).message).toContain("시간이 초과됐어요");
    expect(isTimeoutError(failure)).toBe(true);
    // FIX-118C: 읽기는 그냥 다시 부르면 되므로 재시도 위험 플래그가 꺼져 있다.
    expect((failure as AdminApiTimeoutError).method).toBe("GET");
    expect((failure as AdminApiTimeoutError).retryUnsafe).toBe(false);
    expect(isRetryUnsafeTimeoutError(failure)).toBe(false);
    // A timeout is not session expiry -- must never clear the admin session.
    expect(isAuthError(failure)).toBe(false);
  });

  it("does not fire the timeout for a request that settles in time", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ adminUsers: [] }), { status: 200 }));

    const result = await listAdminUsers();
    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS + 1000);

    expect(result.adminUsers).toEqual([]);
  });

  it("keeps mapping genuine network failures to the connection AdminApiError, never a timeout", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const failure = await listAdminUsers().catch((error) => error);

    expect(failure).toBeInstanceOf(AdminApiError);
    expect(failure).not.toBeInstanceOf(AdminApiTimeoutError);
    expect(isTimeoutError(failure)).toBe(false);
    expect((failure as AdminApiError).message).toContain("서버에 연결하지 못했어요");
  });

  it("isTimeoutError ignores unrelated errors", () => {
    expect(isTimeoutError(new AdminApiError(0, "연결 실패"))).toBe(false);
    expect(isTimeoutError(new Error("AbortError"))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});

// FIX-118C: admin 쓰기에는 서버 멱등키가 없다. 10초 상한을 쓰기에도 적용하면
// "서버는 성공, 클라이언트는 시간 초과 표시 -> 운영자 재시도 -> 이중 반영"이
// 되므로, 쓰기는 60초로 완화하고 문구도 재시도를 권하지 않도록 분리한다.
describe("admin API write timeout separation (FIX-118C)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function hangingFetch(_url: string, init: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  }

  it("bounds writes at 60s and reads at 10s", () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(WRITE_FETCH_TIMEOUT_MS).toBe(60_000);
    expect(timeoutMsForMethod("GET")).toBe(DEFAULT_FETCH_TIMEOUT_MS);
    expect(timeoutMsForMethod("HEAD")).toBe(DEFAULT_FETCH_TIMEOUT_MS);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post", "patch"]) {
      expect(timeoutMsForMethod(method)).toBe(WRITE_FETCH_TIMEOUT_MS);
    }
  });

  it("does NOT abort a slow write at 10s — the bulk-apply that takes 12s still succeeds", async () => {
    vi.useFakeTimers();
    let settle!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          settle = resolve;
          init.signal?.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted.");
            abortError.name = "AbortError";
            reject(abortError);
          });
        })
    );

    const pending = bulkApplyProductLinks("productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x").catch(
      (error: unknown) => error
    );
    // 서버가 12초 걸려 성공하는 시나리오: 기존 10초 상한이었다면 여기서 이미
    // 끊겼고, 운영자 재시도 -> 500행 이중 반영으로 이어졌다.
    await vi.advanceTimersByTimeAsync(12_000);
    settle(new Response(JSON.stringify({ applied: 500, skipped: 0, errors: 0 }), { status: 200 }));

    await expect(pending).resolves.toEqual({ applied: 500, skipped: 0, errors: 0 });
  });

  it("aborts a hung write only at 60s, with a retry-unsafe timeout error that never tells the admin to retry", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);

    const pending = bulkApplyProductLinks("productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x").catch(
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(WRITE_FETCH_TIMEOUT_MS);
    const failure = await pending;

    expect(failure).toBeInstanceOf(AdminApiTimeoutError);
    expect((failure as AdminApiError).code).toBe("TIMEOUT");
    expect((failure as AdminApiTimeoutError).method).toBe("POST");
    expect((failure as AdminApiTimeoutError).retryUnsafe).toBe(true);
    expect(isRetryUnsafeTimeoutError(failure)).toBe(true);
    // 반영 여부 불명임을 알리고, 재시도를 권하는 문구는 쓰지 않는다.
    expect((failure as AdminApiError).message).toContain("반영 여부가 확실하지 않으니");
    expect((failure as AdminApiError).message).not.toContain("다시 시도해 주세요");
    expect(isAuthError(failure)).toBe(false);
  });

  it("keeps the read timeout error retry-safe and distinct from the write one", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);

    const pending = listAdminUsers().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS);
    const failure = await pending;

    expect(isTimeoutError(failure)).toBe(true);
    expect(isRetryUnsafeTimeoutError(failure)).toBe(false);
    expect((failure as AdminApiError).message).toContain("요청 시간이 초과됐어요(10초)");
  });

  it("isRetryUnsafeTimeoutError ignores non-timeout errors", () => {
    expect(isRetryUnsafeTimeoutError(new AdminApiError(0, "연결 실패"))).toBe(false);
    expect(isRetryUnsafeTimeoutError(new AdminApiError(500, "서버 오류"))).toBe(false);
    expect(isRetryUnsafeTimeoutError(new Error("AbortError"))).toBe(false);
    expect(isRetryUnsafeTimeoutError(null)).toBe(false);
  });
});

/**
 * GAP-077 트랙 B(#2) — **연결 실패도 R19-F 판정을 지난다.**
 *
 * 라운드 76까지 같은 함수 안에서 두 갈래가 갈려 있었다. 타임아웃은 `method`·`idempotent`로
 * 문장 **셋**을 고르는데(읽기 / 비멱등 쓰기 / 멱등 쓰기), 바로 아래 연결 실패 갈래는 그 두
 * 값이 **스코프에 이미 있는데도** 읽지 않고 한 문장을 던졌다 — GET·POST·PATCH·DELETE가
 * 전부 *"…다시 시도해 주세요."* 를 받았다.
 *
 * ⚠️ **왜 같은 판정이 필요한가.** `fetch`의 거절은 *"보내지 못했다"* 와 *"보냈는데 답을 못
 * 받았다"* 를 **구분하지 않는다**. 요청 본문이 나간 뒤 커넥션이 끊기면(리셋 · TLS 종료 ·
 * 중간 프록시) 서버는 이미 처리했을 수 있고, 클라이언트가 그 둘을 가를 방법은 없다 —
 * **그것이 정확히 `WRITE_TIMEOUT_MESSAGE`가 존재하는 이유다.** 같은 불확실성에 타임아웃은
 * 보수적으로, 연결 실패는 낙관적으로 말하고 있었다.
 *
 * 이 트랙이 만드는 것은 **문장 둘**뿐이다(새 판정 0건 · 새 클래스 0건 · 서버 0건).
 */
describe("어드민 연결 실패의 세 갈래 (GAP-077 트랙 B)", () => {
  const fetchMock = vi.fn();

  /** ⚠️ 오늘의 읽기 문장 — 바이트 불변이어야 한다(계약 ⓒ). */
  const READ_CONNECTION_FAILURE = "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.";

  const adminRoot = process.cwd();
  const readApiSource = (): string => readFileSync(join(adminRoot, "src", "lib", "admin-api.ts"), "utf8");

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** 진짜 네트워크 실패(연결이 서지 못했거나, 나간 뒤 끊겼거나 — 구분할 수 없다). */
  async function connectionFailure(call: () => Promise<unknown>): Promise<AdminApiError> {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const failure = await call().catch((error: unknown) => error);
    expect(failure, "연결 실패는 AdminApiError로 온다").toBeInstanceOf(AdminApiError);
    // 타임아웃 타입으로 승격되지 않는다 — 두 실패는 끝까지 구분된다.
    expect(failure).not.toBeInstanceOf(AdminApiTimeoutError);
    return failure as AdminApiError;
  }

  it("GET의 연결 실패는 오늘의 문장 그대로다 (계약 ⓒ · 바이트 불변)", async () => {
    for (const call of [
      () => listAdminUsers(),
      () => listProductLinks(),
      () => listAuditLogs(),
      () => getAdminDashboardSummary()
    ]) {
      const failure = await connectionFailure(call);
      expect(failure.message).toBe(READ_CONNECTION_FAILURE);
      expect(failure.status).toBe(0);
      // 연결 실패는 세션 만료가 아니다 — 로그아웃 갈래로 새지 않는다.
      expect(isAuthError(failure)).toBe(false);
      expect(isTimeoutError(failure)).toBe(false);
    }

    // ⚠️ 그 문장이 **throw 자리에 리터럴로** 남아 있어야 한다: 이웃 파일
    // `admin-load-error-copy.test.ts`의 `networkError()`가 그 꼴을 소스에서 정규식으로 읽어
    // 조회 한 벌의 네트워크 갈래를 재현한다. 상수로 올리면 그 그물이 조용히 찢어진다.
    // (라운드 77 리뷰 P-2가 그 뒤에 code 하나를 더했고, 그쪽 정규식도 함께 넓혔다.)
    expect(readApiSource()).toContain(
      `throw new AdminApiError(0, "${READ_CONNECTION_FAILURE}", CONNECTION_FAILURE_CODE)`
    );
  });

  /**
   * 라운드 77 적대적 리뷰 M-1 — **인증·검증 POST는 읽기 문장을 받는다.**
   *
   * 갈래를 HTTP 메서드로만 가르면, 반영을 확인할 **목록이 아예 없는** POST까지
   * *"반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요"* 를 받는다 —
   * 로그인 화면이 그 첫 자리다(운영자가 아직 목록을 본 적도 없다). 축은 메서드가 아니라
   * **"다시 보내도 이중 반영이 없는가"** 이고, 그것은 추론이 아니라 호출부의 **명시**다.
   */
  it("인증·검증 POST 여덟의 연결 실패는 읽기 문장 그대로다 (M-1 · retrySafe)", async () => {
    for (const [name, call] of [
      ["adminLogin", () => adminLogin("ops@example.com", "password-1")],
      ["adminVerifyMfaLogin", () => adminVerifyMfaLogin("mfa-token", "123456")],
      ["adminLogout", () => adminLogout()],
      ["adminChangePassword", () => adminChangePassword("old-password-1", "new-password-2")],
      ["adminMfaSetupStart", () => adminMfaSetupStart()],
      ["adminMfaSetupVerify", () => adminMfaSetupVerify("123456")],
      ["adminMfaDisable", () => adminMfaDisable("123456")],
      ["bulkPreviewProductLinks", () => bulkPreviewProductLinks("productLinkId,affiliateUrl\nid-1,https://x.test/a")]
    ] as const) {
      const failure = await connectionFailure(call);
      expect(failure.message, `${name}의 연결 실패 문장`).toBe(READ_CONNECTION_FAILURE);
      // ⚠️ 본체: 목록이 없는 자리에 목록을 새로고침하라고 말하지 않는다.
      expect(failure.message, name).not.toContain("목록을 새로고침해");
      expect(failure.message, name).not.toContain("반영 여부가 확실하지 않으니");
      expect(isAuthError(failure), name).toBe(false);
    }
  });

  it("인증·검증 POST 여덟의 타임아웃도 읽기와 같은 규율이다 — 다만 상한은 60초다 (M-1)", async () => {
    function hangingFetch(_url: string, init: RequestInit): Promise<Response> {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }

    for (const [name, call] of [
      ["adminLogin", () => adminLogin("ops@example.com", "password-1")],
      ["adminLogout", () => adminLogout()],
      ["adminChangePassword", () => adminChangePassword("old-password-1", "new-password-2")],
      ["adminMfaSetupStart", () => adminMfaSetupStart()],
      ["bulkPreviewProductLinks", () => bulkPreviewProductLinks("productLinkId,affiliateUrl\nid-1,https://x.test/a")]
    ] as const) {
      vi.useFakeTimers();
      fetchMock.mockReset();
      fetchMock.mockImplementationOnce(hangingFetch);
      const pending = call().catch((error: unknown) => error);
      // ⚠️ 상한은 종전 그대로 쓰기 60초다(bulk-preview 500행이 실제로 10초를 넘긴다).
      await vi.advanceTimersByTimeAsync(WRITE_FETCH_TIMEOUT_MS);
      const failure = (await pending) as AdminApiTimeoutError;
      vi.useRealTimers();

      expect(isTimeoutError(failure), `${name}은 타임아웃으로 끝난다`).toBe(true);
      // 읽기와 같은 규율: 재시도가 안전하고, 반영 여부를 말하지 않는다.
      expect(isRetryUnsafeTimeoutError(failure), name).toBe(false);
      expect(isIdempotentTimeoutError(failure), name).toBe(false);
      expect(failure.retryUnsafe, name).toBe(false);
      expect(failure.message, name).not.toContain("반영 여부가 확실하지 않으니");
      expect(failure.message, name).not.toContain("목록을 새로고침해");
      // ⚠️ 그러나 "(10초)"를 그대로 쓰면 거짓이다 — 이 여덟도 60초에서 끊긴다.
      expect(failure.message, name).toBe("요청 시간이 초과됐어요(60초). 네트워크 상태를 확인하고 다시 시도해 주세요.");
      expect(failure.message.endsWith("다시 시도해 주세요."), name).toBe(true);
    }
  });

  it("멱등키 없는 쓰기의 연결 실패는 재시도를 권하며 끝나지 않는다 (계약 ⓑ · 부정 단언)", async () => {
    for (const call of [
      // PATCH — 오늘 멱등키가 없는 열여덟 중 하나(실패 시나리오의 그 자리다).
      () => updateItemTemplate("item-1", { timingLabel: "6-12개월" }),
      // PUT
      () => updateDisclosure("product_links", "제휴 고지 문구"),
      // POST(키 없이 부른다)
      () => createItemTemplate({ name: "아기 식판" }),
      () => bulkApplyProductLinks("productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x")
    ]) {
      const failure = await connectionFailure(call);
      expect(failure.message).not.toBe(READ_CONNECTION_FAILURE);
      // 반영 여부를 단정하지 않고, 재시도보다 새로고침 확인을 **먼저** 권한다.
      expect(failure.message).toContain("반영 여부가 확실하지 않으니");
      expect(failure.message).toContain("목록을 새로고침해 확인한 뒤");
      // ⚠️ 이 트랙의 본체: 꼬리가 재시도 권유가 아니다.
      expect(failure.message.endsWith("다시 시도해 주세요.")).toBe(false);
      expect(failure.message.endsWith("다시 시도하세요.")).toBe(true);
      // 타임아웃 상수를 재활용하지 않은 이유 — 연결 실패에 "(60초)"는 거짓이다.
      expect(failure.message).not.toContain("(60초)");
      expect(failure.message).not.toContain("(10초)");
    }
  });

  it("멱등키를 실어 보낸 쓰기의 연결 실패는 중복 없이 처리된다고 말한다 (계약 ⓓ)", async () => {
    for (const call of [
      () => createItemTemplate({ name: "아기 식판" }, "idem-key-1"),
      () => createProductLink({ title: "쿠팡" }, "idem-key-2"),
      () => bulkApplyProductLinks("productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x", "idem-key-3"),
      () => createAdminUser({ email: "new-admin@example.com", role: "editor" }, "idem-key-4")
    ]) {
      const failure = await connectionFailure(call);
      expect(failure.message).toContain("같은 요청을 다시 보내면 중복 없이 처리되니");
      // 서버가 중복을 걸러 주므로 여기서는 재시도를 권해도 된다(읽기와 같은 규율).
      expect(failure.message.endsWith("다시 시도해 주세요.")).toBe(true);
      expect(failure.message).not.toContain("반영 여부가 확실하지 않으니");
      expect(failure.message).not.toContain("(60초)");
    }
  });

  it("두 번째 축은 멱등키 하나다 — 같은 함수·같은 메서드가 키 유무로 갈린다 (계약 ⓐ)", async () => {
    const withKey = await connectionFailure(() => createItemTemplate({ name: "아기 식판" }, "idem-key-1"));
    const withoutKey = await connectionFailure(() => createItemTemplate({ name: "아기 식판" }));

    expect(withKey.message).not.toBe(withoutKey.message);
    expect(withKey.message).toContain("중복 없이 처리되니");
    expect(withoutKey.message).toContain("반영 여부가 확실하지 않으니");
    // 메서드는 둘 다 POST다 — 갈린 값은 `Boolean(idempotencyKey)` 하나뿐이다.
    const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method);
    expect(methods).toEqual(["POST", "POST"]);
  });

  /**
   * 계약 ⓐ **파생 단언** — 연결 실패가 **타임아웃과 같은 셋**으로 갈린다. 판정을 새로 만들지
   * 않았다는 사실을 문장이 아니라 **분할(partition)** 로 못박는다: 같은 호출에 대해 두 실패의
   * 갈래 이름이 언제나 같아야 한다.
   */
  it("연결 실패의 분할이 타임아웃의 분할과 같다 (판정 신설 0건)", async () => {
    type Branch = "read" | "write" | "idempotent-write";
    const cases: { name: string; branch: Branch; call: () => Promise<unknown> }[] = [
      { name: "GET /admin/users", branch: "read", call: () => listAdminUsers() },
      { name: "PATCH /admin/item-templates/:id", branch: "write", call: () => updateItemTemplate("item-1", {}) },
      { name: "PUT /admin/disclosures/:key", branch: "write", call: () => updateDisclosure("product_links", "문구") },
      {
        name: "POST /admin/item-templates (멱등키)",
        branch: "idempotent-write",
        call: () => createItemTemplate({ name: "아기 식판" }, "idem-key-1")
      }
    ];

    function hangingFetch(_url: string, init: RequestInit): Promise<Response> {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }

    for (const { name, branch, call } of cases) {
      // ⓐ 연결 실패의 갈래 — 문장에서 읽는다.
      const connection = await connectionFailure(call);
      const connectionBranch: Branch =
        connection.message === READ_CONNECTION_FAILURE
          ? "read"
          : connection.message.includes("중복 없이 처리되니")
            ? "idempotent-write"
            : "write";
      expect(connectionBranch, `${name}의 연결 실패 갈래`).toBe(branch);

      // ⓑ 타임아웃의 갈래 — R19-F가 이미 세운 판정 함수에서 읽는다.
      vi.useFakeTimers();
      fetchMock.mockReset();
      fetchMock.mockImplementationOnce(hangingFetch);
      const pending = call().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(WRITE_FETCH_TIMEOUT_MS);
      const timeout = await pending;
      vi.useRealTimers();

      expect(isTimeoutError(timeout), `${name}은 타임아웃으로 끝나야 한다`).toBe(true);
      const timeoutBranch: Branch = isIdempotentTimeoutError(timeout)
        ? "idempotent-write"
        : isRetryUnsafeTimeoutError(timeout)
          ? "write"
          : "read";
      expect(timeoutBranch, `${name}의 타임아웃 갈래`).toBe(branch);
    }
  });

  /**
   * 계약 ⓓ의 수치 — **왜 비멱등 쓰기에 재시도를 권하면 안 되는가**를 값으로 남긴다.
   *
   * 2026-08-30 실측: `request()`를 부르는 쓰기 메서드 호출은 **스물넷**이다. 라운드 77까지
   * 그 스물넷이 "멱등 여섯 / 나머지 열여덟"으로만 갈렸고, 그 분류가 리뷰 M-1이 잡은 결함의
   * 뿌리였다 — 열여덟 안에 **반영을 확인할 목록이 아예 없는 POST 여덟**이 섞여 있었다.
   * 오늘의 분류는 셋이다: **retrySafe 여덟** · **멱등 여섯** · **멱등키 없는 진짜 쓰기 열**.
   * *"멱등키 없는 쓰기"* 라는 말이 가리키는 자리는 열여덟이 아니라 **열**이다.
   */
  it("쓰기 스물넷이 셋으로 갈린다 — retrySafe 여덟 · 멱등 여섯 · 비멱등 쓰기 열 (수치를 값으로)", () => {
    const source = readApiSource();
    const writeCalls = [...source.matchAll(/method: "(?:POST|PUT|PATCH|DELETE)"/g)];
    // 멱등키를 받아 `request()`에 넘기는 공개 함수 전수.
    const idempotentCallers = [...source.matchAll(/^export function \w+\([^)]*idempotencyKey\?: string\)/gm)].map(
      (match) => match[0]
    );
    // 라운드 77 리뷰 M-1: 호출부가 **명시**한 자리 전수(추론하지 않는다).
    const retrySafeCalls = [...source.matchAll(/\{ retrySafe: true \}/g)];

    expect(writeCalls.length, "쓰기 호출 수").toBe(24);
    expect(retrySafeCalls.length, "retrySafe를 명시한 쓰기 수").toBe(8);
    expect(idempotentCallers.length, "멱등키를 싣는 쓰기 수").toBe(6);
    expect(
      writeCalls.length - retrySafeCalls.length - idempotentCallers.length,
      "멱등키 없는 진짜 쓰기 수"
    ).toBe(10);
    for (const name of [
      "createItemTemplate",
      "createProductLink",
      "bulkApplyProductLinks",
      "approvePublishContentRevision",
      "rollbackContentRevision",
      "createAdminUser"
    ]) {
      expect(idempotentCallers.join("\n"), `멱등 쓰기 여섯: ${name}`).toContain(`export function ${name}(`);
    }
    // retrySafe 여덟의 이름도 값으로 남긴다 — `/admin/auth/**` 일곱 + 검증 전용 미리보기 하나.
    for (const path of [
      "/admin/auth/login",
      "/admin/auth/mfa/verify-login",
      "/admin/auth/logout",
      "/admin/auth/change-password",
      "/admin/auth/mfa/setup/start",
      "/admin/auth/mfa/setup/verify",
      "/admin/auth/mfa/disable",
      "/admin/product-links/bulk-preview"
    ]) {
      const at = source.indexOf(`"${path}"`);
      expect(at, `retrySafe 여덟: ${path}`).toBeGreaterThan(-1);
      expect(source.slice(at, at + 400), `${path}가 retrySafe를 명시한다`).toContain("{ retrySafe: true }");
    }
    // ⚠️ 부정 단언: 반영을 확인할 목록이 있는 진짜 쓰기는 한 자리도 retrySafe가 아니다.
    for (const name of [
      "updateItemTemplate",
      "updateProductLink",
      "updateDisclosure",
      "bulkApplyProductLinks",
      "updateAdminUser",
      "updateAdminCategory"
    ]) {
      const at = source.indexOf(`export function ${name}(`);
      expect(at, `진짜 쓰기: ${name}`).toBeGreaterThan(-1);
      const body = source.slice(at, source.indexOf("\n}", at));
      expect(body, `${name}에 retrySafe가 붙었다`).not.toContain("retrySafe");
    }
  });

  it("타임아웃 갈래 셋과 상한 두 값은 한 글자도 바뀌지 않았다 (무변경)", () => {
    const source = readApiSource();
    for (const message of [
      "요청 시간이 초과됐어요(10초). 네트워크 상태를 확인하고 다시 시도해 주세요.",
      "요청이 오래 걸리고 있어요(60초). 반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.",
      "요청이 오래 걸리고 있어요(60초). 같은 요청을 다시 보내면 중복 없이 처리돼요 — 다시 시도해 주세요."
    ]) {
      expect(source, `타임아웃 문장: ${message}`).toContain(message);
    }
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(WRITE_FETCH_TIMEOUT_MS).toBe(60_000);
    expect(timeoutMsForMethod("GET")).toBe(DEFAULT_FETCH_TIMEOUT_MS);
    expect(timeoutMsForMethod("PATCH")).toBe(WRITE_FETCH_TIMEOUT_MS);
  });

  it("연결 실패의 타입·상태는 종전 그대로고, code 하나가 판정을 진다 (소비 쪽 무변경 · 새 클래스 0건)", async () => {
    const read = await connectionFailure(() => listAdminUsers());
    const write = await connectionFailure(() => updateItemTemplate("item-1", {}));

    for (const failure of [read, write]) {
      // 종전처럼 `AdminApiError(0, …)`이다 — writeErrorMessage/loadErrorCopy가 한 글자도
      // 바뀌지 않고 이 문장을 나른다(라운드 76 B·라운드 73~75 D의 파일 무접촉).
      expect(failure).toBeInstanceOf(AdminApiError);
      expect(failure.constructor.name).toBe("AdminApiError");
      expect(failure.status).toBe(0);
      // 라운드 77 리뷰 P-2: 술어의 재료가 status가 아니라 이 code다.
      expect(failure.code).toBe(CONNECTION_FAILURE_CODE);
      expect(isConnectionFailureError(failure)).toBe(true);
      expect(isTimeoutError(failure)).toBe(false);
      expect(isRetryUnsafeTimeoutError(failure)).toBe(false);
      expect(isIdempotentTimeoutError(failure)).toBe(false);
      expect(isAuthError(failure)).toBe(false);
    }
  });

  /**
   * 라운드 77 리뷰 P-2 — **status 0을 만드는 자리가 셋째로 늘어도 오분류가 없다.**
   *
   * status 0은 "응답이 아예 없었다"는 뜻일 뿐이고, 오늘 그 값을 만드는 자리는 둘이다
   * (연결 실패 · 타임아웃). 술어가 status를 읽으면 셋째 자리가 생기는 날 그것을 연결
   * 실패로 읽고 **아무 단언도 깨지 않는다**. 그래서 판정 재료를 code로 옮겼다.
   */
  it("isConnectionFailureError는 code로 갈린다 — 새 status 0 생성처를 삼키지 않는다 (P-2)", () => {
    expect(isConnectionFailureError(new AdminApiError(0, "연결 실패", CONNECTION_FAILURE_CODE))).toBe(true);
    // 타임아웃은 같은 status 0이지만 code가 "TIMEOUT"이다.
    expect(isConnectionFailureError(new AdminApiTimeoutError(new Error("aborted"), "GET"))).toBe(false);
    // ⚠️ 셋째 자리의 대역 — status만 보던 술어는 이것을 연결 실패라고 답했다.
    expect(isConnectionFailureError(new AdminApiError(0, "응답 본문을 읽지 못했어요.", "RESPONSE_UNREADABLE"))).toBe(
      false
    );
    expect(isConnectionFailureError(new AdminApiError(0, "code가 아예 없는 status 0"))).toBe(false);
    expect(isConnectionFailureError(new AdminApiError(500, "서버 오류"))).toBe(false);
    expect(isConnectionFailureError(new Error("network"))).toBe(false);
    expect(isConnectionFailureError(null)).toBe(false);
  });
});
