import type { INestApplication } from "@nestjs/common";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CatalogNodeLevel, NecessityLevel, ProductPlatform } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { CatalogV2Service } from "../src/catalog-v2/catalog-v2.service";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import { JobHandlersService } from "../src/jobs/job-handlers.service";

vi.mock("../src/jobs/safe-link-check", () => ({
  checkPublicLink: vi.fn().mockResolvedValue({ statusCode: 200, finalUrl: "https://example.com/catalog-health", redirected: false }),
  SafeLinkCheckError: class SafeLinkCheckError extends Error { code = "MOCK_SAFE_LINK_ERROR"; }
}));

describe("Release 4 catalog admin workflow", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalog: CatalogV2Service;
  const suffix = randomUUID();
  let authorId = "";
  let reviewerId = "";
  let reviewerEmail = "";
  let domainReviewerId = "";
  let safetyReviewerId = "";
  let publisherId = "";
  let secondPublisherId = "";
  let itemId = "";
  let itemCode = "";
  let offerId = "";
  let importId = "";
  let staleImportId = "";
  let approvalManifestImportId = "";
  let legacyProductLinkId = "";
  let legacyItemTemplateId = "";
  const taxonomyNodeIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    catalog = app.get(CatalogV2Service);
    const [author, reviewer, domainReviewer, safetyReviewer, publisher, secondPublisher, category] = await Promise.all([
      prisma.adminUser.create({ data: { email: `r4-author-${suffix}@example.com`, passwordHash: "test", displayName: "author", role: "editor" } }),
      prisma.adminUser.create({ data: { email: `r4-reviewer-${suffix}@example.com`, passwordHash: "test", displayName: "reviewer", role: "admin" } }),
      prisma.adminUser.create({ data: { email: `r4-domain-reviewer-${suffix}@example.com`, passwordHash: "test", displayName: "domain reviewer", role: "admin" } }),
      prisma.adminUser.create({ data: { email: `r4-safety-reviewer-${suffix}@example.com`, passwordHash: "test", displayName: "safety reviewer", role: "admin" } }),
      prisma.adminUser.create({ data: { email: `r4-publisher-${suffix}@example.com`, passwordHash: "test", displayName: "publisher", role: "admin" } }),
      prisma.adminUser.create({ data: { email: `r4-publisher-2-${suffix}@example.com`, passwordHash: "test", displayName: "second publisher", role: "admin" } }),
      prisma.catalogNode.findFirstOrThrow({ where: { level: "subcategory", active: true } })
    ]);
    authorId = author.id;
    reviewerId = reviewer.id;
    reviewerEmail = reviewer.email;
    domainReviewerId = domainReviewer.id;
    safetyReviewerId = safetyReviewer.id;
    publisherId = publisher.id;
    secondPublisherId = secondPublisher.id;
    await prisma.catalogReviewerCredential.createMany({ data: [
      { adminId: reviewerId, approvalType: "editorial", active: true },
      { adminId: domainReviewerId, approvalType: "domain", active: true },
      { adminId: safetyReviewerId, approvalType: "safety", active: true }
    ] });
    itemCode = `R4-TEST-${suffix}`;
    const item = await prisma.itemDefinition.create({ data: {
      code: itemCode,
      nameKo: `관리 품목 ${suffix}`,
      shortDescription: "관리자 workflow 검증 품목",
      targetSubject: "child",
      necessity: "recommended",
      recommendationState: "recommended",
      reasonText: "일반 품목 운영 workflow를 검증합니다.",
      skipReasonText: "가족 상황에 맞지 않으면 준비하지 않아도 됩니다.",
      timingSummary: "필요 시기를 가족이 정합니다.",
      secondhandPolicy: "inspect",
      rentalPolicy: "conditional",
      safetyTier: "normal",
      sourceSummary: "테스트 전용 중립 메타데이터",
      status: "in_review"
    } });
    itemId = item.id;
    await Promise.all([
      prisma.itemDefinitionCategory.create({ data: { itemDefinitionId: itemId, catalogNodeId: category.id, isPrimary: true } }),
      prisma.itemLifecycleRule.create({ data: { itemDefinitionId: itemId, axis: "child", lifecycleCode: "newborn_0_3m" } }),
      prisma.itemContextRule.create({ data: { itemDefinitionId: itemId, contextCode: "all" } })
    ]);
  });

  afterAll(async () => {
    if (importId) await prisma.catalogImport.deleteMany({ where: { id: importId } });
    if (staleImportId) await prisma.catalogImport.deleteMany({ where: { id: staleImportId } });
    if (approvalManifestImportId) await prisma.catalogImport.deleteMany({ where: { id: approvalManifestImportId } });
    if (offerId) await prisma.jobOutbox.deleteMany({ where: { aggregateType: "product_offer", aggregateId: offerId } });
    if (offerId) await prisma.productOffer.deleteMany({ where: { id: offerId } });
    if (legacyProductLinkId) {
      await prisma.productLinkHealth.deleteMany({ where: { productLinkId: legacyProductLinkId } });
      await prisma.productLink.deleteMany({ where: { id: legacyProductLinkId } });
    }
    if (legacyItemTemplateId) await prisma.itemTemplate.deleteMany({ where: { id: legacyItemTemplateId } });
    if (itemId) {
      await Promise.all([
        prisma.catalogItemApproval.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.catalogItemRevision.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemSynonym.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemContextRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemSafetyRule.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.itemEvidenceSource.deleteMany({ where: { itemDefinitionId: itemId } }),
        prisma.catalogItemReport.deleteMany({ where: { itemDefinitionId: itemId } })
      ]);
      await prisma.itemDefinition.deleteMany({ where: { id: itemId } });
    }
    if (taxonomyNodeIds.length > 0) {
      await prisma.itemDefinitionCategory.deleteMany({ where: { catalogNodeId: { in: taxonomyNodeIds } } });
      await prisma.catalogCoverageDecision.deleteMany({ where: { domainNodeId: { in: taxonomyNodeIds } } });
      for (const nodeId of [...taxonomyNodeIds].reverse()) {
        await prisma.catalogNode.deleteMany({ where: { id: nodeId } });
      }
    }
    await prisma.adminUser.deleteMany({ where: { id: { in: [authorId, reviewerId, domainReviewerId, safetyReviewerId, publisherId, secondPublisherId].filter(Boolean) } } });
    await app.close();
  });

  it("separates author, reviewer, and publisher while keeping offers inactive until approved", async () => {
    const draft = await catalog.updateItemDraft(authorId, itemId, { expectedVersion: 1, shortDescription: "author-edited workflow description" });
    expect(draft).toMatchObject({ status: "draft", contentVersion: 2, lastEditedByAdminId: authorId });
    expect(draft.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const revision = { expectedVersion: draft.contentVersion, contentHash: draft.contentHash! };
    await catalog.requestItemReview(authorId, itemId, revision);
    await expect(catalog.reviewItem(authorId, itemId, { ...revision, reviewType: "editorial", professionalReviewConfirmed: false })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(catalog.reviewItem(reviewerId, itemId, { ...revision, contentHash: "0".repeat(64), reviewType: "editorial", professionalReviewConfirmed: false })).rejects.toBeInstanceOf(ConflictException);
    const editorial = await catalog.reviewItem(reviewerId, itemId, { ...revision, reviewType: "editorial", professionalReviewConfirmed: false });
    expect(editorial).toMatchObject({ status: "domain_review", reviewedByAdminId: reviewerId, lastEditedByAdminId: authorId });
    const approved = await catalog.reviewItem(domainReviewerId, itemId, { ...revision, reviewType: "domain", professionalReviewConfirmed: false });
    expect(approved).toMatchObject({ status: "approved", reviewedByAdminId: domainReviewerId });
    await expect(catalog.publishItem(authorId, itemId, revision)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(catalog.publishItem(reviewerId, itemId, revision)).rejects.toBeInstanceOf(ForbiddenException);
    const concurrentPublish = await Promise.allSettled([
      catalog.publishItem(publisherId, itemId, revision),
      catalog.publishItem(secondPublisherId, itemId, revision)
    ]);
    expect(concurrentPublish.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrentPublish.filter((result) => result.status === "rejected")).toHaveLength(1);
    const published = (concurrentPublish.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof catalog.publishItem>>>).value;
    expect(published).toMatchObject({ status: "published", lastEditedByAdminId: authorId });

    const detail = await catalog.replaceAliases(authorId, itemId, { expectedVersion: published.contentVersion, aliases: ["workflow alias", "workflow alias"] });
    expect(detail.aliases).toHaveLength(1);
    expect(detail.item).toMatchObject({ status: "draft", reviewedAt: null, lastEditedByAdminId: authorId, contentVersion: published.contentVersion + 1 });
    expect(detail.item.contentHash).not.toBe(revision.contentHash);
    await expect(catalog.publishItem(publisherId, itemId, revision)).rejects.toBeInstanceOf(ConflictException);

    await expect(catalog.createOffer(itemId, {
      seller: "테스트 판매처",
      productName: "시점 없는 가격",
      publicUrl: "https://example.com/catalog-test-no-provenance",
      priceSnapshotKrw: 12_345
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: "PRODUCT_OFFER_PRICE_PROVENANCE_REQUIRED" }) });

    const offer = await catalog.createOffer(itemId, {
      seller: "테스트 판매처",
      productName: "테스트 상품",
      publicUrl: "https://example.com/catalog-test",
      affiliateUrl: "https://example.com/catalog-test-affiliate",
      isAffiliate: true,
      disclosureText: "이 링크에는 제휴 정보가 포함됩니다.",
      priceSnapshotKrw: 12_345,
      priceCheckedAt: "2026-07-15T03:00:00.000Z"
    });
    offerId = offer.id;
    expect(offer).toMatchObject({ active: false, healthState: "stale", priceSnapshotKrw: 12_345, priceCheckedAt: new Date("2026-07-15T03:00:00.000Z") });
    await expect(catalog.blockOffer(offer.id, "recalled")).resolves.toMatchObject({ active: false, recallState: "recalled" });
  });

  it("keeps catalog publication one-winner across 30 deterministic CAS races", async () => {
    const category = await prisma.catalogNode.findFirstOrThrow({
      where: { level: "subcategory", active: true }
    });
    const stressItemIds: string[] = [];
    try {
      for (let repeat = 0; repeat < 30; repeat += 1) {
        const contentHash = createHash("sha256")
          .update(`release4f-publish-${suffix}-${repeat}`)
          .digest("hex");
        const item = await prisma.itemDefinition.create({
          data: {
            code: `R4-STABILITY-${suffix}-${repeat}`,
            nameKo: `게시 경합 ${repeat + 1}`,
            shortDescription: "동시 게시 one-winner 검증",
            targetSubject: "child",
            necessity: "recommended",
            recommendationState: "recommended",
            reasonText: "현재 revision의 승인과 게시자 분리를 검증합니다.",
            timingSummary: "사용자가 선택한 준비 시기",
            secondhandPolicy: "inspect",
            rentalPolicy: "conditional",
            safetyTier: "normal",
            sourceSummary: "Release 4F deterministic database fixture",
            status: "approved",
            contentHash,
            lastEditedByAdminId: authorId,
            reviewedAt: new Date(),
            reviewedByAdminId: domainReviewerId
          }
        });
        stressItemIds.push(item.id);
        await Promise.all([
          prisma.itemDefinitionCategory.create({
            data: {
              itemDefinitionId: item.id,
              catalogNodeId: category.id,
              isPrimary: true
            }
          }),
          prisma.itemLifecycleRule.create({
            data: {
              itemDefinitionId: item.id,
              axis: "child",
              lifecycleCode: "newborn_0_3m"
            }
          }),
          prisma.catalogItemApproval.createMany({
            data: [
              {
                itemDefinitionId: item.id,
                revision: 1,
                contentHash,
                approvalType: "editorial",
                reviewedByAdminId: reviewerId
              },
              {
                itemDefinitionId: item.id,
                revision: 1,
                contentHash,
                approvalType: "domain",
                reviewedByAdminId: domainReviewerId
              }
            ]
          })
        ]);

        const attempts = await Promise.allSettled([
          catalog.publishItem(publisherId, item.id, {
            expectedVersion: 1,
            contentHash
          }),
          catalog.publishItem(secondPublisherId, item.id, {
            expectedVersion: 1,
            contentHash
          })
        ]);
        expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
        await expect(prisma.itemDefinition.findUniqueOrThrow({ where: { id: item.id } }))
          .resolves.toMatchObject({ status: "published" });
      }
    } finally {
      if (stressItemIds.length > 0) {
        await prisma.catalogItemWorkflowEvent.deleteMany({
          where: { itemDefinitionId: { in: stressItemIds } }
        });
        await prisma.catalogItemApproval.deleteMany({
          where: { itemDefinitionId: { in: stressItemIds } }
        });
        await prisma.itemDefinitionCategory.deleteMany({
          where: { itemDefinitionId: { in: stressItemIds } }
        });
        await prisma.itemLifecycleRule.deleteMany({
          where: { itemDefinitionId: { in: stressItemIds } }
        });
        await prisma.itemDefinition.deleteMany({
          where: { id: { in: stressItemIds } }
        });
      }
    }
  });

  it("publishes a due catalog schedule once across concurrent workers using the scheduling publisher provenance", async () => {
    const category = await prisma.catalogNode.findFirstOrThrow({ where: { level: "subcategory", active: true } });
    const contentHash = createHash("sha256").update(`scheduled-${suffix}`).digest("hex");
    const scheduledItem = await prisma.itemDefinition.create({ data: {
      code: `R4-SCHEDULED-${suffix}`,
      nameKo: "예약 게시 테스트 품목",
      shortDescription: "예약 게시의 CAS와 역할 분리를 검증합니다.",
      targetSubject: "child",
      necessity: "recommended",
      recommendationState: "recommended",
      reasonText: "예약 시점에도 현재 승인과 게시자 권한을 다시 확인합니다.",
      timingSummary: "사용자가 선택한 준비 시기",
      secondhandPolicy: "inspect",
      rentalPolicy: "conditional",
      safetyTier: "normal",
      sourceSummary: "자동 게시 동시성 테스트 fixture",
      status: "scheduled",
      contentHash,
      lastEditedByAdminId: authorId,
      reviewedAt: new Date(),
      reviewedByAdminId: domainReviewerId,
      scheduledAt: new Date(Date.now() - 1_000)
    } });
    try {
      await Promise.all([
        prisma.itemDefinitionCategory.create({ data: { itemDefinitionId: scheduledItem.id, catalogNodeId: category.id, isPrimary: true } }),
        prisma.itemLifecycleRule.create({ data: { itemDefinitionId: scheduledItem.id, axis: "child", lifecycleCode: "newborn_0_3m" } }),
        prisma.catalogItemApproval.create({ data: { itemDefinitionId: scheduledItem.id, revision: 1, contentHash, approvalType: "editorial", reviewedByAdminId: reviewerId } }),
        prisma.catalogItemApproval.create({ data: { itemDefinitionId: scheduledItem.id, revision: 1, contentHash, approvalType: "domain", reviewedByAdminId: domainReviewerId } }),
        prisma.catalogItemWorkflowEvent.create({ data: {
          itemDefinitionId: scheduledItem.id,
          actorAdminId: publisherId,
          revision: 1,
          contentHash,
          fromStatus: "approved",
          toStatus: "scheduled",
          metadataJson: { scheduledAt: new Date(Date.now() - 1_000).toISOString() }
        } })
      ]);

      const concurrent = await Promise.all([
        app.get(JobHandlersService).handle("content.publish_due", {}),
        app.get(JobHandlersService).handle("content.publish_due", {})
      ]);
      expect(concurrent.every((result) => result.code === "CONTENT_DUE_PROCESSED")).toBe(true);
      await expect(prisma.itemDefinition.findUniqueOrThrow({ where: { id: scheduledItem.id } })).resolves.toMatchObject({
        status: "published",
        publishedByAdminId: publisherId,
        scheduledAt: null
      });
      expect(await prisma.catalogItemWorkflowEvent.count({ where: { itemDefinitionId: scheduledItem.id, toStatus: "published" } })).toBe(1);
    } finally {
      await prisma.catalogItemApproval.deleteMany({ where: { itemDefinitionId: scheduledItem.id } });
      await prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: scheduledItem.id } });
      await prisma.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: scheduledItem.id } });
      await prisma.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: scheduledItem.id } });
      await prisma.itemDefinition.deleteMany({ where: { id: scheduledItem.id } });
    }
  });

  it("keeps offer comparison fail-closed until a separate admin approves healthy, recall-clear data", async () => {
    const comparisonItem = await prisma.itemDefinition.create({ data: {
      code: `R4-TEST-CAR-SEAT-${randomUUID()}`,
      nameKo: "테스트 카시트",
      shortDescription: "상품 비교 승인 구조 테스트",
      targetSubject: "child",
      necessity: "optional",
      recommendationState: "recommended",
      reasonText: "test fixture",
      timingSummary: "user selected",
      secondhandPolicy: "inspect",
      rentalPolicy: "conditional",
      safetyTier: "normal",
      sourceSummary: "test fixture",
      status: "published",
      contentHash: createHash("sha256").update(randomUUID()).digest("hex"),
      reviewedAt: new Date(),
      reviewedByAdminId: reviewerId,
      publishedAt: new Date(),
      publishedByAdminId: publisherId
    } });
    let comparisonOfferId = "";
    try {
      await expect(catalog.createOffer(comparisonItem.id, {
        seller: "테스트 판매처", productName: "허용되지 않은 비교 필드", publicUrl: "https://example.com/forbidden-comparison",
        comparisonAttributes: { performanceScore: 99 }
      }, reviewerId)).rejects.toMatchObject({ response: expect.objectContaining({ code: "PRODUCT_OFFER_COMPARISON_FIELD_FORBIDDEN" }) });

      const offer = await catalog.createOffer(comparisonItem.id, {
        seller: "테스트 판매처", brand: "테스트 브랜드", productName: "비교 승인 테스트 모델", modelName: "T-1",
        publicUrl: "https://example.com/comparison", priceSnapshotKrw: 120_000, priceCheckedAt: new Date().toISOString(),
        comparisonAttributes: { usageDirection: "후방", maxWeightKg: 18, maxHeightCm: 105, installationType: "ISOFIX" }
      }, reviewerId);
      comparisonOfferId = offer.id;
      expect(offer).toMatchObject({ active: false, createdByAdminId: reviewerId, approvedAt: null });
      await expect(catalog.approveOffer(publisherId, offer.id, { expectedUpdatedAt: offer.updatedAt.toISOString() })).rejects.toMatchObject({ response: expect.objectContaining({ code: "PRODUCT_OFFER_APPROVAL_BLOCKED" }) });

      const healthy = await prisma.productOffer.update({ where: { id: offer.id }, data: { healthState: "healthy", recallState: "clear" } });
      await expect(catalog.approveOffer(reviewerId, offer.id, { expectedUpdatedAt: healthy.updatedAt.toISOString() })).rejects.toBeInstanceOf(ForbiddenException);
      const approved = await catalog.approveOffer(publisherId, offer.id, { expectedUpdatedAt: healthy.updatedAt.toISOString() });
      expect(approved).toMatchObject({ active: true, approvedByAdminId: publisherId });

      const comparison = await catalog.itemComparison({ id: "comparison-user", displayName: "comparison", email: null, status: "active", households: [] }, comparisonItem.id);
      expect(comparison).toMatchObject({ schema: { schemaCode: "car_seat_v1" }, rankingPolicy: "catalog_display_order_only_no_affiliate_or_sponsor_signal" });
      expect(comparison.offers).toHaveLength(1);
      expect(comparison.offers[0]).toMatchObject({ id: offer.id, priceFreshness: "current", attributes: { usageDirection: "후방", maxWeightKg: 18, maxHeightCm: 105, installationType: "ISOFIX" } });
      expect(comparison.offers[0]).not.toHaveProperty("performanceScore");
    } finally {
      if (comparisonOfferId) await prisma.productOffer.deleteMany({ where: { id: comparisonOfferId } });
      await prisma.itemDefinition.deleteMany({ where: { id: comparisonItem.id } });
    }
  });

  it("requires an active independent safety reviewer for high-risk content", async () => {
    const current = await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    await prisma.itemSafetyRule.upsert({
      where: { itemDefinitionId_ruleCode: { itemDefinitionId: itemId, ruleCode: "release4c-high-risk" } },
      create: {
        itemDefinitionId: itemId,
        ruleCode: "release4c-high-risk",
        severity: "high",
        guidanceText: "External professional review is required before publication.",
        blocksRecommendation: true
      },
      update: { reviewedAt: null, expiresAt: null }
    });
    const draft = await catalog.updateItemDraft(authorId, itemId, {
      expectedVersion: current.contentVersion,
      safetyTier: "high",
      recommendationState: "professional_review_required",
      safetyNote: "Professional review required."
    });
    const revision = { expectedVersion: draft.contentVersion, contentHash: draft.contentHash! };
    await catalog.requestItemReview(authorId, itemId, revision);
    await catalog.reviewItem(reviewerId, itemId, { ...revision, reviewType: "editorial", professionalReviewConfirmed: false });
    await catalog.reviewItem(domainReviewerId, itemId, { ...revision, reviewType: "domain", professionalReviewConfirmed: false });

    await prisma.catalogReviewerCredential.update({
      where: { adminId_approvalType: { adminId: safetyReviewerId, approvalType: "safety" } },
      data: { active: false }
    });
    await expect(catalog.reviewItem(safetyReviewerId, itemId, {
      ...revision,
      reviewType: "safety",
      professionalReviewConfirmed: true,
      evidenceUrl: "https://example.com/professional-review",
      evidenceTitle: "Professional review fixture",
      reviewExpiresOn: "2030-12-31"
    })).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.catalogReviewerCredential.update({
      where: { adminId_approvalType: { adminId: safetyReviewerId, approvalType: "safety" } },
      data: { active: true }
    });
    const approved = await catalog.reviewItem(safetyReviewerId, itemId, {
      ...revision,
      reviewType: "safety",
      professionalReviewConfirmed: true,
      evidenceUrl: "https://example.com/professional-review",
      evidenceTitle: "Professional review fixture",
      reviewExpiresOn: "2030-12-31"
    });
    expect(approved.status).toBe("approved");
    await expect(catalog.publishItem(safetyReviewerId, itemId, revision)).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.itemDefinition.update({
      where: { id: itemId },
      data: { recommendationState: "recommended" }
    });
    await expect(catalog.publishItem(publisherId, itemId, revision)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CATALOG_PUBLISH_GATE_FAILED",
        details: expect.arrayContaining(["high-risk recommendation state"])
      })
    });
    await prisma.itemDefinition.update({
      where: { id: itemId },
      data: { recommendationState: "professional_review_required" }
    });
    await expect(catalog.publishItem(publisherId, itemId, revision)).resolves.toMatchObject({ status: "published", publishedByAdminId: publisherId });
  });

  it("previews row errors, exports formula-safe CSV, and atomically applies selected valid rows as drafts", async () => {
    const previewResult = await catalog.previewDraftImport(authorId, {
      sourceName: "catalog-editorial.json",
      sourceHash: createHash("sha256").update(suffix).digest("hex"),
      rows: [
        { code: itemCode, nameKo: `가져온 관리 품목 ${suffix}`, sourceSummary: "검수 전 가져오기 근거" },
        { code: "=HYPERLINK-test", nameKo: "잘못된 행" }
      ]
    });
    importId = previewResult.import.id;
    expect(previewResult.import.state).toBe("ready");
    expect(previewResult.preview.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    expect(previewResult.preview.rows[1]).toMatchObject({ valid: false });
    expect(previewResult.preview.rows[1]?.errors).toContain("CODE_NOT_RELEASE4");

    const errorsCsv = await catalog.importErrorsCsv(importId);
    expect(errorsCsv).toContain("rowNumber,code,errors");
    expect(errorsCsv).toContain("'=HYPERLINK-test");

    await expect(catalog.applyDraftImport(authorId, importId, { expectedVersion: previewResult.import.version, rowNumbers: [2] })).rejects.toBeInstanceOf(BadRequestException);
    const applied = await catalog.applyDraftImport(authorId, importId, { expectedVersion: previewResult.import.version, rowNumbers: [1] });
    expect(applied).toMatchObject({ appliedCount: 1, appliedRowNumbers: [1] });
    await expect(catalog.applyDraftImport(authorId, importId, { expectedVersion: previewResult.import.version, rowNumbers: [1] })).resolves.toMatchObject({ idempotent: true, appliedCount: 1 });

    const updated = await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    expect(updated).toMatchObject({
      nameKo: `가져온 관리 품목 ${suffix}`,
      sourceSummary: "검수 전 가져오기 근거",
      status: "draft",
      reviewedAt: null,
      reviewedByAdminId: null,
      lastEditedByAdminId: authorId
    });
  });

  it("rejects an import preview after the target revision changes", async () => {
    const preview = await catalog.previewDraftImport(authorId, {
      sourceName: "catalog-stale-preview.json",
      sourceHash: createHash("sha256").update(`stale-${suffix}`).digest("hex"),
      rows: [{ code: itemCode, timingSummary: "오래된 preview가 덮어쓰면 안 되는 값" }]
    });
    staleImportId = preview.import.id;
    expect(preview.preview.rows[0]).toMatchObject({ valid: true });

    const current = await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    await catalog.updateItemDraft(authorId, itemId, {
      expectedVersion: current.contentVersion,
      timingSummary: "preview 이후 저장된 최신 값"
    });

    await expect(catalog.applyDraftImport(authorId, staleImportId, { expectedVersion: preview.import.version, rowNumbers: [1] })).rejects.toBeInstanceOf(ConflictException);
    const unchanged = await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    expect(unchanged.timingSummary).toBe("preview 이후 저장된 최신 값");
  });

  it("imports reviewer-bound approvals with partial errors and never publishes directly", async () => {
    const current = await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } });
    const draft = await catalog.updateItemDraft(authorId, itemId, { expectedVersion: current.contentVersion, safetyTier: "normal" });
    const revision = { expectedVersion: draft.contentVersion, contentHash: draft.contentHash! };
    await catalog.requestItemReview(authorId, itemId, revision);
    const issuedAt = new Date();
    const preview = await catalog.previewApprovalManifest(reviewerId, {
      manifestId: randomUUID(),
      sourceHash: createHash("sha256").update(`approval-manifest-${suffix}`).digest("hex"),
      reviewerEmail,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 86_400_000).toISOString(),
      entries: [
        { itemCode, revision: revision.expectedVersion, contentHash: revision.contentHash, reviewType: "editorial", decision: "approved" },
        { itemCode: `R4-NOT-FOUND-${suffix}`, revision: 1, contentHash: "0".repeat(64), reviewType: "editorial", decision: "changes_requested", reason: "없는 품목 fixture" }
      ]
    });
    approvalManifestImportId = preview.import.id;
    expect(preview.preview.summary).toEqual({ total: 2, valid: 1, invalid: 1 });

    const applied = await catalog.applyApprovalManifest(reviewerId, approvalManifestImportId);
    expect(applied).toMatchObject({ applied: 1, failed: 1, idempotent: false });
    expect(applied.results).toContainEqual(expect.objectContaining({ itemCode, outcome: "approved", resultingStatus: "domain_review" }));
    expect((await prisma.itemDefinition.findUniqueOrThrow({ where: { id: itemId } })).status).toBe("domain_review");
    await expect(catalog.applyApprovalManifest(reviewerId, approvalManifestImportId)).resolves.toMatchObject({ applied: 1, failed: 1, idempotent: true });
  });

  it("previews and rolls back an old snapshot as a new draft revision with CAS", async () => {
    const history = await catalog.itemRevisions(itemId);
    expect(history.revisions.length).toBeGreaterThanOrEqual(2);
    const target = history.revisions.at(-1)!;
    expect(target.revision).toBeLessThan(history.current.contentVersion);
    const cas = { expectedVersion: history.current.contentVersion, contentHash: history.current.contentHash! };
    const preview = await catalog.previewItemRollback(itemId, target.revision, cas);
    expect(preview).toMatchObject({
      targetRevision: target.revision,
      resultRevision: history.current.contentVersion + 1,
      resultStatus: "draft",
      invalidatesApprovals: true,
      publishesDirectly: false
    });
    expect(preview.changes.length).toBeGreaterThan(0);
    await expect(catalog.rollbackItemAsNewRevision(authorId, itemId, target.revision, { ...cas, contentHash: "0".repeat(64) }))
      .rejects.toBeInstanceOf(ConflictException);

    const rolledBack = await catalog.rollbackItemAsNewRevision(authorId, itemId, target.revision, cas);
    expect(rolledBack).toMatchObject({ rollbackSourceRevision: target.revision, approvalsInvalidated: true, publishesDirectly: false });
    expect(rolledBack.item).toMatchObject({ status: "draft", contentVersion: history.current.contentVersion + 1, reviewedAt: null, publishedAt: null, lastEditedByAdminId: authorId });
    expect(rolledBack.item.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await prisma.catalogItemApproval.count({ where: { itemDefinitionId: itemId, revision: rolledBack.item.contentVersion } })).toBe(0);
    expect(await prisma.itemDefinitionCategory.count({ where: { itemDefinitionId: itemId, isPrimary: true } })).toBe(1);
    expect(await prisma.itemLifecycleRule.count({ where: { itemDefinitionId: itemId } })).toBeGreaterThan(0);
    await expect(catalog.rollbackItemAsNewRevision(authorId, itemId, target.revision, cas)).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates, versions, reorders, impact-checks, and archives taxonomy leaves", async () => {
    const usedCodes = new Set((await prisma.catalogNode.findMany({ select: { code: true } })).map((node) => node.code));
    const domainCode = Array.from({ length: 90 }, (_, index) => `C${String(99 - index).padStart(2, "0")}`)
      .find((code) => !usedCodes.has(code));
    expect(domainCode).toBeTruthy();

    const domain = await catalog.createCatalogNode({
      code: domainCode!,
      level: CatalogNodeLevel.domain,
      nameKo: `테스트 영역 ${suffix}`
    });
    taxonomyNodeIds.push(domain.id);
    const category = await catalog.createCatalogNode({
      code: `${domainCode}-01`,
      level: CatalogNodeLevel.category,
      parentId: domain.id,
      nameKo: "테스트 대분류"
    });
    taxonomyNodeIds.push(category.id);
    const leafOne = await catalog.createCatalogNode({
      code: `${domainCode}-01-01`,
      level: CatalogNodeLevel.subcategory,
      parentId: category.id,
      nameKo: "첫 번째 소분류"
    });
    taxonomyNodeIds.push(leafOne.id);
    const leafTwo = await catalog.createCatalogNode({
      code: `${domainCode}-01-02`,
      level: CatalogNodeLevel.subcategory,
      parentId: category.id,
      nameKo: "두 번째 소분류"
    });
    taxonomyNodeIds.push(leafTwo.id);

    const tree = await catalog.adminTaxonomyTree();
    expect(tree.nodes.find((node) => node.id === leafOne.id)).toMatchObject({ depth: 2, directItemCount: 0 });
    const parentImpact = await catalog.previewCatalogNodeArchive(domain.id);
    expect(parentImpact.canArchive).toBe(false);
    expect(parentImpact.blockers).toContainEqual({ code: "ACTIVE_CHILDREN", count: 1 });

    const updatedLeafOne = await catalog.updateCatalogNode(leafOne.id, {
      expectedVersion: leafOne.version,
      nameKo: "수정된 첫 번째 소분류"
    });
    expect(updatedLeafOne).toMatchObject({ nameKo: "수정된 첫 번째 소분류", version: leafOne.version + 1 });
    await expect(catalog.updateCatalogNode(leafOne.id, {
      expectedVersion: leafOne.version,
      nameKo: "충돌해야 하는 이름"
    })).rejects.toBeInstanceOf(ConflictException);

    await prisma.itemDefinitionCategory.create({ data: { itemDefinitionId: itemId, catalogNodeId: leafOne.id, isPrimary: false } });
    const blockedImpact = await catalog.previewCatalogNodeArchive(leafOne.id);
    expect(blockedImpact.canArchive).toBe(false);
    expect(blockedImpact.blockers).toContainEqual({ code: "ITEM_MAPPINGS", count: 1 });
    await expect(catalog.archiveCatalogNode(leafOne.id, { expectedVersion: updatedLeafOne.version })).rejects.toBeInstanceOf(BadRequestException);
    await prisma.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: itemId, catalogNodeId: leafOne.id } });

    const reorderInput = {
      parentId: category.id,
      nodes: [
        { id: leafTwo.id, expectedVersion: leafTwo.version },
        { id: leafOne.id, expectedVersion: updatedLeafOne.version }
      ]
    };
    await expect(catalog.previewCatalogNodeReorder({ parentId: category.id, nodes: reorderInput.nodes.slice(0, 1) }))
      .rejects.toBeInstanceOf(BadRequestException);
    const reorderPreview = await catalog.previewCatalogNodeReorder(reorderInput);
    expect(reorderPreview).toMatchObject({ siblingCount: 2, canApply: true, itemMappingsAffected: 0 });
    expect(reorderPreview.changes).toHaveLength(2);
    await expect(catalog.applyCatalogNodeReorder(reorderInput)).resolves.toMatchObject({ appliedCount: 2 });
    const reordered = await prisma.catalogNode.findMany({ where: { parentId: category.id, active: true }, orderBy: { displayOrder: "asc" } });
    expect(reordered.map((node) => node.id)).toEqual([leafTwo.id, leafOne.id]);

    const freshLeafOne = await prisma.catalogNode.findUniqueOrThrow({ where: { id: leafOne.id } });
    const safeImpact = await catalog.previewCatalogNodeArchive(leafOne.id);
    expect(safeImpact).toMatchObject({ canArchive: true, activeChildCount: 0, directItemCount: 0, coverageDecisionCount: 0 });
    await expect(catalog.archiveCatalogNode(leafOne.id, { expectedVersion: freshLeafOne.version })).resolves.toMatchObject({ active: false });
  });

  it("returns actionable queue details, resolves an exact report set, and safely retries eligible link health", async () => {
    const reports = await Promise.all([
      prisma.catalogItemReport.create({ data: { itemDefinitionId: itemId, reasonCode: "inaccurate_description", detail: "설명 확인 필요" } }),
      prisma.catalogItemReport.create({ data: { itemDefinitionId: itemId, reasonCode: "broken_link", detail: "링크 확인 필요" } })
    ]);
    await prisma.itemDefinition.update({ where: { id: itemId }, data: { shortDescription: "" } });

    const template = await prisma.itemTemplate.create({ data: {
      code: `queue-health-${suffix}`,
      name: "큐 링크 검사 품목",
      necessityLevel: NecessityLevel.optional,
      reasonText: "운영 큐 링크 검사를 위한 테스트 품목입니다.",
      shortReason: "운영 큐 링크 검사"
    } });
    legacyItemTemplateId = template.id;
    const legacyLink = await prisma.productLink.create({ data: {
      itemTemplateId: template.id,
      platform: ProductPlatform.custom,
      title: "운영 큐 health 링크",
      url: "https://example.com/catalog-health",
      active: true
    } });
    legacyProductLinkId = legacyLink.id;
    await prisma.productOffer.update({
      where: { id: offerId },
      data: { legacyProductLinkId: legacyLink.id, healthState: "failed", recallState: "unknown" }
    });

    const queues = await catalog.adminQueues();
    expect(queues.summary.missingMetadata).toBeGreaterThanOrEqual(1);
    expect(queues.missingMetadata.find((row) => row.itemId === itemId)?.missingFields).toContain("shortDescription");
    expect(queues.openReports.filter((row) => row.itemId === itemId)).toHaveLength(2);
    expect(queues.brokenOffers.find((row) => row.offerId === offerId)).toMatchObject({ itemCode, retryEligible: true, retryBlockedReason: null });

    await expect(catalog.resolveItemReports(reviewerId, { reportIds: [reports[0]!.id, reports[0]!.id] }))
      .rejects.toBeInstanceOf(BadRequestException);
    const resolved = await catalog.resolveItemReports(reviewerId, { reportIds: reports.map((report) => report.id) });
    expect(resolved).toMatchObject({ resolvedCount: 2, reportIds: reports.map((report) => report.id) });
    await expect(catalog.resolveItemReports(reviewerId, { reportIds: [reports[0]!.id] }))
      .rejects.toBeInstanceOf(ConflictException);

    const queued = await catalog.retryOfferHealthCheck(offerId);
    expect(queued).toMatchObject({ queued: true, alreadyQueued: false, state: "queued" });
    await expect(catalog.retryOfferHealthCheck(offerId)).resolves.toMatchObject({ queued: true, alreadyQueued: true, outboxId: queued.outboxId, state: "queued" });
    const queuedSnapshot = await catalog.adminQueues();
    expect(queuedSnapshot.brokenOffers.find((row) => row.offerId === offerId)).toMatchObject({ healthCheckState: "queued", retryEligible: false, retryBlockedReason: "HEALTH_RETRY_QUEUED" });
    const outbox = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: queued.outboxId } });
    expect(outbox).toMatchObject({ topic: "product_link.health_check", aggregateType: "product_offer", aggregateId: offerId });

    const handled = await app.get(JobHandlersService).handle("product_link.health_check", { productLinkId: legacyLink.id, productOfferId: offerId });
    expect(handled).toMatchObject({ code: "PRODUCT_LINK_HEALTHY", details: { productOffersSynced: 1 } });
    await expect(prisma.productOffer.findUniqueOrThrow({ where: { id: offerId } })).resolves.toMatchObject({ healthState: "healthy" });
  });
});
