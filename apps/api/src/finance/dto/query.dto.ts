import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import { EXPENSE_LIST_DEFAULT_LIMIT, EXPENSE_LIST_MAX_LIMIT } from "@wooriai/contracts";
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
 * API-124: GET /children/:childId/expenses 의 페이지네이션 쿼리.
 *
 * `YearMonthQueryDto`를 그대로 상속해 기존 `yearMonth` 계약(REP-105 관용 포맷 포함)을
 * 유지하면서 `limit`/`cursor`만 더한다 — 부모 클래스에 직접 넣지 않는 이유는
 * reports.controller.ts(월간 리포트)가 같은 `YearMonthQueryDto`를 쓰기 때문이다.
 * 전역 ValidationPipe가 `forbidNonWhitelisted`라 리포트 쪽까지 limit/cursor를 받아
 * 조용히 무시하게 만들 수는 없다.
 *
 * 둘 다 생략 가능하고, 생략 시 `limit = EXPENSE_LIST_DEFAULT_LIMIT`(200)이 적용된다.
 * 종전에는 상한이 아예 없어 전 기간 지출이 무제한으로 실려 나왔다(API-124).
 * 상한 초과(>500)는 VALIDATION_ERROR 400 — sync/dto/sync-query.dto.ts의 관례와 동일.
 */
export class ListExpensesQueryDto extends YearMonthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EXPENSE_LIST_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export { EXPENSE_LIST_DEFAULT_LIMIT, EXPENSE_LIST_MAX_LIMIT };

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
