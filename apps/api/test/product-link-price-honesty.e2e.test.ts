import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { productLinkSchema } from "@wooriai/contracts";
import { productLinkSeeds } from "../prisma/seed-data";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

/**
 * 라운드 51 #9 — 판매처별 가격의 **정직 계약** e2e. 화면 배선은 다음 라운드이고, 여기서
 * 고정하는 것은 서버가 무엇을 내려보내는가(그리고 무엇을 절대 내려보내지 않는가)다.
 *
 * 규칙(apps/api/src/onboarding/items-catalog.service.ts toProductLinkDto):
 *   - `priceCheckedAt`(000020)이 없으면 `priceSnapshotKrw`도 내려보내지 않는다.
 *     기준 시각 없는 스냅샷 가격은 사용자가 현재가로 읽으므로 그 자체가 허위다.
 *   - 반대로 가격 없이 시각만 있는 링크도 둘 다 생략한다(가리킬 값이 없는 시각).
 *   - 둘 다 있으면 둘 다 싣는다(가산 optional — 구버전 클라이언트 무영향).
 *
 * 그리고 DNC-009: 가격은 **표시 전용**이다. 준비템 목록의 순서에도, 한 준비템 안
 * 구매처 링크의 순서에도 가격이 유입되지 않음을 가격을 흔들어 확인한다.
 *
 * 이 스위트는 공유 DB 락을 배타로 잡지 않는다 — 읽고 쓰는 행이 모두 자기가 만든
 * 준비템/링크이고(아래 접두), 목록 단언도 "이 테스트가 만든 id들의 상대 순서"만 본다.
 */
const OWN_TEMPLATE_CODE_PREFIX = "price_honesty_test_";

type ProductLinkResponse = {
  id: string;
  title: string;
  priceSnapshotKrw?: number;
  priceCheckedAt?: string;
};

async function removeOwnLeftovers(prisma: PrismaClient) {
  const leftovers = await prisma.itemTemplate.findMany({
    where: { code: { startsWith: OWN_TEMPLATE_CODE_PREFIX } },
    select: { id: true }
  });
  if (leftovers.length === 0) return;
  const itemTemplateId = { in: leftovers.map((template) => template.id) };
  const links = await prisma.productLink.findMany({ where: { itemTemplateId }, select: { id: true } });
  // items-commerce.e2e.test.ts와 같은 이유(마이그레이션 000001의 진짜 FK). 남의 지출은
  // 지우지 않고 링크만 끊는다.
  await prisma.expense.updateMany({
    where: { linkedItemTemplateId: itemTemplateId },
    data: { linkedItemTemplateId: null }
  });
  if (links.length > 0) {
    await prisma.expense.updateMany({
      where: { linkedProductLinkId: { in: links.map((link) => link.id) } },
      data: { linkedProductLinkId: null }
    });
  }
  await prisma.affiliateClick.deleteMany({ where: { itemTemplateId } });
  await prisma.childItemStatus.deleteMany({ where: { itemTemplateId } });
  await prisma.productLink.deleteMany({ where: { itemTemplateId } });
  await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
  await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
}

async function login(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `price-honesty-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string): Promise<string> {
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

  return (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "가격이", stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200)
  ).body.id as string;
}

describe("상품 링크 가격 정직 계약 (라운드 51 #9)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;
  let accessToken: string;
  let childId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await removeOwnLeftovers(prisma);
  });

  afterAll(async () => {
    await removeOwnLeftovers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    accessToken = await login(app);
    childId = await completeOnboarding(app, accessToken);
  });

  afterEach(async () => {
    await app.close();
    await removeOwnLeftovers(prisma);
  });

  /** 활성 준비템 하나 + 링크 셋(둘 다 있음 / 가격만 / 시각만)을 만든다. */
  async function createFixture(checkedAt: Date) {
    const template = await prisma.itemTemplate.create({
      data: {
        code: `${OWN_TEMPLATE_CODE_PREFIX}${randomUUID()}`,
        name: "가격 정직 계약 테스트 준비템",
        necessityLevel: "essential",
        reasonText: "가격/확인 시각 노출 규칙 검증 전용 픽스처예요.",
        active: true
      }
    });
    // 시기(stage) 행을 일부러 만들지 않는다 — items-commerce.e2e.test.ts의 일회용 픽스처와
    // 같은 격리 관례다. 시기가 없으면 이 준비템은 `now` 탭과 홈 추천(정확 개수를 요구할 수
    // 있는 경로)에서 빠지고, 아래 목록 단언이 쓰는 `tab=all`은 시기로 거르지 않으므로 그대로
    // 보인다(src/onboarding/item-ranking.ts matchesTab).
    async function link(title: string, displayOrder: number, priceSnapshotKrw: number | null, priceCheckedAt: Date | null) {
      return await prisma.productLink.create({
        data: {
          itemTemplateId: template.id,
          platform: "custom",
          title,
          url: `https://example.com/${randomUUID()}`,
          isAffiliate: false,
          isSponsored: false,
          displayOrder,
          active: true,
          priceSnapshotKrw,
          priceCheckedAt,
          // 링크 헬스 강등(UX-W C1)이 순서에 끼어들지 않도록 셋 다 동일하게 둔다.
          healthStatus: "ok",
          healthCheckedAt: checkedAt
        }
      });
    }

    return {
      templateId: template.id,
      both: await link("둘 다 있는 링크", 0, 25_000, checkedAt),
      priceOnly: await link("가격만 있는 링크", 1, 99_000, null),
      dateOnly: await link("시각만 있는 링크", 2, null, checkedAt)
    };
  }

  async function fetchLinks(templateId: string): Promise<ProductLinkResponse[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${templateId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return response.body.productLinks as ProductLinkResponse[];
  }

  it("확인 시각이 있는 가격만 내려보내고, 반쪽짜리 값은 둘 다 생략한다", async () => {
    const checkedAt = new Date("2026-08-01T03:00:00.000Z");
    const fixture = await createFixture(checkedAt);

    const links = await fetchLinks(fixture.templateId);
    const byId = new Map(links.map((link) => [link.id, link]));

    // 응답 집합 자체는 그대로 — 가격 규칙은 링크를 숨기지 않는다(구매처가 사라지면
    // 핵심 루프가 끊긴다). 숨기는 것은 "말할 수 없는 값"뿐이다.
    expect(byId.has(fixture.both.id)).toBe(true);
    expect(byId.has(fixture.priceOnly.id)).toBe(true);
    expect(byId.has(fixture.dateOnly.id)).toBe(true);

    // 1) 가격 + 확인 시각이 모두 있는 링크: 둘 다 실린다.
    expect(byId.get(fixture.both.id)).toMatchObject({
      priceSnapshotKrw: 25_000,
      priceCheckedAt: checkedAt.toISOString()
    });

    // 2) 가격만 있고 확인 시각이 없는 링크: **가격도 내려보내지 않는다**. 이 한 줄이
    //    이 라운드의 핵심 — 기준 시각 없는 가격은 표시할 수 없는 값이다.
    expect(byId.get(fixture.priceOnly.id)).not.toHaveProperty("priceSnapshotKrw");
    expect(byId.get(fixture.priceOnly.id)).not.toHaveProperty("priceCheckedAt");

    // 3) 확인 시각만 있고 가격이 없는 링크: 가리킬 값이 없으므로 시각도 생략한다.
    expect(byId.get(fixture.dateOnly.id)).not.toHaveProperty("priceSnapshotKrw");
    expect(byId.get(fixture.dateOnly.id)).not.toHaveProperty("priceCheckedAt");

    // 계약(packages/contracts productLinkSchema)도 같은 규칙을 거절선으로 갖는다 —
    // 한쪽만 실린 링크는 여기서 파싱이 실패한다.
    for (const link of links) {
      expect(() => productLinkSchema.parse(link)).not.toThrow();
    }
    expect(() =>
      productLinkSchema.parse({ ...byId.get(fixture.both.id), priceCheckedAt: undefined })
    ).toThrow();
  });

  it("DNC-009: 가격을 흔들어도 구매처 링크 순서가 바뀌지 않는다", async () => {
    const checkedAt = new Date("2026-08-01T03:00:00.000Z");
    const fixture = await createFixture(checkedAt);

    const before = (await fetchLinks(fixture.templateId)).map((link) => link.id);
    expect(before).toEqual([fixture.both.id, fixture.priceOnly.id, fixture.dateOnly.id]);

    // 가장 비싼 링크를 맨 앞으로 끌어올리거나 가장 싼 링크를 우대하는 어떤 규칙이
    // 생기면 여기서 순서가 달라진다. 셋 모두 확인 시각을 채워, 값이 실제로 응답에
    // 실리는 상태에서 검증한다("안 실려서 영향이 없었다"는 위양성 방지).
    await prisma.productLink.update({
      where: { id: fixture.both.id },
      data: { priceSnapshotKrw: 1_000_000, priceCheckedAt: checkedAt }
    });
    await prisma.productLink.update({
      where: { id: fixture.priceOnly.id },
      data: { priceSnapshotKrw: 1_000, priceCheckedAt: checkedAt }
    });
    await prisma.productLink.update({
      where: { id: fixture.dateOnly.id },
      data: { priceSnapshotKrw: 500_000, priceCheckedAt: checkedAt }
    });

    const after = await fetchLinks(fixture.templateId);
    expect(after.map((link) => link.id)).toEqual(before);
    // 값 자체는 정상적으로 갱신돼 실린다(위 단언이 "가격이 안 실려서" 통과한 것이 아님).
    expect(after.map((link) => link.priceSnapshotKrw)).toEqual([1_000_000, 1_000, 500_000]);
  });

  /**
   * 시드가 심는 가격은 확인 시각과 함께 유효화된다(prisma/seed.ts resolveSeedPriceCheckedAt).
   * 이게 없으면 시드된 링크 전부(`productLinkSeeds.length` — 라운드 82 B 이후 62건)의 가격은
   * 규칙상 영원히 표시되지 않는 죽은 값이 된다.
   * 읽기만 하므로 다른 스위트와 겹쳐 돌아도 안전하다.
   */
  it("시드가 심은 가격에는 확인 시각이 함께 있다", async () => {
    const seeded = productLinkSeeds.find((seed) => seed.priceSnapshotKrw !== null);
    expect(seeded).toBeDefined();
    const template = await prisma.itemTemplate.findFirstOrThrow({ where: { code: seeded!.itemTemplateCode } });
    const link = await prisma.productLink.findFirstOrThrow({
      where: { itemTemplateId: template.id, platform: seeded!.platform, title: seeded!.title }
    });

    expect(link.priceSnapshotKrw).toBe(seeded!.priceSnapshotKrw);
    expect(link.priceCheckedAt).not.toBeNull();
  });

  it("DNC-009: 가격을 흔들어도 준비템 목록의 순서가 바뀌지 않는다", async () => {
    const checkedAt = new Date("2026-08-01T03:00:00.000Z");
    const fixture = await createFixture(checkedAt);

    async function listedItemIds(): Promise<string[]> {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=all`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      return (response.body.items as { id: string }[]).map((item) => item.id);
    }

    const before = await listedItemIds();
    expect(before).toContain(fixture.templateId);

    await prisma.productLink.updateMany({
      where: { itemTemplateId: fixture.templateId },
      data: { priceSnapshotKrw: 1, priceCheckedAt: checkedAt }
    });

    const after = await listedItemIds();
    // 병렬로 도는 다른 스위트가 카탈로그 행을 만들거나 지울 수 있으므로, 두 스냅샷에
    // 모두 존재하는 준비템(= 이 테스트가 도는 내내 존재가 확정된 행)의 **상대 순서**를
    // 정확히 비교한다. 모집단을 좁히되 단언은 완전 일치 그대로다.
    const common = new Set(before.filter((id) => after.includes(id)));
    expect(common.has(fixture.templateId)).toBe(true);
    expect(after.filter((id) => common.has(id))).toEqual(before.filter((id) => common.has(id)));
  });
});
