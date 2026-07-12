import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
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
        active: true
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

  async function loginAdmin(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
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

  it("lets an editor create item templates, blocks an analyst, and blocks unauthenticated requests", async () => {
    await createAdmin("editor-rbac2@wooriai.local", "editor-password-1", "editor");
    await createAdmin("analyst-rbac2@wooriai.local", "analyst-password-1", "analyst");

    const editorToken = await loginAdmin("editor-rbac2@wooriai.local", "editor-password-1");
    const analystToken = await loginAdmin("analyst-rbac2@wooriai.local", "analyst-password-1");

    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        name: "RBAC test item",
        necessityLevel: "essential",
        reasonText: "Needed for the RBAC db test."
      })
      .expect(200);

    // analyst can read...
    await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);

    // ...but cannot create/update.
    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        name: "Should be forbidden",
        necessityLevel: "essential",
        reasonText: "Analyst should not be able to create this."
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${created.body.id}`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ reasonText: "Analyst attempted update." })
      .expect(403);

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
    const token = await loginAdmin("deactivated-rbac@wooriai.local", "deactivated-password-1");

    await prisma.adminUser.update({ where: { id: admin.id }, data: { active: false } });

    await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    // Restore active state so a rerun of this suite against a persistent database
    // doesn't start from a deactivated account.
    await prisma.adminUser.update({ where: { id: admin.id }, data: { active: true } });
  });
});
