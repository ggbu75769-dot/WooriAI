export type OAuthAuthorizationInput = {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge?: string;
};

export type OAuthCodeExchangeInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type VerifiedOAuthIdentity = {
  sub: string;
  nonce?: string;
  email?: string;
  nickname?: string;
};

export interface OAuthProviderAdapter {
  readonly provider: "kakao" | "apple" | "google";
  prepareAuthorization(input: OAuthAuthorizationInput): string;
  exchangeAuthorizationCode(input: OAuthCodeExchangeInput): Promise<string>;
  verifyIdentity(idToken: string): Promise<VerifiedOAuthIdentity>;
  unlinkIdentity(input: { providerSubject: string; traceId?: string }): Promise<void>;
}

export const KAKAO_OAUTH_PROVIDER_ADAPTER = Symbol("KAKAO_OAUTH_PROVIDER_ADAPTER");
