import type { INestApplication } from "@nestjs/common";
import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { CatalogImportStorageService } from "../src/catalog-v2/catalog-import-storage.service";
import { CatalogImportWorkflowService } from "../src/catalog-v2/catalog-import-workflow.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Release 4I catalog import object consistency", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: CatalogImportStorageService;
  let workflow: CatalogImportWorkflowService;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const sourceNames: string[] = [];
  const objectKeys = new Set<string>();
  let adminId = "";
  let itemId = "";
  let itemCode = "";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.OBJECT_STORAGE_ADAPTER = "memory";
    process.env.CATALOG_IMPORT_RECONCILIATION_STALE_MS = "0";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(CatalogImportStorageService);
    workflow = app.get(CatalogImportWorkflowService);

    const admin = await prisma.adminUser.create({
      data: {
        email: `release4i-import-${suffix.toLowerCase()}@wooriai.local`,
        passwordHash: "release4i-test-only",
        displayName: "Release 4I import operator",
        role: "admin",
        active: true
      }
    });
    adminId = admin.id;
    itemCode = `R4-IMPORT-${suffix}`;
    const item = await prisma.itemDefinition.create({
      data: {
        code: itemCode,
        nameKo: `Release 4I import ${suffix}`,
        shortDescription: "Original import consistency description",
        targetSubject: "child",
        necessity: "required",
        recommendationState: "recommended",
        reasonText: "Test-only import consistency fixture.",
        timingSummary: "Use only in isolated database tests.",
        secondhandPolicy: "allowed",
        rentalPolicy: "suitable",
        safetyTier: "normal",
        sourceSummary: "Release 4I isolated database fixture",
        status: "draft",
        lastEditedByAdminId: adminId
      }
    });
    itemId = item.id;
  });

  afterAll(async () => {
    for (const key of objectKeys) await storage.delete(key).catch(() => undefined);
    const imports = sourceNames.length
      ? await prisma.catalogImport.findMany({ where: { sourceName: { in: sourceNames } }, select: { id: true } })
      : [];
    if (imports.length > 0) await prisma.catalogImport.deleteMany({ where: { id: { in: imports.map((entry) => entry.id) } } });
    if (itemId) {
      await prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: itemId } });
      await prisma.catalogItemRevision.deleteMany({ where: { itemDefinitionId: itemId } });
      await prisma.itemDefinition.deleteMany({ where: { id: itemId } });
    }
    if (adminId) await prisma.adminUser.deleteMany({ where: { id: adminId } });
    await app.close();
  });

  function csvFile(label: string, description: string) {
    const name = `release4i-${label}-${suffix}.csv`;
    sourceNames.push(name);
    return {
      originalname: name,
      buffer: Buffer.from(`code,shortDescription\n${itemCode},${description}\n`, "utf8")
    };
  }

  it("does not create a revision when the stored import object is missing", async () => {
    const file = csvFile("missing-object", "Missing object must fail closed");
    const preview = await workflow.previewFile(adminId, file);
    expect(preview.import.state).toBe("ready");
    expect((preview.preview as { summary: { total: number; valid: number; invalid: number } }).summary)
      .toEqual({ total: 1, valid: 1, invalid: 0 });
    const objectKey = preview.import.objectKey!;
    objectKeys.add(objectKey);
    await storage.delete(objectKey);

    const revisionsBefore = await prisma.catalogItemRevision.count({ where: { itemDefinitionId: itemId } });
    await expect(workflow.apply(adminId, preview.import.id, {
      expectedVersion: preview.import.version,
      rowNumbers: [1]
    })).rejects.toBeInstanceOf(ConflictException);

    const failed = await prisma.catalogImport.findUniqueOrThrow({ where: { id: preview.import.id } });
    expect(failed).toMatchObject({ state: "missing_object", lastErrorCode: "CATALOG_IMPORT_OBJECT_NOT_FOUND" });
    expect(await prisma.catalogItemRevision.count({ where: { itemDefinitionId: itemId } })).toBe(revisionsBefore);

    const repaired = await workflow.repairImport(failed.id, failed.version);
    expect(repaired).toMatchObject({ state: "missing_object", lastErrorCode: "CATALOG_IMPORT_OBJECT_NOT_FOUND" });
  });

  it("replays preview/apply idempotently without duplicate objects or revisions", async () => {
    const file = csvFile("idempotent-apply", "Applied exactly once after response loss");
    const firstPreview = await workflow.previewFile(adminId, file);
    objectKeys.add(firstPreview.import.objectKey!);
    const repeatedPreview = await workflow.previewFile(adminId, file);
    expect(repeatedPreview).toMatchObject({ idempotent: true });
    expect(repeatedPreview.import.id).toBe(firstPreview.import.id);

    const matchingObjects = (await storage.list()).filter((entry) => entry.key === firstPreview.import.objectKey);
    expect(matchingObjects).toHaveLength(1);
    const revisionsBefore = await prisma.catalogItemRevision.count({ where: { itemDefinitionId: itemId } });
    const applied = await workflow.apply(adminId, firstPreview.import.id, {
      expectedVersion: firstPreview.import.version,
      rowNumbers: [1]
    });
    expect(applied).toMatchObject({ appliedCount: 1, idempotent: false });
    const replay = await workflow.apply(adminId, firstPreview.import.id, {
      expectedVersion: firstPreview.import.version,
      rowNumbers: [1]
    });
    expect(replay).toMatchObject({ appliedCount: 1, idempotent: true });
    expect(await prisma.catalogItemRevision.count({ where: { itemDefinitionId: itemId } })).toBe(revisionsBefore + 1);
    expect((await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } })).shortDescription).toBe("Applied exactly once after response loss");
  });

  it("detects and cleans only confirmed orphan objects idempotently", async () => {
    const bytes = Buffer.from(`orphan-${suffix}`, "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const objectKey = `catalog-imports/sha256/${sha256}.csv`;
    objectKeys.add(objectKey);
    await storage.put(objectKey, bytes, "text/csv", { sha256, importid: `orphan-${suffix}` });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const dryRun = await workflow.reconcile(true);
    expect(dryRun.orphanObjects.map((entry) => entry.objectKey)).toContain(objectKey);
    await expect(workflow.cleanupOrphan(objectKey)).resolves.toEqual({ success: true, objectKey });
    expect((await workflow.reconcile(true)).orphanObjects.map((entry) => entry.objectKey)).not.toContain(objectKey);
    await expect(workflow.cleanupOrphan(objectKey)).rejects.toBeInstanceOf(ConflictException);
  });
});
