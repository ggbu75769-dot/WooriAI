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

@Injectable()
export class FetchPushHttpClient implements PushHttpClient {
  async postForm(url: string, form: Record<string, string>): Promise<PushHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(form).toString()
    });
    return { status: response.status, body: await response.text() };
  }

  async postJson(url: string, body: unknown, headers: Record<string, string>): Promise<PushHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.text() };
  }
}
