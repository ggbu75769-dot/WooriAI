import { Transform, Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt, IsUUID, Matches, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { MONEY_KRW_MAX } from "@wooriai/contracts";
import { YEAR_MONTH_INPUT_PATTERN, normalizeYearMonthInput } from "../../common/validation/year-month";

/**
 * 라운드 102 T1 — 카테고리별 예산 한 행(docs/5차/round102-category-budget-design.md §9.2).
 * contracts의 `categoryBudgetEntrySchema`(T2 소유)와 필드가 같은 **자체 선언 미러**다 —
 * 서버 DTO는 class-validator로 스스로 선다(§8: contracts 신규 심볼 import 0).
 */
export class CategoryBudgetEntryDto {
  @IsUUID()
  categoryId!: string;

  /**
   * 총액 `amountKrw`와 같은 한 벌: 1..MONEY_KRW_MAX(GAP-054 #2 — 값 하나에 한계 두 벌
   * 금지). 0원 카테고리 예산은 존재하지 않는다 — "그 카테고리 예산 없음"은 행의 부재다
   * (§1.2: 0을 허용하면 "0원 예산"과 "미설정"이라는 두 침묵이 생긴다).
   * `@Max` 위반은 bootstrap.ts의 exceptionFactory가 필드명(amountKrw) 기준으로
   * `EXPENSE_AMOUNT_TOO_LARGE`로 승격한다(중첩 children까지 훑는 그 판정) — 총액과
   * 같은 코드로 갈리는 것이 단일 상한 규율의 연장이다.
   */
  @IsInt()
  @Min(1)
  @Max(MONEY_KRW_MAX)
  amountKrw!: number;
}

export class UpsertBudgetDto {
  // REP-105 contract tolerance: accepts `YYYY-MM` or `YYYY-MM-01` (previously
  // `YYYY-MM-DD` only) and normalizes to the internal first-of-month form
  // `YYYY-MM-01` before the service sees it. Other days (e.g. 2026-08-15) are
  // rejected as VALIDATION_ERROR — see common/validation/year-month.ts.
  //
  // ⚠️ 두 시점 — 이 필드가 `YEAR_MONTH_INPUT_PATTERN`의 **연도 상·하한이 가장 아프게
  // 필요한 자리**다. 종전 패턴은 연도를 `\d{4}`로 열어 뒀고(그때는 참: 고친 것이 달이었다),
  // 그래서 `9999-12`가 형식 검사를 통과했다. 이 경로는 읽기가 아니라 **쓰기**라 결과가
  // 다르다: `upsertBudget`이 행을 커밋한 **뒤** 응답 조립이 `getSeoulMonthRange`의
  // Invalid Date로 터져 500이 났고(실측: budgets 행 0 → 1, yearMonth=9999-12-01),
  // 그 뒤로는 같은 달의 `GET /budget`도 그 행을 읽다가 계속 500이었다 — 사용자가 앱에서
  // 지울 수도, 덮어쓸 수도 없는 행이 남는다. 이제 연도가 창 밖이면 DTO에서 400으로 끊기니
  // 행 자체가 만들어지지 않는다(report-year-bound.e2e.test.ts가 행 수 0을 못박는다).
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth!: string;

  /**
   * GAP-054 #2 — 지출과 **같은 상한**(`MONEY_KRW_MAX` = int4 상한). `budgets.amount_krw`도
   * int4라 초과 값은 400이 아니라 DB 오류(500)로 끝났다. 예산 저장은 아웃박스를 거치지 않는
   * 서버 직행 쓰기지만(재시도 poison은 지출 쪽 이야기다), 같은 값에 두 벌의 한계를 두면
   * 화면과 서버가 다른 말을 하게 되므로 상수를 공유한다.
   * 근거·전체 맥락은 apps/api/src/finance/dto/expense.dto.ts의 amountKrw 주석.
   */
  @IsInt()
  @Min(1)
  @Max(MONEY_KRW_MAX)
  amountKrw!: number;

  /**
   * 라운드 102 T1 — 그 달의 카테고리 예산 집합(§2.2 replace-set 의미론).
   *
   * - **필드 부재 = 무접촉**: 그 달의 카테고리 예산 행은 한 건도 읽지도 쓰지도 않는다 —
   *   구클라이언트(온보딩 예산 화면 포함)와 "카테고리 카드를 고치지 않은 저장"의
   *   하위호환 전부다(리스크 R5).
   * - **필드 존재 = 집합 교체**: 배열에 있는 (categoryId, amountKrw)는 upsert, 없는
   *   기존 행은 삭제. 빈 배열 `[]`은 "그 달 전부 해제"다.
   * - 배열 내 categoryId 중복은 DTO 형식 위반(`VALIDATION_ERROR`, §2.2) — replace-set의
   *   "한 카테고리 한 행"이 요청 형태에서부터 성립한다.
   * - 상한 30(`CATEGORY_BUDGET_MAX_PER_MONTH`)은 여기가 아니라 서비스가 전용 코드
   *   (`CATEGORY_BUDGET_LIMIT_EXCEEDED`)로 거절한다 — 사용자가 고칠 수 있는 단 하나의
   *   원인을 가진 실패라 형식 위반 한 덩어리에 섞지 않는다(CUSTOM_ITEM_LIMIT_EXCEEDED와
   *   같은 판단).
   *
   * ⚠️ 두 시점 (라운드 102 리뷰 M-3) — 종전 게이트는 `@IsOptional()`이었다. class-validator의
   * `@IsOptional()`은 **null과 undefined 둘 다** 검증 전체를 건너뛰므로 `categoryBudgets: null`
   * 본문이 형식 검사를 통과했고, 서비스의 무접촉 갈래는 `=== undefined`만 보므로 그 null이
   * replace-set 갈래로 흘러 `.map` 호출에서 TypeError → **500**이 됐다. 게이트를
   * `@ValidateIf(값 !== undefined)`로 바꾸면 **부재만** 검증을 건너뛰고 null은 `@IsArray()`
   * 위반(400 `VALIDATION_ERROR`)으로 떨어진다. 서비스 가드를 `== null`로 넓히지 않는 이유는
   * 그것이 **"null = 무접촉"이라는 새 의미**를 계약에 만들기 때문이다 — §2.2의 갈래는 부재와
   * 존재 둘뿐이고, 셋째 갈래를 조용히 늘리지 않는다.
   */
  @ValidateIf((dto: UpsertBudgetDto) => dto.categoryBudgets !== undefined)
  @IsArray()
  @ArrayUnique((entry: CategoryBudgetEntryDto) => entry?.categoryId)
  @ValidateNested({ each: true })
  @Type(() => CategoryBudgetEntryDto)
  categoryBudgets?: CategoryBudgetEntryDto[];
}
