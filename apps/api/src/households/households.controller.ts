import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateInviteDto, TransferOwnershipDto } from "./dto/household.dto";
import { HouseholdRuntimeService } from "./household-runtime.service";

@Controller()
export class HouseholdsController {
  constructor(
    @Inject(HouseholdRuntimeService) private readonly households: HouseholdRuntimeService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get("households/:householdId/members")
  @UseGuards(JwtAuthGuard)
  async listMembers(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return await this.households.listMembers(request.user!, householdId);
  }

  @Delete("households/:householdId/members/:memberId")
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Param("memberId") memberId: string
  ) {
    const result = await this.households.removeMember(request.user!, householdId, memberId);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: result.householdId,
      action: "household.member.remove",
      targetType: "household_member",
      targetId: memberId,
      before: result.before,
      after: result.after
    });
    return { success: true };
  }

  @Post("households/:householdId/transfer-ownership")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async transferOwnership(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(TransferOwnershipDto)) body: TransferOwnershipDto
  ) {
    const result = await this.households.transferOwnership(request.user!, householdId, body.targetUserId);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId,
      action: "household.ownership.transfer",
      targetType: "household",
      targetId: householdId,
      before: { ownerUserId: result.previousOwnerUserId },
      after: { ownerUserId: result.ownerUserId }
    });
    return { success: true, ownerUserId: result.ownerUserId };
  }

  @Post("households/:householdId/leave")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async leave(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return await this.households.leaveHousehold(request.user!, householdId);
  }

  @Delete("households/:householdId")
  @UseGuards(JwtAuthGuard)
  async deleteHousehold(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    const result = await this.households.deleteHousehold(request.user!, householdId);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId,
      action: "household.delete.request",
      targetType: "household",
      targetId: householdId,
      after: { deletionPending: true }
    });
    return result;
  }

  @Post("households/:householdId/invites")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async createInvite(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(CreateInviteDto)) body: CreateInviteDto
  ) {
    return await this.households.createInvite(request.user!, householdId, body.role, body.channel);
  }

  @Get("invites/:token")
  async getInvite(@Param("token") token: string) {
    return await this.households.getInvite(token);
  }

  @Post("invites/:token/accept")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async acceptInvite(@Req() request: AuthenticatedRequest, @Param("token") token: string) {
    return await this.households.acceptInvite(request.user!, token);
  }
}
