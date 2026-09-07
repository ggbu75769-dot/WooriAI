import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 108 — **어드민 카탈로그의 varchar 상한을 DTO가 먼저 진다.**
 *
 * 저장소 전체에 Prisma `P2000`("값이 컬럼보다 길다")을 400으로 옮기는 핸들러가 **0건**이라,
 * 상한을 보지 않는 쓰기 경로는 그대로 `GlobalExceptionFilter`의 500
 * `INTERNAL_SERVER_ERROR`("잠시 후 다시 시도해주세요.")가 된다 — 운영자에게는 무엇을 고쳐야
 * 하는지 한 글자도 말해 주지 않고, 다시 눌러도 같은 결과인 틀린 안내다(DNC-018).
 *
 * 이 스위트가 무는 세 칸과 **가드를 떼면 돌아오는 실측값**:
 *
 *  · `item_templates.name varchar(80)` ← DTO는 `@MaxLength(120)`이었다.
 *    81자 → 500(80자 → 200 · 온전 저장). 컬럼보다 **넓은 상한**이라 검증을 지나고 DB에서 터진다.
 *  · `item_templates.timing_label varchar(80)` ← DTO는 `@IsString()`만 있었다.
 *    81자 → 500(POST·PATCH 양쪽), 80자 → 200 · 온전 저장.
 *  · `product_links.disclosure_text varchar(200)` ← DTO는 `@IsString()`만 있었다.
 *    201자 → 500(POST·PATCH 양쪽), 200자 → 200 · 온전 저장.
 *
 * ⚠️ 고지 문구(`disclosureText`)는 DNC-010이 무는 칸이라 **자르지 않는다**. 200자로 슬라이스하면
 * 잘린 고지가 구매 CTA 옆에 그려지고 운영자는 잘린 줄도 모른다 — 잘린 고지는 고지가 아니다.
 * 그래서 이 스위트는 초과 요청이 400이면서 **행이 만들어지지 않았는지 / 기존 값이 그대로인지**를
 * 함께 본다(400인데 잘려 저장되면 그것이 더 나쁘다).
 *
 * 마지막 한 건은 **CMS 초안 경로**다. `content-revisions.service.ts`의 `publishToLive`는 초안
 * payload를 검증 없이 입력 타입으로 캐스팅하므로, 상한이 초안 생성 시점(`validatePayload`가
 * 같은 DTO 클래스로 검증)에서 서지 않으면 발행 순간 같은 500이 난다. 즉 어드민 컨트롤러만
 * 막으면 초안이 우회로가 된다.
 *
 * 자기 행만 만들고 지운다(접두로 식별) — 공유 DB 락을 배타로 잡지 않는다.
 */
const adminToken = "test-admin-token-r108-varchar";
const TEMPLATE_NAME_PREFIX = "R108 폭 테스트템";
const EDITOR_EMAIL = "r108-varchar-editor@wooriai.local";
const EDITOR_PASSWORD = "editor-password-r108";

describe("어드민 카탈로그 varchar 상한 (라운드 108)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    // CMS 초안 한 건을 위해 로그인+MFA 3요청을 쓴다 — content-revisions.e2e가 같은 이유로
    // 같은 상한을 올려 둔다(레이트리밋 미들웨어가 매 요청 이 env를 읽는다).
    process.env.RATE_LIMIT_AUTH_MAX = "200";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
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
    // CMS 계정도 이 스위트가 만든 것이라 함께 지운다. 세션 → 초안 → 계정 순서인 이유는
    // admin_sessions.admin_user_id / content_revisions.author_admin_id가 계정을 가리키는
    // FK라, 계정을 먼저 지우면 그 삭제가 실패하기 때문이다.
    const editor = await prisma.adminUser.findUnique({ where: { email: EDITOR_EMAIL }, select: { id: true } });
    if (editor) {
      await prisma.adminSession.deleteMany({ where: { adminUserId: editor.id } });
      await prisma.contentRevision.deleteMany({ where: { authorAdminId: editor.id } });
      await prisma.adminUser.delete({ where: { id: editor.id } });
    }
    delete process.env.WOORIAI_ADMIN_TOKEN;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    await app.close();
  });

  const asAdmin = (req: request.Test) => req.set("x-admin-token", adminToken);

  async function createTemplate(overrides: Record<string, unknown> = {}): Promise<request.Response> {
    return await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/item-templates")).send({
      name: `${TEMPLATE_NAME_PREFIX} ${randomUUID().slice(0, 8)}`,
      necessityLevel: "essential",
      reasonText: "라운드 108 폭 테스트 전용 준비템.",
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

  /** 400 봉투가 저장소의 기존 형식(`VALIDATION_ERROR` + `details.fields`)인지, 그리고 어느 칸을 짚는지. */
  function expectFieldRejected(response: request.Response, field: string) {
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })])
    );
  }

  describe("item_templates.name — varchar(80)", () => {
    it("80자는 200이고 80자 그대로 저장된다", async () => {
      const name = `${TEMPLATE_NAME_PREFIX}${"가".repeat(80 - TEMPLATE_NAME_PREFIX.length)}`;
      expect(name.length).toBe(80);
      const response = await createTemplate({ name });
      expect(response.status).toBe(200);

      const row = await prisma.itemTemplate.findUnique({
        where: { id: response.body.id as string },
        select: { name: true }
      });
      // 잘리지 않았는가 — 길이만 보면 79자 절단을 놓친다.
      expect(row?.name).toBe(name);
    });

    /**
     * 가드를 떼면(= 종전 `@MaxLength(120)`) 이 요청은 500 `INTERNAL_SERVER_ERROR`였다 —
     * Prisma P2000, `The provided value for the column is too long for the column's type.`
     */
    it("81자는 400이고, 행이 만들어지지 않는다", async () => {
      // 이 스위트가 만든 다른 행과 섞이지 않게 이 요청만의 표식을 앞에 둔다 — 접두만 세면
      // 앞선 테스트가 만든 준비템이 잡혀 "안 만들어졌다"를 확인할 수 없다.
      const marker = `${TEMPLATE_NAME_PREFIX} ${randomUUID().slice(0, 8)}`;
      const name = `${marker}${"가".repeat(81 - marker.length)}`;
      expect(name.length).toBe(81);
      const response = await createTemplate({ name });
      expectFieldRejected(response, "name");
      expect(await prisma.itemTemplate.count({ where: { name: { startsWith: marker } } })).toBe(0);
    });

    it("PATCH도 같은 폭에서 진다", async () => {
      const itemTemplateId = await createTemplateId();
      const before = await prisma.itemTemplate.findUnique({
        where: { id: itemTemplateId },
        select: { name: true }
      });

      const response = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${itemTemplateId}`)
      ).send({ name: `${TEMPLATE_NAME_PREFIX}${"나".repeat(81 - TEMPLATE_NAME_PREFIX.length)}` });
      expectFieldRejected(response, "name");

      const after = await prisma.itemTemplate.findUnique({
        where: { id: itemTemplateId },
        select: { name: true }
      });
      expect(after?.name).toBe(before?.name);
    });
  });

  describe("item_templates.timing_label — varchar(80)", () => {
    it("80자는 200이고 80자 그대로 저장된다", async () => {
      const timingLabel = "가".repeat(80);
      const response = await createTemplate({ timingLabel });
      expect(response.status).toBe(200);

      const row = await prisma.itemTemplate.findUnique({
        where: { id: response.body.id as string },
        select: { timingLabel: true }
      });
      expect(row?.timingLabel).toBe(timingLabel);
    });

    /** 가드를 떼면 500이었다(실측) — P2000. */
    it("81자는 400이고, 행이 만들어지지 않는다", async () => {
      // 위 200 케이스가 저장한 80자 라벨과 섞이지 않게 이 요청만의 표식을 앞에 둔다.
      const marker = randomUUID().slice(0, 8);
      const timingLabel = `${marker}${"가".repeat(81 - marker.length)}`;
      expect(timingLabel.length).toBe(81);
      const response = await createTemplate({ timingLabel });
      expectFieldRejected(response, "timingLabel");
      // 잘려서(80자) 저장되지도 않았는가 — 400인데 절단본이 남으면 그것이 더 나쁘다.
      expect(await prisma.itemTemplate.count({ where: { timingLabel: { startsWith: marker } } })).toBe(0);
    });

    it("PATCH도 같은 폭에서 지고, 기존 라벨은 그대로다", async () => {
      const created = await createTemplate({ timingLabel: "출산 준비" });
      expect(created.status).toBe(200);
      const itemTemplateId = created.body.id as string;

      const response = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${itemTemplateId}`)
      ).send({ timingLabel: "나".repeat(81) });
      expectFieldRejected(response, "timingLabel");

      const row = await prisma.itemTemplate.findUnique({
        where: { id: itemTemplateId },
        select: { timingLabel: true }
      });
      expect(row?.timingLabel).toBe("출산 준비");
    });
  });

  describe("product_links.disclosure_text — varchar(200) · DNC-010", () => {
    async function createLink(itemTemplateId: string, body: Record<string, unknown>) {
      return await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links")).send({
        itemTemplateId,
        platform: "custom",
        title: `고지 문구 링크 ${randomUUID().slice(0, 8)}`,
        url: `https://example.com/${randomUUID()}`,
        active: false,
        ...body
      });
    }

    it("200자 고지는 200이고 200자 그대로 저장된다", async () => {
      const itemTemplateId = await createTemplateId();
      const disclosureText = "고".repeat(200);
      const response = await createLink(itemTemplateId, { disclosureText });
      expect(response.status).toBe(200);

      const row = await prisma.productLink.findUnique({
        where: { id: response.body.id as string },
        select: { disclosureText: true }
      });
      expect(row?.disclosureText).toBe(disclosureText);
    });

    /**
     * 가드를 떼면 500이었다(실측) — P2000.
     * ⚠️ 여기서 보는 것은 400 하나가 아니다: **잘려서 저장되지 않았는가**를 함께 본다.
     * 200자 슬라이스는 DNC-010이 금지하는 조용한 절단이다(잘린 고지는 고지가 아니고,
     * 운영자는 잘렸다는 사실도 모른다). 문구를 자르는 대신 요청을 거절한다.
     */
    it("201자 고지는 400이고, 잘린 채 저장되지 않는다", async () => {
      const itemTemplateId = await createTemplateId();
      const response = await createLink(itemTemplateId, { disclosureText: "고".repeat(201) });
      expectFieldRejected(response, "disclosureText");
      expect(await prisma.productLink.count({ where: { itemTemplateId } })).toBe(0);
    });

    it("PATCH도 같은 폭에서 지고, 기존 고지 문구가 잘리거나 바뀌지 않는다", async () => {
      const itemTemplateId = await createTemplateId();
      const original = "제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요.";
      const created = await createLink(itemTemplateId, { disclosureText: original });
      expect(created.status).toBe(200);

      const response = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/admin/product-links/${created.body.id}`)
      ).send({ disclosureText: "지".repeat(201) });
      expectFieldRejected(response, "disclosureText");

      const row = await prisma.productLink.findUnique({
        where: { id: created.body.id as string },
        select: { disclosureText: true }
      });
      expect(row?.disclosureText).toBe(original);
    });

    /**
     * 200자가 실제 고지 문구에 좁지 않은가 — 시드의 문구를 **행에서 직접 재서** 적어 둔다.
     * 이 값이 200에 다가서면 상한을 넓히는(= 마이그레이션) 판단이 필요해진다.
     * 실측(라운드 108): 가장 긴 고지가 48자 = 컬럼의 24%.
     */
    it("시드가 쓰는 고지 문구는 200자에 한참 못 미친다", async () => {
      const disclosures = await prisma.disclosure.findMany({ select: { key: true, text: true } });
      expect(disclosures.length).toBeGreaterThan(0);
      const longest = Math.max(...disclosures.map((row) => row.text.length));
      expect(longest).toBeLessThanOrEqual(48);

      const linkTexts = await prisma.productLink.findMany({
        where: { disclosureText: { not: null } },
        select: { disclosureText: true }
      });
      for (const row of linkTexts) {
        expect((row.disclosureText ?? "").length).toBeLessThanOrEqual(200);
      }
    });
  });

  describe("CMS 초안이 우회로가 되지 않는다", () => {
    function parseSetCookies(response: request.Response): Record<string, string> {
      const raw = response.headers["set-cookie"];
      const headers: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const cookies: Record<string, string> = {};
      for (const header of headers) {
        const [pair] = header.split(";");
        const separatorIndex = pair.indexOf("=");
        if (separatorIndex === -1) continue;
        cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
      }
      return cookies;
    }

    async function loginEditor(): Promise<{ cookie: string; csrfToken: string }> {
      await prisma.adminUser.upsert({
        where: { email: EDITOR_EMAIL },
        update: {
          passwordHash: hashAdminPassword(EDITOR_PASSWORD),
          role: "editor",
          active: true,
          totpSecret: null,
          mfaEnabledAt: null,
          mfaRecoveryCodes: []
        },
        create: {
          email: EDITOR_EMAIL,
          passwordHash: hashAdminPassword(EDITOR_PASSWORD),
          displayName: EDITOR_EMAIL,
          role: "editor",
          active: true
        }
      });

      const login = await request(app.getHttpServer())
        .post("/api/v1/admin/auth/login")
        .send({ email: EDITOR_EMAIL, password: EDITOR_PASSWORD })
        .expect(200);
      let cookies = parseSetCookies(login);
      const toHeader = (jar: Record<string, string>) =>
        Object.entries(jar)
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");

      const setupStart = await request(app.getHttpServer())
        .post("/api/v1/admin/auth/mfa/setup/start")
        .set("Cookie", toHeader(cookies))
        .set("X-CSRF-Token", cookies.admin_csrf)
        .expect(200);
      const code = await generateTotp({ secret: setupStart.body.secret as string });
      const verify = await request(app.getHttpServer())
        .post("/api/v1/admin/auth/mfa/setup/verify")
        .set("Cookie", toHeader(cookies))
        .set("X-CSRF-Token", cookies.admin_csrf)
        .send({ code })
        .expect(200);

      cookies = { ...cookies, ...parseSetCookies(verify) };
      return { cookie: toHeader(cookies), csrfToken: cookies.admin_csrf };
    }

    /**
     * `publishToLive`는 초안 payload를 **검증 없이** 입력 타입으로 캐스팅한다
     * (content-revisions.service.ts). 상한이 서는 자리는 초안 생성의 `validatePayload`이고,
     * 그 함수가 쓰는 DTO 클래스가 어드민 단건 쓰기와 **같다** — 그래서 가드를 떼면 초안은
     * 통과하고 발행 순간 같은 500이 난다.
     */
    it("폭을 넘는 준비템 초안은 만들어지지 않는다", async () => {
      const editor = await loginEditor();
      const response = await request(app.getHttpServer())
        .post("/api/v1/admin/content-revisions")
        .set("Cookie", editor.cookie)
        .set("X-CSRF-Token", editor.csrfToken)
        .send({
          entityType: "item_template",
          payload: {
            name: `${TEMPLATE_NAME_PREFIX} 초안`,
            necessityLevel: "essential",
            reasonText: "라운드 108 초안 폭 테스트.",
            timingLabel: "가".repeat(81)
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("CONTENT_REVISION_PAYLOAD_INVALID");
      expect(response.body.error.details.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "timingLabel" })])
      );
    });
  });
});
