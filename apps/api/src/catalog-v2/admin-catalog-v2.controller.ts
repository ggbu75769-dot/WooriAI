import { BadRequestException, Body, Controller, Get, Header, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createDtoValidationPipe } from "../bootstrap";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { RequireAdminRoles } from "../admin/require-admin-roles.decorator";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogV2Service } from "./catalog-v2.service";
import { CatalogImportWorkflowService } from "./catalog-import-workflow.service";
import { AdminListCatalogItemsDto, ApplyCatalogImportDto, ApproveProductOfferDto, ArchiveCatalogNodeDto, BlockProductOfferDto, CatalogNodeReorderDto, CleanupCatalogImportOrphanDto, CreateCatalogImportDto, CreateCatalogNodeDto, CreateProductOfferDto, PreviewCatalogApprovalManifestDto, PreviewCatalogImportDto, PublishCatalogItemDto, ReconcileCatalogImportsDto, RepairCatalogImportDto, ReplaceCatalogAliasesDto, ReplaceCatalogMappingsDto, RequestCatalogItemReviewDto, ResolveCatalogItemReportDto, ResolveCatalogItemReportsDto, ReviewCatalogItemDto, RollbackCatalogItemDto, TransitionCatalogItemDto, UpdateCatalogItemDraftDto, UpdateCatalogNodeDto } from "./dto/catalog-v2.dto";

function catalogImportResponse<T extends { objectSizeBytes?: bigint | null }>(catalogImport: T) {
  return {
    ...catalogImport,
    objectSizeBytes: catalogImport.objectSizeBytes === null || catalogImport.objectSizeBytes === undefined
      ? null
      : Number(catalogImport.objectSizeBytes)
  };
}

@Controller("admin/catalog")
@UseGuards(AdminAuthGuard)
export class AdminCatalogV2Controller {
  constructor(
    @Inject(CatalogV2Service) private readonly catalog: CatalogV2Service,
    @Inject(CatalogImportWorkflowService) private readonly importWorkflow: CatalogImportWorkflowService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get("coverage")
  coverage() {
    return this.catalog.adminCoverage();
  }

  @Get("taxonomy/tree")
  taxonomyTree() {
    return this.catalog.adminTaxonomyTree();
  }

  @Post("taxonomy/nodes")
  @RequireAdminRoles("admin", "editor")
  async createTaxonomyNode(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CreateCatalogNodeDto)) body: CreateCatalogNodeDto) {
    const result = await this.catalog.createCatalogNode(body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.taxonomy.create", targetType: "catalog_node", targetId: result.id, after: { code: result.code, level: result.level, parentId: result.parentId } });
    return result;
  }

  @Patch("taxonomy/nodes/:id")
  @RequireAdminRoles("admin", "editor")
  async updateTaxonomyNode(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(UpdateCatalogNodeDto)) body: UpdateCatalogNodeDto) {
    const result = await this.catalog.updateCatalogNode(id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.taxonomy.update", targetType: "catalog_node", targetId: id, after: { ...body, version: result.version } });
    return result;
  }

  @Post("taxonomy/nodes/:id/archive-preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  archiveTaxonomyNodePreview(@Param("id") id: string) {
    return this.catalog.previewCatalogNodeArchive(id);
  }

  @Post("taxonomy/nodes/:id/archive")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async archiveTaxonomyNode(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ArchiveCatalogNodeDto)) body: ArchiveCatalogNodeDto) {
    const result = await this.catalog.archiveCatalogNode(id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.taxonomy.archive", targetType: "catalog_node", targetId: id, after: { code: result.code, version: result.version } });
    return result;
  }

  @Post("taxonomy/reorder-preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  reorderTaxonomyPreview(@Body(createDtoValidationPipe(CatalogNodeReorderDto)) body: CatalogNodeReorderDto) {
    return this.catalog.previewCatalogNodeReorder(body);
  }

  @Post("taxonomy/reorder")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async reorderTaxonomy(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CatalogNodeReorderDto)) body: CatalogNodeReorderDto) {
    const result = await this.catalog.applyCatalogNodeReorder(body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.taxonomy.reorder", targetType: "catalog_node_parent", targetId: body.parentId ?? "root", after: { appliedCount: result.appliedCount, changes: result.changes } });
    return result;
  }

  @Get("items")
  items(@Query(createDtoValidationPipe(AdminListCatalogItemsDto)) query: AdminListCatalogItemsDto) {
    return this.catalog.adminListItems(query);
  }

  @Get("items/:id")
  item(@Param("id") id: string) {
    return this.catalog.adminItem(id);
  }

  @Get("items/:id/revisions")
  revisions(@Param("id") id: string) {
    return this.catalog.itemRevisions(id);
  }

  @Post("items/:id/revisions/:revision/rollback-preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  previewRollback(@Param("id") id: string, @Param("revision") revision: string, @Body(createDtoValidationPipe(RollbackCatalogItemDto)) body: RollbackCatalogItemDto) {
    return this.catalog.previewItemRollback(id, Number(revision), body);
  }

  @Post("items/:id/revisions/:revision/rollback")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async rollback(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Param("revision") revision: string, @Body(createDtoValidationPipe(RollbackCatalogItemDto)) body: RollbackCatalogItemDto) {
    const result = await this.catalog.rollbackItemAsNewRevision(request.adminUser!.id, id, Number(revision), body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.rollback_as_new_revision", targetType: "item_definition", targetId: id, after: { sourceRevision: Number(revision), resultRevision: result.item.contentVersion } });
    return result;
  }

  @Get("queues")
  queues() {
    return this.catalog.adminQueues();
  }

  @Post("imports")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async createImport(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CreateCatalogImportDto)) body: CreateCatalogImportDto) {
    const existing = await this.prisma.catalogImport.findUnique({ where: { sourceHash: body.sourceHash } });
    if (existing) return { ...catalogImportResponse(existing), idempotent: true };
    const result = await this.prisma.catalogImport.create({
      data: { requestedByAdminId: request.adminUser!.id, sourceName: body.sourceName, sourceHash: body.sourceHash, rowCount: body.rowCount, state: "uploaded" }
    });
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.import.create", targetType: "catalog_import", targetId: result.id });
    return catalogImportResponse(result);
  }

  @Post("imports/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async previewImport(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(PreviewCatalogImportDto)) body: PreviewCatalogImportDto) {
    const result = await this.catalog.previewDraftImport(request.adminUser!.id, body);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "catalog.import.preview",
      targetType: "catalog_import",
      targetId: result.import.id,
      after: { valid: result.preview.summary.valid, invalid: result.preview.summary.invalid }
    });
    return { ...result, import: catalogImportResponse(result.import) };
  }

  @Post("imports/file-preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  @UseInterceptors(FileInterceptor("file", { limits: { files: 1, fileSize: 2 * 1024 * 1024 } }))
  async previewImportFile(@Req() request: AuthenticatedRequest, @UploadedFile() file: { originalname?: string; buffer?: Buffer } | undefined) {
    if (!file?.buffer || !file.originalname) throw new BadRequestException({ code: "CATALOG_IMPORT_FILE_REQUIRED", message: "A CSV or XLSX file is required." });
    const result = await this.importWorkflow.previewFile(request.adminUser!.id, { originalname: file.originalname, buffer: file.buffer });
    const preview = result.preview as { summary?: { valid?: number; invalid?: number } };
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.import.file_preview", targetType: "catalog_import", targetId: result.import.id, after: { sourceName: file.originalname, valid: preview.summary?.valid ?? 0, invalid: preview.summary?.invalid ?? 0 } });
    return { ...result, import: catalogImportResponse(result.import) };
  }

  @Post("imports/reconciliation/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor", "analyst")
  async reconcileImports(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(ReconcileCatalogImportsDto)) body: ReconcileCatalogImportsDto) {
    const result = await this.importWorkflow.reconcile(body.dryRun);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.import.reconciliation_preview", targetType: "catalog_import", targetId: "reconciliation", after: { scanned: result.scanned, orphan: result.orphanObjects.length, missing: result.missingObjectJobs.length } });
    return result;
  }

  @Post("imports/:id/reconcile")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async repairImport(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(RepairCatalogImportDto)) body: RepairCatalogImportDto) {
    const result = await this.importWorkflow.repairImport(id, body.expectedVersion);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.import.reconcile", targetType: "catalog_import", targetId: id, after: { state: result.state, version: result.version } });
    return catalogImportResponse(result);
  }

  @Post("imports/reconciliation/orphans/cleanup")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async cleanupOrphan(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CleanupCatalogImportOrphanDto)) body: CleanupCatalogImportOrphanDto) {
    const result = await this.importWorkflow.cleanupOrphan(body.objectKey);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.import.orphan_cleanup", targetType: "catalog_import_object", targetId: null, after: { objectKeyHash: body.objectKey.split("/").pop()?.split(".")[0] } });
    return result;
  }

  @Post("imports/approval-manifest/preview")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async previewApprovalManifest(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(PreviewCatalogApprovalManifestDto)) body: PreviewCatalogApprovalManifestDto) {
    const result = await this.catalog.previewApprovalManifest(request.adminUser!.id, body);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "catalog.approval_manifest.preview",
      targetType: "catalog_import",
      targetId: result.import.id,
      after: { manifestId: body.manifestId, valid: result.preview.summary.valid, invalid: result.preview.summary.invalid }
    });
    return { ...result, import: catalogImportResponse(result.import) };
  }

  @Post("imports/:id/approval-manifest/apply")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async applyApprovalManifest(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const result = await this.catalog.applyApprovalManifest(request.adminUser!.id, id);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "catalog.approval_manifest.apply",
      targetType: "catalog_import",
      targetId: id,
      after: { applied: result.applied, failed: result.failed, idempotent: result.idempotent }
    });
    return result;
  }

  @Post("imports/:id/apply")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async applyImport(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ApplyCatalogImportDto)) body: ApplyCatalogImportDto) {
    const result = await this.importWorkflow.apply(request.adminUser!.id, id, body);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "catalog.import.apply",
      targetType: "catalog_import",
      targetId: id,
      after: { appliedCount: result.appliedCount, rowNumbers: result.appliedRowNumbers }
    });
    return { ...result, import: catalogImportResponse(result.import) };
  }

  @Get("imports/:id/errors.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=catalog-import-errors.csv")
  errorsCsv(@Param("id") id: string) {
    return this.catalog.importErrorsCsv(id);
  }

  @Patch("items/:id/draft")
  @RequireAdminRoles("admin", "editor")
  async updateDraft(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(UpdateCatalogItemDraftDto)) body: UpdateCatalogItemDraftDto) {
    const result = await this.catalog.updateItemDraft(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.draft_update", targetType: "item_definition", targetId: id, after: { ...body } });
    return result;
  }

  @Put("items/:id/aliases")
  @RequireAdminRoles("admin", "editor")
  async aliases(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ReplaceCatalogAliasesDto)) body: ReplaceCatalogAliasesDto) {
    const result = await this.catalog.replaceAliases(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.aliases_replace", targetType: "item_definition", targetId: id, after: { count: body.aliases.length } });
    return result;
  }

  @Put("items/:id/mappings")
  @RequireAdminRoles("admin", "editor")
  async mappings(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ReplaceCatalogMappingsDto)) body: ReplaceCatalogMappingsDto) {
    const result = await this.catalog.replaceMappings(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.mappings_replace", targetType: "item_definition", targetId: id, after: { lifecycleCount: body.lifecycles.length, contextCount: body.contextCodes.length } });
    return result;
  }

  @Post("items/:id/offers")
  @RequireAdminRoles("admin", "editor")
  async offer(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(CreateProductOfferDto)) body: CreateProductOfferDto) {
    const result = await this.catalog.createOffer(id, body, request.adminUser!.id);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.offer.create_inactive", targetType: "product_offer", targetId: result.id, after: { itemId: id, affiliate: result.isAffiliate, sponsored: result.isSponsored } });
    return result;
  }

  @Post("offers/:id/approve")
  @RequireAdminRoles("admin")
  async approveOffer(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ApproveProductOfferDto)) body: ApproveProductOfferDto) {
    const result = await this.catalog.approveOffer(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.offer.approve", targetType: "product_offer", targetId: id, after: { approvedAt: result.approvedAt } });
    return result;
  }

  @Post("offers/:id/block")
  @RequireAdminRoles("admin")
  async blockOffer(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(BlockProductOfferDto)) body: BlockProductOfferDto) {
    const result = await this.catalog.blockOffer(id, body.reason);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.offer.block", targetType: "product_offer", targetId: id, after: { reason: body.reason } });
    return result;
  }

  @Post("offers/:id/retry-health-check")
  @HttpCode(202)
  @RequireAdminRoles("admin")
  async retryOfferHealth(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const result = await this.catalog.retryOfferHealthCheck(id);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.offer.health_retry", targetType: "product_offer", targetId: id, after: result });
    return result;
  }

  @Post("reports/resolve-batch")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async resolveReports(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(ResolveCatalogItemReportsDto)) body: ResolveCatalogItemReportsDto) {
    const result = await this.catalog.resolveItemReports(request.adminUser!.id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item_reports.resolve_batch", targetType: "catalog_item_report", targetId: result.reportIds[0]!, after: { resolvedCount: result.resolvedCount, reportIds: result.reportIds, note: body.note ?? null } });
    return result;
  }

  @Post("reports/:id/resolve")
  @RequireAdminRoles("admin", "editor")
  async resolveReport(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(ResolveCatalogItemReportDto)) body: ResolveCatalogItemReportDto) {
    const result = await this.catalog.resolveItemReport(request.adminUser!.id, id);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item_report.resolve", targetType: "catalog_item_report", targetId: id, after: { note: body.note ?? null } });
    return result;
  }

  @Get("imports/:id")
  async import(@Param("id") id: string) {
    return await this.prisma.catalogImport.findUniqueOrThrow({ where: { id } });
  }

  @Post("items/:id/review")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async review(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(ReviewCatalogItemDto)) body: ReviewCatalogItemDto
  ) {
    const result = await this.catalog.reviewItem(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.review", targetType: "item_definition", targetId: id });
    return result;
  }

  @Post("items/:id/request-review")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async requestReview(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(RequestCatalogItemReviewDto)) body: RequestCatalogItemReviewDto
  ) {
    const result = await this.catalog.requestItemReview(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.review_request", targetType: "item_definition", targetId: id, after: { version: result.contentVersion, contentHash: result.contentHash } });
    return result;
  }

  @Post("items/:id/transition")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async transition(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(TransitionCatalogItemDto)) body: TransitionCatalogItemDto
  ) {
    const result = await this.catalog.transitionItem(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.transition", targetType: "item_definition", targetId: id, after: { toStatus: result.status, version: result.contentVersion } });
    return result;
  }

  @Post("items/:id/publish")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async publish(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body(createDtoValidationPipe(PublishCatalogItemDto)) body: PublishCatalogItemDto) {
    const result = await this.catalog.publishItem(request.adminUser!.id, id, body);
    await this.audit.record({ actorUserId: request.adminUser!.id, action: "catalog.item.publish", targetType: "item_definition", targetId: id });
    return result;
  }
}
