import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { CHILD_NICKNAME_MAX_LENGTH, childSchema, errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

/**
 * 라운드 107 트랙 F — 아이 태명/별명의 **길이 경계**를 고정한다.
 *
 * 금액(amount-limit.e2e.test.ts, GAP-054 #2)·지출 텍스트(text-limits.e2e.test.ts, GAP-056 #1)가
 * 이미 두 번 세운 것과 같은 모양의 마지막 잔여분이다. 이 라운드 전까지 상한은 **세 층 어디에도**
 * 없었다: 서버 DTO는 `@IsNotEmpty()`뿐, 서비스(`OnboardingCoreService`)는 존재 여부만, 모바일 폼은
 * 공백 여부만 봤다.
 *
 * 그래서 61자는 이렇게 끝났다: `children.nickname`이 varchar(60)이라 **DB에서** 터지고, Prisma가
 * P2000을 던지며, 저장소 전체에 그 코드를 400으로 옮기는 핸들러가 **0건**이라 GlobalExceptionFilter를
 * 지나 그대로 500이 됐다. 그 500이 서는 자리가 온보딩 핵심 경로(아이 만들기 · 태명 수정)라,
 * 막힌 사람은 홈에도 준비템에도 도달하지 못한 채 무엇이 왜 막혔는지 알 수 없었다 — 500 본문에는
 * 필드 사유가 실리지 않는다.
 *
 * 그래서 이 테스트가 무는 것은 두 가지다:
 *  1. 경계 자체 — 60자는 200으로 통과하고 61자는 **400**(500이 아니다), 생성·수정 양쪽에서;
 *  2. 그 400이 필드 사유를 싣고 나온다는 것(`VALIDATION_ERROR` + `maxLength` 제약).
 *
 * 숫자는 계약(`@wooriai/contracts`의 `CHILD_NICKNAME_MAX_LENGTH`)에서 읽는다 — 테스트가 숫자를
 * 따로 적으면 계약이 두 벌이 된다(text-limits e2e가 세운 규율 그대로).
 */

// 한글 한 글자 = UTF-16 코드 단위 1개다(class-validator의 @MaxLength가 보는 단위와 같다).
const nickname = (length: number) => "가".repeat(length);

type ValidationBody = {
  error: { code: string; details?: { fields?: { field: string; constraints: Record<string, string> }[] } };
};

function expectNicknameRejected(body: ValidationBody) {
  errorResponseSchema.parse(body);
  expect(body.error.code).toBe("VALIDATION_ERROR");
  const fields = body.error.details?.fields ?? [];
  const hit = fields.find((entry) => entry.field === "nickname");
  expect(hit, `nickname이 거절 사유에 없다: ${JSON.stringify(fields)}`).toBeDefined();
  expect(Object.keys(hit!.constraints)).toContain("maxLength");
}

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function acceptConsents(app: INestApplication, accessToken: string) {
  const householdId = (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body.households[0].id as string;

  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ]
    })
    .expect(200);

  return householdId;
}

describe("라운드 107 트랙 F 태명 길이 상한 (아이 생성·수정)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("상한은 컬럼 폭 그 자체다 — 계약 상수가 children.nickname varchar(60)와 같은 숫자", () => {
    // 넓어지면 다시 DB에서 터지고(P2000 → 500), 좁아지면 지금까지 저장되던 태명이 400이 된다.
    expect(CHILD_NICKNAME_MAX_LENGTH).toBe(60);
  });

  it("생성: 상한 그 자체는 200이고, 저장된 값이 잘리지 않는다", async () => {
    const accessToken = await login(app, `r107f-child-nickname-max-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);

    const created = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        householdId,
        nickname: nickname(CHILD_NICKNAME_MAX_LENGTH),
        stageMode: "manual",
        manualStage: "infant_4_6"
      })
      .expect(200);

    // 경계 값은 **온전히** 저장된다 — 조용히 잘라 넣는 경로가 없다(사용자 데이터 훼손 금지).
    expect(childSchema.parse(created.body).nickname).toHaveLength(CHILD_NICKNAME_MAX_LENGTH);
  });

  it("생성: 상한+1은 400이다 (예전에는 DB에서 터져 500이었다)", async () => {
    const accessToken = await login(app, `r107f-child-nickname-over-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);

    const response = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        householdId,
        nickname: nickname(CHILD_NICKNAME_MAX_LENGTH + 1),
        stageMode: "manual",
        manualStage: "infant_4_6"
      });

    // ⚠️ 이 라운드의 본체: 상태 코드가 5xx가 아니어야 한다.
    expect(response.status).toBe(400);
    expectNicknameRejected(response.body as ValidationBody);
  });

  it("수정: 생성과 같은 한 벌이다 — 60자는 200, 61자는 400", async () => {
    const accessToken = await login(app, `r107f-child-nickname-patch-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);
    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    const patch = (value: string) =>
      request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ nickname: value });

    const atLimit = await patch(nickname(CHILD_NICKNAME_MAX_LENGTH)).expect(200);
    expect(childSchema.parse(atLimit.body).nickname).toHaveLength(CHILD_NICKNAME_MAX_LENGTH);

    const overLimit = await patch(nickname(CHILD_NICKNAME_MAX_LENGTH + 1));
    expect(overLimit.status).toBe(400);
    expectNicknameRejected(overLimit.body as ValidationBody);

    // 거절된 요청은 저장된 값을 건드리지 않는다 — 400 뒤에도 직전 태명이 그대로다.
    const after = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.nickname).toHaveLength(CHILD_NICKNAME_MAX_LENGTH);
  });

  it("빈 태명 거절은 종전 그대로다 (길이 갈래가 그 앞 갈래를 가리지 않는다)", async () => {
    const accessToken = await login(app, `r107f-child-nickname-empty-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);

    const response = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "", stageMode: "manual", manualStage: "infant_4_6" });

    expect(response.status).toBe(400);
    const body = response.body as ValidationBody;
    errorResponseSchema.parse(body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const hit = (body.error.details?.fields ?? []).find((entry) => entry.field === "nickname");
    expect(Object.keys(hit!.constraints)).toContain("isNotEmpty");
  });
});
