import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

// NOTI-100: user_devices.platform은 varchar(20) 자유 텍스트지만, API 계약은
// 실제 푸시가 가능한 모바일 플랫폼 두 가지로 고정한다.
export const DEVICE_PLATFORMS = ["ios", "android"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export class RegisterDeviceDto {
  @IsIn([...DEVICE_PLATFORMS])
  platform!: DevicePlatform;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  pushToken!: string;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceIdHash?: string;
}

export class UpdateDeviceDto {
  @IsBoolean()
  notificationEnabled!: boolean;
}
