import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export class ReportRangeQueryDto {
  @IsUUID() childId!: string;
  @IsOptional() @IsEnum(["month", "quarter", "year"] as const) period?: "month" | "quarter" | "year";
  @IsOptional() @Matches(dateOnlyPattern) anchor?: string;
  @IsOptional() @Matches(dateOnlyPattern) from?: string;
  @IsOptional() @Matches(dateOnlyPattern) to?: string;
}

export class ReportTrendQueryDto extends ReportRangeQueryDto {
  @IsEnum(["day", "month"] as const) unit: "day" | "month" = "month";
}

export class ReportSourcesQueryDto extends ReportRangeQueryDto {
  @IsEnum([
    "planned",
    "unscheduled_planned",
    "recurring_planned",
    "actual_preparation",
    "household_net",
    "gift",
    "refund",
    "support"
  ] as const)
  kind!:
    | "planned"
    | "unscheduled_planned"
    | "recurring_planned"
    | "actual_preparation"
    | "household_net"
    | "gift"
    | "refund"
    | "support";

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 30;
}
