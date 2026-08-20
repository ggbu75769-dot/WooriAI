import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class YearMonthQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  yearMonth?: string;
}

/**
 * REP-104: GET /children/:childId/reports/category optional period filter.
 * Exactly one period shape may be used per request -- `yearMonth` (single month),
 * `year` (whole year), or `year`+`quarter` (calendar quarter, 1-4). Cross-field
 * rules (quarter requires year; yearMonth excludes year/quarter) are enforced in
 * OnboardingStoreService.getCategoryReport, since class-validator handles only
 * per-field constraints here. No params keeps the all-time breakdown.
 */
export class CategoryReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
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
