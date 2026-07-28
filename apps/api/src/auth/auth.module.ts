import { Module } from "@nestjs/common";
import { AuditModule } from "../common/audit/audit.module";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { HouseholdRuntimeModule } from "../households/household-runtime.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { KakaoAuthController } from "./kakao/kakao-auth.controller";
import { KakaoAuthService } from "./kakao/kakao-auth.service";
import { HttpKakaoOidcClient } from "./kakao/kakao-oidc-client.http";
import { KAKAO_OIDC_CLIENT } from "./kakao/kakao-oidc-client";
import { RefreshTokenStore } from "./refresh-token.store";
import { TokenService } from "./token.service";
import { KakaoOAuthProviderAdapter } from "./providers/kakao-oauth-provider.adapter";
import { KAKAO_OAUTH_PROVIDER_ADAPTER } from "./providers/oauth-provider.adapter";
import { MockKakaoOAuthProviderAdapter } from "./providers/mock-kakao-oauth-provider.adapter";

@Module({
  imports: [AuditModule, HouseholdRuntimeModule],
  controllers: [AuthController, KakaoAuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    TokenService,
    RefreshTokenStore,
    KakaoAuthService,
    { provide: KAKAO_OIDC_CLIENT, useClass: HttpKakaoOidcClient },
    {
      provide: KAKAO_OAUTH_PROVIDER_ADAPTER,
      inject: [KAKAO_OIDC_CLIENT],
      useFactory: (oidcClient: HttpKakaoOidcClient) => {
        if (process.env.OAUTH_PROVIDER_MODE === "mock") return new MockKakaoOAuthProviderAdapter();
        return new KakaoOAuthProviderAdapter(oidcClient);
      }
    }
  ],
  exports: [AuthService, JwtAuthGuard, TokenService, RefreshTokenStore, KAKAO_OAUTH_PROVIDER_ADAPTER]
})
export class AuthModule {}
