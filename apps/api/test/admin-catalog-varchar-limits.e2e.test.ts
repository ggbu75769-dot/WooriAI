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
// 라운드 111: 상한 문장이 말하는 숫자를 계약 상수와 직접 맞추기 위해 읽는다(값을 테스트에 두 번 적지 않는다).
import { MONEY_KRW_MAX } from "@wooriai/contracts";

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

  /**
   * 라운드 110 트랙 1 — **거절 사유가 운영자가 읽을 수 있는 문장인가.**
   *
   * 종전(그때는 참): 위 describe들은 `expectFieldRejected`로 **어느 칸이** 걸렸는지(`field`)만
   * 물었고, 그것으로 충분해 보였다 — 500이 400이 된 것이 라운드 108의 축이었다.
   * → 이제 그 400이 화면까지 가는 길에서 한 겹이 더 필요하다는 것이 드러났다: 어드민은
   * `details.fields[].constraints`의 문장을 화면에 세우는데(라운드 110), **한글이 한 자도 없는
   * 문장은 세우지 않는다**(apps/admin/src/lib/write-error-copy.ts — 라운드 76 리뷰 M-1).
   * class-validator의 기본 문장은 영문이고 앞머리가 **서버 필드명 그대로**라, 그대로 두면
   * 400으로 바꾼 보람이 화면 앞에서 사라진다.
   *
   * 그래서 이 describe가 무는 것은 셋이다:
   *  ⓐ 사유가 **한글**이다(어드민의 소비 규칙을 통과한다).
   *  ⓑ 사유가 **어드민 화면의 라벨**로 칸을 부른다(운영자가 어느 입력칸인지 안다).
   *  ⓒ 사유에 **영문 필드명이 없다**(부정 단언 — 화면에 뜻 없는 키가 서지 않는다).
   */
  describe("거절 사유가 한국어이고 화면의 라벨로 칸을 부른다 (라운드 110)", () => {
    /** `[요청을 만드는 함수, 필드 키, 화면 라벨]`. 라벨은 어드민 폼의 `<label>` 문자열 그대로다. */
    const CASES: readonly [string, string, string][] = [
      ["item-template.name", "name", "준비템 이름"],
      ["item-template.timingLabel", "timingLabel", "타이밍 라벨"],
      ["product-link.title", "title", "상품 링크 제목"],
      ["product-link.sponsorLabel", "sponsorLabel", "스폰서 표시 문구"],
      ["product-link.disclosureText", "disclosureText", "고지 문구"]
    ];

    async function rejectionFor(key: string): Promise<{ field: string; constraints: Record<string, string> }> {
      let response: request.Response;
      if (key === "name") {
        response = await createTemplate({ name: `${TEMPLATE_NAME_PREFIX}${"가".repeat(81 - TEMPLATE_NAME_PREFIX.length)}` });
      } else if (key === "timingLabel") {
        response = await createTemplate({ timingLabel: "가".repeat(81) });
      } else {
        const itemTemplateId = await createTemplateId();
        const overLimit: Record<string, unknown> = {
          title: { title: "가".repeat(161) },
          sponsorLabel: { sponsorLabel: "가".repeat(81) },
          disclosureText: { disclosureText: "가".repeat(201) }
        }[key] as Record<string, unknown>;
        response = await asAdmin(request(app.getHttpServer()).post("/api/v1/admin/product-links")).send({
          itemTemplateId,
          platform: "custom",
          title: `사유 문장 링크 ${randomUUID().slice(0, 8)}`,
          url: `https://example.com/${randomUUID()}`,
          active: false,
          ...overLimit
        });
      }
      expect(response.status, key).toBe(400);
      expect(response.body.error.code, key).toBe("VALIDATION_ERROR");
      const fields = response.body.error.details.fields as { field: string; constraints: Record<string, string> }[];
      const entry = fields.find((row) => row.field === key);
      expect(entry, `${key}를 짚는 항목이 없다`).toBeDefined();
      return entry as { field: string; constraints: Record<string, string> };
    }

    for (const [label, key, screenLabel] of CASES) {
      it(`${label} — 사유가 "${screenLabel}"로 시작하는 한국어 문장이다`, async () => {
        const entry = await rejectionFor(key);
        const sentences = Object.values(entry.constraints);
        expect(sentences.length, `${key}의 제약이 0건이다`).toBeGreaterThan(0);
        const sentence = sentences[0];
        // ⓐ 한글이 있다(어드민이 화면에 세울 수 있는 문장이다).
        expect(sentence, `${key}: 사유에 한글이 없다`).toMatch(/[가-힣]/);
        // ⓑ 화면의 라벨로 칸을 부른다.
        expect(sentence.startsWith(screenLabel), `${key}: 사유가 "${screenLabel}"로 시작하지 않는다 — ${sentence}`).toBe(
          true
        );
        // ⓒ 부정 단언: 영문 필드명이 문장에 없다.
        expect(sentence, `${key}: 사유에 영문 필드명이 있다`).not.toContain(key);
      });
    }

    /** 상한 숫자는 데코레이터에서 오고(`$constraint1`) 문장에 손으로 적히지 않는다 — 실측 셋. */
    it("문장이 말하는 숫자가 그 칸의 컬럼 폭과 같다", async () => {
      expect((await rejectionFor("name")).constraints.maxLength).toContain("80자");
      expect((await rejectionFor("title")).constraints.maxLength).toContain("160자");
      expect((await rejectionFor("disclosureText")).constraints.maxLength).toContain("200자");
    });
  });

  /**
   * 라운드 111 트랙 1 — **숫자 상한·하한의 사유도 같은 규칙을 통과하는가.**
   *
   * ⚠️ 파일명은 `varchar-limits`인데 이 describe는 숫자다 — 그래도 새 파일을 만들지 않는다.
   * 이 스위트가 무는 계약은 폭(varchar)이 아니라 바로 위 describe가 세운 것과 **같은 하나**다:
   * *"거절 사유가 운영자가 읽을 수 있는 문장으로 화면까지 닿는가."* 숫자 칸은 그 계약의
   * 두 번째 축일 뿐이고, 새 파일로 가르면 (ⓐ) Nest 앱 부팅 한 벌과 (ⓑ) `createTemplate`·
   * `expectFieldRejected`·어드민 토큰이 통째로 사본이 되며, 무엇보다 (ⓒ) **접두 정리의 주인이
   * 둘**이 된다 — 자기 행을 지우는 `afterAll`이 하나 더 생긴다는 뜻이고, 방치된 행이 남는
   * 사고는 바로 그 지점에서 난다. 여기 두면 이 스위트가 만드는 준비템은 전부
   * `TEMPLATE_NAME_PREFIX`를 달고(= `createTemplate`이 붙인다) 기존 `afterAll` **하나**가
   * 그대로 걷어 간다.
   *
   * 가드를 떼면 돌아오는 실측값(POST·PATCH 양쪽 같다 — 이 트랙이 직접 찍었다):
   *   · `max`   → `"priceMaxKrw must not be greater than 2147483647"`
   *   · `min`   → `"priceMinKrw must not be less than 0"`
   *   · `isInt` → `"priceMinKrw must be an integer number"`
   * 셋 다 한글이 0자라 `write-error-copy.ts`가 화면에서 걷어 내고, 앞머리는 서버 필드명이다.
   */
  describe("가격 칸의 숫자 사유도 한국어다 (라운드 111)", () => {
    /** `[이름, 필드 키, 제약 키, 화면 라벨, 그 사유를 부르는 값]`. */
    const NUMERIC_CASES: readonly [string, "priceMinKrw" | "priceMaxKrw", string, string, number][] = [
      ["최대값 초과", "priceMaxKrw", "max", "최대 가격", MONEY_KRW_MAX + 1],
      ["최소값 미만", "priceMinKrw", "min", "최소 가격", -1],
      ["소수점", "priceMinKrw", "isInt", "최소 가격", 1.5]
    ];

    async function numericRejection(
      field: "priceMinKrw" | "priceMaxKrw",
      value: number
    ): Promise<Record<string, string>> {
      const response = await createTemplate({ [field]: value });
      expect(response.status, `${field}=${value}`).toBe(400);
      expect(response.body.error.code, `${field}=${value}`).toBe("VALIDATION_ERROR");
      const fields = response.body.error.details.fields as { field: string; constraints: Record<string, string> }[];
      const entry = fields.find((row) => row.field === field);
      expect(entry, `${field}를 짚는 항목이 없다`).toBeDefined();
      return (entry as { constraints: Record<string, string> }).constraints;
    }

    for (const [label, field, constraintKey, screenLabel, value] of NUMERIC_CASES) {
      it(`${label} — 사유가 "${screenLabel}"로 시작하는 한국어 문장이다`, async () => {
        const constraints = await numericRejection(field, value);
        const sentence = constraints[constraintKey];
        expect(sentence, `${field}: ${constraintKey} 제약이 없다`).toBeDefined();
        // ⓐ 한글이 있다 — 없으면 어드민의 소비 규칙(write-error-copy.ts)이 화면에서 걷어 낸다.
        expect(sentence, `${field}: 사유에 한글이 없다 — ${sentence}`).toMatch(/[가-힣]/);
        // ⓑ 화면의 라벨로 칸을 부른다(폼 `<label>`은 `${screenLabel}(원)` — 단위 주석만 뗐다).
        expect(sentence.startsWith(screenLabel), `${field}: 사유가 "${screenLabel}"로 시작하지 않는다 — ${sentence}`).toBe(
          true
        );
        // ⓒ 부정 단언: 영문 필드명이 문장에 없다.
        expect(sentence, `${field}: 사유에 영문 필드명이 있다`).not.toContain(field);
      });
    }

    /**
     * 상한 숫자는 데코레이터에서 온다(`$constraint1`) — 문장에 손으로 적히지 않는다.
     * 그래서 이 단언은 계약 상수와 **직접** 맞춘다: 문장의 숫자가 `MONEY_KRW_MAX`와 다르면
     * 그것은 곧 누군가 값을 문장에 두 번째로 적었다는 뜻이다(사람이 읽는 `21억` 표기를 포함해서).
     */
    it("문장이 말하는 상한이 MONEY_KRW_MAX 원값과 같다", async () => {
      const constraints = await numericRejection("priceMaxKrw", MONEY_KRW_MAX + 1);
      expect(constraints.max).toContain(`${MONEY_KRW_MAX}원`);
      expect(constraints.max).not.toContain("억");
    });

    it("하한 문장은 0원을 말한다 (@Min(0)의 $constraint1)", async () => {
      const constraints = await numericRejection("priceMinKrw", -1);
      expect(constraints.min).toContain("0원");
    });

    it("상한 경계값은 200이고 그대로 저장된다", async () => {
      const response = await createTemplate({ priceMinKrw: 0, priceMaxKrw: MONEY_KRW_MAX });
      expect(response.status).toBe(200);
      const row = await prisma.itemTemplate.findUnique({
        where: { id: response.body.id as string },
        select: { priceMinKrw: true, priceMaxKrw: true }
      });
      expect(row?.priceMinKrw).toBe(0);
      expect(row?.priceMaxKrw).toBe(MONEY_KRW_MAX);
    });

    it("상한을 넘는 요청은 행을 만들지 않는다", async () => {
      const marker = `${TEMPLATE_NAME_PREFIX} ${randomUUID().slice(0, 8)}`;
      const response = await createTemplate({ name: marker, priceMaxKrw: MONEY_KRW_MAX + 1 });
      expectFieldRejected(response, "priceMaxKrw");
      expect(await prisma.itemTemplate.count({ where: { name: { startsWith: marker } } })).toBe(0);
    });

    /** PATCH도 같은 문구로 지고, 기존 가격대는 손대지 않는다(잘려/줄여 저장되지 않는가). */
    it("PATCH도 같은 한국어 사유로 지고 기존 가격대가 그대로다", async () => {
      const created = await createTemplate({ priceMinKrw: 12000, priceMaxKrw: 34000 });
      expect(created.status).toBe(200);
      const itemTemplateId = created.body.id as string;

      for (const [, field, constraintKey, screenLabel, value] of NUMERIC_CASES) {
        const response = await asAdmin(
          request(app.getHttpServer()).patch(`/api/v1/admin/item-templates/${itemTemplateId}`)
        ).send({ [field]: value });
        expectFieldRejected(response, field);
        const fields = response.body.error.details.fields as { field: string; constraints: Record<string, string> }[];
        const sentence = (fields.find((row) => row.field === field) as { constraints: Record<string, string> })
          .constraints[constraintKey];
        expect(sentence, `PATCH ${field}: 사유에 한글이 없다 — ${sentence}`).toMatch(/[가-힣]/);
        expect(sentence.startsWith(screenLabel), `PATCH ${field}: ${sentence}`).toBe(true);
      }

      const row = await prisma.itemTemplate.findUnique({
        where: { id: itemTemplateId },
        select: { priceMinKrw: true, priceMaxKrw: true }
      });
      expect(row?.priceMinKrw).toBe(12000);
      expect(row?.priceMaxKrw).toBe(34000);
    });
  });
});
