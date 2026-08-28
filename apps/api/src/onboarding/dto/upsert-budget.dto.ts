import { Transform } from "class-transformer";
import { IsInt, Matches, Max, Min } from "class-validator";
import { MONEY_KRW_MAX } from "@wooriai/contracts";
import { YEAR_MONTH_INPUT_PATTERN, normalizeYearMonthInput } from "../../common/validation/year-month";

export class UpsertBudgetDto {
  // REP-105 contract tolerance: accepts `YYYY-MM` or `YYYY-MM-01` (previously
  // `YYYY-MM-DD` only) and normalizes to the internal first-of-month form
  // `YYYY-MM-01` before the service sees it. Other days (e.g. 2026-08-15) are
  // rejected as VALIDATION_ERROR — see common/validation/year-month.ts.
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
}
