import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminCategoriesService } from "./admin-categories.service";
import { AdminUpdateCategoryDto } from "./dto/admin-categories.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

/**
 * ADM-127: 카테고리 운영 화면(/categories)의 백엔드.
 *
 * 권한: 조회는 로그인한 모든 어드민 역할(admin/editor/analyst)에 열려 있고
 * — `GET /admin/item-templates`와 같은 결 — 수정은 `RequireAdminRoles("admin")`다.
 * COM-103 이후 라이브 콘텐츠 직접 쓰기는 admin 전용이고 editor는 콘텐츠 리비전
 * 워크플로를 거치는데, 카테고리에는 리비전 파이프라인이 없다. 그래서 "editor에게
 * 검토 없는 라이브 쓰기를 열어 주는" 대신 admin 전용으로 좁혀 둔다.
 *
 * 다른 admin 라우트와 동일하게 쿠키 세션 + CSRF + MFA 게이트(AdminAuthGuard)를 거친다.
 *
 * 삭제 라우트는 없다(DNC-007) — 이유는 AdminCategoriesService 주석 참고.
 */
@Controller("admin/categories")
@UseGuards(AdminAuthGuard)
export class AdminCategoriesController {
  constructor(
    @Inject(AdminCategoriesService) private readonly service: AdminCategoriesService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get()
  async list() {
    return await this.service.list();
  }

  @Patch(":categoryId")
  @RequireAdminRoles("admin")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("categoryId") categoryId: string,
    @Body(createDtoValidationPipe(AdminUpdateCategoryDto)) body: AdminUpdateCategoryDto
  ) {
    if (
      body.name === undefined &&
      body.displayOrder === undefined &&
      body.active === undefined &&
      body.selectable === undefined
    ) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값을 다시 확인해주세요.",
        details: {
          fields: [
            {
              field: "name",
              constraints: { required: "name, displayOrder, active, selectable 중 하나는 필요해요." }
            }
          ]
        }
      });
    }

    const before = await this.service.findById(categoryId);
    const after = await this.service.update(before.id, body);

    // 감사 로그: 다른 admin 쓰기(admin.item_template.update 등)와 같은 관례로
    // before/after 스냅샷을 남긴다. selectable 토글은 앱 화면에 바로 보이는
    // 변경이라 "누가 언제 무엇을 껐는지"가 특히 중요하다.
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.category.update",
      targetType: "categories",
      targetId: before.id,
      before: {
        code: before.code,
        name: before.name,
        displayOrder: before.displayOrder,
        active: before.active,
        selectable: before.selectable
      },
      after: {
        code: after.code,
        name: after.name,
        displayOrder: after.displayOrder,
        active: after.active,
        selectable: after.selectable
      }
    });

    return { category: after };
  }
}
