import { Body, Controller, Get, Headers, HttpCode, Inject, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { RequireAdminRoles } from "../admin/require-admin-roles.decorator";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AppConfigService } from "./app-config.service";
import type { RollbackAppConfigInput, UpdateAppConfigInput } from "./app-config.service";

@Controller()
export class AppConfigController {
  constructor(
    @Inject(AppConfigService) private readonly appConfig: AppConfigService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  @Get("app-config")
  async get(
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.appConfig.get();
    const etag = this.appConfig.etag(result.config);
    response.setHeader("ETag", etag);
    response.setHeader("Cache-Control", "public, max-age=60, stale-if-error=300");
    response.setHeader("X-Config-Source", result.source);
    if (ifNoneMatch === etag) {
      response.status(304);
      return;
    }
    return result.config;
  }

  @Patch("admin/app-config")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @RequireAdminRoles("admin")
  async update(@Req() request: AuthenticatedRequest, @Body() body: UpdateAppConfigInput) {
    const before = await this.appConfig.get();
    const updated = await this.appConfig.update(request.adminUser!, body);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "admin.app_config.update",
      targetType: "remote_configs",
      targetId: updated.revision.id,
      before: { version: before.config.configVersion },
      after: { version: updated.revision.version, reason: updated.revision.reason }
    });
    return updated;
  }

  @Get("admin/app-config/operations")
  @UseGuards(AdminAuthGuard)
  @RequireAdminRoles("admin", "editor", "analyst")
  async operations() {
    return await this.appConfig.adminState();
  }

  @Post("admin/app-config/rollback")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @RequireAdminRoles("admin")
  async rollback(@Req() request: AuthenticatedRequest, @Body() body: RollbackAppConfigInput) {
    const before = await this.appConfig.get();
    const updated = await this.appConfig.rollback(request.adminUser!, body);
    await this.audit.record({
      actorUserId: request.adminUser!.id,
      action: "admin.app_config.rollback",
      targetType: "remote_configs",
      targetId: updated.revision.id,
      before: { version: before.config.configVersion },
      after: { version: updated.revision.version, reason: updated.revision.reason }
    });
    return updated;
  }
}
