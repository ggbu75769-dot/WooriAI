import { generateKeyPairSync, type KeyObject } from "node:crypto";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { Logger, UnauthorizedException } from "@nestjs/common";
import { SignJWT } from "jose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from "vitest";
import {
  DEFAULT_KAKAO_HTTP_TIMEOUT_MS,
  HttpKakaoOidcClient,
  kakaoHttpTimeoutMs
} from "../src/auth/kakao/kakao-oidc-client.http";

// COV-T4: 카카오 실 HTTP OIDC 클라이언트 단위 테스트.
//
// 외부 네트워크는 두 갈래로 나가고, 각각 다르게 가로챈다:
//   1) 토큰 엔드포인트(exchangeCode) — 전역 `fetch` 직접 호출 → vi.stubGlobal("fetch")로 가로챈다.
//   2) JWKS(verifyIdToken) — jose v5의 createRemoteJWKSet는 Node 런타임에서 전역 fetch가 아니라
//      `node:https`의 `https.get`을 쓴다(jose/dist/node/esm/runtime/fetch_jwks.js). jose의 ESM
//      빌드는 `import * as https`로 `get`을 스냅샷해 두므로 `vi.spyOn(https, "get")`은 잡히지
//      않는다. 대신 Node가 요청 시점에 살아있는 참조로 읽는 `https.globalAgent`를, 모든 연결을
//      로컬 평문 HTTP 서버로 돌리는 가짜 Agent로 바꿔치기한다. 그 서버가 로컬 생성 RSA 키쌍의
//      공개키 JWK를 응답하고, 서버 히트 수로 JWKS 재fetch 여부(캐싱)를 검증한다.
//
// 검증 계층 구분(문서화 목적):
//   - HttpKakaoOidcClient.verifyIdToken이 검증하는 것: 서명(JWKS, RS256 고정), iss, aud, exp,
//     sub 존재(requiredClaims).
//   - KakaoAuthService.exchange가 검증하는 것: nonce 해시 라운드트립(sha256(nonce) === tx.nonceHash),
//     state/redirectUri/트랜잭션 일회성. 즉 이 클라이언트는 nonce를 검증하지 않고 클레임으로
//     통과시키기만 한다 — 아래 성공 케이스에서 이를 명시적으로 확인한다.

const TEST_CLIENT_ID = "test-kakao-client-id";
const KAKAO_ISSUER = "https://kauth.kakao.com";
const KID = "test-kid-1";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// JWKS에는 없는 "다른 키" — 서명 위조 시나리오용.
const { privateKey: wrongPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function publicJwk(): Record<string, unknown> {
  return { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
}

type SignOptions = {
  key?: KeyObject;
  kid?: string;
  alg?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  subject?: string | null;
  extraClaims?: Record<string, unknown>;
};

async function signIdToken(options: SignOptions = {}): Promise<string> {
  const {
    key = privateKey,
    kid = KID,
    alg = "RS256",
    issuer = KAKAO_ISSUER,
    audience = TEST_CLIENT_ID,
    expiresIn = "10m",
    subject = "kakao-user-1234",
    extraClaims = {}
  } = options;

  let jwt = new SignJWT({ ...extraClaims })
    .setProtectedHeader({ alg, kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  if (subject !== null) {
    jwt = jwt.setSubject(subject);
  }
  return jwt.sign(key);
}

// ---- JWKS 네트워크 가로채기 ------------------------------------------------
// https.get(https://kauth.kakao.com/...)의 커넥션을 로컬 평문 HTTP 서버로 돌린다.
// (protocol 검사는 https.Agent를 상속해서 통과하고, createConnection만 평문 소켓으로 교체)

let jwksServer: http.Server;
let jwksPort = 0;
let jwksHits = 0;
let connectionAttempts = 0;
let failConnections = false;
let jwksHandler: (res: http.ServerResponse) => void = () => {
  throw new Error("이 테스트에서는 JWKS 응답이 목킹되지 않았어요.");
};

class JwksRoutingAgent extends https.Agent {
  createConnection(): net.Socket {
    connectionAttempts += 1;
    if (failConnections) {
      const socket = new net.Socket();
      setImmediate(() => socket.destroy(new Error("simulated network failure (ECONNREFUSED)")));
      return socket;
    }
    return net.connect(jwksPort, "127.0.0.1");
  }
}

const originalGlobalAgent = https.globalAgent;

function mockJwksResponse(statusCode: number, body: string): void {
  failConnections = false;
  jwksHandler = (res) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(body);
  };
}

function mockJwksSuccess(): void {
  mockJwksResponse(200, JSON.stringify({ keys: [publicJwk()] }));
}

function mockJwksNetworkFailure(): void {
  failConnections = true;
}

beforeAll(async () => {
  jwksServer = http.createServer((_req, res) => {
    jwksHits += 1;
    jwksHandler(res);
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
  const address = jwksServer.address();
  if (!address || typeof address === "string") {
    throw new Error("JWKS 목 서버 포트를 확인할 수 없어요.");
  }
  jwksPort = address.port;
  https.globalAgent = new JwksRoutingAgent({ keepAlive: false });
});

afterAll(async () => {
  https.globalAgent = originalGlobalAgent;
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error ? reject(error) : resolve()))
  );
});

// ---- 토큰 엔드포인트(fetch) 목킹 -------------------------------------------

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function expectUnauthorized(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(UnauthorizedException);
  const response = (error as UnauthorizedException).getResponse() as { code?: string };
  expect(response.code).toBe(code);
  expect((error as UnauthorizedException).getStatus()).toBe(401);
}

const originalClientId = process.env.OAUTH_KAKAO_CLIENT_ID;
const originalClientSecret = process.env.OAUTH_KAKAO_CLIENT_SECRET;
const originalHttpTimeout = process.env.KAKAO_HTTP_TIMEOUT_MS;

// FIX-KAKAO-DIAG: Nest Logger.warn 스파이 — 실패 경로가 진단 로그를 남기는지,
// 그리고 로그에 code/token/nonce 같은 자격증명 값이 새지 않는지 단언하는 데 쓴다.
let warnSpy: MockInstance;

function warnOutput(): string {
  return warnSpy.mock.calls.map((call) => call.map((arg) => String(arg)).join(" ")).join("\n");
}

beforeEach(() => {
  process.env.OAUTH_KAKAO_CLIENT_ID = TEST_CLIENT_ID;
  delete process.env.OAUTH_KAKAO_CLIENT_SECRET;
  delete process.env.KAKAO_HTTP_TIMEOUT_MS;
  fetchMock.mockReset();
  jwksHits = 0;
  connectionAttempts = 0;
  failConnections = false;
  jwksHandler = () => {
    throw new Error("이 테스트에서는 JWKS 응답이 목킹되지 않았어요.");
  };
  vi.stubGlobal("fetch", fetchMock);
  warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
});

afterAll(() => {
  if (originalClientId === undefined) {
    delete process.env.OAUTH_KAKAO_CLIENT_ID;
  } else {
    process.env.OAUTH_KAKAO_CLIENT_ID = originalClientId;
  }
  if (originalClientSecret === undefined) {
    delete process.env.OAUTH_KAKAO_CLIENT_SECRET;
  } else {
    process.env.OAUTH_KAKAO_CLIENT_SECRET = originalClientSecret;
  }
  if (originalHttpTimeout === undefined) {
    delete process.env.KAKAO_HTTP_TIMEOUT_MS;
  } else {
    process.env.KAKAO_HTTP_TIMEOUT_MS = originalHttpTimeout;
  }
});

describe("HttpKakaoOidcClient.exchangeCode", () => {
  it("kauth 토큰 엔드포인트에 올바른 form body로 POST하고 id_token을 돌려준다 (client_secret 미설정 시 생략)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id_token: "returned-id-token", access_token: "dropped" }));

    const client = new HttpKakaoOidcClient();
    const result = await client.exchangeCode({
      code: "auth-code-1",
      redirectUri: "https://app.wooriai.test/oauth/kakao",
      codeVerifier: "pkce-verifier-1"
    });

    expect(result).toEqual({ idToken: "returned-id-token" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://kauth.kakao.com/oauth/token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded;charset=utf-8"
    );

    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe(TEST_CLIENT_ID);
    expect(body.get("redirect_uri")).toBe("https://app.wooriai.test/oauth/kakao");
    expect(body.get("code")).toBe("auth-code-1");
    expect(body.get("code_verifier")).toBe("pkce-verifier-1");
    expect(body.has("client_secret")).toBe(false);
  });

  it("OAUTH_KAKAO_CLIENT_SECRET이 설정되면 client_secret을 포함하고, codeVerifier 미전달 시 code_verifier를 생략한다", async () => {
    process.env.OAUTH_KAKAO_CLIENT_SECRET = "kakao-secret";
    fetchMock.mockResolvedValue(jsonResponse(200, { id_token: "t" }));

    const client = new HttpKakaoOidcClient();
    await client.exchangeCode({ code: "c", redirectUri: "https://app.wooriai.test/cb" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_secret")).toBe("kakao-secret");
    expect(body.has("code_verifier")).toBe(false);
  });

  it("토큰 엔드포인트 400(invalid_grant)을 OAUTH_CODE_EXCHANGE_FAILED 401로 매핑한다", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: "invalid_grant", error_description: "authorization code not found" })
    );

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(
      client.exchangeCode({ code: "used-code", redirectUri: "https://app.wooriai.test/cb" }),
      "OAUTH_CODE_EXCHANGE_FAILED"
    );
  });

  it("토큰 엔드포인트 네트워크 실패(fetch reject)를 OAUTH_CODE_EXCHANGE_FAILED로 매핑한다", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(
      client.exchangeCode({ code: "c", redirectUri: "https://app.wooriai.test/cb" }),
      "OAUTH_CODE_EXCHANGE_FAILED"
    );
  });

  it("200이지만 id_token이 없는 응답을 OAUTH_CODE_EXCHANGE_FAILED로 매핑한다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "only-access-token" }));

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(
      client.exchangeCode({ code: "c", redirectUri: "https://app.wooriai.test/cb" }),
      "OAUTH_CODE_EXCHANGE_FAILED"
    );
  });

  it("200이지만 JSON이 아닌 본문도 OAUTH_CODE_EXCHANGE_FAILED로 매핑한다", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway error</html>", { status: 200 }));

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(
      client.exchangeCode({ code: "c", redirectUri: "https://app.wooriai.test/cb" }),
      "OAUTH_CODE_EXCHANGE_FAILED"
    );
  });
});

// ---- RES-130: 코드↔토큰 교환 타임아웃 -------------------------------------
// 맨 fetch는 undici 기본값(300초)을 물려받아, 카카오가 응답을 멈추면 로그인
// 요청 하나가 5분간 매달린다. AbortSignal.timeout으로 끊고 기존 "네트워크 계층
// 실패" 경로(401 OAUTH_CODE_EXCHANGE_FAILED)로 보내는지 확인한다.

describe("RES-130 exchangeCode 타임아웃", () => {
  it("KAKAO_HTTP_TIMEOUT_MS 파싱: 미설정/비숫자/0 이하이면 기본값 5초, 유효하면 그 값", () => {
    expect(DEFAULT_KAKAO_HTTP_TIMEOUT_MS).toBe(5_000);
    expect(kakaoHttpTimeoutMs({})).toBe(DEFAULT_KAKAO_HTTP_TIMEOUT_MS);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "" })).toBe(DEFAULT_KAKAO_HTTP_TIMEOUT_MS);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "abc" })).toBe(DEFAULT_KAKAO_HTTP_TIMEOUT_MS);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "0" })).toBe(DEFAULT_KAKAO_HTTP_TIMEOUT_MS);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "-1" })).toBe(DEFAULT_KAKAO_HTTP_TIMEOUT_MS);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "1500" })).toBe(1_500);
    expect(kakaoHttpTimeoutMs({ KAKAO_HTTP_TIMEOUT_MS: "1500.9" })).toBe(1_500);
  });

  it("토큰 엔드포인트에 abort 시그널을 붙여 호출한다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id_token: "t" }));

    const client = new HttpKakaoOidcClient();
    await client.exchangeCode({ code: "c", redirectUri: "https://app.wooriai.test/cb" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal!.aborted).toBe(false);
  });

  it("응답이 오지 않으면 타임아웃으로 끊고 401 OAUTH_CODE_EXCHANGE_FAILED로 매핑한다 (매달리지 않는다)", async () => {
    process.env.KAKAO_HTTP_TIMEOUT_MS = "25";
    // 실제 undici처럼: 시그널이 abort될 때까지 응답하지 않는 서버를 흉내낸다.
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal!;
          signal.addEventListener("abort", () => reject(signal.reason));
        })
    );

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(
      client.exchangeCode({ code: "secret-timeout-code", redirectUri: "https://app.wooriai.test/cb" }),
      "OAUTH_CODE_EXCHANGE_FAILED"
    );

    // 진단 로그는 기존 네트워크 실패 경로 그대로 — 인가 코드는 남기지 않는다.
    const output = warnOutput();
    expect(output).toContain("네트워크");
    expect(output).not.toContain("secret-timeout-code");
  });
});

describe("HttpKakaoOidcClient.verifyIdToken", () => {
  it("JWKS 키로 서명된 유효한 RS256 토큰의 클레임을 돌려준다 (nonce는 검증 없이 통과 — 서비스 계층 몫)", async () => {
    mockJwksSuccess();
    const idToken = await signIdToken({
      extraClaims: { nonce: "raw-nonce-value", email: "user@example.com", nickname: "우리아이" }
    });

    const client = new HttpKakaoOidcClient();
    const claims = await client.verifyIdToken(idToken);

    expect(claims.sub).toBe("kakao-user-1234");
    expect(claims.iss).toBe(KAKAO_ISSUER);
    expect(claims.aud).toBe(TEST_CLIENT_ID);
    expect(typeof claims.exp).toBe("number");
    expect(typeof claims.iat).toBe("number");
    // nonce/email/nickname은 이 계층에서 검증 대상이 아니고 그대로 전달된다.
    expect(claims.nonce).toBe("raw-nonce-value");
    expect(claims.email).toBe("user@example.com");
    expect(claims.nickname).toBe("우리아이");
    expect(jwksHits).toBe(1);
  });

  it("다른 키로 서명된(서명 위조) 토큰을 OAUTH_ID_TOKEN_INVALID로 거부한다", async () => {
    mockJwksSuccess();
    const forged = await signIdToken({ key: wrongPrivateKey }); // 같은 kid, 다른 키

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(forged), "OAUTH_ID_TOKEN_INVALID");
  });

  it("만료된 토큰을 OAUTH_ID_TOKEN_INVALID로 거부한다", async () => {
    mockJwksSuccess();
    const expired = await signIdToken({ expiresIn: "-5m" });

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(expired), "OAUTH_ID_TOKEN_INVALID");
  });

  it("발급자(iss)가 kauth.kakao.com이 아니면 거부한다", async () => {
    mockJwksSuccess();
    const wrongIssuer = await signIdToken({ issuer: "https://evil.example.com" });

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(wrongIssuer), "OAUTH_ID_TOKEN_INVALID");
  });

  it("대상(aud)이 우리 client_id가 아니면 거부한다", async () => {
    mockJwksSuccess();
    const wrongAudience = await signIdToken({ audience: "someone-elses-app" });

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(wrongAudience), "OAUTH_ID_TOKEN_INVALID");
  });

  it("RS256 외 알고리즘(RS512)으로 서명된 토큰을 거부한다 — alg 고정(alg confusion 방어)", async () => {
    mockJwksSuccess();
    const rs512 = await signIdToken({ alg: "RS512" });

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(rs512), "OAUTH_ID_TOKEN_INVALID");
  });

  it("sub 클레임이 없는 토큰을 거부한다 (requiredClaims)", async () => {
    mockJwksSuccess();
    const noSub = await signIdToken({ subject: null });

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(noSub), "OAUTH_ID_TOKEN_INVALID");
  });

  it("JWT 형식이 아닌 문자열은 JWKS 요청 없이 즉시 거부한다", async () => {
    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken("not-a-jwt-at-all"), "OAUTH_ID_TOKEN_INVALID");
    expect(connectionAttempts).toBe(0);
  });

  it("JWKS 네트워크 실패(커넥션 오류)를 OAUTH_ID_TOKEN_INVALID(401)로 매핑한다", async () => {
    mockJwksNetworkFailure();
    const idToken = await signIdToken();

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(idToken), "OAUTH_ID_TOKEN_INVALID");
    expect(connectionAttempts).toBeGreaterThanOrEqual(1);
    expect(jwksHits).toBe(0);
  });

  it("JWKS 비-200 응답도 OAUTH_ID_TOKEN_INVALID로 매핑한다", async () => {
    mockJwksResponse(503, JSON.stringify({ error: "unavailable" }));
    const idToken = await signIdToken();

    const client = new HttpKakaoOidcClient();
    await expectUnauthorized(client.verifyIdToken(idToken), "OAUTH_ID_TOKEN_INVALID");
    expect(jwksHits).toBe(1);
  });

  it("JWKS를 캐시한다 — 같은 인스턴스의 두 번째 검증은 JWKS를 다시 가져오지 않는다", async () => {
    mockJwksSuccess();
    const client = new HttpKakaoOidcClient();

    await client.verifyIdToken(await signIdToken());
    expect(jwksHits).toBe(1);

    const second = await client.verifyIdToken(await signIdToken({ subject: "kakao-user-5678" }));
    expect(second.sub).toBe("kakao-user-5678");
    expect(jwksHits).toBe(1); // 재fetch 없음
  });

  it("알 수 없는 kid는 cooldown(30초) 안에서는 재fetch 없이 거부된다", async () => {
    mockJwksSuccess();
    const client = new HttpKakaoOidcClient();

    // 첫 fetch를 발생시키는 정상 검증.
    await client.verifyIdToken(await signIdToken());
    expect(jwksHits).toBe(1);

    // JWKS에 없는 kid로 서명된(위조) 토큰 — 방금 fetch했으므로 cooldown이 재fetch를 막는다.
    const unknownKid = await signIdToken({ key: wrongPrivateKey, kid: "unknown-kid" });
    await expectUnauthorized(client.verifyIdToken(unknownKid), "OAUTH_ID_TOKEN_INVALID");
    expect(jwksHits).toBe(1);
  });
});

// ---- FIX-KAKAO-DIAG: 실패 경로 관측성 로그 ---------------------------------
// 외부 계약(401 + 기존 code/메시지)은 위 테스트들이 계속 보증하고, 여기서는
// (a) 각 실패 경로가 원인 진단이 가능한 warn 로그를 남기는지,
// (b) 로그에 인가 코드/토큰/nonce 값이 절대 포함되지 않는지를 단언한다.

describe("FIX-KAKAO-DIAG 관측성 로그", () => {
  function expectNoSensitiveValues(output: string, sensitive: string[]): void {
    for (const value of sensitive) {
      expect(output).not.toContain(value);
    }
  }

  describe("exchangeCode", () => {
    it("400(invalid_grant) 실패 시 HTTP status와 카카오 error/error_description을 warn으로 남기고, code 값은 남기지 않는다", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, { error: "invalid_grant", error_description: "authorization code not found" })
      );

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(
        client.exchangeCode({
          code: "super-secret-auth-code",
          redirectUri: "https://app.wooriai.test/cb",
          codeVerifier: "secret-pkce-verifier"
        }),
        "OAUTH_CODE_EXCHANGE_FAILED"
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("HTTP 400");
      expect(output).toContain("invalid_grant");
      expect(output).toContain("authorization code not found");
      expectNoSensitiveValues(output, ["super-secret-auth-code", "secret-pkce-verifier"]);
    });

    it("401(invalid_client) 실패도 error 코드가 로그에 남아 invalid_grant와 구분된다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "invalid_client" }));

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(
        client.exchangeCode({ code: "secret-code-2", redirectUri: "https://app.wooriai.test/cb" }),
        "OAUTH_CODE_EXCHANGE_FAILED"
      );

      const output = warnOutput();
      expect(output).toContain("HTTP 401");
      expect(output).toContain("invalid_client");
      expectNoSensitiveValues(output, ["secret-code-2"]);
    });

    it("네트워크 실패 시 오류 message만 warn으로 남긴다", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(
        client.exchangeCode({ code: "secret-code-3", redirectUri: "https://app.wooriai.test/cb" }),
        "OAUTH_CODE_EXCHANGE_FAILED"
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("네트워크");
      expect(output).toContain("fetch failed");
      expectNoSensitiveValues(output, ["secret-code-3"]);
    });

    it("200이지만 id_token이 없으면 그 사실을 warn으로 남기고, 응답의 다른 토큰 값은 남기지 않는다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "leaked-access-token" }));

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(
        client.exchangeCode({ code: "secret-code-4", redirectUri: "https://app.wooriai.test/cb" }),
        "OAUTH_CODE_EXCHANGE_FAILED"
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("id_token 없음");
      expectNoSensitiveValues(output, ["secret-code-4", "leaked-access-token"]);
    });
  });

  describe("verifyIdToken", () => {
    it("서명 위조 실패를 '토큰 검증 실패'와 jose 코드로 남기고, 토큰 원문/nonce 값은 남기지 않는다", async () => {
      mockJwksSuccess();
      const forged = await signIdToken({
        key: wrongPrivateKey,
        extraClaims: { nonce: "secret-raw-nonce" }
      });

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(client.verifyIdToken(forged), "OAUTH_ID_TOKEN_INVALID");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("토큰 검증 실패");
      expect(output).toContain("ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
      expectNoSensitiveValues(output, [forged, ...forged.split("."), "secret-raw-nonce"]);
    });

    it("만료 토큰 실패는 ERR_JWT_EXPIRED로 남는다", async () => {
      mockJwksSuccess();
      const expired = await signIdToken({ expiresIn: "-5m" });

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(client.verifyIdToken(expired), "OAUTH_ID_TOKEN_INVALID");

      const output = warnOutput();
      expect(output).toContain("토큰 검증 실패");
      expect(output).toContain("ERR_JWT_EXPIRED");
      expectNoSensitiveValues(output, [expired, ...expired.split(".")]);
    });

    it("알 수 없는 kid(위조 추정)는 ERR_JWKS_NO_MATCHING_KEY로 '토큰 검증 실패' 쪽에 남는다", async () => {
      mockJwksSuccess();
      const unknownKid = await signIdToken({ key: wrongPrivateKey, kid: "unknown-kid" });

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(client.verifyIdToken(unknownKid), "OAUTH_ID_TOKEN_INVALID");

      const output = warnOutput();
      expect(output).toContain("토큰 검증 실패");
      expect(output).toContain("ERR_JWKS_NO_MATCHING_KEY");
      expectNoSensitiveValues(output, [unknownKid, ...unknownKid.split(".")]);
    });

    it("JWKS 네트워크 실패는 'JWKS 페치 실패'로 구분되어 남는다 (카카오 장애 vs 위조 토큰 구분)", async () => {
      mockJwksNetworkFailure();
      const idToken = await signIdToken({ extraClaims: { nonce: "secret-raw-nonce" } });

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(client.verifyIdToken(idToken), "OAUTH_ID_TOKEN_INVALID");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("JWKS 페치 실패(네트워크 추정)");
      // 소켓 destroy 타이밍에 따라 주입한 오류 또는 Node의 소켓 종료 메시지가 남는다.
      expect(output).toMatch(/simulated network failure|Socket is closed/);
      expectNoSensitiveValues(output, [idToken, ...idToken.split("."), "secret-raw-nonce"]);
    });

    it("JWKS 비-200 응답도 'JWKS 페치 실패'로 남는다", async () => {
      mockJwksResponse(503, JSON.stringify({ error: "unavailable" }));
      const idToken = await signIdToken();

      const client = new HttpKakaoOidcClient();
      await expectUnauthorized(client.verifyIdToken(idToken), "OAUTH_ID_TOKEN_INVALID");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const output = warnOutput();
      expect(output).toContain("JWKS 페치 실패");
      expect(output).toContain("Expected 200 OK");
      expectNoSensitiveValues(output, [idToken, ...idToken.split(".")]);
    });

    it("성공 검증에서는 warn 로그를 남기지 않는다", async () => {
      mockJwksSuccess();
      const client = new HttpKakaoOidcClient();
      await client.verifyIdToken(await signIdToken());
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
