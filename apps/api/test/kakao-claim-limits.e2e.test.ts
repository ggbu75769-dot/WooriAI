import { UnauthorizedException, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type KeyLike } from "jose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { KAKAO_OIDC_CLIENT } from "../src/auth/kakao/kakao-oidc-client";
import type {
  KakaoCodeExchangeInput,
  KakaoCodeExchangeResult,
  KakaoIdTokenClaims,
  KakaoOidcClient
} from "../src/auth/kakao/kakao-oidc-client";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 카카오 ID 토큰 클레임이 `users` 행으로 옮겨질 때의 **길이 경계**를 고정한다.
 *
 * 배경(두 시점): 종전에 `KakaoAuthService.exchange`는 `claims.nickname`·`claims.email`을
 * **그대로** `findOrCreateProviderUser`에 넘겼다(그때는 참이었다 — 카카오가 주는 값은
 * 짧았고, `providerUserId`만 `.slice(0, 191)`로 막혀 있었다). 그래서 81자 닉네임은
 * `users.display_name` varchar(80)에서, 321자 이메일은 `users.email` varchar(320)에서
 * Prisma P2000으로 터졌고, 그 코드를 400으로 옮기는 핸들러가 저장소 전체에 0건이라
 * 그대로 **500**이 됐다(실측: 두 경우 모두 `POST /auth/kakao/exchange` 500).
 *
 * 이 값들은 **사용자가 고칠 수 없는 외부 IdP 값**이라 거절이 답이 아니다 — 400을 내면
 * 그 사람은 앱에 들어올 방법 자체가 없다. 그래서:
 *  - `display_name`은 80자로 **자른다**(로그인은 성공, 이름만 짧아진다);
 *  - `email`은 자르지 않고 **null**로 떨어뜨린다 — 잘린 주소는 "그럴듯하지만 틀린 값"이라
 *    운영자 CS 조회 화면이 그걸 사용자의 이메일로 보여 주면 다른 사람에게 연락하게 된다.
 *
 * 숫자(80·320)는 리터럴로 적는다 — 검사 대상 코드의 상수를 import해 기대값을 만들면
 * 상한이 어느 쪽으로 움직여도 테스트가 따라 움직인다.
 */
const DISPLAY_NAME_MAX = 80;
const EMAIL_MAX = 320;

const KAKAO_ISSUER = "https://kauth.kakao.com";
const CLIENT_ID = "test-kakao-client-id";
const ALLOWED_REDIRECT_URI = "https://app.wooriai.test/oauth/kakao";

/** 길이 L짜리 이메일 모양 문자열. 로컬파트만 늘려 `@` 뒤는 그대로 둔다. */
function emailOfLength(length: number): string {
  const domain = "@example.com";
  return `${"a".repeat(length - domain.length)}${domain}`;
}

/**
 * auth-kakao-oidc.e2e.test.ts의 테스트 더블과 같은 모양 — `exchangeCode`는 큐에 넣어 둔
 * id_token을 돌려주고, `verifyIdToken`은 실제 구현과 같은 jose 검증을 로컬 키쌍으로 한다.
 */
class TestKakaoOidcClient implements KakaoOidcClient {
  nextIdToken: string | null = null;

  constructor(private readonly verificationKey: KeyLike) {}

  async exchangeCode(_input: KakaoCodeExchangeInput): Promise<KakaoCodeExchangeResult> {
    if (!this.nextIdToken) {
      throw new Error("test setup error: nextIdToken was not queued before exchangeCode() was called");
    }
    return { idToken: this.nextIdToken };
  }

  async verifyIdToken(idToken: string): Promise<KakaoIdTokenClaims> {
    try {
      const { payload } = await jwtVerify(idToken, this.verificationKey, {
        issuer: KAKAO_ISSUER,
        audience: CLIENT_ID
      });
      return payload as KakaoIdTokenClaims;
    } catch {
      throw new UnauthorizedException({
        code: "OAUTH_ID_TOKEN_INVALID",
        message: "카카오 인증 정보를 확인할 수 없어요."
      });
    }
  }
}

async function signIdToken(signingKey: KeyLike, claims: { nonce: string; nickname?: string; email?: string }) {
  const sub = `kakao-sub-${randomUUID()}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ nonce: claims.nonce, email: claims.email, nickname: claims.nickname })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(KAKAO_ISSUER)
    .setAudience(CLIENT_ID)
    .setSubject(sub)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 600)
    .sign(signingKey);
  return { token, sub };
}

describe("카카오 클레임 길이 경계 (display_name · email)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let kakaoClient: TestKakaoOidcClient;
  let signingKey: KeyLike;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.OAUTH_KAKAO_CLIENT_ID = CLIENT_ID;
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;

    const pair = await generateKeyPair("RS256");
    signingKey = pair.privateKey;
    const publicJwk: JWK = await exportJWK(pair.publicKey);
    const verificationKey = await importJWK({ ...publicJwk, alg: "RS256" }, "RS256");
    kakaoClient = new TestKakaoOidcClient(verificationKey as KeyLike);

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KAKAO_OIDC_CLIENT)
      .useValue(kakaoClient)
      .compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function prepare() {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/prepare")
      .send({ redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);
    return response.body as { transactionId: string; state: string; nonce: string };
  }

  /** prepare → exchange 한 번. 응답 상태와, 만들어진 users 행을 함께 돌려준다. */
  async function exchangeWith(claims: { nickname?: string; email?: string }) {
    const { transactionId, state, nonce } = await prepare();
    const { token, sub } = await signIdToken(signingKey, { nonce, ...claims });
    kakaoClient.nextIdToken = token;

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: `code-${randomUUID()}`, redirectUri: ALLOWED_REDIRECT_URI });

    const row = await prisma.user.findFirst({ where: { authProvider: "kakao", providerUserId: sub } });
    return { status: response.status, body: response.body, row };
  }

  it("경계 그 자체(닉네임 80자·이메일 320자)는 로그인이 되고, 값이 온전히 저장된다", async () => {
    const nickname = "가".repeat(DISPLAY_NAME_MAX);
    const email = emailOfLength(EMAIL_MAX);
    expect(email).toHaveLength(EMAIL_MAX);

    const { status, row } = await exchangeWith({ nickname, email });

    expect(status).toBe(200);
    // 경계 값은 **잘리지 않는다** — 클램프가 한 칸 좁아지면 여기서 빨개진다.
    expect(row!.displayName).toBe(nickname);
    expect(row!.email).toBe(email);
  });

  it("닉네임 81자는 로그인이 되고(500이 아니다), 이름만 80자로 잘려 저장된다", async () => {
    const nickname = "가".repeat(DISPLAY_NAME_MAX + 1);

    const { status, row } = await exchangeWith({ nickname, email: "parent@example.com" });

    // 예전에는 users.display_name varchar(80)에서 P2000 → 500이라 로그인 자체가 막혔다.
    expect(status).toBe(200);
    expect(row!.displayName).toHaveLength(DISPLAY_NAME_MAX);
    expect(row!.displayName).toBe("가".repeat(DISPLAY_NAME_MAX));
    // 이메일은 짧으므로 그대로 남는다(클램프가 엉뚱한 필드를 건드리지 않는다).
    expect(row!.email).toBe("parent@example.com");
  });

  it("이메일 321자는 로그인이 되고(500이 아니다), 잘린 주소 대신 null이 저장된다", async () => {
    const email = emailOfLength(EMAIL_MAX + 1);
    expect(email).toHaveLength(EMAIL_MAX + 1);

    const { status, row } = await exchangeWith({ nickname: "테스트부모", email });

    // 예전에는 users.email varchar(320)에서 P2000 → 500이었다.
    expect(status).toBe(200);
    // 자르지 않는다: "그럴듯하지만 틀린 주소"를 CS 화면에 보여 주지 않기 위해서다.
    expect(row!.email).toBeNull();
    expect(row!.displayName).toBe("테스트부모");
  });
});
