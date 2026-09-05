import { Type } from "class-transformer";
import { ArrayMaxSize, Equals, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { MAX_MONEY_KRW } from "@wooriai/domain";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const sha256 = /^[0-9a-f]{64}$/;

export class ReceiptFixtureExtractionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_MONEY_KRW)
  amountKrw?: number;

  @IsOptional() @Matches(dateOnly)
  spentOn?: string;

  @IsOptional() @IsString() @MaxLength(120)
  merchant?: string;

  @IsOptional() @IsString() @MaxLength(120)
  itemName?: string;

  @IsOptional() @Type(() => Number) @Min(0) @Max(1)
  confidence?: number;
}

export class CreateReceiptDraftDto {
  @IsUUID()
  childId!: string;

  @Matches(sha256)
  contentHash!: string;

  @IsString() @MinLength(1) @MaxLength(191) @Matches(/^[^/\\\u0000-\u001f]+$/)
  fileName!: string;

  @IsIn(["image/jpeg", "image/png", "application/pdf"])
  mimeType!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(15 * 1024 * 1024)
  fileSizeBytes!: number;

  @IsOptional() @ValidateNested() @Type(() => ReceiptFixtureExtractionDto)
  fixtureExtraction?: ReceiptFixtureExtractionDto;
}

export class ConfirmReceiptDraftDto {
  @Equals(true)
  confirmed!: true;

  @IsString() @MinLength(8) @MaxLength(191)
  idempotencyKey!: string;

  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;

  @IsUUID()
  categoryId!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_MONEY_KRW)
  amountKrw!: number;

  @Matches(dateOnly)
  spentOn!: string;

  @IsString() @MinLength(1) @MaxLength(100)
  itemName!: string;

  @IsOptional() @IsString() @MaxLength(100)
  merchant?: string;

  @IsOptional() @IsUUID()
  linkedItemDefinitionId?: string;

  @IsOptional() @IsUUID()
  payerUserId?: string;
}

export class LinkExpensePlanDto {
  @IsUUID()
  planId!: string;

  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;

  @IsIn(["explicit_item", "canonical_match", "name_match", "amount_range", "date_proximity", "purchase_history"])
  reasonCode!: string;
}

export class UnlinkExpensePlanDto extends LinkExpensePlanDto {}

export class UpdatePredictionPreferenceDto {
  @IsBoolean()
  enabled!: boolean;

  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;
}
