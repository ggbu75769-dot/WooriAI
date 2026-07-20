import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { SyncChangesQueryDto } from "./dto/sync-query.dto";
import { LegacyOfflineReconcileDto } from "./dto/legacy-reconcile.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  @Get("changes")
  async changes(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(SyncChangesQueryDto)) query: SyncChangesQueryDto
  ) {
    return await this.sync.getChanges(request.user!, query.cursor, query.limit);
  }

  @Post("offline/reconcile-legacy")
  async reconcileLegacy(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(LegacyOfflineReconcileDto)) body: LegacyOfflineReconcileDto
  ) {
    return await this.sync.reconcileLegacy(request.user!, body.mutations);
  }
}
