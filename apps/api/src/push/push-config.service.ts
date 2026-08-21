import { readFileSync } from "node:fs";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";

/**
 * PUSH-113: FCM 발송 활성 조건 판정.
 *
 * PUSH_ENABLED=1 이고 FCM_SERVICE_ACCOUNT_PATH가 "유효한" Firebase 서비스 계정
 * JSON 파일(필수 필드 project_id/client_email/private_key 존재)을 가리킬 때만
 * enabled. 그 외에는 모듈 전체가 안전한 no-op으로 동작하고, 부팅 시 1회
 * 안내 로그만 남긴다.
 *
 * 보안(DNC-019): 서비스 계정 JSON의 내용·private key는 로그/예외 메시지 어디에도
 * 싣지 않는다 — 파일 "경로"만 로그에 허용된다. resolve() 결과의 privateKey는
 * FcmTokenService의 JWT 서명에만 쓰이고 절대 직렬화/로그되지 않는다.
 */

export type ResolvedPushConfig =
  | {
      enabled: true;
      serviceAccountPath: string;
      projectId: string;
      clientEmail: string;
      /** PEM(PKCS#8) private key — 서명 용도로만 사용, 로그 금지. */
      privateKey: string;
      tokenUri: string;
    }
  | { enabled: false; reason: string };

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

@Injectable()
export class PushConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushConfigService.name);
  // 프로세스 수명 동안 env/파일이 바뀌지 않는다는 전제의 인스턴스 캐시
  // (테스트는 인스턴스를 새로 만들어 재평가한다).
  private resolved: ResolvedPushConfig | null = null;

  resolve(): ResolvedPushConfig {
    if (!this.resolved) {
      this.resolved = resolvePushConfigFromEnv();
    }
    return this.resolved;
  }

  isEnabled(): boolean {
    return this.resolve().enabled;
  }

  /** 부팅 시 1회 안내 로그 — 켜졌는지/왜 꺼져 있는지를 명확히 남긴다. */
  onApplicationBootstrap(): void {
    const config = this.resolve();
    if (config.enabled) {
      this.logger.log(`push enabled (PUSH-113): serviceAccountPath=${config.serviceAccountPath}`);
    } else {
      this.logger.log(`push disabled — 발송은 no-op (PUSH-113): ${config.reason}`);
    }
  }
}

function resolvePushConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedPushConfig {
  if (env.PUSH_ENABLED !== "1") {
    return { enabled: false, reason: "PUSH_ENABLED가 1이 아니에요 (기본 꺼짐)" };
  }

  const path = env.FCM_SERVICE_ACCOUNT_PATH?.trim();
  if (!path) {
    return { enabled: false, reason: "FCM_SERVICE_ACCOUNT_PATH가 설정되지 않았어요" };
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    // 원인 예외 메시지는 버린다 — OS 오류 문자열에 경로 밖 정보가 섞일 일은 없지만
    // "경로만 로그" 원칙을 단순하게 지킨다.
    return { enabled: false, reason: `서비스 계정 파일을 읽을 수 없어요: ${path}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON 파싱 오류 메시지는 파일 내용 일부를 인용할 수 있으므로 절대 싣지 않는다.
    return { enabled: false, reason: `서비스 계정 JSON 파싱에 실패했어요: ${path}` };
  }

  const account = parsed as {
    project_id?: unknown;
    client_email?: unknown;
    private_key?: unknown;
    token_uri?: unknown;
  };
  const projectId = typeof account.project_id === "string" ? account.project_id.trim() : "";
  const clientEmail = typeof account.client_email === "string" ? account.client_email.trim() : "";
  const privateKey = typeof account.private_key === "string" ? account.private_key : "";
  if (!projectId || !clientEmail || !privateKey) {
    return {
      enabled: false,
      reason: `서비스 계정 JSON에 필수 필드(project_id/client_email/private_key)가 없어요: ${path}`
    };
  }

  const tokenUri =
    typeof account.token_uri === "string" && account.token_uri.trim() ? account.token_uri.trim() : DEFAULT_TOKEN_URI;

  return { enabled: true, serviceAccountPath: path, projectId, clientEmail, privateKey, tokenUri };
}
