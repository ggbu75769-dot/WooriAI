import { Body, Controller, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { ListItemsQueryDto, UpdateItemStatusDto } from "./dto/items.dto";

@Controller("children/:childId/items")
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(@Inject(ItemsCatalogService) private readonly store: ItemsCatalogService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(ListItemsQueryDto)) query: ListItemsQueryDto
  ) {
    return await this.store.listItems(request.user!, childId, query.tab, query.stageBand);
  }

  @Get(":itemTemplateId")
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemTemplateId") itemTemplateId: string
  ) {
    return await this.store.getItemDetail(request.user!, childId, itemTemplateId);
  }

  @Patch(":itemTemplateId/status")
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Param("itemTemplateId") itemTemplateId: string,
    @Body(createDtoValidationPipe(UpdateItemStatusDto)) body: UpdateItemStatusDto
  ) {
    return await this.store.updateItemStatus(
      request.user!,
      childId,
      itemTemplateId,
      body.status,
      body.expenseId
    );
  }
}
