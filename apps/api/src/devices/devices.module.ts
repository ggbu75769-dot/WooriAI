import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

// NOTI-100: /me/devices 푸시 기기 등록/알림 토글.
// PUSH-113: DevicesService(발송 대상 조회/무효 토큰 비활성화)를 push 모듈에 export.
@Module({
  imports: [AuthModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService]
})
export class DevicesModule {}
