import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider } from "@wooriai/domain";
import { requireSecret } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { HouseholdRuntimeService } from "../households/household-runtime.service";

type TokenType = "access" | "refresh";

type SignedPayload = AuthenticatedUser & {
  exp: number;
  iat: number;
  type: TokenType;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function hmacSha256(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function deterministicUuid(value: string) {
  const hash = createHash("sha256").update(value).digest("hex");
  const variant = ((Number.parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class TokenService {
  private readonly accessExpiresInSeconds = 1800;

  constructor(
    @Inject(HouseholdRuntimeService)
    private readonly householdRuntime: HouseholdRuntimeService
  ) {}

  createDevUser(provider: AuthProvider, providerToken: string): AuthenticatedUser {
    const householdId = deterministicUuid(`${provider}:${providerToken}:household`);

    return this.householdRuntime.enrichUser({
      id: deterministicUuid(`${provider}:${providerToken}`),
      displayName: "개발 사용자",
      email: null,
      status: "active",
      households: [{ id: householdId, name: "우리 가족", role: "owner" }]
    });
  }

  issueTokenPair(user: AuthenticatedUser) {
    return {
      accessToken: this.signToken(user, "access", this.accessExpiresInSeconds),
      refreshToken: this.signToken(user, "refresh", 60 * 60 * 24 * 30),
      expiresIn: this.accessExpiresInSeconds
    };
  }

  verifyAccessToken(token: string) {
    return this.verifyToken(token, "access", this.accessSecret());
  }

  verifyRefreshToken(token: string) {
    return this.verifyToken(token, "refresh", this.refreshSecret());
  }

  private signToken(user: AuthenticatedUser, type: TokenType, expiresInSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
      ...user,
      type,
      iat: now,
      exp: now + expiresInSeconds
    } satisfies SignedPayload);
    const signingInput = `${header}.${payload}`;
    const secret = type === "access" ? this.accessSecret() : this.refreshSecret();
    return `${signingInput}.${hmacSha256(signingInput, secret)}`;
  }

  private verifyToken(token: string, expectedType: TokenType, secret: string): AuthenticatedUser {
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

    return this.householdRuntime.enrichUser({
      id: parsed.id,
      displayName: parsed.displayName,
      email: parsed.email,
      status: parsed.status,
      households: parsed.households
    });
  }

  private accessSecret() {
    return requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
  }

  private refreshSecret() {
    return requireSecret("JWT_REFRESH_SECRET", "wooriai-dev-refresh-secret");
  }
}
