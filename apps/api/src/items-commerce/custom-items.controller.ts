import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CustomItemsService } from "../onboarding/custom-items.service";
import { CreateCustomItemDto, UpdateCustomItemDto } from "./dto/custom-items.dto";

/**
 * 라운드 100 T1: 커스텀 품목 CRUD — round100-custom-items-design.md §2.1·§9.2.
 *
 * 여기는 생성/수정/삭제 셋뿐이다. 전용 GET 목록/단건은 **두지 않는다**(§2.1) — 읽기는 기존
 * 목록/상세/status 엔드포인트(items.controller.ts)에 합류·다형화로 얹힌다. 권한은 서비스의
 * requireChildAccess(edit)가 판정한다(owner/co_parent — viewer·gift_participant는 403, §2.6).
 */
@Controller("children/:childId/custom-items")
@UseGuards(JwtAuthGuard)
export class CustomItemsController {
  constructor(@Inject(CustomItemsService) private readonly store: CustomItemsService) {}

  /**
   * POST 멱등은 온보딩 관례(§2.3 — POST /children의 MOB-101 형식) 그대로:
   * IdempotencyInterceptor + 클라이언트의 초안 단위 Idempotency-Key 헤더(선택).
   * 같은 키+같은 본문 재전송은 첫 응답 재생, 같은 키+다른 본문은 409.
   */
  @Post()
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(CreateCustomItemDto)) body: CreateCustomItemDto
  ) {
    return await this.store.createCustomItem(request.user!, childId, body);
  }

  /** PATCH/DELETE는 자연 멱등이라 키가 없다(§2.3 — 지출 수정과 동일한 판단). */
  @Patch(":customItemId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("customItemId") customItemId: string,
    @Body(createDtoValidationPipe(UpdateCustomItemDto)) body: UpdateCustomItemDto
  ) {
    return await this.store.updateCustomItem(request.user!, childId, customItemId, body);
  }

  @Delete(":customItemId")
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("customItemId") customItemId: string
  ) {
    return await this.store.deleteCustomItem(request.user!, childId, customItemId);
  }
}
