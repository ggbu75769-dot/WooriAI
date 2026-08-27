import { Inject, Injectable, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { isDevOrTestEnv } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { RefreshTokenStore } from "./refresh-token.store";
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
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    // SEC-131: 절대 수명 상한. 회전은 매번 exp를 `now + 30일`로 다시 밀기 때문에
    // 상한이 없으면 로그인 한 번이 영구 세션이 된다. family 최초 생성(로그인) 시각
    // 기준으로 REFRESH_FAMILY_MAX_AGE_DAYS(기본 90일)를 넘기면 회전을 거부한다.
    //
    // 재사용 감지(위 usedAt 분기)보다 **뒤에** 두는 이유: 오래된 family에 훔친 토큰이
    // 재사용된 경우에도 "재사용 → family 폐기 + 401"이라는 기존 계약이 그대로
    // 유지되어야 하기 때문이다. 여기서도 family를 폐기하는 것은 수명이 다한 세션의
    // 남은 형제 토큰들까지 즉시 무효화하기 위함이며, 응답은 다른 회전 실패와 똑같은
    // 401이라 클라이언트는 동일한 재로그인 경로를 탄다.
    if (TokenService.isRefreshFamilyExpired(record.familyStartedAt)) {
      await this.refreshTokenStore.revokeFamily(record.familyId);
      throw new UnauthorizedException("다시 로그인해주세요.");
    }

    const built = this.tokenService.buildRefreshToken(user, record.familyId);
    const rotated = await this.refreshTokenStore.rotate({
      oldJti: jti,
      userId: user.id,
      familyId: record.familyId,
      newJti: built.jti,
      newToken: built.token,
      newExpiresAt: built.expiresAt,
      familyStartedAt: record.familyStartedAt
    });

    if (!rotated) {
      // Another request already claimed (or the family was revoked) between our
      // lookup above and the atomic rotation attempt -- e.g. two concurrent
      // refresh calls presenting the same single-use token. This is
      // indistinguishable from token reuse, so it gets the same response: revoke
      // the whole family (including whichever concurrent request "won" the
      // rotation, if any) and reject.
      await this.refreshTokenStore.revokeFamily(record.familyId);
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
