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

/**
 * 라운드 110 — **폭 초과의 사유가 화면까지 가려면 한국어여야 한다.**
 *
 * 종전(그때는 참): 아래 `@MaxLength(...)`들은 문구를 지정하지 않아 class-validator의 **기본
 * 문장**이 실렸다. 실측한 그 문장은 `"disclosureText must be shorter than or equal to 200
 * characters"` — 영문이고, 앞머리가 **서버 필드명 그대로**다. 그 문장은 400 봉투의
 * `details.fields[].constraints`에 담겨 어드민까지 가지만, 어드민은 **한글이 한 자도 없는 서버
 * 문장을 화면에 세우지 않는다**(apps/admin/src/lib/write-error-copy.ts — 라운드 76 리뷰 M-1의
 * 판정이고, 그 판정 자체는 옳다: 읽을 수 없는 사유는 사유가 아니다). 그래서 라운드 108이 이
 * 칸들의 500을 400으로 바꿔 놓고도 운영자 화면에는 봉투의 일반 문장("요청 값을 다시
 * 확인해주세요.")만 섰고, 어느 칸이 왜 걸렸는지는 어디에도 보이지 않았다.
 * → 이제 이 함수가 짓는 **한국어 한 문장**이 그 자리에 실려 화면까지 닿는다.
 *
 * ⚠️ **칸 이름은 어드민 화면이 이미 쓰는 라벨 그대로다** — 영문 필드명(`sponsorLabel` 같은
 * 것)을 화면으로 내보내지 않는다. 라벨의 출처(어드민 루트 기준):
 *   · `준비템 이름`  — app/items/page.tsx의 검색 placeholder(표 머리 `이름`과 같은 칸)
 *   · `타이밍 라벨`  — app/items/page.tsx의 `<label htmlFor={…-timing}>`
 *   · `상품 링크 제목` — app/links/page.tsx의 `<label htmlFor={…-title}>`(표 머리 `제목`)
 *   · `스폰서 표시 문구` — app/links/page.tsx의 `<label htmlFor={…-sponsor-label}>`
 *   · `고지 문구`    — app/links/page.tsx의 `<label htmlFor={…-disclosure}>`
 *
 * ⚠️ 숫자를 문장에 적지 않고 `$constraint1` 토큰을 쓰는 이유: class-validator가 그 자리에
 * 데코레이터의 상한을 넣어 준다(실측). 리터럴로 적으면 상한과 문장이 **두 벌**이 되어, 폭이
 * 바뀌는 날 한쪽만 고쳐질 수 있다.
 *
 * ⚠️ 뒷문장이 "자르지 않는다"까지 말하는 이유는 아래 `disclosureText`의 주석과 같다(DNC-010) —
 * 그 사실을 모르면 운영자는 잘려 저장됐는지 아닌지를 화면에서 알 수 없다. 자르지 않는 것은
 * 이 다섯 칸 모두에 대해 참이다(DTO가 거절하므로 아무것도 저장되지 않는다).
 */
function tooLongMessage(fieldLabel: string): string {
  return `${fieldLabel} 최대 길이는 $constraint1자예요. 넘는 값은 잘라 저장하지 않아요.`;
}

/**
 * 라운드 111 — **숫자 상한·하한의 사유도 같은 길로 화면까지.**
 *
 * 종전(그때는 참): 위 다섯 칸이 한국어를 얻은 뒤에도 아래 가격 두 칸의 사유는 class-validator
 * 기본 문장 그대로였다. 실측한 그 문장 셋(POST·PATCH 양쪽 같다):
 *   · `"priceMaxKrw must not be greater than 2147483647"`  (`max`)
 *   · `"priceMinKrw must not be less than 0"`               (`min`)
 *   · `"priceMinKrw must be an integer number"`             (`isInt`)
 * 셋 다 한글이 한 자도 없어 `write-error-copy.ts`의 소비 규칙에 걸러지고, 앞머리는 서버
 * 필드명 그대로다. 즉 라운드 107 D7이 int4 초과의 500을 400으로 바꿔 놓고도 운영자 화면에는
 * 봉투의 일반 문장만 섰다 — varchar 쪽과 **같은 간극**이다.
 * → 이제 이 세 함수가 짓는 한국어 문장이 그 자리에 실린다.
 *
 * ⚠️ **칸 이름에서 `(원)`만 뗀다.** 어드민 폼의 `<label>`은
 * `최소 가격(원)` · `최대 가격(원)`이다(apps/admin/app/items/page.tsx —
 * `<label htmlFor={…-price-min}>` · `{…-price-max}`). 그 `(원)`은 칸의 **이름**이 아니라 단위
 * 주석이고, 문장이 이미 단위를 말하므로("…$constraint1원이에요") 그대로 쓰면
 * *"최소 가격(원) 최대값은 2147483647원이에요"* 가 된다. 운영자가 화면에서 칸을 찾는 데 쓰는
 * 부분("최소 가격")은 한 글자도 바뀌지 않는다.
 *
 * ⚠️ **상한을 사람이 읽는 모양(`21억`)으로 적지 않는다** — 이 판단이 이 주석의 값이다.
 * `$constraint1`은 데코레이터의 **원값**을 넣어 주므로(실측: `2147483647`), 읽기 좋은 모양을
 * 원하면 토큰을 버리고 숫자를 문장에 손으로 적어야 하고, 그 순간 상한이 **두 벌**이 된다.
 * 맞바꿈을 재면: 열 자리 숫자는 읽기 나쁘지만 **참**이고, 두 벌이 된 문장은 상한이 바뀌는 날
 * **거짓을 화면에 세운다**(이 저장소가 가장 먼저 금지하는 것이다). 게다가 운영자가 이 문장에서
 * 실제로 얻는 것은 "상한을 넘었다"는 사실이지 상한의 정확한 자릿수가 아니다 — 21억 원짜리
 * 준비템 가격은 오타이지 입력값이 아니다. 그래서 varchar 다섯 칸과 같은 규율을 지킨다.
 *
 * ⚠️ `@IsInt`에도 문구를 짓는 이유(죽은 코드가 아니다): 어드민의 가격 칸은
 * `<input type="number">`라 **글자는 못 넣지만 소수점은 넣는다**. 그 폼에는 `<form>` 요소가
 * 없고(버튼이 `type="button"` + `onClick`), `checkValidity()`를 부르는 자리도 0건이라
 * HTML5 제약 검사(`min={0}` · 암묵 `step=1`)가 **한 번도 돌지 않는다**. 클라이언트 검사
 * (`validateItemForm`)는 `Number.isNaN`과 최소>최대만 보므로 `1.5`도 `-5`도 그대로 서버에
 * 닿는다 — 셋 다 실측으로 400을 받은 입력이다.
 */
function tooLargeMessage(fieldLabel: string): string {
  return `${fieldLabel} 최대값은 $constraint1원이에요. 넘는 값은 줄여 저장하지 않아요.`;
}

function tooSmallMessage(fieldLabel: string): string {
  return `${fieldLabel} 최소값은 $constraint1원이에요. 못 미치는 값은 올려 저장하지 않아요.`;
}

function notIntegerMessage(fieldLabel: string): string {
  return `${fieldLabel}은 소수점 없는 정수로 넣어 주세요. 반올림해 저장하지 않아요.`;
}

export class AdminCreateItemTemplateDto {
  /**
   * 라운드 108 — **상한이 컬럼보다 넓었다.** 종전 이 줄은 `@MaxLength(120)`이었다(그때는
   * "이름은 넉넉히 받는다"가 전부였고, 그 숫자가 어느 컬럼과도 맞춰진 적이 없다).
   * `item_templates.name`은 마이그레이션 000001부터 줄곧 `varchar(80)`이다
   * (`000022_custom_items/migration.sql`이 커스텀 품목 이름을 "item_templates.name과 같은 폭"
   * 이라며 80으로 맞춘 그 폭). 그래서 81~120자 이름은 검증을 지나 **DB에서** 터졌다 —
   * Prisma P2000("The provided value for the column is too long")이고, 저장소 전체에 P2000을
   * 400으로 옮기는 핸들러가 **0건**이라 GlobalExceptionFilter가 그대로 500으로 냈다.
   * 이제 80 = 컬럼 폭이라, 넘는 값은 `VALIDATION_ERROR` + `details.fields`로 **어느 칸이**
   * 문제인지 말하고 돌아간다.
   *
   * ⚠️ 숫자가 리터럴인 이유: 이 폭을 담은 공유 상수가 없다. `@wooriai/contracts`의
   * `CHILD_NICKNAME_MAX_LENGTH`류는 **앱 계약이 있는 칸**에만 있고, 어드민 전용 칸은
   * 계약 패키지가 알지 못한다(오늘 이 작업에서 그 패키지는 무접촉이기도 하다).
   * 아래 `timingLabel` · `sponsorLabel` · `disclosureText`가 같은 관례다 —
   * 컬럼 폭이 바뀌면 이 네 자리를 함께 고쳐야 한다.
   */
  @IsString()
  @MaxLength(80, { message: tooLongMessage("준비템 이름") })
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsIn([...NECESSITY_LEVELS])
  necessityLevel!: NecessityLevel;

  /**
   * 라운드 108 — 종전에는 `@IsString()`만 있었다(그때는 "준비 시기 라벨은 짧다"가 사실이었고,
   * 시드의 라벨은 전부 열 몇 자다). 하지만 상한이 없으므로 긴 라벨은 검증이 아니라
   * `item_templates.timing_label varchar(80)`에서 터졌다 — 실측: 81자 → 500
   * `INTERNAL_SERVER_ERROR`(POST·PATCH 양쪽), 80자 → 200이고 80자가 **온전히** 저장된다.
   * 이제 80 = 컬럼 폭. 리터럴로 적은 이유는 위 `name`의 주석과 같다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: tooLongMessage("타이밍 라벨") })
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
  @IsInt({ message: notIntegerMessage("최소 가격") })
  @Min(0, { message: tooSmallMessage("최소 가격") })
  @Max(MONEY_KRW_MAX, { message: tooLargeMessage("최소 가격") })
  priceMinKrw?: number;

  @IsOptional()
  @IsInt({ message: notIntegerMessage("최대 가격") })
  @Min(0, { message: tooSmallMessage("최대 가격") })
  @Max(MONEY_KRW_MAX, { message: tooLargeMessage("최대 가격") })
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
  // 라운드 108 — 생성 DTO와 같은 상한(= `item_templates.name` 컬럼 폭 80). 종전 `120`이
  // 무엇을 통과시켰는지는 위 DTO의 같은 자리에 적었다. PATCH만 넓게 두면 같은 500이
  // 수정 경로에만 남는다.
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: tooLongMessage("준비템 이름") })
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn([...NECESSITY_LEVELS])
  necessityLevel?: NecessityLevel;

  // 라운드 108 — 생성 DTO와 같은 상한(= `timing_label` 컬럼 폭 80). 근거는 위 DTO의 같은 자리.
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: tooLongMessage("타이밍 라벨") })
  timingLabel?: string;

  // ADM-124: PATCH는 부분 수정이라 "안 보냄"(그대로 두기)과 "null"(지우기)이 서로 다른
  // 뜻이다. @IsOptional()이 null도 통과시키므로 런타임 동작은 종전과 같고, 타입만
  // 실제로 받을 수 있는 값(null 포함)에 맞춘다 — 가격대 삭제 경로가 여기로 들어온다.
  // 라운드 107 D7 — 생성 DTO와 같은 상한(int4). 그 이유는 위 DTO의 같은 자리에 적었다.
  @IsOptional()
  @IsInt({ message: notIntegerMessage("최소 가격") })
  @Min(0, { message: tooSmallMessage("최소 가격") })
  @Max(MONEY_KRW_MAX, { message: tooLargeMessage("최소 가격") })
  priceMinKrw?: number | null;

  @IsOptional()
  @IsInt({ message: notIntegerMessage("최대 가격") })
  @Min(0, { message: tooSmallMessage("최대 가격") })
  @Max(MONEY_KRW_MAX, { message: tooLargeMessage("최대 가격") })
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
  @MaxLength(160, { message: tooLongMessage("상품 링크 제목") })
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
  @MaxLength(80, { message: tooLongMessage("스폰서 표시 문구") })
  sponsorLabel?: string;

  /**
   * 라운드 108 — **제휴 고지 문구의 상한.** 종전에는 `@IsString()`만 있었고(그때는 시드가
   * 쓰는 문구가 전부라 상한이 필요 없었다), `product_links.disclosure_text`는 마이그레이션
   * 000001부터 `varchar(200)`이다. 그래서 201자 문구는 검증이 아니라 DB에서 터졌다 —
   * 실측: 201자 → 500 `INTERNAL_SERVER_ERROR`(POST·PATCH 양쪽), 200자 → 200이고
   * 200자가 **온전히** 저장된다.
   *
   * ⚠️ DNC-010(제휴 고지 문구 숨김 금지)이 무는 칸이라 **자르지 않는다.** 200자로 슬라이스하면
   * 운영자가 적은 고지가 조용히 끝이 잘린 채 구매 CTA 옆에 그려진다 — 잘린 고지는 고지가
   * 아니고, 운영자는 잘렸다는 사실조차 모른다. 그래서 400 거절이다: 문구는 손대지 않은 채
   * 운영자에게 돌아가고, 저장되는 값은 언제나 운영자가 적은 그 문장이다.
   *
   * 200자가 실제 고지 문구에 좁지 않은가(실측, `prisma/seed-data.ts`):
   * `disclosureSeeds` 셋이 35 · 32 · 48자, 링크가 직접 든 문구("스폰서 상품 예시예요.")가 12자,
   * 라운드 46이 걷어낸 종전 영문 문구가 72자다. 가장 긴 것이 48자 — 컬럼의 1/4이다.
   * 넓히는 판단(마이그레이션)이 필요한 자리가 아니라고 본다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: tooLongMessage("고지 문구") })
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
  @MaxLength(160, { message: tooLongMessage("상품 링크 제목") })
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
  @MaxLength(80, { message: tooLongMessage("스폰서 표시 문구") })
  sponsorLabel?: string | null;

  // 라운드 108 — 생성 DTO와 같은 상한(= `disclosure_text` 컬럼 폭 200). 자르지 않고 400으로
  // 거절하는 근거(DNC-010)와 200자 충분성 실측은 위 DTO의 같은 자리에 적었다.
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: tooLongMessage("고지 문구") })
  disclosureText?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDisclosureDto {
  @IsString()
  text!: string;
}
