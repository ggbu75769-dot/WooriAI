/**
 * Claims read off a verified Kakao ID token (RS256, JWKS-signed). Only the
 * fields the exchange flow actually consumes are typed here — Kakao's ID
 * tokens carry additional standard OIDC claims we don't need.
 */
export type KakaoIdTokenClaims = {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  nickname?: string;
};

export type KakaoCodeExchangeInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type KakaoCodeExchangeResult = {
  idToken: string;
};

/**
 * Abstraction over the two external Kakao OIDC operations the exchange flow
 * needs (round5a-sprint2-plan.md §2): trading an authorization code for an ID
 * token at the kauth token endpoint, and verifying that ID token's signature
 * against Kakao's published JWKS. Kept as an interface (rather than calling
 * `fetch`/`jose` directly from the service) so unit/e2e tests can inject a
 * mock that signs/verifies against a locally generated RSA key pair instead
 * of reaching kauth.kakao.com over the network.
 *
 * Provider access/refresh tokens returned by exchangeCode are intentionally
 * NOT part of KakaoCodeExchangeResult — only the id_token is needed
 * downstream, and round5a-sprint2-plan.md §2 requires provider tokens are
 * never persisted or reused as the app session.
 */
export interface KakaoOidcClient {
  exchangeCode(input: KakaoCodeExchangeInput): Promise<KakaoCodeExchangeResult>;
  verifyIdToken(idToken: string): Promise<KakaoIdTokenClaims>;
}

/** DI token for KakaoOidcClient — an interface has no runtime value to key providers off of. */
export const KAKAO_OIDC_CLIENT = Symbol("KAKAO_OIDC_CLIENT");
