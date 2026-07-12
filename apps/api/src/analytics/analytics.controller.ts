import { BadRequestException, Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ANALYTICS_EVENTS_BATCH_MAX, AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Post("events")
  @HttpCode(200)
  async submitEvents(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    const events = body?.events;
    if (!Array.isArray(events)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "events는 배열이어야 해요."
      });
    }
    if (events.length > ANALYTICS_EVENTS_BATCH_MAX) {
      throw new BadRequestException({
        code: "ANALYTICS_BATCH_TOO_LARGE",
        message: `한 번에 최대 ${ANALYTICS_EVENTS_BATCH_MAX}개까지 보낼 수 있어요.`
      });
    }

    return await this.analytics.submitEvents(request.user!, events);
  }
}
