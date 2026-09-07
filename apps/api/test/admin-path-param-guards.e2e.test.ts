import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 109 — **어드민 컨트롤러의 경로 파라미터가 검증을 지나지 않던 세 자리.**
 *
 * 전역 `ValidationPipe`는 DTO 클래스인 인자만 검증한다(bootstrap.ts
 * `createDtoValidationPipe`) — 경로 파라미터의 메타타입은 `String`이라 그대로 통과한다.
 * 그래서 `admin.controller.ts`의 `@Param(...)` 세 개는 어떤 검증도 없이 DB에 실렸고,
 * 셋 다 500 `INTERNAL_SERVER_ERROR "잠시 후 다시 시도해주세요."`로 새고 있었다.
 * 다시 눌러도 **절대** 같은 결과라, 그 안내는 DNC-018이 금지하는 틀린 안내다.
 *
 * 가드를 떼면 돌아오는 실측값(라운드 109 재현, 이 스위트가 그대로 고정한다):
 *
 *  · `PUT /admin/disclosures/:key` → `disclosures.key varchar(80)`에 upsert(= create).
 *    **81자 → 500**(Prisma P2000 · 저장소에 P2000→400 핸들러 0건), 80자 → 200 · 온전 저장.
 *  · `PATCH /admin/item-templates/:itemTemplateId` → `@db.Uuid` 술어.
 *    **비-UUID → 500**(`Inconsistent column data: Error creating UUID`), 미존재 UUID → 404.
 *  · `PATCH /admin/product-links/:productLinkId` → 같은 모양, **비-UUID → 500**.
 *
 * 두 관례로 갈린다. id 두 개는 라운드 106 T9(모양이 틀린 id는 그 자원을 가리킬 수 없으므로
 * **미존재와 같은 404**), `:key`는 라운드 108(폭 초과는 `VALIDATION_ERROR` + `details.fields`).
 *
 * ⚠️ `:key`를 **자르지 않는다**는 것이 이 스위트의 핵심 단언이다. 81자를 80자로 슬라이스하면
 * 운영자가 의도한 키가 아닌 다른 키가 만들어져, 앱이 읽는 키에 문구가 안 실리거나 엉뚱한
 * 키를 덮는다(DNC-010). 그래서 초과 키의 80자 접두가 **이미 존재하는 키와 같아지도록** 두 키를
 * 짜고, 거절 뒤에도 그 기존 문구가 한 글자도 바뀌지 않았는지를 본다 — 400인데 잘려 저장되면
 * 그것이 500보다 나쁘다.
 *
 * 자기 접두 행만 만들고 지운다(공유 시드 행은 건드리지 않는다).
 */
const adminToken = "test-admin-token-r109-path-params";
const DISCLOSURE_KEY_PREFIX = "r109_path_param_";
const TEMPLATE_NAME_PREFIX = "R109 경로파라미터 테스트템";

/** 정확히 80자 = `disclosures.key varchar(80)`의 폭. 리터럴 80은 컬럼 폭 그 자체다. */
const KEY_AT_LIMIT = `${DISCLOSURE_KEY_PREFIX}${"a".repeat(80 - DISCLOSURE_KEY_PREFIX.length)}`;
/** 81자 — 그 80자 접두가 위 키와 **같다**(잘려 저장되면 위 행을 덮어쓴다). */
const KEY_OVER_LIMIT = `${KEY_AT_LIMIT}b`;

describe("어드민 경로 파라미터 가드 (라운드 109)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.disclosure.deleteMany({ where: { key: { startsWith: DISCLOSURE_KEY_PREFIX } } });
    const own = await prisma.itemTemplate.findMany({
      where: { name: { startsWith: TEMPLATE_NAME_PREFIX } },
      select: { id: true }
    });
    if (own.length > 0) {
      const itemTemplateId = { in: own.map((row) => row.id) };
      await prisma.productLink.deleteMany({ where: { itemTemplateId } });
      await prisma.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
      await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
    }
    delete process.env.WOORIAI_ADMIN_TOKEN;
    await app.close();
  });

  const asAdmin = (req: request.Test) => req.set("x-admin-token", adminToken);

  /** 봉투 비교용 — `requestId`는 요청마다 다르므로 코드·문구만 본다. */
  function envelope(response: request.Response) {
    return { code: response.body.error?.code, message: response.body.error?.message };
  }

  describe("PUT /admin/disclosures/:key — disclosures.key varchar(80)", () => {
    it("80자 키는 200이고 80자 그대로 저장된다", async () => {
      expect(KEY_AT_LIMIT).toHaveLength(80);
      const response = await asAdmin(
        request(app.getHttpServer()).put(`/api/v1/admin/disclosures/${KEY_AT_LIMIT}`)
      ).send({ text: "라운드 109 경계 문구예요." });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ key: KEY_AT_LIMIT, text: "라운드 109 경계 문구예요." });
      const row = await prisma.disclosure.findUnique({ where: { key: KEY_AT_LIMIT } });
      expect(row?.key).toHaveLength(80);
      expect(row?.text).toBe("라운드 109 경계 문구예요.");
    });

    it("81자 키는 500이 아니라 400 VALIDATION_ERROR이고 details.fields가 key를 짚는다", async () => {
      expect(KEY_OVER_LIMIT).toHaveLength(81);
      const response = await asAdmin(
        request(app.getHttpServer()).put(`/api/v1/admin/disclosures/${KEY_OVER_LIMIT}`)
      ).send({ text: "라운드 109 초과 문구예요." });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toBe("요청 값을 다시 확인해주세요.");
      expect(response.body.error.details.fields).toEqual([
        {
          field: "key",
          constraints: {
            maxLength:
              "고지 키는 80자 이하예요. 넘는 키는 자르지 않고 거절해요 — 잘라 저장하면 앱이 읽는 키와 다른 키가 돼요."
          }
        }
      ]);
    });

    it("거절된 81자 키는 잘려 저장되지도, 같은 80자 접두의 기존 문구를 덮지도 않는다", async () => {
      // 위 두 테스트가 순서대로 만든 상태를 그대로 본다: 80자 행 하나만 있고 문구는 그대로.
      const rows = await prisma.disclosure.findMany({
        where: { key: { startsWith: DISCLOSURE_KEY_PREFIX } },
        select: { key: true, text: true }
      });
      expect(rows).toEqual([{ key: KEY_AT_LIMIT, text: "라운드 109 경계 문구예요." }]);
    });

    // 폭 검사는 **핸들러 안**에 있으므로 `AdminAuthGuard`보다 뒤에 돈다. 즉 인증 없는 요청은
    // 폭을 넘든 아니든 같은 403이고, 이 400은 어떤 존재/모양 정보도 미인증자에게 흘리지 않는다.
    it("자격 없는 81자 키 요청은 400이 아니라 403이다 (폭 검사가 인증보다 앞서지 않는다)", async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/disclosures/${KEY_OVER_LIMIT}`)
        .send({ text: "라운드 109 초과 문구예요." });
      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /admin/item-templates/:itemTemplateId — @db.Uuid", () => {
    it("비-UUID는 500이 아니라 미존재 UUID와 **구분되지 않는** 404다", async () => {
      const nonUuid = await asAdmin(
        request(app.getHttpServer()).patch("/api/v1/admin/item-templates/not-a-uuid")
      ).send({ name: `${TEMPLATE_NAME_PREFIX} 무효` });
      const missingUuid = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${randomUUID()}`)
      ).send({ name: `${TEMPLATE_NAME_PREFIX} 무효` });

      expect(nonUuid.status).toBe(404);
      expect(envelope(nonUuid)).toEqual({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
      expect(missingUuid.status).toBe(404);
      expect(envelope(nonUuid)).toEqual(envelope(missingUuid));
    });

    it("정상 UUID 경로는 종전 그대로 200이다", async () => {
      const created = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/item-templates")).send({
        name: `${TEMPLATE_NAME_PREFIX} ${randomUUID().slice(0, 8)}`,
        necessityLevel: "essential",
        reasonText: "라운드 109 경로 파라미터 가드 전용 준비템.",
        stageCodes: ["newborn_0_3"],
        // 활성 목록(앱·다른 스위트의 스냅샷)에 끼지 않게 비활성으로 만든다.
        active: false
      });
      expect(created.status).toBe(200);

      const renamed = `${TEMPLATE_NAME_PREFIX} 수정됨`;
      const patched = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${created.body.id}`)
      ).send({ name: renamed });
      expect(patched.status).toBe(200);
      expect(patched.body.name).toBe(renamed);
    });
  });

  describe("PATCH /admin/product-links/:productLinkId — @db.Uuid", () => {
    it("비-UUID는 500이 아니라 미존재 UUID와 **구분되지 않는** 404다", async () => {
      const nonUuid = await asAdmin(
        request(app.getHttpServer()).patch("/api/v1/admin/product-links/not-a-uuid")
      ).send({ title: "라운드 109 무효 링크" });
      const missingUuid = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${randomUUID()}`)
      ).send({ title: "라운드 109 무효 링크" });

      expect(nonUuid.status).toBe(404);
      expect(envelope(nonUuid)).toEqual({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
      expect(missingUuid.status).toBe(404);
      expect(envelope(nonUuid)).toEqual(envelope(missingUuid));
    });
  });
});
