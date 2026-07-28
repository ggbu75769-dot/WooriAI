import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import { onboardingCompletionResponseSchema, onboardingStarterPreviewResponseSchema } from "@wooriai/contracts";

async function createOnboardingAccount(app: INestApplication) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `release5u-${randomUUID()}` })
    .expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer())
    .get("/api/v1/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  const householdId = me.body.households[0].id as string;
  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${token}`)
    .send({ consents: [
      { type: "terms", version: "2026-07-06", accepted: true },
      { type: "privacy", version: "2026-07-06", accepted: true }
    ] })
    .expect(200);
  return { token, householdId };
}

describe("Release 5U atomic onboarding completion", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-18";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    // This suite intentionally sends independent requests concurrently. A merely initialized
    // HTTP server lets Supertest open and close an ephemeral listener per request, so one request
    // can close the shared server while its sibling is still reading and surface ECONNRESET.
    // Listen once for the suite so concurrency exercises onboarding locks, not test-harness I/O.
    await app.listen(0, "127.0.0.1");
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("creates no child before final confirmation and applies one atomic result across 30 concurrent retries", async () => {
    const { token, householdId } = await createOnboardingAccount(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).get("/api/v1/children").set(auth).expect(200, { children: [] });

    const body = {
      householdId,
      draftVersion: 1,
      child: {
        nickname: "하늘",
        stageMode: "born",
        birthDate: "2025-12-18",
        gender: "female",
        stageOverride: false
      },
      prepared: { state: "completed_none", itemDefinitionIds: [] },
      budget: { yearMonth: "2026-07", amountKrw: 500000 }
    };
    const idempotencyKey = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/onboarding/complete")
          .set(auth)
          .set("Idempotency-Key", idempotencyKey)
          .send(body)
      )
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => onboardingCompletionResponseSchema.safeParse(response.body).success)).toBe(true);
    expect(responses.every((response) => response.body.budget.yearMonth === "2026-07")).toBe(true);
    expect(new Set(responses.map((response) => response.body.child.id)).size).toBe(1);
    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set(auth)
      .expect(200)
      .expect(({ body: responseBody }) => expect(responseBody.children).toHaveLength(1));
    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set(auth)
      .expect(200)
      .expect(({ body: responseBody }) => expect(responseBody).toMatchObject({ completed: true, nextStep: "home" }));
  });

  it("rejects incompatible path fields without creating a ghost child", async () => {
    const { token, householdId } = await createOnboardingAccount(app);
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set(auth)
      .set("Idempotency-Key", randomUUID())
      .send({
        householdId,
        draftVersion: 1,
        child: {
          nickname: "별",
          stageMode: "born",
          birthDate: "2025-12-18",
          dueDate: "2026-12-01",
          gender: "unknown",
          stageOverride: false
        },
        prepared: { state: "skipped", itemDefinitionIds: [] },
        budget: null
      })
      .expect(400);
    await request(app.getHttpServer()).get("/api/v1/children").set(auth).expect(200, { children: [] });
  });

  it("rejects an unvisited prepared step and rolls stale selections back to zero scoped rows", async () => {
    const { token, householdId } = await createOnboardingAccount(app);
    const auth = { Authorization: `Bearer ${token}` };
    const base = {
      householdId,
      draftVersion: 1,
      child: { nickname: "별", stageMode: "born", birthDate: "2025-12-18", gender: "unknown", stageOverride: false },
      budget: { yearMonth: "2026-07", amountKrw: 500000 }
    };
    await request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set(auth)
      .set("Idempotency-Key", randomUUID())
      .send({ ...base, prepared: { state: "not_started", itemDefinitionIds: [] } })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set(auth)
      .set("Idempotency-Key", randomUUID())
      .send({ ...base, prepared: { state: "selected", itemDefinitionIds: [randomUUID()] } })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe("STARTER_ITEMS_STALE"));

    expect(await prisma.child.count({ where: { householdId } })).toBe(0);
    expect(await prisma.userItemPlan.count({ where: { householdId } })).toBe(0);
    const budgetRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM budgets b
      JOIN children c ON c.id = b.child_id
      WHERE c.household_id = ${householdId}::uuid
    `;
    expect(Number(budgetRows[0]?.count ?? 0n)).toBe(0);
  });

  it("replays the same key, conflicts on a different payload, and completes an explicit budget skip", async () => {
    const { token, householdId } = await createOnboardingAccount(app);
    const auth = { Authorization: `Bearer ${token}` };
    const idempotencyKey = randomUUID();
    const body = {
      householdId,
      draftVersion: 2,
      child: { nickname: "구름", stageMode: "born", birthDate: "2025-12-18", gender: "unknown", stageOverride: false },
      prepared: { state: "skipped", itemDefinitionIds: [] },
      budget: null
    };
    const first = await request(app.getHttpServer()).post("/api/v1/onboarding/complete").set(auth).set("Idempotency-Key", idempotencyKey).send(body).expect(200);
    const replay = await request(app.getHttpServer()).post("/api/v1/onboarding/complete").set(auth).set("Idempotency-Key", idempotencyKey).send(body).expect(200);
    expect(replay.body).toEqual(first.body);
    expect(replay.body.budget).toBeNull();
    await request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set(auth)
      .set("Idempotency-Key", idempotencyKey)
      .send({ ...body, draftVersion: 3 })
      .expect(409)
      .expect(({ body: responseBody }) => expect(responseBody.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT"));
    await request(app.getHttpServer()).get("/api/v1/onboarding/status").set(auth).expect(200)
      .expect(({ body: responseBody }) => expect(responseBody).toMatchObject({ completed: true, nextStep: "home", summary: { budget: null } }));
  });

  it("isolates simultaneous completion locks by household and rejects expired authentication", async () => {
    const [left, right] = await Promise.all([createOnboardingAccount(app), createOnboardingAccount(app)]);
    const complete = (account: { token: string; householdId: string }, nickname: string) => request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set("Authorization", `Bearer ${account.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        householdId: account.householdId,
        draftVersion: 1,
        child: { nickname, stageMode: "born", birthDate: "2025-12-18", gender: "unknown", stageOverride: false },
        prepared: { state: "completed_none", itemDefinitionIds: [] },
        budget: null
      });
    const [leftResponse, rightResponse] = await Promise.all([complete(left, "왼쪽"), complete(right, "오른쪽")]);
    expect([leftResponse.status, rightResponse.status]).toEqual([200, 200]);
    expect(leftResponse.body.child.id).not.toBe(rightResponse.body.child.id);
    expect(await prisma.child.count({ where: { householdId: { in: [left.householdId, right.householdId] } } })).toBe(2);

    await request(app.getHttpServer())
      .post("/api/v1/onboarding/complete")
      .set("Authorization", "Bearer expired-token")
      .set("Idempotency-Key", randomUUID())
      .send({})
      .expect(401);
  });

  it("keeps the production starter preview published-only across 30 deterministic requests", async () => {
    const { token } = await createOnboardingAccount(app);
    const auth = { Authorization: `Bearer ${token}` };
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/onboarding/starter-items/preview")
          .set(auth)
          .send({ stageMode: "born", birthDate: "2025-12-18" })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(onboardingStarterPreviewResponseSchema.safeParse(response.body).success).toBe(true);
      expect(response.body).toMatchObject({
        availability: "external_blocked",
        blockerCode: "EXTERNAL_BLOCKED_ONBOARDING_CATALOG",
        eligibleCount: 0,
        items: []
      });
    }
  });

  it("returns a category-aware selected result for a published normal-safety starter item", async () => {
    const suffix = randomUUID();
    const reviewer = await prisma.adminUser.create({
      data: { email: `onboarding-reviewer-${suffix}@example.com`, passwordHash: "test", displayName: "온보딩 검수자", role: "admin" }
    });
    const node = await prisma.catalogNode.create({
      data: { code: `onboarding-test-${suffix}`, level: "subcategory", nameKo: "온보딩 테스트", iconKey: "thermometer", displayOrder: 999999 }
    });
    const item = await prisma.itemDefinition.create({
      data: {
        code: `onboarding-item-${suffix}`,
        nameKo: "테스트 체온계",
        shortDescription: "출산 전",
        targetSubject: "child",
        necessity: "required",
        recommendationState: "recommended",
        reasonText: "온보딩 원자성 테스트",
        timingSummary: "영아 7~12개월",
        secondhandPolicy: "inspect",
        rentalPolicy: "unsuitable",
        safetyTier: "normal",
        sourceSummary: "자동화 테스트 전용",
        contentHash: "a".repeat(64),
        reviewedAt: new Date(),
        reviewedByAdminId: reviewer.id,
        publishedAt: new Date(),
        publishedByAdminId: reviewer.id,
        status: "published",
        onboardingEligible: true,
        onboardingPriority: 500,
        displayOrder: 999999
      }
    });
    await Promise.all([
      prisma.itemLifecycleRule.create({ data: { itemDefinitionId: item.id, axis: "child", lifecycleCode: "infant_7_12m", priorityWeight: 500 } }),
      prisma.itemDefinitionCategory.create({ data: { itemDefinitionId: item.id, catalogNodeId: node.id, isPrimary: true } })
    ]);

    try {
      const { token, householdId } = await createOnboardingAccount(app);
      const auth = { Authorization: `Bearer ${token}` };
      const preview = await request(app.getHttpServer())
        .post("/api/v1/onboarding/starter-items/preview")
        .set(auth)
        .send({ stageMode: "born", birthDate: "2025-12-18" })
        .expect(200);
      expect(preview.body.items).toContainEqual(expect.objectContaining({ id: item.id, categoryCode: node.code, iconKey: "thermometer" }));

      const completed = await request(app.getHttpServer())
        .post("/api/v1/onboarding/complete")
        .set(auth)
        .set("Idempotency-Key", randomUUID())
        .send({
          householdId,
          draftVersion: 1,
          child: { nickname: "선택", stageMode: "born", birthDate: "2025-12-18", gender: "unknown", stageOverride: false },
          prepared: { state: "selected", itemDefinitionIds: [item.id] },
          budget: { yearMonth: "2026-07", amountKrw: 500000 }
        })
        .expect(200);
      expect(completed.body).toMatchObject({ prepared: { state: "selected", appliedCount: 1 }, budget: { yearMonth: "2026-07", amountKrw: 500000 } });
      expect(await prisma.userItemPlan.count({ where: { householdId, itemDefinitionId: item.id, state: "owned" } })).toBe(1);
    } finally {
      await prisma.itemDefinition.update({ where: { id: item.id }, data: { status: "recalled", onboardingEligible: false } });
    }
  });
});
