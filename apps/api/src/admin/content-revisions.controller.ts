import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedAdmin, AuthenticatedRequest } from "../common/types/authenticated-request";
import { AdminAuthGuard } from "./admin-auth.guard";
import { ContentRevisionsService } from "./content-revisions.service";
import {
  CreateContentRevisionDto,
  RejectContentRevisionDto,
  ScheduleContentRevisionDto,
  UpdateContentRevisionDto
} from "./dto/content-revision.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

// AdminAuthGuard always populates request.adminUser before a handler runs
// (cookie-session branch sets it explicitly; the legacy x-admin-token fallback
// sets a synthetic "dev-admin" one) -- this narrows the optional field from
// AuthenticatedRequest for the handlers below.
function actor(request: AuthenticatedRequest): AuthenticatedAdmin {
  return request.adminUser as AuthenticatedAdmin;
}

/**
 * COM-103 CMS draft -> review -> publish workflow (round5a-sprint2-plan.md §3).
 * create/update/submit: editor or admin (authors a draft, edits/submits only
 * their own). approve-publish/reject/rollback/schedule: admin only. list/getOne: open to
 * any authenticated admin role (analyst included), matching the existing
 * read-only GET convention on AdminController.
 */
@Controller("admin/content-revisions")
@UseGuards(AdminAuthGuard)
export class ContentRevisionsController {
  constructor(@Inject(ContentRevisionsService) private readonly service: ContentRevisionsService) {}

  @Get()
  async list(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("status") status?: string
  ) {
    return await this.service.list({ entityType, entityId, status });
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return await this.service.getOne(id);
  }

  @Post()
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreateContentRevisionDto)) body: CreateContentRevisionDto
  ) {
    return await this.service.create(actor(request), body);
  }

  @Patch(":id")
  @RequireAdminRoles("admin", "editor")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(UpdateContentRevisionDto)) body: UpdateContentRevisionDto
  ) {
    return await this.service.update(actor(request), id, body);
  }

  @Post(":id/submit")
  @HttpCode(200)
  @RequireAdminRoles("admin", "editor")
  async submit(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return await this.service.submit(actor(request), id);
  }

  /**
   * COM-103b: set/clear the scheduled-publish time on an in_review revision.
   * Scheduling IS a publish decision (the worker publishes with no further
   * human step), so it carries the same admin-only RBAC as approve-publish,
   * and the same author/approver separation (an admin cannot schedule their
   * own submission — see ContentRevisionsService#schedule).
   */
  @Patch(":id/schedule")
  @RequireAdminRoles("admin")
  async schedule(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(ScheduleContentRevisionDto)) body: ScheduleContentRevisionDto
  ) {
    return await this.service.schedule(actor(request), id, body.scheduledFor);
  }

  /**
   * R19-F: 승인·게시는 라이브 콘텐츠를 실제로 갱신하는 무거운 쓰기라
   * `Idempotency-Key`를 받으면 첫 응답을 재생한다. 상태 CAS(in_review ->
   * publishing)가 이미 두 번째 실행을 막아 주지만, 그 결과는 "이미 처리된
   * 리비전입니다" 류의 에러라 운영자는 성공했는지 실패했는지 구분하지
   * 못한다 — 멱등키는 그 재시도를 원래의 성공 응답으로 되돌려 준다.
   */
  @Post(":id/approve-publish")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
  async approvePublish(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return await this.service.approvePublish(actor(request), id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(createDtoValidationPipe(RejectContentRevisionDto)) body: RejectContentRevisionDto
  ) {
    return await this.service.reject(actor(request), id, body.note);
  }

  @Post(":id/rollback")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async rollback(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return await this.service.rollback(actor(request), id);
  }
}
