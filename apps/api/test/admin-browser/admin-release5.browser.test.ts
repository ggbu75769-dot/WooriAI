import { generate as generateTotp, generateSecret } from "otplib";
import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../../src/admin/admin-password";
import { launchAdminBrowserHarness, type AdminBrowserHarness } from "./admin-browser-harness";

const PASSWORD = "release5-readiness-browser-password-1";

type BrowserAdmin = {
  id: string;
  email: string;
  secret: string;
  role: "admin" | "analyst";
};

describe("Release 5 Admin readiness browser qualification", () => {
  let harness: AdminBrowserHarness;
  const admins: BrowserAdmin[] = [];

  beforeAll(async () => {
    harness = await launchAdminBrowserHarness();
  });

  afterAll(async () => {
    if (!harness) return;
    const ids = admins.map((admin) => admin.id);
    if (ids.length > 0) {
      await harness.prisma.adminSession.deleteMany({ where: { adminUserId: { in: ids } } });
      await harness.prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
    }
    await harness.close();
  });

  async function createAdmin(label: string, role: BrowserAdmin["role"]) {
    const secret = generateSecret();
    const admin = await harness.prisma.adminUser.create({
      data: {
        email: `release5-${label}-${randomUUID().slice(0, 12)}@wooriai.local`,
        passwordHash: hashAdminPassword(PASSWORD),
        displayName: `Release 5 ${label}`,
        role,
        active: true,
        totpSecret: secret,
        mfaEnabledAt: new Date()
      }
    });
    const fixture = { id: admin.id, email: admin.email, secret, role };
    admins.push(fixture);
    return fixture;
  }

  async function login(admin: BrowserAdmin): Promise<{ context: BrowserContext; page: Page }> {
    const context = await harness.browser.newContext();
    const page = await context.newPage();
    await page.goto(harness.baseUrl);
    await page.getByLabel("관리자 이메일").fill(admin.email);
    await page.getByLabel("비밀번호").fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.getByRole("heading", { name: "2단계 인증" }).waitFor();
    await page.getByLabel("인증 코드").fill(await generateTotp({ secret: admin.secret }));
    await page.getByRole("button", { name: "확인" }).click();
    await page.getByText(admin.email, { exact: false }).waitFor({ timeout: 10_000 });
    return { context, page };
  }

  it("loads pilot and recall worklists once and previews legal content without publishing", async () => {
    const admin = await createAdmin("readiness-admin", "admin");
    const { context, page } = await login(admin);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${new URL(request.url()).pathname}`));
    await page.goto(`${harness.baseUrl}/release5`);
    await page.getByRole("heading", { name: "Release 5 준비 콘솔" }).waitFor();
    await page.getByRole("heading", { name: "저위험 catalog pilot" }).waitFor();
    await page.getByRole("heading", { name: "Recall 수동 검수 worklist" }).waitFor();
    expect(requests.filter((entry) => entry === "GET /api/v1/admin/release5/catalog/pilot-worklist")).toHaveLength(1);
    expect(requests.filter((entry) => entry === "GET /api/v1/admin/release5/external/recalls/worklist")).toHaveLength(1);
    await page.getByText(/EXTERNAL_BLOCKED/u).waitFor();

    await page.getByLabel("승인 원문 후보 JSON").fill(JSON.stringify({
      documentType: "terms",
      locale: "ko-KR",
      version: `browser-${randomUUID().slice(0, 12)}`,
      title: "브라우저 검증용 후보",
      bodyMarkdown: "실제 승인이 아닌 형식 검증 후보입니다.",
      required: true,
      effectiveAt: "2026-08-01T00:00:00.000Z"
    }));
    const previewResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/admin/release5/legal/preview"));
    await page.getByRole("button", { name: "형식·hash 미리보기" }).click();
    expect((await previewResponse).status()).toBe(200);
    await page.getByText(/아직 승인되거나 게시된 문서는 아니에요/u).waitFor();
    expect(requests.filter((entry) => entry === "POST /api/v1/admin/release5/legal/preview")).toHaveLength(1);
    expect(await page.getByRole("button", { name: /게시/u }).count()).toBe(0);
    await context.close();
  });

  it("keeps analyst readiness forms read-only", async () => {
    const analyst = await createAdmin("readiness-analyst", "analyst");
    const { context, page } = await login(analyst);
    await page.goto(`${harness.baseUrl}/release5`);
    await page.getByRole("heading", { name: "Release 5 준비 콘솔" }).waitFor();
    expect(await page.getByLabel("승인 원문 후보 JSON").getAttribute("readonly")).not.toBeNull();
    expect(await page.getByLabel("canonical item ID").getAttribute("readonly")).not.toBeNull();
    expect(await page.getByRole("button", { name: "형식·hash 미리보기" }).count()).toBe(0);
    expect(await page.getByRole("button", { name: "검증 preview" }).count()).toBe(0);
    await context.close();
  });
});
