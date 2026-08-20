import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { AdminRole } from "@prisma/client";

// ADM-006: admin_role enum(admin/editor/analyst)과 1:1. Prisma enum은 타입으로만
// 쓰고, 런타임 검증용 값 목록은 house style대로 DTO 옆에 상수로 둔다.
export const ADMIN_ROLE_VALUES = ["admin", "editor", "analyst"] as const;

export class AdminCreateAdminUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn([...ADMIN_ROLE_VALUES])
  role!: AdminRole;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class AdminUpdateAdminUserDto {
  @IsOptional()
  @IsIn([...ADMIN_ROLE_VALUES])
  role?: AdminRole;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
