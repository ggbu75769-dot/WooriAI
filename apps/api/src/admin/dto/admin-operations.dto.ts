import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateAdminAccountDto {
  @IsEmail() @MaxLength(320)
  email!: string;

  @IsString() @MaxLength(80)
  displayName!: string;

  @IsIn(["admin", "editor", "analyst"])
  role!: "admin" | "editor" | "analyst";

  @IsString() @MinLength(12) @MaxLength(256)
  initialPassword!: string;
}

export class UpdateAdminRoleDto {
  @IsIn(["admin", "editor", "analyst"])
  role!: "admin" | "editor" | "analyst";
}

export class PrivacyRetryDto {
  @IsString() @MaxLength(500) @IsOptional()
  note?: string;
}

export class AdminIdDto {
  @IsUUID()
  adminId!: string;
}
