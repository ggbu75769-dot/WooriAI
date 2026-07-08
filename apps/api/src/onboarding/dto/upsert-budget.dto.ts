import { IsInt, Matches, Min } from "class-validator";

export class UpsertBudgetDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  yearMonth!: string;

  @IsInt()
  @Min(1)
  amountKrw!: number;
}
