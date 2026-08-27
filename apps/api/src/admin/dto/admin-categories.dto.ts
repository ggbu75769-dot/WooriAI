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
  /** categories.name은 varchar(50). 공백만 있는 이름은 막는다. */
  @IsOptional()
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
