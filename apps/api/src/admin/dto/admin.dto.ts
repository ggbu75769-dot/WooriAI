import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { MONEY_KRW_MAX } from "@wooriai/contracts";
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

  /**
   * 라운드 107 D7 — 상한을 문다. 종전에는 `@Min(0)`만 있어서 int4 상한을 넘는 값이 DTO를
   * 그대로 통과했고, `price_min_krw int` 컬럼에 닿는 순간 PostgreSQL `integer out of range`가
   * 500 `INTERNAL_ERROR`로 나갔다 — 운영자에게는 "요청을 처리하지 못했어요"만 보이고 다시
   * 눌러도 같은 결과인, DNC-018이 금지하는 틀린 안내다. 상한 값은 이 저장소의 다른 금액 칸이
   * 이미 무는 것과 같다(`finance/dto/expense.dto.ts` · `onboarding/dto/upsert-budget.dto.ts`의
   * `@Max(MONEY_KRW_MAX)` = int4 상한).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MONEY_KRW_MAX)
  priceMinKrw?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MONEY_KRW_MAX)
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
  // 라운드 107 D7 — 생성 DTO와 같은 상한(int4). 그 이유는 위 DTO의 같은 자리에 적었다.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MONEY_KRW_MAX)
  priceMinKrw?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MONEY_KRW_MAX)
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

  /**
   * 라운드 107 D2 — **스폰서 표식의 이름칸.** `product_links`에는 처음부터
   * `sponsor_label varchar(80)`과 CHECK `chk_product_links_sponsor`
   * (`is_sponsored = false OR sponsor_label IS NOT NULL`)가 있었는데(마이그레이션 000001),
   * 이 값을 쓰는 런타임 경로가 저장소에 **0건**이었다(시드 하나뿐). 그래서 어드민에서
   * `isSponsored: true`를 켜면 CHECK 위반이 500으로 나갔고, DNC-011이 요구하는 스폰서 구분
   * 표시를 **운영자가 켤 수단이 아예 없었다** — 스폰서 링크는 psql이나 시드로만 만들 수 있었다.
   *
   * 길이 상한은 컬럼과 같은 80이다(넘으면 여기서 400, 예전 같으면 P2000 500).
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sponsorLabel?: string;

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

  /**
   * 라운드 107 D2 — 생성 DTO와 같은 칸. PATCH라 "안 보냄"(그대로 두기)과 `null`(지우기)이
   * 서로 다른 뜻이고, 그 관례는 ADM-124의 가격대와 같다. 스폰서를 켠 채 라벨을 지우는 요청은
   * 저장 전에 400으로 거절된다(admin-catalog-write.service.ts) — DB CHECK보다 앞에서 진다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sponsorLabel?: string | null;

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
