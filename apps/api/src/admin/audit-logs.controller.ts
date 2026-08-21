import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AuditLogsService } from "./audit-logs.service";
import { AdminAuditLogsQueryDto } from "./dto/audit-logs.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

/**
 * ADM-113: 감사 로그 뷰어. 관리자 행위 기록(계정 관리, 콘텐츠 발행 등)을 읽는
 * 화면이므로 /admin/users(ADM-006)와 동일하게 admin 역할 전용이며, 다른 admin
 * 라우트와 같은 쿠키 세션 + MFA 게이트(AdminAuthGuard)를 그대로 거친다.
 * 읽기 전용(GET only) — 감사 로그는 이 API로 수정/삭제할 수 없다.
 */
@Controller("admin/audit-logs")
@UseGuards(AdminAuthGuard)
export class AuditLogsController {
  constructor(@Inject(AuditLogsService) private readonly service: AuditLogsService) {}

  @Get()
  @RequireAdminRoles("admin")
  async list(@Query(createDtoValidationPipe(AdminAuditLogsQueryDto)) query: AdminAuditLogsQueryDto) {
    return await this.service.list(query);
  }
}
