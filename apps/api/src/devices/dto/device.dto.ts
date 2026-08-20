import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

// NOTI-100: user_devices.platform은 varchar(20) 자유 텍스트지만, API 계약은
// 실제 푸시가 가능한 모바일 플랫폼 두 가지로 고정한다.
export const DEVICE_PLATFORMS = ["ios", "android"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export class RegisterDeviceDto {
  @IsIn([...DEVICE_PLATFORMS])
  platform!: DevicePlatform;

  // 실제 Expo/FCM 푸시 토큰은 수백 바이트 수준이다. 상한을 2000자로 잡는 이유:
  // (user_id, push_token) btree 유니크 인덱스(마이그레이션 000010)는 인덱스 행이
  // ~2704바이트를 넘으면 P2002가 아닌 "index row size exceeds maximum" 오류를 내는데,
  // 이는 디바이스 upsert의 P2002 재시도 경로가 처리하지 못해 500으로 새어 나간다.
  // DTO에서 먼저 400(VALIDATION_ERROR)으로 거른다.
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: "pushToken은 2000자 이하여야 해요." })
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
