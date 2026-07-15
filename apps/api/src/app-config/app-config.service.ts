import { createHash } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { appConfigSchema } from "@wooriai/contracts";
import type { AuthenticatedAdmin } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";

const SAFE_FALLBACK = {
  minimumSupportedVersion: "0.0.0",
  latestVersion: "0.0.0",
  maintenanceMode: false,
  readOnlyMode: false,
  emergencyMessage: null,
  authProviders: [] as Array<"kakao" | "apple" | "google">,
  featureFlags: { analytics: false, affiliate: false, import: false, notification: false },
  policyVersions: {},
  analyticsEnabled: false,
  affiliateEnabled: false,
  importEnabled: false,
  notificationEnabled: false,
  priceMaxAgeDays: null,
  configVersion: 1,
  updatedAt: new Date(0).toISOString()
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AppConfigService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get() {
    try {
      const row = await this.prisma.remoteConfig.findUnique({ where: { configKey: "release3" } });
      if (!row?.active) return { config: SAFE_FALLBACK, source: "safe_fallback" as const };
      const parsed = appConfigSchema.safeParse({
        ...(row.valueJson as Record<string, unknown>),
        configVersion: row.version,
        updatedAt: row.updatedAt.toISOString()
      });
      return parsed.success
        ? { config: parsed.data, source: "database" as const }
        : { config: SAFE_FALLBACK, source: "safe_fallback" as const };
    } catch {
      return { config: SAFE_FALLBACK, source: "safe_fallback" as const };
    }
  }

  etag(config: unknown): string {
    return `"${createHash("sha256").update(JSON.stringify(config)).digest("hex")}"`;
  }

  async update(admin: AuthenticatedAdmin, input: unknown) {
    const current = await this.get();
    const parsed = appConfigSchema.omit({ updatedAt: true, configVersion: true }).safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ code: "APP_CONFIG_INVALID", message: "앱 설정 값을 다시 확인해 주세요." });
    }
    const nextVersion = current.config.configVersion + 1;
    const valueJson = { ...parsed.data, configVersion: nextVersion } as unknown as Prisma.InputJsonValue;
    const updatedByAdminId = UUID_PATTERN.test(admin.id) ? admin.id : null;
    return await this.prisma.remoteConfig.upsert({
      where: { configKey: "release3" },
      create: { configKey: "release3", valueJson, version: nextVersion, updatedByAdminId },
      update: { valueJson, version: nextVersion, active: true, updatedByAdminId }
    });
  }
}
