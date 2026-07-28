import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateExpensePresetDto, UpdateExpensePresetDto } from "./dto/expense-preset.dto";
import { ExpensePresetsService } from "./expense-presets.service";

@Controller("households/:householdId/expense-presets")
@UseGuards(JwtAuthGuard)
export class ExpensePresetsController {
  constructor(@Inject(ExpensePresetsService) private readonly presets: ExpensePresetsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.presets.list(request.user!, householdId);
  }

  @Post()
  @HttpCode(200)
  create(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(CreateExpensePresetDto)) body: CreateExpensePresetDto
  ) {
    return this.presets.create(request.user!, householdId, body);
  }

  @Patch(":presetId")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Param("presetId") presetId: string,
    @Body(createDtoValidationPipe(UpdateExpensePresetDto)) body: UpdateExpensePresetDto
  ) {
    return this.presets.update(request.user!, householdId, presetId, body);
  }

  @Delete(":presetId")
  archive(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("presetId") presetId: string) {
    return this.presets.archive(request.user!, householdId, presetId);
  }

  @Post(":presetId/use")
  @HttpCode(200)
  recordUse(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string, @Param("presetId") presetId: string) {
    return this.presets.recordUse(request.user!, householdId, presetId);
  }
}
