import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FcmSenderService } from "../src/push/fcm-sender.service";
import { FcmTokenService, TOKEN_REFRESH_MARGIN_MS } from "../src/push/fcm-token.service";
import { PushConfigService } from "../src/push/push-config.service";
import {
  DEFAULT_FCM_SEND_TIMEOUT_MS,
  DEFAULT_FCM_TOKEN_TIMEOUT_MS,
  FetchPushHttpClient,
  fcmSendTimeoutMs,
  fcmTokenTimeoutMs,
  type PushHttpClient,
  type PushHttpResponse
} from "../src/push/push-http.client";

// PUSH-113: FCM 발송 스캐폴드 단위 테스트 — HTTP 계층(PushHttpClient)을 스텁으로
// 주입해 실제 네트워크 없이 검증한다: 플래그 게이트/no-op, 토큰 캐시·만료 5분 전
// 갱신, 발송 성공/실패/UNREGISTERED 결과(예외 없음 계약).

const TEST_PROJECT_ID = "wooriai-test-project";
const TEST_CLIENT_EMAIL = "push-test@wooriai-test-project.iam.gserviceaccount.com";
const TEST_TOKEN_URI = "https://oauth2.googleapis.com/token";
const PRIVATE_KEY_MARKER = "PRIVATE KEY";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

let scratchDir: string;
let serviceAccountPath: string;

type StubHttp = PushHttpClient & {
  formCalls: Array<{ url: string; form: Record<string, string> }>;
  jsonCalls: Array<{ url: string; body: unknown; headers: Record<string, string> }>;
  formResponse: () => Promise<PushHttpResponse> | PushHttpResponse;
  jsonResponse: () => Promise<PushHttpResponse> | PushHttpResponse;
};

function stubHttp(): StubHttp {
  const http: StubHttp = {
    formCalls: [],
    jsonCalls: [],
    formResponse: () => ({ status: 200, body: JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }) }),
    jsonResponse: () => ({ status: 200, body: JSON.stringify({ name: `projects/${TEST_PROJECT_ID}/messages/1` }) }),
    async postForm(url, form) {
      http.formCalls.push({ url, form });
      return http.formResponse();
    },
    async postJson(url, body, headers) {
      http.jsonCalls.push({ url, body, headers });
      return http.jsonResponse();
    }
  };
  return http;
}

function enablePush() {
  process.env.PUSH_ENABLED = "1";
  process.env.FCM_SERVICE_ACCOUNT_PATH = serviceAccountPath;
}

function buildServices(http: PushHttpClient) {
  const config = new PushConfigService();
  const tokens = new FcmTokenService(config, http);
  const sender = new FcmSenderService(config, tokens, http);
  return { config, tokens, sender };
}

const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "wooriai-push-test-"));
  serviceAccountPath = join(scratchDir, "service-account.json");
  writeFileSync(
    serviceAccountPath,
    JSON.stringify({
      type: "service_account",
      project_id: TEST_PROJECT_ID,
      client_email: TEST_CLIENT_EMAIL,
      private_key: privateKeyPem,
      token_uri: TEST_TOKEN_URI
    })
  );
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

beforeEach(() => {
  savedEnv.PUSH_ENABLED = process.env.PUSH_ENABLED;
  savedEnv.FCM_SERVICE_ACCOUNT_PATH = process.env.FCM_SERVICE_ACCOUNT_PATH;
  delete process.env.PUSH_ENABLED;
  delete process.env.FCM_SERVICE_ACCOUNT_PATH;
  // 실패 케이스의 warn/log 소음을 죽인다 (kakao-oidc-http-client.test.ts와 같은 접근).
  vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("PushConfigService (PUSH-113 게이트)", () => {
  it("PUSH_ENABLED가 1이 아니면 비활성", () => {
    const config = new PushConfigService().resolve();
    expect(config.enabled).toBe(false);
  });

  it("PUSH_ENABLED=1 이어도 서비스 계정 경로가 없으면 비활성", () => {
    process.env.PUSH_ENABLED = "1";
    const config = new PushConfigService().resolve();
    expect(config.enabled).toBe(false);
    expect(config.enabled ? "" : config.reason).toContain("FCM_SERVICE_ACCOUNT_PATH");
  });

  it("존재하지 않는 파일/깨진 JSON/필수 필드 누락은 비활성 — reason에는 경로만, 파일 내용·키는 절대 없음", () => {
    process.env.PUSH_ENABLED = "1";

    process.env.FCM_SERVICE_ACCOUNT_PATH = join(scratchDir, "missing.json");
    const missing = new PushConfigService().resolve();
    expect(missing.enabled).toBe(false);

    const brokenPath = join(scratchDir, "broken.json");
    writeFileSync(brokenPath, `{ not json ${PRIVATE_KEY_MARKER}`);
    process.env.FCM_SERVICE_ACCOUNT_PATH = brokenPath;
    const broken = new PushConfigService().resolve();
    expect(broken.enabled).toBe(false);
    const brokenReason = broken.enabled ? "" : broken.reason;
    expect(brokenReason).toContain(brokenPath);
    expect(brokenReason).not.toContain(PRIVATE_KEY_MARKER);

    const partialPath = join(scratchDir, "partial.json");
    writeFileSync(partialPath, JSON.stringify({ project_id: TEST_PROJECT_ID, private_key: privateKeyPem }));
    process.env.FCM_SERVICE_ACCOUNT_PATH = partialPath;
    const partial = new PushConfigService().resolve();
    expect(partial.enabled).toBe(false);
    const partialReason = partial.enabled ? "" : partial.reason;
    expect(partialReason).toContain(partialPath);
    expect(partialReason).not.toContain(PRIVATE_KEY_MARKER);
  });

  it("유효한 서비스 계정 JSON + PUSH_ENABLED=1 이면 활성 (private key는 서명용으로만 보관)", () => {
    enablePush();
    const config = new PushConfigService().resolve();
    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(config.projectId).toBe(TEST_PROJECT_ID);
      expect(config.clientEmail).toBe(TEST_CLIENT_EMAIL);
      expect(config.tokenUri).toBe(TEST_TOKEN_URI);
      expect(config.serviceAccountPath).toBe(serviceAccountPath);
    }
  });
});

describe("FcmTokenService (토큰 캐시·갱신)", () => {
  it("JWT Bearer grant로 access token을 발급받는다 — assertion은 RS256, iss/sub=client_email, aud=token_uri, FCM scope", async () => {
    enablePush();
    const http = stubHttp();
    const { tokens } = buildServices(http);

    const token = await tokens.getAccessToken(0);
    expect(token).toBe("test-access-token");
    expect(http.formCalls).toHaveLength(1);
    expect(http.formCalls[0].url).toBe(TEST_TOKEN_URI);
    expect(http.formCalls[0].form.grant_type).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

    const assertion = http.formCalls[0].form.assertion;
    expect(decodeProtectedHeader(assertion).alg).toBe("RS256");
    const claims = decodeJwt(assertion);
    expect(claims.iss).toBe(TEST_CLIENT_EMAIL);
    expect(claims.sub).toBe(TEST_CLIENT_EMAIL);
    expect(claims.aud).toBe(TEST_TOKEN_URI);
    expect(claims.scope).toBe("https://www.googleapis.com/auth/firebase.messaging");
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(3600);
  });

  it("만료 5분 전까지는 캐시를 재사용하고, 그 이후에는 갱신한다", async () => {
    enablePush();
    const http = stubHttp();
    const { tokens } = buildServices(http);
    const expiresAtMs = 3600 * 1000; // now=0에 발급, expires_in 3600s

    await tokens.getAccessToken(0);
    expect(http.formCalls).toHaveLength(1);

    // 갱신 경계 직전: 캐시 재사용.
    await tokens.getAccessToken(expiresAtMs - TOKEN_REFRESH_MARGIN_MS - 1);
    expect(http.formCalls).toHaveLength(1);

    // 갱신 경계 도달: 새 토큰 발급.
    http.formResponse = () => ({ status: 200, body: JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }) });
    const refreshed = await tokens.getAccessToken(expiresAtMs - TOKEN_REFRESH_MARGIN_MS);
    expect(refreshed).toBe("refreshed-token");
    expect(http.formCalls).toHaveLength(2);
  });

  it("동시 호출은 진행 중인 발급을 공유한다 (네트워크 요청 1회)", async () => {
    enablePush();
    const http = stubHttp();
    const { tokens } = buildServices(http);

    const [first, second] = await Promise.all([tokens.getAccessToken(0), tokens.getAccessToken(0)]);
    expect(first).toBe("test-access-token");
    expect(second).toBe("test-access-token");
    expect(http.formCalls).toHaveLength(1);
  });

  it("선제 갱신(margin 구간) 실패 시 아직 실제 만료 전인 캐시 토큰으로 폴백한다 — 경고 로그 1줄 (리뷰 m-4)", async () => {
    enablePush();
    const http = stubHttp();
    const { tokens } = buildServices(http);
    const expiresAtMs = 3600 * 1000; // now=0에 발급, expires_in 3600s

    await tokens.getAccessToken(0);
    expect(http.formCalls).toHaveLength(1);

    // margin 구간(만료 5분 전 ~ 실제 만료)에서 OAuth가 일시 장애 — 캐시 토큰은
    // 아직 실제로 유효하므로 실패를 전파하지 않고 캐시로 폴백한다.
    const warnSpy = vi.spyOn(Logger.prototype, "warn");
    http.formResponse = () => ({ status: 503, body: JSON.stringify({ error: "temporarily_unavailable" }) });
    const inMargin = expiresAtMs - TOKEN_REFRESH_MARGIN_MS + 1_000;
    await expect(tokens.getAccessToken(inMargin)).resolves.toBe("test-access-token");
    expect(http.formCalls).toHaveLength(2); // 갱신은 시도했다
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("폴백"))).toBe(true);

    // 폴백은 캐시를 연장하지 않는다 — 다음 호출은 다시 갱신을 시도해 복구된다.
    http.formResponse = () => ({ status: 200, body: JSON.stringify({ access_token: "recovered-token", expires_in: 3600 }) });
    await expect(tokens.getAccessToken(inMargin + 1)).resolves.toBe("recovered-token");
    expect(http.formCalls).toHaveLength(3);
  });

  it("캐시 토큰이 실제로 만료된 뒤의 갱신 실패는 폴백 없이 전파된다", async () => {
    enablePush();
    const http = stubHttp();
    const { tokens } = buildServices(http);
    const expiresAtMs = 3600 * 1000;

    await tokens.getAccessToken(0);
    http.formResponse = () => ({ status: 503, body: JSON.stringify({ error: "temporarily_unavailable" }) });
    await expect(tokens.getAccessToken(expiresAtMs)).rejects.toThrow(/HTTP 503/);
  });

  it("token endpoint 실패는 예외를 던지되, 메시지에 assertion/private key는 없다", async () => {
    enablePush();
    const http = stubHttp();
    http.formResponse = () => ({ status: 500, body: JSON.stringify({ error: "internal_failure" }) });
    const { tokens } = buildServices(http);

    await expect(tokens.getAccessToken(0)).rejects.toThrow(/HTTP 500/);
    await expect(tokens.getAccessToken(0)).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return !message.includes(PRIVATE_KEY_MARKER) && !message.includes("eyJ");
    });
  });
});

describe("FcmSenderService (발송 결과 — 예외 없음 계약)", () => {
  it("플래그 off면 no-op: HTTP 호출 0회, skipped 결과, 카운터 불변", async () => {
    const http = stubHttp();
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("device-token-1", { title: "t", body: "b" });
    expect(result).toEqual({ ok: false, skipped: true, unregistered: false, httpStatus: null, errorCode: null });
    expect(http.formCalls).toHaveLength(0);
    expect(http.jsonCalls).toHaveLength(0);
    expect(sender.countersSnapshot()).toEqual({ sentOk: 0, sendFailed: 0, unregisteredTokens: 0 });
  });

  it("성공: FCM v1 엔드포인트에 Bearer 토큰으로 발송하고 ok/sentOk", async () => {
    enablePush();
    const http = stubHttp();
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("device-token-1", {
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해보세요.",
      data: { type: "budget_80" }
    });

    expect(result.ok).toBe(true);
    expect(result.unregistered).toBe(false);
    expect(http.jsonCalls).toHaveLength(1);
    expect(http.jsonCalls[0].url).toBe(`https://fcm.googleapis.com/v1/projects/${TEST_PROJECT_ID}/messages:send`);
    expect(http.jsonCalls[0].headers.Authorization).toBe("Bearer test-access-token");
    expect(http.jsonCalls[0].body).toEqual({
      message: {
        token: "device-token-1",
        notification: { title: "이번 달 예산의 80%를 사용했어요", body: "남은 예산을 확인해보세요." },
        data: { type: "budget_80" }
      }
    });
    expect(sender.countersSnapshot()).toEqual({ sentOk: 1, sendFailed: 0, unregisteredTokens: 0 });
  });

  it("일반 실패(HTTP 500): 예외 없이 실패 결과 + sendFailed 카운트", async () => {
    enablePush();
    const http = stubHttp();
    http.jsonResponse = () => ({ status: 500, body: JSON.stringify({ error: { status: "INTERNAL" } }) });
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("device-token-1", { title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.unregistered).toBe(false);
    expect(result.httpStatus).toBe(500);
    expect(result.errorCode).toBe("INTERNAL");
    expect(sender.countersSnapshot()).toEqual({ sentOk: 0, sendFailed: 1, unregisteredTokens: 0 });
  });

  it("404 UNREGISTERED: unregistered=true (기기 비활성화 신호) + unregisteredTokens 카운트", async () => {
    enablePush();
    const http = stubHttp();
    http.jsonResponse = () => ({
      status: 404,
      body: JSON.stringify({
        error: {
          code: 404,
          status: "NOT_FOUND",
          details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }]
        }
      })
    });
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("stale-token", { title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.unregistered).toBe(true);
    expect(result.errorCode).toBe("UNREGISTERED");
    expect(sender.countersSnapshot()).toEqual({ sentOk: 0, sendFailed: 0, unregisteredTokens: 1 });
  });

  it("410도 무효 토큰으로 취급한다", async () => {
    enablePush();
    const http = stubHttp();
    http.jsonResponse = () => ({ status: 410, body: "" });
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("gone-token", { title: "t", body: "b" });
    expect(result.unregistered).toBe(true);
  });

  it("네트워크/토큰 발급 예외도 결과로 변환된다 (throw 없음)", async () => {
    enablePush();
    const http = stubHttp();
    http.jsonResponse = () => {
      throw new Error("socket hang up");
    };
    const { sender } = buildServices(http);

    const result = await sender.sendToDevice("device-token-1", { title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.unregistered).toBe(false);
    expect(result.errorCode).toBe("SEND_ERROR");
    expect(sender.countersSnapshot().sendFailed).toBe(1);
  });
});

// ---- RES-130: 실 HTTP 클라이언트(FetchPushHttpClient) 타임아웃 ---------------
// 위 테스트들은 PushHttpClient를 스텁으로 갈아끼워 발송 로직만 본다. 여기서는
// 실제로 전역 fetch를 쓰는 구현체가 AbortSignal.timeout을 붙이는지, 그리고
// 응답이 오지 않을 때(undici 기본 300초 대신) 끊고 기존 실패 경로로 흘러가는지를
// fetch 목으로 확인한다.

describe("RES-130 FetchPushHttpClient 타임아웃", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const savedTimeoutEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedTimeoutEnv.FCM_TOKEN_HTTP_TIMEOUT_MS = process.env.FCM_TOKEN_HTTP_TIMEOUT_MS;
    savedTimeoutEnv.FCM_SEND_HTTP_TIMEOUT_MS = process.env.FCM_SEND_HTTP_TIMEOUT_MS;
    delete process.env.FCM_TOKEN_HTTP_TIMEOUT_MS;
    delete process.env.FCM_SEND_HTTP_TIMEOUT_MS;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedTimeoutEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  /** 시그널이 abort될 때까지 응답하지 않는 서버를 흉내낸다(undici와 같은 거절 방식). */
  function neverResponds(): void {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal!;
          signal.addEventListener("abort", () => reject(signal.reason));
        })
    );
  }

  it("타임아웃 env 파싱: 미설정/비숫자/0 이하이면 기본값(토큰 5초·발송 10초)", () => {
    expect(DEFAULT_FCM_TOKEN_TIMEOUT_MS).toBe(5_000);
    expect(DEFAULT_FCM_SEND_TIMEOUT_MS).toBe(10_000);
    expect(fcmTokenTimeoutMs({})).toBe(DEFAULT_FCM_TOKEN_TIMEOUT_MS);
    expect(fcmTokenTimeoutMs({ FCM_TOKEN_HTTP_TIMEOUT_MS: "0" })).toBe(DEFAULT_FCM_TOKEN_TIMEOUT_MS);
    expect(fcmTokenTimeoutMs({ FCM_TOKEN_HTTP_TIMEOUT_MS: "abc" })).toBe(DEFAULT_FCM_TOKEN_TIMEOUT_MS);
    expect(fcmTokenTimeoutMs({ FCM_TOKEN_HTTP_TIMEOUT_MS: "2500" })).toBe(2_500);
    expect(fcmSendTimeoutMs({})).toBe(DEFAULT_FCM_SEND_TIMEOUT_MS);
    expect(fcmSendTimeoutMs({ FCM_SEND_HTTP_TIMEOUT_MS: "-5" })).toBe(DEFAULT_FCM_SEND_TIMEOUT_MS);
    expect(fcmSendTimeoutMs({ FCM_SEND_HTTP_TIMEOUT_MS: "7000" })).toBe(7_000);
  });

  it("postForm/postJson 모두 abort 시그널을 붙여 호출한다", async () => {
    // 호출마다 새 Response — 본문 스트림은 한 번만 읽을 수 있다.
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    const client = new FetchPushHttpClient();

    await client.postForm("https://oauth2.googleapis.com/token", { grant_type: "x" });
    await client.postJson("https://fcm.googleapis.com/v1/projects/p/messages:send", { message: {} }, {});

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal!.aborted).toBe(false);
    }
  });

  it("토큰 발급이 응답하지 않으면 타임아웃으로 끊고, 발송은 기존 실패 집계(SEND_ERROR)로 흘러간다", async () => {
    process.env.FCM_TOKEN_HTTP_TIMEOUT_MS = "25";
    enablePush();
    neverResponds();

    const { sender } = buildServices(new FetchPushHttpClient());
    const result = await sender.sendToDevice("device-token-1", { title: "t", body: "b" });

    expect(result).toMatchObject({ ok: false, skipped: false, unregistered: false, errorCode: "SEND_ERROR" });
    expect(sender.countersSnapshot().sendFailed).toBe(1);
  });

  it("발송(postJson)이 응답하지 않아도 타임아웃으로 끊고 실패 결과를 돌려준다 (예외 없음 계약 유지)", async () => {
    process.env.FCM_SEND_HTTP_TIMEOUT_MS = "25";
    enablePush();
    fetchMock.mockImplementation((url, init) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200 })
        );
      }
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal!;
        signal.addEventListener("abort", () => reject(signal.reason));
      });
    });

    const { sender } = buildServices(new FetchPushHttpClient());
    const result = await sender.sendToDevice("device-token-1", { title: "t", body: "b" });

    expect(result).toMatchObject({ ok: false, unregistered: false, errorCode: "SEND_ERROR" });
    expect(sender.countersSnapshot().sendFailed).toBe(1);
  });
});
