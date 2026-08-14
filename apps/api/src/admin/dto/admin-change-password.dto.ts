import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

/**
 * ADM-007: 관리자 비밀번호 최소 길이. 기존에 별도 비밀번호 정책 상수가 없어
 * (로그인 DTO는 IsNotEmpty만 검사) 여기서 처음 정의한다 — 임시 비밀번호
 * (base64url 24자, admin-users.controller.ts)보다 충분히 짧은 하한이면서
 * 트리비얼한 비밀번호는 걸러낸다.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

/** scrypt 입력을 상식적인 범위로 묶는 상한 (해시 비용 DoS 방지). */
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export class AdminChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(ADMIN_PASSWORD_MIN_LENGTH)
  @MaxLength(ADMIN_PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
