import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminUsersLookupService } from "./admin-users-lookup.service";
import { AdminUsersLookupQueryDto } from "./dto/admin-users-lookup.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

/**
 * ADM-127: 최종 사용자 조회(CS 문의 대응). 읽기 전용 — GET 하나뿐이고, 이 컨트롤러로는
 * 사용자 데이터를 바꿀 수 없다.
 *
 * 권한: 개인정보를 다루므로 감사 로그 뷰어(ADM-113)·관리자 계정(ADM-006)과 같은
 * `RequireAdminRoles("admin")` 전용이다. editor/analyst는 403.
 *
 * 경로 주의: `AdminUsersController`가 `admin/users`를 잡고 있어 하위 경로로 두면
 * `PATCH /admin/users/:adminUserId`와 섞인다. 그래서 형제 경로 `admin/users-lookup`으로
 * 분리했다(관리자 계정 API와 최종 사용자 조회는 서로 다른 테이블을 본다).
 */
@Controller("admin/users-lookup")
@UseGuards(AdminAuthGuard)
export class AdminUsersLookupController {
  constructor(
    @Inject(AdminUsersLookupService) private readonly service: AdminUsersLookupService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get()
  @RequireAdminRoles("admin")
  async search(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(AdminUsersLookupQueryDto)) query: AdminUsersLookupQueryDto
  ) {
    const result = await this.service.search(query);

    // 민감 조회는 쓰기와 같은 무게로 기록한다: 누가 어떤 검색어로 최종 사용자
    // 개인정보를 열람했는지가 남아야 오남용을 사후에 확인할 수 있다. 조회된
    // 사용자의 개인정보 자체(이메일·이름 등)는 로그에 남기지 않고, 검색어와
    // 건수만 남긴다 — 감사 로그가 또 하나의 개인정보 사본이 되지 않게.
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.user_lookup.search",
      targetType: "users",
      after: { query: query.query.trim(), resultCount: result.users.length }
    });

    return result;
  }
}
