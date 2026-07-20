import ExcelJS from "exceljs";
import { generate as generateTotp, generateSecret } from "otplib";
import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../../src/admin/admin-password";
import { CatalogV2Service } from "../../src/catalog-v2/catalog-v2.service";
import { launchAdminBrowserHarness, type AdminBrowserHarness } from "./admin-browser-harness";

const PASSWORD = "release4g-catalog-browser-password-1";

type BrowserAdmin = {
  id: string;
  email: string;
  secret: string;
};

type CatalogFixture = {
  id: string;
  code: string;
  nameKo: string;
  contentVersion: number;
  contentHash: string;
};

describe("Release 4G Admin catalog browser qualification", () => {
  let harness: AdminBrowserHarness;
  let catalog: CatalogV2Service;
  let categoryId: string;
  const admins: BrowserAdmin[] = [];
  const itemIds: string[] = [];
  const taxonomyNodeIds: string[] = [];
  const reportIds: string[] = [];
  const importSourcePrefix = `release4g-browser-${randomUUID()}`;

  beforeAll(async () => {
    harness = await launchAdminBrowserHarness();
    catalog = harness.app.get(CatalogV2Service);
    categoryId = (await harness.prisma.catalogNode.findFirstOrThrow({
      where: { level: "subcategory", active: true },
      select: { id: true }
    })).id;
  });

  afterAll(async () => {
    if (!harness) return;
    const imports = await harness.prisma.catalogImport.findMany({
      where: { sourceName: { startsWith: importSourcePrefix } },
      select: { id: true }
    });
    if (imports.length > 0) {
      await harness.prisma.catalogImport.deleteMany({ where: { id: { in: imports.map((entry) => entry.id) } } });
    }
    if (reportIds.length > 0) {
      const deliveries = await harness.prisma.notificationDelivery.findMany({
        where: { dedupeKey: { in: reportIds.map((id) => `catalog-report:${id}:resolved`) } },
        select: { id: true }
      });
      if (deliveries.length > 0) {
        await harness.prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: deliveries.map((entry) => entry.id) } } });
        await harness.prisma.notificationDelivery.deleteMany({ where: { id: { in: deliveries.map((entry) => entry.id) } } });
      }
      await harness.prisma.catalogItemReport.deleteMany({ where: { id: { in: reportIds } } });
    }
    if (itemIds.length > 0) {
      await Promise.all([
        harness.prisma.catalogItemApproval.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.catalogItemRevision.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemSynonym.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemContextRule.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemSafetyRule.deleteMany({ where: { itemDefinitionId: { in: itemIds } } }),
        harness.prisma.itemEvidenceSource.deleteMany({ where: { itemDefinitionId: { in: itemIds } } })
      ]);
      await harness.prisma.itemDefinition.deleteMany({ where: { id: { in: itemIds } } });
    }
    for (const nodeId of [...taxonomyNodeIds].reverse()) {
      await harness.prisma.catalogNode.deleteMany({ where: { id: nodeId } });
    }
    const adminIds = admins.map((admin) => admin.id);
    if (adminIds.length > 0) {
      await harness.prisma.adminSession.deleteMany({ where: { adminUserId: { in: adminIds } } });
      await harness.prisma.catalogReviewerCredential.deleteMany({ where: { adminId: { in: adminIds } } });
      await harness.prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
    }
    await harness.close();
  });

  async function createAdmin(label: string, role: "admin" | "editor" | "analyst" = "admin") {
    const secret = generateSecret();
    const admin = await harness.prisma.adminUser.create({
      data: {
        email: `r4g-${label}-${randomUUID().slice(0, 12)}@wooriai.local`,
        passwordHash: hashAdminPassword(PASSWORD),
        displayName: `Release 4G ${label}`,
        role,
        active: true,
        totpSecret: secret,
        mfaEnabledAt: new Date()
      }
    });
    const fixture = { id: admin.id, email: admin.email, secret };
    admins.push(fixture);
    return fixture;
  }

  async function createItem(authorId: string, safetyTier: "normal" | "high", label: string): Promise<CatalogFixture> {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const item = await harness.prisma.itemDefinition.create({
      data: {
        code: `R4-G-${label}-${suffix}`,
        nameKo: `Release 4G ${label} 품목 ${suffix}`,
        shortDescription: "브라우저 운영 검증 전 설명",
        targetSubject: "child",
        necessity: "recommended",
        recommendationState: safetyTier === "high" ? "professional_review_required" : "recommended",
        reasonText: "브라우저에서 역할 분리와 상태 전이를 검증합니다.",
        skipReasonText: "가족 상황에 맞지 않으면 준비하지 않아도 됩니다.",
        timingSummary: "가족의 준비 일정에 맞춰 확인합니다.",
        secondhandPolicy: "inspect",
        rentalPolicy: "conditional",
        safetyTier,
        sourceSummary: "격리된 Release 4G 브라우저 fixture",
        status: "in_review"
      }
    });
    itemIds.push(item.id);
    await Promise.all([
      harness.prisma.itemDefinitionCategory.create({
        data: { itemDefinitionId: item.id, catalogNodeId: categoryId, isPrimary: true }
      }),
      harness.prisma.itemLifecycleRule.create({
        data: { itemDefinitionId: item.id, axis: "child", lifecycleCode: "newborn_0_3m" }
      }),
      harness.prisma.itemContextRule.create({
        data: { itemDefinitionId: item.id, contextCode: "all" }
      }),
      ...(safetyTier === "high"
        ? [harness.prisma.itemSafetyRule.create({
            data: {
              itemDefinitionId: item.id,
              ruleCode: `RELEASE4G-${suffix}`,
              severity: "high",
              guidanceText: "외부 전문가 검수 근거가 확인되기 전에는 게시하지 않습니다.",
              blocksRecommendation: true
            }
          })]
        : [])
    ]);
    const draft = await catalog.updateItemDraft(authorId, item.id, {
      expectedVersion: 1,
      shortDescription: "브라우저 역할 분리 검증용 draft"
    });
    return {
      id: draft.id,
      code: draft.code,
      nameKo: draft.nameKo,
      contentVersion: draft.contentVersion,
      contentHash: draft.contentHash!
    };
  }

  async function loginCatalog(admin: BrowserAdmin): Promise<{ context: BrowserContext; page: Page }> {
    const context = await harness.browser.newContext();
    const page = await context.newPage();
    await page.goto(`${harness.baseUrl}/catalog`);
    await page.getByLabel("관리자 이메일").fill(admin.email);
    await page.getByLabel("비밀번호").fill(PASSWORD);
    const loginResponsePromise = page.waitForResponse((response) => response.url().includes("/api/v1/admin/auth/login"));
    await page.getByRole("button", { name: "로그인" }).click();
    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      throw new Error(`ADMIN_BROWSER_LOGIN_${loginResponse.status()}: ${await loginResponse.text()}`);
    }
    await page.getByRole("heading", { name: "2단계 인증" }).waitFor();
    await page.getByLabel("인증 코드").fill(await generateTotp({ secret: admin.secret }));
    const mfaResponsePromise = page.waitForResponse((response) => response.url().includes("/api/v1/admin/auth/mfa/verify-login"));
    await page.getByRole("button", { name: "확인" }).click();
    const mfaResponse = await mfaResponsePromise;
    if (!mfaResponse.ok()) {
      throw new Error(`ADMIN_BROWSER_MFA_${mfaResponse.status()}: ${await mfaResponse.text()}`);
    }
    await page.getByRole("heading", { name: "Release 4 카탈로그 운영" }).waitFor();
    return { context, page };
  }

  async function searchItem(page: Page, item: CatalogFixture) {
    await page.getByLabel("카탈로그 품목 검색").fill(item.code);
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const row = page.locator("#catalog-items").getByRole("row").filter({ hasText: item.code });
    await row.waitFor();
    return row;
  }

  it("runs author, editorial, domain, safety, and one-winner publish interactions in the real browser", async () => {
    const author = await createAdmin("author", "editor");
    const editorialReviewer = await createAdmin("editorial-reviewer");
    const domainReviewer = await createAdmin("domain-reviewer");
    const safetyReviewer = await createAdmin("safety-reviewer");
    const publisherA = await createAdmin("publisher-a");
    const publisherB = await createAdmin("publisher-b");
    await harness.prisma.catalogReviewerCredential.createMany({
      data: [
        { adminId: editorialReviewer.id, approvalType: "editorial", active: true },
        { adminId: domainReviewer.id, approvalType: "domain", active: true },
        { adminId: safetyReviewer.id, approvalType: "safety", active: true }
      ]
    });

    const normalItem = await createItem(author.id, "normal", "NORMAL");
    const highRiskItem = await createItem(author.id, "high", "HIGH");

    const authorBrowser = await loginCatalog(author);
    for (const item of [normalItem, highRiskItem]) {
      const row = await searchItem(authorBrowser.page, item);
      await row.getByRole("button", { name: "검수 요청" }).click();
      await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("review_requested");
    }
    const csrfStatus = await authorBrowser.page.evaluate(async ({ itemId, version, contentHash }) => {
      const csrf = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("admin_csrf="))?.split("=")[1] ?? "";
      const response = await fetch(`/api/v1/admin/catalog/items/${itemId}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        body: JSON.stringify({
          reviewType: "editorial",
          expectedVersion: version,
          contentHash,
          professionalReviewConfirmed: false
        })
      });
      return response.status;
    }, { itemId: normalItem.id, version: normalItem.contentVersion, contentHash: normalItem.contentHash });
    expect(csrfStatus).toBe(403);
    await authorBrowser.context.close();

    const editorialBrowser = await loginCatalog(editorialReviewer);
    for (const item of [normalItem, highRiskItem]) {
      const row = await searchItem(editorialBrowser.page, item);
      await row.getByRole("button", { name: "편집 검수" }).click();
      await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("domain_review");
    }
    await editorialBrowser.context.close();

    const domainBrowser = await loginCatalog(domainReviewer);
    let row = await searchItem(domainBrowser.page, normalItem);
    await row.getByRole("button", { name: "도메인 검수" }).click();
    await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: normalItem.id } })).status).toBe("approved");
    row = await searchItem(domainBrowser.page, highRiskItem);
    await row.getByRole("button", { name: "도메인 검수" }).click();
    await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: highRiskItem.id } })).status).toBe("safety_review");
    await domainBrowser.context.close();

    const safetyBrowser = await loginCatalog(safetyReviewer);
    row = await searchItem(safetyBrowser.page, highRiskItem);
    await row.getByLabel(`${highRiskItem.nameKo} 안전 근거 URL`).fill("https://example.com/release4g-professional-review");
    await row.getByLabel(`${highRiskItem.nameKo} 안전 근거 제목`).fill("Release 4G 외부 전문가 검수 fixture");
    await row.getByRole("button", { name: "안전 검수" }).click();
    await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: highRiskItem.id } })).status).toBe("approved");
    await safetyBrowser.context.close();

    const publishBrowserA = await loginCatalog(publisherA);
    const publishBrowserB = await loginCatalog(publisherB);
    const rowA = await searchItem(publishBrowserA.page, normalItem);
    const rowB = await searchItem(publishBrowserB.page, normalItem);
    const publishResponseA = publishBrowserA.page.waitForResponse((response) => response.url().includes(`/catalog/items/${normalItem.id}/publish`));
    const publishResponseB = publishBrowserB.page.waitForResponse((response) => response.url().includes(`/catalog/items/${normalItem.id}/publish`));
    await Promise.all([
      rowA.getByRole("button", { name: "게시" }).click(),
      rowB.getByRole("button", { name: "게시" }).click()
    ]);
    const publishStatuses = (await Promise.all([publishResponseA, publishResponseB])).map((response) => response.status()).sort();
    expect(publishStatuses).toEqual([200, 409]);
    await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: normalItem.id } })).status).toBe("published");
    await expect.poll(async () => {
      const messages = await Promise.all([
        publishBrowserA.page.getByText("다른 운영자가 먼저 변경했어요.", { exact: false }).count(),
        publishBrowserB.page.getByText("다른 운영자가 먼저 변경했어요.", { exact: false }).count()
      ]);
      return messages.reduce((sum, count) => sum + count, 0);
    }, { timeout: 10_000 }).toBe(1);

    row = await searchItem(publishBrowserA.page, highRiskItem);
    await row.getByRole("button", { name: "게시" }).click();
    await expect.poll(async () => (await harness.prisma.itemDefinition.findUniqueOrThrow({ where: { id: highRiskItem.id } })).status).toBe("published");
    await publishBrowserA.context.close();
    await publishBrowserB.context.close();
  });

  it("previews CSV/XLSX safely, reports partial failure, confirms apply, and never executes formulas", async () => {
    const importer = admins.find((admin) => admin.email.includes("publisher-a")) ?? await createAdmin("importer");
    const item = await createItem(importer.id, "normal", "IMPORT");
    const { context, page } = await loginCatalog(importer);
    const fileInput = page.locator('input[type="file"]');

    const csv = [
      "code,shortDescription",
      `${item.code},CSV 브라우저 preview 정상 행`,
      `R4-G-NOT-FOUND-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()},존재하지 않는 품목`
    ].join("\n");
    await fileInput.setInputFiles({
      name: `${importSourcePrefix}-partial.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8")
    });
    await page.getByText("전체 2 · 유효 1 · 오류 1", { exact: true }).waitFor();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("1개를 draft로 적용");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "선택한 유효 행 적용 (1)" }).click();
    await page.getByText("1개 행을 draft로 적용했어요.", { exact: false }).waitFor();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("catalog");
    sheet.addRow(["code", "sourceSummary"]);
    sheet.addRow([item.code, "XLSX 브라우저 preview 정상 행"]);
    const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    await fileInput.setInputFiles({
      name: `${importSourcePrefix}-valid.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsx
    });
    await page.getByText("전체 1 · 유효 1 · 오류 0", { exact: true }).waitFor();

    sheet.getCell("B2").value = { formula: 'HYPERLINK("https://example.com")', result: "실행 금지" };
    const formulaXlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    await fileInput.setInputFiles({
      name: `${importSourcePrefix}-formula.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: formulaXlsx
    });
    await page.getByRole("alert").filter({ hasText: "formula" }).waitFor();
    await context.close();
  });

  it("applies taxonomy reorder from keyboard and preserves input on a stale-version conflict", async () => {
    const operator = admins.find((admin) => admin.email.includes("publisher-a")) ?? await createAdmin("taxonomy");
    const suffix = randomUUID().replaceAll("-", "").slice(0, 6);
    await harness.prisma.catalogNode.deleteMany({ where: { code: { in: ["C98", "C99"] }, nameKo: { startsWith: "Release 4G" } } });
    const first = await harness.prisma.catalogNode.create({
      data: { code: "C98", level: "domain", nameKo: `Release 4G 첫 분류 ${suffix}`, displayOrder: 998 }
    });
    const second = await harness.prisma.catalogNode.create({
      data: { code: "C99", level: "domain", nameKo: `Release 4G 둘째 분류 ${suffix}`, displayOrder: 999 }
    });
    taxonomyNodeIds.push(first.id, second.id);

    const { context, page } = await loginCatalog(operator);
    const moveDown = page.getByRole("button", { name: `${first.nameKo} 아래로` });
    await moveDown.focus();
    await page.keyboard.press("Enter");
    await page.getByText("순서 변경 미리보기", { exact: true }).waitFor();
    await page.getByRole("button", { name: "순서 반영" }).click();
    await page.getByText("분류의 순서를 반영했어요.", { exact: false }).waitFor();
    const reordered = await harness.prisma.catalogNode.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { displayOrder: "asc" }
    });
    expect(reordered.map((node) => node.id)).toEqual([second.id, first.id]);

    const row = page.getByRole("row").filter({ hasText: first.nameKo });
    await row.getByRole("button", { name: "편집" }).click();
    const nameInput = page.getByLabel("분류 이름 편집");
    const unsavedName = `${first.nameKo} 사용자 입력 유지`;
    await nameInput.fill(unsavedName);
    await harness.prisma.catalogNode.update({
      where: { id: first.id },
      data: { description: "다른 운영자의 선행 변경", version: { increment: 1 } }
    });
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText("다른 운영자가 이 분류를 먼저 변경했어요.", { exact: false }).waitFor();
    expect(await nameInput.inputValue()).toBe(unsavedName);

    for (const queueLabel of ["검수 대기", "검수 기한 경과", "가격 확인 필요", "사용자 신고"] as const) {
      await page.getByRole("button", { name: new RegExp(queueLabel) }).click();
      await page.getByRole("heading", { name: `${queueLabel} 상세` }).waitFor();
    }
    await context.close();
  });

  it("filters and paginates a populated report queue, preserves state, and refetches only that queue after one mutation", async () => {
    const operator = admins.find((admin) => admin.email.includes("publisher-a")) ?? await createAdmin("queue-operator");
    const item = await createItem(operator.id, "normal", "QUEUE");
    const reports = await Promise.all(Array.from({ length: 21 }, (_, index) => harness.prisma.catalogItemReport.create({
      data: { itemDefinitionId: item.id, reasonCode: "wrong_category", detail: `Release 4H queue fixture ${index + 1}` }
    })));
    reportIds.push(...reports.map((report) => report.id));

    const { context, page } = await loginCatalog(operator);
    const requests: Array<{ method: string; url: string }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/admin/catalog/")) requests.push({ method: request.method(), url: request.url() });
    });
    await page.reload();
    await page.getByRole("heading", { name: "Release 4 카탈로그 운영" }).waitFor();
    expect(requests.filter((entry) => entry.method === "GET" && entry.url.includes("/catalog/queues")).length).toBe(1);

    await page.getByRole("button", { name: /사용자 신고/ }).click();
    await page.getByRole("heading", { name: "사용자 신고 상세" }).waitFor();
    const filter = page.getByLabel("사용자 신고 필터");
    await filter.fill(item.nameKo);
    await page.getByRole("status").filter({ hasText: "21건 · 1/2 페이지" }).waitFor();
    await page.getByRole("button", { name: "다음 페이지" }).click();
    await page.getByRole("status").filter({ hasText: "21건 · 2/2 페이지" }).waitFor();
    await page.getByRole("button", { name: /검수 대기/ }).click();
    await page.getByRole("button", { name: /사용자 신고/ }).click();
    expect(await filter.inputValue()).toBe(item.nameKo);
    await page.getByRole("status").filter({ hasText: "21건 · 2/2 페이지" }).waitFor();
    await page.getByRole("button", { name: "이전 페이지" }).click();

    await page.getByLabel(`${item.nameKo} 신고 선택`).first().check();
    requests.splice(0, requests.length);
    page.once("dialog", async (dialog) => dialog.accept());
    const mutation = page.waitForResponse((response) => response.url().includes("/reports/resolve-batch"));
    await page.getByRole("button", { name: "선택 신고 해결 (1)" }).click();
    expect((await mutation).status()).toBe(200);
    await page.getByText("사용자 신고 1건을 해결했어요.", { exact: true }).waitFor();
    expect(await filter.inputValue()).toBe(item.nameKo);
    expect(requests.filter((entry) => entry.method === "POST" && entry.url.includes("/reports/resolve-batch"))).toHaveLength(1);
    expect(requests.filter((entry) => entry.method === "GET" && entry.url.includes("/catalog/queues"))).toHaveLength(1);
    expect(requests.filter((entry) => entry.method === "GET" && /\/catalog\/items(?:\?|$)/.test(entry.url))).toHaveLength(0);
    await expect.poll(async () => harness.prisma.catalogItemReport.count({ where: { id: { in: reportIds }, state: "resolved" } })).toBe(1);
    await context.close();

    const analyst = await createAdmin("queue-analyst", "analyst");
    const analystBrowser = await loginCatalog(analyst);
    const directStatus = await analystBrowser.page.evaluate(async (reportId) => {
      const csrf = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("admin_csrf="))?.split("=")[1] ?? "";
      return (await fetch("/api/v1/admin/catalog/reports/resolve-batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        body: JSON.stringify({ reportIds: [reportId], note: "must be rejected" })
      })).status;
    }, reports[1]!.id);
    expect(directStatus).toBe(403);
    await analystBrowser.context.close();
  });
});
