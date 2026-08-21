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

  /**
   * R20-D: 멱등키 **비부착**. 상태 전이(draft -> in_review)뿐이라 재시도해도
   * 새 행이 생기지도, 라이브 콘텐츠가 바뀌지도 않는다 —
   * ContentRevisionsService#submit이 status !== "draft"를 먼저 막으므로 두 번째
   * 요청은 400 CONTENT_REVISION_NOT_DRAFT로 끝나고, 설령 경합으로 둘 다 통과해도
   * 도달 상태는 동일한 in_review다(submittedAt만 덮어써진다). 재시도 시 남는
   * 중복은 감사 로그 1건뿐이라 인터셉터를 붙일 실익이 없다.
   */
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
   *
   * R20-D: 멱등키 **비부착**. CAS로 멱등하다 — 서비스의 쓰기가
   * `updateMany({ where: { id, status: "in_review" } })` 조건부라, 같은 body의
   * 재시도는 이미 같은 scheduledFor를 다시 쓸 뿐이고(PATCH 수정류의 자연 멱등)
   * 그 사이 상태가 바뀌었다면 0행으로 막힌다. 새 행도, 라이브 쓰기도 없다.
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

  /**
   * R20-D: 멱등키 **비부착**. CAS로 멱등하다 — 서비스의 쓰기가
   * `updateMany({ where: { id, status: "in_review" } })` 조건부라 in_review ->
   * rejected 전이는 한 번만 성공하고, 재시도는 400
   * CONTENT_REVISION_INVALID_STATE로 끝난다. 새 행도, 라이브 콘텐츠 쓰기도 없어
   * 재시도의 실질 부작용이 없다(approve-publish와 달리 "이미 처리됨" 응답으로
   * 끝나도 운영자가 목록에서 반려 상태를 바로 확인할 수 있다).
   */
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

  /**
   * R20-D: 멱등키 **부착**. 이 라우트만 CAS로 보호되지 않는다 — 롤백의 대상
   * `id`는 이미 `published`인 과거 이력이고, 롤백은 그 상태를 바꾸지 않으므로
   * 같은 요청을 몇 번이든 다시 통과시킨다. 한 번 실행할 때마다
   * ContentRevisionsService#rollback이 (1) revisionNo가 하나 늘어난 **새 리비전
   * 행**을 만들고 (2) 라이브 콘텐츠에 다시 쓴다. 즉 쓰기 타임아웃(60초) 뒤
   * 운영자가 다시 누르면 감사 로그 중복이 아니라 **이력에 유령 리비전이 쌓이는**
   * 실질 부작용이 생긴다. submit/reject/schedule과 갈리는 지점이 이것이라
   * 잔여 상태 전이 POST 중 여기에만 인터셉터를 붙였다.
   */
  @Post(":id/rollback")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
  async rollback(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return await this.service.rollback(actor(request), id);
  }
}
