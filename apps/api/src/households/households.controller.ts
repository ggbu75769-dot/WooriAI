import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateInviteDto } from "./dto/household.dto";
import { HouseholdRuntimeService } from "./household-runtime.service";

@Controller()
export class HouseholdsController {
  constructor(@Inject(HouseholdRuntimeService) private readonly households: HouseholdRuntimeService) {}

  @Get("households/:householdId/members")
  @UseGuards(JwtAuthGuard)
  listMembers(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return this.households.listMembers(request.user!, householdId);
  }

  @Post("households/:householdId/invites")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  createInvite(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(CreateInviteDto)) body: CreateInviteDto
  ) {
    return this.households.createInvite(request.user!, householdId, body.role, body.channel);
  }

  @Get("invites/:token")
  getInvite(@Param("token") token: string) {
    return this.households.getInvite(token);
  }

  @Post("invites/:token/accept")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  acceptInvite(@Req() request: AuthenticatedRequest, @Param("token") token: string) {
    return this.households.acceptInvite(request.user!, token);
  }
}
