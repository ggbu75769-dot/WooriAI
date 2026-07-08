import { Body, Controller, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { ListItemsQueryDto, UpdateItemStatusDto } from "./dto/items.dto";

@Controller("children/:childId/items")
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(ListItemsQueryDto)) query: ListItemsQueryDto
  ) {
    return this.store.listItems(request.user!, childId, query.tab);
  }

  @Get(":itemTemplateId")
  detail(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemTemplateId") itemTemplateId: string
  ) {
    return this.store.getItemDetail(request.user!, childId, itemTemplateId);
  }

  @Patch(":itemTemplateId/status")
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemTemplateId") itemTemplateId: string,
    @Body(createDtoValidationPipe(UpdateItemStatusDto)) body: UpdateItemStatusDto
  ) {
    return this.store.updateItemStatus(
      request.user!,
      childId,
      itemTemplateId,
      body.status,
      body.expenseId
    );
  }
}
