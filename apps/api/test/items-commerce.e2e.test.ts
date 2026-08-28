import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  affiliateClickResponseSchema,
  errorResponseSchema,
  itemDetailSchema,
  itemSummarySchema,
  productLinkSchema
} from "@wooriai/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * TEST-131: 이 파일은 더 이상 공유 DB 락을 배타로 잡지 않는다
 * (test/helpers/db-lock.setup.ts). 배타를 뗄 수 있었던 근거 셋을 여기 모아 둔다.
 *
 * 1) 이 스위트가 만드는 카탈로그 행(준비템/상품 링크)은 전부 아래 접두를 달고, 크래시로
 *    정리를 못 했더라도 다음 실행의 beforeAll이 선제적으로 지운다. 남은 활성 준비템이
 *    다른 스위트의 목록 스냅샷에 슬쩍 끼어드는 오염이 누적되지 않는다.
 * 2) 클릭 가드(도메인 허용목록 / URL 스킴) 두 테스트는 예전에 **시드된** 상품 링크의
 *    url을 잠깐 악성 값으로 덮어썼다가 되돌렸다. 병렬 실행에서는 그 찰나에 다른
 *    스위트(core-loop 등)가 같은 시드 링크를 클릭하면 엉뚱하게 404/400을 받는다.
 *    이제 두 테스트는 자기 준비템+링크를 만들어서 검증한다 — 가드는 링크 행 하나를
 *    기준으로 도므로 검증하는 코드 경로도 단언의 정확도도 그대로다.
 * 3) `tab=all`이 네 탭의 합집합과 같은지 보는 테스트는 두 스냅샷 사이에 다른 스위트가
 *    준비템을 만들거나 지우면 흔들렸다. 이제 테스트 시작/끝 카탈로그의 교집합(=이
 *    테스트가 도는 내내 존재가 확정된 행)으로 양쪽을 좁혀서 비교한다. "이상"으로
 *    무르게 만든 것이 아니라, 모집단을 확정한 뒤 그 안에서 **정확한 집합 일치**를
 *    그대로 요구한다.
 */
/** 이 파일이 직접 만드는 준비템 코드 접두 (잔여물 선제 정리용 식별자). */
const OWN_TEMPLATE_CODE_PREFIX = "items_commerce_test_";
/** 어드민 API로 만드는 준비템은 코드가 서버 생성이라, 이름을 잔여물 식별자로 쓴다. */
const ADM124_TEMPLATE_NAME = "ADM-124 가격대 편집 테스트템";
/** 라운드 48 T1: 의료 상담 안내 플래그 왕복 테스트가 만드는 준비템(같은 잔여물 관례). */
const R48_MEDICAL_TEMPLATE_NAME = "R48-T1 의료 안내 테스트템";

/**
 * 이전 실행이 남긴 이 파일 소유의 카탈로그 행을 지운다. 자기 접두/이름에 걸리는 행만
 * 건드리므로 시드나 다른 스위트의 데이터는 절대 지우지 않는다.
 *
 * R31 리뷰 F6 (자가 봉쇄 예방): 마이그레이션 000001은 Prisma 스키마에 없는 진짜 SQL FK를
 * 만든다. item_templates / product_links를 **캐스케이드 없이** 참조하는 것은
 * `expenses.linked_item_template_id`와 `expenses.linked_product_link_id` 둘뿐이고,
 * 지금은 이 스위트가 자기 준비템에 지출을 연결하지 않으므로 도달 불가 경로다. 하지만
 * 한 번이라도 연결되는 순간 정리가 FK 위반으로 실패하고, 그 뒤로는 남은 잔여물이 매
 * 실행을 막는 자가 봉쇄가 된다 — 남의 행을 지우지 않으려고 **null로 끊기만** 한다
 * (지출 자체는 다른 스위트/사용자 소유일 수 있어 삭제하지 않는다).
 *
 * ⚠ 이 스위트가 나중에 자기 준비템/링크를 import_rows·attachments 같은 다른 테이블에
 * 연결하게 되면 이 헬퍼도 같이 넓혀야 한다. (현재 그 둘은 expenses(id)만 참조하고
 * 카탈로그 행은 참조하지 않는다.)
 */
async function removeOwnCatalogLeftovers(prisma: PrismaClient) {
  const leftovers = await prisma.itemTemplate.findMany({
    where: {
      OR: [
        { code: { startsWith: OWN_TEMPLATE_CODE_PREFIX } },
        { name: ADM124_TEMPLATE_NAME },
        { name: R48_MEDICAL_TEMPLATE_NAME }
      ]
    },
    select: { id: true }
  });
  if (leftovers.length === 0) return;

  const templateIds = leftovers.map((template) => template.id);
  const itemTemplateId = { in: templateIds };
  const ownLinks = await prisma.productLink.findMany({ where: { itemTemplateId }, select: { id: true } });
  await detachExpenseLinks(prisma, templateIds, ownLinks.map((link) => link.id));
  await prisma.affiliateClick.deleteMany({ where: { itemTemplateId } });
  await prisma.childItemStatus.deleteMany({ where: { itemTemplateId } });
  await prisma.productLink.deleteMany({ where: { itemTemplateId } });
  await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
  await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
}

/**
 * 카탈로그 행을 지우기 전에, 그 행을 캐스케이드 없이 가리키는 지출의 링크 컬럼을 끊는다.
 * 위 removeOwnCatalogLeftovers 주석의 FK 설명 참고.
 */
async function detachExpenseLinks(prisma: PrismaClient, templateIds: string[], productLinkIds: string[]) {
  if (templateIds.length > 0) {
    await prisma.expense.updateMany({
      where: { linkedItemTemplateId: { in: templateIds } },
      data: { linkedItemTemplateId: null }
    });
  }
  if (productLinkIds.length > 0) {
    await prisma.expense.updateMany({
      where: { linkedProductLinkId: { in: productLinkIds } },
      data: { linkedProductLinkId: null }
    });
  }
}

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
  let cleanupPrisma: PrismaClient;

  beforeAll(async () => {
    cleanupPrisma = new PrismaClient();
    await removeOwnCatalogLeftovers(cleanupPrisma);
  });

  afterAll(async () => {
    // 정상 종료 경로에서도 한 번 더 — 개별 테스트의 finally가 하나라도 빠지면
    // 여기서 걸러진다.
    await removeOwnCatalogLeftovers(cleanupPrisma);
    await cleanupPrisma.$disconnect();
  });

  /**
   * 클릭 가드 검증용 일회용 준비템 + 상품 링크. 시기(stage) 행을 일부러 만들지 않는다.
   *
   * R31 리뷰 F3: 예전 주석은 "시기가 없는 준비템은 다른 스위트의 목록에 안 뜬다"고
   * 적었는데 그건 사실이 아니다. 시기 없는 항목은 `tab=now`(와 홈 추천)에서만 빠진다 —
   * `soon`은 now의 여집합이라 오히려 반드시 들어가고, `tab=all`은 시기로 거르지 않으니
   * 역시 들어간다(src/onboarding/item-ranking.ts의 `matchesTab`).
   *
   * 그래도 무해한 이유는 두 가지다. (1) 이 픽스처는 테스트 하나의 try/finally 안에서만
   * 살아 있고(수 밀리초), (2) `soon`/`all`을 보는 다른 스위트의 단언이 전부 관대하다 —
   * 자기 id 포함/제외나 `length > 0`을 보지, 정확 개수나 집합 일치를 요구하지 않는다.
   * 그래서 여기 목적은 "안 뜬다"가 아니라 **정확 개수를 요구하는 now/홈 추천 경로에서
   * 빠진다**는 것이다. soon/all에 정확 집합 단언을 새로 추가하는 스위트가 생기면 이
   * 픽스처가 그 단언을 흔들 수 있으니, 그때는 시기 대신 다른 격리 수단을 찾아야 한다.
   *
   * healthCheckedAt을 미리 채워 두는 것도 같은 성격의 배려 — link-health.db 스위트의
   * 후보 배치에 끼지 않는다(그쪽은 TEST-132 이후 자기 링크만 보므로 지금은 여분이다).
   */
  async function createOwnClickFixture(
    prisma: PrismaService,
    link: { url: string; affiliateUrl: string | null }
  ): Promise<{ templateId: string; linkId: string }> {
    const template = await prisma.itemTemplate.create({
      data: {
        code: `${OWN_TEMPLATE_CODE_PREFIX}${randomUUID()}`,
        name: "클릭 가드 테스트 준비템",
        necessityLevel: "essential",
        reasonText: "클릭 가드(도메인 허용목록 / URL 스킴) 검증 전용 픽스처.",
        active: true
      }
    });
    const productLink = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "coupang",
        title: "클릭 가드 테스트 링크",
        url: link.url,
        affiliateUrl: link.affiliateUrl,
        isAffiliate: true,
        active: true,
        healthStatus: "ok",
        healthCheckedAt: new Date()
      }
    });
    return { templateId: template.id, linkId: productLink.id };
  }

  async function removeOwnClickFixture(prisma: PrismaService, fixture: { templateId: string }) {
    await prisma.affiliateClick.deleteMany({ where: { itemTemplateId: fixture.templateId } });
    await prisma.productLink.deleteMany({ where: { itemTemplateId: fixture.templateId } });
    await prisma.itemTemplate.deleteMany({ where: { id: fixture.templateId } });
  }

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

  it("pushes health-broken links to the end of the item detail without changing the response shape (UX-W C1)", async () => {
    const accessToken = await login(app, "batch07-link-health-order");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = moduleRef.get(PrismaService);

    // 시기(stage) 행 없이 만든 일회용 준비템 — now/홈 추천의 정확 개수 단언에 끼지 않는다
    // (createOwnClickFixture 주석의 근거 그대로). 상세 조회는 시기와 무관하므로 충분하다.
    const template = await prisma.itemTemplate.create({
      data: {
        code: `${OWN_TEMPLATE_CODE_PREFIX}${randomUUID()}`,
        name: "링크 헬스 정렬 테스트 준비템",
        necessityLevel: "essential",
        reasonText: "UX-W(C1) 링크 헬스 정렬 검증 전용 픽스처.",
        active: true
      }
    });

    // affiliateUrl을 비워 두어 link-health 워커의 후보 조건(affiliateUrl != null)에서 빠진다.
    const linkFixtures = [
      { displayOrder: 10, title: "깨진 링크", healthStatus: "broken" },
      { displayOrder: 20, title: "정상 링크", healthStatus: "ok" },
      { displayOrder: 30, title: "불안정 링크", healthStatus: "unstable" },
      { displayOrder: 40, title: "미확인 링크", healthStatus: null }
    ];

    try {
      for (const fixture of linkFixtures) {
        await prisma.productLink.create({
          data: {
            itemTemplateId: template.id,
            platform: "coupang",
            title: fixture.title,
            url: `https://example.com/dev/link/${fixture.displayOrder}`,
            affiliateUrl: null,
            isAffiliate: false,
            isSponsored: false,
            displayOrder: fixture.displayOrder,
            active: true,
            healthStatus: fixture.healthStatus,
            healthCheckedAt: fixture.healthStatus ? new Date() : null
          }
        });
      }

      const detail = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${template.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as { productLinks: ProductLink[] };

      // 계약 무변경: 상세 응답 전체가 종전 스키마 그대로여야 한다.
      itemDetailSchema.parse(detail);

      // 깨진 링크는 맨 뒤. 불안정은 그 앞(일시적 실패라 워커가 다음 회차에 재확인한다).
      // ok/미확인은 강등하지 않으므로 둘 사이 순서는 displayOrder 그대로(20 -> 40).
      expect(detail.productLinks.map((link) => link.title)).toEqual([
        "정상 링크",
        "미확인 링크",
        "불안정 링크",
        "깨진 링크"
      ]);
      // 개수 불변 — 정렬일 뿐 필터가 아니다.
      expect(detail.productLinks).toHaveLength(linkFixtures.length);
      // DTO에 health가 새어 나가지 않는다(어드민 응답 전용 필드).
      for (const link of detail.productLinks) {
        expect(link).not.toHaveProperty("healthStatus");
        expect(link).not.toHaveProperty("healthCheckedAt");
      }
    } finally {
      await prisma.productLink.deleteMany({ where: { itemTemplateId: template.id } });
      await prisma.childItemStatus.deleteMany({ where: { itemTemplateId: template.id } });
      await prisma.itemTemplate.deleteMany({ where: { id: template.id } });
    }
  });

  it("rejects a click on a product link whose target domain is not on the affiliate allowlist, and does not log it", async () => {
    const accessToken = await login(app, "batch07-click-domain-blocked");
    const { childId } = await completeOnboarding(app, accessToken);

    // The dev/test allowlist fallback includes example.com so seeded fixtures normally pass;
    // point this link at a domain nowhere near the allowlist (including lookalikes such as
    // "coupang.com.evil.com") to exercise the rejection path.
    //
    // TEST-131: 예전에는 **시드된** 제휴 링크의 url을 이 값으로 잠깐 덮어썼다. 가드는
    // 링크 행 단위로 돌기 때문에 자기 링크로 검증해도 같은 코드 경로를 지나며, 시드 행을
    // 건드리지 않으니 같은 링크를 클릭하는 다른 스위트를 병렬 실행에서 깨뜨리지 않는다.
    const prisma = moduleRef.get(PrismaService);
    const fixture = await createOwnClickFixture(prisma, {
      url: "https://coupang.com.evil-lookalike.net/x",
      affiliateUrl: "https://coupang.com.evil-lookalike.net/x"
    });

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/product-links/${fixture.linkId}/click`)
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

      const clickEntries = await prisma.affiliateClick.findMany({ where: { productLinkId: fixture.linkId } });
      expect(clickEntries).toHaveLength(0);
    } finally {
      await removeOwnClickFixture(prisma, fixture);
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

    // Simulate a stored link whose redirect URL is unsafe (e.g. legacy data or a bypassed
    // guard) to prove clickProductLink validates the URL before recording the click log,
    // rather than logging first and only rejecting the redirect afterward.
    //
    // TEST-131: 위 도메인 가드 테스트와 같은 이유로 시드 링크를 덮어쓰는 대신 자기 링크를
    // 만든다. 링크 id가 이 실행에만 존재하므로 클릭 로그 단언도 productLinkId 하나로
    // 정확해진다 — 예전에는 시드 id를 재사용해서 childId까지 함께 걸러야 했다.
    const prisma = moduleRef.get(PrismaService);
    const fixture = await createOwnClickFixture(prisma, { url: "javascript:alert(1)", affiliateUrl: null });

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/product-links/${fixture.linkId}/click`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ childId, referrerScreenId: "ITEM-003" })
        .expect(400)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("PRODUCT_LINK_URL_SCHEME_INVALID");
        });

      const clickEntries = await prisma.affiliateClick.findMany({ where: { productLinkId: fixture.linkId } });
      expect(clickEntries).toHaveLength(0);
    } finally {
      await removeOwnClickFixture(prisma, fixture);
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
    const tabs = ["now", "soon", "prepared", "not_needed"] as const;
    const idsOfTab = async (query: string) =>
      ((await authorized(`/api/v1/children/${childId}/items?${query}`)).body.items as ItemSummary[]).map(
        (item) => item.id
      );
    const idsOfAll = async () => new Set(await idsOfTab("tab=all"));
    const idsOfStatusTabUnion = async () => {
      const ids = new Set<string>();
      for (const tab of tabs) {
        for (const id of await idsOfTab(`tab=${tab}`)) ids.add(id);
      }
      return ids;
    };

    // TEST-131: 이 테스트는 여러 번의 요청 결과를 서로 비교하는데, 이 파일은 더 이상
    // DB를 독점하지 않으므로 그 사이에 다른 스위트가 준비템을 만들거나 지울 수 있다.
    // 시작·끝 카탈로그의 교집합 = "이 테스트가 도는 내내 존재가 확정된 준비템"으로
    // 양쪽을 좁혀서 비교한다. 모집단만 확정할 뿐, 그 안에서는 부분집합/이상이 아니라
    // 예전과 똑같이 **정확한 집합 일치**를 요구한다.
    //
    // R31 리뷰 F2 (중요): 모집단을 `tab=all` **하나로만** 뽑으면 안 된다. 예전 코드가
    // 그랬는데, all이 항목을 빠뜨리는 회귀(= 이 테스트가 잡으려는 바로 그 버그)가 나면
    // 빠진 항목이 모집단에서도 함께 빠져서 양변이 다시 같아졌다 — 검증 대상이 자기
    // 채점표를 깎는 구조였다. 이제 모집단은 **비교하는 두 소스의 합집합**(네 상태 탭 ∪
    // all)에서 뽑는다. 어느 쪽도 모집단을 좁힐 수 없으므로,
    //   - all이 탭에 보이는 항목을 빠뜨리면 → 그 항목은 여전히 모집단에 있고 등식이 깨진다,
    //   - all이 어느 탭에도 없는 항목을 더 담으면 → 그 항목도 모집단에 있어 등식이 깨진다.
    const catalogSnapshot = async () => new Set([...(await idsOfStatusTabUnion()), ...(await idsOfAll())]);
    const catalogAtStart = await catalogSnapshot();
    /** 모집단(stable) 확정은 테스트 끝에서 이뤄지므로, 비교는 그 뒤에 몰아서 한다. */
    const scopedTo = (stable: Set<string>, ids: Iterable<string>) =>
      new Set([...ids].filter((id) => stable.has(id)));

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

    const unionIds = await idsOfStatusTabUnion();

    const allItems = (await authorized(`/api/v1/children/${childId}/items?tab=all`)).body.items as ItemSummary[];
    for (const item of allItems) {
      itemSummarySchema.parse(item);
    }
    const allIds = new Set(allItems.map((item) => item.id));
    // 중복 없이 한 번씩 (모집단과 무관한 응답 자체의 성질).
    expect(allIds.size).toBe(allItems.length);
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

    // 모든 스냅샷을 다 찍은 뒤에야 모집단이 확정된다: 시작과 끝 카탈로그에 모두 있던
    // 준비템 = 이 테스트가 도는 내내 존재가 확정된 행. 그 밖(= 다른 스위트가 중간에
    // 만들었거나 지운 행)은 어느 쪽 집합에서도 빼고 비교한다.
    const catalogAtEnd = await catalogSnapshot();
    const stable = scopedTo(catalogAtStart, catalogAtEnd);
    // R31 리뷰 F2: `> 0`은 vacuous 통과를 거의 못 막는다 — 모집단이 한두 개로 쪼그라들어도
    // 아래 집합 등식이 자동으로 참이 된다. 시드만으로 활성 준비템이 62개 있고 이 테스트는
    // 그중 아무것도 지우지 않으므로, 모집단이 30개에도 못 미치면 스냅샷이 아니라 환경
    // (시드 누락/다른 스위트의 대량 삭제)이 깨진 것이다. 시드가 줄면 이 하한도 함께 낮춘다.
    expect(stable.size).toBeGreaterThanOrEqual(30);
    const scoped = (ids: Iterable<string>) => scopedTo(stable, ids);

    // all은 네 탭 합집합과 정확히 같은 집합이다.
    expect(scoped(allIds)).toEqual(scoped(unionIds));
    // 밴드가 있어도 스냅샷은 밴드 없는 all과 같은 집합이고, 네 탭 합집합을 모두 포함한다.
    expect(scoped(bandItemIds)).toEqual(scoped(allIds));
    for (const id of scoped(bandSoon.map((item) => item.id))) {
      expect(bandItemIds.has(id)).toBe(true);
    }
    for (const id of scoped(bandUnionIds)) {
      expect(bandItemIds.has(id)).toBe(true);
    }

    // 하위호환: 알 수 없는 tab 값은 종전처럼 400이다(허용 값만 늘어났다).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=everything`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });

  /**
   * ADM-124: 어드민 준비템 편집 폼의 가격대 왕복(프리필 -> 삭제 -> 재설정).
   *
   * 예전에는 어드민 응답에 표시용 문구(priceBandText)만 있어서 수정 폼의 가격 칸이 늘
   * 빈칸으로 열렸고, 빈칸은 아예 전송되지 않아 "값을 바꾸지 않음"과 "값을 지움"을 구분할
   * 수 없었다 — 한 번 넣은 가격대를 지울 방법이 없었다. 서버 쪽 계약 두 가지를 고정한다:
   *  - 어드민 DTO가 원시 값(priceMinKrw/priceMaxKrw)을 함께 준다(폼 프리필의 재료).
   *  - PATCH에서 필드 생략 = 그대로 두기, null = 지우기(timingLabel/safetyNote의 ""->null과 같은 관례).
   * 앱용 DTO(itemSummary/itemDetail)는 그대로다 — 아래에서 원시 가격 필드가 새어 나가지
   * 않는 것까지 확인한다(DNC-006 계약 불변).
   */
  it("exposes raw price bounds to the admin catalog DTO and lets a PATCH clear them with null", async () => {
    const adminToken = "test-admin-token-adm124";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    const accessToken = await login(app, "adm124-price-band");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = moduleRef.get(PrismaService);
    const asAdmin = (req: request.Test) => req.set("x-admin-token", adminToken);

    const created = (
      await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/item-templates"))
        .send({
          name: ADM124_TEMPLATE_NAME,
          necessityLevel: "essential",
          reasonText: "가격대 프리필/삭제 왕복 고정용.",
          priceMinKrw: 30000,
          priceMaxKrw: 50000,
          // TEST-131: 시기는 검증 대상이 아니지만 어드민 API가 생략 시 infant_4_6(테스트
          // 아이들이 가장 많이 쓰는 시기)을 붙이므로 명시한다. 아기 시기 아이만 만드는
          // 이 저장소의 다른 스위트에서는 이 준비템이 `tab=now`(와 홈 추천)에 뜨지 않는다 —
          // R31 리뷰 F3: `soon`(now의 여집합)과 `tab=all`에는 뜬다. 그쪽 단언은 자기 id
          // 포함/제외나 length>0 수준이라 무해하고, 이 행은 아래 finally에서 곧 사라진다.
          stageCodes: ["middle_school"],
          active: true
        })
        .expect(200)
    ).body as { id: string; priceMinKrw: number | null; priceMaxKrw: number | null; priceBandText?: string };

    try {
      expect(created).toMatchObject({
        priceMinKrw: 30000,
        priceMaxKrw: 50000,
        priceBandText: "30,000~50,000원"
      });

      // 목록(폼이 프리필에 쓰는 응답)에도 원시 값이 실린다.
      const listed = (
        await asAdmin(request(app.getHttpServer()).get("/api/v1/admin/item-templates")).expect(200)
      ).body.items as Array<{ id: string; priceMinKrw: number | null; priceMaxKrw: number | null }>;
      expect(listed.find((entry) => entry.id === created.id)).toMatchObject({
        priceMinKrw: 30000,
        priceMaxKrw: 50000
      });

      // 앱용 DTO는 넓어지지 않는다: 원시 가격 필드는 어드민 응답에만 있다.
      const appItem = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${created.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as Record<string, unknown>;
      itemDetailSchema.parse(appItem);
      expect(appItem.priceBandText).toBe("30,000~50,000원");
      expect(appItem).not.toHaveProperty("priceMinKrw");
      expect(appItem).not.toHaveProperty("priceMaxKrw");

      // 필드를 생략한 PATCH는 가격대를 건드리지 않는다(부분 수정 그대로).
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.id}`))
        .send({ reasonText: "가격대와 무관한 수정." })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ priceMinKrw: 30000, priceMaxKrw: 50000 });
        });

      // null은 "지움"이다 — 표시 문구도 함께 사라진다.
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.id}`))
        .send({ priceMinKrw: null, priceMaxKrw: null })
        .expect(200)
        .expect(({ body }) => {
          expect(body.priceMinKrw).toBeNull();
          expect(body.priceMaxKrw).toBeNull();
          expect(body.priceBandText).toBeUndefined();
        });
      const cleared = await prisma.itemTemplate.findUniqueOrThrow({ where: { id: created.id } });
      expect([cleared.priceMinKrw, cleared.priceMaxKrw]).toEqual([null, null]);

      // 왕복: 다시 넣으면 그대로 돌아온다(한쪽만 넣는 것도 가능하다).
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.id}`))
        .send({ priceMinKrw: 12000, priceMaxKrw: null })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ priceMinKrw: 12000, priceMaxKrw: null, priceBandText: "12,000원부터" });
        });
    } finally {
      // 테스트 DB는 실행 간 유지되므로 이 템플릿이 다른 스위트의 카탈로그에 남지 않게 정리한다.
      await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId: created.id } });
      await prisma.itemTemplate.delete({ where: { id: created.id } });
      delete process.env.WOORIAI_ADMIN_TOKEN;
    }
  });

  /**
   * 라운드 48 T1(A2): `medicalDisclaimerRequired`를 계약에 올린다.
   *
   * 이 필드는 DB 스키마(item_templates.medical_disclaimer_required)와 시드(영양제·철분제 등
   * 4건)에는 처음부터 있었지만 **어떤 응답에도 실리지 않아** 앱도 어드민도 볼 수 없었다 —
   * 의료/영양제 성격 준비템에 "구매 전 의사·약사와 상담해 주세요"를 띄울 근거가 서버에
   * 있는데 쓰이지 않은 셈이다(DNC-020).
   *
   * 여기서 고정하는 것 세 가지:
   *  - 앱 상세 DTO가 값을 그대로 내보낸다(시드 데이터로 확인 — 앱이 지어낸 값이 아니다).
   *  - 어드민 생성/목록 DTO가 값을 왕복시켜 운영자가 켜고 끌 수 있다.
   *  - PATCH 관례는 usedSecondhandOk와 같다: 생략 = 그대로 두기, 보내면 그 값.
   */
  it("exposes medicalDisclaimerRequired on the item detail and lets the admin catalog round-trip it", async () => {
    const adminToken = "test-admin-token-r48-t1";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    const accessToken = await login(app, "r48-t1-medical-disclaimer");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = moduleRef.get(PrismaService);
    const asAdmin = (req: request.Test) => req.set("x-admin-token", adminToken);

    // (1) 시드에 이미 true인 준비템이 있고, 앱 상세가 그 값을 그대로 준다.
    const seededMedicalItem = await prisma.itemTemplate.findFirst({
      where: { medicalDisclaimerRequired: true, active: true },
      orderBy: { displayOrder: "asc" }
    });
    expect(seededMedicalItem, "시드에 의료 안내 대상 준비템이 있어야 한다").not.toBeNull();
    const seededDetail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${seededMedicalItem!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as Record<string, unknown>;
    itemDetailSchema.parse(seededDetail);
    expect(seededDetail.medicalDisclaimerRequired).toBe(true);
    // DNC-020: 서버는 표시 여부만 알려 준다 — 효능/필요 여부를 단정하는 문구는 만들지 않는다.
    expect(seededDetail).not.toHaveProperty("medicalDisclaimerText");

    const created = (
      await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/item-templates"))
        .send({
          name: R48_MEDICAL_TEMPLATE_NAME,
          necessityLevel: "essential",
          reasonText: "의료 상담 안내 플래그 왕복 고정용.",
          safetyNote: "복용 전 성분을 확인해 주세요.",
          medicalDisclaimerRequired: true,
          // ADM-124 테스트와 같은 격리: 아기 시기 아이만 만드는 다른 스위트의 now/홈 추천에
          // 끼지 않도록 관계 없는 시기를 붙인다.
          stageCodes: ["middle_school"],
          active: true
        })
        .expect(200)
    ).body as { id: string; medicalDisclaimerRequired: boolean };

    try {
      // (2) 어드민 생성 응답과 목록(편집 폼 프리필의 재료)에 값이 실린다.
      expect(created.medicalDisclaimerRequired).toBe(true);
      const listed = (
        await asAdmin(request(app.getHttpServer()).get("/api/v1/admin/item-templates")).expect(200)
      ).body.items as Array<{ id: string; medicalDisclaimerRequired: boolean }>;
      expect(listed.find((entry) => entry.id === created.id)?.medicalDisclaimerRequired).toBe(true);

      // 앱 상세도 같은 값을 본다(어드민이 켠 것이 그대로 사용자 화면 근거가 된다).
      const appItem = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${created.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as Record<string, unknown>;
      itemDetailSchema.parse(appItem);
      expect(appItem.medicalDisclaimerRequired).toBe(true);

      // (3) 필드를 생략한 PATCH는 값을 건드리지 않는다.
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.id}`))
        .send({ reasonText: "플래그와 무관한 수정." })
        .expect(200)
        .expect(({ body }) => {
          expect(body.medicalDisclaimerRequired).toBe(true);
        });

      // 끄는 것도 같은 경로다 — 잘못 켠 표시를 운영자가 되돌릴 수 있어야 한다.
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.id}`))
        .send({ medicalDisclaimerRequired: false })
        .expect(200)
        .expect(({ body }) => {
          expect(body.medicalDisclaimerRequired).toBe(false);
        });
      const stored = await prisma.itemTemplate.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.medicalDisclaimerRequired).toBe(false);

      const clearedAppItem = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${created.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as Record<string, unknown>;
      expect(clearedAppItem.medicalDisclaimerRequired).toBe(false);
    } finally {
      await prisma.childItemStatus.deleteMany({ where: { itemTemplateId: created.id } });
      await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId: created.id } });
      await prisma.itemTemplate.delete({ where: { id: created.id } });
      delete process.env.WOORIAI_ADMIN_TOKEN;
    }
  });

  /**
   * UX-X(R43) M-5: 어드민 준비템 목록의 "링크 수"는 사용자 관점이어야 한다.
   *
   * 종전에는 어드민 화면이 productLinks.length를 그대로 셌다 — 링크가 전부 비활성인
   * 준비템도 "링크 1"로 보이고 '상품 링크 없음만 보기' 필터에서도 빠져서, 사용자에겐
   * 구매처가 0인 지점(핵심 루프가 끊기는 지점)이 운영자 눈에 안 띄었다. 서버가
   * activeLinkCount를 함께 내려 그 정의를 한 곳에서 정한다. productLinks 자체는
   * 비활성 링크까지 그대로 실린다 — 어드민은 내려둔 링크를 되살릴 수 있어야 한다.
   */
  it("reports a user-visible activeLinkCount next to the full productLinks list (admin catalog)", async () => {
    const adminToken = "test-admin-token-r43-m5";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    const prisma = moduleRef.get(PrismaService);

    // 이 파일 소유 접두를 달아 두면 크래시로 정리를 못 해도 다음 실행 beforeAll이 지운다.
    const template = await prisma.itemTemplate.create({
      data: {
        code: `${OWN_TEMPLATE_CODE_PREFIX}m5_${randomUUID()}`,
        name: "R43-M5 비활성 링크만 있는 준비템",
        necessityLevel: "optional",
        reasonText: "활성 링크 수 계약 고정용.",
        active: true
      }
    });

    try {
      // 같은 준비템에 비활성 2개 + 활성 1개.
      for (const [index, active] of [false, false, true].entries()) {
        await prisma.productLink.create({
          data: {
            itemTemplateId: template.id,
            platform: "custom",
            title: `r43-m5 link ${index}`,
            url: `https://example.com/r43-m5-${index}`,
            displayOrder: index,
            active
          }
        });
      }

      const listed = (
        await request(app.getHttpServer())
          .get("/api/v1/admin/item-templates")
          .set("x-admin-token", adminToken)
          .expect(200)
      ).body.items as Array<{ id: string; activeLinkCount: number; productLinks: Array<{ active: boolean }> }>;

      const withLinks = listed.find((entry) => entry.id === template.id);
      expect(withLinks?.activeLinkCount).toBe(1);
      // 어드민은 내려둔 링크도 봐야 한다 — 목록 자체는 좁히지 않는다.
      expect(withLinks?.productLinks).toHaveLength(3);

      // 전부 비활성으로 내리면 사용자 관점의 구매처는 0이 된다(링크 행은 그대로 3개).
      await prisma.productLink.updateMany({ where: { itemTemplateId: template.id }, data: { active: false } });
      const afterRetire = (
        await request(app.getHttpServer())
          .get("/api/v1/admin/item-templates")
          .set("x-admin-token", adminToken)
          .expect(200)
      ).body.items as Array<{ id: string; activeLinkCount: number; productLinks: unknown[] }>;
      const retired = afterRetire.find((entry) => entry.id === template.id);
      expect(retired?.activeLinkCount).toBe(0);
      expect(retired?.productLinks).toHaveLength(3);
    } finally {
      await prisma.productLink.deleteMany({ where: { itemTemplateId: template.id } });
      await prisma.itemTemplate.delete({ where: { id: template.id } });
      delete process.env.WOORIAI_ADMIN_TOKEN;
    }
  });

  /**
   * 라운드 49 C-02: `categoryId`가 앱 DTO(목록·상세·상태변경 응답)에 실린다.
   *
   * 시드 63개 준비템 전부가 실제 categories 행을 가리키는데(prisma/seed.ts seedItemTemplates)
   * 앱 DTO가 그 값을 버려서, "준비템 → 지출 기록" 프리필이 품목명만 넘기고 분류는 늘 기본
   * 타일로 떨어졌다. 값은 카테고리 목록에 실재하는 id여야 한다 — 앱이 그 id로 분류 타일을
   * 찾기 때문에, 어디에도 없는 uuid를 내려주면 조용히 무시되는 죽은 필드가 된다.
   */
  it("라운드 49 C-02: 준비템 DTO가 실재하는 categoryId를 목록·상세·상태변경 응답에 싣는다", async () => {
    const accessToken = await login(app, "r49c02-item-category");
    const { childId } = await completeOnboarding(app, accessToken);

    const categories = (
      await request(app.getHttpServer())
        .get("/api/v1/categories?includeAll=1")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.categories as Array<{ id: string }>;
    const categoryIds = new Set(categories.map((category) => category.id));
    expect(categoryIds.size).toBeGreaterThan(0);

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as Array<ItemSummary & { categoryId?: string }>;
    expect(nowItems.length).toBeGreaterThan(0);

    // 시드 준비템은 전부 분류를 갖고 있다 — 하나라도 비면 프리필이 그 항목에서만 조용히
    // 예전 동작으로 떨어진다.
    for (const item of nowItems) {
      itemSummarySchema.parse(item);
      expect(item.categoryId, `${item.name} carries a categoryId`).toBeDefined();
      expect(categoryIds.has(item.categoryId!), `${item.name}'s categoryId exists in /categories`).toBe(true);
    }

    const target = nowItems[0];
    const detail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${target.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { categoryId?: string };
    itemDetailSchema.parse(detail);
    expect(detail.categoryId).toBe(target.categoryId);

    // 상태 변경 응답도 같은 요약 DTO라 함께 실린다(목록이 갱신되기 전에 쓰는 화면이 있다).
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${target.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "interested" })
      .expect(200)
      .expect(({ body }) => {
        itemSummarySchema.parse(body);
        expect(body.categoryId).toBe(target.categoryId);
      });
  });

  /**
   * 라운드 49 C-04: 준비템 상세의 `linkedExpense` — 연결된 지출의 역방향 노출.
   *
   * `child_item_statuses.expense_id`는 지출 저장 경로가 예전부터 채우고 있었지만
   * (store-shared.ts markLinkedItemPrepared) 어느 응답에도 실리지 않아, 앱에서는
   * "지출 → 준비템"만 보이고 그 반대는 볼 길이 없었다.
   *
   * 두 번째 단언이 이 티켓의 핵심이다: **지출을 삭제하면 null로 사라져야 한다.** 삭제는
   * 소프트 삭제이고 연결(expense_id)을 되돌리지 않으므로, deleted_at 필터가 없으면 사용자가
   * 지운 지출의 금액이 준비템 상세에 계속 떠 있게 된다 — 총액과 어긋나는 허위 표시다.
   */
  it("라운드 49 C-04: 연결된 지출이 상세에 실리고, 그 지출을 삭제하면 null이 된다", async () => {
    const accessToken = await login(app, "r49c04-linked-expense");
    const { childId } = await completeOnboarding(app, accessToken);

    const categories = (
      await request(app.getHttpServer())
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.categories as Array<{ id: string }>;
    const categoryId = categories[0].id;

    const nowItems = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];
    const target = nowItems[0];
    expect(target).toBeDefined();

    // 연결 전에는 필드가 있어도 값이 없다 — "아직 기록 없음"과 "기록 있음"이 구분된다.
    const before = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${target.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { linkedExpense: unknown };
    itemDetailSchema.parse(before);
    expect(before.linkedExpense).toBeNull();

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 38500,
          spentOn: "2026-07-06",
          itemName: target.name,
          linkedItemTemplateId: target.id
        })
        .expect(200)
    ).body as { id: string; version: number };

    const afterLink = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${target.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { status: string; linkedExpense: { id: string; amountKrw: number; spentOn: string } | null };
    itemDetailSchema.parse(afterLink);
    // R19-B: 연결된 지출을 저장하면 그 준비템은 준비 완료가 된다 — 그 상태와 금액이 함께 보인다.
    expect(afterLink.status).toBe("prepared");
    expect(afterLink.linkedExpense).toEqual({ id: created.id, amountKrw: 38500, spentOn: "2026-07-06" });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=${created.version}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const afterDelete = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${target.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { status: string; linkedExpense: unknown };
    itemDetailSchema.parse(afterDelete);
    // 삭제한 지출의 금액을 계속 보여주면 허위다. 준비 상태 자체는 되돌리지 않는 기존 규칙
    // 그대로다(deleteExpense 주석) — 사라지는 것은 **금액 표시**뿐이다.
    expect(afterDelete.linkedExpense).toBeNull();
    expect(afterDelete.status).toBe("prepared");
  });
});
