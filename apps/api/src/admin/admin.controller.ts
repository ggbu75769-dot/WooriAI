import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import {
  AffiliateClickBreakdownService,
  CLICK_BREAKDOWN_WINDOWS,
  isClickBreakdownWindow,
  type ClickBreakdownWindow
} from "./affiliate-click-breakdown.service";
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
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AffiliateClickBreakdownService)
    private readonly clickBreakdown: AffiliateClickBreakdownService
  ) {}

  @Get("item-templates")
  async listItemTemplates() {
    return await this.store.adminListItemTemplates();
  }

  // COM-103: direct-write item-template/product-link/disclosure endpoints are
  // admin-only now -- editor changes must go through
  // POST/PATCH /admin/content-revisions (draft -> submit -> admin
  // approve-publish). See ContentRevisionsController.
  // R19-F: 생성류는 재시도가 곧 중복 리소스(같은 이름의 템플릿, displayOrder가
  // 뒤엉킨 링크)라서 `Idempotency-Key`를 받으면 첫 응답을 재생한다. 헤더가
  // 없으면 no-op이라 기존 호출부/스크립트는 그대로다. PATCH(수정)는 같은 body를
  // 두 번 써도 결과가 같은 멱등 연산이라 부착 대상이 아니다.
  @Post("item-templates")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
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
  @UseInterceptors(IdempotencyInterceptor)
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

  // ADM-123: 기존 응답({ totalClicks, byPlatform } — 둘 다 전체 기간)은 그대로
  // 두고 기간 분해 필드(days/windowTotalClicks/topLinks/dailyTotals)를 덧붙이는
  // 하위호환 확장이다. `days`를 안 보내던 기존 호출부는 필드가 늘어난 것 외에
  // 동작이 같다(기본 7일). 읽기 전용이라 다른 admin GET처럼
  // `@RequireAdminRoles(...)` 없이 admin/editor/analyst 전 역할이 열람한다.
  //
  // DNC-009: 클릭 통계 열람은 추천 점수와 무관하다 — 이 응답은 어드민 콘솔
  // 표시용이고, 여기 담긴 클릭 수는 추천 랭킹/점수 계산으로 되먹임되지 않는다
  // (수수료율은 집계에도 응답에도 포함하지 않는다).
  @Get("affiliate-clicks/summary")
  async affiliateClickSummary(@Query("days") daysRaw?: string) {
    const days: number = daysRaw === undefined ? 7 : Number(daysRaw);
    if (!isClickBreakdownWindow(days)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `days는 ${CLICK_BREAKDOWN_WINDOWS.join(" 또는 ")}만 지원해요.`
      });
    }
    const [summary, breakdown] = await Promise.all([
      this.store.adminAffiliateClickSummary(),
      this.clickBreakdown.getBreakdown(days satisfies ClickBreakdownWindow)
    ]);
    return { ...summary, ...breakdown };
  }
}
