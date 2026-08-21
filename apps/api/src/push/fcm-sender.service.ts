import { Inject, Injectable, Logger } from "@nestjs/common";
import { FcmTokenService } from "./fcm-token.service";
import { PushConfigService } from "./push-config.service";
import { PUSH_HTTP_CLIENT, type PushHttpClient } from "./push-http.client";

/**
 * PUSH-113: FCM HTTP v1 단건 발송.
 *
 * 계약: `sendToDevice`는 어떤 경우에도 예외를 던지지 않고 결과 객체를 반환한다 —
 * 호출부(알림 훅)는 결과의 `unregistered`만 보고 기기 비활성화를 결정하면 되고,
 * 실패가 인앱 알림/API 흐름으로 전파될 일이 없다.
 *
 * 관측성: 발송 성공/실패/무효 토큰 카운트를 인스턴스에 누적한다
 * (GET /health/push에서 숫자·불리언만 노출 — worker-status.service.ts와 같은
 * per-process in-memory 방식, 재시작 시 리셋).
 *
 * 보안: 디바이스 푸시 토큰·페이로드·access token은 로그에 싣지 않는다.
 * HTTP 상태코드와 FCM 오류 코드 문자열만 남긴다.
 */

export type PushNotificationMessage = {
  title: string;
  body: string;
  /** FCM data 페이로드 — 값은 문자열만 허용(FCM v1 계약). */
  data?: Record<string, string>;
};

export type FcmSendResult = {
  ok: boolean;
  /** push 비활성(no-op 게이트)이라 네트워크 시도 자체를 건너뛰었는지. */
  skipped: boolean;
  /** 404/410 또는 UNREGISTERED — 토큰이 더 이상 유효하지 않아 기기 비활성화 대상. */
  unregistered: boolean;
  httpStatus: number | null;
  errorCode: string | null;
};

export type PushCountersSnapshot = {
  sentOk: number;
  sendFailed: number;
  unregisteredTokens: number;
};

@Injectable()
export class FcmSenderService {
  private readonly logger = new Logger(FcmSenderService.name);
  private sentOk = 0;
  private sendFailed = 0;
  private unregisteredTokens = 0;

  constructor(
    @Inject(PushConfigService) private readonly config: PushConfigService,
    @Inject(FcmTokenService) private readonly tokens: FcmTokenService,
    @Inject(PUSH_HTTP_CLIENT) private readonly http: PushHttpClient
  ) {}

  countersSnapshot(): PushCountersSnapshot {
    return { sentOk: this.sentOk, sendFailed: this.sendFailed, unregisteredTokens: this.unregisteredTokens };
  }

  async sendToDevice(pushToken: string, notification: PushNotificationMessage): Promise<FcmSendResult> {
    const config = this.config.resolve();
    if (!config.enabled) {
      // 플래그 off / 키 미주입: 안전한 no-op (카운터도 건드리지 않는다).
      return { ok: false, skipped: true, unregistered: false, httpStatus: null, errorCode: null };
    }

    try {
      const accessToken = await this.tokens.getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`;
      const message: Record<string, unknown> = {
        token: pushToken,
        notification: { title: notification.title, body: notification.body }
      };
      if (notification.data && Object.keys(notification.data).length > 0) {
        message.data = notification.data;
      }

      const response = await this.http.postJson(url, { message }, { Authorization: `Bearer ${accessToken}` });

      if (response.status >= 200 && response.status < 300) {
        this.sentOk += 1;
        return { ok: true, skipped: false, unregistered: false, httpStatus: response.status, errorCode: null };
      }

      const errorCode = extractFcmErrorCode(response.body);
      // FCM v1은 무효 토큰을 404(UNREGISTERED)로 알린다. 요구사항대로 410도 함께
      // 무효 토큰으로 취급한다(HTTP 의미상 Gone).
      const unregistered = response.status === 404 || response.status === 410 || errorCode === "UNREGISTERED";
      if (unregistered) {
        this.unregisteredTokens += 1;
      } else {
        this.sendFailed += 1;
      }
      this.logger.warn(`FCM 발송 실패: HTTP ${response.status}, error=${errorCode ?? "(코드 없음)"}`);
      return { ok: false, skipped: false, unregistered, httpStatus: response.status, errorCode };
    } catch (error) {
      // 토큰 발급 실패/네트워크 오류 — 예외 대신 실패 결과로 변환.
      this.sendFailed += 1;
      this.logger.warn(`FCM 발송 실패(토큰/네트워크): ${error instanceof Error ? error.message : String(error)}`);
      return { ok: false, skipped: false, unregistered: false, httpStatus: null, errorCode: "SEND_ERROR" };
    }
  }
}

/**
 * FCM v1 오류 본문에서 코드 문자열만 추출한다. 우선순위:
 * error.details[].errorCode (FCM 고유 코드, 예: "UNREGISTERED") →
 * error.status (google.rpc.Code 이름, 예: "NOT_FOUND").
 */
function extractFcmErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { status?: unknown; details?: unknown } };
    const details = Array.isArray(parsed.error?.details) ? parsed.error.details : [];
    for (const detail of details) {
      const code = (detail as { errorCode?: unknown } | null)?.errorCode;
      if (typeof code === "string") {
        return code;
      }
    }
    return typeof parsed.error?.status === "string" ? parsed.error.status : null;
  } catch {
    return null;
  }
}
