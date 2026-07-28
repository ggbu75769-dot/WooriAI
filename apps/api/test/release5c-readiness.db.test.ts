import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { Release5ReadinessService } from "../src/release5/release5-readiness.service";

describe("Release 5C legal and catalog readiness", () => {
  let prisma: PrismaService;
  let readiness: Release5ReadinessService;
  let moduleRef: TestingModule;
  const legalIds: string[] = [];
  const evidenceIds: string[] = [];
  const manifestIds: string[] = [];
  const adminIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    readiness = moduleRef.get(Release5ReadinessService);
  });

  afterEach(async () => {
    if (manifestIds.length) await prisma.catalogPilotManifest.deleteMany({ where: { id: { in: manifestIds.splice(0) } } });
    if (evidenceIds.length) await prisma.itemEvidenceSource.deleteMany({ where: { id: { in: evidenceIds.splice(0) } } });
    if (legalIds.length) await prisma.legalDocument.deleteMany({ where: { id: { in: legalIds.splice(0) } } });
    if (adminIds.length) await prisma.adminUser.deleteMany({ where: { id: { in: adminIds.splice(0) } } });
    await moduleRef.close();
  });

  it("keeps legal consent unavailable until independent approval and publication", async () => {
    expect(() => readiness.legalPreview({
      documentType: "terms",
      locale: "ko-KR-release5-test",
      version: randomUUID(),
      title: "blocked",
      bodyMarkdown: "",
      publicUrl: "https://example.com/terms",
      required: true,
      effectiveAt: "2026-07-17T00:00:00.000Z"
    })).toThrowError();

    const operators = await Promise.all(["importer", "approver", "publisher"].map((role) => prisma.adminUser.create({
      data: {
        email: `release5-${role}-${randomUUID()}@wooriai.test`,
        passwordHash: "test-only",
        displayName: `Release 5 ${role}`,
        role: "admin"
      }
    })));
    adminIds.push(...operators.map((operator) => operator.id));
    const importer = operators[0]!.id;
    const approver = operators[1]!.id;
    const publisher = operators[2]!.id;
    const document = await readiness.importLegal(importer, {
      documentType: "terms",
      locale: "ko-KR-release5-test",
      version: `r5-${randomUUID().slice(0, 20)}`,
      title: "Release 5 legal candidate",
      bodyMarkdown: "# Candidate\nExternal approval fixture.",
      required: true,
      effectiveAt: "2026-07-17T00:00:00.000Z"
    });
    legalIds.push(document.id);
    expect(document).toMatchObject({ placeholder: false, approvedAt: null, publishedAt: null, revision: 1 });
    await expect(readiness.approveLegal(importer, document.id, { expectedRevision: 1, approvalNote: "self approval" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "LEGAL_APPROVER_SEPARATION_REQUIRED" }) });
    const approved = await readiness.approveLegal(approver, document.id, { expectedRevision: 1, approvalNote: "Independent fixture review" });
    expect(approved).toMatchObject({ approvedByAdminId: approver, revision: 2, publishedAt: null });
    await expect(readiness.publishLegal(approver, document.id, { expectedRevision: 2 }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "LEGAL_PUBLISHER_SEPARATION_REQUIRED" }) });
    const published = await readiness.publishLegal(publisher, document.id, { expectedRevision: 2 });
    expect(published).toMatchObject({ revision: 3 });
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it("requires current independently reviewed evidence before a low-risk pilot manifest", async () => {
    const publishedBefore = await prisma.itemDefinition.count({ where: { status: "published" } });
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { status: "in_review", safetyTier: { not: "high" } } });
    const capturer = randomUUID();
    const reviewer = randomUUID();
    await expect(readiness.createEvidence(capturer, item.id, {
      sourceType: "official",
      title: "blocked private source",
      publicUrl: "https://127.0.0.1/source",
      revision: item.contentVersion,
      applicableClaims: ["timing"]
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: "PUBLIC_URL_BLOCKED" }) });

    const evidence = await readiness.createEvidence(capturer, item.id, {
      sourceType: "official",
      title: "Release 5 evidence fixture",
      publicUrl: "https://www.wooriai.kr/release5-evidence",
      publisher: "WooriAI fixture",
      revision: item.contentVersion,
      applicableClaims: ["timing", "quantity"]
    });
    evidenceIds.push(evidence.id);
    await expect(readiness.reviewEvidence(capturer, evidence.id, { expectedContentHash: evidence.contentHash!, approved: true }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "EVIDENCE_REVIEWER_SEPARATION_REQUIRED" }) });
    const reviewed = await readiness.reviewEvidence(reviewer, evidence.id, { expectedContentHash: evidence.contentHash!, approved: true });
    expect(reviewed.status).toBe("valid");

    const worklist = await readiness.pilotWorklist();
    expect(worklist.items.find((candidate) => candidate.id === item.id)).toMatchObject({
      status: "in_review",
      structureReady: true,
      evidenceReady: true,
      editorialApproved: false,
      domainApproved: false,
      ready: false
    });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewedByAdminId: capturer }
    });
    expect((await readiness.pilotWorklist()).items.find((candidate) => candidate.id === item.id))
      .toMatchObject({ evidenceReady: false, ready: false });
    await expect(readiness.previewPilotManifest(randomUUID(), { itemIds: [item.id] }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PILOT_MANIFEST_NOT_READY" }) });
    await expect(readiness.previewPilotManifest(randomUUID(), { itemIds: [] }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PILOT_MANIFEST_EMPTY" }) });
    expect(await prisma.itemDefinition.count({ where: { status: "published" } })).toBe(publishedBefore);
  });
});
