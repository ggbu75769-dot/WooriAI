import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { JobHandlersService } from "./job-handlers.service";
import { JobProcessorService } from "./job-processor.service";
import { OutboxPublisherService } from "./outbox-publisher.service";

@Module({
  imports: [AdminModule, AuthModule, PrivacyModule],
  providers: [JobHandlersService, JobProcessorService, OutboxPublisherService],
  exports: [JobHandlersService, JobProcessorService, OutboxPublisherService]
})
export class JobsModule {}
