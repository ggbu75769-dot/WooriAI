import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBudget, getHome } from "./client";
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

describe("client.ts 401 handling and single-flight refresh", () => {
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
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  it("refreshes once on a 401, retries the original request, and stores the new token pair", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API_BASE_URL}/home?childId=child-1`) {
        if (authorizationHeader(init) === "Bearer old-access-token") {
          return jsonResponse(401, { message: "unauthorized" });
        }
        if (authorizationHeader(init) === "Bearer new-access-token") {
          return jsonResponse(200, {
            child: { id: "child-1", nickname: "다온이", currentStage: "toddler", stageLabel: "유아" },
            totalExpenseKrw: 0,
            monthly: { childId: "child-1", yearMonth: "2026-07", amountKrw: 0, usedAmountKrw: 0, remainingAmountKrw: 0 },
            recommendedItems: [],
            recentExpenses: []
          });
        }
      }
      if (url === `${API_BASE_URL}/auth/refresh`) {
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "old-refresh-token" });
        return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const home = await getHome("old-access-token", "child-1");

    expect(home.child.id).toBe("child-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useSessionStore.getState().accessToken).toBe("new-access-token");
    expect(useSessionStore.getState().refreshToken).toBe("new-refresh-token");
  });

  it("shares a single in-flight refresh across concurrent 401s (refresh tokens are single-use)", async () => {
    let refreshCallCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API_BASE_URL}/home?childId=child-1`) {
        return authorizationHeader(init) === "Bearer old-access-token"
          ? jsonResponse(401, { message: "unauthorized" })
          : jsonResponse(200, {
              child: { id: "child-1", nickname: "다온이", currentStage: "toddler", stageLabel: "유아" },
              totalExpenseKrw: 0,
              monthly: { childId: "child-1", yearMonth: "2026-07", amountKrw: 0, usedAmountKrw: 0, remainingAmountKrw: 0 },
              recommendedItems: [],
              recentExpenses: []
            });
      }
      if (url.startsWith(`${API_BASE_URL}/children/child-1/budget`)) {
        return authorizationHeader(init) === "Bearer old-access-token"
          ? jsonResponse(401, { message: "unauthorized" })
          : jsonResponse(200, {
              childId: "child-1",
              yearMonth: "2026-07",
              amountKrw: 500000,
              usedAmountKrw: 0,
              remainingAmountKrw: 500000
            });
      }
      if (url === `${API_BASE_URL}/auth/refresh`) {
        refreshCallCount += 1;
        return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const [home, budget] = await Promise.all([
      getHome("old-access-token", "child-1"),
      getBudget("old-access-token", "child-1", "2026-07")
    ]);

    expect(home.child.id).toBe("child-1");
    expect(budget?.amountKrw).toBe(500000);
    expect(refreshCallCount).toBe(1);
    expect(useSessionStore.getState().accessToken).toBe("new-access-token");
  });

  it("updates the session store's tokens exactly once from inside the shared single-flight refresh, so neither concurrent caller's retry can observe the stale refreshToken", async () => {
    const setTokensSpy = vi.spyOn(useSessionStore.getState(), "setTokens");
    const refreshTokenSeenAtRetry: Array<string | null> = [];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API_BASE_URL}/home?childId=child-1`) {
        if (authorizationHeader(init) === "Bearer old-access-token") {
          return jsonResponse(401, { message: "unauthorized" });
        }
        // The retried request only fires after performSingleFlightRefresh's
        // promise resolves for this caller -- if the store update happened
        // *outside* the shared promise chain (the pre-fix behavior), a caller
        // could in principle observe the store before its own setTokens call ran.
        refreshTokenSeenAtRetry.push(useSessionStore.getState().refreshToken);
        return jsonResponse(200, {
          child: { id: "child-1", nickname: "다온이", currentStage: "toddler", stageLabel: "유아" },
          totalExpenseKrw: 0,
          monthly: { childId: "child-1", yearMonth: "2026-07", amountKrw: 0, usedAmountKrw: 0, remainingAmountKrw: 0 },
          recommendedItems: [],
          recentExpenses: []
        });
      }
      if (url.startsWith(`${API_BASE_URL}/children/child-1/budget`)) {
        if (authorizationHeader(init) === "Bearer old-access-token") {
          return jsonResponse(401, { message: "unauthorized" });
        }
        refreshTokenSeenAtRetry.push(useSessionStore.getState().refreshToken);
        return jsonResponse(200, {
          childId: "child-1",
          yearMonth: "2026-07",
          amountKrw: 500000,
          usedAmountKrw: 0,
          remainingAmountKrw: 500000
        });
      }
      if (url === `${API_BASE_URL}/auth/refresh`) {
        return jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([getHome("old-access-token", "child-1"), getBudget("old-access-token", "child-1", "2026-07")]);

    // The store was updated exactly once, from inside the shared single-flight
    // promise chain -- not once per concurrent caller (the pre-fix code called
    // setTokens separately after each caller's own await, which for two
    // concurrent callers meant two redundant calls with identical values, and
    // left a window where a *new*, later refresh cycle starting right as the
    // shared promise settled could still read a stale refreshToken from the store).
    expect(setTokensSpy).toHaveBeenCalledTimes(1);
    expect(setTokensSpy).toHaveBeenCalledWith("new-access-token", "new-refresh-token");

    // By the time each concurrent caller's retried request actually fires, the
    // store's refreshToken is already the rotated one for both of them.
    expect(refreshTokenSeenAtRetry).toEqual(["new-refresh-token", "new-refresh-token"]);
  });

  it("clears the session and propagates the original error when the refresh token itself is rejected with 401", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${API_BASE_URL}/home?childId=child-1`) {
        return jsonResponse(401, { message: "unauthorized" });
      }
      if (url === `${API_BASE_URL}/auth/refresh`) {
        return jsonResponse(401, { message: "refresh token expired" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHome("old-access-token", "child-1")).rejects.toThrow(/unauthorized/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().refreshToken).toBeNull();
  });

  it("does not attempt a refresh when the original request fails with a network error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHome("old-access-token", "child-1")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The session's tokens are untouched -- a network error is not treated as an auth failure.
    expect(useSessionStore.getState().accessToken).toBe("old-access-token");
  });

  it("does not attempt a refresh for the local test-session token", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { message: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHome("wooriai-local-session", LOCAL_CHILD_ID)).resolves.toBeDefined();
    // The local test token routes to the in-memory local backend, never touching fetch at all.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
