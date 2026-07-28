import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Response } from "express";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CatalogV2Service } from "./catalog-v2.service";
import { AcknowledgeCatalogSafetyAlertDto, ApplyCatalogBundleDto, BulkItemPlanDto, CatalogItemContextDto, CatalogItemReportDto, CatalogMissingItemReportDto, CatalogSearchDto, CreateItemPlanCommentDto, ListCatalogItemsDto, UpdateItemPlanDto, UpdatePreparationContextDto } from "./dto/catalog-v2.dto";

function setEtag(response: Response, value: unknown) {
  const etag = `"${createHash("sha256").update(JSON.stringify(value)).digest("base64url")}"`;
  response.setHeader("ETag", etag);
  response.setHeader("Cache-Control", "private, max-age=60");
}

@Controller("catalog")
@UseGuards(JwtAuthGuard)
export class CatalogV2Controller {
  constructor(
    @Inject(CatalogV2Service) private readonly catalog: CatalogV2Service,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get("domains")
  async domains(@Res({ passthrough: true }) response: Response) {
    const result = await this.catalog.domains();
    setEtag(response, result);
    return result;
  }

  @Get("contexts")
  contexts(@Req() request: AuthenticatedRequest) {
    return this.catalog.contexts(request.user!);
  }

  @Get("items")
  async items(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(ListCatalogItemsDto)) query: ListCatalogItemsDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.catalog.listItems(request.user!, query);
    setEtag(response, result);
    return result;
  }

  @Get("items/:id")
  async item(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Query(createDtoValidationPipe(CatalogItemContextDto)) context: CatalogItemContextDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.catalog.itemDetail(request.user!, id, context);
    setEtag(response, result);
    return result;
  }

  @Get("items/:id/comparison")
  async comparison(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.catalog.itemComparison(request.user!, id);
    setEtag(response, result);
    return result;
  }

  @Get("search")
  async search(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(CatalogSearchDto)) query: CatalogSearchDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.catalog.listItems(request.user!, query);
    setEtag(response, result);
    return result;
  }

  @Get("bundles")
  async bundles(
    @Req() request: AuthenticatedRequest,
    @Query("childId") childId: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.catalog.bundles(request.user!, childId);
    setEtag(response, result);
    return result;
  }

  @Post("bundles/:bundleId/apply")
  async applyBundle(
    @Req() request: AuthenticatedRequest,
    @Param("bundleId") bundleId: string,
    @Query("childId") childId: string,
    @Body(createDtoValidationPipe(ApplyCatalogBundleDto)) body: ApplyCatalogBundleDto
  ) {
    const result = await this.catalog.applyBundle(request.user!, childId, bundleId, body);
    await this.audit.record({ actorUserId: request.user!.id, action: body.dryRun ? "catalog.bundle.apply_preview" : "catalog.bundle.apply", targetType: "item_bundle", targetId: bundleId, after: { childId, selectedCount: body.items.length, appliedCount: result.appliedCount } });
    return result;
  }

  @Get("timeline")
  async timeline(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(CatalogItemContextDto)) query: CatalogItemContextDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.catalog.timeline(request.user!, query);
    setEtag(response, result);
    return result;
  }

  @Get("preparation-context")
  preparationContext(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(CatalogItemContextDto)) query: CatalogItemContextDto
  ) {
    return this.catalog.preparationContext(request.user!, query);
  }

  @Put("preparation-context")
  async updatePreparationContext(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(CatalogItemContextDto)) query: CatalogItemContextDto,
    @Body(createDtoValidationPipe(UpdatePreparationContextDto)) body: UpdatePreparationContextDto
  ) {
    const result = await this.catalog.updatePreparationContext(request.user!, query, body);
    await this.audit.record({ actorUserId: request.user!.id, action: "catalog.preparation_context.update", targetType: query.childId ? "child" : "mother_profile", targetId: query.childId ?? query.motherProfileId!, after: { contextCodes: result.contextCodes, version: result.version } });
    return result;
  }

  @Get("coverage-summary")
  async coverage(@Res({ passthrough: true }) response: Response) {
    const result = await this.catalog.coverageSummary();
    setEtag(response, result);
    return result;
  }

  @Get("safety-alerts")
  safetyAlerts(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(CatalogItemContextDto)) query: CatalogItemContextDto) {
    return this.catalog.safetyAlerts(request.user!, query);
  }

  @Post("safety-alerts/:alertId/acknowledge")
  async acknowledgeSafetyAlert(
    @Req() request: AuthenticatedRequest,
    @Param("alertId") alertId: string,
    @Body(createDtoValidationPipe(AcknowledgeCatalogSafetyAlertDto)) body: AcknowledgeCatalogSafetyAlertDto
  ) {
    const result = await this.catalog.acknowledgeSafetyAlert(request.user!, alertId, body.expectedVersion);
    await this.audit.record({ actorUserId: request.user!.id, action: "catalog.safety_alert.acknowledge", targetType: "catalog_safety_alert", targetId: alertId, after: { version: result.version } });
    return result;
  }

  @Post("items/:id/report")
  async report(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(CatalogItemReportDto)) body: CatalogItemReportDto
  ) {
    const result = await this.catalog.reportItem(request.user!, id, body.reasonCode, body.detail);
    await this.audit.record({ actorUserId: request.user!.id, action: "catalog.item.report", targetType: "item_definition", targetId: id });
    return result;
  }

  @Post("missing-item-reports")
  async reportMissingItem(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CatalogMissingItemReportDto)) body: CatalogMissingItemReportDto) {
    const result = await this.catalog.reportMissingItem(request.user!, body.requestedName, body.detail);
    await this.audit.record({ actorUserId: request.user!.id, action: "catalog.missing_item.report", targetType: "catalog_item_report", targetId: result.report.id, after: { idempotent: result.idempotent } });
    return result;
  }
}

@Controller("mother-profiles/:motherProfileId/item-plans")
@UseGuards(JwtAuthGuard)
export class MotherItemPlansController {
  constructor(
    @Inject(CatalogV2Service) private readonly catalog: CatalogV2Service,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("motherProfileId") motherProfileId: string) {
    return this.catalog.listMotherPlans(request.user!, motherProfileId);
  }

  @Put(":itemId")
  async put(
    @Req() request: AuthenticatedRequest,
    @Param("motherProfileId") motherProfileId: string,
    @Param("itemId") itemId: string,
    @Body(createDtoValidationPipe(UpdateItemPlanDto)) body: UpdateItemPlanDto
  ) {
    const result = await this.catalog.putMotherPlan(request.user!, motherProfileId, itemId, body);
    await this.audit.record({ actorUserId: request.user!.id, action: "item_plan.update", targetType: "mother_profile", targetId: motherProfileId, after: { itemId, state: result.state, version: result.version } });
    return result;
  }

  @Post("bulk")
  async bulk(
    @Req() request: AuthenticatedRequest,
    @Param("motherProfileId") motherProfileId: string,
    @Body(createDtoValidationPipe(BulkItemPlanDto)) body: BulkItemPlanDto
  ) {
    const result = await this.catalog.bulkMotherPlans(request.user!, motherProfileId, body.items);
    await this.audit.record({ actorUserId: request.user!.id, action: "item_plan.bulk_update", targetType: "mother_profile", targetId: motherProfileId, after: { count: result.plans.length } });
    return result;
  }

}

@Controller("children/:childId/item-plans")
@UseGuards(JwtAuthGuard)
export class ItemPlansController {
  constructor(
    @Inject(CatalogV2Service) private readonly catalog: CatalogV2Service,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return this.catalog.listPlans(request.user!, childId);
  }

  @Put(":itemId")
  async put(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemId") itemId: string,
    @Body(createDtoValidationPipe(UpdateItemPlanDto)) body: UpdateItemPlanDto
  ) {
    const result = await this.catalog.putPlan(request.user!, childId, itemId, body);
    await this.audit.record({ actorUserId: request.user!.id, action: "item_plan.update", targetType: "item_definition", targetId: itemId, after: { state: result.state, version: result.version } });
    return result;
  }

  @Post("bulk")
  async bulk(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(BulkItemPlanDto)) body: BulkItemPlanDto
  ) {
    const result = await this.catalog.bulkPlans(request.user!, childId, body.items);
    await this.audit.record({ actorUserId: request.user!.id, action: "item_plan.bulk_update", targetType: "child", targetId: childId, after: { count: result.plans.length } });
    return result;
  }

  @Get(":itemId/activity")
  activity(@Req() request: AuthenticatedRequest, @Param("childId") childId: string, @Param("itemId") itemId: string) {
    return this.catalog.planActivity(request.user!, childId, itemId);
  }

  @Post(":itemId/comments")
  @UseInterceptors(IdempotencyInterceptor)
  async comment(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemId") itemId: string,
    @Body(createDtoValidationPipe(CreateItemPlanCommentDto)) body: CreateItemPlanCommentDto
  ) {
    const result = await this.catalog.addPlanComment(request.user!, childId, itemId, body);
    await this.audit.record({ actorUserId: request.user!.id, action: "item_plan.comment_create", targetType: "item_definition", targetId: itemId });
    return result;
  }
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ExpenseCategoriesV2Controller {
  constructor(@Inject(CatalogV2Service) private readonly catalog: CatalogV2Service) {}

  @Get("expense-categories")
  list(@Req() request: AuthenticatedRequest) {
    return this.catalog.expenseCategories(request.user!);
  }

  @Get("households/:householdId/expense-categories")
  household(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.catalog.expenseCategories(request.user!, householdId);
  }
}
