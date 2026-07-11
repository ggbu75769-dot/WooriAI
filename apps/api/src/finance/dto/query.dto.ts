import { IsOptional, IsUUID, Matches } from "class-validator";

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
