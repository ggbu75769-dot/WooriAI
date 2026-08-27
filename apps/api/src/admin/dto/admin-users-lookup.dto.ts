import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export const USERS_LOOKUP_DEFAULT_LIMIT = 20;
export const USERS_LOOKUP_MAX_LIMIT = 50;
/**
 * 한 글자 검색은 사실상 전체 스캔 + 전체 명단 열람이라 막는다 — 운영자가 특정
 * 문의자를 찾는 도구지, 사용자 명단을 훑는 도구가 아니다.
 */
export const USERS_LOOKUP_MIN_QUERY_LENGTH = 2;

/**
 * ADM-127: GET /admin/users-lookup 쿼리. 이메일/닉네임 부분일치 검색 하나뿐이고,
 * `query`는 필수다(빈 쿼리로 전체 명단을 받아 가는 경로를 만들지 않는다).
 * 숫자 변환은 기존 쿼리 DTO 관례(AdminAuditLogsQueryDto)와 동일.
 */
export class AdminUsersLookupQueryDto {
  @IsString()
  @MinLength(USERS_LOOKUP_MIN_QUERY_LENGTH)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USERS_LOOKUP_MAX_LIMIT)
  limit?: number;
}
