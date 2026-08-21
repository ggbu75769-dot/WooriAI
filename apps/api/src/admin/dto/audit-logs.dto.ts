import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export const AUDIT_LOGS_DEFAULT_LIMIT = 50;
export const AUDIT_LOGS_MAX_LIMIT = 100;

/**
 * ADM-113: GET /admin/audit-logs 쿼리. offset 페이지네이션(limit/offset) +
 * 필터 3종(액션 타입 exact match, 행위자 id, 기간). 숫자 변환은 기존 쿼리 DTO
 * 관례(SyncChangesQueryDto)와 동일하게 @Type(() => Number)로 처리한다.
 */
export class AdminAuditLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOGS_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** 액션 타입 정확 일치 필터 (예: "admin.admin_user.update"). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  /** 행위자(관리자) id 필터 — audit_logs.actor_user_id는 UUID만 저장된다. */
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  /** 기간 필터: createdAt >= from (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** 기간 필터: createdAt <= to (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
