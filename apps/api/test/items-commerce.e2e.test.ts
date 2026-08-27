import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  affiliateClickResponseSchema,
  errorResponseSchema,
  itemDetailSchema,
  itemSummarySchema,
  productLinkSchema
} from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
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

    // CON-121: 준비템 목록의 각 항목이 공유 계약(itemSummarySchema)에 맞아야 한다 —
    // DB에서 nullable인 timingLabel이 null로 새어 나오면 여기서 잡힌다.
    for (const item of nowItems) {
      itemSummarySchema.parse(item);
    }

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
        // CON-121: 상태 변경 응답도 같은 요약 계약을 돌려준다.
        itemSummarySchema.parse(body);
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

    // CON-121: 준비템 상세 응답 전체 계약 — 요약 필드 + 신뢰 필드(reasonText 등) +
    // productLinks 배열(각 항목 productLinkSchema)까지 한 번에 고정된다.
    itemDetailSchema.parse(carSeatDetail);

    expect(carSeatDetail).toMatchObject({
      id: carSeat!.id,
      reasonText: expect.any(String),
      usedSecondhandOk: false
    });
    expect(carSeatDetail.reasonText.length).toBeGreaterThan(0);
    const affiliateLink = carSeatDetail.productLinks.find((link) => link.isAffiliate);
    // DNC-010/DNC-011: 제휴 고지 문구는 계약상 필드로 존재해야 한다 (productLinkSchema).
    productLinkSchema.parse(affiliateLink);
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
    itemDetailSchema.parse(strollerDetail);
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
      .set("User-Agent", "wooriai-e2e-test-agent/1.0")
      .send({ childId, referrerScreenId: "ITEM-003" })
      .expect(200);

    // CON-121: 제휴 클릭 응답 계약 — redirectUrl은 실제 URL 형태여야 한다.
    affiliateClickResponseSchema.parse(clickResponse.body);
    expect(clickResponse.body).toMatchObject({
      clickId: expect.any(String),
      redirectUrl: "https://example.com/dev/affiliate/car-seat",
      disclosureText: expect.stringContaining("제휴")
    });

    const prisma = moduleRef.get(PrismaService);
    const affiliateClickEntries = await prisma.affiliateClick.findMany({ where: { productLinkId: affiliateLink!.id } });
    expect(affiliateClickEntries).toEqual(
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

    // COM-106: subId is a self-generated uuid (same value as the row's own id) rather than
    // anything derived from the user/child, and ipHash/userAgent are populated without ever
    // storing the raw client IP.
    const loggedClick = affiliateClickEntries.find((entry) => entry.id === clickResponse.body.clickId)!;
    expect(loggedClick.subId).toBe(clickResponse.body.clickId);
    expect(loggedClick.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(loggedClick.userAgent).toBe("wooriai-e2e-test-agent/1.0");
  });

  it("rejects a click on a product link whose target domain is not on the affiliate allowlist, and does not log it", async () => {
    const accessToken = await login(app, "batch07-click-domain-blocked");
    const { childId } = await completeOnboarding(app, accessToken);

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];
    const carSeat = nowItems.find((item) => item.name === "카시트");
    expect(carSeat).toBeDefined();

    const carSeatDetail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${carSeat!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { productLinks: ProductLink[] };
    const affiliateLink = carSeatDetail.productLinks.find((link) => link.isAffiliate);
    expect(affiliateLink).toBeDefined();

    // The dev/test allowlist fallback includes example.com so seeded fixtures normally pass;
    // point this link at a domain nowhere near the allowlist (including lookalikes such as
    // "coupang.com.evil.com") to exercise the rejection path.
    const prisma = moduleRef.get(PrismaService);
    const storedLink = await prisma.productLink.findUniqueOrThrow({ where: { id: affiliateLink!.id } });
    const originalUrl = storedLink.url;
    const originalAffiliateUrl = storedLink.affiliateUrl;
    await prisma.productLink.update({
      where: { id: affiliateLink!.id },
      data: { url: "https://coupang.com.evil-lookalike.net/x", affiliateUrl: "https://coupang.com.evil-lookalike.net/x" }
    });

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/product-links/${affiliateLink!.id}/click`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ childId, referrerScreenId: "ITEM-003" })
        .expect(404)
        .expect(({ body }) => {
          // CON-121: 404 대표 케이스 — 봉투 전체가 errorResponseSchema다.
          errorResponseSchema.parse(body);
          // Same code as "link not found" so a disallowed domain can't be distinguished
          // from an unknown link id.
          expect(body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");
        });

      const clickEntries = await prisma.affiliateClick.findMany({ where: { productLinkId: affiliateLink!.id, childId } });
      expect(clickEntries).toHaveLength(0);
    } finally {
      await prisma.productLink.update({
        where: { id: affiliateLink!.id },
        data: { url: originalUrl, affiliateUrl: originalAffiliateUrl }
      });
    }
  });

  it("rejects an item status update whose expenseId belongs to a different child", async () => {
    const accessToken = await login(app, "batch07-item-expense-mismatch");
    const { childId, householdId } = await completeOnboarding(app, accessToken);

    const otherChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          householdId,
          nickname: "다른 아이",
          stageMode: "manual",
          manualStage: "infant_4_6"
        })
        .expect(200)
    ).body.id as string;

    const otherChildExpense = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${otherChildId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          amountKrw: 20000,
          spentOn: "2026-07-06",
          itemName: "다른 아이 지출",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string };

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];
    const carSeat = nowItems.find((item) => item.name === "카시트");
    expect(carSeat).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${carSeat!.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "prepared", expenseId: otherChildExpense.id })
      .expect(403)
      .expect(({ body }) => {
        // CON-121: 403 대표 케이스 — 봉투 전체가 errorResponseSchema다.
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("EXPENSE_CHILD_MISMATCH");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=prepared`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([]);
      });
  });

  /**
   * R19-B / DNC-002 핵심 루프의 마지막 고리("구매 후 기록 -> 상태 체크"): 준비템에
   * 연결된 지출을 기록하면 그 준비템이 자동으로 준비 완료가 된다. 셋을 한 번에 고정한다 --
   * (1) 연결 지출 -> prepared, (2) 이미 gifted인 항목은 연결 지출이 생겨도 불변,
   * (3) 연결이 없는 일반 지출은 어떤 준비템 상태도 건드리지 않는다.
   */
  it("marks a linked preparation item prepared on expense create, preserves gifted, and leaves unlinked expenses alone", async () => {
    const accessToken = await login(app, "batch19-expense-item-link");
    const { childId } = await completeOnboarding(app, accessToken);
    // 시드 카테고리 id (다른 케이스와 동일한 고정 uuid를 쓴다).
    const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];
    expect(nowItems.length).toBeGreaterThanOrEqual(3);
    const [linkedItem, giftedItem, untouchedItem] = nowItems;

    // (2)의 사전 상태: 사용자가 직접 "선물로 받았어요"로 정리해 둔 항목.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${giftedItem.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "gifted" })
      .expect(200);

    // (1) 연결 지출 -> 준비 완료. 응답 형태는 그대로다 (지출 DTO에 상태 필드가 새로 붙지 않는다).
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 189000,
        spentOn: "2026-07-06",
        itemName: linkedItem.name,
        paymentMethod: "card",
        linkedItemTemplateId: linkedItem.id
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toEqual(expect.any(String));
        expect(body).not.toHaveProperty("status");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${linkedItem.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: linkedItem.id, status: "prepared" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=prepared`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: ItemSummary) => item.id)).toContain(linkedItem.id);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=now`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: ItemSummary) => item.id)).not.toContain(linkedItem.id);
      });

    // (2) 이미 gifted로 정리된 항목은 연결 지출이 생겨도 사용자 판단이 유지된다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-07-06",
        itemName: giftedItem.name,
        paymentMethod: "card",
        linkedItemTemplateId: giftedItem.id
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${giftedItem.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: giftedItem.id, status: "gifted" });
      });

    // (3) 연결 없는 일반 지출은 준비템 상태를 전혀 바꾸지 않는다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 30000,
        spentOn: "2026-07-06",
        itemName: "연결 없는 지출",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${untouchedItem.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: untouchedItem.id, status: "not_prepared" });
      });

    // ITEM-123 (B4): 준비완료 탭은 이제 prepared와 gifted를 함께 담는다 -- 연결 지출로 준비
    // 완료가 된 항목과 선물로 받아둔 항목 둘 다 "이미 손에 있는" 물건이기 때문이다. 상태를
    // 건드리지 않은 항목(untouchedItem)은 여전히 들어오지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=prepared`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const prepared = body.items as ItemSummary[];
        expect(prepared).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: linkedItem.id, status: "prepared" }),
            expect.objectContaining({ id: giftedItem.id, status: "gifted" })
          ])
        );
        expect(prepared.map((item) => item.id)).not.toContain(untouchedItem.id);
      });
  });

  it("does not record a click log entry when the redirect URL fails scheme validation", async () => {
    const accessToken = await login(app, "batch07-click-order");
    const { childId } = await completeOnboarding(app, accessToken);

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];
    const carSeat = nowItems.find((item) => item.name === "카시트");
    expect(carSeat).toBeDefined();

    const carSeatDetail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${carSeat!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { productLinks: ProductLink[] };
    const affiliateLink = carSeatDetail.productLinks.find((link) => link.isAffiliate);
    expect(affiliateLink).toBeDefined();

    // Simulate a stored link whose redirect URL is unsafe (e.g. legacy data or a bypassed
    // guard) to prove clickProductLink validates the URL before recording the click log,
    // rather than logging first and only rejecting the redirect afterward.
    const prisma = moduleRef.get(PrismaService);
    const storedLink = await prisma.productLink.findUniqueOrThrow({ where: { id: affiliateLink!.id } });
    const originalUrl = storedLink.url;
    const originalAffiliateUrl = storedLink.affiliateUrl;
    await prisma.productLink.update({
      where: { id: affiliateLink!.id },
      data: { url: "javascript:alert(1)", affiliateUrl: null }
    });

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/product-links/${affiliateLink!.id}/click`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ childId, referrerScreenId: "ITEM-003" })
        .expect(400)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("PRODUCT_LINK_URL_SCHEME_INVALID");
        });

      // Scoped to this test's own childId (fresh per run) rather than just
      // productLinkId: product link ids come from deterministic seed data, so a
      // productLinkId-only query would also match affiliate_clicks rows left behind
      // by earlier runs of this same suite against the persistent test database.
      const clickEntries = await prisma.affiliateClick.findMany({ where: { productLinkId: affiliateLink!.id, childId } });
      expect(clickEntries).toHaveLength(0);
    } finally {
      await prisma.productLink.update({
        where: { id: affiliateLink!.id },
        data: { url: originalUrl, affiliateUrl: originalAffiliateUrl }
      });
    }
  });

  /**
   * ITEM-123 (B4): gifted 상태가 목록 API의 어느 탭에도 나오지 않아 앱에서 통째로
   * 사라지던 문제의 회귀 가드.
   *
   * 탭 배치 근거: 도메인(EXCLUDED_NOW_NEEDED_STATUSES)은 prepared/gifted/not_needed를
   * 함께 "지금 필요"에서 제외하지만, 그 안에서 gifted는 "선물로 받아 이미 손에 있다"라
   * 물건을 갖춘 prepared와 같은 계열이고 "필요 없다고 판단했다"인 not_needed와는 반대다.
   * 그래서 prepared 탭에 담고 not_needed 탭은 그대로 둔다.
   *
   * 하위호환: prepared 탭에 항목이 **추가**될 뿐 기존 prepared 항목이 빠지지 않고
   * (아래 두 항목 모두 검사), 상태 값 자체는 응답에 그대로 실려 기존 클라이언트가
   * status로 구분할 수 있다.
   */
  it("returns gifted items in the prepared tab (not not_needed) while keeping the tabs a disjoint cover", async () => {
    const accessToken = await login(app, "item123-gifted-tab");
    const { childId } = await completeOnboarding(app, accessToken);
    const authorized = (path: string) =>
      request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`).expect(200);

    const nowItems = (await authorized(`/api/v1/children/${childId}/items?tab=now`)).body.items as ItemSummary[];
    expect(nowItems.length).toBeGreaterThanOrEqual(3);
    const [giftedItem, preparedItem, notNeededItem] = nowItems;

    for (const [item, status] of [
      [giftedItem, "gifted"],
      [preparedItem, "prepared"],
      [notNeededItem, "not_needed"]
    ] as const) {
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}/items/${item.id}/status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status })
        .expect(200);
    }

    const preparedTab = (await authorized(`/api/v1/children/${childId}/items?tab=prepared`)).body.items as ItemSummary[];
    for (const item of preparedTab) {
      itemSummarySchema.parse(item);
    }
    // 선물 받은 항목이 준비완료 탭에 "선물 받음" 상태 그대로 실려 온다.
    expect(preparedTab).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: giftedItem.id, status: "gifted" })])
    );
    // 하위호환: 직접 준비한 항목은 종전대로 남아 있다.
    expect(preparedTab).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: preparedItem.id, status: "prepared" })])
    );

    // not_needed 탭은 넓히지 않는다 -- "필요 없다"와 "선물로 받았다"는 다른 판단이다.
    const notNeededTab = (await authorized(`/api/v1/children/${childId}/items?tab=not_needed`)).body
      .items as ItemSummary[];
    expect(notNeededTab.map((item) => item.id)).toEqual([notNeededItem.id]);
    expect(notNeededTab.map((item) => item.status)).not.toContain("gifted");

    // gifted는 "지금 필요"/"곧 필요"에서는 계속 빠진다(도메인 규칙 그대로).
    const nowAfter = (await authorized(`/api/v1/children/${childId}/items?tab=now`)).body.items as ItemSummary[];
    const soonAfter = (await authorized(`/api/v1/children/${childId}/items?tab=soon`)).body.items as ItemSummary[];
    expect([...nowAfter, ...soonAfter].map((item) => item.id)).not.toContain(giftedItem.id);

    // 네 탭은 여전히 서로소다(같은 항목이 두 탭에 동시에 나오지 않는다).
    const tabbedIds = [...nowAfter, ...soonAfter, ...preparedTab, ...notNeededTab].map((item) => item.id);
    expect(new Set(tabbedIds).size).toBe(tabbedIds.length);
  });

  /**
   * ITEM-123 (B5): 준비템 탭 1회 진입에 목록 1 + 준비율 스냅샷 4(탭별 Promise.all) +
   * 홈 1 = 6요청이 나가던 것을, 상태로 거르지 않는 tab=all 스냅샷으로 3요청으로 줄인다.
   * 이 테스트는 "all이 네 탭의 합집합과 정확히 같다"(밴드 미지정)를 고정해, 스냅샷을 1요청으로
   * 바꿔도 준비율의 분모가 달라지지 않음을 보증한다. stageBand가 붙으면 prepared/not_needed
   * 탭만 밴드로 좁으므로 all은 합집합의 상위집합이 된다 — 아래 FIX/F4 블록 참고.
   */
  it("serves the whole status snapshot in one request via tab=all (union of the four status tabs)", async () => {
    const accessToken = await login(app, "item123-tab-all");
    const { childId } = await completeOnboarding(app, accessToken);
    const authorized = (path: string) =>
      request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`).expect(200);

    const nowItems = (await authorized(`/api/v1/children/${childId}/items?tab=now`)).body.items as ItemSummary[];
    const [giftedItem, notNeededItem] = nowItems;
    for (const [item, status] of [
      [giftedItem, "gifted"],
      [notNeededItem, "not_needed"]
    ] as const) {
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}/items/${item.id}/status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status })
        .expect(200);
    }

    const tabs = ["now", "soon", "prepared", "not_needed"] as const;
    const unionIds = new Set<string>();
    for (const tab of tabs) {
      const items = (await authorized(`/api/v1/children/${childId}/items?tab=${tab}`)).body.items as ItemSummary[];
      for (const item of items) unionIds.add(item.id);
    }

    const allItems = (await authorized(`/api/v1/children/${childId}/items?tab=all`)).body.items as ItemSummary[];
    for (const item of allItems) {
      itemSummarySchema.parse(item);
    }
    // 중복 없이 한 번씩, 그리고 네 탭 합집합과 같은 집합이다.
    expect(new Set(allItems.map((item) => item.id)).size).toBe(allItems.length);
    expect(new Set(allItems.map((item) => item.id))).toEqual(unionIds);
    // 상태는 그대로 실려 온다 -- 준비율이 해결됨/미해결을 이 값으로 가른다.
    expect(allItems.find((item) => item.id === giftedItem.id)?.status).toBe("gifted");
    expect(allItems.find((item) => item.id === notNeededItem.id)?.status).toBe("not_needed");

    // FIX/F4: stageBand가 붙어도 all은 네 탭의 합집합을 빠짐없이 담는다. 예전에는 all에도
    // 밴드 필터를 걸어서, 밴드의 여집합인 soon 탭 항목이 스냅샷에서 통째로 빠졌다
    // (준비율의 분모도 그만큼 줄었다). now/soon은 서로 여집합이라 두 탭의 합집합이 이미
    // 전 시기이므로, all은 밴드를 무시하는 것이 합집합 정의와 맞는다.
    const band = encodeURIComponent("24개월+");
    const bandUnionIds = new Set<string>();
    for (const tab of tabs) {
      const items = (await authorized(`/api/v1/children/${childId}/items?tab=${tab}&stageBand=${band}`)).body
        .items as ItemSummary[];
      for (const item of items) bandUnionIds.add(item.id);
    }
    const bandSoon = (await authorized(`/api/v1/children/${childId}/items?tab=soon&stageBand=${band}`)).body
      .items as ItemSummary[];
    // 회귀 가드: 밴드 밖(=soon)의 항목이 실제로 존재하는 상황에서만 의미 있는 검증이다.
    expect(bandSoon.length).toBeGreaterThan(0);

    const bandItems = (await authorized(`/api/v1/children/${childId}/items?tab=all&stageBand=${band}`)).body
      .items as ItemSummary[];
    const bandItemIds = new Set(bandItems.map((item) => item.id));
    expect(bandItemIds.size).toBe(bandItems.length);
    // 밴드가 있어도 스냅샷은 밴드 없는 all과 같은 집합이고, 네 탭 합집합을 모두 포함한다.
    expect(bandItemIds).toEqual(new Set(allItems.map((item) => item.id)));
    for (const item of bandSoon) {
      expect(bandItemIds.has(item.id)).toBe(true);
    }
    for (const id of bandUnionIds) {
      expect(bandItemIds.has(id)).toBe(true);
    }

    // 하위호환: 알 수 없는 tab 값은 종전처럼 400이다(허용 값만 늘어났다).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=everything`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });
});
