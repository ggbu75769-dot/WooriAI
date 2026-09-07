import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * `Idempotency-Key` 헤더의 **길이 경계**를 고정한다.
 *
 * 배경(두 시점): 종전에 `IdempotencyInterceptor`는 `endpoint`만 `.slice(0, 120)`하고
 * 헤더 값(`idemKey`)은 **원문 그대로** INSERT했다(그때는 우리 클라이언트가 만드는 키가
 * uuid(36자)·`onb-child-…`(~30자)뿐이라 문제가 드러나지 않았다 —
 * apps/admin/src/lib/admin-api.ts의 newIdempotencyKey,
 * apps/mobile/src/stores/onboarding-progress.store.ts,
 * apps/mobile/src/offline/types.ts의 generateOfflineId). 그런데 값은 요청 헤더라
 * 우리가 만든 것만 도착하지는 않는다: 121자를 보내면 `idempotency_keys.idem_key`가
 * varchar(120)이라 Prisma가 P2000을 던지고, 저장소 전체에 그 코드를 400으로 옮기는
 * 핸들러가 0건이라 GlobalExceptionFilter를 지나 그대로 **500**이 됐다(실측).
 * 이 인터셉터는 `POST /children`·`POST /expenses`·`PATCH /expenses/:id`·
 * `PUT /budgets`·`POST /imports/:id/confirm`·`POST /custom-categories`에 걸려 있어
 * 앱의 **모든 멱등 쓰기 경로**가 같은 모양이었다.
 *
 * 이 스위트가 무는 것은 세 가지다:
 *  1. 경계 자체 — 120자는 통과하고 **값이 온전히 저장**되며(잘라 넣는 경로가 없다),
 *     121자는 **400**이다(500이 아니다), 두 개 이상의 라우트에서;
 *  2. 그 400이 저장소의 기존 형식(`VALIDATION_ERROR` + `details.fields`)을 쓰고,
 *     거절된 요청은 **부수효과를 남기지 않는다**(아이가 만들어지지 않는다);
 *  3. 자르기를 고르지 않은 이유의 회귀 방지 — 앞 120자가 **같고** 뒤가 다른 두 키는
 *     둘 다 400이다. 조용히 잘랐다면 둘째 요청이 첫 요청의 응답을 재생받아
 *     "기록했다"는 응답만 받고 아무것도 기록되지 않았을 것이다.
 *
 * 숫자(120)는 리터럴로 적는다 — 검사 대상 코드의 상수를 import해 기대값을 만들면
 * 상한이 어느 쪽으로 움직여도 테스트가 따라 움직여 아무것도 붙잡지 못한다.
 */
const MAX = 120;

type ValidationBody = {
  error: { code: string; details?: { fields?: { field: string; constraints: Record<string, string> }[] } };
};

function expectHeaderRejected(body: ValidationBody) {
  errorResponseSchema.parse(body);
  expect(body.error.code).toBe("VALIDATION_ERROR");
  const fields = body.error.details?.fields ?? [];
  const hit = fields.find((entry) => entry.field === "Idempotency-Key");
  expect(hit, `Idempotency-Key가 거절 사유에 없다: ${JSON.stringify(fields)}`).toBeDefined();
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

describe("Idempotency-Key 길이 상한 (멱등 쓰기 경로 공통)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("상한 그 자체(120자)는 통과하고, 키가 잘리지 않은 채 저장된다", async () => {
    const accessToken = await login(app, `idem-max-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);
    // 이 스위트가 만든 키만 조회하도록 접두사에 uuid를 넣는다(다른 스위트와 병렬 실행).
    const key = `${randomUUID()}-`.padEnd(MAX, "k").slice(0, MAX);
    expect(key).toHaveLength(MAX);

    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200);

    const row = await prisma.idempotencyKey.findFirst({ where: { idemKey: key } });
    expect(row, "120자 키가 저장되지 않았다").not.toBeNull();
    // 값이 **온전히** 저장된다 — 조용히 잘라 넣는 경로가 없다.
    expect(row!.idemKey).toBe(key);
    expect(row!.idemKey).toHaveLength(MAX);
  });

  it("상한+1(121자)은 400이고, 아이는 만들어지지 않는다 (예전에는 DB에서 터져 500이었다)", async () => {
    const accessToken = await login(app, `idem-over-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);
    const key = "z".repeat(MAX + 1);

    const response = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send({ householdId, nickname: "거절될아이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(400);
    expectHeaderRejected(response.body as ValidationBody);

    // 거절은 핸들러보다 앞이다 — 부수효과가 없다.
    const children = await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect((children.body.children as { nickname: string }[]).map((child) => child.nickname)).toEqual([]);
  });

  it("지출 생성(다른 라우트)도 같은 경계를 갖는다 — 판정이 인터셉터에 있다", async () => {
    const accessToken = await login(app, `idem-expense-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);
    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    const body = {
      categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amountKrw: 12000,
      spentOn: "2026-07-06",
      itemName: "분유"
    };

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", `${randomUUID()}-`.padEnd(MAX, "e").slice(0, MAX))
      .send(body)
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "e".repeat(MAX + 1))
      .send({ ...body, itemName: "거절될 지출" })
      .expect(400);
    expectHeaderRejected(rejected.body as ValidationBody);
  });

  it("앞 120자가 같고 뒤가 다른 두 키는 둘 다 400이다 (자르면 둘째가 첫째의 응답을 재생받는다)", async () => {
    const accessToken = await login(app, `idem-collision-${randomUUID()}`);
    const householdId = await acceptConsents(app, accessToken);
    const shared = "c".repeat(MAX);
    const first = `${shared}1`;
    const second = `${shared}2`;
    expect(first.slice(0, MAX)).toBe(second.slice(0, MAX));

    for (const [key, nickname] of [
      [first, "첫째"],
      [second, "둘째"]
    ] as const) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", key)
        .send({ householdId, nickname, stageMode: "manual", manualStage: "infant_4_6" })
        .expect(400);
      expectHeaderRejected(response.body as ValidationBody);
    }

    // 조용히 잘랐다면 둘째는 200 + 첫째의 응답(닉네임 "첫째")을 돌려받고, 아이는 하나만
    // 만들어졌을 것이다. 지금은 둘 다 거절이라 하나도 만들어지지 않는다.
    const children = await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect((children.body.children as { nickname: string }[]).map((child) => child.nickname)).toEqual([]);
  });
});
