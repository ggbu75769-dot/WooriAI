import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UserDevice } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * PUSH-113: 푸시 발송 관점의 기기 조회/비활성화.
 *
 * 등록/토글 API 자체는 DevicesController(NOTI-100)가 계속 소유하고, 이 서비스는
 * 발송 경로(push/)가 필요로 하는 두 가지만 담당한다:
 * - 발송 대상 조회: notificationEnabled=true 이고 pushToken이 등록된 기기
 * - 무효 토큰 비활성화: FCM이 404/410(UNREGISTERED)으로 응답한 기기의 알림 끄기
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** 주어진 사용자들의 발송 가능 기기 목록. */
  async findActivePushDevices(userIds: string[]): Promise<UserDevice[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.prisma.userDevice.findMany({
      where: { userId: { in: userIds }, notificationEnabled: true, pushToken: { not: null } },
      orderBy: { createdAt: "asc" }
    });
  }

  /**
   * FCM UNREGISTERED 응답을 받은 기기의 푸시를 끈다. 토큰 행은 지우지 않고
   * notificationEnabled=false로만 내린다 — 같은 기기가 새 토큰으로 재등록(NOTI-100
   * upsert)하면 자연스럽게 다시 켜진다. updateMany라 이미 삭제된 행이어도 조용히
   * 넘어간다(발송 경로에서 예외를 만들지 않기 위함).
   */
  async deactivatePushDevice(deviceId: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { id: deviceId },
      data: { notificationEnabled: false }
    });
    // 토큰 값은 로그 금지 — 기기 id만 남긴다.
    this.logger.log(`무효 푸시 토큰 기기 비활성화: deviceId=${deviceId}`);
  }
}
