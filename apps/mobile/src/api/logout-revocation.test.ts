import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_SESSION_TOKEN, revokeSessionOnServer } from "./client";
import { useSessionStore } from "../stores/session.store";

/**
 * 라운드 107 트랙 B(S1-2) — 로그아웃의 **서버 폐기 요청**.
 *
 * 정찰 S1이 잡은 상태: 서버 `POST /auth/logout`은 구현·테스트까지 있는데
 * (`apps/api/src/auth/auth.service.ts`의 `logout()` → `revokeFamily`,
 * `apps/api/test/refresh-token-rotation.db.test.ts`가 로그아웃 후 회전이 401임을 잠근다)
 * `apps/mobile/**`에 호출자가 0건이라, 로그아웃해도 refresh 토큰 family가 최대 30일 살아 있었다.
 *
 * 이 파일이 잠그는 것은 **전송 한 갈래**다: 무엇을 보내는가, 그리고 서버가 답하지 않는 세
 * 갈래(401 · 5xx · 오프라인)에서 각각 무슨 일이 벌어지는가. "언제 보내는가"(정체성 전이)는
 * src/offline/session-teardown.test.ts 쪽에 있다.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function authorizationHeader(init: RequestInit | undefined): string | null {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization ?? null;
}

describe("라운드 107 트랙 B — revokeSessionOnServer", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  it("나가는 액세스 토큰으로 POST /auth/logout을 한 번 보내고, 본문에 refresh 토큰을 싣는다", async () => {
    const calls: Array<{ url: string; method?: string; auth: string | null; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          method: init?.method,
          auth: authorizationHeader(init),
          body: JSON.parse(String(init?.body))
        });
        return jsonResponse(200, { success: true });
      })
    );

    await expect(revokeSessionOnServer("outgoing-access", "outgoing-refresh")).resolves.toBe("revoked");

    // 폐기할 family를 아는 값은 refresh 토큰 하나다 -- 서버 logout()이 그것으로 revokeFamily를 부른다.
    expect(calls).toEqual([
      {
        url: `${API_BASE_URL}/auth/logout`,
        method: "POST",
        auth: "Bearer outgoing-access",
        body: { refreshToken: "outgoing-refresh" }
      }
    ]);
  });

  it("401(액세스 토큰이 이미 만료된 채 누른 로그아웃): failed를 돌려줄 뿐, refresh를 태우지도 세션을 '만료'로 만들지도 않는다", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return jsonResponse(401, { message: "unauthorized" });
      })
    );

    await expect(revokeSessionOnServer("stale-access", "outgoing-refresh")).resolves.toBe("failed");

    // requestJson을 지났다면 여기서 /auth/refresh가 한 번 더 나가고, 그 401이
    // clearSession("expired")를 불러 로그인 화면이 "세션이 만료됐어요"라는 거짓을 띄운다.
    expect(urls).toEqual([`${API_BASE_URL}/auth/logout`]);
    expect(useSessionStore.getState().lastEndReason).not.toBe("expired");
  });

  it("5xx(프록시가 낸 비-JSON 502 포함): 본문을 파싱하지 않으므로 예외 없이 failed다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }))
    );

    await expect(revokeSessionOnServer("outgoing-access", "outgoing-refresh")).resolves.toBe("failed");
  });

  it("오프라인(fetch 자체가 거부): throw하지 않고 failed다 -- 로그아웃을 막을 수 있는 유일한 갈래를 여기서 닫는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      })
    );

    await expect(revokeSessionOnServer("outgoing-access", "outgoing-refresh")).resolves.toBe("failed");
  });

  it("보낼 것이 없으면 요청 0건이다: refresh 토큰 없음 · 액세스 토큰 없음 · 데모(local) 세션", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(revokeSessionOnServer("outgoing-access", null)).resolves.toBe("skipped");
    await expect(revokeSessionOnServer(null, "outgoing-refresh")).resolves.toBe("skipped");
    await expect(revokeSessionOnServer(LOCAL_SESSION_TOKEN, "outgoing-refresh")).resolves.toBe("skipped");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("전송 규칙 원문 확인: 폐기 호출은 requestJson(401→refresh→endSessionAsExpired) 갈래를 지나지 않는다", () => {
    const source = readFileSync(join(process.cwd(), "src/api/client.ts"), "utf8");
    const start = source.indexOf("export async function revokeSessionOnServer(");
    // 슬라이스 양쪽 끝 가드(라운드 78): 시작이 없으면 -1에서 잘려 아래 단언이 전부 무의미해지고,
    // 끝(다음 함수)이 없으면 파일 나머지 전체를 보게 된다.
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("function performSingleFlightRefresh(", start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);

    expect(body).toContain("fetchWithTimeout(`${API_BASE_URL}/auth/logout`");
    expect(body).not.toContain("requestJson");
    expect(body).not.toContain("endSessionAsExpired");
  });
});
