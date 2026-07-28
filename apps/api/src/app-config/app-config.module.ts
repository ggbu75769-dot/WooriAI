import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuditModule } from "../common/audit/audit.module";
import { AppConfigController } from "./app-config.controller";
import { AppConfigService } from "./app-config.service";

@Module({
  imports: [AdminModule, AuditModule],
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
