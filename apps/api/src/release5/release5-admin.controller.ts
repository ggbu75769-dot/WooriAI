import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { RequireAdminRoles } from "../admin/require-admin-roles.decorator";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import {
  ApproveLegalDocumentDto,
  CreateEvidenceSourceDto,
  LegalDocumentCandidateDto,
  PreviewPilotManifestDto,
  PublishLegalDocumentDto,
  PublishPilotManifestDto,
  ReviewEvidenceSourceDto
} from "./dto/release5-readiness.dto";
import { Release5ReadinessService } from "./release5-readiness.service";
import { ApproveSafetyAlternativeDto, PreviewMerchantFeedDto, ReviewMerchantFeedRowDto, ReviewRecallEventDto } from "./dto/release5-external.dto";
import { Release5ExternalService } from "./release5-external.service";

@Controller("admin/release5")
@UseGuards(AdminAuthGuard)
export class Release5AdminController {
  constructor(
    @Inject(Release5ReadinessService) private readonly readiness: Release5ReadinessService,
    @Inject(Release5ExternalService) private readonly external: Release5ExternalService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Post("legal/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  legalPreview(@Body(createDtoValidationPipe(LegalDocumentCandidateDto)) body: LegalDocumentCandidateDto) {
    return this.readiness.legalPreview(body);
  }

  @Post("legal/documents")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async importLegal(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(LegalDocumentCandidateDto)) body: LegalDocumentCandidateDto) {
    const result = await this.readiness.importLegal(request.adminUser!.id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.legal.import", targetType: "legal_document", targetId: result.id, after: { version: result.version, contentHash: result.contentHash } });
    return result;
  }

  @Post("legal/documents/:id/approve")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async approveLegal(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ApproveLegalDocumentDto)) body: ApproveLegalDocumentDto) {
    const result = await this.readiness.approveLegal(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.legal.approve", targetType: "legal_document", targetId: id, after: { revision: result.revision } });
    return result;
  }

  @Post("legal/documents/:id/publish")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async publishLegal(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(PublishLegalDocumentDto)) body: PublishLegalDocumentDto) {
    const result = await this.readiness.publishLegal(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.legal.publish", targetType: "legal_document", targetId: id, after: { revision: result.revision } });
    return result;
  }

  @Post("catalog/items/:itemId/evidence")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async createEvidence(@Req() request: AuthenticatedRequest, @Param("itemId") itemId: string, @Body(createDtoValidationPipe(CreateEvidenceSourceDto)) body: CreateEvidenceSourceDto) {
    const result = await this.readiness.createEvidence(request.adminUser!.id, itemId, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.catalog.evidence.capture", targetType: "item_evidence_source", targetId: result.id, after: { itemId, revision: result.revision, contentHash: result.contentHash } });
    return result;
  }

  @Post("catalog/evidence/:id/review")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async reviewEvidence(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ReviewEvidenceSourceDto)) body: ReviewEvidenceSourceDto) {
    const result = await this.readiness.reviewEvidence(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.catalog.evidence.review", targetType: "item_evidence_source", targetId: id, after: { status: result.status } });
    return result;
  }

  @Get("catalog/pilot-worklist")
  @RequireAdminRoles("admin", "editor", "analyst")
  pilotWorklist() {
    return this.readiness.pilotWorklist();
  }

  @Post("catalog/pilot-manifests/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async previewPilot(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(PreviewPilotManifestDto)) body: PreviewPilotManifestDto) {
    const result = await this.readiness.previewPilotManifest(request.adminUser!.id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.catalog.pilot.preview", targetType: "catalog_pilot_manifest", targetId: result.id, after: { contentHash: result.contentHash, itemCount: result.itemIds.length } });
    return result;
  }

  @Post("catalog/pilot-manifests/:id/publish")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async publishPilot(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(PublishPilotManifestDto)) body: PublishPilotManifestDto) {
    const result = await this.readiness.publishPilotManifest(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.catalog.pilot.publish", targetType: "catalog_pilot_manifest", targetId: id, after: { status: result.status } });
    return result;
  }

  @Get("external/recalls/worklist")
  @RequireAdminRoles("admin", "editor", "analyst")
  recallWorklist() {
    return this.external.recallWorklist();
  }

  @Post("external/recalls/:id/review")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async reviewRecall(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ReviewRecallEventDto)) body: ReviewRecallEventDto) {
    const result = await this.external.reviewRecall(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.recall.review", targetType: "recall_provider_event", targetId: id, after: { reviewState: result.reviewState, eventStatus: result.eventStatus } });
    return result;
  }

  @Post("external/merchant-feeds/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async previewMerchantFeed(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(PreviewMerchantFeedDto)) body: PreviewMerchantFeedDto) {
    const result = await this.external.previewMerchantFeed(request.adminUser!.id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.merchant.preview", targetType: "merchant_feed_import", targetId: result.import.id, after: { state: result.import.state, rowCount: result.rows.length, duplicate: result.duplicate } });
    return result;
  }

  @Post("external/merchant-feed-rows/:id/review")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async reviewMerchantFeedRow(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ReviewMerchantFeedRowDto)) body: ReviewMerchantFeedRowDto) {
    const result = await this.external.reviewMerchantRow(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.merchant.review", targetType: "merchant_feed_row", targetId: id, after: { reviewState: result.reviewState } });
    return result;
  }

  @Post("external/merchant-feed-rows/:id/publish")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async publishMerchantFeedRow(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const result = await this.external.publishMerchantRow(request.adminUser!.id, id);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.merchant.publish", targetType: "merchant_feed_row", targetId: id, after: { productOfferId: result.offer.id, public: result.public, blockers: result.blockers } });
    return result;
  }

  @Post("catalog/items/:itemId/safety-alternatives/approve")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async approveSafetyAlternative(@Req() request: AuthenticatedRequest, @Param("itemId") itemId: string, @Body(createDtoValidationPipe(ApproveSafetyAlternativeDto)) body: ApproveSafetyAlternativeDto) {
    const result = await this.external.approveSafetyAlternative(request.adminUser!.id, itemId, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "release5.safety-alternative.approve", targetType: "item_alternative", targetId: `${result.itemDefinitionId}:${result.alternativeItemDefinitionId}`, after: { alternativeItemDefinitionId: result.alternativeItemDefinitionId } });
    return result;
  }
}
