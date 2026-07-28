import { IsOptional, IsString, MaxLength } from "class-validator";

export class DeadLetterActionDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
