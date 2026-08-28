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
import { IsHttpUrl } from "../../common/validation/is-http-url.decorator";

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

  // 라운드 48 T1: 의료/영양제 성격 준비템의 상담 안내 표시 여부(DNC-020). 스키마·시드에는
  // 있었지만 어드민이 켜고 끌 수 없어 운영자가 손댈 수 없던 값이다. usedSecondhandOk와
  // 같은 관례로 선택적 boolean이며, 생략하면 기존 값(생성 시 false)이 유지된다.
  @IsOptional()
  @IsBoolean()
  medicalDisclaimerRequired?: boolean;

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

  // ADM-124: PATCH는 부분 수정이라 "안 보냄"(그대로 두기)과 "null"(지우기)이 서로 다른
  // 뜻이다. @IsOptional()이 null도 통과시키므로 런타임 동작은 종전과 같고, 타입만
  // 실제로 받을 수 있는 값(null 포함)에 맞춘다 — 가격대 삭제 경로가 여기로 들어온다.
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinKrw?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMaxKrw?: number | null;

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

  // 라운드 48 T1: 의료/영양제 성격 준비템의 상담 안내 표시 여부(DNC-020). 스키마·시드에는
  // 있었지만 어드민이 켜고 끌 수 없어 운영자가 손댈 수 없던 값이다. usedSecondhandOk와
  // 같은 관례로 선택적 boolean이며, 생략하면 기존 값(생성 시 false)이 유지된다.
  @IsOptional()
  @IsBoolean()
  medicalDisclaimerRequired?: boolean;

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
  @IsHttpUrl()
  url!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @IsHttpUrl()
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
  @IsHttpUrl()
  url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @IsHttpUrl()
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
