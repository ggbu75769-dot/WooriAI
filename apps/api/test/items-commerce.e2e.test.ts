import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { OnboardingStoreService } from "../src/onboarding/onboarding-store.service";

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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
      .send({
        householdId,
        nickname: "튼튼이",
        stageMode: "manual",
        manualStage: "newborn_0_3"
      })
      .expect(200)
  ).body.id as string;

  await request(app.getHttpServer())
    .post(`/api/v1/children/${childId}/prepared-items`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ itemTemplateIds: [] })
    .expect(200);

  await request(app.getHttpServer())
    .put(`/api/v1/children/${childId}/budget`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ yearMonth: "2026-07-01", amountKrw: 500000 })
    .expect(200);

  return { childId, householdId };
}

type ItemSummary = {
  id: string;
  name: string;
  necessityLevel: "essential" | "convenience" | "optional";
  status: "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";
};

type ProductLink = {
  id: string;
  platform: string;
  title: string;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText?: string;
};

describe("Items, commerce, and affiliate API", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("lists stage-matched items by recommendation score and reflects status changes in now/home/prepared tabs", async () => {
    const accessToken = await login(app, "batch07-items");
    const { childId } = await completeOnboarding(app, accessToken);

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];

    expect(nowItems.length).toBeGreaterThanOrEqual(4);
    expect(nowItems.map((item) => item.status)).not.toContain("prepared");
    expect(nowItems.map((item) => item.status)).not.toContain("not_needed");
    expect(nowItems[0].necessityLevel).toBe("essential");
    expect(nowItems[1].necessityLevel).toBe("essential");
    expect(nowItems.every((item) => ["essential", "convenience", "optional"].includes(item.necessityLevel))).toBe(true);

    const carSeat = nowItems.find((item) => item.name === "카시트");
    expect(carSeat).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${carSeat!.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "prepared" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: carSeat!.id, name: "카시트", status: "prepared" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=now`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: ItemSummary) => item.id)).not.toContain(carSeat!.id);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=prepared`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([expect.objectContaining({ id: carSeat!.id, status: "prepared" })]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.recommendedItems.map((item: ItemSummary) => item.id)).not.toContain(carSeat!.id);
        expect(body.recommendedItems.length).toBeGreaterThan(0);
      });
  });

  it("returns detail trust fields, explicit disclosure/sponsor markers, and persists affiliate clicks", async () => {
    const accessToken = await login(app, "batch07-commerce");
    const { childId, householdId } = await completeOnboarding(app, accessToken);

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];

    const carSeat = nowItems.find((item) => item.name === "카시트");
    const stroller = nowItems.find((item) => item.name === "유모차");
    expect(carSeat).toBeDefined();
    expect(stroller).toBeDefined();

    const carSeatDetail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${carSeat!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as ItemSummary & {
      reasonText: string;
      skipReasonText: string | null;
      usedSecondhandOk: boolean;
      safetyNote: string | null;
      productLinks: ProductLink[];
    };

    expect(carSeatDetail).toMatchObject({
      id: carSeat!.id,
      reasonText: expect.any(String),
      usedSecondhandOk: false
    });
    expect(carSeatDetail.reasonText.length).toBeGreaterThan(0);
    const affiliateLink = carSeatDetail.productLinks.find((link) => link.isAffiliate);
    expect(affiliateLink).toMatchObject({
      isAffiliate: true,
      isSponsored: false,
      disclosureText: expect.stringContaining("제휴")
    });

    const strollerDetail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${stroller!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { productLinks: ProductLink[] };
    expect(strollerDetail.productLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isSponsored: true,
          disclosureText: expect.stringContaining("스폰서")
        })
      ])
    );

    const clickResponse = await request(app.getHttpServer())
      .post(`/api/v1/product-links/${affiliateLink!.id}/click`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ childId, referrerScreenId: "ITEM-003" })
      .expect(200);

    expect(clickResponse.body).toMatchObject({
      clickId: expect.any(String),
      redirectUrl: "https://example.com/dev/affiliate/car-seat",
      disclosureText: expect.stringContaining("제휴")
    });

    const store = moduleRef.get(OnboardingStoreService) as OnboardingStoreService & {
      affiliateClickEntries: Array<{
        id: string;
        userId: string;
        householdId: string;
        childId: string;
        itemTemplateId: string;
        productLinkId: string;
        platform: string;
        referrerScreenId?: string;
      }>;
    };
    expect(store.affiliateClickEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: clickResponse.body.clickId,
          householdId,
          childId,
          itemTemplateId: carSeat!.id,
          productLinkId: affiliateLink!.id,
          platform: affiliateLink!.platform,
          referrerScreenId: "ITEM-003"
        })
      ])
    );
  });
});
