// REP-105: period-field input tolerance. Real-server testing found clients
// juggling two period spellings — budget PUT required `YYYY-MM-DD` while the
// report queries required `YYYY-MM`, and responses echo the internal
// first-of-month form `YYYY-MM-01`. Inputs are now tolerant: every yearMonth
// input accepts BOTH `YYYY-MM` and `YYYY-MM-01`, and is normalized at the DTO
// boundary to the internal first-of-month form (`YYYY-MM-01`) the service
// already uses (see onboarding/store-shared.ts currentYearMonth /
// getSeoulMonthRange). Response shapes are unchanged.
//
// Deliberately NOT accepted: any other day-of-month (e.g. `2026-08-15`). A
// mid-month date silently truncated to its month could hide a client bug
// (a spentOn date pasted into a period field), so those fail validation with
// the standard VALIDATION_ERROR envelope instead.

/**
 * 기간 필드가 받는 **연도의 창**. 두 끝 모두 이 도메인의 판단이지 `Date`의 한계가 아니다
 * (`Date`가 버티는 연 275760은 여기서 아무 의미가 없다).
 *
 * - 하한 1900: 이 앱이 손으로 적을 수 있는 가장 먼 과거는 지출 발생일의 바닥,
 *   `ENTRY_DATE_MAX_PAST_MONTHS`(240개월 = 20년, packages/domain/src/money-date.ts)다.
 *   2026년 기준 그 바닥은 2006년이고, 1900은 거기서 다시 100년 아래다 — 앱이 얼마나
 *   오래 살아도(2126년이면 바닥이 2106년) 하한이 정상 입력을 무는 일은 없다.
 * - 상한 2200: 이 앱의 미래 지평은 "임신(최대 만삭 10개월) + 첫돌(12개월)" ≈ 오늘+2년이다.
 *   예산·리포트가 그보다 앞을 볼 이유가 없다. 2200은 그 지평의 175년 위이고, 실제로
 *   저장소에 존재하는 가장 먼 연도 픽스처(모바일 `recurring-template.test.ts`의
 *   `2100-02`, `stage-bands.test.ts`의 `2100-01-15`)보다도 한 세기 위라 정상 입력을
 *   새로 막지 않는다.
 *
 * 이 두 숫자는 `YEAR_RANGE_SOURCE`가 손으로 옮겨 적은 것이라, 둘이 같은 집합을 뜻하는지는
 * `apps/api/test/report-year-bound.e2e.test.ts`가 0000~9999 전수로 확인한다.
 */
const REPORT_YEAR_MIN = 1900;
const REPORT_YEAR_MAX = 2200;

/** 위 창을 그대로 옮긴 4자리 연도 조각 — 1900..1999 · 2000..2099 · 2100..2199 · 2200. */
const YEAR_RANGE_SOURCE = "(19\\d{2}|20\\d{2}|21\\d{2}|2200)";

/**
 * Accepts `YYYY-MM` or `YYYY-MM-01` only — see the tolerance note above. The
 * month is bounded to 01-12: an unbounded `\d{2}` let values like `2026-13` /
 * `2026-00` through validation only to blow up later in getSeoulMonthRange
 * (an Invalid Date → 500 instead of a 400 VALIDATION_ERROR).
 *
 * ⚠️ 두 시점 — **연도에도 같은 병이 남아 있었다**. 종전 이 자리는 `\d{4}`였고, 그때는 참인
 * 판단이었다: 위 주석이 고친 것은 "존재하지 않는 달"이었고 연도는 네 자리면 달력상 실존하니
 * 더 볼 것이 없어 보였다. 그런데 `getSeoulMonthRange`는 **다음 달**을 문자열 산술로 만들고
 * (`${nextYear}-${pad2(nextMonth)}-01`) 그 nextYear는 `Number`라 0채움이 없다. 그래서
 * `0001-01` → `1-02-01`, `9999-12` → `10000-01-01`이 되고, 둘 다 `new Date(...)`가
 * Invalid Date다 → Prisma가 `PrismaClientValidationError`를 던지고 그것은 HttpException이
 * 아니라 GlobalExceptionFilter가 **500**으로 내보낸다. 실측(이 저장소, @prisma/client 6.19.3):
 * `yearMonth`는 0001-01~0999-11의 11,987개와 `9999-12`까지 11,988개 값이, 맨 연도(`?year=`)는
 * 0001~0998과 9999의 999개 값이 전부 500이었다. 그 중 `PUT /budget`은 **행을 커밋한 뒤** 500을
 * 내므로 그 달의 `GET /budget`이 그 뒤로 계속 500이 됐다(400이면 애초에 행이 없다).
 *
 * 이제 연도도 `YEAR_RANGE_SOURCE`로 묶는다. 상한·하한을 `Date`가 아니라 도메인에서 고르는
 * 근거는 위 상수 주석에 있다. 월을 묶은 것과 **같은 자리·같은 방식**이라, 이 패턴 하나로
 * finance/dto/query.dto.ts의 세 DTO와 onboarding/dto/upsert-budget.dto.ts,
 * onboarding/budgets.controller.ts의 BudgetQueryDto가 한꺼번에 400으로 갈린다.
 */
export const YEAR_MONTH_INPUT_PATTERN = new RegExp(`^${YEAR_RANGE_SOURCE}-(0[1-9]|1[0-2])(-01)?$`);

/**
 * 맨 연도(`?year=9999`)용 패턴. `GET /reports/yearly`와 `GET /reports/category`의 `year`가
 * 종전에는 각자 `/^\d{4}$/`를 적고 있었고(그때는 참: 형식만 보면 네 자리가 맞다), 그 값은
 * ReportingStoreService의 `requireValidYear`도 같은 `/^\d{4}$/`로만 보고 통과시킨 뒤
 * `Number(year) + 1`로 다음 해 경계를 만들어 위와 똑같이 터졌다. 이제 두 DTO가 이 패턴을
 * 함께 쓴다 — 상한을 한 곳(`REPORT_YEAR_MIN`/`REPORT_YEAR_MAX`)에만 적기 위함이다.
 *
 * `export const`가 아니라 함수인 것은 앱 소스의 신규 심볼 관례를 따른 것이고, 데코레이터
 * (`@Matches(yearInputPattern())`)는 클래스 정의 시점에 한 번 호출한다.
 */
export function yearInputPattern(): RegExp {
  return new RegExp(`^${YEAR_RANGE_SOURCE}$`);
}

/** 위 창의 두 끝 — 정규식과 숫자가 같은 집합을 뜻하는지 테스트가 읽어 확인한다. */
export function reportYearRange(): { min: number; max: number } {
  return { min: REPORT_YEAR_MIN, max: REPORT_YEAR_MAX };
}

/**
 * class-transformer @Transform hook: widens `YYYY-MM` to the internal
 * `YYYY-MM-01` form. Any other value (including invalid strings and
 * non-strings) passes through untouched so the @Matches validator — not this
 * transform — is what rejects it, keeping the existing validation error style.
 */
export function normalizeYearMonthInput(value: unknown): unknown {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}
