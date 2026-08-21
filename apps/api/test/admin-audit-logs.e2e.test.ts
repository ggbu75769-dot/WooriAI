import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm113-e2e-password-1";

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

// ADM-113: GET /admin/audit-logs — 감사 로그 뷰어 (인증/RBAC, offset 페이지네이션,
// 액션·행위자·기간 필터, 민감정보 마스킹).
describe("Admin audit log viewer (ADM-113)", () => {
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

  /** admin-users.e2e.test.ts와 동일한 실제 플로우: 로그인 + TOTP 등록까지 마친 세션. */
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

  /** 공유 테스트 DB의 다른 기록과 섞이지 않도록 실행마다 고유한 액션 이름을 쓴다. */
  function uniqueAction(suffix = "action") {
    return `adm113.test.${suffix}.${randomUUID().slice(0, 8)}`;
  }

  async function insertAuditRow(input: {
    action: string;
    actorUserId?: string | null;
    createdAt?: Date;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: "adm113_test",
        targetId: randomUUID(),
        beforeJson: input.beforeJson as Prisma.InputJsonValue | undefined,
        afterJson: input.afterJson as Prisma.InputJsonValue | undefined,
        createdAt: input.createdAt ?? new Date()
      }
    });
  }

  it("requires admin credentials: no cookie/token is rejected, and an expired session cookie is 401", async () => {
    // 자격증명이 전혀 없으면 legacy 토큰 폴백까지 내려가 403 ADMIN_FORBIDDEN.
    await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

    // 유효하지 않은 세션 쿠키는 401 ADMIN_UNAUTHORIZED.
    await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", "admin_session=invalid-session-token")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_UNAUTHORIZED"));
  });

  it("is admin-role-only: editor and analyst sessions get 403 ADMIN_FORBIDDEN", async () => {
    const editorEmail = freshEmail("adm113-editor");
    const analystEmail = freshEmail("adm113-analyst");
    await createAdmin(editorEmail, "editor");
    await createAdmin(analystEmail, "analyst");

    for (const session of [await loginAndEnroll(editorEmail), await loginAndEnroll(analystEmail)]) {
      await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs")
        .set("Cookie", session.cookie)
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
    }
  });

  it("paginates with limit/offset, newest first, with total and hasMore", async () => {
    const adminEmail = freshEmail("adm113-pager");
    await createAdmin(adminEmail);
    const session = await loginAndEnroll(adminEmail);

    const action = uniqueAction("page");
    const base = Date.now() - 60_000;
    // createdAt을 1초 간격으로 다르게 줘서 정렬 검증이 결정적이 되게 한다.
    for (let index = 0; index < 5; index += 1) {
      await insertAuditRow({ action, createdAt: new Date(base + index * 1000), afterJson: { seq: index } });
    }

    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&limit=2&offset=0`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(firstPage.body.pageInfo).toMatchObject({ total: 5, limit: 2, offset: 0, hasMore: true });
    expect(firstPage.body.auditLogs).toHaveLength(2);
    // 최신순(desc): seq 4, 3.
    expect(firstPage.body.auditLogs[0].after).toMatchObject({ seq: 4 });
    expect(firstPage.body.auditLogs[1].after).toMatchObject({ seq: 3 });

    const secondPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&limit=2&offset=2`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(secondPage.body.pageInfo).toMatchObject({ total: 5, limit: 2, offset: 2, hasMore: true });
    expect(secondPage.body.auditLogs.map((row: { after: { seq: number } }) => row.after.seq)).toEqual([2, 1]);

    const lastPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&limit=2&offset=4`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(lastPage.body.pageInfo).toMatchObject({ total: 5, hasMore: false });
    expect(lastPage.body.auditLogs).toHaveLength(1);
    expect(lastPage.body.auditLogs[0].after).toMatchObject({ seq: 0 });
  });

  it("filters by actorUserId and by date range, and enriches admin actors with their email", async () => {
    const adminEmail = freshEmail("adm113-filter");
    const admin = await createAdmin(adminEmail);
    const session = await loginAndEnroll(adminEmail);

    const action = uniqueAction("filter");
    const otherActor = randomUUID();
    const early = new Date("2026-01-01T00:00:00.000Z");
    const late = new Date("2026-02-01T00:00:00.000Z");
    await insertAuditRow({ action, actorUserId: admin.id, createdAt: early });
    await insertAuditRow({ action, actorUserId: otherActor, createdAt: late });

    // 행위자 필터: admin.id 행만 남고, 어드민 계정이므로 이메일이 붙는다.
    const byActor = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&actorUserId=${admin.id}`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(byActor.body.pageInfo.total).toBe(1);
    expect(byActor.body.auditLogs[0]).toMatchObject({ actorUserId: admin.id, actorEmail: adminEmail });

    // 어드민 계정이 아닌 행위자는 actorEmail이 null이다.
    const byOther = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&actorUserId=${otherActor}`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(byOther.body.pageInfo.total).toBe(1);
    expect(byOther.body.auditLogs[0].actorEmail).toBeNull();

    // 기간 필터: from/to로 각각 한 건씩만 잡힌다.
    const fromOnly = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&from=2026-01-15T00:00:00.000Z`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(fromOnly.body.pageInfo.total).toBe(1);
    expect(fromOnly.body.auditLogs[0].actorUserId).toBe(otherActor);

    const toOnly = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}&to=2026-01-15T00:00:00.000Z`)
      .set("Cookie", session.cookie)
      .expect(200);
    expect(toOnly.body.pageInfo.total).toBe(1);
    expect(toOnly.body.auditLogs[0].actorUserId).toBe(admin.id);
  });

  it("shows real admin actions recorded by AuditLoggerService (end-to-end through the write path)", async () => {
    const adminEmail = freshEmail("adm113-e2e-writer");
    await createAdmin(adminEmail);
    const session = await loginAndEnroll(adminEmail);

    // 실제 관리자 행위(ADM-006 계정 생성)가 뷰어에 나타나야 한다.
    const createdEmail = freshEmail("adm113-created");
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ email: createdEmail, role: "analyst" })
      .expect(200);

    const viewer = await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs?action=admin.admin_user.create&limit=100")
      .set("Cookie", session.cookie)
      .expect(200);
    const entry = viewer.body.auditLogs.find(
      (row: { targetId: string | null }) => row.targetId === createResponse.body.admin.id
    );
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      action: "admin.admin_user.create",
      targetType: "admin_users",
      actorEmail: adminEmail,
      after: { email: createdEmail, role: "analyst" }
    });
    // 임시 비밀번호 원문은 뷰어 응답 어디에도 없어야 한다.
    expect(JSON.stringify(viewer.body)).not.toContain(createResponse.body.tempPassword);
  });

  it("never returns raw credential-like values: password/token/secret keys are masked", async () => {
    const adminEmail = freshEmail("adm113-redact");
    await createAdmin(adminEmail);
    const session = await loginAndEnroll(adminEmail);

    const action = uniqueAction("redact");
    await insertAuditRow({
      action,
      beforeJson: { password: "raw-password-before", keep: "before-ok" },
      afterJson: {
        password: "raw-password-after",
        nested: { accessToken: "raw-access-token", list: [{ totpSecret: "raw-totp-secret" }] },
        keep: "after-ok"
      }
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs?action=${encodeURIComponent(action)}`)
      .set("Cookie", session.cookie)
      .expect(200);

    expect(response.body.pageInfo.total).toBe(1);
    const [entry] = response.body.auditLogs;
    expect(entry.before).toMatchObject({ password: "[REDACTED]", keep: "before-ok" });
    expect(entry.after.password).toBe("[REDACTED]");
    expect(entry.after.nested.accessToken).toBe("[REDACTED]");
    expect(entry.after.nested.list[0].totpSecret).toBe("[REDACTED]");
    expect(entry.after.keep).toBe("after-ok");

    const serialized = JSON.stringify(response.body);
    for (const raw of ["raw-password-before", "raw-password-after", "raw-access-token", "raw-totp-secret"]) {
      expect(serialized).not.toContain(raw);
    }
  });

  it("rejects invalid query values with 400 VALIDATION_ERROR", async () => {
    const adminEmail = freshEmail("adm113-invalid");
    await createAdmin(adminEmail);
    const session = await loginAndEnroll(adminEmail);

    for (const query of ["limit=0", "limit=101", "offset=-1", "actorUserId=not-a-uuid", "from=not-a-date"]) {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?${query}`)
        .set("Cookie", session.cookie)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    }
  });
});
