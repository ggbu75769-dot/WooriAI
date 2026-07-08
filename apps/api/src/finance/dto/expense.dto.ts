import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { PAYMENT_METHODS, type PaymentMethod } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateExpenseDto {
  @IsUUID()
  categoryId!: string;

  @IsInt()
  @Min(1)
  amountKrw!: number;

  @Matches(datePattern)
  spentOn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  itemName!: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsUUID()
  linkedItemTemplateId?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountKrw?: number;

  @IsOptional()
  @Matches(datePattern)
  spentOn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  itemName?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
