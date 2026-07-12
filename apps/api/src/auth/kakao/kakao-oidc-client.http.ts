import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { requireSecret } from "../../common/config/require-secret";
import type {
  KakaoCodeExchangeInput,
  KakaoCodeExchangeResult,
  KakaoIdTokenClaims,
  KakaoOidcClient
} from "./kakao-oidc-client";

const KAKAO_ISSUER = "https://kauth.kakao.com";
const KAKAO_TOKEN_ENDPOINT = "https://kauth.kakao.com/oauth/token";
const KAKAO_JWKS_URI = "https://kauth.kakao.com/.well-known/jwks.json";

function kakaoClientId(): string {
  return requireSecret("OAUTH_KAKAO_CLIENT_ID", "dev-kakao-client-id");
}

/**
 * Real KakaoOidcClient implementation: exchanges an authorization code at
 * kauth's token endpoint over `fetch`, and verifies ID tokens against
 * Kakao's published JWKS via `jose`'s `createRemoteJWKSet` (which caches
 * fetched keys and matches by `kid`, refetching only on a `kid` miss).
 */
@Injectable()
export class HttpKakaoOidcClient implements KakaoOidcClient {
  private jwks?: JWTVerifyGetKey;

  private getJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      // cooldownDuration guards against refetching the JWKS on every request
      // for an unknown kid (e.g. a forged token) once a fetch has already
      // happened recently.
      this.jwks = createRemoteJWKSet(new URL(KAKAO_JWKS_URI), { cooldownDuration: 30_000 });
    }
    return this.jwks;
  }

  async exchangeCode(input: KakaoCodeExchangeInput): Promise<KakaoCodeExchangeResult> {
    const clientSecret = process.env.OAUTH_KAKAO_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: kakaoClientId(),
      redirect_uri: input.redirectUri,
      code: input.code
    });
    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }
    if (input.codeVerifier) {
      body.set("code_verifier", input.codeVerifier);
    }

    let response: Response;
    try {
      response = await fetch(KAKAO_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: body.toString()
      });
    } catch {
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    if (!response.ok) {
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    const json = (await response.json().catch(() => null)) as { id_token?: string } | null;
    if (!json?.id_token) {
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    // Only the id_token is returned — see KakaoOidcClient's doc comment on
    // why access/refresh tokens from this response are dropped here rather
    // than threaded through to callers.
    return { idToken: json.id_token };
  }

  async verifyIdToken(idToken: string): Promise<KakaoIdTokenClaims> {
    try {
      const { payload } = await jwtVerify(idToken, this.getJwks(), {
        issuer: KAKAO_ISSUER,
        audience: kakaoClientId(),
        // Pin the accepted signature algorithm rather than trusting whatever
        // alg the token's header claims — jose otherwise picks the algorithm
        // from the (attacker-controlled) JWT header, which is exactly the
        // "alg confusion" class of JWT vulnerability.
        algorithms: ["RS256"],
        requiredClaims: ["sub"]
      });
      return payload as KakaoIdTokenClaims;
    } catch {
      throw new UnauthorizedException({
        code: "OAUTH_ID_TOKEN_INVALID",
        message: "카카오 인증 정보를 확인할 수 없어요."
      });
    }
  }
}
