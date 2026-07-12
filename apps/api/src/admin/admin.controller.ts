import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
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
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get("item-templates")
  async listItemTemplates() {
    return await this.store.adminListItemTemplates();
  }

  @Post("item-templates")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
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
  @RequireAdminRoles("admin", "editor")
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
  @RequireAdminRoles("admin", "editor")
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
  @RequireAdminRoles("admin", "editor")
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

  @Get("disclosures")
  async listDisclosures() {
    return await this.store.adminListDisclosures();
  }

  @Put("disclosures/:key")
  @RequireAdminRoles("admin", "editor")
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
