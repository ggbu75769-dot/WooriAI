import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildKakaoAuthorizeUrl,
  getKakaoEnvConfig,
  isKakaoLoginAvailable,
  KAKAO_AUTHORIZE_ENDPOINT,
  KakaoLoginCancelledError,
  KakaoLoginError,
  loginWithKakao,
  parseKakaoRedirectUrl
} from "./kakao-login";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

const CLIENT_ID = "test-kakao-rest-key";
const REDIRECT_URI = "wooriai://oauth/kakao";

function stubKakaoEnv({ enabled = "1", clientId = CLIENT_ID, redirectUri = REDIRECT_URI } = {}) {
  vi.stubEnv("EXPO_PUBLIC_KAKAO_ENABLED", enabled);
  vi.stubEnv("EXPO_PUBLIC_KAKAO_CLIENT_ID", clientId);
  vi.stubEnv("EXPO_PUBLIC_KAKAO_REDIRECT_URI", redirectUri);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function queryOf(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of url.split("?")[1].split("&")) {
    const [key, value] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return params;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AUTH-102 isKakaoLoginAvailable (feature flag)", () => {
  it("is enabled only when EXPO_PUBLIC_KAKAO_ENABLED=1 AND both keys are present", () => {
    stubKakaoEnv();
    expect(isKakaoLoginAvailable()).toBe(true);
    expect(getKakaoEnvConfig()).toEqual({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI });
  });

  it("stays disabled when the switch is off, even with both keys set", () => {
    stubKakaoEnv({ enabled: "0" });
    expect(isKakaoLoginAvailable()).toBe(false);
    stubKakaoEnv({ enabled: "true" }); // only the exact string "1" counts
    expect(isKakaoLoginAvailable()).toBe(false);
  });

  it("stays disabled when any required key is missing or empty", () => {
    stubKakaoEnv({ clientId: "" });
    expect(isKakaoLoginAvailable()).toBe(false);
    stubKakaoEnv({ redirectUri: "" });
    expect(isKakaoLoginAvailable()).toBe(false);
    expect(getKakaoEnvConfig()).toBeNull();
  });
});

describe("AUTH-102 authorize URL construction", () => {
  it("targets kauth.kakao.com with client_id, redirect_uri, response_type=code, state, nonce and S256 PKCE params", () => {
    const url = buildKakaoAuthorizeUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-abc",
      nonce: "nonce-xyz",
      codeChallenge: "challenge-123"
    });

    expect(url.startsWith(`${KAKAO_AUTHORIZE_ENDPOINT}?`)).toBe(true);
    expect(KAKAO_AUTHORIZE_ENDPOINT).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(queryOf(url)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      state: "state-abc",
      nonce: "nonce-xyz",
      code_challenge: "challenge-123",
      code_challenge_method: "S256"
    });
  });

  it("percent-encodes the redirect URI and any reserved characters in params", () => {
    const url = buildKakaoAuthorizeUrl({
      clientId: CLIENT_ID,
      redirectUri: "wooriai://oauth/kakao?flow=login",
      state: "a+b&c=d",
      nonce: "n/1",
      codeChallenge: "c"
    });
    expect(url).toContain(`redirect_uri=${encodeURIComponent("wooriai://oauth/kakao?flow=login")}`);
    expect(url).toContain(`state=${encodeURIComponent("a+b&c=d")}`);
    expect(queryOf(url).state).toBe("a+b&c=d");
  });
});

describe("AUTH-102 redirect URL parsing", () => {
  it("extracts the code when the state echo matches", () => {
    expect(parseKakaoRedirectUrl(`${REDIRECT_URI}?code=auth-code-1&state=s1`, "s1")).toEqual({
      code: "auth-code-1"
    });
  });

  it("rejects a state mismatch before trusting the code", () => {
    expect(() => parseKakaoRedirectUrl(`${REDIRECT_URI}?code=auth-code-1&state=evil`, "s1")).toThrowError(
      expect.objectContaining({ code: "KAKAO_STATE_MISMATCH" })
    );
  });

  it("surfaces Kakao's access_denied as a cancellation, other errors as provider errors", () => {
    expect(() => parseKakaoRedirectUrl(`${REDIRECT_URI}?error=access_denied&state=s1`, "s1")).toThrowError(
      KakaoLoginCancelledError
    );
    expect(() => parseKakaoRedirectUrl(`${REDIRECT_URI}?error=server_error&state=s1`, "s1")).toThrowError(
      expect.objectContaining({ code: "KAKAO_PROVIDER_ERROR" })
    );
  });

  it("rejects a redirect with no code at all", () => {
    expect(() => parseKakaoRedirectUrl(`${REDIRECT_URI}?state=s1`, "s1")).toThrowError(
      expect.objectContaining({ code: "KAKAO_REDIRECT_INVALID" })
    );
  });
});

describe("AUTH-102 loginWithKakao end-to-end wiring (fetch mocked)", () => {
  const exchangeResult = {
    user: { id: "user-1", households: [{ id: "household-1", name: "우리집", role: "owner" }] },
    tokens: { accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 900 },
    onboardingRequired: true
  };

  beforeEach(() => {
    stubKakaoEnv();
  });

  it("runs prepare -> authorize browser -> exchange with the exact server payload shapes", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ url, body });
      if (url === `${API_BASE_URL}/auth/kakao/prepare`) {
        return jsonResponse(200, { transactionId: "tx-1", state: "state-1", nonce: "nonce-1" });
      }
      if (url === `${API_BASE_URL}/auth/kakao/exchange`) {
        return jsonResponse(200, exchangeResult);
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    let openedAuthorizeUrl = "";
    const openAuthSession = vi.fn(async (authorizeUrl: string, redirectUri: string) => {
      openedAuthorizeUrl = authorizeUrl;
      return `${redirectUri}?code=auth-code-9&state=state-1`;
    });

    const result = await loginWithKakao({ openAuthSession });

    expect(result).toEqual(exchangeResult);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // prepare payload: exactly { redirectUri, codeChallenge } -- the API pipe uses
    // forbidNonWhitelisted, so any extra key (e.g. codeChallengeMethod) would 400.
    const prepareRequest = requests[0];
    expect(prepareRequest.url).toBe(`${API_BASE_URL}/auth/kakao/prepare`);
    expect(Object.keys(prepareRequest.body).sort()).toEqual(["codeChallenge", "redirectUri"]);
    expect(prepareRequest.body.redirectUri).toBe(REDIRECT_URI);
    const codeChallenge = prepareRequest.body.codeChallenge as string;
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // The browser was pointed at the prepare-issued state/nonce plus the same challenge.
    const authorizeParams = queryOf(openedAuthorizeUrl);
    expect(authorizeParams.state).toBe("state-1");
    expect(authorizeParams.nonce).toBe("nonce-1");
    expect(authorizeParams.code_challenge).toBe(codeChallenge);
    expect(authorizeParams.code_challenge_method).toBe("S256");
    expect(authorizeParams.client_id).toBe(CLIENT_ID);

    // exchange payload: exact DTO shape, verifier hashes to the challenge sent to prepare.
    const exchangeRequest = requests[1];
    expect(exchangeRequest.url).toBe(`${API_BASE_URL}/auth/kakao/exchange`);
    expect(Object.keys(exchangeRequest.body).sort()).toEqual([
      "code",
      "codeVerifier",
      "redirectUri",
      "state",
      "transactionId"
    ]);
    expect(exchangeRequest.body).toMatchObject({
      transactionId: "tx-1",
      state: "state-1",
      code: "auth-code-9",
      redirectUri: REDIRECT_URI
    });
    const codeVerifier = exchangeRequest.body.codeVerifier as string;
    expect(createHash("sha256").update(codeVerifier, "ascii").digest("base64url")).toBe(codeChallenge);
  });

  it("never calls exchange when the browser redirect carries a mismatched state", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `${API_BASE_URL}/auth/kakao/prepare`) {
        return jsonResponse(200, { transactionId: "tx-1", state: "state-1", nonce: "nonce-1" });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loginWithKakao({
        openAuthSession: async (_authorizeUrl, redirectUri) => `${redirectUri}?code=c&state=tampered`
      })
    ).rejects.toMatchObject({ code: "KAKAO_STATE_MISMATCH" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the user cancelling on the Kakao consent screen as KakaoLoginCancelledError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { transactionId: "tx-1", state: "state-1", nonce: "nonce-1" }))
    );

    await expect(
      loginWithKakao({
        openAuthSession: async (_authorizeUrl, redirectUri) => `${redirectUri}?error=access_denied&state=state-1`
      })
    ).rejects.toBeInstanceOf(KakaoLoginCancelledError);
  });

  it("fails fast with KAKAO_NOT_CONFIGURED (no network calls) when env keys are absent", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("EXPO_PUBLIC_KAKAO_ENABLED", "");
    vi.stubEnv("EXPO_PUBLIC_KAKAO_CLIENT_ID", "");
    vi.stubEnv("EXPO_PUBLIC_KAKAO_REDIRECT_URI", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginWithKakao()).rejects.toMatchObject({ code: "KAKAO_NOT_CONFIGURED" });
    await expect(loginWithKakao()).rejects.toBeInstanceOf(KakaoLoginError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a prepare failure (e.g. redirect URI not allowlisted server-side)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, { error: { code: "OAUTH_REDIRECT_URI_NOT_ALLOWED", message: "허용되지 않은 redirect 주소예요." } })
      )
    );
    const openAuthSession = vi.fn();

    await expect(loginWithKakao({ openAuthSession })).rejects.toThrowError(/OAUTH_REDIRECT_URI_NOT_ALLOWED/);
    expect(openAuthSession).not.toHaveBeenCalled();
  });
});
