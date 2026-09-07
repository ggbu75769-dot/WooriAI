import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { MONEY_KRW_MAX } from "@wooriai/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 107 트랙 D — **어드민 카탈로그 쓰기가 DB 제약을 서비스에서 먼저 진다.**
 *
 * 이 파일이 무는 셋(정찰 S5 D2·D6·D7)은 전부 "가드를 끄면 500(또는 조용한 오염)"이 되는
 * 자리다. 각 테스트는 그 500이 실제로 어디서 나던 것인지를 주석에 값으로 적는다.
 *
 *  · **D2** `chk_product_links_sponsor` — `is_sponsored = true`인데 `sponsor_label`이 NULL이면
 *    INSERT/UPDATE 자체가 CHECK 위반이다. 저장소가 그 컬럼을 쓰지 않았으므로 어드민에서
 *    스폰서를 켜는 요청은 **언제나** 500이었고, DNC-011의 스폰서 구분 표시를 운영자가 켤
 *    경로가 없었다. 이 스위트는 그 경로가 **실제로 서는지**(200 + 행에 라벨 + 목록에 라벨)를
 *    묻는다. 그렇게 만든 링크가 **앱 화면에서 스폰서로 보이는지**는 items-commerce.e2e가
 *    같은 라운드부터 어드민 API로 만들어 확인한다.
 *  · **D6** 어드민 카테고리 이름 중복 — DB의 `uq_categories_household_name`은 부분 색인이라
 *    시드 행을 덮지 않는다. 막히지 않으면 앱에서 칩이 사라지고 남은 칩이 남의 지출을 자기
 *    합계로 끌어온다(허위 표시).
 *  · **D7** `chk_item_templates_price_range` · int4 상한 — 각각 CHECK 위반 500, `integer out of
 *    range` 500이었다.
 *
 * 자기 행만 만들고 지운다(접두로 식별) — 공유 DB 락을 배타로 잡지 않는다.
 */
const adminToken = "test-admin-token-r107-d";
const TEMPLATE_NAME_PREFIX = "R107-D 가드 테스트템";

describe("어드민 카탈로그 쓰기 가드 (라운드 107 D2·D6·D7)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  });

  beforeEach(async () => {
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    await app.close();
  });

  afterAll(async () => {
    const prismaService = moduleRef.get(PrismaService);
    const own = await prismaService.itemTemplate.findMany({
      where: { name: { startsWith: TEMPLATE_NAME_PREFIX } },
      select: { id: true }
    });
    if (own.length === 0) return;
    const itemTemplateId = { in: own.map((row) => row.id) };
    await prismaService.productLink.deleteMany({ where: { itemTemplateId } });
    await prismaService.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
    await prismaService.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
  });

  const asAdmin = (req: request.Test) => req.set("x-admin-token", adminToken);

  async function createTemplate(overrides: Record<string, unknown> = {}): Promise<request.Response> {
    return await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/item-templates")).send({
      name: `${TEMPLATE_NAME_PREFIX} ${randomUUID().slice(0, 8)}`,
      necessityLevel: "essential",
      reasonText: "라운드 107 가드 테스트 전용 준비템.",
      stageCodes: ["newborn_0_3"],
      // 활성 목록(앱·다른 스위트의 스냅샷)에 끼지 않게 비활성으로 만든다.
      active: false,
      ...overrides
    });
  }

  async function createTemplateId(): Promise<string> {
    const response = await createTemplate();
    expect(response.status).toBe(200);
    return response.body.id as string;
  }

  describe("D2 — 스폰서 링크를 어드민이 만들 수 있다", () => {
    /**
     * 가드를 끄면(= 종전 코드: 저장소가 `sponsor_label`을 쓰지 않고 `is_sponsored: true`를
     * 그대로 INSERT) 이 요청은 500 `INTERNAL_ERROR`였다 —
     * `new row for relation "product_links" violates check constraint "chk_product_links_sponsor"`.
     */
    it("라벨과 함께 켜면 200이고, 행과 목록에 라벨이 남는다", async () => {
      const itemTemplateId = await createTemplateId();
      const created = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links")).send({
        itemTemplateId,
        platform: "custom",
        title: `스폰서 링크 ${randomUUID().slice(0, 8)}`,
        url: `https://example.com/${randomUUID()}`,
        isSponsored: true,
        sponsorLabel: "광고 · 브랜드 제공",
        active: true
      });

      expect(created.status).toBe(200);
      expect(created.body).toMatchObject({ isSponsored: true, sponsorLabel: "광고 · 브랜드 제공" });

      // DNC-011의 표식이 **행에 실제로 남는가** — 응답만 보면 CHECK를 지났는지 알 수 없다.
      const row = await prisma.productLink.findUnique({
        where: { id: created.body.id as string },
        select: { isSponsored: true, sponsorLabel: true }
      });
      expect(row).toEqual({ isSponsored: true, sponsorLabel: "광고 · 브랜드 제공" });

      // 목록이 라벨을 되읽어 준다 — 없으면 운영자가 수정 폼을 열 때마다 다시 타이핑해야 하고,
      // 빈 칸으로 저장하는 순간 라벨이 지워진다.
      const list = await asAdmin(request(app.getHttpServer()).get("/api/v1/admin/product-links")).expect(200);
      const listed = (list.body.links as { id: string; sponsorLabel: string | null }[]).find(
        (link) => link.id === created.body.id
      );
      expect(listed?.sponsorLabel).toBe("광고 · 브랜드 제공");
    });

    it("라벨 없이 켜면 400이고, 링크가 만들어지지 않는다", async () => {
      const itemTemplateId = await createTemplateId();
      const response = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links")).send({
        itemTemplateId,
        platform: "custom",
        title: "라벨 없는 스폰서 링크",
        url: `https://example.com/${randomUUID()}`,
        isSponsored: true,
        active: true
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ADMIN_SPONSOR_LABEL_REQUIRED");
      // DNC-018: 다음에 무엇을 하면 되는지 말한다.
      expect(response.body.error.message).toContain("스폰서 표시 문구를 적어 주세요");
      expect(await prisma.productLink.count({ where: { itemTemplateId } })).toBe(0);
    });

    it("공백만 있는 라벨은 라벨이 없는 것과 같다", async () => {
      const itemTemplateId = await createTemplateId();
      const response = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links")).send({
        itemTemplateId,
        platform: "custom",
        title: "공백 라벨 링크",
        url: `https://example.com/${randomUUID()}`,
        isSponsored: true,
        sponsorLabel: "   ",
        active: true
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ADMIN_SPONSOR_LABEL_REQUIRED");
    });

    it("이미 있는 링크를 스폰서로 켜고 다시 끌 수 있다", async () => {
      const itemTemplateId = await createTemplateId();
      const created = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links"))
        .send({
          itemTemplateId,
          platform: "custom",
          title: "나중에 스폰서가 되는 링크",
          url: `https://example.com/${randomUUID()}`,
          active: true
        })
        .expect(200);
      const productLinkId = created.body.id as string;

      // 라벨 없이 켜는 PATCH는 400(행은 그대로).
      const rejected = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${productLinkId}`)
      ).send({ isSponsored: true });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error.code).toBe("ADMIN_SPONSOR_LABEL_REQUIRED");
      expect(
        (await prisma.productLink.findUnique({ where: { id: productLinkId }, select: { isSponsored: true } }))
          ?.isSponsored
      ).toBe(false);

      const turnedOn = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${productLinkId}`))
        .send({ isSponsored: true, sponsorLabel: "스폰서" })
        .expect(200);
      expect(turnedOn.body).toMatchObject({ isSponsored: true, sponsorLabel: "스폰서" });

      // 켜 둔 채 라벨만 지우는 요청도 400이다 — 통과시키면 UPDATE가 CHECK 위반(500)이 된다.
      const clearRejected = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${productLinkId}`)
      ).send({ sponsorLabel: null });
      expect(clearRejected.status).toBe(400);
      expect(clearRejected.body.error.code).toBe("ADMIN_SPONSOR_LABEL_REQUIRED");

      const turnedOff = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${productLinkId}`))
        .send({ isSponsored: false })
        .expect(200);
      expect(turnedOff.body.isSponsored).toBe(false);
    });

    it("스폰서 축을 보내지 않은 PATCH는 스폰서 상태를 그대로 둔다", async () => {
      const itemTemplateId = await createTemplateId();
      const created = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links"))
        .send({
          itemTemplateId,
          platform: "custom",
          title: "제목만 고칠 스폰서 링크",
          url: `https://example.com/${randomUUID()}`,
          isSponsored: true,
          sponsorLabel: "광고",
          active: true
        })
        .expect(200);

      const patched = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${created.body.id}`)
      )
        .send({ title: "제목만 바꾼다" })
        .expect(200);

      expect(patched.body).toMatchObject({ title: "제목만 바꾼다", isSponsored: true, sponsorLabel: "광고" });
    });
  });

  describe("D7 — 어드민 준비템 가격", () => {
    /**
     * 가드를 끄면 500이었다 —
     * `new row ... violates check constraint "chk_item_templates_price_range"`.
     */
    it("최소가 > 최대가는 400", async () => {
      const response = await createTemplate({ priceMinKrw: 100_000, priceMaxKrw: 10_000 });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ADMIN_ITEM_PRICE_RANGE_INVALID");
      expect(response.body.error.message).toContain("최대 가격 이하로 맞춰 주세요");
    });

    it("PATCH가 한쪽만 보내도 저장될 조합으로 판정한다", async () => {
      const created = await createTemplate({ priceMinKrw: 10_000, priceMaxKrw: 20_000 });
      expect(created.status).toBe(200);
      const itemTemplateId = created.body.id as string;

      // 최대가는 그대로(20,000)인데 최소가만 30,000으로 올리는 요청 — 저장되면 CHECK 위반이다.
      const rejected = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${itemTemplateId}`)
      ).send({ priceMinKrw: 30_000 });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error.code).toBe("ADMIN_ITEM_PRICE_RANGE_INVALID");

      // 한쪽을 null로 지우면 비교 대상이 없으므로 통과한다(가격대 삭제 경로 — ADM-124).
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${itemTemplateId}`))
        .send({ priceMaxKrw: null, priceMinKrw: 30_000 })
        .expect(200);
    });

    /** 가드를 끄면 500이었다 — PostgreSQL `integer out of range`(price_min_krw는 int4). */
    it("int4 상한을 넘는 가격은 400", async () => {
      const response = await createTemplate({ priceMinKrw: MONEY_KRW_MAX + 1 });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "priceMinKrw" })])
      );
    });

    it("상한과 같은 값은 통과한다", async () => {
      const response = await createTemplate({ priceMinKrw: MONEY_KRW_MAX, priceMaxKrw: MONEY_KRW_MAX });
      expect(response.status).toBe(200);
    });
  });

  describe("D6 — 어드민 카테고리 이름 중복", () => {
    /**
     * 가드를 끄면 200이고 **조용히 오염된다**: 두 시드 카테고리가 같은 이름을 갖는 순간
     * 앱의 `selectableCategories`가 동명 그룹을 한 슬롯으로 접어 칩 하나가 사라지고,
     * `records-list-view`의 `idsByName`이 사라진 칩의 지출을 남은 칩 합계로 끌어온다.
     * 500이 아니라 **틀린 금액**이 남는 자리라, 재현의 값은 "이름이 같은 시드 행이 2건"이다.
     */
    it("다른 시드 카테고리와 같은 이름으로 바꾸면 400이고 이름은 그대로다", async () => {
      const [first, second] = await prisma.category.findMany({
        where: { householdId: null },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
        take: 2
      });

      const response = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/categories/${first.id}`)).send({
        name: second.name
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ADMIN_CATEGORY_NAME_DUPLICATE");
      expect(response.body.error.message).toContain("다른 이름으로 바꿔 주세요");

      const after = await prisma.category.findUnique({ where: { id: first.id }, select: { name: true } });
      expect(after?.name).toBe(first.name);
      // 오염의 값 자체를 본다 — 같은 이름을 가진 시드 행이 둘이 되지 않았다.
      expect(await prisma.category.count({ where: { householdId: null, name: second.name } })).toBe(1);
    });

    it("대소문자·공백만 다른 이름도 같은 이름으로 본다(커스텀 쪽과 같은 정규화)", async () => {
      const [first, second] = await prisma.category.findMany({
        where: { householdId: null },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
        take: 2
      });

      const response = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/categories/${first.id}`)).send({
        name: `  ${second.name.toUpperCase()}  `
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ADMIN_CATEGORY_NAME_DUPLICATE");
    });

    it("자기 이름으로 다시 저장하는 것은 중복이 아니다", async () => {
      const first = await prisma.category.findFirst({
        where: { householdId: null },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true }
      });

      const response = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/admin/categories/${first!.id}`)).send({
        name: first!.name
      });

      expect(response.status).toBe(200);
      expect(response.body.category.name).toBe(first!.name);
    });
  });
});
