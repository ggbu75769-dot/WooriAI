import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import type { UserDevice } from "@prisma/client";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto, UpdateDeviceDto } from "./dto/device.dto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 푸시 토큰은 등록 확인용 응답에 굳이 다시 흘려보낼 필요가 없어 응답에서 제외한다.
function toDeviceResponse(device: UserDevice) {
  return {
    id: device.id,
    platform: device.platform,
    notificationEnabled: device.notificationEnabled,
    appVersion: device.appVersion,
    osVersion: device.osVersion,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
}

/**
 * NOTI-100: 로그인한 사용자의 푸시 기기 등록/갱신.
 * 같은 사용자 + 같은 푸시 토큰이면 새 행을 만들지 않고 기존 등록을 갱신한다
 * (user_devices에 (user_id, push_token) 유니크 제약이 없어 upsert 대신
 * findFirst -> update로 구현). 알림 토글은 본인 소유 기기에만 허용한다.
 */
@Controller("me/devices")
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "asc" }
    });
    return { devices: devices.map(toDeviceResponse) };
  }

  @Post()
  @HttpCode(200)
  async register(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(RegisterDeviceDto)) body: RegisterDeviceDto
  ) {
    const userId = request.user!.id;
    const existing = await this.prisma.userDevice.findFirst({
      where: { userId, pushToken: body.pushToken },
      orderBy: { createdAt: "asc" }
    });

    if (existing) {
      const updated = await this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          platform: body.platform,
          appVersion: body.appVersion ?? existing.appVersion,
          osVersion: body.osVersion ?? existing.osVersion,
          deviceIdHash: body.deviceIdHash ?? existing.deviceIdHash,
          // 갱신 요청이 값을 명시하지 않으면 사용자가 기존에 선택한 토글 상태를 유지한다.
          notificationEnabled: body.notificationEnabled ?? existing.notificationEnabled
        }
      });
      return toDeviceResponse(updated);
    }

    const created = await this.prisma.userDevice.create({
      data: {
        userId,
        platform: body.platform,
        pushToken: body.pushToken,
        appVersion: body.appVersion,
        osVersion: body.osVersion,
        deviceIdHash: body.deviceIdHash,
        // 신규 등록의 기본값은 on: 앱이 푸시 토큰을 얻었다는 것 자체가 OS 알림
        // 권한을 이미 허용했다는 뜻이므로, 명시적으로 끄지 않는 한 알림을 켠다.
        notificationEnabled: body.notificationEnabled ?? true
      }
    });
    return toDeviceResponse(created);
  }

  @Patch(":deviceId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("deviceId") deviceId: string,
    @Body(createDtoValidationPipe(UpdateDeviceDto)) body: UpdateDeviceDto
  ) {
    // 다른 사용자의 기기 id로는 존재 여부조차 확인할 수 없도록 소유자 불일치도
    // 403이 아닌 동일한 404로 응답한다. (uuid 형식이 아니면 Prisma가 500을 내기
    // 전에 여기서 먼저 404로 걸러낸다.)
    const device = UUID_PATTERN.test(deviceId)
      ? await this.prisma.userDevice.findFirst({ where: { id: deviceId, userId: request.user!.id } })
      : null;
    if (!device) {
      throw new NotFoundException({ code: "DEVICE_NOT_FOUND", message: "등록된 기기를 찾을 수 없어요." });
    }

    const updated = await this.prisma.userDevice.update({
      where: { id: device.id },
      data: { notificationEnabled: body.notificationEnabled }
    });
    return toDeviceResponse(updated);
  }
}
