import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "sec101-e2e-password-1";

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

describe("Admin MFA + cookie session (SEC-101/SEC-102)", () => {
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

  async function createAdmin(email: string, role: "admin" | "editor" | "analyst" = "editor") {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role, active: true }
    });
  }

  it("logs in, forces MFA enrollment before any other admin route, then issues a cookie session usable through logout+revoke", async () => {
    const email = freshEmail("sec101-flow");
    await createAdmin(email);

    // 1) Password login: no MFA registered yet -> a full session is issued
    //    immediately (mfaRequired: false), but every admin route other than the
    //    MFA-setup/me/logout surface must 403 until enrollment completes.
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(loginResponse.body).toMatchObject({ mfaRequired: false, mfaEnabled: false });

    const setCookieHeader = loginResponse.headers["set-cookie"];
    expect(setCookieHeader).toBeDefined();
    const loginCookies = parseSetCookies(loginResponse);
    expect(loginCookies.admin_session).toBeTruthy();
    expect(loginCookies.admin_csrf).toBeTruthy();
    let cookie = cookieHeader(loginCookies);
    let csrfToken = loginCookies.admin_csrf;

    // Session cookie must be HttpOnly; the CSRF cookie must not be (the frontend
    // reads it via document.cookie to echo it back as a header).
    const rawSetCookies: string[] = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const sessionCookieLine = rawSetCookies.find((line) => line.startsWith("admin_session="));
    const csrfCookieLine = rawSetCookies.find((line) => line.startsWith("admin_csrf="));
    expect(sessionCookieLine?.toLowerCase()).toContain("httponly");
    expect(csrfCookieLine?.toLowerCase()).not.toContain("httponly");

    // 2) MFA-gated route rejects the still-unregistered admin.
    await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", cookie)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_MFA_SETUP_REQUIRED");
      });

    // 3) MFA-exempt routes (me, mfa/setup/*) remain reachable pre-enrollment.
    await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ mfaEnabled: false });
        expect(body.admin.email).toBe(email);
      });

    // Mutating MFA-exempt routes still require the CSRF header (double-submit).
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_CSRF_INVALID");
      });

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    const secret = setupStart.body.secret as string;
    expect(setupStart.body.otpauthUrl).toContain("otpauth://totp/");

    // Wrong code is rejected and does not enable MFA.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: "000000" })
      .expect(401);

    const validCode = await generateTotp({ secret });
    const setupVerify = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: validCode })
      .expect(200);
    const recoveryCodes = setupVerify.body.recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);

    await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", cookie)
      .expect(200)
      .expect(({ body }) => expect(body.mfaEnabled).toBe(true));

    // 4) Now enrolled: the previously-403'd admin route works, and audit-logged
    //    mfa_enabled is recorded.
    await request(app.getHttpServer()).get("/api/v1/admin/item-templates").set("Cookie", cookie).expect(200);

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries.some((entry) => entry.action === "admin.mfa_enabled")).toBe(true);

    // 5) A mutating request without the CSRF header is rejected even with a
    //    fully-valid, MFA-enrolled session.
    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", cookie)
      .send({ name: "no csrf header", necessityLevel: "essential", reasonText: "should be blocked" })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_CSRF_INVALID"));

    // 6) Logout revokes the session; the same cookie is rejected afterward.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);

    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", cookie).expect(401);
  });

  it("logs in a second time with TOTP verification (password -> mfa_required -> mfa/verify-login -> session)", async () => {
    const email = freshEmail("sec101-second-login");
    await createAdmin(email);

    // First login + enrollment to get a registered account.
    const firstLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    let cookies = parseSetCookies(firstLogin);
    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookieHeader(cookies))
      .set("X-CSRF-Token", cookies.admin_csrf)
      .expect(200);
    const secret = setupStart.body.secret as string;
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookieHeader(cookies))
      .set("X-CSRF-Token", cookies.admin_csrf)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    // Second login: password alone must now yield mfaRequired without a session cookie.
    const secondLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(secondLogin.body.mfaRequired).toBe(true);
    expect(typeof secondLogin.body.mfaToken).toBe("string");
    expect(secondLogin.headers["set-cookie"]).toBeUndefined();

    // Wrong TOTP is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken: secondLogin.body.mfaToken, code: "000000" })
      .expect(401);

    const verifyLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken: secondLogin.body.mfaToken, code: await generateTotp({ secret }) })
      .expect(200);
    expect(verifyLogin.body).toMatchObject({ mfaRequired: false, mfaEnabled: true });
    cookies = parseSetCookies(verifyLogin);
    expect(cookies.admin_session).toBeTruthy();

    await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", cookieHeader(cookies))
      .expect(200);
  });

  it("accepts a recovery code exactly once, then rejects reuse", async () => {
    const email = freshEmail("sec101-recovery");
    await createAdmin(email);

    const login = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const loginCookies = parseSetCookies(login);
    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookieHeader(loginCookies))
      .set("X-CSRF-Token", loginCookies.admin_csrf)
      .expect(200);
    const secret = setupStart.body.secret as string;
    const setupVerify = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookieHeader(loginCookies))
      .set("X-CSRF-Token", loginCookies.admin_csrf)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);
    const recoveryCode = (setupVerify.body.recoveryCodes as string[])[0];

    const secondLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    const usedOnce = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken: secondLogin.body.mfaToken, code: recoveryCode })
      .expect(200);
    expect(parseSetCookies(usedOnce).admin_session).toBeTruthy();

    /**
     * GAP-064 #7: 세션 응답이 **남은 장수**를 함께 나른다(개수만 — 값도 해시도 아니다).
     * 라운드 63이 재등록 입구를 세우며 "복구 코드는 한 번만 쓸 수 있어요"라고 말하기
     * 시작했는데 잔량은 어디에도 없어서, 운영자는 마지막 한 장을 태운 사실을 다 쓴 뒤에야
     * 알았다 — 그 시점엔 재등록 입구조차 코드를 요구하므로 DB 직접 수정 말고 길이 없다.
     * 방금 한 장을 태웠으니 발급된 10장 중 9장이 남아 있어야 한다.
     */
    expect(usedOnce.body.mfaRecoveryCodesRemaining).toBe(9);
    const usedOnceCookies = parseSetCookies(usedOnce);
    const meAfterRecovery = await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", cookieHeader(usedOnceCookies))
      .expect(200);
    // `me`도 같은 수를 말한다(화면이 새로고침 뒤에도 같은 사실을 읽는다).
    expect(meAfterRecovery.body.mfaRecoveryCodesRemaining).toBe(9);
    // 값·해시는 어느 응답에도 실리지 않는다.
    expect(meAfterRecovery.body).not.toHaveProperty("recoveryCodes");
    expect(meAfterRecovery.body).not.toHaveProperty("mfaRecoveryCodes");

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries.some((entry) => entry.action === "admin.mfa_recovery_code_used")).toBe(true);

    // Same recovery code, fresh login attempt: must now be rejected (one-time use).
    const thirdLogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken: thirdLogin.body.mfaToken, code: recoveryCode })
      .expect(401);
  });

  it("locks TOTP verification for 15 minutes after 5 consecutive failures", async () => {
    const email = freshEmail("sec101-lockout");
    await createAdmin(email);

    const login = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const loginCookies = parseSetCookies(login);
    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookieHeader(loginCookies))
      .set("X-CSRF-Token", loginCookies.admin_csrf)
      .expect(200);
    const secret = setupStart.body.secret as string;
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookieHeader(loginCookies))
      .set("X-CSRF-Token", loginCookies.admin_csrf)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    const relogin = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const mfaToken = relogin.body.mfaToken as string;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/admin/auth/mfa/verify-login")
        .send({ mfaToken, code: "000000" })
        .expect(401);
    }

    // 6th attempt (even with the *correct* code) is locked out for 15 minutes.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken, code: await generateTotp({ secret }) })
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_MFA_LOCKED"));

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries.some((entry) => entry.action === "admin.mfa_locked")).toBe(true);
  });

  it("revokes every other session for the account when MFA is disabled", async () => {
    const email = freshEmail("sec101-disable");
    await createAdmin(email);

    const loginA = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookiesA = parseSetCookies(loginA);
    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookieHeader(cookiesA))
      .set("X-CSRF-Token", cookiesA.admin_csrf)
      .expect(200);
    const secret = setupStart.body.secret as string;
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookieHeader(cookiesA))
      .set("X-CSRF-Token", cookiesA.admin_csrf)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    // A second, independent session for the same admin (e.g. a second device).
    const loginBPassword = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const loginB = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/verify-login")
      .send({ mfaToken: loginBPassword.body.mfaToken, code: await generateTotp({ secret }) })
      .expect(200);
    const cookiesB = parseSetCookies(loginB);

    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", cookieHeader(cookiesB)).expect(200);

    // Disable MFA from session A.
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/disable")
      .set("Cookie", cookieHeader(cookiesA))
      .set("X-CSRF-Token", cookiesA.admin_csrf)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    // Session A (the one that issued the disable) survives, but is now
    // MFA-unregistered again and gated the same way a fresh account would be.
    await request(app.getHttpServer())
      .get("/api/v1/admin/auth/me")
      .set("Cookie", cookieHeader(cookiesA))
      .expect(200)
      .expect(({ body }) => expect(body.mfaEnabled).toBe(false));

    // Session B was revoked as a side effect of disabling MFA.
    await request(app.getHttpServer()).get("/api/v1/admin/auth/me").set("Cookie", cookieHeader(cookiesB)).expect(401);

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries.some((entry) => entry.action === "admin.mfa_disabled")).toBe(true);
  });
});
