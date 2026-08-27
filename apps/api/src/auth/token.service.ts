import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthProvider, UserStatus } from "@wooriai/domain";
import { requireSecret } from "../common/config/require-secret";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { HouseholdRuntimeService } from "../households/household-runtime.service";
import { RefreshTokenStore } from "./refresh-token.store";

type TokenType = "access" | "refresh";

/**
 * SEC-131: 발급 페이로드에 담는 클레임의 최종 형태.
 *
 * JWT 페이로드는 서명만 될 뿐 **암호화되지 않는다** — base64url 평문이라 누구나
 * 디코드할 수 있고, Authorization 헤더/프록시 액세스 로그/클라이언트 저장소/크래시
 * 리포트에 그대로 상주한다. 예전 페이로드는 `AuthenticatedUser` 전체를 펼쳐 담아
 * displayName·email·소속 household 목록(id/이름/역할)까지 실려 있었고, refresh
 * 토큰은 TTL이 30일이라 그 PII가 한 달 내내 여러 저장소에 흩어져 있었다.
 *
 * 이제는 "누구의, 어떤 종류의, 언제까지 유효한 토큰인가"를 판별할 최소 클레임만
 * 남긴다. 축소해도 잃는 정보가 없는 이유는 `verifyToken`이 어차피 매 검증마다
 * `HouseholdRuntimeService.enrichUser`로 users/household_members를 다시 읽어
 * displayName·email·status·households를 전부 DB에서 다시 만들기 때문이다(멤버십
 * 변경이 토큰 만료를 기다리지 않고 즉시 반영되어야 해서 원래부터 그랬다).
 *
 * `status`는 PII가 아니고, DB 조회 이전 단계에서 토큰의 의미를 사람이 읽을 수 있게
 * 남겨 두는 값이다 — 신뢰 경계 안쪽에서는 언제나 enrich 결과의 status를 쓴다.
 */
type SignedPayload = {
  sub: string;
  status: UserStatus;
  type: TokenType;
  iat: number;
  exp: number;
  jti?: string;
  familyId?: string;
};

/**
 * 검증 경로가 실제로 받아들이는 페이로드 모양. SEC-131 이전에 발급된 구형 토큰은
 * 사용자 식별자를 `sub`가 아니라 `id`로 들고 있고 PII 클레임이 함께 들어 있다 —
 * 이미 발급된 refresh 토큰이 최대 30일 살아 있으므로 **검증은 양쪽을 모두 수용**한다
 * (발급만 축소). 구형 토큰의 PII 클레임은 파싱만 될 뿐 읽지 않는다: 사용자 정보는
 * 전적으로 `enrichUser`의 DB 결과에서 온다.
 */
type DecodedPayload = Partial<SignedPayload> & { id?: unknown };

type VerifiedPayload = DecodedPayload & { sub: string; exp: number };

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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SEC-131: refresh 토큰 family의 절대 수명(일). 회전할 때마다 새 토큰의 `exp`가
 * `now + 30일`로 밀리기 때문에, 상한이 없으면 30일 안에 한 번씩만 앱을 열어도 세션이
 * **무한히** 연장된다 — 로그인 한 번으로 영구 세션이 만들어지는 셈이라 기기 분실이나
 * 토큰 유출의 노출 창이 닫히지 않는다. family 최초 생성(= 로그인) 시각을 기준으로
 * 이 기간을 넘기면 회전을 거부해 재로그인을 강제한다.
 */
export const DEFAULT_REFRESH_FAMILY_MAX_AGE_DAYS = 90;

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

  /**
   * `REFRESH_FAMILY_MAX_AGE_DAYS`를 읽는다. 미설정/비수치/0 이하는 기본값(90일)으로
   * 떨어뜨린다 — 오타 하나로 상한이 사라지거나(0) 모든 회전이 즉시 401이 되는 일을
   * 막기 위해서다(link-health.job.ts의 숫자 env 파싱 관례와 동일).
   */
  static refreshFamilyMaxAgeDays(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.REFRESH_FAMILY_MAX_AGE_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REFRESH_FAMILY_MAX_AGE_DAYS;
  }

  /**
   * family 최초 생성 시각이 절대 수명 상한을 넘겼는지. 상한을 "넘긴" 경우만 true라
   * 정확히 경계에 걸친 순간에는 아직 회전이 허용된다.
   */
  static isRefreshFamilyExpired(familyStartedAt: Date, now: Date = new Date()): boolean {
    const maxAgeMs = TokenService.refreshFamilyMaxAgeDays() * DAY_MS;
    return now.getTime() - familyStartedAt.getTime() > maxAgeMs;
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
   *
   * SEC-131: the stored row's `familyStartedAt` defaults to now, which is correct for
   * the new-login case (every caller today: AuthService.oauthLogin and the Kakao OIDC
   * exchange). Note that a future caller passing an *existing* `familyId` here would
   * restart that family's absolute-lifetime clock; such a caller must instead carry
   * the family's original start through `RefreshTokenStore.create`'s optional
   * `familyStartedAt`. Rotation (AuthService.refresh) already inherits it.
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
    // SEC-131: user 객체를 통째로 펼치지 않는다(`...user`가 email/displayName/
    // households를 평문 페이로드에 실어 나르던 자리). SignedPayload 타입 주석 참고.
    const payload = base64UrlJson({
      sub: user.id,
      status: user.status,
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
  ): Promise<{ user: AuthenticatedUser; payload: VerifiedPayload }> {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const signingInput = `${header}.${payload}`;
    if (!safeCompare(signature, hmacSha256(signingInput, secret))) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DecodedPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.type !== expectedType || typeof parsed.exp !== "number" || parsed.exp <= now) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    // SEC-131: 신형은 `sub`, 구형(전체 클레임)은 `id`에 사용자 식별자가 들어 있다.
    // 서명이 이미 검증된 뒤이므로 둘 중 존재하는 쪽을 그대로 신뢰하되, 문자열이
    // 아니면(변조/손상) 조용히 넘기지 않고 거절한다.
    const subject = typeof parsed.sub === "string" ? parsed.sub : typeof parsed.id === "string" ? parsed.id : null;
    if (!subject) {
      throw new UnauthorizedException("토큰을 다시 확인해주세요.");
    }

    // 사용자 정보는 전부 DB에서 만든다 — 구형 토큰에 실려 온 displayName/email/
    // households 클레임은 읽지 않는다(오래되어 틀릴 수도 있고, 신형 토큰에는 아예
    // 없어서 폴백으로 삼을 수도 없다).
    const user = await this.householdRuntime.enrichUser({ id: subject });

    return { user, payload: { ...parsed, sub: subject, exp: parsed.exp } };
  }

  private accessSecret() {
    return requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
  }

  private refreshSecret() {
    return requireSecret("JWT_REFRESH_SECRET", "wooriai-dev-refresh-secret");
  }
}
