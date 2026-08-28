import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  EXPENSE_ITEM_NAME_MAX_LENGTH,
  EXPENSE_MEMO_MAX_LENGTH,
  EXPENSE_MERCHANT_MAX_LENGTH,
  errorResponseSchema
} from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

/**
 * GAP-056 #1 — 지출 텍스트 필드의 **길이 경계**를 고정한다(금액 상한 e2e의 텍스트판).
 *
 * 왜 이 테스트가 필요한가: 이 라운드에서 `expense.dto.ts`의 `@MaxLength(100)`/`@MaxLength(500)`
 * 리터럴이 `@wooriai/contracts`의 상수 참조로 바뀌었다. 값은 그대로지만(100·100·500), 상수를
 * 잘못 물리면 **상한이 조용히 넓어지거나 좁아진다** — 넓어지면 varchar(120)을 넘겨 DB에서
 * 터지고, 좁아지면 지금까지 저장되던 기록이 400으로 거절된다. 그래서 경계(상한 그 자체)는
 * 200으로 통과하고 상한+1은 400인지, 생성과 수정 **양쪽에서** 확인한다.
 *
 * 상한이 없으면 어떤 모양으로 아픈가: 모바일 오프라인 아웃박스는 로컬 저장을 먼저 성공시키고
 * flush에서야 400을 만나 실패 행으로 파킹한다(4xx는 재시도하지 않는다 —
 * apps/mobile/src/offline/remote-api.ts). 사용자에게 남는 선택지는 무익한 "다시 시도"와
 * 기록을 잃는 "버리기"뿐이다. 그래서 같은 숫자를 클라이언트도 읽을 수 있어야 하고
 * (apps/mobile/src/expenses/text-limits.ts), 그 단일 소스가 여기 import하는 상수다 —
 * 테스트가 숫자를 따로 적으면 계약이 두 벌이 된다.
 *
 * 길이 위반은 금액 상한(EXPENSE_AMOUNT_TOO_LARGE)과 달리 전용 코드가 없다: 일반
 * `VALIDATION_ERROR`이고 details.fields에 어느 필드가 걸렸는지 실려 나간다.
 */

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// 한글 한 글자 = UTF-16 코드 단위 1개다(class-validator의 @MaxLength가 보는 단위와 같다).
const text = (length: number) => "가".repeat(length);

type ValidationBody = {
  error: { code: string; details?: { fields?: { field: string; constraints: Record<string, string> }[] } };
};

function expectFieldRejected(body: ValidationBody, field: string) {
  errorResponseSchema.parse(body);
  expect(body.error.code).toBe("VALIDATION_ERROR");
  const fields = body.error.details?.fields ?? [];
  const hit = fields.find((entry) => entry.field === field);
  expect(hit, `${field}가 거절 사유에 없다: ${JSON.stringify(fields)}`).toBeDefined();
  expect(Object.keys(hit!.constraints)).toContain("maxLength");
}

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

describe("GAP-056 #1 지출 텍스트 길이 상한 (품목명·판매처·메모)", () => {
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

  it("계약 상수가 라운드 56 이전과 같은 숫자다(참조화로 값이 움직이지 않았다)", () => {
    // 이 라운드의 변경은 "리터럴 → 상수 참조"뿐이다. 값이 바뀌면 회귀다.
    expect(EXPENSE_ITEM_NAME_MAX_LENGTH).toBe(100);
    expect(EXPENSE_MERCHANT_MAX_LENGTH).toBe(100);
    expect(EXPENSE_MEMO_MAX_LENGTH).toBe(500);
  });

  it("생성: 상한 그 자체는 200, 상한+1은 400(세 필드 모두)", async () => {
    const accessToken = await login(app, `gap056-text-max-create-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);
    const base = { categoryId, amountKrw: 12_000, spentOn: "2026-07-06" };

    // --- 경계: 상한 길이는 그대로 저장된다(상한을 한 칸 좁히면 여기서 빨개진다) ---
    const created = (
      await auth(request(app.getHttpServer()).post(`/api/v1/children/${childId}/expenses`))
        .send({
          ...base,
          itemName: text(EXPENSE_ITEM_NAME_MAX_LENGTH),
          merchant: text(EXPENSE_MERCHANT_MAX_LENGTH),
          memo: text(EXPENSE_MEMO_MAX_LENGTH)
        })
        .expect(200)
    ).body as { id: string; itemName: string; merchant?: string | null; memo?: string | null };

    expect(created.itemName).toHaveLength(EXPENSE_ITEM_NAME_MAX_LENGTH);
    expect(created.merchant).toHaveLength(EXPENSE_MERCHANT_MAX_LENGTH);
    expect(created.memo).toHaveLength(EXPENSE_MEMO_MAX_LENGTH);

    // --- 상한 + 1: 필드마다 400이고, 어느 필드인지 details에 실린다 ---
    for (const [field, payload] of [
      ["itemName", { itemName: text(EXPENSE_ITEM_NAME_MAX_LENGTH + 1) }],
      ["merchant", { itemName: "판매처 초과", merchant: text(EXPENSE_MERCHANT_MAX_LENGTH + 1) }],
      ["memo", { itemName: "메모 초과", memo: text(EXPENSE_MEMO_MAX_LENGTH + 1) }]
    ] as const) {
      await auth(request(app.getHttpServer()).post(`/api/v1/children/${childId}/expenses`))
        .send({ ...base, ...payload })
        .expect(400)
        .expect(({ body }) => expectFieldRejected(body as ValidationBody, field));
    }
  });

  it("수정: 같은 상한이 PATCH에도 걸린다(생성만 막으면 수정으로 우회된다)", async () => {
    const accessToken = await login(app, `gap056-text-max-update-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);

    const created = (
      await auth(request(app.getHttpServer()).post(`/api/v1/children/${childId}/expenses`))
        .send({ categoryId, amountKrw: 12_000, spentOn: "2026-07-06", itemName: "기저귀" })
        .expect(200)
    ).body as { id: string };

    for (const [field, payload] of [
      ["itemName", { itemName: text(EXPENSE_ITEM_NAME_MAX_LENGTH + 1) }],
      ["merchant", { merchant: text(EXPENSE_MERCHANT_MAX_LENGTH + 1) }],
      ["memo", { memo: text(EXPENSE_MEMO_MAX_LENGTH + 1) }]
    ] as const) {
      await auth(request(app.getHttpServer()).patch(`/api/v1/expenses/${created.id}`))
        .send(payload)
        .expect(400)
        .expect(({ body }) => expectFieldRejected(body as ValidationBody, field));
    }

    // 거절된 뒤에도 저장된 값은 그대로다(부분 적용이 없다).
    await auth(request(app.getHttpServer()).get(`/api/v1/expenses/${created.id}`))
      .expect(200)
      .expect(({ body }) => {
        expect(body.itemName).toBe("기저귀");
      });

    // 경계값은 수정에서도 통과한다.
    await auth(request(app.getHttpServer()).patch(`/api/v1/expenses/${created.id}`))
      .send({
        itemName: text(EXPENSE_ITEM_NAME_MAX_LENGTH),
        merchant: text(EXPENSE_MERCHANT_MAX_LENGTH),
        memo: text(EXPENSE_MEMO_MAX_LENGTH)
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.itemName).toHaveLength(EXPENSE_ITEM_NAME_MAX_LENGTH);
        expect(body.merchant).toHaveLength(EXPENSE_MERCHANT_MAX_LENGTH);
        expect(body.memo).toHaveLength(EXPENSE_MEMO_MAX_LENGTH);
      });
  });
});
