import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreatePrivacyRequestDto } from "./dto/privacy-request.dto";
import { PrivacyService } from "./privacy.service";

@Controller("privacy")
export class PrivacyController {
  constructor(@Inject(PrivacyService) private readonly privacy: PrivacyService) {}

  @Post("account-deletion")
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreatePrivacyRequestDto)) body: CreatePrivacyRequestDto
  ) {
    if (body.confirmationText !== "DELETE ACCOUNT") {
      throw new BadRequestException({ code: "DELETE_ACCOUNT_CONFIRMATION_REQUIRED", message: "삭제 확인 문구가 필요해요." });
    }
    return await this.privacy.requestDeletion(request.user!);
  }

  @Post("data-export")
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  async exportData(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreatePrivacyRequestDto)) body: CreatePrivacyRequestDto
  ) {
    if (body.confirmationText !== "EXPORT DATA") {
      throw new BadRequestException({ code: "EXPORT_CONFIRMATION_REQUIRED", message: "내보내기 확인 문구가 필요해요." });
    }
    return await this.privacy.requestExport(request.user!);
  }

  @Get("requests/:requestId")
  @UseGuards(JwtAuthGuard)
  async status(@Req() request: AuthenticatedRequest, @Param("requestId") requestId: string) {
    return await this.privacy.statusForUser(request.user!, requestId);
  }

  @Get("public/requests/:requestId")
  async publicStatus(@Param("requestId") requestId: string, @Query("statusToken") statusToken = "") {
    return await this.privacy.publicDeletionStatus(requestId, statusToken);
  }
}
