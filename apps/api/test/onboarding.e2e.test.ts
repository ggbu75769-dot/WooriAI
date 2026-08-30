import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { childSchema, errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  attachQueryStatementCounter,
  QueryCountingPrismaService,
  type QueryStatementCounter
} from "./helpers/query-statement-counter";

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

/**
 * 라운드 82 C: 준비템 저장까지 가려면 매번 지나야 하는 앞 단계 둘(필수 동의 · 아이 프로필)을
 * 한 자리에 모은다. 위 `it`들이 그 단계를 한 줄씩 펼쳐 두는 것은 **그 단계 자체가 계약이기
 * 때문**이라 그대로 두고, 준비템 계약 스위트만 이 헬퍼를 쓴다(같은 사용자로 여러 번 불러
 * 아이를 여럿 만들 수 있다 — 동의 PUT은 멱등이다).
 */
async function consentAndCreateChild(app: INestApplication, accessToken: string) {
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
      .send({ householdId, nickname: "튼튼이", stageMode: "pregnant", dueDate: "2026-08-31" })
      .expect(200)
  ).body.id as string;

  return { householdId, childId };
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

  /**
   * GAP-063 #5: 예산 덮어쓰기는 앱의 돈 관련 쓰기 중 유일하게 흔적이 0이었다.
   * budgets 행은 (아이, 연월)당 **한 칸**이라 덮어쓰면 이전 금액이 사라지므로,
   * "누가·언제·얼마에서 얼마로"를 답할 근거는 이 감사 로그밖에 없다.
   * 조회 화면(ADM-113)이 읽는 것은 audit_logs **테이블**이므로 인메모리 entries가
   * 아니라 실제로 영속된 행을 확인한다.
   */
  it("records a budget.upsert audit row for every month-budget write (first set → null before, overwrite → previous amount)", async () => {
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

    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const actorUserId = me.body.user.id as string;
    const householdId = me.body.households[0].id as string;

    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "예산이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    // 1) 첫 설정 — 응답 계약은 종전 그대로(감사 봉투가 응답으로 새지 않는다).
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07", amountKrw: 600000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ childId, yearMonth: "2026-07-01", amountKrw: 600000 });
        expect(body).not.toHaveProperty("before");
        expect(body).not.toHaveProperty("householdId");
      });

    // 2) 덮어쓰기 — 이 순간 600,000원이라는 사실이 budgets 행에서 사라진다.
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07", amountKrw: 400000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(400000);
      });

    const budgetRow = await prisma.budget.findFirst({ where: { childId } });
    expect(budgetRow).not.toBeNull();

    const rows = await prisma.auditLog.findMany({
      where: { action: "budget.upsert", targetId: budgetRow!.id },
      orderBy: { createdAt: "asc" }
    });
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({ actorUserId, householdId, targetType: "budget" });
    // 첫 설정은 덮어쓰기가 아니다 — before가 없다는 사실 자체가 정보다.
    expect(rows[0]!.beforeJson).toBeNull();
    expect(rows[0]!.afterJson).toEqual({ childId, yearMonth: "2026-07-01", amountKrw: 600000 });

    expect(rows[1]).toMatchObject({ actorUserId, householdId, targetType: "budget" });
    expect(rows[1]!.beforeJson).toEqual({ childId, yearMonth: "2026-07-01", amountKrw: 600000 });
    expect(rows[1]!.afterJson).toEqual({ childId, yearMonth: "2026-07-01", amountKrw: 400000 });

    // 봉투에 개인정보가 섞이지 않는다: 키는 금액·연월·childId 셋뿐이다.
    for (const row of rows) {
      for (const envelope of [row.beforeJson, row.afterJson]) {
        if (!envelope) continue;
        expect(Object.keys(envelope as Record<string, unknown>).sort()).toEqual([
          "amountKrw",
          "childId",
          "yearMonth"
        ]);
      }
    }

    // 공유 DB에 남기지 않는다(라운드 45 오염 사고 재발 차단).
    await prisma.auditLog.deleteMany({ where: { targetId: budgetRow!.id } });
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

/**
 * 라운드 82 C — 준비템 저장(`POST /children/:childId/prepared-items`)의 계약 둘.
 *
 * ## 무엇이 문제였나
 * 이 엔드포인트의 트랜잭션은 **고른 항목 수 N에 문장 수가 비례**했다(`child.update` 하나 +
 * 항목마다 `childItemStatus.upsert` 하나 = **N + 1**). 그리고 그 N의 상한을 계약이 정하지
 * 않는다 — 유효 판정은 `itemTemplate.findMany({ active: true })`이고 그 표는 **어드민이
 * 늘린다**(`items-catalog.service.ts`의 `adminCreateItemTemplate`). 카탈로그가 자란 다음 날
 * 준비물 화면에서 여든 개를 체크한 사용자는 여든한 문장을 **Prisma 기본 5초** 예산 안에서
 * 직렬로 돌리게 되고, 넘기면 P2028 롤백이다. 이 화면은 온보딩의 마지막에서 둘째라
 * (모바일 ONB-003) 실패한 사람은 홈에 도달하지 못하고, 라운드 72 A가 만든 로컬 탈출구는
 * **체크가 0건일 때만** 열린다 — 즉 **항목을 실제로 고른 사람일수록 막힌다**.
 *
 * ## 두 계약이 서로를 지킨다
 * 아래 첫 스위트는 **문장 수가 항목 수에 비례하지 않는다**를 실측으로 세우고(가져오기와 같은
 * 하네스 한 벌 — `test/helpers/query-statement-counter.ts`), 둘째 스위트는 그렇게 접은 결과가
 * **종전과 한 칸도 다르지 않다**를 세운다. 뒤엣것이 이 트랙의 성패다: 배치로 접으면서
 * `updatedCount`의 의미(라운드 45 UX-Y)·`active` 유효 판정(라운드 46 Q-1)·`gifted`를 덮는
 * 성질 중 하나라도 움직이면, 빨라진 대가로 화면이 거짓말을 하게 된다.
 */
describe("라운드 82 C — 준비템 저장의 왕복 수 계약", () => {
  /**
   * 비교의 작은 쪽/큰 쪽 항목 수. 큰 쪽이 작은 쪽의 **두 배**라는 것 말고 다른 뜻은 없다
   * (정찰이 적은 그대로: "항목 수를 두 배로 해도 문장 수가 두 배가 되지 않을 것").
   * ⚠️ 카탈로그의 크기를 뜻하지 않는다 — 그 수는 시드 값이지 계약이 아니고, 여기서는
   * **측정점 둘**을 고르는 데만 쓴다.
   */
  const SMALL_ITEMS = 20;
  const LARGE_ITEMS = 40;

  let app: INestApplication;
  let prisma: PrismaService;
  let counter: QueryStatementCounter;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useClass(QueryCountingPrismaService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    counter = attachQueryStatementCounter(app);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    counter.reset();
    await app.close();
  });

  it("고른 항목 수를 두 배로 해도 문장 수는 두 배가 되지 않는다", async () => {
    const accessToken = await login(app);

    // ⚠️ 아이를 둘로 나눈다: 같은 아이로 두 번 재면 두 번째 측정에는 이미 상태 행이 있어
    // 두 측정이 서로 다른 일을 하게 된다(종전 소스의 upsert도, 오늘의 배치도 마찬가지다).
    const { childId: smallChildId } = await consentAndCreateChild(app, accessToken);
    const { childId: largeChildId } = await consentAndCreateChild(app, accessToken);

    // 실제로 저장 가능한 id를 서비스가 보는 것과 같은 기준(`active: true`)으로 고른다.
    // 목록의 **크기**는 단언하지 않는다 — 필요한 것은 측정점 둘을 채울 만큼 있다는 사실뿐이다.
    const activeIds = (
      await prisma.itemTemplate.findMany({
        where: { active: true },
        select: { id: true },
        orderBy: { code: "asc" },
        take: LARGE_ITEMS
      })
    ).map((row) => row.id);
    expect(activeIds).toHaveLength(LARGE_ITEMS);

    async function saveStatements(childId: string, itemTemplateIds: string[]): Promise<number> {
      return await counter.count(async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/prepared-items`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ itemTemplateIds })
          .expect(200)
          .expect(({ body }) => {
            // 값 계약이 먼저다 — 고른 항목이 전부 반영됐을 때만 문장 수 비교가 뜻을 가진다.
            expect(body).toEqual({ updatedCount: itemTemplateIds.length });
          });
      });
    }

    const smallStatements = await saveStatements(smallChildId, activeIds.slice(0, SMALL_ITEMS));
    const largeStatements = await saveStatements(largeChildId, activeIds);

    // ⓐ 문장 수 자체가 항목 수보다 적다. 종전 소스(항목마다 upsert 한 문장)에서는
    //    트랜잭션 안에서만 LARGE_ITEMS + 1이고 여기에 인증·권한 조회와 BEGIN/COMMIT 같은
    //    **항목 수와 무관한 상수 오버헤드**가 더해지므로 반드시 빨개진다.
    expect(largeStatements).toBeLessThan(LARGE_ITEMS);
    // ⓑ 항목 수를 두 배로 늘렸을 때의 **증가분**이 늘어난 항목 수의 10분의 1 미만이다.
    //    비례하는 구현에서는 증가분이 늘어난 항목 수와 같아지므로(20) 반드시 빨개진다.
    //    여유를 두는 것은 상수 오버헤드가 요청마다 한두 문장씩 흔들릴 수 있기 때문이고,
    //    그 흔들림은 비례/비비례를 가르는 20과 자릿수가 다르다.
    expect(largeStatements - smallStatements).toBeLessThan((LARGE_ITEMS - SMALL_ITEMS) / 10);
  });
});

describe("라운드 82 C — 준비템 저장의 동치 계약", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  /** 이 아이의 상태 행 전부를 **비교 가능한 모양**으로 (item id 순서 고정). */
  async function statusRowsOf(childId: string) {
    const rows = await prisma.childItemStatus.findMany({ where: { childId } });
    return rows
      .map((row) => ({ itemTemplateId: row.itemTemplateId, status: row.status, updatedByUserId: row.updatedByUserId }))
      .sort((left, right) => left.itemTemplateId.localeCompare(right.itemTemplateId));
  }

  async function preparedItemsSetAtOf(childId: string) {
    const child = await prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: { preparedItemsSetAt: true }
    });
    return child.preparedItemsSetAt;
  }

  /**
   * 배치로 접은 뒤에도 **같은 입력이 같은 결과를 낸다**를 한 시나리오 안에서 넷 다 지난다:
   * 모르는 id 섞기 · 비활성 항목 섞기 · 재실행 · 이미 `gifted`인 행 덮기.
   * ⚠️ 넷 중 하나라도 움직이면 빨라진 대가로 화면이 거짓말을 한다 — 그래서 응답의
   * `updatedCount`만이 아니라 **최종 행 집합 · 상태 값 · `preparedItemsSetAt`** 를 함께 본다.
   */
  it("모르는 id·비활성·재실행·gifted 덮기에서 결과가 종전과 같다", async () => {
    const accessToken = await login(app);
    const { childId } = await consentAndCreateChild(app, accessToken);
    const userId = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
    ).body.user.id as string;

    const realItemIds = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items.slice(0, 3).map((item: { id: string }) => item.id) as string[];
    expect(realItemIds).toHaveLength(3);
    const [firstItemId, secondItemId, untouchedItemId] = realItemIds;

    // 시드 행을 건드리지 않는 전용 비활성 템플릿(위 라운드 46 Q-1 테스트와 같은 장치).
    const inactive = await prisma.itemTemplate.create({
      data: {
        code: `r82c_inactive_${randomUUID().slice(0, 8)}`,
        name: "비활성 준비템",
        necessityLevel: "optional",
        reasonText: "라운드 82 C 동치 계약용 비활성 템플릿이에요.",
        skipReasonText: "이 항목은 목록에서 내려갔어요.",
        displayOrder: 90_000,
        active: false
      }
    });

    async function savePrepared(itemTemplateIds: string[]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/prepared-items`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ itemTemplateIds })
        .expect(200);
      return response.body as { updatedCount: number };
    }

    try {
      // (1) 모르는 id · 중복 · 비활성이 섞인 첫 저장.
      const unknownItemId = randomUUID();
      expect(await savePrepared([firstItemId, firstItemId, unknownItemId, inactive.id, secondItemId])).toEqual({
        updatedCount: 2
      });
      // 중복은 접히고, 모르는 id도 비활성도 세지 않는다 — 그리고 **행 자체가 생기지 않는다**.
      expect(await statusRowsOf(childId)).toEqual([
        { itemTemplateId: firstItemId, status: "prepared", updatedByUserId: userId },
        { itemTemplateId: secondItemId, status: "prepared", updatedByUserId: userId }
      ].sort((left, right) => left.itemTemplateId.localeCompare(right.itemTemplateId)));
      const firstSetAt = await preparedItemsSetAtOf(childId);
      expect(firstSetAt).not.toBeNull();

      // (2) 사용자가 한 항목을 `gifted`로 바꾸고, **요청에 담기지 않을** 항목 하나도 `gifted`로 둔다.
      for (const itemTemplateId of [firstItemId, untouchedItemId]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/children/${childId}/items/${itemTemplateId}/status`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ status: "gifted" })
          .expect(200);
      }
      expect(await statusRowsOf(childId)).toEqual(
        [
          { itemTemplateId: firstItemId, status: "gifted", updatedByUserId: userId },
          { itemTemplateId: secondItemId, status: "prepared", updatedByUserId: userId },
          { itemTemplateId: untouchedItemId, status: "gifted", updatedByUserId: userId }
        ].sort((left, right) => left.itemTemplateId.localeCompare(right.itemTemplateId))
      );

      // (3) 같은 목록으로 **재실행**. `updatedCount`는 반영된 건수라 재실행에서도 2다
      //     (⚠️ `createMany`의 count로 바꾸면 여기서 0이 되어 온보딩 이어하기의 요약이
      //     거짓말을 한다 — 라운드 45 UX-Y의 계약이 지켜지는 자리가 여기다).
      expect(await savePrepared([firstItemId, secondItemId, unknownItemId, inactive.id])).toEqual({
        updatedCount: 2
      });
      // gifted였던 항목은 **덮인다**(사용자가 준비템 화면에서 직접 고른 경로라 종전 upsert도
      // 조건 없이 덮었다). 요청에 없던 항목의 gifted는 그대로 남는다.
      expect(await statusRowsOf(childId)).toEqual(
        [
          { itemTemplateId: firstItemId, status: "prepared", updatedByUserId: userId },
          { itemTemplateId: secondItemId, status: "prepared", updatedByUserId: userId },
          { itemTemplateId: untouchedItemId, status: "gifted", updatedByUserId: userId }
        ].sort((left, right) => left.itemTemplateId.localeCompare(right.itemTemplateId))
      );
      // 비활성 항목에는 재실행에서도 행이 생기지 않는다.
      expect(await prisma.childItemStatus.findFirst({ where: { childId, itemTemplateId: inactive.id } })).toBeNull();

      const secondSetAt = await preparedItemsSetAtOf(childId);
      expect(secondSetAt).not.toBeNull();
      expect(secondSetAt!.getTime()).toBeGreaterThanOrEqual(firstSetAt!.getTime());

      // (4) 아무것도 고르지 않은 저장(0건)에서도 단계 완료 표시는 남고, 기존 행은 하나도
      //     달라지지 않는다 — "아무것도 준비하지 않았다"도 이 단계를 끝냈다는 사실이다.
      const beforeEmpty = await statusRowsOf(childId);
      expect(await savePrepared([])).toEqual({ updatedCount: 0 });
      expect(await statusRowsOf(childId)).toEqual(beforeEmpty);
      const thirdSetAt = await preparedItemsSetAtOf(childId);
      expect(thirdSetAt).not.toBeNull();
      expect(thirdSetAt!.getTime()).toBeGreaterThanOrEqual(secondSetAt!.getTime());

      // 응답과 다음 화면의 요약이 계속 같은 수를 말한다(준비/선물 둘 다 준비템 탭에 속한다).
      await request(app.getHttpServer())
        .get(`/api/v1/onboarding/status?childId=${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.summary.preparedItemsCount).toBe(3);
        });
    } finally {
      // 공유 DB에 남기지 않는다(라운드 45 오염 사고 재발 차단). 상태 행이 먼저다.
      await prisma.childItemStatus.deleteMany({ where: { itemTemplateId: inactive.id } });
      await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId: inactive.id } });
      await prisma.itemTemplate.deleteMany({ where: { id: inactive.id } });
    }
  });
});
