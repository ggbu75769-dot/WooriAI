import { generate as generateTotp } from "otplib";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../../src/admin/admin-password";
import { launchAdminBrowserHarness, type AdminBrowserHarness } from "./admin-browser-harness";

const PASSWORD = "release4g-browser-password-1";

describe("Release 4G Admin browser authentication", () => {
  let harness: AdminBrowserHarness;
  const adminIds: string[] = [];

  beforeAll(async () => {
    harness = await launchAdminBrowserHarness();
  });

  afterAll(async () => {
    if (harness) {
      if (adminIds.length > 0) {
        await harness.prisma.adminSession.deleteMany({ where: { adminUserId: { in: adminIds } } });
        await harness.prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
      }
      await harness.close();
    }
  });

  it("completes MFA enrollment, rejects a wrong MFA code, handles session expiry, and logs out", async () => {
    const email = `release4g-browser-${randomUUID()}@wooriai.local`;
    const admin = await harness.prisma.adminUser.create({
      data: {
        email,
        passwordHash: hashAdminPassword(PASSWORD),
        displayName: "Release 4G 브라우저 관리자",
        role: "admin",
        active: true
      }
    });
    adminIds.push(admin.id);

    const context = await harness.browser.newContext();
    const page = await context.newPage();
    await page.goto(harness.baseUrl);

    await page.getByLabel("관리자 이메일").fill(email);
    await page.getByLabel("비밀번호").fill("wrong-password");
    await page.getByRole("button", { name: "로그인" }).click();
    await page.getByRole("alert").filter({ hasText: "이메일 또는 비밀번호" }).waitFor();
    await page.getByLabel("비밀번호").fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();

    await page.getByRole("heading", { name: "2단계 인증(MFA) 등록" }).waitFor({ timeout: 10_000 });
    const secret = (await page.locator("code").textContent())?.trim();
    expect(secret).toBeTruthy();
    await page.getByLabel("인증 코드").fill(await generateTotp({ secret: secret! }));
    const setupVerification = page.waitForResponse((response) => response.url().endsWith("/api/v1/admin/auth/mfa/setup/verify"));
    await page.getByRole("button", { name: "등록 완료" }).click();
    const setupResponse = await setupVerification;
    const setupBody = await setupResponse.text();
    expect(setupResponse.status(), setupBody).toBe(200);
    await page.getByRole("heading", { name: "복구 코드를 저장해 주세요" }).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "저장했어요, 계속하기" }).click();
    await page.getByText(email, { exact: false }).waitFor({ timeout: 10_000 });
    const csrfStatus = await page.evaluate(async () => {
      const response = await fetch("/api/v1/admin/catalog/taxonomy/nodes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "C97", level: "domain", nameKo: "CSRF 차단 fixture" })
      });
      return response.status;
    });
    expect(csrfStatus).toBe(403);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.getByRole("heading", { name: "WooriAI 관리자" }).waitFor({ timeout: 10_000 });

    await page.getByLabel("관리자 이메일").fill(email);
    await page.getByLabel("비밀번호").fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.getByRole("heading", { name: "2단계 인증" }).waitFor({ timeout: 10_000 });
    await page.getByLabel("인증 코드").fill("000000");
    await page.getByRole("button", { name: "확인" }).click();
    await page.getByRole("alert").filter({ hasText: "인증" }).waitFor();
    await page.getByLabel("인증 코드").fill(await generateTotp({ secret: secret! }));
    await page.getByRole("button", { name: "확인" }).click();
    await page.getByText(email, { exact: false }).waitFor({ timeout: 10_000 });

    await harness.prisma.adminSession.updateMany({
      where: { adminUserId: admin.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await page.goto(`${harness.baseUrl}/catalog`);
    await page.getByRole("heading", { name: "WooriAI 관리자" }).waitFor({ timeout: 10_000 });

    await context.close();
  });
});
