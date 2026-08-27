import { Injectable } from "@nestjs/common";

/**
 * PUSH-113: 주입 가능한 최소 HTTP 계층. 테스트는 이 인터페이스를 스텁으로 갈아끼워
 * 실제 네트워크 없이 토큰 발급/발송 경로를 검증한다.
 *
 * 실 구현(FetchPushHttpClient)은 카카오 OIDC 클라이언트
 * (auth/kakao/kakao-oidc-client.http.ts)와 동일하게 전역 `fetch`를 쓴다 —
 * 이 코드베이스에 별도의 node:https 래퍼는 없고 fetch가 기존 외부 HTTP 관례다.
 */

export type PushHttpResponse = {
  status: number;
  /** 응답 본문 원문(텍스트). 호출부가 필요한 필드만 파싱한다. */
  body: string;
};

export interface PushHttpClient {
  postForm(url: string, form: Record<string, string>): Promise<PushHttpResponse>;
  postJson(url: string, body: unknown, headers: Record<string, string>): Promise<PushHttpResponse>;
}

/** Nest DI 토큰 (인터페이스는 런타임에 없으므로 문자열 토큰으로 바인딩). */
export const PUSH_HTTP_CLIENT = "PUSH_HTTP_CLIENT";

/**
 * RES-130: 두 호출의 HTTP 타임아웃 기본값(ms).
 *
 * 맨 `fetch`는 undici 기본값(headers timeout 300초)을 그대로 쓴다 — 구글이
 * 응답을 멈추면 발송 하나가 5분간 매달려 배치 전체를 막는다. 발송 계층
 * (fcm-sender.service.ts)은 "예외를 던지지 않고 실패로 집계"하는 계약이므로,
 * 타임아웃도 그냥 기존 실패 경로(sendFailed + SEND_ERROR)로 흘려보내면 된다.
 *
 * 값이 다른 이유: postForm은 구글 OAuth 토큰 발급(짧고, 실패해도 캐시 폴백이
 * 있는 준비 단계)이라 5초, postJson은 실제 FCM 발송(본 작업)이라 10초.
 */
export const DEFAULT_FCM_TOKEN_TIMEOUT_MS = 5_000;
export const DEFAULT_FCM_SEND_TIMEOUT_MS = 10_000;

/**
 * RES-130: FCM_TOKEN_HTTP_TIMEOUT_MS / FCM_SEND_HTTP_TIMEOUT_MS로 덮어쓸 수 있다
 * (숫자가 아니거나 0 이하이면 기본값 — scheduler.service.ts의
 * WORKER_INTERVAL_MS 파싱 관례와 동일). 호출 시점에 읽는다.
 */
function timeoutMsFromEnv(raw: string | undefined, fallbackMs: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.floor(parsed);
}

export function fcmTokenTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return timeoutMsFromEnv(env.FCM_TOKEN_HTTP_TIMEOUT_MS, DEFAULT_FCM_TOKEN_TIMEOUT_MS);
}

export function fcmSendTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return timeoutMsFromEnv(env.FCM_SEND_HTTP_TIMEOUT_MS, DEFAULT_FCM_SEND_TIMEOUT_MS);
}

@Injectable()
export class FetchPushHttpClient implements PushHttpClient {
  /** 구글 OAuth 토큰 발급(FcmTokenService) — 타임아웃 5초. */
  async postForm(url: string, form: Record<string, string>): Promise<PushHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(fcmTokenTimeoutMs())
    });
    return { status: response.status, body: await response.text() };
  }

  /** FCM v1 단건 발송(FcmSenderService) — 타임아웃 10초. */
  async postJson(url: string, body: unknown, headers: Record<string, string>): Promise<PushHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(fcmSendTimeoutMs())
    });
    return { status: response.status, body: await response.text() };
  }
}
