import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type CatalogReviewStatus } from "@prisma/client";
import { normalizePublicHttpsUrl, PublicHttpsUrlError } from "../common/security/public-https-url";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ApproveLegalDocumentDto,
  CreateEvidenceSourceDto,
  LegalDocumentCandidateDto,
  PreviewPilotManifestDto,
  PublishLegalDocumentDto,
  PublishPilotManifestDto,
  ReviewEvidenceSourceDto
} from "./dto/release5-readiness.dto";
import {
  currentReviewedEvidenceWhere,
  evidenceHasIndependentCaptureAndReview,
  ITEM_EVIDENCE_STATUS
} from "./item-evidence-policy";

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type PilotManifestRow = { id: string; revision: number; contentHash: string };
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pilotManifestRows(value: Prisma.JsonValue): PilotManifestRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  const rows: PilotManifestRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, Prisma.JsonValue>;
    if (
      typeof row.id !== "string" ||
      !UUID_V4_PATTERN.test(row.id) ||
      !Number.isInteger(row.revision) ||
      Number(row.revision) < 1 ||
      typeof row.contentHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(row.contentHash)
    ) {
      return null;
    }
    rows.push({ id: row.id, revision: Number(row.revision), contentHash: row.contentHash });
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return null;
  return rows;
}

function assertPublicHttps(value: string) {
  try {
    return normalizePublicHttpsUrl(value);
  } catch (error) {
    if (error instanceof PublicHttpsUrlError && error.kind === "invalid") {
      throw new BadRequestException({ code: "PUBLIC_URL_INVALID", message: "A valid HTTPS source URL is required." });
    }
    throw new BadRequestException({ code: "PUBLIC_URL_BLOCKED", message: "Private, local, reserved, credentialed, and example hosts are not allowed." });
  }
}

@Injectable()
export class Release5ReadinessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  legalPreview(input: LegalDocumentCandidateDto) {
    const normalized = {
      documentType: input.documentType,
      locale: input.locale?.trim() || "ko-KR",
      version: input.version.trim(),
      title: input.title.trim(),
      bodyMarkdown: input.bodyMarkdown.trim(),
      publicUrl: input.publicUrl ? assertPublicHttps(input.publicUrl) : null,
      required: input.required,
      effectiveAt: new Date(input.effectiveAt).toISOString()
    };
    if (!normalized.bodyMarkdown && !normalized.publicUrl) {
      throw new BadRequestException({ code: "LEGAL_CONTENT_REQUIRED", message: "Document body or a public HTTPS URL is required." });
    }
    return { document: normalized, contentHash: sha256(normalized), validation: { valid: true, placeholder: false } };
  }

  async importLegal(adminId: string, input: LegalDocumentCandidateDto) {
    const preview = this.legalPreview(input);
    const existing = await this.prisma.legalDocument.findUnique({
      where: { documentType_locale_version: {
        documentType: preview.document.documentType,
        locale: preview.document.locale,
        version: preview.document.version
      } }
    });
    if (existing) throw new ConflictException({ code: "LEGAL_VERSION_EXISTS", message: "This legal document version already exists." });
    return this.prisma.legalDocument.create({
      data: {
        ...preview.document,
        effectiveAt: new Date(preview.document.effectiveAt),
        contentHash: preview.contentHash,
        placeholder: false,
        publishedAt: null,
        createdByAdminId: adminId
      }
    });
  }

  async approveLegal(adminId: string, documentId: string, input: ApproveLegalDocumentDto) {
    const document = await this.prisma.legalDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException({ code: "LEGAL_DOCUMENT_NOT_FOUND", message: "Legal document not found." });
    if (document.createdByAdminId === adminId) {
      throw new ForbiddenException({ code: "LEGAL_APPROVER_SEPARATION_REQUIRED", message: "The importer cannot approve the same legal document." });
    }
    const updated = await this.prisma.legalDocument.updateMany({
      where: { id: documentId, revision: input.expectedRevision, approvedAt: null },
      data: { approvedByAdminId: adminId, approvedAt: new Date(), approvalNote: input.approvalNote.trim(), revision: { increment: 1 } }
    });
    if (updated.count !== 1) throw new ConflictException({ code: "LEGAL_REVISION_CONFLICT", message: "The legal document changed before approval." });
    return this.prisma.legalDocument.findUniqueOrThrow({ where: { id: documentId } });
  }

  async publishLegal(adminId: string, documentId: string, input: PublishLegalDocumentDto) {
    const document = await this.prisma.legalDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException({ code: "LEGAL_DOCUMENT_NOT_FOUND", message: "Legal document not found." });
    if (!document.approvedAt || !document.approvedByAdminId || document.placeholder) {
      throw new BadRequestException({ code: "LEGAL_APPROVAL_REQUIRED", message: "Only an approved non-placeholder document can be published." });
    }
    if (document.createdByAdminId === adminId || document.approvedByAdminId === adminId) {
      throw new ForbiddenException({ code: "LEGAL_PUBLISHER_SEPARATION_REQUIRED", message: "Importer, approver, and publisher must be different operators." });
    }
    const updated = await this.prisma.legalDocument.updateMany({
      where: { id: documentId, revision: input.expectedRevision, publishedAt: null },
      data: { publishedAt: new Date(), revision: { increment: 1 } }
    });
    if (updated.count !== 1) throw new ConflictException({ code: "LEGAL_REVISION_CONFLICT", message: "The legal document changed before publication." });
    return this.prisma.legalDocument.findUniqueOrThrow({ where: { id: documentId } });
  }

  async createEvidence(adminId: string, itemDefinitionId: string, input: CreateEvidenceSourceDto) {
    const item = await this.prisma.itemDefinition.findUnique({ where: { id: itemDefinitionId } });
    if (!item) throw new NotFoundException({ code: "CATALOG_ITEM_NOT_FOUND", message: "Catalog item not found." });
    if (item.contentVersion !== input.revision) {
      throw new ConflictException({ code: "CATALOG_REVISION_CONFLICT", message: "Evidence must target the current item revision." });
    }
    const payload = {
      itemDefinitionId,
      revision: input.revision,
      sourceType: input.sourceType.trim(),
      title: input.title.trim(),
      publicUrl: assertPublicHttps(input.publicUrl),
      publisher: input.publisher?.trim() || null,
      publishedAt: input.publishedAt ?? null,
      applicableClaims: [...new Set(input.applicableClaims.map((claim) => claim.trim()).filter(Boolean))].sort(),
      expiresAt: input.expiresAt ?? null,
      reviewDueAt: input.reviewDueAt ?? null
    };
    if (payload.applicableClaims.length === 0) {
      throw new BadRequestException({ code: "EVIDENCE_CLAIMS_REQUIRED", message: "At least one applicable claim is required." });
    }
    return this.prisma.itemEvidenceSource.create({
      data: {
        itemDefinitionId,
        sourceType: payload.sourceType,
        title: payload.title,
        publicUrl: payload.publicUrl,
        publisher: payload.publisher,
        publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
        checkedAt: new Date(),
        capturedAt: new Date(),
        capturedByAdminId: adminId,
        revision: input.revision,
        contentHash: sha256(payload),
        applicableClaimsJson: payload.applicableClaims,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        reviewDueAt: payload.reviewDueAt ? new Date(payload.reviewDueAt) : null,
        status: ITEM_EVIDENCE_STATUS.draft
      }
    });
  }

  async reviewEvidence(adminId: string, evidenceId: string, input: ReviewEvidenceSourceDto) {
    const evidence = await this.prisma.itemEvidenceSource.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException({ code: "EVIDENCE_NOT_FOUND", message: "Evidence source not found." });
    if (evidence.capturedByAdminId === adminId) {
      throw new ForbiddenException({ code: "EVIDENCE_REVIEWER_SEPARATION_REQUIRED", message: "The evidence capturer cannot review the same evidence." });
    }
    if (evidence.contentHash !== input.expectedContentHash || evidence.status !== ITEM_EVIDENCE_STATUS.draft) {
      throw new ConflictException({ code: "EVIDENCE_REVISION_CONFLICT", message: "Evidence changed before review." });
    }
    const changed = await this.prisma.itemEvidenceSource.updateMany({
      where: {
        id: evidenceId,
        status: ITEM_EVIDENCE_STATUS.draft,
        contentHash: input.expectedContentHash
      },
      data: {
        status: input.approved ? ITEM_EVIDENCE_STATUS.valid : ITEM_EVIDENCE_STATUS.rejected,
        reviewedByAdminId: adminId,
        checkedAt: new Date()
      }
    });
    if (changed.count !== 1) {
      throw new ConflictException({ code: "EVIDENCE_REVISION_CONFLICT", message: "Evidence changed before review." });
    }
    return this.prisma.itemEvidenceSource.findUniqueOrThrow({ where: { id: evidenceId } });
  }

  async pilotWorklist() {
    const now = new Date();
    const items = await this.prisma.itemDefinition.findMany({
      where: { status: { in: ["in_review", "approved"] }, safetyTier: "normal" },
      orderBy: [{ safetyTier: "asc" }, { displayOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        code: true,
        nameKo: true,
        contentVersion: true,
        contentHash: true,
        safetyTier: true,
        status: true,
        reasonText: true,
        timingSummary: true,
        sourceSummary: true
      }
    });
    const itemIds = items.map((item) => item.id);
    const [evidence, approvals, primaryCategories, lifecycleRules] = await Promise.all([
      this.prisma.itemEvidenceSource.findMany({
        where: {
          itemDefinitionId: { in: itemIds },
          ...currentReviewedEvidenceWhere(now)
        },
        select: {
          itemDefinitionId: true,
          revision: true,
          capturedByAdminId: true,
          reviewedByAdminId: true
        }
      }),
      this.prisma.catalogItemApproval.findMany({
        where: {
          itemDefinitionId: { in: itemIds },
          approvalType: { in: ["editorial", "domain"] }
        },
        select: {
          itemDefinitionId: true,
          revision: true,
          contentHash: true,
          approvalType: true,
          reviewedByAdminId: true,
          expiresAt: true
        }
      }),
      this.prisma.itemDefinitionCategory.findMany({
        where: { itemDefinitionId: { in: itemIds }, isPrimary: true },
        select: { itemDefinitionId: true }
      }),
      this.prisma.itemLifecycleRule.findMany({
        where: { itemDefinitionId: { in: itemIds } },
        select: { itemDefinitionId: true }
      })
    ]);
    const evidenceKeys = new Set(
      evidence
        .filter(evidenceHasIndependentCaptureAndReview)
        .map((row) => `${row.itemDefinitionId}:${row.revision}`)
    );
    const approvalReviewerIds = [...new Set(approvals.map((approval) => approval.reviewedByAdminId))];
    const [activeApprovalReviewers, activeApprovalCredentials] = await Promise.all([
      this.prisma.adminUser.findMany({
        where: { id: { in: approvalReviewerIds }, active: true, disabledAt: null },
        select: { id: true }
      }),
      this.prisma.catalogReviewerCredential.findMany({
        where: {
          adminId: { in: approvalReviewerIds },
          approvalType: { in: ["editorial", "domain"] },
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        select: { adminId: true, approvalType: true }
      })
    ]);
    const activeApprovalReviewerIds = new Set(activeApprovalReviewers.map((reviewer) => reviewer.id));
    const activeApprovalCredentialKeys = new Set(
      activeApprovalCredentials.map((credential) => `${credential.adminId}:${credential.approvalType}`)
    );
    const currentQualifiedApprovals = approvals
        .filter((row) =>
          (!row.expiresAt || row.expiresAt > now) &&
          activeApprovalReviewerIds.has(row.reviewedByAdminId) &&
          activeApprovalCredentialKeys.has(`${row.reviewedByAdminId}:${row.approvalType}`)
        );
    const approvalKeys = new Set(
      currentQualifiedApprovals.map((row) =>
        `${row.itemDefinitionId}:${row.revision}:${row.contentHash}:${row.approvalType}`
      )
    );
    const approvalReviewerByKey = new Map(
      currentQualifiedApprovals.map((row) => [
        `${row.itemDefinitionId}:${row.revision}:${row.contentHash}:${row.approvalType}`,
        row.reviewedByAdminId
      ])
    );
    const primaryCategoryCounts = new Map<string, number>();
    const lifecycleCounts = new Map<string, number>();
    for (const row of primaryCategories) {
      primaryCategoryCounts.set(row.itemDefinitionId, (primaryCategoryCounts.get(row.itemDefinitionId) ?? 0) + 1);
    }
    for (const row of lifecycleRules) {
      lifecycleCounts.set(row.itemDefinitionId, (lifecycleCounts.get(row.itemDefinitionId) ?? 0) + 1);
    }
    const worklist = items.map((item) => {
      const evidenceReady = evidenceKeys.has(`${item.id}:${item.contentVersion}`);
      const editorialApproved = Boolean(
        item.contentHash &&
        approvalKeys.has(`${item.id}:${item.contentVersion}:${item.contentHash}:editorial`)
      );
      const domainApproved = Boolean(
        item.contentHash &&
        approvalKeys.has(`${item.id}:${item.contentVersion}:${item.contentHash}:domain`)
      );
      const editorialReviewerId = item.contentHash
        ? approvalReviewerByKey.get(`${item.id}:${item.contentVersion}:${item.contentHash}:editorial`)
        : undefined;
      const domainReviewerId = item.contentHash
        ? approvalReviewerByKey.get(`${item.id}:${item.contentVersion}:${item.contentHash}:domain`)
        : undefined;
      const approvalReviewersIndependent = Boolean(
        editorialReviewerId &&
        domainReviewerId &&
        editorialReviewerId !== domainReviewerId
      );
      const structureReady = Boolean(
        item.reasonText.trim() &&
        item.timingSummary.trim() &&
        item.sourceSummary.trim() &&
        primaryCategoryCounts.get(item.id) === 1 &&
        (lifecycleCounts.get(item.id) ?? 0) > 0
      );
      const ready = item.status === "approved" &&
        structureReady &&
        evidenceReady &&
        editorialApproved &&
        domainApproved &&
        approvalReviewersIndependent;
      return {
        ...item,
        structureReady,
        evidenceReady,
        editorialApproved,
        domainApproved,
        approvalReviewersIndependent,
        ready
      };
    });
    return {
      counts: {
        candidates: worklist.length,
        ready: worklist.filter((item) => item.ready).length,
        notApproved: worklist.filter((item) => item.status !== "approved").length,
        missingStructure: worklist.filter((item) => !item.structureReady).length,
        missingEvidence: worklist.filter((item) => !item.evidenceReady).length,
        missingEditorialApproval: worklist.filter((item) => !item.editorialApproved).length,
        missingDomainApproval: worklist.filter((item) => !item.domainApproved).length,
        missingApprovalReviewerSeparation: worklist.filter((item) => !item.approvalReviewersIndependent).length
      },
      items: worklist
    };
  }

  async previewPilotManifest(adminId: string, input: PreviewPilotManifestDto) {
    const worklist = await this.pilotWorklist();
    const requested = new Set(input.itemIds);
    if (requested.size === 0) {
      throw new BadRequestException({ code: "PILOT_MANIFEST_EMPTY", message: "At least one ready item is required." });
    }
    const selected = worklist.items.filter((item) => item.ready && requested.has(item.id));
    if (selected.length !== requested.size) {
      throw new BadRequestException({
        code: "PILOT_MANIFEST_NOT_READY",
        message: "Every requested item must be approved, structurally complete, independently evidenced, and current."
      });
    }
    const expected = selected.map((item) => ({ id: item.id, revision: item.contentVersion, contentHash: item.contentHash! }));
    const contentHash = sha256(expected);
    return this.prisma.catalogPilotManifest.create({
      data: {
        createdByAdminId: adminId,
        contentHash,
        itemIds: expected.map((item) => item.id),
        expectedRevisionsJson: expected
      }
    });
  }

  async publishPilotManifest(adminId: string, manifestId: string, input: PublishPilotManifestDto) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.catalogPilotManifest.updateMany({
        where: { id: manifestId, status: "preview", contentHash: input.expectedContentHash },
        data: { status: "applying" }
      });
      if (claimed.count !== 1) throw new ConflictException({ code: "PILOT_MANIFEST_CONFLICT", message: "Pilot manifest changed or was already applied." });
      const manifest = await tx.catalogPilotManifest.findUniqueOrThrow({ where: { id: manifestId } });
      const expected = pilotManifestRows(manifest.expectedRevisionsJson);
      if (
        !expected ||
        sha256(expected) !== manifest.contentHash ||
        JSON.stringify(expected.map((row) => row.id)) !== JSON.stringify(manifest.itemIds)
      ) {
        throw new ConflictException({
          code: "PILOT_MANIFEST_INTEGRITY",
          message: "Pilot manifest rows, item IDs, or content hash do not match."
        });
      }
      const publisher = await tx.adminUser.findUnique({ where: { id: adminId } });
      if (!publisher || !publisher.active || publisher.disabledAt || publisher.role !== "admin") {
        throw new ForbiddenException({ code: "CATALOG_ADMIN_INACTIVE", message: "An active admin publisher is required." });
      }
      const published: string[] = [];
      for (const row of expected) {
        const [item, approvals, evidence, primaryCategoryCount, lifecycleCount] = await Promise.all([
          tx.itemDefinition.findUnique({ where: { id: row.id } }),
          tx.catalogItemApproval.findMany({
            where: {
              itemDefinitionId: row.id,
              revision: row.revision,
              contentHash: row.contentHash,
              approvalType: { in: ["editorial", "domain"] }
            }
          }),
          tx.itemEvidenceSource.findMany({
            where: {
              itemDefinitionId: row.id,
              revision: row.revision,
              ...currentReviewedEvidenceWhere(now)
            },
            select: { capturedByAdminId: true, reviewedByAdminId: true }
          }),
          tx.itemDefinitionCategory.count({ where: { itemDefinitionId: row.id, isPrimary: true } }),
          tx.itemLifecycleRule.count({ where: { itemDefinitionId: row.id } })
        ]);
        const evidenceReady = evidence.some(evidenceHasIndependentCaptureAndReview);
        const structureReady = Boolean(
          item &&
          item.reasonText.trim() &&
          item.timingSummary.trim() &&
          item.sourceSummary.trim() &&
          primaryCategoryCount === 1 &&
          lifecycleCount > 0
        );
        if (
          !item ||
          item.status !== "approved" ||
          item.contentVersion !== row.revision ||
          item.contentHash !== row.contentHash ||
          item.safetyTier !== "normal" ||
          !structureReady ||
          !evidenceReady
        ) {
          throw new BadRequestException({ code: "PILOT_PUBLISH_GATE_FAILED", message: "A pilot item no longer satisfies the publish manifest." });
        }
        const currentApprovals = approvals.filter((approval) => !approval.expiresAt || approval.expiresAt > now);
        if (!currentApprovals.some((approval) => approval.approvalType === "editorial")) {
          throw new BadRequestException({ code: "PILOT_EDITORIAL_APPROVAL_REQUIRED", message: "Current editorial approval is required." });
        }
        if (!currentApprovals.some((approval) => approval.approvalType === "domain")) {
          throw new BadRequestException({ code: "PILOT_DOMAIN_APPROVAL_REQUIRED", message: "Current domain approval is required." });
        }
        const editorialReviewerId = currentApprovals.find(
          (approval) => approval.approvalType === "editorial"
        )!.reviewedByAdminId;
        const domainReviewerId = currentApprovals.find(
          (approval) => approval.approvalType === "domain"
        )!.reviewedByAdminId;
        if (editorialReviewerId === domainReviewerId) {
          throw new ForbiddenException({
            code: "PILOT_APPROVAL_REVIEWER_SEPARATION_REQUIRED",
            message: "Editorial and domain approvals require different reviewers."
          });
        }
        const reviewerIds = [...new Set(currentApprovals.map((approval) => approval.reviewedByAdminId))];
        const [activeReviewers, activeCredentials] = await Promise.all([
          tx.adminUser.findMany({
            where: { id: { in: reviewerIds }, active: true, disabledAt: null },
            select: { id: true }
          }),
          tx.catalogReviewerCredential.findMany({
            where: {
              adminId: { in: reviewerIds },
              approvalType: { in: ["editorial", "domain"] },
              active: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            },
            select: { adminId: true, approvalType: true }
          })
        ]);
        const activeReviewerIds = new Set(activeReviewers.map((reviewer) => reviewer.id));
        const credentialKeys = new Set(activeCredentials.map((credential) => `${credential.adminId}:${credential.approvalType}`));
        if (currentApprovals.some((approval) =>
          !activeReviewerIds.has(approval.reviewedByAdminId) ||
          !credentialKeys.has(`${approval.reviewedByAdminId}:${approval.approvalType}`)
        )) {
          throw new ForbiddenException({
            code: "PILOT_REVIEWER_CREDENTIAL_REQUIRED",
            message: "Every current approval requires an active matching reviewer credential."
          });
        }
        const participants = new Set([
          item.lastEditedByAdminId,
          ...currentApprovals.map((approval) => approval.reviewedByAdminId),
          ...evidence.flatMap((source) => [source.capturedByAdminId, source.reviewedByAdminId])
        ].filter(Boolean));
        if (participants.has(adminId)) throw new ForbiddenException({ code: "CATALOG_PUBLISHER_SEPARATION_REQUIRED", message: "The publisher must be independent." });
        const changed = await tx.itemDefinition.updateMany({
          where: { id: row.id, status: "approved", contentVersion: row.revision, contentHash: row.contentHash },
          data: { status: "published", publishedByAdminId: adminId, publishedAt: new Date(), scheduledAt: null }
        });
        if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_PUBLISH_CONFLICT", message: "A catalog item changed during tranche publication." });
        await tx.catalogItemWorkflowEvent.create({
          data: {
            itemDefinitionId: row.id,
            actorAdminId: adminId,
            revision: row.revision,
            contentHash: row.contentHash,
            fromStatus: "approved" as CatalogReviewStatus,
            toStatus: "published",
            metadataJson: { pilotManifestId: manifest.id }
          }
        });
        published.push(row.id);
      }
      return tx.catalogPilotManifest.update({
        where: { id: manifest.id },
        data: { status: "published", appliedAt: new Date(), resultJson: { published } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
