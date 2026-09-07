import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import {
  IsSafeDisplayName,
  MaxStoredCodePoints,
  normalizeDisplayName
} from "../../common/validation/display-name";

/**
 * `categories.name varchar(50)`의 폭. 라운드 109 실측: PostgreSQL의 `varchar(n)`은
 * **코드포인트**를 센다(하트+VS16 26쌍 = 52코드포인트가 varchar(50)에서 22001로 거절된다).
 *
 * 값이 여기 리터럴로 서 있는 이유: 이 축의 단일 소스는 컬럼이고, 가구 커스텀 쪽의
 * `customCategoryNameMaxLength()`(finance/dto/custom-categories.dto.ts)와 **같은 컬럼**을 문다.
 * 둘이 갈리면 같은 표의 같은 칸이 유입 지점마다 다른 상한을 갖게 되므로,
 * test/admin-category-name-normalization.e2e.test.ts가 세 값(이 상수 · 커스텀 쪽 상수 ·
 * prisma/schema.prisma의 `@db.VarChar(50)`)을 한자리에서 대조한다.
 * 새 `export const`를 두지 않는다(라운드 95 공통 금지) — 밖에서 필요해지면 읽기 함수를 낸다.
 */
const CATEGORY_NAME_MAX_LENGTH = 50;

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
   *
   * 라운드 109 — **`.trim()` 하나로는 모자랐다**(전부 e2e로 실측한 뒤 고쳤다).
   * 종전(그때는 참): 여기는 `.trim()`뿐이라 이름 **안쪽**의 개행·제어문자가 `@MinLength(1)`·
   * `@MaxLength(50)`을 그대로 통과해 `categories.name`에 앉았다. 실측한 저장값 셋:
   *   * `"\u202E전세 500만원"` → 200으로 저장(첫 코드포인트가 U+202E RLO). 양방향 제어문자는
   *     뒤따르는 문장의 표시 순서를 뒤집어 **금액 숫자를 사실과 다르게 보이게** 한다.
   *   * `"산후\u0085도우미"` → 200으로 저장. NEL은 JS `\s`가 모르는데(실측) iOS CoreText는
   *     문단 구분자로 취급해 실제로 줄이 갈린다.
   *   * `"\u200B\u200B"`(ZWSP만) → 200으로 저장. 빈 이름 검사를 통과하고, 화면에서는
   *     "…에는 에 가장 많이 썼어요"가 된다.
   * 라운드 107 D6의 중복 검사(`duplicateKey`)는 **비교 키에서만** 접어 저장값을 손대지 않으므로
   * 이 구멍을 막지 못했다. 가구 커스텀 쪽(`finance/dto/custom-categories.dto.ts`)은 `trim` +
   * 연속 공백 접기까지 했지만 그 접기도 위 셋을 잡지 못한다.
   * → 이제: ① 접기는 커스텀 쪽과 **같은 함수**를 부른다(`normalizeDisplayName` — 규칙의 구현이
   * 저장소에 한 벌이다) ② 접힌 뒤에도 남는 `\p{Cc}`/`\p{Cf}`/`\p{Cs}`는 **거절**한다
   * (`@IsSafeDisplayName`). 지우지 않고 거절하는 이유: 지우면 운영자가 자기가 붙여넣은 것이
   * 사라진 줄 모르고, 거절하면 왜 안 되는지 안다. 공백류 16종은 종전대로 조용히 접는다 —
   * 사람이 의도한 이름이 그대로 보존되기 때문이다.
   * ③ 길이는 컬럼과 같은 단위로 한 번 더 센다(`@MaxStoredCodePoints`) — 종전에는
   * `@MaxLength(50)`이 변형 선택자를 빼고 세는 바람에 "❤️"×26(52코드포인트)이 통과해
   * **500 INTERNAL_SERVER_ERROR**(Prisma P2000)로 떨어졌다(실측).
   */
  @IsOptional()
  @Transform(({ value }) => normalizeDisplayName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  @MaxStoredCodePoints(CATEGORY_NAME_MAX_LENGTH)
  @IsSafeDisplayName()
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
