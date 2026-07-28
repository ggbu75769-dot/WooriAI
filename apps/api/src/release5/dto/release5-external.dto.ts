import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class RecallProviderEventDto {
  @Matches(/^[a-z][a-z0-9_-]{2,79}$/)
  providerKey!: string;

  @IsString() @MinLength(1) @MaxLength(191)
  eventId!: string;

  @Type(() => Number) @IsInt() @Min(1)
  eventVersion!: number;

  @IsIn(["recalled", "corrected", "withdrawn", "unknown"])
  status!: "recalled" | "corrected" | "withdrawn" | "unknown";

  @IsOptional() @IsUUID()
  canonicalItemId?: string;

  @IsString() @MinLength(1) @MaxLength(240)
  title!: string;

  @IsString() @MinLength(1) @MaxLength(1000)
  guidance!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  sourceUrl?: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  occurredAt!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @Matches(/^[0-9a-f]{64}$/)
  signature!: string;
}

export class ReviewRecallEventDto {
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @IsOptional() @IsUUID()
  canonicalItemId?: string;

  @Type(() => Number) @IsInt() @Min(1)
  expectedVersion!: number;
}

export class MerchantFeedRowDto {
  @Matches(/^[a-z0-9][a-z0-9._-]{2,190}$/)
  merchantIdentity!: string;

  @IsUUID()
  itemDefinitionId!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  productName!: string;

  @IsString() @MaxLength(1000)
  publicUrl!: string;

  @Type(() => Number) @IsInt() @Min(-2_000_000_000) @Max(2_000_000_000)
  priceKrw!: number;

  @IsString() @MaxLength(3)
  currency!: string;

  @IsIn(["in_stock", "out_of_stock", "preorder", "discontinued", "unknown"])
  stockState!: "in_stock" | "out_of_stock" | "preorder" | "discontinued" | "unknown";

  @IsOptional() @IsObject()
  shipping?: Record<string, unknown>;

  @IsOptional() @IsBoolean()
  affiliate?: boolean;

  @IsOptional() @IsString() @MaxLength(240)
  disclosureText?: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  priceCheckedAt!: string;
}

export class PreviewMerchantFeedDto {
  @IsString() @MinLength(1) @MaxLength(191)
  sourceName!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => MerchantFeedRowDto)
  rows!: MerchantFeedRowDto[];
}

export class ReviewMerchantFeedRowDto {
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";
}

export class ApproveSafetyAlternativeDto {
  @IsUUID()
  alternativeItemDefinitionId!: string;

  @IsUUID()
  evidenceSourceId!: string;
}

export class CreateSafetyAlternativeDto {
  @IsUUID()
  alternativeItemDefinitionId!: string;

  @IsString() @MinLength(1) @MaxLength(240)
  reason!: string;
}
