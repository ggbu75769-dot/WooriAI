import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import { YEAR_MONTH_INPUT_PATTERN, normalizeYearMonthInput } from "../../common/validation/year-month";

// REP-105 contract tolerance: every yearMonth input below accepts `YYYY-MM` or
// `YYYY-MM-01` (previously `YYYY-MM` only) and normalizes to the internal
// first-of-month form `YYYY-MM-01`. Other days (e.g. 2026-08-15) are rejected
// as VALIDATION_ERROR — see common/validation/year-month.ts.
export class YearMonthQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;
}

/**
 * REP-104: GET /children/:childId/reports/category optional period filter.
 * Exactly one period shape may be used per request -- `yearMonth` (single month),
 * `year` (whole year), or `year`+`quarter` (calendar quarter, 1-4). Cross-field
 * rules (quarter requires year; yearMonth excludes year/quarter) are enforced in
 * ReportingStoreService.getCategoryReport, since class-validator handles only
 * per-field constraints here. No params keeps the all-time breakdown.
 */
export class CategoryReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;

  @IsOptional()
  @Matches(/^\d{4}$/)
  year?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;
}

export class HomeQueryDto {
  @IsUUID()
  childId!: string;
}

export class YearQueryDto {
  @IsOptional()
  @Matches(/^\d{4}$/)
  year?: string;
}

/**
 * DELETE /v1/expenses/:expenseId's optional expectedVersion, carried as a query
 * param (chosen consistently over a DELETE body -- see design doc §2.2 and
 * expenses.controller.ts).
 */
export class ExpenseDeleteQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
