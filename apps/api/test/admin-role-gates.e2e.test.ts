import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

/**
 * `@RequireAdminRoles(...)` 게이트 **넷**의 e2e 회귀 테스트.
 *
 * 종전까지 이 네 라우트에는 역할 게이트를 무는 e2e가 하나도 없었다(형제 라우트는 있다 —
 * bulk-preview/bulk-apply는 product-link-bulk.e2e.test.ts, schedule/approve-publish는
 * content-revisions.e2e.test.ts, item-templates는 admin-rbac.db.test.ts):
 *   · POST  /admin/product-links               (admin 전용)
 *   · PATCH /admin/product-links/:productLinkId (admin 전용)
 *   · POST  /admin/content-revisions            (admin·editor)
 *   · PATCH /admin/content-revisions/:id        (admin·editor)
 *
 * 특히 `PATCH /admin/product-links/:id`는 `isSponsored` · `sponsorLabel` · `affiliateUrl`을
 * 쓰는 자리다. 데코레이터 한 줄이 사라지면 **editor·analyst가 스폰서 구분 표시(DNC-011)와
 * 제휴 URL을 바꿀 수 있게 되는데**, 그 회귀를 잡는 테스트가 저장소에 없었다. 아래 두 번째
 * 테스트가 403과 함께 **행이 한 칸도 바뀌지 않았음**까지 확인한다.
 *
 * 로그인/MFA 등록 헬퍼는 형제 스위트(product-link-bulk.e2e.test.ts,
 * content-revisions.e2e.test.ts)의 형식을 그대로 따른다.
 */
describe.skipIf(!dbAvailable)("Admin 역할 게이트 e2e — product-links · content-revisions (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const suffix = randomUUID().slice(0, 8);
  const templateCode = `rolegate-e2e-${suffix}`;
  let itemTemplateId: string;
  let productLinkId: string;
  const createdProductLinkIds: string[] = [];
  const createdRevisionIds: string[] = [];

  let admin: { cookie: string; csrfToken: string };
  let editor: { cookie: string; csrfToken: string };
  let analyst: { cookie: string; csrfToken: string };

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";
    // 세 계정 × (로그인 + MFA setup start/verify) = 9번의 auth 경로 요청이라 기본 30회/분
    // 천장에 닿지는 않지만, 형제 스위트(content-revisions.e2e.test.ts)와 같은 관례로
    // 이 스위트가 재는 것과 무관한 미들웨어 천장은 걷어 둔다.
    process.env.RATE_LIMIT_AUTH_MAX = "200";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    // 자기 접두 행만 만든다 — 공유 시드의 준비템/링크는 건드리지 않는다.
    const template = await prisma.itemTemplate.create({
      data: {
        code: templateCode,
        name: `역할 게이트 테스트템 ${suffix}`,
        necessityLevel: "essential",
        reasonText: "역할 게이트 e2e 전용 행."
      }
    });
    itemTemplateId = template.id;

    const link = await prisma.productLink.create({
      data: {
        itemTemplateId,
        platform: "coupang",
        title: `역할 게이트 링크 ${suffix}`,
        url: `https://example.com/dev/rolegate-${suffix}`,
        affiliateUrl: `https://example.com/dev/affiliate/rolegate-${suffix}`,
        isSponsored: false,
        sponsorLabel: null
      }
    });
    productLinkId = link.id;
    createdProductLinkIds.push(link.id);

    await createAdmin(`rolegate-admin-${suffix}@wooriai.local`, "rolegate-admin-password-1", "admin");
    await createAdmin(`rolegate-editor-${suffix}@wooriai.local`, "rolegate-editor-password-1", "editor");
    await createAdmin(`rolegate-analyst-${suffix}@wooriai.local`, "rolegate-analyst-password-1", "analyst");

    admin = await loginAndEnroll(`rolegate-admin-${suffix}@wooriai.local`, "rolegate-admin-password-1");
    editor = await loginAndEnroll(`rolegate-editor-${suffix}@wooriai.local`, "rolegate-editor-password-1");
    analyst = await loginAndEnroll(`rolegate-analyst-${suffix}@wooriai.local`, "rolegate-analyst-password-1");
  });

  afterAll(async () => {
    delete process.env.RATE_LIMIT_AUTH_MAX;
    // 이 스위트가 만든 행만 지운다(링크 → 준비템 순서). admin_users는 형제 스위트와 같은
    // 관례로 남긴다 — 이 계정들이 남긴 audit_logs의 actor를 끊지 않기 위해서다.
    if (createdRevisionIds.length > 0) {
      await prisma.contentRevision.deleteMany({ where: { id: { in: createdRevisionIds } } });
    }
    await prisma.productLink.deleteMany({ where: { itemTemplateId } });
    await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
    await app.close();
    await prisma.$disconnect();
  });

  async function createAdmin(email: string, password: string, role: "admin" | "editor" | "analyst") {
    return prisma.adminUser.upsert({
      where: { email },
      update: {
        passwordHash: hashAdminPassword(password),
        role,
        active: true,
        totpSecret: null,
        mfaEnabledAt: null,
        mfaRecoveryCodes: []
      },
      create: {
        email,
        passwordHash: hashAdminPassword(password),
        displayName: email,
        role,
        active: true
      }
    });
  }

  function parseSetCookies(response: request.Response): Record<string, string> {
    const raw = response.headers["set-cookie"];
    const setCookieHeaders: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookies: Record<string, string> = {};
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) continue;
      cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
    }
    return cookies;
  }

  function cookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function loginAndEnroll(email: string, password: string): Promise<{ cookie: string; csrfToken: string }> {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);

    let cookies = parseSetCookies(loginResponse);
    let cookie = cookieHeader(cookies);
    let csrfToken = cookies.admin_csrf;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    const secret = setupStart.body.secret as string;
    const code = await generateTotp({ secret });

    const setupVerify = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code })
      .expect(200);
    expect(Array.isArray(setupVerify.body.recoveryCodes)).toBe(true);

    cookies = { ...cookies, ...parseSetCookies(setupVerify) };
    cookie = cookieHeader(cookies);
    csrfToken = cookies.admin_csrf;

    return { cookie, csrfToken };
  }

  it("POST /admin/product-links: editor·analyst 403, admin만 만든다", async () => {
    for (const [role, session] of [
      ["editor", editor],
      ["analyst", analyst]
    ] as const) {
      await request(app.getHttpServer())
        .post("/api/v1/admin/product-links")
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({
          itemTemplateId,
          platform: "coupang",
          title: `${role}가 만들면 안 되는 링크`,
          url: `https://example.com/dev/rolegate-${suffix}-${role}`
        })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
    }

    // 403이 "역할 때문"임을 보이는 대조군 — 같은 body를 admin이 보내면 통한다.
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        itemTemplateId,
        platform: "coupang",
        title: `admin이 만든 링크 ${suffix}`,
        url: `https://example.com/dev/rolegate-${suffix}-admin`
      })
      .expect(200);
    createdProductLinkIds.push(created.body.id as string);

    // 거절된 두 요청은 행을 남기지 않았다: 이 준비템의 링크는 시드 링크 1 + 방금 만든 1뿐.
    const links = await prisma.productLink.findMany({ where: { itemTemplateId }, select: { id: true } });
    expect(links.length).toBe(2);
  });

  it("PATCH /admin/product-links/:productLinkId: editor·analyst는 스폰서 표시(DNC-011)와 제휴 URL을 바꿀 수 없다", async () => {
    const before = await prisma.productLink.findUniqueOrThrow({
      where: { id: productLinkId },
      select: { isSponsored: true, sponsorLabel: true, affiliateUrl: true }
    });
    expect(before).toEqual({
      isSponsored: false,
      sponsorLabel: null,
      affiliateUrl: `https://example.com/dev/affiliate/rolegate-${suffix}`
    });

    for (const [role, session] of [
      ["editor", editor],
      ["analyst", analyst]
    ] as const) {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/product-links/${productLinkId}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({
          isSponsored: true,
          sponsorLabel: `${role}가 붙인 라벨`,
          affiliateUrl: `https://example.com/dev/affiliate/hijacked-by-${role}`
        })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
    }

    // 게이트가 사라지면 여기가 무너진다: 세 칸이 요청 그대로 남아 있어야 한다.
    const afterForbidden = await prisma.productLink.findUniqueOrThrow({
      where: { id: productLinkId },
      select: { isSponsored: true, sponsorLabel: true, affiliateUrl: true }
    });
    expect(afterForbidden).toEqual({
      isSponsored: false,
      sponsorLabel: null,
      affiliateUrl: `https://example.com/dev/affiliate/rolegate-${suffix}`
    });

    // 대조군: 같은 body를 admin이 보내면 세 칸이 실제로 바뀐다(스폰서를 켤 땐 라벨이 필수다).
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${productLinkId}`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        isSponsored: true,
        sponsorLabel: "광고 · 스폰서",
        affiliateUrl: `https://example.com/dev/affiliate/rolegate-${suffix}-admin`
      })
      .expect(200);

    const afterAdmin = await prisma.productLink.findUniqueOrThrow({
      where: { id: productLinkId },
      select: { isSponsored: true, sponsorLabel: true, affiliateUrl: true }
    });
    expect(afterAdmin).toEqual({
      isSponsored: true,
      sponsorLabel: "광고 · 스폰서",
      affiliateUrl: `https://example.com/dev/affiliate/rolegate-${suffix}-admin`
    });
  });

  it("POST /admin/content-revisions: analyst 403, editor는 초안을 만든다", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", analyst.cookie)
      .set("X-CSRF-Token", analyst.csrfToken)
      .send({
        entityType: "item_template",
        payload: {
          name: `analyst가 만들면 안 되는 초안 ${suffix}`,
          necessityLevel: "essential",
          reasonText: "역할 게이트 e2e."
        }
      })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        entityType: "item_template",
        payload: {
          name: `editor 초안 ${suffix}`,
          necessityLevel: "essential",
          reasonText: "역할 게이트 e2e."
        }
      })
      .expect(200);
    expect(draft.body.status).toBe("draft");
    createdRevisionIds.push(draft.body.id as string);
  });

  it("PATCH /admin/content-revisions/:id: analyst 403, editor는 자기 초안을 고친다", async () => {
    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        entityType: "item_template",
        payload: {
          name: `editor 수정 대상 초안 ${suffix}`,
          necessityLevel: "essential",
          reasonText: "역할 게이트 e2e."
        }
      })
      .expect(200);
    const revisionId = draft.body.id as string;
    createdRevisionIds.push(revisionId);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/content-revisions/${revisionId}`)
      .set("Cookie", analyst.cookie)
      .set("X-CSRF-Token", analyst.csrfToken)
      .send({
        payload: {
          name: `analyst가 고치면 안 되는 초안 ${suffix}`,
          necessityLevel: "essential",
          reasonText: "역할 게이트 e2e."
        }
      })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

    // 거절이 payload를 남기지 않았다.
    const untouched = await prisma.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
    expect((untouched.payload as { name: string }).name).toBe(`editor 수정 대상 초안 ${suffix}`);

    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/admin/content-revisions/${revisionId}`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        payload: {
          name: `editor가 고친 초안 ${suffix}`,
          necessityLevel: "essential",
          reasonText: "역할 게이트 e2e."
        }
      })
      .expect(200);
    expect(edited.body.payload.name).toBe(`editor가 고친 초안 ${suffix}`);
  });
});
