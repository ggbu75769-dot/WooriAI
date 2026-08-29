const SEOUL_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SeoulMonthRange = {
  yearMonth: string;
  startInclusive: string;
  endExclusive: string;
};

/**
 * GAP-054 라운드 54 P1-1 — 원화 금액 한 건의 **상한**. 계약이자 물리적 사실이다.
 *
 * `expenses.amount_krw` · `budgets.amount_krw`는 Postgres `int4`라 2,147,483,647을 넘는 값은
 * 저장이 아니라 5xx로 끝난다. 지금까지 이 상한은 계약 층(`@wooriai/contracts`의
 * `MONEY_KRW_MAX`)과 서버 DTO(`@Max`)에만 있었고 **도메인 술어에는 없었다.** 그래서
 * `isMoneyKrw`/`assertMoneyKrw`만 지나는 경로 — 엑셀 가져오기 검증
 * (apps/api/src/onboarding/import-pipeline.service.ts의 `validationStatusForImportRow` →
 * `requireMoneyKrw`) — 이 int4를 넘는 행을 `valid`로 판정했다. 그 행은 미리보기에서
 * 기본 선택까지 되고, 확정 트랜잭션의 insert에서 DB가 터져 **파일 전체가 롤백**된다:
 * 한 행 때문에 2,000행짜리 가져오기가 통째로 거절되고, 사용자에게는 어느 행이 문제인지
 * 알려 줄 자리조차 없었다.
 *
 * 그래서 상한을 **가장 아래층(도메인)** 에 둔다. contracts는 이 값을 그대로 재수출하고
 * (`packages/contracts/src/schemas.ts`), 서버 DTO·모바일 입력 가드는 종전대로 그 값을 문다 —
 * 의존 방향(domain ← contracts ← api)을 거스르지 않으면서 숫자가 한 곳에만 남는다.
 *
 * ⚠️ **합계·집계에는 쓰지 않는다.** 여러 건을 더한 값은 이 상한을 넘을 수 있다(월 합계·연간
 * 리포트). 이 상수와 아래 두 술어는 **한 건**의 금액에만 적용된다.
 */
export const MONEY_KRW_MAX = 2_147_483_647;

/** 한 건의 원화 금액인가 — 1원 이상 `MONEY_KRW_MAX`(int4 상한) 이하의 정수. */
export function isMoneyKrw(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MONEY_KRW_MAX;
}

export function assertMoneyKrw(value: unknown): number {
  if (!isMoneyKrw(value)) {
    throw new Error("EXPENSE_AMOUNT_INVALID: amountKrw must be a positive KRW integer");
  }

  return value;
}

export function getSeoulToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("SEOUL_DATE_FORMAT_FAILED");
  }

  return `${year}-${month}-${day}`;
}

export function getSeoulMonthRange(yearMonthOrDate: string): SeoulMonthRange {
  const [yearText, monthText] = yearMonthOrDate.slice(0, 7).split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("YEAR_MONTH_INVALID");
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    yearMonth: `${yearText}-${monthText}-01`,
    startInclusive: `${yearText}-${monthText}-01`,
    endExclusive: `${nextYear}-${pad2(nextMonth)}-01`
  };
}

/**
 * 라운드 68 A — 사람이 손으로 적는 날짜(지출 발생일 · 아이 출생일)의 **과거 하한**: 20년.
 *
 * ## 왜 도메인에 있는가
 * 이 숫자는 원래 모바일 한 곳에만 있었다(`apps/mobile/src/expenses/import-landing-month.ts`의
 * `MAX_PAST_MONTH_OFFSET` = 240). **읽는 쪽 넷**은 전부 그 값에서 바닥을 얻는데(달력 픽커 ·
 * 기록 탭 딥링크 · 달 점프 시트의 절대 하한 · 그 파생) **쓰는 쪽 셋**에는 바닥이 하나도
 * 없었다: 앱 폼 두 화면 · 서버 `assertNotFutureDate` · 엑셀 가져오기 행 판정. 그래서
 * `2026-08-14`를 `2016-08-14`로 한 자리 잘못 치면 형식도 맞고 실존하며 미래도 아니라 **저장됐고**,
 * 그 지출은 **누적 총액에는 들어가는데**(전 기간 서버 집계) 어느 읽기 화면에서도 그 달로 갈 수
 * 없어 사용자가 찾아가 지울 수조차 없었다.
 *
 * 서버는 `apps/mobile`을 import할 수 없다. 그러니 두 층이 각자 240을 적으면 한쪽만 바뀌는
 * 드리프트가 확정이다(라운드 54 P2-8: 주석은 드리프트를 막지 못한다). `MONEY_KRW_MAX`가
 * int4 상한을 도메인에 두고 contracts·서버 DTO·모바일 가드가 그 값을 물게 한 것과 **같은
 * 형태**로, 이 판단도 가장 아래층에 값으로 둔다. 모바일의 `MAX_PAST_MONTH_OFFSET`은 이제 이
 * 상수를 그대로 읽는다(값·이름·동작 전부 종전과 같다).
 *
 * ## 도메인 "사실"이 아니라 제품 판단이다
 * 만삭(라운드 67 B)과 달리 물어 읽을 도메인 사실이 없다 — "가계부 입력이 도달할 이유가 없는
 * 과거"라는 제품 판단이고, 그래서 숫자로 적는다. 판단을 값으로 적어 두지 않으면 다음 라운드가
 * 두 벌로 되돌린다.
 */
export const ENTRY_DATE_MAX_PAST_MONTHS = 240;

/** 위 상수를 사람이 읽는 단위로 — 오류 문구가 "20년"이라고 말할 때 그 20이 여기서 온다. */
export const ENTRY_DATE_MAX_PAST_YEARS = ENTRY_DATE_MAX_PAST_MONTHS / 12;

/**
 * 손으로 적을 수 있는 가장 이른 날짜(`YYYY-MM-DD`) — **240개월 전 달의 1일**.
 *
 * 왜 "그 달의 1일"인가: 읽는 쪽의 축이 **달**이기 때문이다. 달력 픽커는 오프셋 -240인 달까지
 * ‹ 로 내려갈 수 있고 그 달 안의 모든 날을 고를 수 있다(date-picker-month.ts의
 * `canGoToPreviousMonth`). 하한을 "오늘로부터 240개월 전 같은 날"로 잡으면 픽커가 고를 수 있는
 * 날 중 앞쪽 며칠이 저장 직전에 거절된다 — **쓰기는 읽기보다 좁아서는 안 된다**. 반대로 더
 * 넓히면 기록 탭이 열어 주지 못하는 달의 지출이 다시 생긴다. 그래서 정확히 그 경계다.
 *
 * 달 계산은 `apps/mobile/src/month-jump.ts`의 절대 하한과 **같은 식**이다(년×12 + 월-1 - 240).
 */
export function getEntryDateFloor(now: Date = new Date()): string {
  const today = getSeoulToday(now);
  const zeroBased = Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1) - ENTRY_DATE_MAX_PAST_MONTHS;
  const year = Math.floor(zeroBased / 12);
  const month = zeroBased - year * 12 + 1;
  return `${String(year).padStart(4, "0")}-${pad2(month)}-01`;
}

/**
 * 이 날짜가 하한보다 이른가. 하한 당일은 **통과**한다(픽커가 고를 수 있게 열어 두는 날이다).
 *
 * 형식이 깨진 값에서 `isFutureSeoulDate`와 **같은 방식으로** 던진다 — 두 술어가 같은 자리에서
 * 나란히 불리므로(폼 가드·서버 가드), 하나만 조용히 false를 돌려주면 호출부가 두 갈래를
 * 서로 다르게 다루게 된다.
 */
export function isBeforeEntryDateFloor(dateOnly: string, now: Date = new Date()): boolean {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("DATE_INVALID");
  }

  return dateOnly < getEntryDateFloor(now);
}

export function isFutureSeoulDate(dateOnly: string, now: Date = new Date()): boolean {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("DATE_INVALID");
  }

  return dateOnly > getSeoulToday(now);
}

export function isValidCalendarDate(dateOnly: string): boolean {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    return false;
  }

  const [yearText, monthText, dayText] = dateOnly.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
