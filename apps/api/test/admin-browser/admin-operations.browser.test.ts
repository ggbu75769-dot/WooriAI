import { generate as generateTotp, generateSecret } from "otplib";
import { createHash, randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../../src/admin/admin-password";
import { launchAdminBrowserHarness, type AdminBrowserHarness } from "./admin-browser-harness";

const PASSWORD = "release4i-operations-browser-password-1";

type BrowserAdmin = {
  id: string;
  email: string;
  secret: string;
  role: "admin" | "analyst";
};

describe("Release 4I Admin operations recovery browser qualification", () => {
  let harness: AdminBrowserHarness;
  const admins: BrowserAdmin[] = [];
  let missingImportId = "";
  let heartbeatId = "";
  let deniedMutationDlqId = "";

  beforeAll(async () => {
    harness = await launchAdminBrowserHarness();
    const activeConfig = await harness.prisma.remoteConfig.findUniqueOrThrow({ where: { configKey: "public_app_config" } });
    const heartbeat = await harness.prisma.serviceInstanceHeartbeat.create({
      data: {
        serviceType: "worker",
        instanceId: `release4i-browser-worker-${randomUUID()}`,
        bootId: randomUUID(),
        state: "healthy",
        activeConfigVersion: activeConfig.version,
        configSource: "database",
        restartCount: 1,
        startedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });
    heartbeatId = heartbeat.id;
    const sourceHash = createHash("sha256").update(randomUUID()).digest("hex");
    const missingImport = await harness.prisma.catalogImport.create({
      data: {
        requestedByAdminId: (await createAdmin("fixture-owner", "admin")).id,
        state: "missing_object",
        sourceName: `release4i-browser-missing-${randomUUID()}.csv`,
        sourceHash,
        objectKey: `catalog-imports/sha256/${sourceHash}.csv`,
        objectSha256: sourceHash,
        objectSizeBytes: 32n,
        lastErrorCode: "CATALOG_IMPORT_OBJECT_NOT_FOUND"
      }
    });
    missingImportId = missingImport.id;
    const deniedMutationDlq = await harness.prisma.deadLetterJob.create({
      data: {
        originalJobId: `browser-denied-${randomUUID()}`,
        topic: "browser.denied",
        dedupeKey: `browser-denied-${randomUUID()}`,
        payloadJson: { safe: true },
        failureCode: "BROWSER_TEST",
        attempts: 1,
        firstFailedAt: new Date(),
        lastFailedAt: new Date()
      }
    });
    deniedMutationDlqId = deniedMutationDlq.id;
  });

  afterAll(async () => {
    if (!harness) return;
    if (missingImportId) await harness.prisma.catalogImport.deleteMany({ where: { id: missingImportId } });
    if (deniedMutationDlqId) {
      await harness.prisma.jobOutbox.deleteMany({
        where: { aggregateType: "dead_letter_retry", aggregateId: deniedMutationDlqId }
      });
      await harness.prisma.auditLog.deleteMany({
        where: { targetType: "dead_letter_jobs", targetId: deniedMutationDlqId }
      });
      await harness.prisma.deadLetterJob.deleteMany({ where: { id: deniedMutationDlqId } });
    }
    if (heartbeatId) await harness.prisma.serviceInstanceHeartbeat.deleteMany({ where: { id: heartbeatId } });
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
        email: `release4i-${label}-${randomUUID().slice(0, 12)}@wooriai.local`,
        passwordHash: hashAdminPassword(PASSWORD),
        displayName: `Release 4I ${label}`,
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

  it("executes scoped recovery and config rollout/rollback with one mutation per browser action", async () => {
    const admin = await createAdmin("operations-admin", "admin");
    const { context, page } = await login(admin);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${new URL(request.url()).pathname}`));
    await page.goto(`${harness.baseUrl}/operations`);
    await page.getByRole("heading", { name: "운영 콘솔" }).waitFor();
    await page.getByRole("heading", { name: "런타임" }).waitFor();
    await page.getByText(/worker .* config v/u).waitFor();
    expect(requests.filter((entry) => entry === "GET /api/v1/admin/operations/runtime")).toHaveLength(1);
    expect(requests.filter((entry) => entry === "GET /api/v1/admin/app-config/operations")).toHaveLength(1);

    const scanResponse = page.waitForResponse((response) => response.url().includes("/admin/catalog/imports/reconciliation/preview"));
    await page.getByRole("button", { name: "불일치 미리 확인" }).click();
    const previewResponse = await scanResponse;
    expect(previewResponse.status()).toBe(200);
    const preview = await previewResponse.json() as { missingObjectJobs?: Array<{ id?: string }> };
    expect(preview.missingObjectJobs?.map((job) => job.id)).toContain(missingImportId);
    const reconciliationSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "가져오기 복구" })
    });
    await expect.poll(() => reconciliationSection.innerText()).toContain(missingImportId);
    expect(requests.filter((entry) => entry === "POST /api/v1/admin/catalog/imports/reconciliation/preview")).toHaveLength(1);

    const globalReadsBeforeRepair = requests.filter((entry) => [
      "GET /api/v1/admin/jobs/dead-letter",
      "GET /api/v1/admin/operations/privacy-requests",
      "GET /api/v1/admin/operations/link-health"
    ].includes(entry)).length;
    const repairResponse = page.waitForResponse((response) => response.url().includes(`/admin/catalog/imports/${missingImportId}/reconcile`));
    await reconciliationSection.locator("p").filter({ hasText: missingImportId })
      .getByRole("button", { name: "상태 다시 확인" }).click();
    expect((await repairResponse).status()).toBe(200);
    await expect.poll(() => requests.filter((entry) => entry === `POST /api/v1/admin/catalog/imports/${missingImportId}/reconcile`).length).toBe(1);
    expect(requests.filter((entry) => [
      "GET /api/v1/admin/jobs/dead-letter",
      "GET /api/v1/admin/operations/privacy-requests",
      "GET /api/v1/admin/operations/link-health"
    ].includes(entry)).length).toBe(globalReadsBeforeRepair);

    const configArea = page.getByLabel("원격 설정 JSON");
    const originalConfig = JSON.parse(await configArea.inputValue()) as Record<string, unknown>;
    const originalVersion = Number(originalConfig.configVersion);
    await configArea.fill(JSON.stringify({ ...originalConfig, emergencyMessage: "Release 4I browser rollout" }, null, 2));
    await page.getByLabel("원격 설정 변경 이유").fill("Release 4I browser rollout verification");
    page.once("dialog", (dialog) => void dialog.accept());
    const rolloutResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/admin/app-config") && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "검증 후 저장" }).click();
    expect((await rolloutResponse).status()).toBe(200);
    await expect.poll(async () => JSON.parse(await configArea.inputValue()).emergencyMessage, { timeout: 10_000 }).toBe("Release 4I browser rollout");
    expect(requests.filter((entry) => entry === "PATCH /api/v1/admin/app-config")).toHaveLength(1);

    await page.getByLabel("원격 설정 변경 이유").fill("Release 4I browser rollback verification");
    page.once("dialog", (dialog) => void dialog.accept());
    const rollbackResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/admin/app-config/rollback"));
    await page.getByRole("button", { name: `v${originalVersion} 새 버전으로 복원` }).click();
    expect((await rollbackResponse).status()).toBe(200);
    await expect.poll(async () => JSON.parse(await configArea.inputValue()).emergencyMessage, { timeout: 10_000 }).toBe(originalConfig.emergencyMessage);
    expect(requests.filter((entry) => entry === "POST /api/v1/admin/app-config/rollback")).toHaveLength(1);
    await context.close();
  });

  it("keeps analyst recovery surfaces read-only and enforces the direct API 403", async () => {
    const analyst = await createAdmin("operations-analyst", "analyst");
    const { context, page } = await login(analyst);
    await page.goto(`${harness.baseUrl}/operations`);
    await page.getByRole("heading", { name: "운영 콘솔" }).waitFor();
    expect(await page.getByLabel("원격 설정 JSON").getAttribute("readonly")).not.toBeNull();
    expect(await page.getByRole("button", { name: "검증 후 저장" }).count()).toBe(0);
    expect(await page.getByRole("button", { name: "상태 다시 확인" }).count()).toBe(0);
    const directStatus = await page.evaluate(async () => {
      const csrf = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("admin_csrf="))?.split("=")[1] ?? "";
      const response = await fetch("/api/v1/admin/app-config/rollback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        body: JSON.stringify({ expectedVersion: 1, targetVersion: 1, reason: "unauthorized browser request" })
      });
      return response.status;
    });
    expect(directStatus).toBe(403);
    const beforeDeniedDlqRead = await Promise.all([
      harness.prisma.deadLetterJob.count(),
      harness.prisma.jobOutbox.count()
    ]);
    const deniedDlqStatus = await page.evaluate(async () =>
      (await fetch("/api/v1/admin/jobs/dead-letter", { credentials: "include" })).status
    );
    expect(deniedDlqStatus).toBe(403);
    expect(
      await Promise.all([
        harness.prisma.deadLetterJob.count(),
        harness.prisma.jobOutbox.count()
      ])
    ).toEqual(beforeDeniedDlqRead);
    const deniedMutationBefore = {
      row: await harness.prisma.deadLetterJob.findUniqueOrThrow({
        where: { id: deniedMutationDlqId }
      }),
      outbox: await harness.prisma.jobOutbox.count({
        where: { aggregateType: "dead_letter_retry", aggregateId: deniedMutationDlqId }
      }),
      audit: await harness.prisma.auditLog.count({
        where: { targetType: "dead_letter_jobs", targetId: deniedMutationDlqId }
      })
    };
    const deniedMutationStatuses = await page.evaluate(async (deadLetterId) => {
      const csrf = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("admin_csrf="))?.split("=")[1] ?? "";
      return Promise.all(
        ["retry", "cancel"].map(async (action) =>
          (
            await fetch(`/api/v1/admin/jobs/dead-letter/${deadLetterId}/${action}`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": decodeURIComponent(csrf)
              },
              body: JSON.stringify({ note: `denied ${action}` })
            })
          ).status
        )
      );
    }, deniedMutationDlqId);
    expect(deniedMutationStatuses).toEqual([403, 403]);
    expect(
      await harness.prisma.deadLetterJob.findUniqueOrThrow({
        where: { id: deniedMutationDlqId }
      })
    ).toEqual(deniedMutationBefore.row);
    expect(
      await harness.prisma.jobOutbox.count({
        where: { aggregateType: "dead_letter_retry", aggregateId: deniedMutationDlqId }
      })
    ).toBe(deniedMutationBefore.outbox);
    expect(
      await harness.prisma.auditLog.count({
        where: { targetType: "dead_letter_jobs", targetId: deniedMutationDlqId }
      })
    ).toBe(deniedMutationBefore.audit);
    await context.close();
  });
});
