import { Inject, Injectable } from "@nestjs/common";
import { importPKCS8, SignJWT, type KeyLike } from "jose";
import { PushConfigService } from "./push-config.service";
import { PUSH_HTTP_CLIENT, type PushHttpClient } from "./push-http.client";

/**
 * PUSH-113: FCM HTTP v1용 OAuth2 access token 발급/캐시.
 *
 * 서비스 계정 JSON의 private key로 RS256 JWT를 서명(jose — 기존 의존성,
 * 카카오 OIDC 검증과 같은 라이브러리)해 구글 token endpoint에
 * JWT Bearer grant(RFC 7523)로 교환한다. 발급받은 access token은 인스턴스에
 * 캐시하고, 만료 5분 전부터 선제 갱신한다. 동시 호출은 진행 중인 발급
 * Promise를 공유해 중복 네트워크 요청을 막는다.
 *
 * 보안: assertion(JWT)·private key·access token은 로그/예외 메시지에 싣지 않는다.
 */

export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const ASSERTION_LIFETIME_SECONDS = 3600;
const DEFAULT_TOKEN_TTL_SECONDS = 3600;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const JWT_BEARER_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";

@Injectable()
export class FcmTokenService {
  private cached: { token: string; expiresAtMs: number } | null = null;
  private pending: Promise<string> | null = null;
  private signingKey: KeyLike | null = null;

  constructor(
    @Inject(PushConfigService) private readonly config: PushConfigService,
    @Inject(PUSH_HTTP_CLIENT) private readonly http: PushHttpClient
  ) {}

  /** 관측용(health): 유효한 캐시 토큰 보유 여부 — 불리언만 노출. */
  hasCachedToken(nowMs: number = Date.now()): boolean {
    return this.cached !== null && nowMs < this.cached.expiresAtMs;
  }

  /**
   * 캐시가 (만료 5분 전 기준으로) 아직 신선하면 그대로 반환, 아니면 새로 발급.
   * `nowMs` 주입은 테스트에서 시간 경과를 흉내내기 위한 것.
   */
  async getAccessToken(nowMs: number = Date.now()): Promise<string> {
    if (this.cached && nowMs < this.cached.expiresAtMs - TOKEN_REFRESH_MARGIN_MS) {
      return this.cached.token;
    }
    if (this.pending) {
      return this.pending;
    }
    const pending = this.fetchAccessToken(nowMs).finally(() => {
      if (this.pending === pending) {
        this.pending = null;
      }
    });
    this.pending = pending;
    return pending;
  }

  private async fetchAccessToken(nowMs: number): Promise<string> {
    const config = this.config.resolve();
    if (!config.enabled) {
      // 정상 경로에서는 도달하지 않는다 — 발송 계층(FcmSenderService)이 먼저
      // no-op으로 걸러낸다. 방어적으로만 남겨둔 가드.
      throw new Error(`push disabled: ${config.reason}`);
    }

    const assertion = await this.signAssertion(config.clientEmail, config.tokenUri, config.privateKey, nowMs);
    const response = await this.http.postForm(config.tokenUri, {
      grant_type: JWT_BEARER_GRANT_TYPE,
      assertion
    });

    if (response.status < 200 || response.status >= 300) {
      // 구글 오류 응답의 error 코드 필드만 진단용으로 뽑는다 — 본문 원문은 싣지 않는다.
      throw new Error(`구글 OAuth 토큰 발급 실패: HTTP ${response.status}${describeOauthError(response.body)}`);
    }

    const json = safeJsonParse(response.body) as { access_token?: unknown; expires_in?: unknown } | null;
    const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
    if (!accessToken) {
      throw new Error("구글 OAuth 토큰 응답에 access_token이 없어요");
    }
    const expiresInSeconds =
      typeof json?.expires_in === "number" && Number.isFinite(json.expires_in) && json.expires_in > 0
        ? json.expires_in
        : DEFAULT_TOKEN_TTL_SECONDS;

    this.cached = { token: accessToken, expiresAtMs: nowMs + expiresInSeconds * 1000 };
    return accessToken;
  }

  private async signAssertion(clientEmail: string, tokenUri: string, privateKeyPem: string, nowMs: number): Promise<string> {
    if (!this.signingKey) {
      // 서비스 계정 키는 PKCS#8 PEM — 가져온 KeyLike는 재사용(파싱 1회).
      this.signingKey = await importPKCS8(privateKeyPem, "RS256");
    }
    const iat = Math.floor(nowMs / 1000);
    return new SignJWT({ scope: FCM_SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(clientEmail)
      .setSubject(clientEmail)
      .setAudience(tokenUri)
      .setIssuedAt(iat)
      .setExpirationTime(iat + ASSERTION_LIFETIME_SECONDS)
      .sign(this.signingKey);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 구글 OAuth 오류 응답에서 error 코드 문자열만 추출 (없으면 빈 문자열). */
function describeOauthError(body: string): string {
  const parsed = safeJsonParse(body) as { error?: unknown } | null;
  return typeof parsed?.error === "string" ? `, error=${parsed.error}` : "";
}
