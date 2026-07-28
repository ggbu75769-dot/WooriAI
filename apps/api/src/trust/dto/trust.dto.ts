import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsBoolean() @IsOptional() familyEnabled?: boolean;
  @IsBoolean() @IsOptional() budgetEnabled?: boolean;
  @IsBoolean() @IsOptional() syncEnabled?: boolean;
  @IsBoolean() @IsOptional() stageEnabled?: boolean;
  @IsBoolean() @IsOptional() serviceEnabled?: boolean;
  @IsBoolean() @IsOptional() marketingEnabled?: boolean;
  @IsBoolean() @IsOptional() replacementEnabled?: boolean;
  @IsBoolean() @IsOptional() recurringEnabled?: boolean;
  @IsBoolean() @IsOptional() weeklyBriefingEnabled?: boolean;
  @IsBoolean() @IsOptional() externalChannelEnabled?: boolean;
  @IsIn(["off", "weekly", "biweekly"]) @IsOptional() weeklyFrequency?: "off" | "weekly" | "biweekly";
  @IsString() @MaxLength(5) @IsOptional() quietHoursStart?: string;
  @IsString() @MaxLength(5) @IsOptional() quietHoursEnd?: string;
  @IsInt() @Min(1) @IsOptional() expectedVersion?: number;
}

export class RegisterDeviceDto {
  @IsIn(["android", "ios"])
  platform!: "android" | "ios";

  @IsString() @MaxLength(191)
  deviceId!: string;

  @IsString() @MaxLength(4096)
  pushToken!: string;

  @IsString() @MaxLength(32) @IsOptional()
  appVersion?: string;

  @IsString() @MaxLength(64) @IsOptional()
  osVersion?: string;
}

export class CreateSupportReportDto {
  @IsIn(["item_template", "product_link", "sync", "account"])
  targetType!: "item_template" | "product_link" | "sync" | "account";

  @IsUUID() @IsOptional()
  targetId?: string;

  @IsIn(["INCORRECT_CONTENT", "BROKEN_LINK", "SYNC_FAILURE", "ACCOUNT_HELP", "OTHER"])
  reasonCode!: string;
}
