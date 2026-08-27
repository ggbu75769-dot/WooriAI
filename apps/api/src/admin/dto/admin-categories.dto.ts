import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

/**
 * ADM-127: PATCH /admin/categories/:categoryId 본문.
 *
 * 편집 가능한 축은 네 개뿐이다 — `name`, `displayOrder`, `active`, `selectable`.
 * `id`/`code`/`parentCategoryId`는 의도적으로 빠져 있다(DNC-007): 카테고리 행의
 * 정체성(코드·id)은 모바일 퀵타일 별칭이 하드코딩한 UUID와 시드·마이그레이션이
 * 함께 붙잡고 있어서, 어드민에서 바꾸거나 지울 수 있게 만들면 이미 저장된 지출의
 * category_id가 고아가 된다. 삭제 API가 아예 없는 것도 같은 이유다.
 *
 * 전역 ValidationPipe가 forbidNonWhitelisted라, 위 네 필드 외의 키(code 등)를
 * 보내면 400 VALIDATION_ERROR로 떨어진다 — 계약이 DTO 하나로 강제된다.
 */
export class AdminUpdateCategoryDto {
  /**
   * categories.name은 varchar(50).
   *
   * 라운드 28 리뷰 F2 — **검증 전에 trim**한다(다른 쿼리 DTO의 `@Transform` 관례와 동일).
   * 예전에는 `@MinLength(1)`이 원본을 보는 바람에 `"   "`가 통과했고, 서비스가 저장 직전에
   * `.trim()`을 해서 이름이 빈 문자열로 들어갔다 — 그 순간 앱의 이름 해석
   * (`buildCategoryNameLookup`은 빈 이름을 건너뛴다)이 그 카테고리의 과거 지출 전량을
   * "기타"로 표시한다. 이제 공백만 있는 이름은 400 VALIDATION_ERROR다.
   *
   * 부수 효과(의도): 길이 검사도 trim된 값에 걸리고, 저장되는 값 = 검증된 값이 된다.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  /** 정렬 키. 시드는 정식 1~12, 모바일 별칭 1001~1008, 가져오기 스텁 9001을 쓴다. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  displayOrder?: number;

  /** 행이 살아 있는가(=`GET /categories`에 실릴 수 있는가). */
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** CAT-124: 사용자에게 "고르라고" 내밀 카테고리인가. active와 독립된 축. */
  @IsOptional()
  @IsBoolean()
  selectable?: boolean;
}
