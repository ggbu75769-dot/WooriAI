import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuditLoggerService } from "../../common/audit/audit-logger.service";
import { HouseholdRuntimeService } from "../../households/household-runtime.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenService } from "../token.service";
import { KAKAO_OIDC_CLIENT, type KakaoOidcClient } from "./kakao-oidc-client";

const TX_TTL_MS = 10 * 60 * 1000;
const KAKAO_PROVIDER = "kakao";

function parseRedirectUriAllowlist(): string[] {
  return (process.env.OAUTH_KAKAO_REDIRECT_URIS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function oauthTransactionInvalid() {
  return new UnauthorizedException({
    code: "OAUTH_TRANSACTION_INVALID",
    message: "인증 절차를 다시 시작해주세요."
  });
}

export type PrepareKakaoOAuthInput = {
  redirectUri: string;
  codeChallenge?: string;
};

export type ExchangeKakaoOAuthInput = {
  transactionId: string;
  state: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

/**
 * Implements round5a-sprint2-plan.md §2's prepare/exchange flow for server-side
 * verified Kakao OIDC login. Unlike the existing dev `/auth/oauth-login` stub
 * (AuthService.oauthLogin, untouched by this class), this never trusts a
 * client-supplied token as-is: the ID token returned by Kakao is verified
 * (signature via JWKS, iss/aud/exp, and a nonce hash round-trip) before any user
 * is created or any session token is issued.
 */
@Injectable()
export class KakaoAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KAKAO_OIDC_CLIENT) private readonly kakaoClient: KakaoOidcClient,
    @Inject(HouseholdRuntimeService) private readonly householdRuntime: HouseholdRuntimeService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  async prepare(input: PrepareKakaoOAuthInput) {
    if (!parseRedirectUriAllowlist().includes(input.redirectUri)) {
      throw new BadRequestException({
        code: "OAUTH_REDIRECT_URI_NOT_ALLOWED",
        message: "허용되지 않은 redirect 주소예요."
      });
    }

    // Best-effort sweep of expired oauth_transactions rows on every prepare call.
    // Cheap relative to the round-trip and keeps the table from growing
    // unbounded without a separate cron/worker process (INF-006 is later scope) —
    // mirrors AuthService.oauthLogin's equivalent refresh-token sweep.
    await this.prisma.oauthTransaction.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const nonceHash = sha256Hex(nonce);
    const expiresAt = new Date(Date.now() + TX_TTL_MS);

    const tx = await this.prisma.oauthTransaction.create({
      data: {
        provider: KAKAO_PROVIDER,
        state,
        nonceHash,
        codeChallenge: input.codeChallenge ?? null,
        redirectUri: input.redirectUri,
        expiresAt
      }
    });

    // nonce is returned in plaintext exactly once — only its sha256 hash is
    // persisted (nonceHash above), matching round5a-sprint2-plan.md §2.
    return { transactionId: tx.id, state: tx.state, nonce };
  }

  async exchange(input: ExchangeKakaoOAuthInput) {
    const tx = await this.prisma.oauthTransaction.findUnique({ where: { id: input.transactionId } });
    if (!tx) {
      throw oauthTransactionInvalid();
    }

    if (tx.expiresAt.getTime() <= Date.now()) {
      // Lazy cleanup: an expired row is deleted the moment it's looked up
      // rather than relying on a scheduler (round5a-sprint2-plan.md §2 note 6).
      await this.prisma.oauthTransaction.delete({ where: { id: tx.id } }).catch(() => undefined);
      throw oauthTransactionInvalid();
    }

    if (tx.consumedAt) {
      throw oauthTransactionInvalid();
    }

    if (input.state !== tx.state) {
      throw oauthTransactionInvalid();
    }

    if (!parseRedirectUriAllowlist().includes(input.redirectUri) || input.redirectUri !== tx.redirectUri) {
      throw new BadRequestException({
        code: "OAUTH_REDIRECT_URI_NOT_ALLOWED",
        message: "허용되지 않은 redirect 주소예요."
      });
    }

    // Atomic claim (compare-and-swap on consumed_at) right before starting the
    // external/expensive part of the flow — mirrors RefreshTokenStore.rotate's
    // CAS pattern. Only the request that wins this updateMany proceeds; a
    // concurrent second exchange attempt for the same transaction gets count 0
    // and is rejected the same as a replay.
    const claimed = await this.prisma.oauthTransaction.updateMany({
      where: { id: tx.id, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    if (claimed.count === 0) {
      throw oauthTransactionInvalid();
    }

    const { idToken } = await this.kakaoClient.exchangeCode({
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier
    });
    const claims = await this.kakaoClient.verifyIdToken(idToken);

    if (!claims.nonce || sha256Hex(claims.nonce) !== tx.nonceHash) {
      throw new UnauthorizedException({
        code: "OAUTH_NONCE_MISMATCH",
        message: "인증 절차를 다시 시작해주세요."
      });
    }

    const { user, isNewUser } = await this.householdRuntime.findOrCreateProviderUser({
      provider: KAKAO_PROVIDER,
      providerUserId: claims.sub,
      displayName: claims.nickname,
      email: claims.email ?? null
    });

    // 차단이 탈퇴보다 먼저 나는 판정 순서·코드·문장·403은 그대로다(GAP-076 D). 달라진 것은
    // 거절이 **흔적을 남긴다**는 것뿐이다 — recordLoginRejected 참고.
    if (user.status === "blocked") {
      await this.recordLoginRejected(user.id, "blocked");
      throw new ForbiddenException({ code: "USER_BLOCKED", message: "이용이 제한된 계정이에요." });
    }
    if (user.status === "withdrawn") {
      await this.recordLoginRejected(user.id, "withdrawn");
      throw new ForbiddenException({ code: "USER_WITHDRAWN", message: "탈퇴한 계정이에요." });
    }

    const tokens = await this.tokenService.issueTokenPair(user);

    // No sub/email/provider-token logged — only the internal user id, matching
    // round5a-sprint2-plan.md §2's PII-log ban.
    await this.auditLogger.record({
      actorUserId: user.id,
      action: "auth.login",
      targetType: "users",
      targetId: user.id,
      after: { provider: KAKAO_PROVIDER }
    });

    return { user, tokens, onboardingRequired: isNewUser };
  }

  /**
   * GAP-076 D — **거절된 로그인을 세는 한 줄.**
   *
   * 라운드 75 A가 거절될 로그인의 `users` 행 쓰기를 막은 뒤로(파기 시계인
   * `users.updated_at`이 밀리지 않게), 차단·탈퇴 계정의 로그인 시도는 **조회 가능한 흔적을
   * 아무것도** 남기지 않았다. 같은 저장소가 운영자의 실패한 로그인은 세 종류로 세면서
   * (`admin.login_failed`·`admin.mfa_login_failed`·`admin.password_change_failed`) 이용자의
   * 거절은 세지 않았다 — CS는 "앱에 못 들어가요" 문의 앞에서 시도가 있었는지조차 구별할 수
   * 없었다(인증 전이라 요청 로그의 4xx에도 userId가 없다).
   *
   * ⚠️ **쓰는 것은 `audit_logs` 행 하나뿐이다.** `users` 행은 한 칸도 쓰지 않는다 —
   * `audit_logs`에는 `users` FK가 없고(schema.prisma), 파기 잡 phase 3이 탈퇴 계정의 감사
   * 로그를 익명화하므로 이 행이 라운드 75 P-1을 되돌리지 않는다.
   *
   * ⚠️ **PII 0건**: `sub`(카카오 식별자)·이메일·닉네임·ID 토큰은 싣지 않는다. 봉투에는
   * provider와 사유만 담는다 — `auth.login`이 지키는 그 규율 그대로
   * (round5a-sprint2-plan.md §2 · DNC-019).
   */
  private async recordLoginRejected(userId: string, reason: "blocked" | "withdrawn") {
    await this.auditLogger.record({
      actorUserId: userId,
      action: "auth.login_rejected",
      targetType: "users",
      targetId: userId,
      after: { provider: KAKAO_PROVIDER, reason }
    });
  }
}
