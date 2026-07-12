import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("Admin RBAC (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // admin_users.email is globally unique, and this suite may run repeatedly against
  // a persistent database (not just once per fresh schema) — upsert instead of
  // create so a rerun never fails on a stale row left by a previous run, and so we
  // never need a destructive table truncate that would affect other suites running
  // concurrently against the same database.
  async function createAdmin(email: string, password: string, role: "admin" | "editor" | "analyst") {
    return prisma.adminUser.upsert({
      where: { email },
      update: {
        passwordHash: hashAdminPassword(password),
        role,
        active: true,
        // Reset any MFA state left by a previous run of this suite so each test
        // starts from "just logged in, not yet enrolled" as expected below.
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

  /**
   * SEC-101/102: logs in, then completes TOTP enrollment (every admin created by
   * `createAdmin` starts unregistered) so the returned session can reach
   * MFA-gated admin routes — mirrors the real login -> forced-enrollment flow.
   * Returns the cookie header + CSRF token to attach to subsequent requests.
   */
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

    // setup/verify doesn't rotate the session, but re-derive from the freshest
    // Set-Cookie response anyway in case any endpoint ever does.
    cookies = { ...cookies, ...parseSetCookies(setupVerify) };
    cookie = cookieHeader(cookies);
    csrfToken = cookies.admin_csrf;

    return { cookie, csrfToken };
  }

  it("rejects an unknown or wrong-password login", async () => {
    await createAdmin("editor-rbac@wooriai.local", "correct-horse-battery-staple", "editor");

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: "editor-rbac@wooriai.local", password: "wrong-password" })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: "nobody-rbac@wooriai.local", password: "anything" })
      .expect(401);
  });

  // COM-103 (round5a-sprint2-plan.md §3): the direct item-template write
  // endpoints are admin-only now -- an editor's only path to a live change is
  // draft -> submit -> a *different* admin's approve-publish via
  // /admin/content-revisions (covered by content-revisions.e2e.test.ts).
  // This test therefore creates via an admin account and asserts editor is
  // blocked from the direct endpoints exactly like analyst is.
  it("lets an admin create item templates directly, blocks editor/analyst direct writes, and blocks unauthenticated requests", async () => {
    await createAdmin("admin-rbac2@wooriai.local", "admin-password-1", "admin");
    await createAdmin("editor-rbac2@wooriai.local", "editor-password-1", "editor");
    await createAdmin("analyst-rbac2@wooriai.local", "analyst-password-1", "analyst");

    const admin = await loginAndEnroll("admin-rbac2@wooriai.local", "admin-password-1");
    const editor = await loginAndEnroll("editor-rbac2@wooriai.local", "editor-password-1");
    const analyst = await loginAndEnroll("analyst-rbac2@wooriai.local", "analyst-password-1");

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        name: "RBAC test item",
        necessityLevel: "essential",
        reasonText: "Needed for the RBAC db test."
      })
      .expect(200);

    // analyst can read...
    await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", analyst.cookie)
      .expect(200);

    // ...but cannot create/update.
    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", analyst.cookie)
      .set("X-CSRF-Token", analyst.csrfToken)
      .send({
        name: "Should be forbidden",
        necessityLevel: "essential",
        reasonText: "Analyst should not be able to create this."
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${created.body.id}`)
      .set("Cookie", analyst.cookie)
      .set("X-CSRF-Token", analyst.csrfToken)
      .send({ reasonText: "Analyst attempted update." })
      .expect(403);

    // Editor is also blocked from the direct-write endpoints (COM-103) -- must
    // use POST /admin/content-revisions instead.
    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        name: "Editor direct create should be forbidden",
        necessityLevel: "essential",
        reasonText: "Editor should not be able to create this directly."
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_FORBIDDEN");
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${created.body.id}`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ reasonText: "Editor direct update should be forbidden." })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_FORBIDDEN");
      });

    // No credentials at all.
    await request(app.getHttpServer()).get("/api/v1/admin/item-templates").expect(403);

    // Other suites (e.g. admin-settings.e2e.test.ts) also create item templates via
    // the legacy admin-token path and emit the same "admin.item_template.create"
    // action, and vitest runs test files in parallel — so this must be scoped to
    // the specific (unique, freshly created) targetId from this test, not the
    // action name alone.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.item_template.create", targetId: created.body.id }
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows[0]!.targetId).toBe(created.body.id);
  });

  it("deactivated admin users are rejected even with a previously-valid token", async () => {
    const admin = await createAdmin("deactivated-rbac@wooriai.local", "deactivated-password-1", "editor");
    const { cookie } = await loginAndEnroll("deactivated-rbac@wooriai.local", "deactivated-password-1");

    await prisma.adminUser.update({ where: { id: admin.id }, data: { active: false } });

    await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", cookie)
      .expect(401);

    // Restore active state so a rerun of this suite against a persistent database
    // doesn't start from a deactivated account.
    await prisma.adminUser.update({ where: { id: admin.id }, data: { active: true } });
  });
});
