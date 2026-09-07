import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuditLoggerService } from "../../common/audit/audit-logger.service";
import { HouseholdRuntimeService } from "../../households/household-runtime.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenService } from "../token.service";
import { KAKAO_OIDC_CLIENT, type KakaoOidcClient } from "./kakao-oidc-client";

const TX_TTL_MS = 10 * 60 * 1000;
const KAKAO_PROVIDER = "kakao";

/**
 * `users.display_name` varchar(80) · `users.email` varchar(320)의 컬럼 폭 그 자체
 * (prisma/schema.prisma). 아래 `clampDisplayName`/`clampEmail`이 유일한 사용처다.
 */
const USER_DISPLAY_NAME_MAX_LENGTH = 80;
const USER_EMAIL_MAX_LENGTH = 320;

/**
 * ⚠️ 두 시점 — 종전에는 카카오 클레임을 **그대로** users 행으로 넘겼다(그때는 참이었다:
 * 카카오 닉네임은 카카오 쪽에서 이미 짧고, 실제로 81자가 온 적은 없다). 그래도 이 값은
 * **우리가 만든 값이 아니라 외부 IdP가 준 값**이라, 길면 `users.display_name`
 * varchar(80) INSERT가 Prisma P2000으로 터졌고, P2000을 400으로 옮기는 핸들러가 저장소
 * 전체에 0건이라 그대로 500이 됐다(실측: nickname 81자 → `POST /auth/kakao/exchange`
 * 500. `providerUserId`만 `.slice(0, 191)`로 막혀 있었다 — household-runtime.service.ts).
 *
 * **거절이 아니라 자르기를 고른 이유**: 이 값은 사용자가 고칠 수 있는 자리가 아니다.
 * 400을 내면 그 사람은 앱에 **들어올 방법 자체가 없다**(카카오 프로필을 바꾸라는 안내조차
 * 우리 화면 밖이다). 반면 표시 이름은 잘려도 로그인·가계부·준비물 어느 것도 틀려지지
 * 않는다 — 화면에 보이는 이름이 짧아질 뿐이고, 사용자는 앱 안에서 바꿀 수 있다.
 * 로그인 자체를 막는 대가가 비교가 안 되게 크다.
 */
function clampDisplayName(nickname: string | undefined): string | undefined {
  if (nickname === undefined) {
    return undefined;
  }
  return nickname.slice(0, USER_DISPLAY_NAME_MAX_LENGTH);
}

/**
 * ⚠️ 두 시점 — 종전에는 `claims.email`을 그대로 넘겼고(그때는 참이었다: 카카오가 주는
 * 이메일이 320자를 넘은 적은 없다), 넘으면 `users.email` varchar(320)에서 위와 똑같이
 * P2000 → 500이었다(실측: 321자 이메일 → 500).
 *
 * **닉네임과 달리 자르지 않고 `null`로 떨어뜨린다.** 잘린 이메일은 짧아진 이름과 달리
 * "그럴듯하지만 틀린 값"이다 — 운영자 CS 조회 화면(admin-users-lookup.service.ts)이
 * 그 값을 사용자의 이메일로 보여 주고, 그걸 보고 연락하면 **다른 주소**로 간다. 게다가
 * 320자를 넘는 문자열은 애초에 배달 가능한 주소가 아니다(RFC 5321 상한 254) — 잘라서
 * 지킬 정보가 없다. "이메일 없음"은 적어도 참이다(컬럼이 nullable이고, 이메일로 하는
 * 일이 저장소에 아직 없다 — 발송 경로 0건). 로그인은 닉네임과 같은 이유로 막지 않는다.
 */
function clampEmail(email: string | undefined): string | null {
  if (email === undefined || email.length > USER_EMAIL_MAX_LENGTH) {
    return null;
  }
  return email;
}

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
      displayName: clampDisplayName(claims.nickname),
      email: clampEmail(claims.email)
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
