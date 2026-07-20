import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { FinanceModule } from "../finance/finance.module";
import { CatalogV2Module } from "../catalog-v2/catalog-v2.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { JobHandlersService } from "./job-handlers.service";
import { JobProcessorService } from "./job-processor.service";
import { OutboxPublisherService } from "./outbox-publisher.service";

@Module({
  imports: [AdminModule, AuthModule, PrivacyModule, FinanceModule, CatalogV2Module, NotificationsModule],
  providers: [
    JobHandlersService,
    JobProcessorService,
    OutboxPublisherService
  ],
  exports: [JobHandlersService, JobProcessorService, OutboxPublisherService]
})
export class JobsModule {}
