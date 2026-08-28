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

  // C-11a: 세션과 함께 이 스위트가 쓰는 어드민 계정의 id를 돌려준다 — 감사 로그
  // 단언을 actorUserId로 좁히려면 필요하다(아래 bulk-apply 테스트 주석 참고).
  async function adminSession(): Promise<{ id: string; cookie: string; csrfToken: string }> {
    const admin = await createAdmin("bulk-admin@wooriai.local", "bulk-admin-password-1", "admin");
    const session = await loginAndEnroll("bulk-admin@wooriai.local", "bulk-admin-password-1");
    return { id: admin.id, ...session };
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
    // C-11a: 감사 로그를 읽기 전에 시각을 찍어 둔다 — 아래 findMany를 이 테스트가
    // 만든 행으로 좁히는 하한선이다.
    const since = new Date();

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
    // 라운드 51 #9: 가격을 쓴 행은 그 가격의 **확인 시각**(000020)도 함께 남긴다. 이 시각이
    // 없으면 앱은 이 가격을 아예 내려받지 못한다(items-catalog.service.ts toProductLinkDto).
    expect(coupangLink.priceCheckedAt).not.toBeNull();
    expect(coupangLink.priceCheckedAt!.getTime()).toBeGreaterThanOrEqual(since.getTime());

    const naverLink = await prisma.productLink.findUniqueOrThrow({ where: { id: naverLinkId } });
    expect(naverLink.affiliateUrl).toBe("https://smartstore.naver.com/wooriai/bulk-applied-b");
    expect(naverLink.isAffiliate).toBe(true);
    // 가격 칸이 빈 행은 시각도 건드리지 않는다 — 제휴 URL 교체는 가격을 확인한 것이 아니다.
    expect(naverLink.priceCheckedAt).toBeNull();

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
    //
    // C-11a: `action`만으로 조회하면 안 된다. admin-idempotency.e2e.test.ts가 같은
    // action("admin.product_link.bulk_replace")을 자기 어드민 계정으로 세 번 남기고,
    // 두 파일 모두 EXCLUSIVE_SUITES(test/helpers/exclusive-suites.ts)가 아니라 워커
    // 여럿에서 나란히 돌 수 있다 — 그러면 마지막 행이 남의 업로드일 수 있어
    // 이 단언이 무작위로 깨진다. 같은 저장소의 관례(admin-idempotency.e2e.test.ts의
    // bulkAuditCount)대로 actorUserId + 이 테스트 시작 시각으로 모집단을 좁힌다.
    const auditRows = await prisma.auditLog.findMany({
      where: {
        actorUserId: admin.id,
        action: "admin.product_link.bulk_replace",
        createdAt: { gte: since }
      },
      orderBy: { createdAt: "asc" }
    });
    // 좁힌 뒤에는 정확히 두 건 — 이 테스트가 올린 업로드 두 번이 전부다.
    expect(auditRows.length).toBe(2);
    const latest = auditRows[auditRows.length - 1];
    expect(latest.afterJson).toMatchObject({ applied: 0, skipped: 2, errors: 1, totalRows: 3 });
    expect(JSON.stringify(latest.afterJson)).not.toContain("https://");
  });

  /**
   * 라운드 51 #9 — `price_checked_at`(000020)이 움직이는 경우와 움직이지 않는 경우.
   *
   * 규칙: CSV에 가격 칸 값이 있으면 운영자가 업로드 시점에 그 값을 확인한 것이므로 값이
   * 같아도 시각을 갱신한다("아직 이 가격이 맞다"). 가격 칸이 비어 있으면 시각은 그대로 둔다
   * — 제휴 URL만 바꾼 것을 "가격을 확인했다"로 기록하면 그 신선도 자체가 허위다.
   * 아무것도 바뀌지 않는 재업로드(= skipped)는 갱신이 아예 일어나지 않는다.
   */
  it("가격 칸이 있는 행만 price_checked_at을 갱신한다 (라운드 51 #9)", async () => {
    const admin = await adminSession();
    const template = await prisma.itemTemplate.findFirstOrThrow({ where: { code: templateCode } });
    const staleCheckedAt = new Date("2026-01-02T00:00:00.000Z");
    const link = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform: "custom",
        title: `가격 확인 시각 테스트 링크 ${randomUUID().slice(0, 8)}`,
        url: "https://example.com/dev/bulk-price-checked",
        priceSnapshotKrw: 10_000,
        priceCheckedAt: staleCheckedAt
      }
    });

    async function apply(csvRow: string) {
      return await request(app.getHttpServer())
        .post("/api/v1/admin/product-links/bulk-apply")
        .set("Cookie", admin.cookie)
        .set("X-CSRF-Token", admin.csrfToken)
        .send({ csv: ["productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw", csvRow].join("\n") })
        .expect(200);
    }

    // 1) 제휴 URL만 교체(가격 칸 비움): 가격도 시각도 그대로다.
    expect((await apply(`${link.id},,,https://link.coupang.com/a/price-untouched,`)).body).toMatchObject({
      applied: 1,
      errors: 0
    });
    const afterUrlOnly = await prisma.productLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(afterUrlOnly.affiliateUrl).toBe("https://link.coupang.com/a/price-untouched");
    expect(afterUrlOnly.priceSnapshotKrw).toBe(10_000);
    expect(afterUrlOnly.priceCheckedAt?.toISOString()).toBe(staleCheckedAt.toISOString());

    // 2) 가격 칸이 있는 행: 값과 시각이 함께 갱신된다.
    const beforePriceRow = new Date();
    expect((await apply(`${link.id},,,https://link.coupang.com/a/price-updated,12000`)).body).toMatchObject({
      applied: 1,
      errors: 0
    });
    const afterPriceRow = await prisma.productLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(afterPriceRow.priceSnapshotKrw).toBe(12_000);
    expect(afterPriceRow.priceCheckedAt!.getTime()).toBeGreaterThanOrEqual(beforePriceRow.getTime());

    // 3) 같은 CSV 재업로드(무변경)는 skipped — 시각도 그대로다(멱등성 유지).
    expect((await apply(`${link.id},,,https://link.coupang.com/a/price-updated,12000`)).body).toMatchObject({
      applied: 0,
      skipped: 1
    });
    const afterReupload = await prisma.productLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(afterReupload.priceCheckedAt?.toISOString()).toBe(afterPriceRow.priceCheckedAt?.toISOString());

    await prisma.productLink.delete({ where: { id: link.id } });
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

  it("COM-107 regression: a long allowlisted affiliateUrl is never silently truncated — 600 chars applies in full, >2000 chars is a BULK_ROW_URL_TOO_LONG row error", async () => {
    const admin = await adminSession();

    // 600-char allowlisted https URL: before the fix, sanitizeCsvCell cut it at
    // 500 chars; the truncated prefix was still well-formed + allowlisted, so
    // the row validated and bulk-apply wrote the corrupted URL as "valid".
    const url600 = `https://link.coupang.com/a/${"x".repeat(600 - "https://link.coupang.com/a/".length)}`;
    expect(url600.length).toBe(600);
    // Over the 2000-char cap: must surface as a row error, never a write.
    const urlTooLong = `https://link.coupang.com/a/${"y".repeat(2100 - "https://link.coupang.com/a/".length)}`;

    const preview = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-preview")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        csv: ["productLinkId,affiliateUrl", `${coupangLinkId},${url600}`, `${naverLinkId},${urlTooLong}`].join("\n")
      })
      .expect(200);

    const previewRows = preview.body.rows as Array<Record<string, unknown>>;
    // 600-char row: valid, and the previewed replacement URL is the FULL URL.
    expect(previewRows.find((row) => row.rowNumber === 2)).toMatchObject({
      status: "valid",
      newAffiliateUrl: url600
    });
    // >2000-char row: dedicated row error, no truncated "valid" verdict.
    expect(previewRows.find((row) => row.rowNumber === 3)).toMatchObject({
      status: "error",
      errorCode: "BULK_ROW_URL_TOO_LONG"
    });

    const apply = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links/bulk-apply")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        csv: ["productLinkId,affiliateUrl", `${coupangLinkId},${url600}`, `${naverLinkId},${urlTooLong}`].join("\n")
      })
      .expect(200);
    expect(apply.body).toMatchObject({ applied: 1, errors: 1 });

    // The 600-char URL was written byte-for-byte, not a 500-char prefix.
    const applied = await prisma.productLink.findUniqueOrThrow({ where: { id: coupangLinkId } });
    expect(applied.affiliateUrl).toBe(url600);
    expect(applied.affiliateUrl?.length).toBe(600);

    // The over-limit row's target was not written at all.
    const untouched = await prisma.productLink.findUniqueOrThrow({ where: { id: naverLinkId } });
    expect(untouched.affiliateUrl).not.toBe(urlTooLong);
    expect(untouched.affiliateUrl?.startsWith("https://link.coupang.com/a/yyy")).not.toBe(true);
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
