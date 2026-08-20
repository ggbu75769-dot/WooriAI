import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm006-e2e-password-1";

function freshEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@wooriai.local`;
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

// ADM-006: /admin/users — 관리자 계정 목록/생성/역할·활성 변경.
describe("Admin account management (ADM-006)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAdmin(email: string, role: "admin" | "editor" | "analyst" = "admin") {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role, active: true }
    });
  }

  /**
   * SEC-101/102와 동일한 실제 플로우: 비밀번호 로그인 후 TOTP 등록까지 마쳐야
   * MFA 게이트 뒤의 admin 라우트에 접근할 수 있다 (admin-rbac.db.test.ts와 동일).
   */
  async function loginAndEnroll(email: string, password: string = PASSWORD) {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);

    const cookies = parseSetCookies(loginResponse);
    const cookie = cookieHeader(cookies);
    const csrfToken = cookies.admin_csrf;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    const secret = setupStart.body.secret as string;
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    return { cookie, csrfToken };
  }

  it("blocks editor and analyst roles from every account-management route (403 ADMIN_FORBIDDEN)", async () => {
    const editorEmail = freshEmail("adm006-editor");
    const analystEmail = freshEmail("adm006-analyst");
    await createAdmin(editorEmail, "editor");
    await createAdmin(analystEmail, "analyst");

    const editor = await loginAndEnroll(editorEmail);
    const analyst = await loginAndEnroll(analystEmail);

    for (const session of [editor, analyst]) {
      await request(app.getHttpServer())
        .get("/api/v1/admin/users")
        .set("Cookie", session.cookie)
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

      await request(app.getHttpServer())
        .post("/api/v1/admin/users")
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ email: freshEmail("adm006-should-not-exist"), role: "analyst" })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${randomUUID()}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ role: "admin" })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
    }
  });

  it("enforces the MFA enrollment gate: an admin who has not enrolled yet cannot reach /admin/users", async () => {
    const adminEmail = freshEmail("adm006-no-mfa");
    await createAdmin(adminEmail, "admin");

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: adminEmail, password: PASSWORD })
      .expect(200);
    const cookie = cookieHeader(parseSetCookies(loginResponse));

    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Cookie", cookie)
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_MFA_SETUP_REQUIRED"));
  });

  it("lists admin users without ever exposing password or TOTP material", async () => {
    const adminEmail = freshEmail("adm006-list");
    const created = await createAdmin(adminEmail, "admin");
    const admin = await loginAndEnroll(adminEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Cookie", admin.cookie)
      .expect(200);

    const row = response.body.adminUsers.find((entry: { id: string }) => entry.id === created.id);
    expect(row).toMatchObject({ email: adminEmail, role: "admin", active: true });
    expect(row.createdAt).toBeTruthy();
    // 비밀번호/TOTP 관련 필드는 어떤 이름으로도 응답에 나타나면 안 된다.
    for (const entry of response.body.adminUsers) {
      expect(entry.passwordHash).toBeUndefined();
      expect(entry.password_hash).toBeUndefined();
      expect(entry.totpSecret).toBeUndefined();
      expect(entry.mfaRecoveryCodes).toBeUndefined();
    }
  });

  it("creates an admin user with a one-time temp password that works for login, and rejects duplicate emails", async () => {
    const actorEmail = freshEmail("adm006-creator");
    await createAdmin(actorEmail, "admin");
    const actor = await loginAndEnroll(actorEmail);

    const newEmail = freshEmail("adm006-created");
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({ email: newEmail, role: "editor" })
      .expect(200);

    expect(createResponse.body.admin).toMatchObject({ email: newEmail, role: "editor", active: true });
    const tempPassword = createResponse.body.tempPassword as string;
    expect(tempPassword.length).toBeGreaterThanOrEqual(16);
    expect(createResponse.body.admin.passwordHash).toBeUndefined();

    // 임시 비밀번호는 생성 응답에서 한 번만 노출된다 — 목록 재조회에는 없다.
    const list = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Cookie", actor.cookie)
      .expect(200);
    const listedRow = list.body.adminUsers.find((entry: { email: string }) => entry.email === newEmail);
    expect(listedRow).toBeDefined();
    expect(listedRow.tempPassword).toBeUndefined();

    // 발급된 임시 비밀번호로 실제 로그인이 가능해야 한다 (신규 계정은 MFA 미등록
    // 상태라 mfaRequired: false + 세션 쿠키 발급).
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: newEmail, password: tempPassword })
      .expect(200);
    expect(loginResponse.body).toMatchObject({ mfaRequired: false, mfaEnabled: false });
    expect(parseSetCookies(loginResponse).admin_session).toBeTruthy();

    // 같은 이메일(대소문자만 달라도)로는 다시 만들 수 없다.
    await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({ email: newEmail.toUpperCase(), role: "analyst" })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_EMAIL_EXISTS"));

    // 감사 로그: 생성 액션이 기록되고, 임시 비밀번호는 남지 않는다.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.admin_user.create", targetId: createResponse.body.admin.id }
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(JSON.stringify(auditRows[0]!.afterJson)).not.toContain(tempPassword);
  });

  it("forbids an admin from demoting or deactivating themselves", async () => {
    const selfEmail = freshEmail("adm006-self");
    const self = await createAdmin(selfEmail, "admin");
    const session = await loginAndEnroll(selfEmail);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${self.id}`)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ role: "editor" })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_SELF_UPDATE_FORBIDDEN"));

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${self.id}`)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ active: false })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_SELF_UPDATE_FORBIDDEN"));

    // 차단된 요청은 아무것도 바꾸지 않는다.
    const untouched = await prisma.adminUser.findUnique({ where: { id: self.id } });
    expect(untouched).toMatchObject({ role: "admin", active: true });
  });

  it("deactivates another admin (blocking their login and revoking sessions), then reactivates them", async () => {
    const actorEmail = freshEmail("adm006-actor");
    const targetEmail = freshEmail("adm006-target");
    await createAdmin(actorEmail, "admin");
    const target = await createAdmin(targetEmail, "editor");

    const actor = await loginAndEnroll(actorEmail);
    const targetSession = await loginAndEnroll(targetEmail);

    // 비활성화: 역할 변경과 함께 한 번의 PATCH로 가능하다.
    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({ active: false, role: "analyst" })
      .expect(200);
    expect(deactivated.body.admin).toMatchObject({ id: target.id, role: "analyst", active: false });

    // 이미 발급돼 있던 세션도 즉시 폐기된다.
    await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", targetSession.cookie)
      .expect(401);

    // 비활성화된 계정은 올바른 비밀번호로도 로그인할 수 없다.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: targetEmail, password: PASSWORD })
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_FAILED"));

    // 존재하지 않는 대상은 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${randomUUID()}`)
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({ active: false })
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_USER_NOT_FOUND"));

    // 빈 PATCH(role/active 둘 다 없음)는 400.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({})
      .expect(400);

    // 재활성화하면 다시 로그인할 수 있다 (MFA는 이미 등록된 상태라 TOTP 단계로 진입).
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Cookie", actor.cookie)
      .set("X-CSRF-Token", actor.csrfToken)
      .send({ active: true })
      .expect(200);

    const reLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: targetEmail, password: PASSWORD })
      .expect(200);
    expect(reLogin.body.mfaRequired).toBe(true);

    // 감사 로그: before/after 스냅샷과 함께 update 액션이 남는다.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.admin_user.update", targetId: target.id },
      orderBy: { createdAt: "asc" }
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    expect(auditRows[0]!.beforeJson).toMatchObject({ role: "editor", active: true });
    expect(auditRows[0]!.afterJson).toMatchObject({ role: "analyst", active: false });
  });
});
