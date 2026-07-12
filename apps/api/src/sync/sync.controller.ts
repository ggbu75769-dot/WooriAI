import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { SyncChangesQueryDto } from "./dto/sync-query.dto";
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
}
