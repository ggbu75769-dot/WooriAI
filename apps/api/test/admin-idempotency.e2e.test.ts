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
 * R19-F: admin 위험 쓰기 경로의 서버 멱등키(IdempotencyInterceptor).
 *
 * FIX-118C가 후속 과제로 남겨둔 것 — /admin/* 의 쓰기에는 멱등 장치가 없어
 * 클라이언트 쓰기 타임아웃(60초) 뒤 운영자가 재시도하면 그대로 두 번 반영됐다
 * (bulk-apply 500행 재실행, 계정 생성 후 임시 비밀번호 유실 등).
 *
 * 여기서 검증하는 계약:
 *  - 같은 키 + 같은 body → 핸들러는 한 번만 실행되고 첫 응답이 재생된다.
 *    (bulk-apply의 자연스러운 재적용은 applied:0/skipped:N이 되므로, 두 번째
 *     응답이 applied:N 그대로라는 것 자체가 "핸들러가 다시 안 돌았다"는 증거다.
 *     감사 로그 1건으로 교차 확인한다.)
 *  - 다른 키 → 완전히 별개의 요청으로 정상 실행된다.
 *  - 키 없음 → 기존(비멱등) 동작 그대로. opt-in 계약이라 하위호환이 자동이다.
 *  - 같은 키 + 다른 body → 409 IDEMPOTENCY_KEY_CONFLICT.
 *  - 키 스코프는 admin 계정별이다(관리자 A의 키가 관리자 B의 요청을 재생하지
 *    않는다) — 인터셉터가 request.user.id가 없을 때 admin 세션 id를 쓰기 때문.
 *  - POST /admin/users: 같은 키 재시도가 계정을 두 번 만들지 않고 tempPassword까지
 *    그대로 재생한다.
 *  - 레거시 x-admin-token(dev/test 전용, actor id가 uuid가 아닌 "dev-admin")
 *    경로에서도 멱등키가 500 없이 동작한다.
 */
describe.skipIf(!dbAvailable)("Admin 쓰기 멱등키 (R19-F, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let templateCode: string;
  let linkId: string;

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

    templateCode = `idem-e2e-${randomUUID().slice(0, 8)}`;
    const template = await prisma.itemTemplate.create({
      data: {
        code: templateCode,
        name: `멱등키 테스트템 ${templateCode}`,
        necessityLevel: "essential",
        reasonText: "R19-F admin idempotency e2e."
      }
    });
    const link = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "coupang",
        title: "멱등키 테스트 링크",
        url: "https://example.com/dev/idem-a",
        affiliateUrl: "https://example.com/dev/affiliate/idem-a"
      }
    });
    linkId = link.id;
  });

  afterAll(async () => {
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
      create: { email, passwordHash: hashAdminPassword(password), displayName: email, role, active: true }
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

  /** 쿠키 세션 + MFA 등록까지 마친 admin 세션(다른 admin e2e와 동일 패턴). */
  async function adminSession(email: string): Promise<{ id: string; cookie: string; csrfToken: string }> {
    const password = "idem-admin-password-1";
    const admin = await createAdmin(email, password, "admin");

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
    const code = await generateTotp({ secret: setupStart.body.secret as string });

    const setupVerify = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code })
      .expect(200);

    cookies = { ...cookies, ...parseSetCookies(setupVerify) };
    cookie = cookieHeader(cookies);
    csrfToken = cookies.admin_csrf;

    return { id: admin.id, cookie, csrfToken };
  }

  function bulkCsv(affiliateUrl: string): string {
    return [
      "productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw",
      `${linkId},,,${affiliateUrl},`
    ].join("\n");
  }

  function bulkApply(
    session: { cookie: string; csrfToken: string },
    csv: string,
    idempotencyKey?: string
  ): request.Test {
    const req = request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken);
    if (idempotencyKey) req.set("Idempotency-Key", idempotencyKey);
    return req.send({ csv });
  }

  /** 이 CSV 업로드가 실제로 몇 번 실행됐는지 — 핸들러가 감사 로그를 1건씩 남긴다. */
  async function bulkAuditCount(actorUserId: string, since: Date): Promise<number> {
    return prisma.auditLog.count({
      where: { actorUserId, action: "admin.product_link.bulk_replace", createdAt: { gte: since } }
    });
  }

  it("bulk-apply: 같은 키로 두 번 보내면 한 번만 반영되고 첫 응답이 재생된다", async () => {
    const admin = await adminSession("idem-replay-admin@wooriai.local");
    const since = new Date();
    const key = randomUUID();
    const csv = bulkCsv("https://link.coupang.com/a/idem-replay");

    const first = await bulkApply(admin, csv, key).expect(200);
    expect(first.body).toEqual({ applied: 1, skipped: 0, errors: 0 });

    const second = await bulkApply(admin, csv, key).expect(200);
    // 핸들러가 다시 돌았다면 이미 같은 URL이라 applied:0/skipped:1이 나왔을 것.
    // 첫 응답 그대로라는 것이 재생(replay)의 증거다.
    expect(second.body).toEqual(first.body);
    expect(await bulkAuditCount(admin.id, since)).toBe(1);

    const link = await prisma.productLink.findUniqueOrThrow({ where: { id: linkId } });
    expect(link.affiliateUrl).toBe("https://link.coupang.com/a/idem-replay");
  });

  it("bulk-apply: 다른 키는 별개 요청으로 실제 실행된다", async () => {
    const admin = await adminSession("idem-distinct-admin@wooriai.local");
    const since = new Date();
    const csv = bulkCsv("https://link.coupang.com/a/idem-distinct");

    const first = await bulkApply(admin, csv, randomUUID()).expect(200);
    expect(first.body).toEqual({ applied: 1, skipped: 0, errors: 0 });

    const second = await bulkApply(admin, csv, randomUUID()).expect(200);
    // 실제로 다시 실행됐다 — 이미 같은 값이라 "변경 없음(skipped)"으로 집계된다.
    expect(second.body).toEqual({ applied: 0, skipped: 1, errors: 0 });
    expect(await bulkAuditCount(admin.id, since)).toBe(2);
  });

  it("bulk-apply: 키를 안 보내면 기존(비멱등) 동작 그대로다", async () => {
    const admin = await adminSession("idem-nokey-admin@wooriai.local");
    const since = new Date();
    const csv = bulkCsv("https://link.coupang.com/a/idem-nokey");

    const first = await bulkApply(admin, csv).expect(200);
    expect(first.body).toEqual({ applied: 1, skipped: 0, errors: 0 });

    const second = await bulkApply(admin, csv).expect(200);
    expect(second.body).toEqual({ applied: 0, skipped: 1, errors: 0 });
    expect(await bulkAuditCount(admin.id, since)).toBe(2);

    // 멱등키 행이 하나도 생기지 않는다 — 인터셉터가 완전한 no-op으로 통과시켰다.
    expect(
      await prisma.idempotencyKey.count({ where: { userId: admin.id, createdAt: { gte: since } } })
    ).toBe(0);
  });

  it("bulk-apply: 같은 키 + 다른 body는 409 IDEMPOTENCY_KEY_CONFLICT", async () => {
    const admin = await adminSession("idem-conflict-admin@wooriai.local");
    const key = randomUUID();

    await bulkApply(admin, bulkCsv("https://link.coupang.com/a/idem-conflict-1"), key).expect(200);

    const conflict = await bulkApply(admin, bulkCsv("https://link.coupang.com/a/idem-conflict-2"), key).expect(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");

    // 두 번째 CSV는 반영되지 않았다.
    const link = await prisma.productLink.findUniqueOrThrow({ where: { id: linkId } });
    expect(link.affiliateUrl).toBe("https://link.coupang.com/a/idem-conflict-1");
  });

  it("멱등키 스코프는 admin 계정별이다 — 다른 관리자의 같은 키는 재생되지 않는다", async () => {
    const adminA = await adminSession("idem-scope-a@wooriai.local");
    const adminB = await adminSession("idem-scope-b@wooriai.local");
    const key = randomUUID();
    const csv = bulkCsv("https://link.coupang.com/a/idem-scope");

    const first = await bulkApply(adminA, csv, key).expect(200);
    expect(first.body).toEqual({ applied: 1, skipped: 0, errors: 0 });

    const other = await bulkApply(adminB, csv, key).expect(200);
    // B에게는 처음 보는 키라 실제로 실행됐다(이미 같은 값이므로 skipped).
    expect(other.body).toEqual({ applied: 0, skipped: 1, errors: 0 });

    expect(await prisma.idempotencyKey.count({ where: { userId: adminA.id, idemKey: key } })).toBe(1);
    expect(await prisma.idempotencyKey.count({ where: { userId: adminB.id, idemKey: key } })).toBe(1);
  });

  it("POST /admin/users: 같은 키 재시도는 계정을 두 번 만들지 않고 임시 비밀번호까지 재생한다", async () => {
    const admin = await adminSession("idem-users-admin@wooriai.local");
    const key = randomUUID();
    const email = `idem-created-${randomUUID().slice(0, 8)}@wooriai.local`;
    const body = { email, role: "editor" as const };

    const first = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .set("Idempotency-Key", key)
      .send(body)
      .expect(200);
    expect(first.body.admin.email).toBe(email);
    expect(typeof first.body.tempPassword).toBe("string");

    // 키가 없었다면 이 재시도는 409 ADMIN_EMAIL_EXISTS로 막히고 임시 비밀번호는
    // 영영 사라졌을 것이다(계정 삭제 API도 없다).
    const second = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .set("Idempotency-Key", key)
      .send(body)
      .expect(200);
    expect(second.body).toEqual(first.body);

    expect(await prisma.adminUser.count({ where: { email } })).toBe(1);
  });

  it("레거시 x-admin-token(actor id가 uuid가 아님) 경로에서도 멱등키가 동작한다", async () => {
    const key = randomUUID();
    const csv = bulkCsv("https://link.coupang.com/a/idem-legacy");

    const first = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("x-admin-token", "test-legacy-admin-token")
      .set("Idempotency-Key", key)
      .send({ csv })
      .expect(200);
    expect(first.body).toEqual({ applied: 1, skipped: 0, errors: 0 });

    const second = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("x-admin-token", "test-legacy-admin-token")
      .set("Idempotency-Key", key)
      .send({ csv })
      .expect(200);
    expect(second.body).toEqual(first.body);
  });
});
