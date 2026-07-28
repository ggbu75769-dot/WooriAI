import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";
import { PrismaService } from "../src/prisma/prisma.service";
import { Release5ExternalService } from "../src/release5/release5-external.service";
import { Release5ReadinessService } from "../src/release5/release5-readiness.service";

describe("Release 5 reviewed safety alternatives", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let external: Release5ExternalService;
  let readiness: Release5ReadinessService;
  let sourceItemId = "";
  let alternativeItemId = "";
  let householdId = "";
  let userId = "";
  let childId = "";
  let planId = "";
  let alertId = "";
  let capturerId = "";
  let reviewerId = "";
  let activatorId = "";
  let otherAdminId = "";
  const evidenceIds: string[] = [];
  const approvalIds: string[] = [];
  const manifestIds: string[] = [];
  const readinessItemIds: string[] = [];
  const marker = `genesis-safety-${randomUUID()}`;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousInternalFeatures = process.env.RELEASE5_INTERNAL_FEATURES;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.RELEASE5_INTERNAL_FEATURES = "1";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    external = moduleRef.get(Release5ExternalService);
    readiness = moduleRef.get(Release5ReadinessService);

    sourceItemId = "";
    alternativeItemId = "";
    householdId = "";
    userId = "";
    childId = "";
    planId = "";
    alertId = "";
    const admins = await Promise.all(["capturer", "reviewer", "activator", "other"].map((role) => prisma.adminUser.create({
      data: {
        email: `${marker}-${role}@wooriai.test`,
        passwordHash: "test-only",
        displayName: role,
        role: "admin"
      }
    })));
    [capturerId, reviewerId, activatorId, otherAdminId] = admins.map((admin) => admin.id);

    const user = await prisma.user.create({
      data: { authProvider: "kakao", providerUserId: marker, displayName: "Genesis safety owner" }
    });
    userId = user.id;
    const household = await prisma.household.create({
      data: { name: marker, ownerUserId: userId }
    });
    householdId = household.id;
    await prisma.householdMember.create({
      data: { householdId, userId, role: "owner", status: "active", joinedAt: new Date() }
    });
    const child = await prisma.child.create({
      data: { householdId, nickname: "안전 확인 아이", stageMode: "manual", manualStage: "infant_4_6" }
    });
    childId = child.id;

    const itemBase = {
      shortDescription: "Genesis safety lifecycle fixture",
      targetSubject: "child" as const,
      necessity: "recommended" as const,
      recommendationState: "recommended" as const,
      reasonText: "Safety lifecycle fixture",
      timingSummary: "Test only",
      secondhandPolicy: "allowed" as const,
      rentalPolicy: "suitable" as const,
      safetyTier: "normal" as const,
      sourceSummary: marker,
      contentVersion: 1,
      contentHash: randomUUID().replaceAll("-", ""),
      reviewedAt: new Date(),
      reviewedByAdminId: reviewerId,
      status: "published" as const
    };
    const [source, alternative] = await Promise.all([
      prisma.itemDefinition.create({
        data: { ...itemBase, code: `${marker}-source`, nameKo: "리콜 원본 품목", displayOrder: 99_991 }
      }),
      prisma.itemDefinition.create({
        data: { ...itemBase, code: `${marker}-alternative`, nameKo: "검증 대체 품목", displayOrder: 99_992 }
      })
    ]);
    sourceItemId = source.id;
    alternativeItemId = alternative.id;
    await prisma.itemAlternative.create({
      data: {
        itemDefinitionId: sourceItemId,
        alternativeItemDefinitionId: alternativeItemId,
        reason: "공식 근거로 검토한 대체 품목"
      }
    });
    const plan = await prisma.userItemPlan.create({
      data: { householdId, childId, itemDefinitionId: sourceItemId, state: "owned" }
    });
    planId = plan.id;
    const alert = await prisma.catalogSafetyAlert.create({
      data: {
        itemDefinitionId: sourceItemId,
        userItemPlanId: planId,
        eventType: "recalled",
        reason: "공식 리콜 테스트",
        itemContentVersion: 1
      }
    });
    alertId = alert.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.auditLog.deleteMany({ where: { action: { startsWith: "release5.safety-alternative." } } });
    if (alertId) await prisma.catalogSafetyAlert.deleteMany({ where: { id: alertId } });
    if (planId) await prisma.userItemPlan.deleteMany({ where: { id: planId } });
    if (sourceItemId && alternativeItemId) {
      await prisma.itemAlternative.deleteMany({
        where: { itemDefinitionId: sourceItemId, alternativeItemDefinitionId: alternativeItemId }
      });
    }
    if (evidenceIds.length) {
      await prisma.itemEvidenceSource.deleteMany({ where: { id: { in: evidenceIds.splice(0) } } });
    }
    if (manifestIds.length) {
      await prisma.catalogPilotManifest.deleteMany({ where: { id: { in: manifestIds.splice(0) } } });
    }
    if (approvalIds.length) {
      await prisma.catalogItemApproval.deleteMany({ where: { id: { in: approvalIds.splice(0) } } });
    }
    await prisma.catalogReviewerCredential.deleteMany({
      where: { adminId: { in: [capturerId, reviewerId, activatorId, otherAdminId].filter(Boolean) } }
    });
    if (childId) await prisma.child.deleteMany({ where: { id: childId } });
    if (householdId && userId) {
      await prisma.householdMember.deleteMany({ where: { householdId, userId } });
      await prisma.household.deleteMany({ where: { id: householdId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (sourceItemId || alternativeItemId) {
      await prisma.itemDefinition.deleteMany({ where: { id: { in: [sourceItemId, alternativeItemId].filter(Boolean) } } });
    }
    if (readinessItemIds.length) {
      const ids = readinessItemIds.splice(0);
      await prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: { in: ids } } });
      await prisma.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: { in: ids } } });
      await prisma.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: { in: ids } } });
      await prisma.itemDefinition.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.adminUser.deleteMany({ where: { email: { startsWith: marker } } });

    expect(await prisma.itemDefinition.count({ where: { code: { startsWith: marker } } })).toBe(0);
    expect(await prisma.adminUser.count({ where: { email: { startsWith: marker } } })).toBe(0);
    expect(await prisma.user.count({ where: { providerUserId: marker } })).toBe(0);

    if (previousInternalFeatures === undefined) delete process.env.RELEASE5_INTERNAL_FEATURES;
    else process.env.RELEASE5_INTERNAL_FEATURES = previousInternalFeatures;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    await moduleRef.close();
  });

  function owner(): AuthenticatedUser {
    return {
      id: userId,
      displayName: "Genesis safety owner",
      email: null,
      status: "active",
      households: [{ id: householdId, role: "owner" }]
    };
  }

  async function approvedEvidence(input: {
    sourceType?: string;
    applicableClaims?: string[];
    expiresAt?: string;
    reviewDueAt?: string;
    revision?: number;
    capturedBy?: string;
    reviewedBy?: string;
  } = {}) {
    const evidence = await readiness.createEvidence(input.capturedBy ?? capturerId, sourceItemId, {
      sourceType: input.sourceType ?? "official",
      title: "공식 안전 대체 근거",
      publicUrl: "https://www.wooriai.kr/safety-alternative",
      revision: input.revision ?? 1,
      applicableClaims: input.applicableClaims ?? [`safety_alternative:${alternativeItemId}`],
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(input.reviewDueAt ? { reviewDueAt: input.reviewDueAt } : {})
    });
    evidenceIds.push(evidence.id);
    return readiness.reviewEvidence(input.reviewedBy ?? reviewerId, evidence.id, {
      expectedContentHash: evidence.contentHash!,
      approved: true
    });
  }

  async function readinessFixture() {
    const contentHash = randomUUID().replaceAll("-", "").repeat(2);
    const item = await prisma.itemDefinition.create({
      data: {
        code: `${marker}-readiness-${randomUUID()}`,
        nameKo: "근거 준비 상태 품목",
        shortDescription: "Readiness evidence fixture",
        targetSubject: "child",
        necessity: "recommended",
        recommendationState: "recommended",
        reasonText: "Readiness evidence fixture",
        timingSummary: "Test only",
        secondhandPolicy: "allowed",
        rentalPolicy: "suitable",
        safetyTier: "normal",
        sourceSummary: marker,
        contentVersion: 1,
        contentHash,
        reviewedAt: new Date(),
        reviewedByAdminId: reviewerId,
        status: "approved",
        displayOrder: 99_993
      }
    });
    readinessItemIds.push(item.id);
    const primaryNode = await prisma.catalogNode.findFirstOrThrow({
      where: { level: "subcategory", active: true },
      orderBy: { code: "asc" }
    });
    await prisma.itemDefinitionCategory.create({
      data: {
        itemDefinitionId: item.id,
        catalogNodeId: primaryNode.id,
        isPrimary: true,
        displayOrder: 10
      }
    });
    await prisma.itemLifecycleRule.create({
      data: {
        itemDefinitionId: item.id,
        axis: "child",
        lifecycleCode: "newborn_0_3m",
        timingText: "테스트 시기",
        priorityWeight: 100
      }
    });
    const evidence = await readiness.createEvidence(capturerId, item.id, {
      sourceType: "official",
      title: "준비 상태 공식 근거",
      publicUrl: "https://www.wooriai.kr/readiness-evidence",
      revision: 1,
      applicableClaims: ["timing"]
    });
    evidenceIds.push(evidence.id);
    const reviewed = await readiness.reviewEvidence(reviewerId, evidence.id, {
      expectedContentHash: evidence.contentHash!,
      approved: true
    });
    await prisma.catalogReviewerCredential.createMany({
      data: [
        { adminId: reviewerId, approvalType: "editorial" },
        { adminId: activatorId, approvalType: "domain" }
      ]
    });
    const approvals = await Promise.all([
      prisma.catalogItemApproval.create({
        data: {
          itemDefinitionId: item.id,
          revision: 1,
          contentHash,
          approvalType: "editorial",
          reviewedByAdminId: reviewerId
        }
      }),
      prisma.catalogItemApproval.create({
        data: {
          itemDefinitionId: item.id,
          revision: 1,
          contentHash,
          approvalType: "domain",
          reviewedByAdminId: activatorId
        }
      })
    ]);
    approvalIds.push(...approvals.map((approval) => approval.id));
    return { item, evidence: reviewed };
  }

  it("activates a mapped alternative with canonical independently reviewed evidence", async () => {
    const evidence = await approvedEvidence();

    await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    })).resolves.toMatchObject({
      itemDefinitionId: sourceItemId,
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id,
      active: true
    });
  });

  it("returns a backed alternative instead of a published row with null evidence", async () => {
    const evidence = await approvedEvidence();
    await prisma.itemAlternative.update({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      },
      data: {
        evidenceSourceId: evidence.id,
        approvedByAdminId: activatorId,
        safetyApprovedAt: new Date(),
        active: true
      }
    });

    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({
      state: "recalled",
      alternatives: [{
        id: alternativeItemId,
        reason: "공식 근거로 검토한 대체 품목",
        evidence: {
          id: evidence.id,
          title: "공식 안전 대체 근거",
          publicUrl: "https://www.wooriai.kr/safety-alternative"
        }
      }]
    });
  });

  it("fails closed for legacy or inconsistent safety actor provenance and stored URLs", async () => {
    const evidence = await approvedEvidence();
    await external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    const key = {
      itemDefinitionId_alternativeItemDefinitionId: {
        itemDefinitionId: sourceItemId,
        alternativeItemDefinitionId: alternativeItemId
      }
    };

    await prisma.itemAlternative.update({ where: key, data: { approvedByAdminId: null } });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });

    await prisma.itemAlternative.update({ where: key, data: { approvedByAdminId: capturerId } });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });

    await prisma.itemAlternative.update({ where: key, data: { approvedByAdminId: activatorId } });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewedByAdminId: capturerId }
    });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });

    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: {
        reviewedByAdminId: reviewerId,
        publicUrl: "https://127.0.0.1/legacy-evidence"
      }
    });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });
  });

  it("allows exactly one concurrent approve-or-reject review transition", async () => {
    const evidence = await readiness.createEvidence(capturerId, sourceItemId, {
      sourceType: "official",
      title: "동시 검수 근거",
      publicUrl: "https://www.wooriai.kr/safety-review-race",
      revision: 1,
      applicableClaims: [`safety_alternative:${alternativeItemId}`]
    });
    evidenceIds.push(evidence.id);

    const originalFind = prisma.itemEvidenceSource.findUnique.bind(prisma.itemEvidenceSource);
    let reads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    vi.spyOn(prisma.itemEvidenceSource, "findUnique").mockImplementation((async (args: Parameters<typeof originalFind>[0]) => {
      const result = await originalFind(args);
      reads += 1;
      if (reads === 2) releaseReads();
      await bothRead;
      return result;
    }) as never);

    const results = await Promise.allSettled([
      readiness.reviewEvidence(reviewerId, evidence.id, {
        expectedContentHash: evidence.contentHash!,
        approved: true
      }),
      readiness.reviewEvidence(activatorId, evidence.id, {
        expectedContentHash: evidence.contentHash!,
        approved: false
      })
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { response: expect.objectContaining({ code: "EVIDENCE_REVISION_CONFLICT" }) }
    });
    const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
    await expect(originalFind({ where: { id: evidence.id } })).resolves.toMatchObject(
      winnerIndex === 0
        ? { status: "valid", reviewedByAdminId: reviewerId }
        : { status: "rejected", reviewedByAdminId: activatorId }
    );
  });

  it("creates an inactive mapping through the supported service and durably audits it", async () => {
    await prisma.itemAlternative.delete({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      }
    });

    await expect(external.upsertSafetyAlternative(capturerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "  공식   대체 사유  "
    }, { allowActiveReplace: false })).resolves.toMatchObject({
      reason: "공식 대체 사유",
      active: false,
      evidenceSourceId: null,
      approvedByAdminId: null
    });
    await expect(prisma.auditLog.findFirst({
      where: {
        action: "release5.safety-alternative.create",
        targetId: sourceItemId
      }
    })).resolves.toMatchObject({
      actorUserId: capturerId,
      afterJson: expect.objectContaining({
        mapping: expect.objectContaining({ alternativeItemDefinitionId: alternativeItemId, active: false })
      })
    });
  });

  it("rolls back the mapping when durable audit persistence fails", async () => {
    await prisma.itemAlternative.delete({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      }
    });
    const service = external as unknown as {
      auditSafetyAlternative: (...args: unknown[]) => Promise<void>;
    };
    vi.spyOn(service, "auditSafetyAlternative").mockRejectedValueOnce(new Error("AUDIT_WRITE_FAILED"));

    await expect(external.upsertSafetyAlternative(capturerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "감사 실패 시 롤백"
    }, { allowActiveReplace: false })).rejects.toThrow("AUDIT_WRITE_FAILED");
    await expect(prisma.itemAlternative.count({
      where: { itemDefinitionId: sourceItemId, alternativeItemDefinitionId: alternativeItemId }
    })).resolves.toBe(0);
    await expect(prisma.auditLog.count({
      where: { action: { startsWith: "release5.safety-alternative." }, targetId: sourceItemId }
    })).resolves.toBe(0);
  });

  it("serializes concurrent identical mapping creation into one durable row and audit", async () => {
    await prisma.itemAlternative.delete({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      }
    });

    const create = (actorAdminId: string) => external.upsertSafetyAlternative(actorAdminId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "동시 생성 대체 사유"
    }, { allowActiveReplace: false });
    const results = await Promise.all([create(capturerId), create(otherAdminId)]);

    expect(results).toEqual([
      expect.objectContaining({ reason: "동시 생성 대체 사유", active: false }),
      expect.objectContaining({ reason: "동시 생성 대체 사유", active: false })
    ]);
    await expect(prisma.itemAlternative.count({
      where: { itemDefinitionId: sourceItemId, alternativeItemDefinitionId: alternativeItemId }
    })).resolves.toBe(1);
    await expect(prisma.auditLog.count({
      where: { action: "release5.safety-alternative.create", targetId: sourceItemId }
    })).resolves.toBe(1);
  });

  it("preserves approval on identical retry and requires admin to change an active mapping", async () => {
    const evidence = await approvedEvidence();
    const activated = await external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    const auditCount = await prisma.auditLog.count({ where: { action: { startsWith: "release5.safety-alternative." } } });

    await expect(external.upsertSafetyAlternative(capturerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: " 공식 근거로   검토한 대체 품목 "
    }, { allowActiveReplace: false })).resolves.toMatchObject({
      active: true,
      evidenceSourceId: activated.evidenceSourceId,
      approvedByAdminId: activatorId
    });
    expect(await prisma.auditLog.count({ where: { action: { startsWith: "release5.safety-alternative." } } })).toBe(auditCount);

    await expect(external.upsertSafetyAlternative(capturerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "새 안전 사유"
    }, { allowActiveReplace: false })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_ALTERNATIVE_ACTIVE_ADMIN_REQUIRED" })
    });
    await expect(external.upsertSafetyAlternative(otherAdminId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "새 안전 사유"
    }, { allowActiveReplace: true })).resolves.toMatchObject({
      reason: "새 안전 사유",
      active: false,
      evidenceSourceId: null,
      approvedByAdminId: null,
      safetyApprovedAt: null
    });
  });

  it("requires a third activator and evidence for the exact alternative", async () => {
    const captured = await approvedEvidence();
    await expect(external.approveSafetyAlternative(capturerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: captured.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_ACTIVATOR_CAPTURER_SEPARATION_REQUIRED" })
    });
    await expect(external.approveSafetyAlternative(reviewerId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: captured.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_ACTIVATOR_REVIEWER_SEPARATION_REQUIRED" })
    });

    const wrongClaim = await approvedEvidence({ applicableClaims: [`safety_alternative:${randomUUID()}`] });
    await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: wrongClaim.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_EVIDENCE_REQUIRED" })
    });
  });

  it("rejects missing-capturer and self-reviewed legacy evidence at activation", async () => {
    const missingCapturer = await approvedEvidence();
    await prisma.itemEvidenceSource.update({
      where: { id: missingCapturer.id },
      data: { capturedByAdminId: null }
    });
    await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: missingCapturer.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_EVIDENCE_REQUIRED" })
    });

    const selfReviewed = await approvedEvidence({ capturedBy: otherAdminId });
    await prisma.itemEvidenceSource.update({
      where: { id: selfReviewed.id },
      data: { reviewedByAdminId: otherAdminId }
    });
    await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: selfReviewed.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_EVIDENCE_INDEPENDENCE_REQUIRED" })
    });
  });

  it("evaluates evidence expiry only after approval locks are acquired", async () => {
    const evidence = await approvedEvidence({
      expiresAt: new Date(Date.now() + 75).toISOString()
    });
    const service = external as unknown as {
      lockSafetyApprovalInputs: (...args: unknown[]) => Promise<void>;
    };
    const originalLock = service.lockSafetyApprovalInputs.bind(service);
    vi.spyOn(service, "lockSafetyApprovalInputs").mockImplementation(async (...args: unknown[]) => {
      await originalLock(...args);
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_EVIDENCE_REQUIRED" })
    });
  });

  it("holds source revision locks through activation", async () => {
    const evidence = await approvedEvidence();
    const service = external as unknown as {
      lockSafetyApprovalInputs: (...args: unknown[]) => Promise<void>;
    };
    const originalLock = service.lockSafetyApprovalInputs.bind(service);
    let locked!: () => void;
    let release!: () => void;
    const locksAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const releaseApproval = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(service, "lockSafetyApprovalInputs").mockImplementation(async (...args: unknown[]) => {
      await originalLock(...args);
      locked();
      await releaseApproval;
    });

    const approval = external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    await locksAcquired;
    let sourceUpdateSettled = false;
    const sourceUpdate = prisma.itemDefinition.update({
      where: { id: sourceItemId },
      data: { contentVersion: { increment: 1 } }
    }).then(() => {
      sourceUpdateSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sourceUpdateSettled).toBe(false);

    release();
    await expect(approval).resolves.toMatchObject({ active: true });
    await sourceUpdate;
    expect(sourceUpdateSettled).toBe(true);
    await expect(prisma.itemDefinition.findUniqueOrThrow({ where: { id: sourceItemId } }))
      .resolves.toMatchObject({ contentVersion: 2 });
  });

  it("denies ineligible, expired, and review-overdue evidence at activation", async () => {
    const cases = [
      await approvedEvidence({ sourceType: "community_blog" }),
      await approvedEvidence({ expiresAt: "2020-01-01T00:00:00.000Z" }),
      await approvedEvidence({ reviewDueAt: "2020-01-01T00:00:00.000Z" })
    ];
    for (const evidence of cases) {
      await expect(external.approveSafetyAlternative(activatorId, sourceItemId, {
        alternativeItemDefinitionId: alternativeItemId,
        evidenceSourceId: evidence.id
      })).rejects.toMatchObject({
        response: expect.objectContaining({ code: "SAFETY_EVIDENCE_REQUIRED" })
      });
    }
  });

  it("omits an activated alternative after its proof becomes stale", async () => {
    const evidence = await approvedEvidence();
    await external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { expiresAt: new Date("2020-01-01T00:00:00.000Z") }
    });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });

    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { expiresAt: null, reviewDueAt: new Date("2020-01-01T00:00:00.000Z") }
    });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });

    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewDueAt: null, revision: 2 }
    });
    await expect(external.safetyAlternatives(owner(), alertId)).resolves.toMatchObject({ alternatives: [] });
  });

  it("uses the same owner, co-parent, viewer, gift, and cross-household privacy policy", async () => {
    const evidence = await approvedEvidence();
    await external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    for (const role of ["owner", "co_parent", "viewer"] as const) {
      await expect(external.safetyAlternatives({ ...owner(), households: [{ id: householdId, role }] }, alertId))
        .resolves.toMatchObject({ alternatives: [{ id: alternativeItemId }] });
    }
    await expect(external.safetyAlternatives({
      ...owner(),
      households: [{ id: householdId, role: "gift_participant" }]
    }, alertId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ITEM_PLAN_PRIVATE" })
    });
    await expect(external.safetyAlternatives({ ...owner(), households: [] }, alertId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "HOUSEHOLD_FORBIDDEN" })
    });
  });

  it("retries a serialization conflict and returns a coherent post-deactivation snapshot", async () => {
    const evidence = await approvedEvidence();
    await external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    const service = external as unknown as {
      readSafetyAlternativesSnapshot: (
        user: AuthenticatedUser,
        targetAlertId: string
      ) => Promise<unknown>;
    };
    const originalRead = service.readSafetyAlternativesSnapshot.bind(service);
    let attempts = 0;
    vi.spyOn(service, "readSafetyAlternativesSnapshot").mockImplementation(async (...args) => {
      attempts += 1;
      if (attempts === 1) {
        await external.deactivateSafetyAlternative(otherAdminId, sourceItemId, alternativeItemId);
        throw new Prisma.PrismaClientKnownRequestError("serialization conflict", {
          code: "P2034",
          clientVersion: "6.19.3"
        });
      }
      return originalRead(...args);
    });

    await expect(external.safetyAlternatives(owner(), alertId))
      .resolves.toMatchObject({ state: "recalled", alternatives: [] });
    expect(attempts).toBe(2);
    await expect(prisma.itemAlternative.findUniqueOrThrow({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      }
    })).resolves.toMatchObject({
      active: false,
      evidenceSourceId: null,
      approvedByAdminId: null
    });
  });

  it("does not reactivate a concurrently replaced mapping from a stale approval", async () => {
    const evidence = await approvedEvidence();
    const originalFind = prisma.itemAlternative.findUnique.bind(prisma.itemAlternative);
    let captured!: () => void;
    let release!: () => void;
    const mappingCaptured = new Promise<void>((resolve) => { captured = resolve; });
    const replacementDone = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(prisma.itemAlternative, "findUnique").mockImplementation((async (args: Parameters<typeof originalFind>[0]) => {
      const result = await originalFind(args);
      captured();
      await replacementDone;
      return result;
    }) as never);

    const approval = external.approveSafetyAlternative(activatorId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      evidenceSourceId: evidence.id
    });
    await mappingCaptured;
    await external.upsertSafetyAlternative(otherAdminId, sourceItemId, {
      alternativeItemDefinitionId: alternativeItemId,
      reason: "동시에 교체된 사유"
    }, { allowActiveReplace: true });
    release();
    await expect(approval).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_ALTERNATIVE_REVISION_CONFLICT" })
    });
    await expect(originalFind({
      where: {
        itemDefinitionId_alternativeItemDefinitionId: {
          itemDefinitionId: sourceItemId,
          alternativeItemDefinitionId: alternativeItemId
        }
      }
    })).resolves.toMatchObject({ reason: "동시에 교체된 사유", active: false });
  });

  it("uses reviewer, expiry, and review-due policy in the pilot worklist", async () => {
    const { item, evidence } = await readinessFixture();
    const candidate = async () => (await readiness.pilotWorklist()).items.find((entry) => entry.id === item.id);
    await expect(candidate()).resolves.toMatchObject({
      status: "approved",
      structureReady: true,
      evidenceReady: true,
      editorialApproved: true,
      domainApproved: true,
      approvalReviewersIndependent: true,
      ready: true
    });

    await prisma.catalogReviewerCredential.create({
      data: { adminId: reviewerId, approvalType: "domain" }
    });
    await prisma.catalogItemApproval.update({
      where: {
        itemDefinitionId_revision_approvalType: {
          itemDefinitionId: item.id,
          revision: 1,
          approvalType: "domain"
        }
      },
      data: { reviewedByAdminId: reviewerId }
    });
    await expect(candidate()).resolves.toMatchObject({
      editorialApproved: true,
      domainApproved: true,
      approvalReviewersIndependent: false,
      ready: false
    });
    await prisma.catalogItemApproval.update({
      where: {
        itemDefinitionId_revision_approvalType: {
          itemDefinitionId: item.id,
          revision: 1,
          approvalType: "domain"
        }
      },
      data: { reviewedByAdminId: activatorId }
    });

    await prisma.itemEvidenceSource.update({ where: { id: evidence.id }, data: { reviewedByAdminId: null } });
    await expect(candidate()).resolves.toMatchObject({ evidenceReady: false, ready: false });
    await prisma.itemEvidenceSource.update({ where: { id: evidence.id }, data: { reviewedByAdminId: capturerId } });
    await expect(candidate()).resolves.toMatchObject({ evidenceReady: false, ready: false });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewedByAdminId: reviewerId, expiresAt: new Date("2020-01-01T00:00:00.000Z") }
    });
    await expect(candidate()).resolves.toMatchObject({ evidenceReady: false, ready: false });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { expiresAt: null, reviewDueAt: new Date("2020-01-01T00:00:00.000Z") }
    });
    await expect(candidate()).resolves.toMatchObject({ evidenceReady: false, ready: false });
    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewDueAt: new Date("2035-01-01T00:00:00.000Z") }
    });
    await expect(candidate()).resolves.toMatchObject({ evidenceReady: true, ready: true });
  });

  it("revalidates participant separation, reviewer credentials, and evidence when publishing a prepared manifest", async () => {
    const { item, evidence } = await readinessFixture();
    const manifest = await readiness.previewPilotManifest(capturerId, { itemIds: [item.id] });
    manifestIds.push(manifest.id);
    await prisma.catalogPilotManifest.update({
      where: { id: manifest.id },
      data: {
        expectedRevisionsJson: [{
          id: item.id,
          revision: item.contentVersion + 1,
          contentHash: item.contentHash!
        }]
      }
    });
    await expect(readiness.publishPilotManifest(otherAdminId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PILOT_MANIFEST_INTEGRITY" })
    });
    await prisma.catalogPilotManifest.update({
      where: { id: manifest.id },
      data: {
        expectedRevisionsJson: [{
          id: item.id,
          revision: item.contentVersion,
          contentHash: item.contentHash!
        }]
      }
    });

    await prisma.catalogReviewerCredential.create({
      data: { adminId: reviewerId, approvalType: "domain" }
    });
    await prisma.catalogItemApproval.update({
      where: {
        itemDefinitionId_revision_approvalType: {
          itemDefinitionId: item.id,
          revision: 1,
          approvalType: "domain"
        }
      },
      data: { reviewedByAdminId: reviewerId }
    });
    await expect(readiness.publishPilotManifest(otherAdminId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PILOT_APPROVAL_REVIEWER_SEPARATION_REQUIRED" })
    });
    await prisma.catalogItemApproval.update({
      where: {
        itemDefinitionId_revision_approvalType: {
          itemDefinitionId: item.id,
          revision: 1,
          approvalType: "domain"
        }
      },
      data: { reviewedByAdminId: activatorId }
    });
    await prisma.catalogReviewerCredential.delete({
      where: {
        adminId_approvalType: {
          adminId: reviewerId,
          approvalType: "domain"
        }
      }
    });

    await expect(readiness.publishPilotManifest(capturerId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "CATALOG_PUBLISHER_SEPARATION_REQUIRED" })
    });
    await expect(prisma.catalogPilotManifest.findUniqueOrThrow({ where: { id: manifest.id } }))
      .resolves.toMatchObject({ status: "preview" });

    await prisma.catalogReviewerCredential.update({
      where: {
        adminId_approvalType: {
          adminId: activatorId,
          approvalType: "domain"
        }
      },
      data: { active: false }
    });
    await expect(readiness.publishPilotManifest(otherAdminId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PILOT_REVIEWER_CREDENTIAL_REQUIRED" })
    });
    await prisma.catalogReviewerCredential.update({
      where: {
        adminId_approvalType: {
          adminId: activatorId,
          approvalType: "domain"
        }
      },
      data: { active: true }
    });

    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewDueAt: new Date("2020-01-01T00:00:00.000Z") }
    });
    await expect(readiness.publishPilotManifest(otherAdminId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PILOT_PUBLISH_GATE_FAILED" })
    });
    await expect(prisma.catalogPilotManifest.findUniqueOrThrow({ where: { id: manifest.id } }))
      .resolves.toMatchObject({ status: "preview" });

    await prisma.itemEvidenceSource.update({
      where: { id: evidence.id },
      data: { reviewDueAt: new Date("2035-01-01T00:00:00.000Z") }
    });
    await expect(readiness.publishPilotManifest(otherAdminId, manifest.id, {
      expectedContentHash: manifest.contentHash
    })).resolves.toMatchObject({ status: "published" });
  });
});
