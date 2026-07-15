import { createHash } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSupportReportDto, RegisterDeviceDto, UpdateNotificationPreferencesDto } from "./dto/trust.dto";

@Injectable()
export class TrustService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getPreferences(user: AuthenticatedUser) {
    return this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, marketingEnabled: false },
      update: {}
    });
  }

  async updatePreferences(user: AuthenticatedUser, input: UpdateNotificationPreferencesDto) {
    if ((input.quietHoursStart === undefined) !== (input.quietHoursEnd === undefined)) {
      throw new BadRequestException({ code: "QUIET_HOURS_INCOMPLETE", message: "방해 금지 시작과 종료 시각을 함께 입력해 주세요." });
    }
    for (const time of [input.quietHoursStart, input.quietHoursEnd].filter(Boolean)) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time!)) {
        throw new BadRequestException({ code: "QUIET_HOURS_INVALID", message: "방해 금지 시각 형식이 올바르지 않아요." });
      }
    }
    return await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...input, marketingEnabled: input.marketingEnabled ?? false },
      update: input
    });
  }

  async registerDevice(user: AuthenticatedUser, input: RegisterDeviceDto) {
    const salt = process.env.DEVICE_ID_HASH_SALT ?? "wooriai-dev-device-salt";
    const deviceIdHash = createHash("sha256").update(`${salt}:${input.deviceId}`).digest("hex");
    const existing = await this.prisma.userDevice.findFirst({ where: { userId: user.id, deviceIdHash } });
    if (existing) {
      return await this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          platform: input.platform,
          pushToken: input.pushToken,
          notificationEnabled: true,
          appVersion: input.appVersion,
          osVersion: input.osVersion,
          disabledAt: null
        }
      });
    }
    return await this.prisma.userDevice.create({
      data: {
        userId: user.id,
        platform: input.platform,
        deviceIdHash,
        pushToken: input.pushToken,
        notificationEnabled: true,
        appVersion: input.appVersion,
        osVersion: input.osVersion
      }
    });
  }

  async disableDevice(user: AuthenticatedUser, deviceId: string) {
    const changed = await this.prisma.userDevice.updateMany({
      where: { id: deviceId, userId: user.id, disabledAt: null },
      data: { disabledAt: new Date(), pushToken: null, notificationEnabled: false }
    });
    if (changed.count === 0) throw new NotFoundException({ code: "DEVICE_NOT_FOUND", message: "기기를 찾을 수 없어요." });
    return { success: true };
  }

  async report(user: AuthenticatedUser, input: CreateSupportReportDto) {
    if (input.targetId && !/^[0-9a-f-]{36}$/i.test(input.targetId)) {
      throw new BadRequestException({ code: "REPORT_TARGET_INVALID", message: "신고 대상을 다시 확인해 주세요." });
    }
    return await this.prisma.supportReport.create({
      data: { userId: user.id, targetType: input.targetType, targetId: input.targetId, reasonCode: input.reasonCode }
    });
  }
}
