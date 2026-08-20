import { Module } from "@nestjs/common";
import { WorkerModule } from "../worker/worker.module";
import { HealthController } from "./health.controller";

@Module({
  // INF-007: WorkerModule exports WorkerStatusService for GET /health/worker.
  imports: [WorkerModule],
  controllers: [HealthController]
})
export class HealthModule {}
