import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PAYMENT_METHODS, type PaymentMethod } from "@wooriai/domain";

export class CreateUserPaymentMethodDto {
  @IsIn([...PAYMENT_METHODS])
  type!: PaymentMethod;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateUserPaymentMethodDto {
  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  type?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
