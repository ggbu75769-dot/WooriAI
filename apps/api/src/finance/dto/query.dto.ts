import { IsInt, IsOptional, IsUUID, Matches, Min } from "class-validator";
import { Type } from "class-transformer";

export class YearMonthQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  yearMonth?: string;
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
