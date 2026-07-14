import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { PAYMENT_METHODS, type PaymentMethod } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const creatableExpenseTypes = ["expense", "gift"] as const;
type CreatableExpenseType = (typeof creatableExpenseTypes)[number];

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
  @MaxLength(100)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchant?: string;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @IsOptional()
  @IsUUID()
  linkedItemTemplateId?: string;

  @IsOptional()
  @IsIn([...creatableExpenseTypes])
  expenseType?: CreatableExpenseType;
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
  @MaxLength(100)
  itemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @IsOptional()
  @IsIn([...creatableExpenseTypes])
  expenseType?: CreatableExpenseType;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string | null;

  /**
   * Optimistic-concurrency guard (MOB-103, design doc §2.2). Omitted by legacy
   * clients -- when absent, update behaves exactly as before (no conflict
   * check). When present and it no longer matches the server's current
   * `version`, the request 409s with VERSION_CONFLICT instead of applying.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
