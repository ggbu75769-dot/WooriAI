import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_SESSION_TOKEN,
  ApiTimeoutError,
  ExpenseHttpError,
  createExcelImport,
  createExpenseWithIdempotency,
  getBudget,
  getHome,
  getInvite,
  listCategories,
  listExpenses,
  updateExpenseWithVersion
} from "./client";
import { LOCAL_CHILD_ID } from "./local-fixtures";
import { useSessionStore } from "../stores/session.store";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function authorizationHeader(init: RequestInit | undefined): string | null {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization ?? null;
}

const HOME_BODY = {
  child: { id: "child-1", nickname: "다온이", currentStage: "toddler", stageLabel: "유아" },
  totalExpenseKrw: 0,
  monthly: { childId: "child-1", yearMonth: "2026-07", amountKrw: 0, usedAmountKrw: 0, remainingAmountKrw: 0 },
  recommendedItems: [],
  recentExpenses: []
};

const BUDGET_BODY = {
  childId: "child-1",
  yearMonth: "2026-07",
  amountKrw: 500000,
  usedAmountKrw: 0,
  remainingAmountKrw: 500000
};

/**
 * COV-T3: extends src/api/client-refresh-flow.test.ts (which covers the basic 401→refresh→retry
 * happy path, 2-way single-flight, setTokens-inside-the-shared-promise, refresh-401 for a single
 * caller, original-request network error, and the local-token getHome path). This file covers the
 * rest of the matrix: 4-way single-flight with per-retry token assertions, refresh failure modes
 * (network reject / non-401 HTTP) and their session side effects, the one-retry-max guarantee,
 * non-401 HTTP bypass, the 10s abort/timeout bound, token-less requests, the requestExpenseJson
 * and requestMultipartJson refresh paths, and local-token routing for the expense/category calls.
 */
describe("client.ts 401→refresh retry matrix (COV-T3)", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
    useSessionStore.setState({
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      userId: "user-1",
      defaultHouseholdId: "household-1",
      isTestSession: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  describe("single-flight across 4 concurrent 401s", () => {
    it("fires exactly one refresh for 4 parallel 401ing requests and retries every one with the new token", async () => {
      let refreshCallCount = 0;
      const retriedAuthByUrl = new Map<string, string | null>();

      const respond = (url: string, init: RequestInit | undefined, body: unknown): Response => {
        if (authorizationHeader(init) === "Bearer old-access-token") {
          return jsonResponse(401, { message: "unauthorized" });
        }
        retriedAuthByUrl.set(url, authorizationHeader(init));
        return jsonResponse(200, body);
      };

      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          refreshCallCount += 1;
          expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "old-refresh-token" });
          // Hold the refresh response for one macrotask so all four 401 continuations
          // demonstrably run while the refresh is still in flight (the shared-promise branch).
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
        }
        if (url === `${API_BASE_URL}/home?childId=child-1`) return respond(url, init, HOME_BODY);
        if (url === `${API_BASE_URL}/children/child-1/budget?yearMonth=2026-07`) return respond(url, init, BUDGET_BODY);
        if (url === `${API_BASE_URL}/children/child-1/expenses?yearMonth=2026-07`) {
          return respond(url, init, { expenses: [], totalAmountKrw: 0 });
        }
        if (url === `${API_BASE_URL}/categories`) return respond(url, init, { categories: [] });
        throw new Error(`Unexpected fetch call: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const [home, budget, expenses, categories] = await Promise.all([
        getHome("old-access-token", "child-1"),
        getBudget("old-access-token", "child-1", "2026-07"),
        listExpenses("old-access-token", "child-1", "2026-07"),
        listCategories("old-access-token")
      ]);

      expect(home.child.id).toBe("child-1");
      expect(budget?.amountKrw).toBe(500000);
      expect(expenses.totalAmountKrw).toBe(0);
      expect(categories.categories).toEqual([]);

      expect(refreshCallCount).toBe(1);
      // 4 originals + 1 refresh + 4 retries.
      expect(fetchMock).toHaveBeenCalledTimes(9);
      // Every one of the 4 callers retried, each carrying the rotated access token.
      expect([...retriedAuthByUrl.values()]).toEqual([
        "Bearer new-access-token",
        "Bearer new-access-token",
        "Bearer new-access-token",
        "Bearer new-access-token"
      ]);
      expect(retriedAuthByUrl.size).toBe(4);
      expect(useSessionStore.getState().accessToken).toBe("new-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("new-refresh-token");
    });
  });

  describe("refresh failure modes", () => {
    it("propagates the ORIGINAL 401 body to every concurrent caller when the refresh is rejected with 401, clears the session, and never retries", async () => {
      let refreshCallCount = 0;
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          refreshCallCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(401, { message: "refresh token revoked (family reuse)" });
        }
        // Any authorized endpoint only ever sees the old token -- a retry would be a bug here.
        expect(authorizationHeader(init)).toBe("Bearer old-access-token");
        return jsonResponse(401, { message: "unauthorized" });
      });
      vi.stubGlobal("fetch", fetchMock);

      const results = await Promise.allSettled([
        getHome("old-access-token", "child-1"),
        listCategories("old-access-token")
      ]);

      // Documented behavior: the surfaced error is the ORIGINAL request's 401 body (the refresh
      // failure itself is swallowed), thrown as a plain Error(JSON.stringify(body)).
      for (const result of results) {
        expect(result.status).toBe("rejected");
        const error = (result as PromiseRejectedResult).reason as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(JSON.stringify({ message: "unauthorized" }));
      }

      expect(refreshCallCount).toBe(1);
      // 2 originals + 1 shared refresh, and no retried requests.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // Session logout: every token/identity field cleared.
      const session = useSessionStore.getState();
      expect(session.accessToken).toBeNull();
      expect(session.refreshToken).toBeNull();
      expect(session.userId).toBeNull();
      expect(session.defaultHouseholdId).toBeNull();
    });

    it("keeps the session intact when the refresh call network-fails, and still surfaces the original 401 body", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          throw new TypeError("Network request failed");
        }
        return jsonResponse(401, { message: "unauthorized" });
      });
      vi.stubGlobal("fetch", fetchMock);

      // Documented behavior: the refresh's network error is swallowed; the caller sees the
      // original 401 body, and the session is NOT cleared (only a refresh HTTP 401 clears it),
      // so a later request can attempt the refresh again once the network is back.
      await expect(getHome("old-access-token", "child-1")).rejects.toThrow(
        JSON.stringify({ message: "unauthorized" })
      );

      expect(fetchMock).toHaveBeenCalledTimes(2); // original + failed refresh, no retry
      expect(useSessionStore.getState().accessToken).toBe("old-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("old-refresh-token");
    });

    it("keeps the session intact when the refresh endpoint fails with a non-401 HTTP status (500)", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          return jsonResponse(500, { message: "refresh backend down" });
        }
        return jsonResponse(401, { message: "unauthorized" });
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getHome("old-access-token", "child-1")).rejects.toThrow(
        JSON.stringify({ message: "unauthorized" })
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // A 5xx from /auth/refresh is transient -- the refresh token may still be valid, so the
      // session survives (only RefreshHttpError with status === 401 triggers clearSession).
      expect(useSessionStore.getState().accessToken).toBe("old-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("old-refresh-token");
    });
  });

  describe("one retry max", () => {
    it("does not loop when the retried request 401s again after a successful refresh", async () => {
      let refreshCallCount = 0;
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          refreshCallCount += 1;
          return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
        }
        // 401 for BOTH the original and the retried request.
        return jsonResponse(401, { message: "still unauthorized" });
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getHome("old-access-token", "child-1")).rejects.toThrow(
        JSON.stringify({ message: "still unauthorized" })
      );

      // original + refresh + exactly one retry -- never a second refresh or retry.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(refreshCallCount).toBe(1);
      // The refresh itself succeeded, so the rotated tokens are persisted even though the
      // retried request was rejected.
      expect(useSessionStore.getState().accessToken).toBe("new-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("new-refresh-token");
    });
  });

  describe("non-401 responses bypass the refresh flow", () => {
    it.each([[500], [403]])("a %i response is thrown as-is without any refresh attempt", async (status) => {
      const fetchMock = vi.fn(async () => jsonResponse(status, { message: `error-${status}` }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getHome("old-access-token", "child-1")).rejects.toThrow(
        JSON.stringify({ message: `error-${status}` })
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, expect.anything());
      expect(useSessionStore.getState().accessToken).toBe("old-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("old-refresh-token");
    });
  });

  describe("10s timeout bound", () => {
    it("aborts a hung request at exactly DEFAULT_FETCH_TIMEOUT_MS, surfaces a typed ApiTimeoutError carrying the abort as cause, and never attempts a refresh", async () => {
      vi.useFakeTimers();
      const abortError = new DOMException("The operation was aborted.", "AbortError");
      const fetchMock = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(abortError));
          })
      );
      vi.stubGlobal("fetch", fetchMock);

      const pending = getHome("old-access-token", "child-1");
      let settled = false;
      pending.catch(() => {
        settled = true;
      });

      // One tick before the bound the request is still pending...
      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);

      // ...and at 10_000ms the AbortController fires.
      await vi.advanceTimersByTimeAsync(1);
      // FIX-MOB-DX: the abort produced by client.ts's OWN timeout is translated into the typed
      // ApiTimeoutError (name + Korean message stable for callers to branch on -- no string
      // sniffing of platform-dependent AbortError shapes), with the original abort rejection
      // preserved on `cause` for logging.
      await expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
      await pending.catch((error: ApiTimeoutError) => {
        expect(error.name).toBe("ApiTimeoutError");
        expect(error.message).toBe("요청 시간이 초과되었어요(10초)");
        expect(error.cause).toBe(abortError);
      });
      expect(settled).toBe(true);

      // A timeout is a rejected fetch, not a resolved 401: no refresh, session untouched.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useSessionStore.getState().accessToken).toBe("old-access-token");
      expect(useSessionStore.getState().refreshToken).toBe("old-refresh-token");
    });

    it("does NOT wrap a genuine network rejection (fetch TypeError before the bound) -- only the timeout abort becomes ApiTimeoutError", async () => {
      const networkError = new TypeError("Network request failed");
      const fetchMock = vi.fn(async () => {
        throw networkError;
      });
      vi.stubGlobal("fetch", fetchMock);

      // Identity intact: connection/DNS/offline failures keep their original error object so
      // existing callers branching on TypeError/message stay unaffected.
      await expect(getHome("old-access-token", "child-1")).rejects.toBe(networkError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useSessionStore.getState().accessToken).toBe("old-access-token");
    });
  });

  describe("requests that can never trigger a refresh", () => {
    it("does not attempt a refresh for a token-less (unauthenticated) request that 401s", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        expect(url).toBe(`${API_BASE_URL}/invites/some-remote-invite-token`);
        return jsonResponse(401, { message: "invite expired" });
      });
      vi.stubGlobal("fetch", fetchMock);

      // getInvite sends no Authorization header, so even with a live session in the store a 401
      // must be surfaced directly instead of burning the (single-use) refresh token.
      await expect(getInvite("some-remote-invite-token")).rejects.toThrow(
        JSON.stringify({ message: "invite expired" })
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useSessionStore.getState().refreshToken).toBe("old-refresh-token");
    });

    it("routes local-session category and expense calls to the local backend without any fetch or refresh", async () => {
      const fetchMock = vi.fn(async () => jsonResponse(401, { message: "unauthorized" }));
      vi.stubGlobal("fetch", fetchMock);

      const categories = await listCategories(LOCAL_SESSION_TOKEN);
      expect(categories.categories.length).toBeGreaterThan(0);

      const expense = await createExpenseWithIdempotency(
        LOCAL_SESSION_TOKEN,
        LOCAL_CHILD_ID,
        {
          categoryId: categories.categories[0].id,
          amountKrw: 12000,
          spentOn: "2026-01-15",
          itemName: "물티슈"
        },
        "cov-t3-local-idem-key"
      );
      expect(expense.amountKrw).toBe(12000);
      expect(expense.version).toBe(1);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    // CAT-124: 노출 범위 스위치. 앱은 이름 해석 때문에 전량이 필요해 includeAll=true로 부른다.
    it("maps listCategories' includeAll option onto the server's ?includeAll=1 query", async () => {
      const seen: string[] = [];
      const fetchMock = vi.fn(async (url: string) => {
        seen.push(url);
        return jsonResponse(200, { categories: [] });
      });
      vi.stubGlobal("fetch", fetchMock);

      await listCategories("live-access-token", { includeAll: true });
      await listCategories("live-access-token");
      await listCategories("live-access-token", { includeAll: false });

      expect(seen).toEqual([
        `${API_BASE_URL}/categories?includeAll=1`,
        `${API_BASE_URL}/categories`,
        `${API_BASE_URL}/categories`
      ]);
    });

    it("keeps the local demo session off the network for the includeAll variant too", async () => {
      const fetchMock = vi.fn(async () => jsonResponse(401, { message: "unauthorized" }));
      vi.stubGlobal("fetch", fetchMock);

      const { categories } = await listCategories(LOCAL_SESSION_TOKEN, { includeAll: true });
      expect(categories.length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("requestExpenseJson (typed expense endpoints) shares the same refresh flow", () => {
    it("refreshes on a 401 and retries the expense mutation once with the new token", async () => {
      let refreshCallCount = 0;
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          refreshCallCount += 1;
          return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
        }
        if (url === `${API_BASE_URL}/expenses/expense-1`) {
          if (authorizationHeader(init) === "Bearer old-access-token") {
            return jsonResponse(401, { message: "unauthorized" });
          }
          expect(authorizationHeader(init)).toBe("Bearer new-access-token");
          // The retried request re-sends the same versioned body and Idempotency-Key.
          expect(JSON.parse(String(init?.body))).toEqual({ amountKrw: 9000, expectedVersion: 3 });
          const headers = init?.headers as Record<string, string>;
          expect(headers["Idempotency-Key"]).toBe("cov-t3-idem-key");
          return jsonResponse(200, {
            id: "expense-1",
            childId: "child-1",
            categoryId: "cat-1",
            amountKrw: 9000,
            spentOn: "2026-07-01",
            itemName: "기저귀",
            expenseType: "expense",
            source: "manual",
            version: 4
          });
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const updated = await updateExpenseWithVersion(
        "old-access-token",
        "expense-1",
        { amountKrw: 9000 },
        3,
        "cov-t3-idem-key"
      );

      expect(updated.version).toBe(4);
      expect(refreshCallCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(useSessionStore.getState().accessToken).toBe("new-access-token");
    });

    it("surfaces a typed ExpenseHttpError(401) with the original body and clears the session when the refresh is rejected with 401", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          return jsonResponse(401, { message: "refresh token revoked" });
        }
        return jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "unauthorized" } });
      });
      vi.stubGlobal("fetch", fetchMock);

      // Documented behavior: unlike requestJson's plain Error, this path throws the typed
      // ExpenseHttpError carrying the ORIGINAL request's status/body (the offline sync engine
      // branches on it), and the 401-refresh-401 combination still logs the session out.
      const failure = updateExpenseWithVersion("old-access-token", "expense-1", { amountKrw: 1 }, 3, "cov-t3-key-2");
      await expect(failure).rejects.toBeInstanceOf(ExpenseHttpError);
      await failure.catch((error: ExpenseHttpError) => {
        expect(error.status).toBe(401);
        expect(error.body).toEqual({ error: { code: "UNAUTHORIZED", message: "unauthorized" } });
      });

      expect(fetchMock).toHaveBeenCalledTimes(2); // original + refresh, no retry
      expect(useSessionStore.getState().accessToken).toBeNull();
      expect(useSessionStore.getState().refreshToken).toBeNull();
    });
  });

  describe("requestMultipartJson (excel import upload) shares the same refresh flow", () => {
    it("refreshes on a 401 and retries the multipart upload once with the new token", async () => {
      let refreshCallCount = 0;
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          refreshCallCount += 1;
          return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
        }
        if (url === `${API_BASE_URL}/children/child-1/imports/excel`) {
          if (authorizationHeader(init) === "Bearer old-access-token") {
            return jsonResponse(401, { message: "unauthorized" });
          }
          expect(authorizationHeader(init)).toBe("Bearer new-access-token");
          return jsonResponse(200, {
            id: "import-1",
            status: "uploaded",
            rowCount: 0,
            candidateCount: 0,
            importedCount: 0
          });
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const job = await createExcelImport("old-access-token", "child-1", {
        uri: "file:///tmp/upload.xlsx",
        name: "upload.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      expect(job.id).toBe("import-1");
      expect(refreshCallCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(useSessionStore.getState().accessToken).toBe("new-access-token");
    });

    it("clears the session and surfaces the original 401 body when the refresh is rejected with 401 during a multipart upload", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${API_BASE_URL}/auth/refresh`) {
          return jsonResponse(401, { message: "refresh token revoked" });
        }
        return jsonResponse(401, { message: "unauthorized" });
      });
      vi.stubGlobal("fetch", fetchMock);

      // Same behavior as requestJson: the original 401 body is thrown as a plain Error and the
      // refresh-401 logs the session out. (No retry: original upload + refresh only.)
      await expect(
        createExcelImport("old-access-token", "child-1", {
          uri: "file:///tmp/upload.xlsx",
          name: "upload.xlsx",
          mimeType: null
        })
      ).rejects.toThrow(JSON.stringify({ message: "unauthorized" }));

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(useSessionStore.getState().accessToken).toBeNull();
      expect(useSessionStore.getState().refreshToken).toBeNull();
    });
  });
});
