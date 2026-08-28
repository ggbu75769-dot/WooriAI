import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { MONEY_KRW_MAX, errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

/**
 * GAP-054 #2 — 금액 상한(int4)이 **400으로** 거절되는지 고정한다.
 *
 * 왜 400이어야 하나: `expenses.amount_krw` · `budgets.amount_krw`는 Postgres int4다. DTO에
 * 상한이 없던 동안 초과 값은 검증이 아니라 **DB에서** 터져 500으로 나갔고, 모바일 오프라인
 * 아웃박스는 4xx만 실패 행으로 파킹하고 5xx는 재시도하므로 한 번 들어간 초과 금액이 영원히
 * 재전송되는 poison 행이 됐다(docs/5차/budget-app-gap-analysis.md P0-2,
 * apps/mobile/src/offline/remote-api.ts). 400이면 그 루프가 성립하지 않는다.
 *
 * 상한 값 자체는 `@wooriai/contracts`의 `MONEY_KRW_MAX`를 그대로 읽는다 — 테스트가 숫자를
 * 따로 적으면 계약이 두 벌이 된다. 마이그레이션은 없다(컬럼이 이미 갖고 있던 한계다).
 */

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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

  const childId = (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200)
  ).body.id as string;

  return { childId, householdId };
}

describe("GAP-054 #2 금액 상한 (지출·예산)", () => {
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

  it("상한을 넘긴 지출 생성·수정과 예산 저장을 400으로 거절하고, 상한 그 자체는 받아들인다", async () => {
    const accessToken = await login(app, `gap054-amount-max-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);

    // --- 생성: 상한 + 1 → 400 VALIDATION_ERROR (DB 오류 500이 아니다) ---
    await auth(request(app.getHttpServer()).post(`/api/v1/children/${childId}/expenses`))
      .send({
        categoryId,
        amountKrw: MONEY_KRW_MAX + 1,
        spentOn: "2026-07-06",
        itemName: "상한 초과"
      })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    // --- 생성: 경계값(상한 그 자체)은 통과한다 — 상한을 한 칸 좁히면 여기서 빨개진다 ---
    const created = (
      await auth(request(app.getHttpServer()).post(`/api/v1/children/${childId}/expenses`))
        .send({
          categoryId,
          amountKrw: MONEY_KRW_MAX,
          spentOn: "2026-07-06",
          itemName: "상한 경계"
        })
        .expect(200)
    ).body as { id: string; amountKrw: number };
    expect(created.amountKrw).toBe(MONEY_KRW_MAX);

    // --- 수정: 같은 상한이 PATCH에도 걸린다(생성만 막으면 수정으로 우회된다) ---
    await auth(request(app.getHttpServer()).patch(`/api/v1/expenses/${created.id}`))
      .send({ amountKrw: MONEY_KRW_MAX + 1 })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    // 거절된 뒤에도 저장된 값은 그대로다(부분 적용이 없다).
    await auth(request(app.getHttpServer()).get(`/api/v1/expenses/${created.id}`))
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(MONEY_KRW_MAX);
      });

    // --- 예산 upsert: 지출과 같은 상한 ---
    await auth(request(app.getHttpServer()).put(`/api/v1/children/${childId}/budget`))
      .send({ yearMonth: "2026-07-01", amountKrw: MONEY_KRW_MAX + 1 })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    await auth(request(app.getHttpServer()).put(`/api/v1/children/${childId}/budget`))
      .send({ yearMonth: "2026-07-01", amountKrw: MONEY_KRW_MAX })
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(MONEY_KRW_MAX);
      });
  });
});
