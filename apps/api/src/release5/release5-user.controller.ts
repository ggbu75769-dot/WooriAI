import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ApplyCustomBundleDto, BundleVersionDto, CalendarQueryDto, CreateCustomBundleDto, ReferenceDateQueryDto, TodayPreferenceDto, UpdateCustomBundleDto } from "./dto/release5-daily.dto";
import { Release5DailyService } from "./release5-daily.service";
import { ConfirmReceiptDraftDto, CreateReceiptDraftDto, LinkExpensePlanDto, UpdatePredictionPreferenceDto } from "./dto/release5-assisted.dto";
import { Release5AssistedService } from "./release5-assisted.service";
import { Release5ExternalService } from "./release5-external.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class Release5UserController {
  constructor(
    @Inject(Release5DailyService) private readonly daily: Release5DailyService,
    @Inject(Release5AssistedService) private readonly assisted: Release5AssistedService,
    @Inject(Release5ExternalService) private readonly external: Release5ExternalService
  ) {}

  @Get("children/:childId/today-center")
  today(@Req() request: AuthenticatedRequest, @Param("childId") childId: string, @Query(createDtoValidationPipe(ReferenceDateQueryDto)) query: ReferenceDateQueryDto) {
    return this.daily.todayCenter(request.user!, childId, query.referenceDate);
  }

  @Put("home/today-preferences")
  todayPreference(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(TodayPreferenceDto)) body: TodayPreferenceDto) {
    return this.daily.updateTodayPreference(request.user!, body);
  }

  @Get("households/:householdId/preparation-calendar")
  calendar(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Query(createDtoValidationPipe(CalendarQueryDto)) query: CalendarQueryDto) {
    return this.daily.calendar(request.user!, householdId, query);
  }

  @Get("households/:householdId/custom-bundles")
  bundles(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.daily.listBundles(request.user!, householdId);
  }

  @Post("households/:householdId/custom-bundles")
  @HttpCode(200)
  createBundle(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Body(createDtoValidationPipe(CreateCustomBundleDto)) body: CreateCustomBundleDto) {
    return this.daily.createBundle(request.user!, householdId, body);
  }

  @Patch("households/:householdId/custom-bundles/:bundleId")
  updateBundle(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("bundleId") bundleId: string, @Body(createDtoValidationPipe(UpdateCustomBundleDto)) body: UpdateCustomBundleDto) {
    return this.daily.updateBundle(request.user!, householdId, bundleId, body);
  }

  @Delete("households/:householdId/custom-bundles/:bundleId")
  archiveBundle(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("bundleId") bundleId: string, @Body(createDtoValidationPipe(BundleVersionDto)) body: BundleVersionDto) {
    return this.daily.archiveBundle(request.user!, householdId, bundleId, body);
  }

  @Post("households/:householdId/custom-bundles/:bundleId/apply-preview")
  @HttpCode(200)
  previewBundle(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("bundleId") bundleId: string, @Body(createDtoValidationPipe(ApplyCustomBundleDto)) body: ApplyCustomBundleDto) {
    return this.daily.previewBundle(request.user!, householdId, bundleId, body);
  }

  @Post("households/:householdId/custom-bundles/:bundleId/apply")
  @HttpCode(200)
  applyBundle(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("bundleId") bundleId: string, @Body(createDtoValidationPipe(ApplyCustomBundleDto)) body: ApplyCustomBundleDto) {
    return this.daily.applyBundle(request.user!, householdId, bundleId, body);
  }

  @Get("households/:householdId/weekly-briefings/current")
  weeklyBriefing(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Query(createDtoValidationPipe(ReferenceDateQueryDto)) query: ReferenceDateQueryDto) {
    return this.daily.weeklyBriefing(request.user!, householdId, query.referenceDate);
  }

  @Put("households/:householdId/weekly-briefings/:briefingId/read")
  markBriefingRead(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("briefingId") briefingId: string) {
    return this.daily.markBriefingRead(request.user!, householdId, briefingId);
  }

  @Post("receipt-drafts")
  @HttpCode(200)
  createReceiptDraft(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CreateReceiptDraftDto)) body: CreateReceiptDraftDto) {
    return this.assisted.createReceiptDraft(request.user!, body);
  }

  @Get("receipt-drafts/:draftId")
  receiptDraft(@Req() request: AuthenticatedRequest, @Param("draftId") draftId: string) {
    return this.assisted.getReceiptDraft(request.user!, draftId);
  }

  @Post("receipt-drafts/:draftId/confirm")
  @HttpCode(200)
  confirmReceiptDraft(@Req() request: AuthenticatedRequest, @Param("draftId") draftId: string, @Body(createDtoValidationPipe(ConfirmReceiptDraftDto)) body: ConfirmReceiptDraftDto) {
    return this.assisted.confirmReceiptDraft(request.user!, draftId, body);
  }

  @Get("expenses/:expenseId/plan-link-suggestions")
  planLinkSuggestions(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string) {
    return this.assisted.planLinkSuggestions(request.user!, expenseId);
  }

  @Put("expenses/:expenseId/plan-link")
  linkExpensePlan(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string, @Body(createDtoValidationPipe(LinkExpensePlanDto)) body: LinkExpensePlanDto) {
    return this.assisted.linkExpensePlan(request.user!, expenseId, body);
  }

  @Put("expenses/:expenseId/plan-unlink")
  unlinkExpensePlan(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string, @Body(createDtoValidationPipe(LinkExpensePlanDto)) body: LinkExpensePlanDto) {
    return this.assisted.unlinkExpensePlan(request.user!, expenseId, body);
  }

  @Get("item-plans/:planId/recurring-prediction")
  recurringPrediction(@Req() request: AuthenticatedRequest, @Param("planId") planId: string) {
    return this.assisted.recurringPrediction(request.user!, planId);
  }

  @Put("item-plans/:planId/prediction-preference")
  predictionPreference(@Req() request: AuthenticatedRequest, @Param("planId") planId: string, @Body(createDtoValidationPipe(UpdatePredictionPreferenceDto)) body: UpdatePredictionPreferenceDto) {
    return this.assisted.updatePredictionPreference(request.user!, planId, body);
  }

  @Get("catalog/safety-alerts/:alertId/alternatives")
  safetyAlternatives(@Req() request: AuthenticatedRequest, @Param("alertId") alertId: string) {
    return this.external.safetyAlternatives(request.user!, alertId);
  }
}
