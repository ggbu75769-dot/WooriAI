import { Inject, Injectable } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
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
    private readonly tokenService: TokenService
  ) {}

  async oauthLogin(input: OAuthLoginInput) {
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
    const user = this.tokenService.verifyRefreshToken(refreshToken);
    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.refresh",
      targetType: "users",
      targetId: user.id
    });
    return this.tokenService.issueTokenPair(user);
  }

  async logout(user: AuthenticatedUser) {
    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.logout",
      targetType: "users",
      targetId: user.id
    });
    return { success: true };
  }
}
