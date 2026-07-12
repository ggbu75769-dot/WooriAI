import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const SYNC_DEFAULT_LIMIT = 100;
export const SYNC_MAX_LIMIT = 200;

export class SyncChangesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SYNC_MAX_LIMIT)
  limit?: number;
}
