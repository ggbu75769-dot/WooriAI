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

const PASSWORD = "adm007-e2e-password-1";
const NEW_PASSWORD = "adm007-new-password-9";

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

// ADM-007: POST /admin/auth/change-password — 로그인한 관리자 본인의 비밀번호
// 변경. ADM-006의 임시 비밀번호가 영구 비밀번호로 남던 구멍을 막는다.
describe("Admin change password (ADM-007)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

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

  /** 비밀번호 로그인만 수행 (MFA 미등록 상태 유지). */
  async function loginOnly(email: string, password: string = PASSWORD) {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);
    const cookies = parseSetCookies(loginResponse);
    return { cookie: cookieHeader(cookies), csrfToken: cookies.admin_csrf };
  }

  it("is reachable BEFORE MFA enrollment (MFA-exempt, same precedent as mfa/setup): a fresh admin can rotate their temp password immediately", async () => {
    const email = freshEmail("adm007-fresh");
    await createAdmin(email);
    // MFA 미등록 세션 — MFA 게이트가 걸린 라우트라면 여기서 403이 났을 것.
    const session = await loginOnly(email);

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200)
      .expect(({ body }) => expect(body.success).toBe(true));

    // 이전 비밀번호로는 더 이상 로그인할 수 없고, 새 비밀번호로는 된다.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_FAILED"));
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: NEW_PASSWORD })
      .expect(200);

    // 저장은 scrypt 해시로만 — 평문이 어디에도 남지 않는다.
    const stored = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash.startsWith("scrypt:")).toBe(true);
    expect(stored.passwordHash).not.toContain(NEW_PASSWORD);
  });

  it("rejects a wrong current password (401, audit-logged without any password material)", async () => {
    const email = freshEmail("adm007-wrong");
    const admin = await createAdmin(email);
    const session = await loginOnly(email);

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: "totally-wrong-password", newPassword: NEW_PASSWORD })
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_INVALID"));

    // 비밀번호는 그대로다.
    await request(app.getHttpServer()).post("/api/v1/admin/auth/login").send({ email, password: PASSWORD }).expect(200);

    // 실패도 감사 로그에 남지만, 어떤 비밀번호 문자열도 포함하지 않는다.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.password_change_failed", targetId: admin.id }
    });
    expect(auditRows.length).toBeGreaterThan(0);
    for (const row of auditRows) {
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain(PASSWORD);
      expect(serialized).not.toContain(NEW_PASSWORD);
      expect(serialized).not.toContain("totally-wrong-password");
    }
  });

  it("enforces the minimum length policy on the new password and rejects reusing the current one", async () => {
    const email = freshEmail("adm007-policy");
    await createAdmin(email);
    const session = await loginOnly(email);

    // 10자 미만은 VALIDATION_ERROR.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: "short-pw" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

    // 기존 비밀번호 재사용 금지.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_UNCHANGED"));

    await request(app.getHttpServer()).post("/api/v1/admin/auth/login").send({ email, password: PASSWORD }).expect(200);
  });

  it("revokes every OTHER session of the admin but keeps the one that performed the change, and audit-logs the change without passwords", async () => {
    const email = freshEmail("adm007-sessions");
    const admin = await createAdmin(email);

    const sessionA = await loginOnly(email);
    const sessionB = await loginOnly(email);

    // 두 세션 모두 유효한 상태에서 시작.
    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", sessionA.cookie).expect(200);
    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", sessionB.cookie).expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", sessionA.cookie)
      .set("X-CSRF-Token", sessionA.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);

    // 변경을 수행한 세션 A는 살아 있고, 다른 세션 B는 즉시 폐기된다.
    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", sessionA.cookie).expect(200);
    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", sessionB.cookie).expect(401);

    // 성공 감사 로그: 액션만 기록, 비밀번호(이전/새것 모두)는 절대 남지 않는다.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.password_changed", targetId: admin.id }
    });
    expect(auditRows.length).toBeGreaterThan(0);
    for (const row of auditRows) {
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain(PASSWORD);
      expect(serialized).not.toContain(NEW_PASSWORD);
    }
  });

  it("requires a session and the CSRF double-submit header like every other state-changing admin route", async () => {
    const email = freshEmail("adm007-csrf");
    await createAdmin(email);
    const session = await loginOnly(email);

    // 세션 없이 접근 불가 (쿠키가 없으면 dev/test 전용 레거시 토큰 가드로
    // 폴백하고, 토큰 헤더도 없으니 403 ADMIN_FORBIDDEN).
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

    // 세션이 있어도 CSRF 헤더가 없으면 403.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_CSRF_INVALID"));
  });

  it("still works for an MFA-enrolled admin's normal session", async () => {
    const email = freshEmail("adm007-mfa");
    await createAdmin(email);
    const session = await loginOnly(email);

    // MFA 등록까지 마친 실제 플로우 (admin-users.e2e.test.ts와 동일).
    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ code: await generateTotp({ secret: setupStart.body.secret as string }) })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/change-password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);

    // 새 비밀번호로 로그인하면 MFA 단계로 진입한다 (MFA 상태는 그대로).
    const reLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: NEW_PASSWORD })
      .expect(200);
    expect(reLogin.body.mfaRequired).toBe(true);
  });
});
