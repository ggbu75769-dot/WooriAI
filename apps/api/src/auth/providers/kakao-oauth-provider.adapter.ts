import { Inject, Injectable } from "@nestjs/common";
import { requireSecret } from "../../common/config/require-secret";
import { KAKAO_OIDC_CLIENT, type KakaoOidcClient } from "../kakao/kakao-oidc-client";
import type {
  OAuthAuthorizationInput,
  OAuthCodeExchangeInput,
  OAuthProviderAdapter,
  VerifiedOAuthIdentity
} from "./oauth-provider.adapter";

const KAKAO_AUTHORIZE_ENDPOINT = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_UNLINK_ENDPOINT = "https://kapi.kakao.com/v1/user/unlink";

@Injectable()
export class KakaoOAuthProviderAdapter implements OAuthProviderAdapter {
  readonly provider = "kakao" as const;

  constructor(@Inject(KAKAO_OIDC_CLIENT) private readonly oidcClient: KakaoOidcClient) {}

  prepareAuthorization(input: OAuthAuthorizationInput) {
    const clientId = requireSecret("OAUTH_KAKAO_CLIENT_ID", "dev-kakao-client-id");
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      state: input.state,
      nonce: input.nonce
    });
    if (input.codeChallenge) {
      query.set("code_challenge", input.codeChallenge);
      query.set("code_challenge_method", "S256");
    }
    return `${KAKAO_AUTHORIZE_ENDPOINT}?${query.toString()}`;
  }

  async exchangeAuthorizationCode(input: OAuthCodeExchangeInput) {
    return (await this.oidcClient.exchangeCode(input)).idToken;
  }

  async verifyIdentity(idToken: string): Promise<VerifiedOAuthIdentity> {
    return await this.oidcClient.verifyIdToken(idToken);
  }

  async unlinkIdentity(input: { providerSubject: string }) {
    const adminKey = requireSecret("OAUTH_KAKAO_ADMIN_KEY", "");
    if (!adminKey) {
      throw new Error("OAUTH_KAKAO_UNLINK_NOT_CONFIGURED");
    }
    const response = await fetch(KAKAO_UNLINK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
      },
      body: new URLSearchParams({ target_id_type: "user_id", target_id: input.providerSubject }).toString()
    });
    if (!response.ok) {
      throw new Error("OAUTH_KAKAO_UNLINK_FAILED");
    }
  }
}
