import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { HomeQueryDto } from "./dto/query.dto";
import { ExpensesVersionService } from "./expenses.service";
import { Release5DailyService } from "../release5/release5-daily.service";

@Controller("home")
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Inject(ExpensesVersionService) private readonly expenses: ExpensesVersionService,
    @Inject(Release5DailyService) private readonly release5Daily: Release5DailyService
  ) {}

  @Get()
  async get(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(HomeQueryDto)) query: HomeQueryDto
  ) {
    const [home, todayEnabled] = await Promise.all([
      this.store.getHome(request.user!, query.childId),
      this.release5Daily.featureEnabled("today_family_center")
    ]);
    const hydrated = await this.expenses.hydrateHome(home as { recentExpenses: Array<{ id: string }> });
    return {
      ...hydrated,
      todayCenter: todayEnabled ? await this.release5Daily.todayCenter(request.user!, query.childId) : null
    };
  }
}
