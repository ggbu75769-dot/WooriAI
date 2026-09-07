import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * 라운드 103 T1: 커스텀 지출 분류 쓰기 본문 — docs/5차/round103-custom-expense-category-design.md
 * §9.2의 class-validator 자체 선언(계약 zod 스키마의 미러, `packages/contracts` 신규 심볼
 * import 0건 = T2와 독립. 라운드 100의 `items-commerce/dto/custom-items.dto.ts` 관례).
 *
 * `name`은 **검증 전에 정규화**한다(admin-categories.dto.ts의 라운드 28 F2 관례를 한 걸음
 * 넓힌 것): trim만으로는 `"산후  도우미"`처럼 내부 공백이 겹친 이름이 그대로 저장되어,
 * DB의 `uq_categories_household_name`(lower(btrim(name)))과 §1.4의 중복 검사가 같은 이름을
 * 다르게 읽는다. 그래서 여기서 **trim + 내부 연속 공백 1칸 접기**까지 끝내고, 길이 검사는
 * 정규화된 값에 걸린다 — 저장되는 값 = 검증된 값이다(§9.2의 "서버가 trim·공백접기 후 재검증").
 * 공백만 있는 이름은 정규화 뒤 빈 문자열이 되어 `@MinLength(1)`에서 400 VALIDATION_ERROR다.
 */
function normalizeCustomCategoryName(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : value;
}

/**
 * `categories.name varchar(50)`와 동치(§1.4). 컬럼 폭을 바꾸지 않는 것이 additive 규율이고,
 * 정식 분류 이름과 같은 폭이라 표시 자리가 갈리지 않는다.
 * 계약 패키지의 `CUSTOM_CATEGORY_NAME_MAX_LENGTH`(T2 소유)와 값이 같아야 한다 — §9.1.
 */
const CUSTOM_CATEGORY_NAME_MAX_LENGTH = 50;

/**
 * 가구당 커스텀 분류 행 상한(**보관된 행 포함**, §1.7). 15는 파생값이다 —
 * 정식 12 + 15 = 27 <= `CATEGORY_BUDGET_MAX_PER_MONTH`(30, 라운드 102 §1.4).
 * 이 부등식이 깨지면 카테고리 예산 화면이 상한에 먼저 부딪힌다(설계 §1.7 · 리스크 R4).
 * 보관 행도 세는 이유: 세지 않으면 "만들고 보관"을 되풀이해 전량 목록을 무한히 불릴 수 있다
 * (`GET /categories`는 페이지네이션이 없고 전량이 캐시 하나에 앉는다).
 */
const CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = 15;

/** 위 상수의 읽기 창구(라운드 95 공통 금지 — 앱 소스에 새 `export const`를 두지 않는다). */
export function customCategoryNameMaxLength(): number {
  return CUSTOM_CATEGORY_NAME_MAX_LENGTH;
}

/** 위 상수의 읽기 창구(같은 이유). */
export function customCategoryMaxPerHousehold(): number {
  return CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD;
}

/** `POST /households/:householdId/categories` — 사용자가 정하는 것은 이름 하나다(§1.5). */
export class CreateCustomCategoryDto {
  @Transform(({ value }) => normalizeCustomCategoryName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOM_CATEGORY_NAME_MAX_LENGTH)
  name!: string;
}

/**
 * `PATCH /households/:householdId/categories/:categoryId` — 이름 변경 · 보관(`active:false`) ·
 * 복원(`active:true`). 둘 다 optional이고 **최소 하나**가 필요하다(둘 다 없으면
 * VALIDATION_ERROR — 그 판정은 컨트롤러가 한다, admin-categories.controller.ts와 같은 형식).
 *
 * `code`·`displayOrder`·`iconName`·`selectable`·`isSystem`은 여기 없다(§2.3): 요청이 정할 수
 * 없는 축이다 — `code`는 전역 유니크이고 `is_system`은 DB CHECK로 소유자 칸에 묶여 있어
 * (000024) 열면 곧바로 계약이 깨진다. 어드민 편집 축이 넷으로 좁혀 있는 것과 같은 규율이다.
 */
export class UpdateCustomCategoryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeCustomCategoryName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOM_CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  /** `false` = 보관(삭제가 아니다 — 행·id·code는 그대로다), `true` = 복원. §1.6. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
