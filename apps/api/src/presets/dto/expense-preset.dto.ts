import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateExpensePresetDto {
  @IsString()
  @MaxLength(120)
  itemName!: string;

  @IsUUID()
  categoryId!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  @IsOptional()
  defaultAmountKrw?: number;

  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;
}

export class UpdateExpensePresetDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  itemName?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  @IsOptional()
  defaultAmountKrw?: number;

  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}
