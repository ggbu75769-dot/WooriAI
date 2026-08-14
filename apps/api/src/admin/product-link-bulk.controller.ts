import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
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

  @Post("bulk-apply")
  @HttpCode(200)
  @RequireAdminRoles("admin")
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
