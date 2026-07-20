import type { OAuthAuthorizationInput, OAuthCodeExchangeInput, OAuthProviderAdapter, VerifiedOAuthIdentity } from "./oauth-provider.adapter";

type MockClaims = VerifiedOAuthIdentity & { email?: string; nickname?: string };

function parseMockToken(value: string): MockClaims {
  if (!value.startsWith("mock.")) throw new Error("MOCK_OAUTH_CODE_INVALID");
  try {
    const claims = JSON.parse(Buffer.from(value.slice(5), "base64url").toString("utf8")) as MockClaims;
    if (!claims || typeof claims.sub !== "string" || !/^[A-Za-z0-9_-]{3,80}$/.test(claims.sub) || typeof claims.nonce !== "string" || claims.nonce.length < 16) {
      throw new Error("MOCK_OAUTH_CODE_INVALID");
    }
    return claims;
  } catch {
    throw new Error("MOCK_OAUTH_CODE_INVALID");
  }
}

export function createMockKakaoCode(input: MockClaims) {
  return `mock.${Buffer.from(JSON.stringify(input), "utf8").toString("base64url")}`;
}

export class MockKakaoOAuthProviderAdapter implements OAuthProviderAdapter {
  readonly provider = "kakao" as const;

  constructor() {
    if (process.env.NODE_ENV === "production") throw new Error("MOCK_OAUTH_FORBIDDEN_IN_PRODUCTION");
  }

  prepareAuthorization(input: OAuthAuthorizationInput) {
    const query = new URLSearchParams({ redirect_uri: input.redirectUri, state: input.state, nonce: input.nonce });
    return `https://mock-oauth.wooriai.invalid/authorize?${query.toString()}`;
  }

  async exchangeAuthorizationCode(input: OAuthCodeExchangeInput) {
    parseMockToken(input.code);
    return input.code;
  }

  async verifyIdentity(idToken: string) {
    return parseMockToken(idToken);
  }

  async unlinkIdentity() {
    return undefined;
  }
}
