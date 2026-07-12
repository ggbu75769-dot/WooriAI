import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { requireSecret } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { HouseholdRuntimeService } from "../households/household-runtime.service";
import { RefreshTokenStore } from "./refresh-token.store";

type TokenType = "access" | "refresh";

type SignedPayload = AuthenticatedUser & {
  exp: number;
  iat: number;
  type: TokenType;
  jti?: string;
  familyId?: string;
};

export type RefreshTokenVerification = {
  user: AuthenticatedUser;
  jti: string | null;
  familyId: string | null;
  exp: number;
};

export type BuiltRefreshToken = {
  token: string;
  jti: string;
  familyId: string;
  expiresAt: Date;
};

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function hmacSha256(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class TokenService {
  private readonly accessExpiresInSeconds = 1800;

  get accessTokenExpiresInSeconds() {
    return this.accessExpiresInSeconds;
  }

  constructor(
    @Inject(HouseholdRuntimeService)
    private readonly householdRuntime: HouseholdRuntimeService,
    @Inject(RefreshTokenStore)
    private readonly refreshTokenStore: RefreshTokenStore
  ) {}

  async createDevUser(provider: AuthProvider, providerToken: string): Promise<AuthenticatedUser> {
    return this.householdRuntime.ensureDevUser(provider, providerToken);
  }

  /**
   * Issues a fresh access/refresh pair for a new login and persists the refresh
   * token's rotation record. A new `familyId` is generated unless one is supplied
   * (used when a caller wants to keep an existing session family alive).
   */
  async issueTokenPair(user: AuthenticatedUser, familyId?: string) {
    const accessToken = this.signAccessToken(user);
    const built = this.buildRefreshToken(user, familyId ?? randomUUID());
    await this.refreshTokenStore.create({
      userId: user.id,
      familyId: built.familyId,
      jti: built.jti,
      token: built.token,
      expiresAt: built.expiresAt
    });

    return {
      accessToken,
      refreshToken: built.token,
      expiresIn: this.accessExpiresInSeconds
    };
  }

  signAccessToken(user: AuthenticatedUser): string {
    return this.signToken(user, "access", this.accessExpiresInSeconds);
  }

  /**
   * Signs a new refresh token without persisting it. Callers that need to atomically
   * replace an existing token (rotation) sign first, then persist via
   * `RefreshTokenStore.rotate` so the old-token invalidation and new-token insertion
   * happen in one transaction.
   */
  buildRefreshToken(user: AuthenticatedUser, familyId: string): BuiltRefreshToken {
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + REFRESH_TOKEN_TTL_SECONDS;
    const token = this.signToken(user, "refresh", REFRESH_TOKEN_TTL_SECONDS, { jti, familyId });
    return { token, jti, familyId, expiresAt: new Date(exp * 1000) };
  }

  async verifyAccessToken(token: string) {
    const { user } = await this.verifyToken(token, "access", this.accessSecret());
    return user;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenVerification> {
    const { user, payload } = await this.verifyToken(token, "refresh", this.refreshSecret());
    return {
      user,
      jti: payload.jti ?? null,
      familyId: payload.familyId ?? null,
      exp: payload.exp
    };
  }

  private signToken(
    user: AuthenticatedUser,
    type: TokenType,
    expiresInSeconds: number,
    refreshClaims?: { jti: string; familyId: string }
  ) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
      ...user,
      type,
      iat: now,
      exp: now + expiresInSeconds,
      ...(type === "refresh" ? { jti: refreshClaims?.jti ?? randomUUID(), familyId: refreshClaims?.familyId } : {})
    } satisfies SignedPayload);
    const signingInput = `${header}.${payload}`;
    const secret = type === "access" ? this.accessSecret() : this.refreshSecret();
    return `${signingInput}.${hmacSha256(signingInput, secret)}`;
  }

  private async verifyToken(
    token: string,
    expectedType: TokenType,
    secret: string
  ): Promise<{ user: AuthenticatedUser; payload: SignedPayload }> {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const signingInput = `${header}.${payload}`;
    if (!safeCompare(signature, hmacSha256(signingInput, secret))) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.type !== expectedType || parsed.exp <= now) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const user = await this.householdRuntime.enrichUser({
      id: parsed.id,
      displayName: parsed.displayName,
      email: parsed.email,
      status: parsed.status,
      households: parsed.households
    });

    return { user, payload: parsed };
  }

  private accessSecret() {
    return requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
  }

  private refreshSecret() {
    return requireSecret("JWT_REFRESH_SECRET", "wooriai-dev-refresh-secret");
  }
}
