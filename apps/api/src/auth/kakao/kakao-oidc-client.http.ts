import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { requireSecret } from "../../common/config/require-secret";
import type {
  KakaoCodeExchangeInput,
  KakaoCodeExchangeResult,
  KakaoIdTokenClaims,
  KakaoOidcClient
} from "./kakao-oidc-client";

const KAKAO_ISSUER = "https://kauth.kakao.com";
const KAKAO_TOKEN_ENDPOINT = "https://kauth.kakao.com/oauth/token";
const KAKAO_JWKS_URI = "https://kauth.kakao.com/.well-known/jwks.json";

/**
 * RES-130: 코드↔토큰 교환의 HTTP 타임아웃 기본값(ms).
 *
 * 맨 `fetch`는 undici 기본값(headers timeout 300초)을 그대로 물려받는다 —
 * 카카오가 응답을 멈추면 로그인 요청 하나가 5분간 워커 슬롯을 붙잡고, 그 사이
 * 재시도가 쌓이면 API 전체가 말라붙는다. 사용자가 로그인 버튼 앞에서 기다릴 수
 * 있는 시간은 그보다 훨씬 짧으므로 5초에서 끊고 기존 실패 경로로 보낸다
 * (link-health.job.ts의 LINK_HEALTH_TIMEOUT_MS와 같은 선례).
 */
export const DEFAULT_KAKAO_HTTP_TIMEOUT_MS = 5_000;

function kakaoClientId(): string {
  return requireSecret("OAUTH_KAKAO_CLIENT_ID", "dev-kakao-client-id");
}

/**
 * RES-130: KAKAO_HTTP_TIMEOUT_MS로 덮어쓸 수 있다 (숫자가 아니거나 0 이하이면
 * 기본값 — scheduler.service.ts의 WORKER_INTERVAL_MS 파싱 관례와 동일).
 * 호출 시점에 읽으므로 프로세스 재시작 없이 테스트에서 주입할 수 있다.
 */
export function kakaoHttpTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.KAKAO_HTTP_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_KAKAO_HTTP_TIMEOUT_MS;
  }
  return Math.floor(raw);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Real KakaoOidcClient implementation: exchanges an authorization code at
 * kauth's token endpoint over `fetch`, and verifies ID tokens against
 * Kakao's published JWKS via `jose`'s `createRemoteJWKSet` (which caches
 * fetched keys and matches by `kid`, refetching only on a `kid` miss).
 */
@Injectable()
export class HttpKakaoOidcClient implements KakaoOidcClient {
  // FIX-KAKAO-DIAG: 실패는 여전히 무차별 401(외부 계약 불변)이지만, 운영 진단을 위해
  // 원인(카카오 HTTP status·error 코드, JWKS 페치 실패 vs 토큰 검증 실패)을 warn으로
  // 남긴다. code/token/nonce 등 자격증명 값은 절대 로그에 넣지 않는다 — 오류 코드
  // 문자열과 jose의 정적 메시지(클레임 이름만 포함, 값 미포함)만.
  private readonly logger = new Logger(HttpKakaoOidcClient.name);

  private jwks?: JWTVerifyGetKey;

  private getJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      // cooldownDuration guards against refetching the JWKS on every request
      // for an unknown kid (e.g. a forged token) once a fetch has already
      // happened recently.
      this.jwks = createRemoteJWKSet(new URL(KAKAO_JWKS_URI), { cooldownDuration: 30_000 });
    }
    return this.jwks;
  }

  async exchangeCode(input: KakaoCodeExchangeInput): Promise<KakaoCodeExchangeResult> {
    const clientSecret = process.env.OAUTH_KAKAO_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: kakaoClientId(),
      redirect_uri: input.redirectUri,
      code: input.code
    });
    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }
    if (input.codeVerifier) {
      body.set("code_verifier", input.codeVerifier);
    }

    let response: Response;
    try {
      response = await fetch(KAKAO_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: body.toString(),
        // RES-130: 타임아웃이 걸리면 fetch가 TimeoutError로 reject되어 아래
        // "네트워크 계층 실패" 분기를 그대로 탄다 — 외부 계약(401
        // OAUTH_CODE_EXCHANGE_FAILED)은 바뀌지 않고, 로그에만 타임아웃
        // 메시지가 남는다.
        signal: AbortSignal.timeout(kakaoHttpTimeoutMs())
      });
    } catch (error) {
      // 네트워크 계층 실패 — 카카오까지 도달하지 못함(장애/DNS/타임아웃 추정).
      this.logger.warn(`카카오 코드 교환 실패(네트워크): ${errorMessage(error)}`);
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    if (!response.ok) {
      // 카카오가 거절 — error/error_description(invalid_grant vs invalid_client 등)을
      // 진단용으로 남긴다. code 값 자체는 로그 금지.
      const errorBody = (await response.json().catch(() => null)) as {
        error?: unknown;
        error_description?: unknown;
      } | null;
      const kakaoError = typeof errorBody?.error === "string" ? errorBody.error : "(파싱 불가)";
      const kakaoDescription =
        typeof errorBody?.error_description === "string"
          ? `, error_description="${errorBody.error_description}"`
          : "";
      this.logger.warn(
        `카카오 코드 교환 실패: HTTP ${response.status}, error=${kakaoError}${kakaoDescription}`
      );
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    const json = (await response.json().catch(() => null)) as { id_token?: string } | null;
    if (!json?.id_token) {
      this.logger.warn(
        `카카오 코드 교환 실패: HTTP ${response.status} 응답에 id_token 없음(본문 JSON 파싱 ${json ? "성공" : "실패"})`
      );
      throw new UnauthorizedException({
        code: "OAUTH_CODE_EXCHANGE_FAILED",
        message: "카카오 인증에 실패했어요. 다시 시도해주세요."
      });
    }

    // Only the id_token is returned — see KakaoOidcClient's doc comment on
    // why access/refresh tokens from this response are dropped here rather
    // than threaded through to callers.
    return { idToken: json.id_token };
  }

  async verifyIdToken(idToken: string): Promise<KakaoIdTokenClaims> {
    try {
      const { payload } = await jwtVerify(idToken, this.getJwks(), {
        issuer: KAKAO_ISSUER,
        audience: kakaoClientId(),
        // Pin the accepted signature algorithm rather than trusting whatever
        // alg the token's header claims — jose otherwise picks the algorithm
        // from the (attacker-controlled) JWT header, which is exactly the
        // "alg confusion" class of JWT vulnerability.
        algorithms: ["RS256"],
        requiredClaims: ["sub"]
      });
      return payload as KakaoIdTokenClaims;
    } catch (error) {
      // 실패 부류를 구분해 남긴다: JWKS 페치 실패(카카오 장애 추정) vs 토큰 자체
      // 검증 실패(위조/만료/클레임 불일치 추정). 토큰 원문·클레임 값 로그 금지 —
      // jose 오류 code와 정적 message(클레임 이름만 포함)만 사용한다.
      this.logger.warn(`카카오 ID 토큰 검증 실패 — ${describeVerifyFailure(error)}`);
      throw new UnauthorizedException({
        code: "OAUTH_ID_TOKEN_INVALID",
        message: "카카오 인증 정보를 확인할 수 없어요."
      });
    }
  }
}

/**
 * jwtVerify 실패를 진단 가능한 부류로 요약한다 (jose v5 기준):
 * - JWKSTimeout / JWKSInvalid / 기본 JOSEError(ERR_JOSE_GENERIC: 비-200·JSON 파싱
 *   실패는 jose가 기본 JOSEError로 던짐) → JWKS 페치 실패 (카카오 장애 쪽)
 * - 그 외 JOSEError(서명·만료·iss/aud/alg·kid 미매칭 등, code로 식별) → 토큰 검증 실패
 * - jose 밖 오류(소켓 오류 등) → JWKS 네트워크 실패 추정
 */
function describeVerifyFailure(error: unknown): string {
  if (error instanceof joseErrors.JWKSTimeout) {
    return `JWKS 페치 실패(타임아웃): ${error.code}`;
  }
  if (
    error instanceof joseErrors.JWKSInvalid ||
    (error instanceof joseErrors.JOSEError && error.code === "ERR_JOSE_GENERIC")
  ) {
    return `JWKS 페치 실패: ${error.message}`;
  }
  if (error instanceof joseErrors.JOSEError) {
    return `토큰 검증 실패: ${error.code} (${error.message})`;
  }
  return `JWKS 페치 실패(네트워크 추정): ${errorMessage(error)}`;
}
