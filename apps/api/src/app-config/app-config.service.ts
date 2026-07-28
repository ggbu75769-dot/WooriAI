import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
  featureFlags: {
    analytics: false,
    affiliate: false,
    import: false,
    notification: false,
    today_family_center: false,
    preparation_calendar: false,
    custom_bundles: false,
    weekly_briefing: false,
    receipt_assisted_entry: false,
    expense_plan_link_suggestion: false,
    recurring_purchase_prediction: false,
    budget_variance_explanation: false,
    external_recall_provider: false,
    merchant_offer_comparison: false
  },
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
const PUBLIC_CONFIG_KEY = "public_app_config";

export type UpdateAppConfigInput = {
  expectedVersion: number;
  reason: string;
  config: unknown;
};

export type RollbackAppConfigInput = {
  expectedVersion: number;
  targetVersion: number;
  reason: string;
};

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function configPayload(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return value;
  const { configVersion: _configVersion, updatedAt: _updatedAt, ...payload } = value as Record<string, unknown>;
  return payload;
}

function validateReason(reason: unknown) {
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 500) {
    throw new BadRequestException({ code: "APP_CONFIG_REASON_REQUIRED", message: "변경 이유를 3자 이상 입력해 주세요." });
  }
  return reason.trim();
}

function validateVersion(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new BadRequestException({ code: "APP_CONFIG_VERSION_INVALID", message: `${field} 값을 다시 확인해 주세요.` });
  }
  return Number(value);
}

@Injectable()
export class AppConfigService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get() {
    try {
      const row = await this.prisma.remoteConfig.findUnique({ where: { configKey: PUBLIC_CONFIG_KEY } });
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
    return `"${contentHash(config)}"`;
  }

  async update(admin: AuthenticatedAdmin, input: UpdateAppConfigInput) {
    const expectedVersion = validateVersion(input?.expectedVersion, "현재 버전");
    const reason = validateReason(input?.reason);
    const parsed = appConfigSchema.omit({ updatedAt: true, configVersion: true }).safeParse(input?.config);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "APP_CONFIG_INVALID",
        message: "설정 값을 다시 확인해 주세요.",
        details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
    }
    return await this.activate(admin, expectedVersion, parsed.data, reason, "rollout");
  }

  async rollback(admin: AuthenticatedAdmin, input: RollbackAppConfigInput) {
    const expectedVersion = validateVersion(input?.expectedVersion, "현재 버전");
    const targetVersion = validateVersion(input?.targetVersion, "복원할 버전");
    const reason = validateReason(input?.reason);
    if (targetVersion >= expectedVersion) {
      throw new BadRequestException({ code: "APP_CONFIG_ROLLBACK_TARGET_INVALID", message: "현재보다 이전 버전을 선택해 주세요." });
    }
    const target = await this.prisma.remoteConfigRevision.findUnique({
      where: { configKey_version: { configKey: PUBLIC_CONFIG_KEY, version: targetVersion } }
    });
    if (!target) throw new NotFoundException({ code: "APP_CONFIG_REVISION_NOT_FOUND", message: "복원할 설정 버전을 찾을 수 없어요." });
    const parsed = appConfigSchema.omit({ updatedAt: true, configVersion: true }).safeParse(configPayload(target.valueJson));
    if (!parsed.success) throw new BadRequestException({ code: "APP_CONFIG_REVISION_INVALID", message: "이 버전은 안전하게 복원할 수 없어요." });
    return await this.activate(admin, expectedVersion, parsed.data, reason, "rollback");
  }

  async adminState() {
    const [active, revisions, instances] = await Promise.all([
      this.get(),
      this.prisma.remoteConfigRevision.findMany({
        where: { configKey: PUBLIC_CONFIG_KEY },
        orderBy: { version: "desc" },
        take: 20,
        select: { version: true, contentHash: true, action: true, actorAdminId: true, reason: true, activatedAt: true }
      }),
      this.prisma.serviceInstanceHeartbeat.findMany({
        where: { serviceType: "api" },
        orderBy: { instanceId: "asc" },
        select: { instanceId: true, state: true, activeConfigVersion: true, configSource: true, lastHeartbeatAt: true, restartCount: true }
      })
    ]);
    return { active, revisions, instances };
  }

  private async activate(
    admin: AuthenticatedAdmin,
    expectedVersion: number,
    config: Record<string, unknown>,
    reason: string,
    action: "rollout" | "rollback"
  ) {
    const actorAdminId = UUID_PATTERN.test(admin.id) ? admin.id : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.remoteConfig.findUnique({ where: { configKey: PUBLIC_CONFIG_KEY } });
        if (!current || current.version !== expectedVersion) {
          throw new ConflictException({ code: "APP_CONFIG_VERSION_CONFLICT", message: "다른 운영자가 먼저 설정을 변경했어요." });
        }
        await tx.remoteConfigRevision.upsert({
          where: { configKey_version: { configKey: PUBLIC_CONFIG_KEY, version: current.version } },
          create: {
            configKey: PUBLIC_CONFIG_KEY,
            version: current.version,
            valueJson: current.valueJson as Prisma.InputJsonValue,
            contentHash: contentHash(current.valueJson),
            action: "initial",
            actorAdminId: current.updatedByAdminId,
            reason: "현재 활성 설정 기준"
          },
          update: {}
        });
        const nextVersion = current.version + 1;
        const valueJson = config as unknown as Prisma.InputJsonValue;
        const changed = await tx.remoteConfig.updateMany({
          where: { id: current.id, version: expectedVersion, active: true },
          data: { valueJson, version: nextVersion, updatedByAdminId: actorAdminId }
        });
        if (changed.count !== 1) {
          throw new ConflictException({ code: "APP_CONFIG_VERSION_CONFLICT", message: "다른 운영자가 먼저 설정을 변경했어요." });
        }
        const revision = await tx.remoteConfigRevision.create({
          data: {
            configKey: PUBLIC_CONFIG_KEY,
            version: nextVersion,
            valueJson,
            contentHash: contentHash(config),
            action,
            actorAdminId,
            reason
          }
        });
        return { revision, config: { ...config, configVersion: nextVersion, updatedAt: revision.activatedAt.toISOString() } };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error && typeof error === "object" && ["P2002", "P2034"].includes(String((error as { code?: string }).code))) {
        throw new ConflictException({ code: "APP_CONFIG_VERSION_CONFLICT", message: "다른 운영자가 먼저 설정을 변경했어요." });
      }
      throw error;
    }
  }
}
