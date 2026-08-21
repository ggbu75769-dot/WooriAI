import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminProductLinkBulkCsvDto } from "./dto/product-link-bulk.dto";
import { ProductLinkBulkService } from "./product-link-bulk.service";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

/**
 * COM-107-prep: CSV bulk affiliate-link replacement. Both endpoints are
 * admin-role-only, matching the direct product-links write endpoints on
 * AdminController (COM-103 made those admin-only; editors go through content
 * revisions, which have no bulk path).
 */
@Controller("admin/product-links")
@UseGuards(AdminAuthGuard)
export class ProductLinkBulkController {
  constructor(
    @Inject(ProductLinkBulkService) private readonly service: ProductLinkBulkService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Post("bulk-preview")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async bulkPreview(@Body(createDtoValidationPipe(AdminProductLinkBulkCsvDto)) body: AdminProductLinkBulkCsvDto) {
    return await this.service.preview(body.csv);
  }

  /**
   * R19-F: 이 라우트가 admin 쓰기 중 재시도 위험이 가장 크다 — CSV 한 장이
   * 최대 500행을 갱신하고, 클라이언트 쓰기 타임아웃(60초, FIX-118C)에 걸리면
   * 운영자는 반영 여부를 모른 채 다시 누르게 된다. `Idempotency-Key`를 보낸
   * 재시도는 핸들러를 다시 실행하지 않고 첫 응답(applied/skipped/errors)을
   * 그대로 재생한다. 헤더가 없으면 인터셉터는 통과(no-op)라 기존 호출부는
   * 그대로 동작한다.
   */
  @Post("bulk-apply")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkApply(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminProductLinkBulkCsvDto)) body: AdminProductLinkBulkCsvDto
  ) {
    const result = await this.service.apply(body.csv);
    // One summary entry per upload; counts only, no URLs — existing
    // product-link audit entries record titles/names, never link targets.
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.product_link.bulk_replace",
      targetType: "product_links",
      after: {
        applied: result.applied,
        skipped: result.skipped,
        errors: result.errors,
        totalRows: result.preview.summary.total
      }
    });
    return { applied: result.applied, skipped: result.skipped, errors: result.errors };
  }
}
