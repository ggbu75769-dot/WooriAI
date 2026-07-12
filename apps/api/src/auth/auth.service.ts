import { Inject, Injectable, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { isDevOrTestEnv } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { RefreshTokenRevocationService } from "./refresh-token-revocation.service";
import { TokenService } from "./token.service";

type OAuthLoginInput = {
  provider: AuthProvider;
  providerToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(RefreshTokenRevocationService)
    private readonly refreshTokenRevocation: RefreshTokenRevocationService
  ) {}

  async oauthLogin(input: OAuthLoginInput) {
    if (!isDevOrTestEnv()) {
      throw new NotImplementedException({
        code: "OAUTH_LOGIN_NOT_IMPLEMENTED",
        message:
          "OAuth provider token verification is not implemented yet; oauth-login is disabled outside development/test."
      });
    }

    const user = this.tokenService.createDevUser(input.provider, input.providerToken);
    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.login",
      targetType: "users",
      targetId: user.id,
      after: { provider: input.provider }
    });

    return {
      user,
      tokens: this.tokenService.issueTokenPair(user),
      onboardingRequired: true
    };
  }

  async refresh(refreshToken: string) {
    const { user, jti, exp } = this.tokenService.verifyRefreshToken(refreshToken);

    // jti is only present on tokens issued after rotation support was added. Legacy
    // tokens without a jti cannot be tracked for reuse, so we simply let them through
    // and issue a new (jti-bearing) pair rather than rejecting a previously-valid
    // session — this in-memory revocation store resets on every restart anyway, so
    // rejecting legacy tokens would add complexity without a durable security benefit.
    if (jti) {
      if (this.refreshTokenRevocation.isRevoked(jti)) {
        throw new UnauthorizedException("토큰을 다시 확인해주세요.");
      }
      // Single-use rotation: this refresh token cannot be redeemed again.
      this.refreshTokenRevocation.revoke(jti, exp);
    }

    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.refresh",
      targetType: "users",
      targetId: user.id
    });
    return this.tokenService.issueTokenPair(user);
  }

  async logout(user: AuthenticatedUser, refreshToken?: string) {
    if (refreshToken) {
      try {
        const { jti, exp } = this.tokenService.verifyRefreshToken(refreshToken);
        if (jti) {
          this.refreshTokenRevocation.revoke(jti, exp);
        }
      } catch {
        // An already-expired or malformed refresh token doesn't block logout —
        // there's nothing left to revoke, and the session is ending either way.
      }
    }

    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.logout",
      targetType: "users",
      targetId: user.id
    });
    return { success: true };
  }
}
