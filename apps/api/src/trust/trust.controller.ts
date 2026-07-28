import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateSupportReportDto, RegisterDeviceDto, UpdateNotificationPreferencesDto } from "./dto/trust.dto";
import { TrustService } from "./trust.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class TrustController {
  constructor(@Inject(TrustService) private readonly trust: TrustService) {}

  @Get("notification-preferences")
  preferences(@Req() request: AuthenticatedRequest) { return this.trust.getPreferences(request.user!); }

  @Put("notification-preferences")
  updatePreferences(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(UpdateNotificationPreferencesDto)) body: UpdateNotificationPreferencesDto) {
    return this.trust.updatePreferences(request.user!, body);
  }

  @Post("devices")
  @HttpCode(200)
  registerDevice(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(RegisterDeviceDto)) body: RegisterDeviceDto) {
    return this.trust.registerDevice(request.user!, body);
  }

  @Delete("devices/:deviceId")
  disableDevice(@Req() request: AuthenticatedRequest, @Param("deviceId") deviceId: string) {
    return this.trust.disableDevice(request.user!, deviceId);
  }

  @Post("support/reports")
  @HttpCode(200)
  report(@Req() request: AuthenticatedRequest, @Body(createDtoValidationPipe(CreateSupportReportDto)) body: CreateSupportReportDto) {
    return this.trust.report(request.user!, body);
  }
}
