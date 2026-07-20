import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type ServiceType = "api" | "worker" | "publisher";

@Injectable()
export class ServiceHeartbeatService implements OnModuleDestroy {
  private readonly bootId = randomUUID();
  private readonly instanceId = process.env.SERVICE_INSTANCE_ID ?? hostname();
  private timer: ReturnType<typeof setInterval> | null = null;
  private serviceType: ServiceType | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async start(serviceType: ServiceType) {
    this.serviceType = serviceType;
    await this.beat("running");
    const intervalMs = Math.max(5_000, Number(process.env.SERVICE_HEARTBEAT_INTERVAL_MS ?? 10_000));
    this.timer = setInterval(() => { void this.beat("running").catch(() => undefined); }, intervalMs);
    this.timer.unref?.();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.serviceType) return;
    await this.prisma.serviceInstanceHeartbeat.updateMany({
      where: { serviceType: this.serviceType, instanceId: this.instanceId, bootId: this.bootId },
      data: { state: "stopped", stoppedAt: new Date(), lastHeartbeatAt: new Date() }
    }).catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.stop();
  }

  private async beat(state: "running") {
    if (!this.serviceType) return;
    const config = this.serviceType === "api"
      ? await this.prisma.remoteConfig.findUnique({ where: { configKey: "public_app_config" }, select: { version: true, active: true } })
      : null;
    await this.prisma.$executeRaw`
      INSERT INTO service_instance_heartbeats (
        service_type, instance_id, boot_id, state, active_config_version, config_source,
        restart_count, started_at, last_heartbeat_at, stopped_at, metadata_json
      ) VALUES (
        ${this.serviceType}, ${this.instanceId}, ${this.bootId}, ${state},
        ${config?.active ? config.version : null}, ${config?.active ? "database" : null},
        0, NOW(), NOW(), NULL,
        ${JSON.stringify({ appVersion: process.env.APP_VERSION ?? "unknown" })}::jsonb
      )
      ON CONFLICT (service_type, instance_id) DO UPDATE SET
        boot_id = EXCLUDED.boot_id,
        state = EXCLUDED.state,
        active_config_version = EXCLUDED.active_config_version,
        config_source = EXCLUDED.config_source,
        restart_count = service_instance_heartbeats.restart_count +
          CASE WHEN service_instance_heartbeats.boot_id <> EXCLUDED.boot_id THEN 1 ELSE 0 END,
        started_at = CASE
          WHEN service_instance_heartbeats.boot_id <> EXCLUDED.boot_id THEN NOW()
          ELSE service_instance_heartbeats.started_at
        END,
        last_heartbeat_at = NOW(),
        stopped_at = NULL,
        metadata_json = EXCLUDED.metadata_json
    `;
  }
}
