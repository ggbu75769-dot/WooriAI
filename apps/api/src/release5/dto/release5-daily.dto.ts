import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class ReferenceDateQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  referenceDate?: string;
}

export class CalendarQueryDto {
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsOptional() @IsUUID()
  childId?: string;

  @IsOptional() @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.split(",").filter(Boolean) : value)
  @IsArray() @IsIn(["preparation", "replacement", "recurring"], { each: true })
  eventTypes?: Array<"preparation" | "replacement" | "recurring">;
}

export class TodayPreferenceDto {
  @IsUUID()
  householdId!: string;

  @IsOptional() @IsUUID()
  childId?: string;

  @IsString() @MinLength(1) @MaxLength(191)
  actionKey!: string;

  @IsIn(["snooze", "hide_lifecycle"])
  mode!: "snooze" | "hide_lifecycle";

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  snoozedUntil?: string;

  @IsOptional() @IsString() @MaxLength(60)
  lifecycleCode?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  expectedVersion?: number;
}

export class CustomBundleItemDto {
  @IsUUID()
  itemDefinitionId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  defaultQuantity?: number;
}

export class CreateCustomBundleDto {
  @IsString() @MinLength(1) @MaxLength(120)
  title!: string;

  @IsIn(["child", "household"])
  scopeType!: "child" | "household";

  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CustomBundleItemDto)
  items!: CustomBundleItemDto[];
}

export class UpdateCustomBundleDto extends CreateCustomBundleDto {
  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;
}

export class BundleVersionDto {
  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;
}

export class ApplyCustomBundleDto extends BundleVersionDto {
  @IsUUID()
  childId!: string;

  @IsString() @MinLength(8) @MaxLength(191)
  idempotencyKey!: string;
}
