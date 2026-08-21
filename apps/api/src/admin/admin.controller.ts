import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import {
  AdminCreateItemTemplateDto,
  AdminCreateProductLinkDto,
  AdminUpdateItemTemplateDto,
  AdminUpdateProductLinkDto,
  UpdateDisclosureDto
} from "./dto/admin.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    @Inject(ItemsCatalogService) private readonly store: ItemsCatalogService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Get("item-templates")
  async listItemTemplates() {
    return await this.store.adminListItemTemplates();
  }

  // COM-103: direct-write item-template/product-link/disclosure endpoints are
  // admin-only now -- editor changes must go through
  // POST/PATCH /admin/content-revisions (draft -> submit -> admin
  // approve-publish). See ContentRevisionsController.
  @Post("item-templates")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async createItemTemplate(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminCreateItemTemplateDto)) body: AdminCreateItemTemplateDto
  ) {
    const result = await this.store.adminCreateItemTemplate(body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.item_template.create",
      targetType: "item_templates",
      targetId: result.id,
      after: { name: result.name }
    });
    return result;
  }

  @Patch("item-templates/:itemTemplateId")
  @RequireAdminRoles("admin")
  async updateItemTemplate(
    @Req() request: AuthenticatedRequest,
    @Param("itemTemplateId") itemTemplateId: string,
    @Body(createDtoValidationPipe(AdminUpdateItemTemplateDto)) body: AdminUpdateItemTemplateDto
  ) {
    const result = await this.store.adminUpdateItemTemplate(itemTemplateId, body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.item_template.update",
      targetType: "item_templates",
      targetId: itemTemplateId,
      after: { name: result.name }
    });
    return result;
  }

  @Get("product-links")
  async listProductLinks() {
    return await this.store.adminListProductLinks();
  }

  @Post("product-links")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async createProductLink(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminCreateProductLinkDto)) body: AdminCreateProductLinkDto
  ) {
    const result = await this.store.adminCreateProductLink(body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.product_link.create",
      targetType: "product_links",
      targetId: result.id,
      after: { title: result.title }
    });
    return result;
  }

  @Patch("product-links/:productLinkId")
  @RequireAdminRoles("admin")
  async updateProductLink(
    @Req() request: AuthenticatedRequest,
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(AdminUpdateProductLinkDto)) body: AdminUpdateProductLinkDto
  ) {
    const result = await this.store.adminUpdateProductLink(productLinkId, body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.product_link.update",
      targetType: "product_links",
      targetId: productLinkId,
      after: { title: result.title }
    });
    return result;
  }

  // COM-103: enriches the store's {key, text} rows with each disclosure's
  // internal id (not exposed by ItemsCatalogService#adminListDisclosures,
  // which is off-limits to edit in this task) so the admin web CMS can address
  // an existing disclosure by entityId when drafting a content revision for it
  // -- see content-revisions.service.ts and apps/admin's disclosures page.
  @Get("disclosures")
  async listDisclosures() {
    const result = await this.store.adminListDisclosures();
    const rows = await this.prisma.disclosure.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(rows.map((row) => [row.key, row.id]));
    return { disclosures: result.disclosures.map((entry) => ({ id: idByKey.get(entry.key) ?? null, ...entry })) };
  }

  @Put("disclosures/:key")
  @RequireAdminRoles("admin")
  async updateDisclosure(
    @Req() request: AuthenticatedRequest,
    @Param("key") key: string,
    @Body(createDtoValidationPipe(UpdateDisclosureDto)) body: UpdateDisclosureDto
  ) {
    const result = await this.store.adminUpdateDisclosure(key, body.text);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.disclosure.update",
      targetType: "disclosures",
      targetId: key,
      after: { text: body.text }
    });
    return result;
  }

  @Get("affiliate-clicks/summary")
  async affiliateClickSummary() {
    return await this.store.adminAffiliateClickSummary();
  }
}
