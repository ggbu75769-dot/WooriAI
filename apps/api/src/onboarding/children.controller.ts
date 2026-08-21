import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { HouseholdRoleGuard, RequireHouseholdRoles } from "../common/guards/household-role.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateChildDto, UpdateChildDto } from "./dto/child.dto";
import { PreparedItemsDto } from "./dto/prepared-items.dto";
import { OnboardingCoreService } from "./onboarding-core.service";

@Controller("children")
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(@Inject(OnboardingCoreService) private readonly store: OnboardingCoreService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return await this.store.listChildren(request.user!);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, HouseholdRoleGuard)
  @RequireHouseholdRoles("owner", "co_parent")
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreateChildDto)) body: CreateChildDto
  ) {
    return await this.store.createChild(request.user!, body);
  }

  @Get(":childId")
  async get(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return await this.store.getChild(request.user!, childId);
  }

  @Patch(":childId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(UpdateChildDto)) body: UpdateChildDto
  ) {
    return await this.store.updateChild(request.user!, childId, body);
  }

  @Post(":childId/prepared-items")
  @HttpCode(200)
  async setPreparedItems(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(PreparedItemsDto)) body: PreparedItemsDto
  ) {
    return await this.store.setPreparedItems(request.user!, childId, body.itemTemplateIds);
  }
}
