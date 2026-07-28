import { describe, expect, it } from "vitest";
import { parseOAuthCallback } from "./oauth-callback";

describe("OAuth callback parser", () => {
  it("accepts an authorization code with state", () => {
    expect(parseOAuthCallback("wooriai://oauth/kakao?code=abc&state=state-1")).toEqual({
      ok: true,
      code: "abc",
      state: "state-1"
    });
  });

  it("maps user denial to an explicit cancellation", () => {
    expect(parseOAuthCallback("wooriai://oauth/kakao?error=access_denied")).toMatchObject({
      ok: false,
      code: "OAUTH_CANCELLED"
    });
  });

  it.each([
    "not a url",
    "wooriai://oauth/kakao?code=abc",
    "wooriai://oauth/kakao?state=state-1"
  ])("rejects malformed callbacks: %s", (url) => {
    expect(parseOAuthCallback(url)).toMatchObject({ ok: false, code: "OAUTH_CALLBACK_INVALID" });
  });
});
