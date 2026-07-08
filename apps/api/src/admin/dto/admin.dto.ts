import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min
} from "class-validator";
import {
  CHILD_STAGE_CODES,
  NECESSITY_LEVELS,
  PRODUCT_PLATFORMS,
  type ChildStageCode,
  type NecessityLevel,
  type ProductPlatform
} from "@wooriai/domain";

export class AdminCreateItemTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsIn([...NECESSITY_LEVELS])
  necessityLevel!: NecessityLevel;

  @IsOptional()
  @IsString()
  timingLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinKrw?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMaxKrw?: number;

  @IsString()
  reasonText!: string;

  @IsOptional()
  @IsString()
  skipReasonText?: string;

  @IsOptional()
  @IsBoolean()
  usedSecondhandOk?: boolean;

  @IsOptional()
  @IsString()
  safetyNote?: string;

  @IsOptional()
  @IsArray()
  @IsIn([...CHILD_STAGE_CODES], { each: true })
  stageCodes?: ChildStageCode[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdateItemTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn([...NECESSITY_LEVELS])
  necessityLevel?: NecessityLevel;

  @IsOptional()
  @IsString()
  timingLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinKrw?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMaxKrw?: number;

  @IsOptional()
  @IsString()
  reasonText?: string;

  @IsOptional()
  @IsString()
  skipReasonText?: string;

  @IsOptional()
  @IsBoolean()
  usedSecondhandOk?: boolean;

  @IsOptional()
  @IsString()
  safetyNote?: string;

  @IsOptional()
  @IsArray()
  @IsIn([...CHILD_STAGE_CODES], { each: true })
  stageCodes?: ChildStageCode[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminCreateProductLinkDto {
  @IsUUID()
  itemTemplateId!: string;

  @IsIn([...PRODUCT_PLATFORMS])
  platform!: ProductPlatform;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  affiliateUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAffiliate?: boolean;

  @IsOptional()
  @IsBoolean()
  isSponsored?: boolean;

  @IsOptional()
  @IsString()
  disclosureText?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdateProductLinkDto {
  @IsOptional()
  @IsUUID()
  itemTemplateId?: string;

  @IsOptional()
  @IsIn([...PRODUCT_PLATFORMS])
  platform?: ProductPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  affiliateUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAffiliate?: boolean;

  @IsOptional()
  @IsBoolean()
  isSponsored?: boolean;

  @IsOptional()
  @IsString()
  disclosureText?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDisclosureDto {
  @IsString()
  text!: string;
}
