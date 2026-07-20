import { Body, Controller, Get, Inject, Put, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ListNotificationsDto, MarkNotificationsReadDto } from "./dto/notifications.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(ListNotificationsDto)) query: ListNotificationsDto
  ) {
    return this.notifications.list(request.user!, query);
  }

  @Put("read")
  markRead(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(MarkNotificationsReadDto)) body: MarkNotificationsReadDto
  ) {
    return this.notifications.markRead(request.user!, body.ids);
  }
}
