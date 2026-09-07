import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  EXPENSE_LIST_DEFAULT_LIMIT,
  EXPENSE_LIST_MAX_LIMIT,
  TREND_REPORT_DEFAULT_MONTHS,
  TREND_REPORT_MAX_MONTHS
} from "@wooriai/contracts";
import { YEAR_MONTH_INPUT_PATTERN, normalizeYearMonthInput, yearInputPattern } from "../../common/validation/year-month";

// REP-105 contract tolerance: every yearMonth input below accepts `YYYY-MM` or
// `YYYY-MM-01` (previously `YYYY-MM` only) and normalizes to the internal
// first-of-month form `YYYY-MM-01`. Other days (e.g. 2026-08-15) are rejected
// as VALIDATION_ERROR — see common/validation/year-month.ts.
export class YearMonthQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;
}

/**
 * REP-128: GET /children/:childId/reports/trend 의 쿼리 계약.
 *
 * 모바일 리포트 월간 탭의 6개월 추이 차트가 `GET /reports/monthly`를 6번 부르던
 * 워터폴을 한 번의 범위 질의로 접기 위한 엔드포인트다. `months`는 차트가 그릴 막대 수
 * (1~12, 생략 시 6), `endYearMonth`는 그 구간의 **마지막** 달(생략 시 서울 기준 이번 달).
 * 상한 12를 두는 이유는 그 이상은 연간 리포트(`GET /reports/yearly`)의 자리이고,
 * 상한 없는 months가 곧바로 무제한 범위 스캔이 되기 때문이다 — 초과는
 * VALIDATION_ERROR 400(ListExpensesQueryDto의 limit 관례와 동일).
 *
 * `endYearMonth`는 다른 기간 필드와 같은 REP-105 관용 포맷(`YYYY-MM` 또는 `YYYY-MM-01`)을
 * 받는다.
 */
export class TrendReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TREND_REPORT_MAX_MONTHS)
  months?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  endYearMonth?: string;
}

/**
 * API-124: GET /children/:childId/expenses 의 페이지네이션 쿼리.
 *
 * `YearMonthQueryDto`를 그대로 상속해 기존 `yearMonth` 계약(REP-105 관용 포맷 포함)을
 * 유지하면서 `limit`/`cursor`만 더한다 — 부모 클래스에 직접 넣지 않는 이유는
 * reports.controller.ts(월간 리포트)가 같은 `YearMonthQueryDto`를 쓰기 때문이다.
 * 전역 ValidationPipe가 `forbidNonWhitelisted`라 리포트 쪽까지 limit/cursor를 받아
 * 조용히 무시하게 만들 수는 없다.
 *
 * 둘 다 생략 가능하고, 생략 시 `limit = EXPENSE_LIST_DEFAULT_LIMIT`(200)이 적용된다.
 * 종전에는 상한이 아예 없어 전 기간 지출이 무제한으로 실려 나왔다(API-124).
 * 상한 초과(>500)는 VALIDATION_ERROR 400 — sync/dto/sync-query.dto.ts의 관례와 동일.
 */
export class ListExpensesQueryDto extends YearMonthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EXPENSE_LIST_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export { EXPENSE_LIST_DEFAULT_LIMIT, EXPENSE_LIST_MAX_LIMIT };

/**
 * REP-104: GET /children/:childId/reports/category optional period filter.
 * Exactly one period shape may be used per request -- `yearMonth` (single month),
 * `year` (whole year), or `year`+`quarter` (calendar quarter, 1-4). Cross-field
 * rules (quarter requires year; yearMonth excludes year/quarter) are enforced in
 * ReportingStoreService.getCategoryReport, since class-validator handles only
 * per-field constraints here. No params keeps the all-time breakdown.
 */
export class CategoryReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeYearMonthInput(value))
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;

  /**
   * ⚠️ 두 시점 — 종전에는 `/^\d{4}$/`였다(그때는 참: 네 자리이기만 하면 실존하는 연도다).
   * 그런데 이 값을 받는 `ReportingStoreService.resolvePeriodRange`는 `Number(year) + 1`로
   * 다음 해 경계를 만들고, `9999`면 `10000-01-01` · `0001`이면 `2-01-01`이라 둘 다
   * Invalid Date가 되어 Prisma가 던지고 **500**이 됐다(재현 실측: 0001~0998과 9999).
   * 이제 `yearMonth`와 같은 연도 창을 쓴다 — 상한·하한의 도메인 근거는
   * common/validation/year-month.ts의 `REPORT_YEAR_MIN`/`REPORT_YEAR_MAX` 주석.
   */
  @IsOptional()
  @Matches(yearInputPattern())
  year?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number;
}

export class HomeQueryDto {
  @IsUUID()
  childId!: string;
}

/**
 * CAT-124: GET /categories 의 노출 범위 스위치.
 *
 * 생략(기본) → 사용자에게 내밀 카테고리(`selectable = true`)만. `includeAll=1` → 별칭·
 * 가져오기 스텁까지 전량. 전량이 필요한 쪽은 **이름 해석**이다 — 이미 별칭 id로 저장된
 * 지출의 라벨(모바일 `buildCategoryNameLookup`, 리포트 범례, CSV 내보내기)이 기본 목록만
 * 받으면 "기타"로 무너진다.
 *
 * 값은 문자열 플래그 관례("1"/"true")를 따르고, 그 외 값은 조용히 무시하는 대신
 * VALIDATION_ERROR 400으로 돌려준다 — `?includeAll=yes`가 조용히 12개만 받아 가면
 * 호출자는 그게 전량인 줄 안다. (class-validator에 쿼리용 boolean 변환 관례가 아직
 * 없어 문자열 화이트리스트로 검증한다.)
 */
export class ListCategoriesQueryDto {
  @IsOptional()
  @IsIn(["0", "1", "true", "false"])
  includeAll?: string;
}

/** `ListCategoriesQueryDto.includeAll` → boolean. */
export function includeAllRequested(includeAll?: string): boolean {
  return includeAll === "1" || includeAll === "true";
}

/**
 * GET /children/:childId/reports/yearly 의 연도 쿼리. 연도 창(`yearInputPattern`)은
 * `CategoryReportQueryDto.year`와 **같은 자**다 — 같은 서비스의 같은 `Number(year) + 1`
 * 경계 산술을 지나므로 두 입구가 다른 말을 하면 한쪽만 500으로 남는다.
 */
export class YearQueryDto {
  @IsOptional()
  @Matches(yearInputPattern())
  year?: string;
}

/**
 * DELETE /v1/expenses/:expenseId's optional expectedVersion, carried as a query
 * param (chosen consistently over a DELETE body -- see design doc §2.2 and
 * expenses.controller.ts).
 */
export class ExpenseDeleteQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
