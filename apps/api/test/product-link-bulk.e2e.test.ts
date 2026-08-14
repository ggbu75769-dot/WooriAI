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

// COM-107-prep: CSV bulk affiliate-link replacement. Mirrors
// content-revisions.e2e.test.ts's cookie-session + MFA-enrollment login pattern
// (real Postgres required) since the bulk endpoints sit behind the same
// AdminAuthGuard/RBAC as the rest of /admin/*.
describe.skipIf(!dbAvailable)("Admin product-link bulk replace (COM-107-prep, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let templateCode: string;
  let coupangLinkId: string;
  let naverLinkId: string;
  let secondCoupangLinkId: string;

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

    // Seed a dedicated template with three links: two coupang links (makes
    // template+platform matching ambiguous for coupang) and one naver link.
    templateCode = `bulk-e2e-${randomUUID().slice(0, 8)}`;
    const template = await prisma.itemTemplate.create({
      data: {
        code: templateCode,
        name: `벌크 교체 테스트템 ${templateCode}`,
        necessityLevel: "essential",
        reasonText: "COM-107-prep bulk replace e2e."
      }
    });
    const coupangLink = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "coupang",
        title: "벌크 교체 쿠팡 링크",
        url: "https://example.com/dev/bulk-a",
        affiliateUrl: "https://example.com/dev/affiliate/bulk-a"
      }
    });
    const secondCoupangLink = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "coupang",
        title: "벌크 교체 쿠팡 링크 2",
        url: "https://example.com/dev/bulk-a2"
      }
    });
    const naverLink = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "naver",
        title: "벌크 교체 네이버 링크",
        url: "https://example.com/dev/bulk-b"
      }
    });
    coupangLinkId = coupangLink.id;
    secondCoupangLinkId = secondCoupangLink.id;
    naverLinkId = naverLink.id;
  });

  afterAll(async () => {
    delete process.env.AFFILIATE_ALLOWED_DOMAINS;
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

  async function adminSession() {
    await createAdmin("bulk-admin@wooriai.local", "bulk-admin-password-1", "admin");
    return loginAndEnroll("bulk-admin@wooriai.local", "bulk-admin-password-1");
  }

  it("previews every row without writing: valid matches (by id and by template+platform) and per-row error codes", async () => {
    const admin = await adminSession();

    const csv = [
      "productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw",
      `${coupangLinkId},,,https://link.coupang.com/a/bulk-new-a,159000`,
      `,${templateCode},naver,https://smartstore.naver.com/wooriai/bulk-new-b,`,
      `${naverLinkId},,,http://smartstore.naver.com/wooriai/not-https,`,
      `${naverLinkId},,,https://evil-coupang.io/steal,`,
      `${randomUUID()},,,https://link.coupang.com/a/unknown,`,
      `,,,https://link.coupang.com/a/no-identifier,`,
      `,${templateCode},melon,https://link.coupang.com/a/bad-platform,`,
      `,${templateCode},coupang,https://link.coupang.com/a/ambiguous,`,
      `${coupangLinkId},,,https://link.coupang.com/a/duplicate-target,`
    ].join("\n");

    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-preview")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ csv })
      .expect(200);

    expect(response.body.summary).toEqual({ total: 9, valid: 2, errors: 7 });

    const rowByNumber = new Map<number, Record<string, unknown>>(
      (response.body.rows as Array<{ rowNumber: number }>).map((row) => [row.rowNumber, row])
    );
    expect(rowByNumber.get(2)).toMatchObject({
      status: "valid",
      matchedProductLinkId: coupangLinkId,
      currentAffiliateUrl: "https://example.com/dev/affiliate/bulk-a",
      newAffiliateUrl: "https://link.coupang.com/a/bulk-new-a"
    });
    expect(rowByNumber.get(3)).toMatchObject({
      status: "valid",
      matchedProductLinkId: naverLinkId,
      currentAffiliateUrl: null,
      newAffiliateUrl: "https://smartstore.naver.com/wooriai/bulk-new-b"
    });
    expect(rowByNumber.get(4)).toMatchObject({ status: "error", errorCode: "BULK_ROW_URL_INVALID" });
    expect(rowByNumber.get(5)).toMatchObject({ status: "error", errorCode: "BULK_ROW_DOMAIN_NOT_ALLOWED" });
    expect(rowByNumber.get(6)).toMatchObject({ status: "error", errorCode: "BULK_ROW_LINK_NOT_FOUND" });
    expect(rowByNumber.get(7)).toMatchObject({ status: "error", errorCode: "BULK_ROW_IDENTIFIER_MISSING" });
    expect(rowByNumber.get(8)).toMatchObject({ status: "error", errorCode: "BULK_ROW_PLATFORM_INVALID" });
    expect(rowByNumber.get(9)).toMatchObject({ status: "error", errorCode: "BULK_ROW_LINK_AMBIGUOUS" });
    expect(rowByNumber.get(10)).toMatchObject({ status: "error", errorCode: "BULK_ROW_DUPLICATE_TARGET" });

    // Preview must not write anything.
    const untouched = await prisma.productLink.findUniqueOrThrow({ where: { id: coupangLinkId } });
    expect(untouched.affiliateUrl).toBe("https://example.com/dev/affiliate/bulk-a");
    expect(untouched.priceSnapshotKrw).toBeNull();
  });

  it("rejects a CSV without the required header columns", async () => {
    const admin = await adminSession();
    await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-preview")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ csv: "foo,bar\n1,2" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_BULK_CSV_HEADER_INVALID"));
  });

  it("applies only valid rows in a transaction, is idempotent on re-upload, and audit-logs counts without URLs", async () => {
    const admin = await adminSession();

    const csv = [
      "productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw",
      `${coupangLinkId},,,https://link.coupang.com/a/bulk-applied-a,159000`,
      `,${templateCode},naver,https://smartstore.naver.com/wooriai/bulk-applied-b,`,
      `${naverLinkId},,,https://not-on-allowlist.io/x,` // duplicate target AND bad domain -> error either way
    ].join("\n");

    const first = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ csv })
      .expect(200);
    expect(first.body).toEqual({ applied: 2, skipped: 0, errors: 1 });

    const coupangLink = await prisma.productLink.findUniqueOrThrow({ where: { id: coupangLinkId } });
    expect(coupangLink.affiliateUrl).toBe("https://link.coupang.com/a/bulk-applied-a");
    expect(coupangLink.priceSnapshotKrw).toBe(159000);
    expect(coupangLink.isAffiliate).toBe(true);

    const naverLink = await prisma.productLink.findUniqueOrThrow({ where: { id: naverLinkId } });
    expect(naverLink.affiliateUrl).toBe("https://smartstore.naver.com/wooriai/bulk-applied-b");
    expect(naverLink.isAffiliate).toBe(true);

    // The error row's target keeps its original (never-applied) state.
    const untouched = await prisma.productLink.findUniqueOrThrow({ where: { id: secondCoupangLinkId } });
    expect(untouched.affiliateUrl).toBeNull();

    // Idempotent: the exact same CSV again changes nothing.
    const second = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ csv })
      .expect(200);
    expect(second.body).toEqual({ applied: 0, skipped: 2, errors: 1 });

    // One summary audit entry per upload: counts only, no URLs.
    const auditRows = await prisma.auditLog.findMany({
      where: { action: "admin.product_link.bulk_replace" },
      orderBy: { createdAt: "asc" }
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    const latest = auditRows[auditRows.length - 1];
    expect(latest.afterJson).toMatchObject({ applied: 0, skipped: 2, errors: 1, totalRows: 3 });
    expect(JSON.stringify(latest.afterJson)).not.toContain("https://");
  });

  it("enforces the AFFILIATE_ALLOWED_DOMAINS allowlist from the environment", async () => {
    const admin = await adminSession();
    process.env.AFFILIATE_ALLOWED_DOMAINS = "coupang.com";
    try {
      const response = await request(app.getHttpServer())
        .post("/api/v1/admin/product-links/bulk-preview")
        .set("Cookie", admin.cookie)
        .set("X-CSRF-Token", admin.csrfToken)
        .send({
          csv: [
            "productLinkId,affiliateUrl",
            `${coupangLinkId},https://smartstore.naver.com/wooriai/now-blocked`,
            `${naverLinkId},https://link.coupang.com/a/still-fine`
          ].join("\n")
        })
        .expect(200);
      const rows = response.body.rows as Array<{ rowNumber: number; status: string; errorCode?: string }>;
      expect(rows.find((row) => row.rowNumber === 2)).toMatchObject({
        status: "error",
        errorCode: "BULK_ROW_DOMAIN_NOT_ALLOWED"
      });
      expect(rows.find((row) => row.rowNumber === 3)).toMatchObject({ status: "valid" });
    } finally {
      delete process.env.AFFILIATE_ALLOWED_DOMAINS;
    }
  });

  it("blocks non-admin roles from both bulk endpoints (RBAC parity with direct product-link writes)", async () => {
    await createAdmin("bulk-editor@wooriai.local", "bulk-editor-password-1", "editor");
    const editor = await loginAndEnroll("bulk-editor@wooriai.local", "bulk-editor-password-1");

    for (const path of ["bulk-preview", "bulk-apply"]) {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/product-links/${path}`)
        .set("Cookie", editor.cookie)
        .set("X-CSRF-Token", editor.csrfToken)
        .send({ csv: `productLinkId,affiliateUrl\n${coupangLinkId},https://link.coupang.com/a/editor` })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
    }
  });
});
