import { Inject, Injectable, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { isDevOrTestEnv } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { RefreshTokenStore } from "./refresh-token.store";
import { incrementOperationalMetric } from "../metrics/metrics.registry";
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
    @Inject(RefreshTokenStore)
    private readonly refreshTokenStore: RefreshTokenStore
  ) {}

  async oauthLogin(input: OAuthLoginInput) {
    if (!isDevOrTestEnv()) {
      throw new NotImplementedException({
        code: "OAUTH_LOGIN_NOT_IMPLEMENTED",
        message:
          "OAuth provider token verification is not implemented yet; oauth-login is disabled outside development/test."
      });
    }

    const user = await this.tokenService.createDevUser(input.provider, input.providerToken);
    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.login",
      targetType: "users",
      targetId: user.id,
      after: { provider: input.provider }
    });

    // Best-effort sweep of expired refresh_tokens rows on every login. Cheap
    // relative to a login round-trip and keeps the table from growing unbounded
    // without needing a separate cron/worker process.
    await this.refreshTokenStore.deleteExpired();

    return {
      user,
      tokens: await this.tokenService.issueTokenPair(user),
      onboardingRequired: true
    };
  }

  async refresh(refreshToken: string) {
    // `exp` is intentionally not destructured: the refresh_tokens row's own
    // expiresAt is the source of truth for rotation state, and verifyRefreshToken
    // already rejects an expired token before returning.
    const { user, jti, familyId } = await this.tokenService.verifyRefreshToken(refreshToken);

    // Tokens issued before rotation-tracking support (or otherwise missing the jti /
    // familyId claims) cannot be tied to a rotation record, so they are rejected
    // rather than silently trusted.
    if (!jti || !familyId) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const record = await this.refreshTokenStore.findByJti(jti);
    if (!record) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    if (record.tokenHash !== RefreshTokenStore.hashToken(refreshToken)) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    if (record.revokedAt) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    if (record.usedAt) {
      // Reuse of an already-redeemed refresh token indicates the token was stolen
      // (or a client retried a rotation it thought had failed). Either way, the
      // whole session family is no longer trustworthy and must be fully revoked.
      await this.refreshTokenStore.revokeFamily(record.familyId);
      incrementOperationalMetric("refresh_reuse_detected");
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const built = this.tokenService.buildRefreshToken(user, record.familyId);
    const rotated = await this.refreshTokenStore.rotate({
      oldJti: jti,
      userId: user.id,
      familyId: record.familyId,
      newJti: built.jti,
      newToken: built.token,
      newExpiresAt: built.expiresAt
    });

    if (!rotated) {
      // Another request already claimed (or the family was revoked) between our
      // lookup above and the atomic rotation attempt -- e.g. two concurrent
      // refresh calls presenting the same single-use token. This is
      // indistinguishable from token reuse, so it gets the same response: revoke
      // the whole family (including whichever concurrent request "won" the
      // rotation, if any) and reject.
      await this.refreshTokenStore.revokeFamily(record.familyId);
      incrementOperationalMetric("refresh_reuse_detected");
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.refresh",
      targetType: "users",
      targetId: user.id
    });

    return {
      accessToken: this.tokenService.signAccessToken(user),
      refreshToken: built.token,
      expiresIn: this.tokenService.accessTokenExpiresInSeconds
    };
  }

  async logout(user: AuthenticatedUser, refreshToken?: string) {
    if (refreshToken) {
      try {
        const { jti, familyId } = await this.tokenService.verifyRefreshToken(refreshToken);
        if (jti && familyId) {
          await this.refreshTokenStore.revokeFamily(familyId);
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
