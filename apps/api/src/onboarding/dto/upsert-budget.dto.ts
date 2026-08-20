import { Transform } from "class-transformer";
import { IsInt, Matches, Min } from "class-validator";
import { YEAR_MONTH_INPUT_PATTERN, normalizeYearMonthInput } from "../../common/validation/year-month";

export class UpsertBudgetDto {
  // REP-105 contract tolerance: accepts `YYYY-MM` or `YYYY-MM-01` (previously
  // `YYYY-MM-DD` only) and normalizes to the internal first-of-month form
  // `YYYY-MM-01` before the service sees it. Other days (e.g. 2026-08-15) are
  // rejected as VALIDATION_ERROR — see common/validation/year-month.ts.
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth!: string;

  @IsInt()
  @Min(1)
  amountKrw!: number;
}
