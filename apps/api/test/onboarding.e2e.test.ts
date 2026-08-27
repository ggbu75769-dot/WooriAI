import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { childSchema, errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

// Round 4: dev-login persists a real users/households row per providerToken, and
// this helper is called from two separate `it` blocks in this file plus reused
// across test runs against the same persistent database. A random suffix keeps
// every login isolated to its own fresh account/household.
async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `onboarding-token-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

describe("Auth and onboarding API", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("blocks onboarding until required consents are accepted, then completes child/prepared/budget steps", async () => {
    const accessToken = await login(app);

    const meResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const householdId = meResponse.body.households[0].id as string;

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "consents",
          canRestart: true,
          summary: { consentsAccepted: false, child: null, preparedItemsCount: null, budget: null }
        });
      });

    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CONSENT_REQUIRED");
      });

    await request(app.getHttpServer())
      .get("/api/v1/consents")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.consents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "terms", required: true, accepted: false }),
            expect.objectContaining({ type: "privacy", required: true, accepted: false })
          ])
        );
      });

    await request(app.getHttpServer())
      .put("/api/v1/consents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        consents: [
          { type: "terms", version: "2026-07-06", accepted: true },
          { type: "privacy", version: "2026-07-06", accepted: true },
          { type: "marketing", version: "2026-07-06", accepted: false }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "child-profile",
          canRestart: true,
          summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
        });
      });

    // MOB-101: same Idempotency-Key resubmitted (app retry after a lost response, or a
    // resume-flow re-render before the previous request settled) must return the same child
    // instead of creating a duplicate one.
    const createChildBody = {
      householdId,
      nickname: "튼튼이",
      stageMode: "pregnant",
      dueDate: "2026-08-31"
    };
    const idempotencyKey = randomUUID();

    const childResponse = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(createChildBody)
      .expect(200);

    // CON-121: 아이 생성 응답 전체가 공유 계약(childSchema)에 맞아야 한다 —
    // dueDate/birthDate/manualStage의 null 허용과 currentStage/stageLabel 존재까지.
    childSchema.parse(childResponse.body);
    expect(childResponse.body).toMatchObject({
      id: expect.any(String),
      householdId,
      nickname: "튼튼이",
      stageMode: "pregnant",
      currentStage: "pregnancy_late"
    });

    const childId = childResponse.body.id as string;

    const replayedChildResponse = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(createChildBody)
      .expect(200);
    expect(replayedChildResponse.body.id).toBe(childId);

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        for (const child of body.children) {
          childSchema.parse(child);
        }
        expect(body.children).toHaveLength(1);
        expect(body.children[0].id).toBe(childId);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "반짝이" })
      .expect(200)
      .expect(({ body }) => {
        childSchema.parse(body);
        expect(body.nickname).toBe("반짝이");
      });

    // 라운드 45 UX-Y(P1): 이 두 id는 어떤 item_template에도 없는 값이다. 예전에는 서버가
    // 요청에 담긴 개수를 그대로 돌려줘서 "2건 반영"이라고 답했지만 실제 반영은 0건이었고,
    // 바로 아래 status의 preparedItemsCount(=0)와 정면으로 어긋났다. 이제 실반영 기준이다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        itemTemplateIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222"
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ updatedCount: 0 });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "budget",
          canRestart: false,
          summary: {
            consentsAccepted: true,
            child: expect.objectContaining({ id: childId, nickname: "반짝이" }),
            preparedItemsCount: 0,
            budget: null
          }
        });
      });

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 500000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          amountKrw: 500000,
          usedAmountKrw: 0,
          remainingAmountKrw: 500000
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: true,
          nextStep: "home",
          canRestart: false,
          summary: {
            consentsAccepted: true,
            child: expect.objectContaining({ id: childId, nickname: "반짝이" }),
            preparedItemsCount: 0,
            budget: { yearMonth: "2026-07-01", amountKrw: 500000 }
          }
        });
      });
  });

  // 라운드 45 UX-Y(P1): updatedCount는 "요청한 개수"가 아니라 "실제로 반영된 개수"다.
  // 모바일 ONB-003이 실서버에 없는 데모 픽스처 id를 보내던 버그가 조용한 허위 성공으로
  // 끝나지 않도록, 모르는 id를 섞으면 그만큼 작은 수가 돌아오는 것을 고정한다.
  it("counts only prepared-items ids that resolve to a real item template", async () => {
    const accessToken = await login(app);
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
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
        .send({ householdId, nickname: "튼튼이", stageMode: "pregnant", dueDate: "2026-08-31" })
        .expect(200)
    ).body.id as string;

    // 화면이 실제로 쓰는 목록과 같은 소스(GET /children/:id/items?tab=now)에서 진짜 id를 얻는다.
    const realItemIds = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items.slice(0, 2).map((item: { id: string }) => item.id) as string[];
    expect(realItemIds).toHaveLength(2);

    const unknownItemId = randomUUID();
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [...realItemIds, unknownItemId, realItemIds[0]] })
      .expect(200)
      .expect(({ body }) => {
        // 중복 1개는 접히고, 모르는 id 1개는 세지 않는다 -- 실반영은 2건.
        expect(body).toEqual({ updatedCount: 2 });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=prepared`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: { id: string }) => item.id).sort()).toEqual([...realItemIds].sort());
      });

    // 단계 완료 표시는 그대로 남고, 요약 개수도 응답과 같은 2개다(예전에는 응답만 부풀었다).
    await request(app.getHttpServer())
      .get(`/api/v1/onboarding/status?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.nextStep).toBe("budget");
        expect(body.summary.preparedItemsCount).toBe(2);
      });

    // 아무것도 고르지 않은 저장(빈 목록)은 0건 -- 그래도 단계는 완료로 남는다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [] })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ updatedCount: 0 });
      });
  });

  // 라운드 46 리뷰 Q-1: 유효 판정 기준은 "존재하는가"가 아니라 "화면에 보일 수 있었는가"다.
  // 종전에는 active 무필터라 어드민이 방금 비활성화한 항목까지 세어졌고, 그래서
  // updatedCount < 요청 수가 도달 불가였다 — 모바일 ONB-003의 부분 반영 안내
  // (preparedItemsPartialNotice)가 영영 뜨지 않는 죽은 코드였다.
  it("does not count a deactivated (active=false) item template — the partial-notice path is reachable", async () => {
    const accessToken = await login(app);
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
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
        .send({ householdId, nickname: "튼튼이", stageMode: "pregnant", dueDate: "2026-08-31" })
        .expect(200)
    ).body.id as string;

    const realItemId = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items[0].id as string;

    // 시드 행을 건드리지 않으려고 전용 비활성 템플릿을 직접 만든다(단계 행은 달지 않는다 —
    // 어차피 목록에 안 나오는 항목이고, 정리도 한 행으로 끝난다).
    const inactive = await prisma.itemTemplate.create({
      data: {
        code: `onb_q1_inactive_${randomUUID().slice(0, 8)}`,
        name: "비활성 준비템",
        necessityLevel: "optional",
        reasonText: "라운드 46 Q-1 회귀 테스트용 비활성 템플릿이에요.",
        displayOrder: 90_000,
        active: false
      }
    });

    try {
      // 화면은 2개를 보냈다고 알지만 서버가 반영하는 것은 1건이다.
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/prepared-items`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ itemTemplateIds: [realItemId, inactive.id] })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ updatedCount: 1 });
        });

      // 비활성 항목에는 상태 행 자체가 생기지 않는다 — 준비템 탭 어디에도 안 나오는 항목을
      // "준비 완료"로 적어 두면 다음 화면의 개수와 또 어긋난다.
      expect(
        await prisma.childItemStatus.findFirst({ where: { childId, itemTemplateId: inactive.id } })
      ).toBeNull();

      await request(app.getHttpServer())
        .get(`/api/v1/onboarding/status?childId=${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.summary.preparedItemsCount).toBe(1);
        });
    } finally {
      // 공유 DB에 남기지 않는다(라운드 45 오염 사고 재발 차단). 상태 행이 먼저다.
      await prisma.childItemStatus.deleteMany({ where: { itemTemplateId: inactive.id } });
      await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId: inactive.id } });
      await prisma.itemTemplate.deleteMany({ where: { id: inactive.id } });
    }
  });

  it("keeps onboarding budget amounts as positive KRW integers", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 0 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  // MOB-101: the onboarding resume screen (ONB-006) only offers "처음부터 시작" while no child
  // has been created yet for the household -- once a child exists, restarting risks orphaning
  // it or (if the user re-enters child-profile) creating a duplicate, so canRestart flips to
  // false and stays false for the rest of onboarding.
  it("flips onboarding status canRestart to false once a child exists, and rejects a reused Idempotency-Key sent with a different body", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.canRestart).toBe(true);
      });

    const idempotencyKey = randomUUID();
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.canRestart).toBe(false);
      });

    // Same key, different body (a second, distinct child) is a genuine conflict, not a retry --
    // must not silently create a second child under cover of the first key.
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ householdId, nickname: "다른아이", stageMode: "manual", manualStage: "toddler_1_3" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toHaveLength(1);
      });
  });

  // R19-C(F1): 다자녀 계정에서 GET /onboarding/status가 항상 첫째만 보던 문제. 이제 optional
  // `childId`로 아이별 요약/완료 판정을 받을 수 있고, 파라미터를 생략하면 기존 계약 그대로
  // 첫째를 본다(하위호환).
  it("scopes onboarding status to the requested childId and keeps the first child as the default", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    const createChild = async (nickname: string) =>
      (
        await request(app.getHttpServer())
          .post("/api/v1/children")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ householdId, nickname, stageMode: "manual", manualStage: "infant_4_6" })
          .expect(200)
      ).body.id as string;

    const firstChildId = await createChild("첫째");
    const secondChildId = await createChild("둘째");

    // 둘째만 준비템 + 예산까지 끝낸다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${secondChildId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [] })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/children/${secondChildId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 400000 })
      .expect(200);

    // 파라미터 없음 -> 예전 계약 그대로 첫째 기준(아직 준비템 단계).
    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.completed).toBe(false);
        expect(body.nextStep).toBe("prepared-items");
        expect(body.summary.child).toMatchObject({ id: firstChildId, nickname: "첫째" });
      });

    // 명시적으로 첫째를 지정해도 동일해야 한다.
    await request(app.getHttpServer())
      .get(`/api/v1/onboarding/status?childId=${firstChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.nextStep).toBe("prepared-items");
        expect(body.summary.child.id).toBe(firstChildId);
      });

    // 둘째 기준으로는 온보딩이 끝난 상태로 보여야 한다.
    await request(app.getHttpServer())
      .get(`/api/v1/onboarding/status?childId=${secondChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: true,
          nextStep: "home",
          canRestart: false,
          summary: {
            consentsAccepted: true,
            child: expect.objectContaining({ id: secondChildId, nickname: "둘째" }),
            preparedItemsCount: expect.any(Number),
            budget: { yearMonth: "2026-07-01", amountKrw: 400000 }
          }
        });
      });

    // 남의/없는 아이와 형식이 틀린 값은 다른 아이 스코프 엔드포인트와 동일한 에러 계약.
    await request(app.getHttpServer())
      .get(`/api/v1/onboarding/status?childId=${randomUUID()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
      .expect(({ body }) => {
        // CON-121: 404 대표 케이스 — 도메인 코드가 실린 봉투도 같은 계약이다.
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CHILD_NOT_FOUND");
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status?childId=not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });
});
