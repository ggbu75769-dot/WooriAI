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

  /**
   * GAP-065 #9: 봉투가 `after`뿐이라 **무엇에서 무엇으로** 바꿨는지 서버가 몰랐다.
   *
   * 이 테이블에 담긴 것은 DNC-010이 잠근 그 문장이다 — 링크의 `disclosure_text`가
   * 비면 앱·어드민·클릭 응답이 전부 이 값을 쓴다(items-catalog.service.ts의
   * `defaultDisclosureFor`). 그리고 `disclosures` 행은 key당 한 칸 upsert라
   * 덮어쓰면 이전 문구가 **사실 자체로 사라진다**(리비전을 타지 않는 직접 쓰기 경로다 —
   * editor는 draft→review를 타지만 admin은 여기로 바로 덮어쓴다, COM-103).
   * 그래서 고지가 약해진 뒤 남는 근거가 "언제 누가 무엇으로"뿐이었고, 되돌릴 값이
   * 서버 어디에도 없었다. before는 upsert **직전** 조회 1회 —
   * `budget.upsert`(GAP-063 #5)·지출 수정 경로와 같은 정밀도이고, 같은 트랜잭션이
   * 아니라는 성질도 그와 같다. before가 null이면 **그 key가 없던 새 문구**라는 뜻이다
   * (`affiliate_purchse` 같은 오타 키로 저장했을 때 로그에 드러나는 표식이기도 하다 —
   * 이 경로는 키를 검증하지 않고 upsert한다).
   *
   * 봉투에 `key`를 함께 싣는 이유: `AuditLoggerService.persist`는 targetId를
   * UUID가 아니면 null로 떨군다(`asUuidOrNull`). 고지의 targetId는 key 문자열이라
   * **영속된 행에는 남지 않으므로**, 어느 문구가 바뀌었는지는 봉투만 답할 수 있다.
   *
   * PII는 없다 — 고지 문구는 운영이 쓴 공개 문구이고(앱 구매 CTA 옆에 그대로 그려진다),
   * 사용자 데이터가 아니다. 그래서 원문을 그대로 싣는다: 되돌릴 값이 봉투에 있어야
   * 이 기록이 쓸모가 있다. 저장되는 값과 맞추려고 after는 요청 body가 아니라 upsert
   * 결과(`result.text` — 서비스가 trim한 값)를 싣는다.
   *
   * 응답은 한 글자도 달라지지 않는다(종전과 같은 `{ key, text }`). 마이그레이션 0건.
   */
  @Put("disclosures/:key")
  @RequireAdminRoles("admin")
  async updateDisclosure(
    @Req() request: AuthenticatedRequest,
    @Param("key") key: string,
    @Body(createDtoValidationPipe(UpdateDisclosureDto)) body: UpdateDisclosureDto
  ) {
    const existing = await this.prisma.disclosure.findUnique({ where: { key }, select: { text: true } });
    const result = await this.store.adminUpdateDisclosure(key, body.text);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.disclosure.update",
      targetType: "disclosures",
      targetId: key,
      before: existing ? { key, text: existing.text } : null,
      after: { key, text: result.text }
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
