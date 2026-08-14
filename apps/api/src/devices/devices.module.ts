import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DevicesController } from "./devices.controller";

// NOTI-100: /me/devices 푸시 기기 등록/알림 토글.
@Module({
  imports: [AuthModule],
  controllers: [DevicesController]
})
export class DevicesModule {}
