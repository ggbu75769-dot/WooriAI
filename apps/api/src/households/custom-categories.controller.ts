import {
  BadRequestException,
  Body,
  Controller,
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
import { HouseholdRoleGuard, RequireHouseholdRoles } from "../common/guards/household-role.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateCustomCategoryDto, UpdateCustomCategoryDto } from "../finance/dto/custom-categories.dto";
import { CustomCategoriesService } from "./custom-categories.service";

/**
 * 라운드 103 T1: 커스텀 지출 분류 쓰기 — round103-custom-expense-category-design.md §2.1·§9.2.
 *
 * 여기는 **생성과 수정 둘뿐**이다.
 * - **`DELETE`가 없다**(§1.6): 지우지 않는 동사에 그 메서드를 붙이면 API 표면 자체가 거짓말이
 *   된다. "삭제"의 자리에 서는 것은 이 컨트롤러의 `PATCH { active: false }`(보관)이고, 그
 *   분류로 기록된 지출은 어디로도 가지 않는다.
 * - **전용 `GET`도 없다**(§2.1): 소비처(수정 화면 칩·기록 칩·리포트 이름·CSV·예산·가져오기
 *   검수·관리 화면)가 전부 이미 `GET /categories` 하나를 본다. 두 번째 목록을 만들면
 *   클라이언트가 두 응답을 손으로 합치고 로컬 미러도 두 벌이 된다(라운드 100 §2.1·102 §2.1과
 *   같은 판단). 커스텀 행은 그 목록에 **정상 항목으로 합류**한다(finance/categories.controller.ts).
 *
 * 권한(§2.4): `HouseholdRoleGuard` + `@RequireHouseholdRoles("owner", "co_parent")` —
 * `EXPENSE_EDIT_ROLES`와 같은 역할 집합이라 **새 권한 개념 0건**이고, viewer·gift_participant는
 * 가드에서 403이다. 읽기(`GET /categories`)는 구성원 전원 그대로 — 좁히면 보기 전용 참여자
 * 화면에서만 분류 이름이 "기타"로 무너진다.
 */
@Controller("households/:householdId/categories")
@UseGuards(JwtAuthGuard, HouseholdRoleGuard)
@RequireHouseholdRoles("owner", "co_parent")
export class CustomCategoriesController {
  constructor(@Inject(CustomCategoriesService) private readonly store: CustomCategoriesService) {}

  /**
   * POST 멱등은 라운드 100 §2.3(= 온보딩 `POST /children`의 MOB-101 형식) 그대로:
   * IdempotencyInterceptor + 클라이언트의 시트 단위 `Idempotency-Key` 헤더(선택).
   * 같은 키 + 같은 본문 재전송은 첫 응답 재생, 같은 키 + 다른 본문은 409.
   */
  @Post()
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(CreateCustomCategoryDto)) body: CreateCustomCategoryDto
  ) {
    return await this.store.createCustomCategory(householdId, body.name);
  }

  /** PATCH는 자연 멱등이라 키가 없다(§2.4 — 지출 수정·라운드 100 PATCH와 동일한 판단). */
  @Patch(":categoryId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Param("categoryId") categoryId: string,
    @Body(createDtoValidationPipe(UpdateCustomCategoryDto)) body: UpdateCustomCategoryDto
  ) {
    // 둘 다 없는 본문은 VALIDATION_ERROR(§9.2) — class-validator는 필드별 제약만 보므로
    // "최소 하나"는 여기서 판정한다(admin-categories.controller.ts와 같은 형식·같은 details 모양).
    if (body.name === undefined && body.active === undefined) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값을 다시 확인해주세요.",
        details: {
          fields: [{ field: "name", constraints: { required: "name, active 중 하나는 필요해요." } }]
        }
      });
    }
    return await this.store.updateCustomCategory(request.user!, householdId, categoryId, {
      name: body.name,
      active: body.active
    });
  }
}
