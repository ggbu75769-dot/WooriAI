import type { Expense } from "../api/client";
import { EXPORT_MAX_ROWS } from "./expense-csv";

/**
 * EXP-106 데이터 내보내기: fetch-scope logic for the export range picker.
 *
 * The expense-listing endpoint the records tab and reports already use —
 * `listExpenses(token, childId, yearMonth)` in src/api/client.ts — is scoped to a single
 * yearMonth (no cursor/offset pagination within a month), so multi-month ranges are collected
 * by looping that same function month by month. The fetcher is injected so this module stays
 * pure/testable and never imports the network client at runtime.
 *
 * Every range is collected **newest month first** (GAP-056 #9), so a run that hits the row cap
 * keeps the most recent history and drops the oldest. The returned list is still sorted ascending.
 *
 * Ranges:
 * - "month" (이번 달): just the current Seoul yearMonth.
 * - "year" (올해): January of the current Seoul year through the current month.
 * - "all" (전체): walk backward from the current month until ALL_EMPTY_MONTH_STOP consecutive
 *   empty months are seen (there is no "first expense date" endpoint, so an empty-streak stop
 *   is the pragmatic bound), capped at ALL_MAX_MONTHS lookback either way.
 * - "custom" (직접 선택, GAP-054 D#11): a closed 시작 달~끝 달 yearMonth range the user picks.
 *   라운드 54 P2-10부터 "all"과 같은 방식으로 걷는다 -- 최신 달부터 거슬러 올라가며
 *   ALL_EMPTY_MONTH_STOP 연속 빈 달에서 멈춘다(120개월을 고른 사용자에게 120번의 왕복을
 *   물리지 않는다). 근거는 collectExpensesForRange의 해당 분기 주석.
 *
 * Rows are capped at EXPORT_MAX_ROWS (5000); truncation is reported via the `truncated` flag so
 * the UI can surface it in a toast — CSV has no comment syntax to carry the notice in-band.
 *
 * ## GAP-054 D#11 — 왜 사용자 지정 기간인가
 *
 * 고정 3구간(이번 달·올해·전체)은 실제로 필요한 기간의 대부분을 비켜 간다. 산후조리원 정산은
 * "작년 11월~올해 1월"이고 연말정산 자료는 "작년 1월~작년 12월"인데, 앱이 줄 수 있는 답은
 * "올해"(작년이 통째로 빠진다) 아니면 "전체"(10년치를 받아 엑셀에서 직접 잘라야 한다)뿐이었다.
 * 데이터 이동성이 "가져갈 수는 있으나 원하는 만큼은 아니다"에서 멈춰 있던 자리다.
 *
 * 판정은 전부 이 순수 모듈에 둔다 — 화면은 시작/끝 달 두 값을 들고 스텝 버튼만 누른다:
 *  - `normalizeCustomRange` : 형식 오염 · **미래 달** · **시작>끝** · 과도한 길이를 한 곳에서 막는다.
 *  - `yearMonthsBetween`    : 실제로 요청할 달 목록(오름차순).
 *  - `isExpenseInCustomRange`: 행 필터. 월별 페처가 그 달만 준다는 전제가 깨져도 범위 밖 행이
 *    CSV에 실리지 않게 하는 마지막 방어선이다(허위 데이터 표시 금지와 같은 판단).
 *  - `exportFileName`       : 저장할 파일 이름. 이 흐름은 파일을 만들지 않고 **텍스트**를 공유하므로
 *    (share-csv.ts) 사용자가 붙여 넣은 뒤 직접 이름을 붙여야 한다 — 그 이름을 화면이 미리 말해 준다.
 */

export type ExportRange = "month" | "year" | "all" | "custom";

export const EXPORT_RANGE_OPTIONS: Array<{ value: ExportRange; label: string }> = [
  { value: "month", label: "이번 달" },
  { value: "year", label: "올해" },
  { value: "all", label: "전체" },
  { value: "custom", label: "직접 선택" }
];

/** Stop the "전체" backward walk after this many consecutive months with zero expenses. */
export const ALL_EMPTY_MONTH_STOP = 12;
/** Absolute lookback bound for the "전체" walk, in months (10 years). */
export const ALL_MAX_MONTHS = 120;

/** GAP-054 D#11: 사용자가 고른 닫힌 달 범위(양끝 포함). 둘 다 `YYYY-MM`. */
export type CustomExportRange = { startYearMonth: string; endYearMonth: string };

/**
 * 사용자 지정 범위가 담을 수 있는 최대 달 수(10년). `ALL_MAX_MONTHS`와 **같은 값을 재사용**한다 --
 * "전체"보다 넓은 범위를 직접 선택으로 만들 수 있으면 두 구간의 의미가 뒤집힌다.
 */
export const CUSTOM_RANGE_MAX_MONTHS = ALL_MAX_MONTHS;

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` 형식인가. 아니면 이 모듈은 그 값을 해석하지 않는다(없는 달을 지어내지 않는다). */
export function isYearMonth(value: unknown): value is string {
  return typeof value === "string" && YEAR_MONTH_PATTERN.test(value);
}

/** `YYYY-MM` → 1970-01부터의 달 서수. 형식이 어긋나면 null. */
function monthOrdinal(yearMonth: string): number | null {
  if (!isYearMonth(yearMonth)) return null;
  return Number(yearMonth.slice(0, 4)) * 12 + (Number(yearMonth.slice(5, 7)) - 1);
}

function yearMonthFromOrdinal(ordinal: number): string {
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** `"2026-08"`을 delta개월 옮긴다(음수 = 과거). 형식이 어긋나면 그대로 돌려준다. */
export function addMonthsToYearMonth(yearMonth: string, delta: number): string {
  const ordinal = monthOrdinal(yearMonth);
  if (ordinal === null) return yearMonth;
  return yearMonthFromOrdinal(ordinal + delta);
}

/** `"2026-08"` → `"2026년 8월"`. 형식이 어긋나면 원본을 그대로 돌려준다(지어내지 않는다). */
export function yearMonthLabel(yearMonth: string): string {
  if (!isYearMonth(yearMonth)) return yearMonth;
  return `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5, 7))}월`;
}

/**
 * 사용자 지정 범위가 움직일 수 있는 양 끝.
 *
 * `latest`는 **보고 있는 오늘의 달**이다 — 기록 탭·리포트 탭의 "다음 기간" 잠금과 같은 규칙
 * (src/period-navigation.ts의 `canGoToNextPeriod`)이라, 화면마다 미래 처리가 갈리지 않는다.
 * 아직 오지 않은 달을 고를 수 있게 하면 언제나 0건인 기간을 고르는 길이 열릴 뿐이다.
 */
export function customRangeBounds(todaySeoul: string): { earliest: string; latest: string } {
  const latest = isYearMonth(todaySeoul.slice(0, 7)) ? todaySeoul.slice(0, 7) : "1970-01";
  return { earliest: addMonthsToYearMonth(latest, -(CUSTOM_RANGE_MAX_MONTHS - 1)), latest };
}

/** 화면이 아직 아무것도 고르지 않았을 때의 기본값 — 이번 달 한 달(고정 "이번 달" 구간과 같다). */
export function defaultCustomRange(todaySeoul: string): CustomExportRange {
  const { latest } = customRangeBounds(todaySeoul);
  return { startYearMonth: latest, endYearMonth: latest };
}

/**
 * 어떤 입력이 와도 **언제나 유효한 범위**를 돌려준다. 화면의 스텝 버튼이 이미 경계를 막지만
 * (누를 수 없는 방향은 비활성), 판정을 화면에만 두면 저장된 값·딥링크·미래의 다른 진입점에서
 * 다시 갈린다. 규칙:
 *
 *  1. 형식이 어긋난 값은 이번 달로 대체한다(없는 달을 해석하지 않는다).
 *  2. **미래 달은 이번 달로 당긴다** — 위 `customRangeBounds` 주석 참고.
 *  3. **시작>끝이면 두 값을 맞바꾼다.** 잘라 버리면 사용자가 고른 달 하나가 조용히 사라지지만,
 *     맞바꾸면 고른 두 달이 그대로 범위의 양 끝으로 남는다(정보 손실이 없는 쪽을 고른다).
 *  4. 길이가 `CUSTOM_RANGE_MAX_MONTHS`를 넘으면 **시작 달을 앞으로 당겨** 자른다 — 끝(최근)
 *     쪽을 남기는 것은 "전체" 구간이 행 상한에 걸렸을 때 최근 달을 남기는 것과 같은 규칙이다.
 */
export function normalizeCustomRange(
  custom: Partial<CustomExportRange> | null | undefined,
  todaySeoul: string
): CustomExportRange {
  const { earliest, latest } = customRangeBounds(todaySeoul);
  const clamp = (value: string | undefined) => {
    if (!isYearMonth(value)) return latest;
    if (value > latest) return latest;
    if (value < earliest) return earliest;
    return value;
  };

  let start = clamp(custom?.startYearMonth);
  let end = clamp(custom?.endYearMonth);
  if (start > end) [start, end] = [end, start];

  const months = (monthOrdinal(end)! - monthOrdinal(start)!) + 1;
  if (months > CUSTOM_RANGE_MAX_MONTHS) start = addMonthsToYearMonth(end, -(CUSTOM_RANGE_MAX_MONTHS - 1));

  return { startYearMonth: start, endYearMonth: end };
}

/** 스텝 버튼이 눌릴 수 있는가. 눌릴 수 없는 방향은 화면에서 비활성(opacity)으로 말한다. */
export function canShiftCustomRange(
  custom: CustomExportRange,
  edge: "start" | "end",
  delta: number,
  todaySeoul: string
): boolean {
  const { earliest, latest } = customRangeBounds(todaySeoul);
  const range = normalizeCustomRange(custom, todaySeoul);
  const next = addMonthsToYearMonth(edge === "start" ? range.startYearMonth : range.endYearMonth, delta);
  // 시작은 끝을 넘지 못하고, 끝은 시작 아래로 내려가지 못한다 -- 시작>끝 상태가 화면에서
  // 만들어질 수 없다(반대쪽 달을 몰래 끌고 가지도 않는다: 사용자가 고른 값은 사용자만 바꾼다).
  if (edge === "start") return next >= earliest && next <= range.endYearMonth;
  return next >= range.startYearMonth && next <= latest;
}

/** 한 쪽 끝을 delta개월 옮긴 새 범위. 경계를 넘으면 아무것도 바뀌지 않는다. */
export function shiftCustomRange(
  custom: CustomExportRange,
  edge: "start" | "end",
  delta: number,
  todaySeoul: string
): CustomExportRange {
  const range = normalizeCustomRange(custom, todaySeoul);
  if (!canShiftCustomRange(range, edge, delta, todaySeoul)) return range;
  return edge === "start"
    ? { ...range, startYearMonth: addMonthsToYearMonth(range.startYearMonth, delta) }
    : { ...range, endYearMonth: addMonthsToYearMonth(range.endYearMonth, delta) };
}

/** 범위 안의 모든 `YYYY-MM`(오름차순, 양끝 포함). */
export function yearMonthsBetween(range: CustomExportRange): string[] {
  const startOrdinal = monthOrdinal(range.startYearMonth);
  const endOrdinal = monthOrdinal(range.endYearMonth);
  if (startOrdinal === null || endOrdinal === null || endOrdinal < startOrdinal) return [];
  const months: string[] = [];
  for (let ordinal = startOrdinal; ordinal <= endOrdinal; ordinal += 1) months.push(yearMonthFromOrdinal(ordinal));
  return months;
}

/**
 * 행 필터. 월별 페처가 "그 달 전량"을 준다는 전제가 어떤 이유로든 깨져도(캐시 오염·서버 변경)
 * 사용자가 고르지 않은 달의 기록이 CSV에 실리지 않게 하는 마지막 방어선이다.
 * `spentOn`은 서버 계약상 `YYYY-MM-DD`이고, 앞 7글자 문자열 비교가 곧 달 비교다.
 */
export function isExpenseInCustomRange(expense: { spentOn: string }, range: CustomExportRange): boolean {
  const yearMonth = (expense?.spentOn ?? "").slice(0, 7);
  if (!isYearMonth(yearMonth)) return false;
  return yearMonth >= range.startYearMonth && yearMonth <= range.endYearMonth;
}

/** 화면이 읽어 주는 기간 문장 — "2025년 11월~2026년 1월"(한 달이면 달 이름 하나). */
export function customRangeLabel(range: CustomExportRange): string {
  return range.startYearMonth === range.endYearMonth
    ? yearMonthLabel(range.startYearMonth)
    : `${yearMonthLabel(range.startYearMonth)}~${yearMonthLabel(range.endYearMonth)}`;
}

/** 파일 이름 접두 — 앱 이름과 무엇이 담겼는지. 공백을 쓰지 않아 어느 OS에서도 그대로 쓸 수 있다. */
const EXPORT_FILE_NAME_PREFIX = "우리아이-지출";

/**
 * 파일 이름에 실을 수 있는 아이 이름의 최대 글자 수.
 *
 * 태명 컬럼은 `VarChar(60)`이라(apps/api prisma schema의 `Child.nickname`) 60자짜리 이름이
 * 실제로 저장될 수 있다. 그 길이를 그대로 이름 가운데에 끼우면 기간이 뒤로 밀려 **파일 목록에서
 * 잘려 보이는 쪽이 기간**이 된다 — 이 이름이 존재하는 이유(무엇이 담겼는지 파일만 보고 안다)를
 * 스스로 깨는 셈이다. 20자면 태명이 잘리는 일은 사실상 없고, 잘리더라도 앞부분이 남아 두 아이를
 * 구별하는 목적은 그대로 선다.
 */
export const EXPORT_FILE_NAME_CHILD_MAX_LENGTH = 20;

/**
 * 이름에서 떨구는 문자. 두 종류다.
 *  1. **파일 이름에 쓸 수 없는 것**: 경로 구분자(`/` `\`), 윈도우 예약 문자(`: * ? " < > |`), 제어 문자.
 *  2. **이 이름 형식이 스스로 쓰는 구분자**(`-` · `~`). 태명에 그 글자가 들어 있으면 사람도 기계도
 *     어디까지가 이름이고 어디부터가 기간인지 셀 수 없다(`우리아이-지출-다-온-2026-08.csv`).
 * 공백은 아래에서 따로 떨군다(접두가 이미 "공백을 쓰지 않는다"는 규칙을 세워 두었다).
 */
// eslint-disable-next-line no-control-regex
const FILE_NAME_UNSAFE_PATTERN = /[\\/:*?"<>|~\-\u0000-\u001f\u007f]/g;

/**
 * 라운드 66 트랙 B(#3) — 파일 이름에 넣을 수 있는 모양으로 다듬은 아이 이름, 또는 `null`.
 *
 * 다듬은 결과가 비면(이름이 전부 못 쓰는 문자였거나 애초에 없거나) `null`이고, 그때 파일 이름은
 * **종전과 한 글자도 다르지 않다** — 지어낸 자리 채움("아이")을 만들지 않는다. `resolveChildScopeLabel`
 * (src/children/child-switch.ts)이 아이가 하나인 계정에서 이미 `null`을 주므로, 다자녀가 아닌
 * 사용자에게는 이 함수가 애초에 호출되어도 결과가 같다.
 *
 * 새 정규화 규칙을 짓지 않는다: 떨구는 문자 집합은 위 상수 한 곳이고, 잘라 내는 길이도 위 상수
 * 하나다(두 값이 화면·파일 이름으로 갈리지 않게 이 모듈에만 둔다).
 */
export function exportFileNameChildSegment(childLabel: string | null | undefined): string | null {
  if (typeof childLabel !== "string") return null;
  const cleaned = childLabel
    .replace(FILE_NAME_UNSAFE_PATTERN, "")
    // 공백은 붙여 쓴다(접두의 규칙 그대로 — 어느 OS에서도 그대로 쓸 수 있는 이름).
    .replace(/\s+/g, "")
    // 앞뒤 점은 숨김 파일·확장자 오인을 부른다.
    .replace(/^\.+|\.+$/g, "");
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, EXPORT_FILE_NAME_CHILD_MAX_LENGTH);
}

/**
 * 저장할 파일 이름. 이 흐름은 파일을 만들지 않고 **본문 텍스트**를 공유하므로(share-csv.ts),
 * 사용자가 메일·메모에 붙여 넣은 뒤 직접 이름을 붙여야 한다 — 그때 무엇으로 저장해야 기간이
 * 드러나는지를 화면이 미리 말해 준다("붙여 넣고 .csv로 저장하면" 안내와 한 벌이다).
 *
 * ## 라운드 66 트랙 B(#3) — 이름은 **어느 아이인지**도 말한다
 *
 * 예전 주석은 여기서 "아이 이름 같은 개인 정보를 파일 이름에 넣지 않는다"고 못박고 있었다.
 * 그 규칙이 만든 실제 결과가 이것이다: 두 아이를 키우는 사람이 기기를 바꾸기 전에 첫째와 둘째를
 * 각각 내보내면 화면이 **똑같은 이름**을 제시하고, 그대로 저장하면 앞의 파일을 덮어쓴다. 덮어쓴
 * 사실조차 알 수 없다 — CSV 본문에도 아이 열이 없어 **내용으로도 두 파일이 구별되지 않기**
 * 때문이다. 그리고 그 반대편에는 재가져오기가 있어(라운드 65 A), 잘못된 파일을 잘못된 아이에게
 * 넣는 조합이 조용히 성립한다.
 *
 * 판단을 뒤집은 근거는 "새로 드러나는 정보가 없다"는 사실이다: 태명은 사용자가 스스로 지어 화면
 * 곳곳에 이미 떠 있는 값이고, **이 앱의 공유 문구가 이미 같은 값을 싣고 나간다**(마일스톤·월간
 * 공유 카드). 즉 공유 시트에 태명이 등장하는 것 자체는 이번에 생기는 일이 아니다. 그리고 이름은
 * **아이가 둘 이상일 때만** 붙는다(`resolveChildScopeLabel`이 1아이 계정에서 null이다) — 혼동할
 * 사람이 없는 계정에서는 종전 이름 그대로다.
 *
 * **CSV 본문에는 아이 열을 더하지 않는다.** 헤더는 라운드 65 A의 왕복 계약이 걸린 자리이고
 * (apps/api/test/mobile-export-csv-roundtrip.test.ts), 열이 하나 늘면 이미 사용자 손에 나가 있는
 * 파일과 새 파일의 열 수가 갈린다. 아이는 **파일 이름**이 말하는 편이 그 왕복을 건드리지 않는다.
 */
export function exportFileName(input: {
  range: ExportRange;
  todaySeoul: string;
  custom?: Partial<CustomExportRange> | null;
  /** 다자녀 계정의 태명(`resolveChildScopeLabel`). 없으면/1아이면 종전 이름 그대로다. */
  childLabel?: string | null;
}): string {
  const currentYearMonth = customRangeBounds(input.todaySeoul).latest;
  const child = exportFileNameChildSegment(input.childLabel);
  const prefix = child ? `${EXPORT_FILE_NAME_PREFIX}-${child}` : EXPORT_FILE_NAME_PREFIX;
  if (input.range === "custom") {
    const range = normalizeCustomRange(input.custom, input.todaySeoul);
    const span =
      range.startYearMonth === range.endYearMonth
        ? range.startYearMonth
        : `${range.startYearMonth}~${range.endYearMonth}`;
    return `${prefix}-${span}.csv`;
  }
  if (input.range === "year") return `${prefix}-${currentYearMonth.slice(0, 4)}.csv`;
  if (input.range === "all") return `${prefix}-전체.csv`;
  return `${prefix}-${currentYearMonth}.csv`;
}

export type MonthExpenseFetcher = (yearMonth: string) => Promise<Expense[]>;

export type CollectExpensesResult = {
  /** Expenses sorted by spentOn ascending (stable). */
  expenses: Expense[];
  /**
   * 행 상한(EXPORT_MAX_ROWS) 때문에 **오래된 쪽이 빠졌을 수 있는가**.
   *
   * GAP-056 #9 이후 네 구간 모두 최신 달부터 모으므로, 이 플래그가 켜졌을 때 빠질 수 있는 것은
   * 언제나 **오래된 쪽**이다. 화면 문구가 그 방향을 말할 수 있는 근거가 여기다.
   *
   * ## 라운드 57 QA(P2-12) — 세 갈래가 한 규칙을 쓴다 (관측 사실 기반)
   *
   * 예전에는 갈래마다 판정이 달랐다. "전체"는 상한에 닿기만 하면 무조건 `true`였고("잃은 것이
   * 없는" 정확히-상한 경우까지 잘렸다고 말했다), "직접 선택"·닫힌 구간은 `index > 0`을 함께 봤다.
   * 그런데 `index > 0`이 뜻하는 것은 "잘렸다"가 아니라 **"열어 보지 않은 과거 달이 남았다"**이다 —
   * 그 달들이 전부 비어 있었다면 실제로 빠진 행은 하나도 없다. 즉 한쪽은 과하게 알리고, 다른
   * 쪽은 알리는 근거를 사실보다 세게 말하고 있었다.
   *
   * 그래서 규칙을 하나로 맞추되, **수집기가 실제로 관측한 것**만 담는다:
   *
   *     truncated = 행을 실제로 버렸다(collected > maxRows) || 상한 때문에 멈춘 시점에
   *                 아직 **열어 보지 않은** 과거 달이 남아 있다
   *
   * 두 번째 항은 "빠졌다"가 아니라 "확인하지 못했다"이다. 여기서 첫 항만 남기는 선택지도 있었지만,
   * 그러면 상한 때문에 걷다 만 사용자에게 **아무도 아무 말을 하지 않는** 경우가 생긴다(진짜 조용한
   * 손실). 대신 **문구를 그 세기에 맞춘다** — share-payload.ts의 행 상한 문장이 "빠졌어요"가 아니라
   * "빠졌을 수 있어요"라고 말하는 이유가 여기다(허위 단정 금지 = 없는 손실을 단언하지 않는다).
   */
  truncated: boolean;
  /** Number of yearMonth pages fetched (diagnostics/tests). */
  monthsFetched: number;
};

function previousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

/**
 * Chronological (ascending) yearMonth pages for the closed-form ranges.
 *
 * 목록 자체는 오름차순 그대로다 — 요청 순서는 수집기가 정한다(GAP-056 #9: 뒤에서부터 걷는다).
 * 이 함수의 답을 그대로 읽는 곳(테스트·파일 이름)이 방향과 무관하게 "고른 달의 목록"만 알면 된다.
 *
 * GAP-054 D#11: "custom"도 닫힌 구간이라 여기에 합류한다 -- `custom`을 넘기지 않거나 값이
 * 깨져 있으면 `normalizeCustomRange`가 이번 달 한 달로 접는다(없는 달을 요청하지 않는다).
 */
export function yearMonthsForRange(
  range: Exclude<ExportRange, "all">,
  todaySeoul: string,
  custom?: Partial<CustomExportRange> | null
): string[] {
  const currentYearMonth = todaySeoul.slice(0, 7);
  if (range === "month") return [currentYearMonth];
  if (range === "custom") return yearMonthsBetween(normalizeCustomRange(custom, todaySeoul));

  const year = currentYearMonth.slice(0, 4);
  const currentMonth = Number(currentYearMonth.slice(5, 7));
  const months: string[] = [];
  for (let month = 1; month <= currentMonth; month += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function sortBySpentOnAscending(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => (a.spentOn < b.spentOn ? -1 : a.spentOn > b.spentOn ? 1 : 0));
}

/**
 * Collects every expense in `range` for the current child by looping the injected month
 * fetcher to completion, capped at `maxRows` rows.
 *
 * @param fetchMonth typically `(ym) => listExpenses(token, childId, ym).then((r) => r.expenses)`
 * @param todaySeoul a "YYYY-MM-DD" Seoul date, i.e. `getSeoulToday()` from @wooriai/domain
 * @param options.custom GAP-054 D#11 -- `range === "custom"`일 때의 시작/끝 달. 다른 구간에서는
 *   무시되고, 값이 없거나 깨져 있으면 이번 달 한 달로 접힌다(`normalizeCustomRange`).
 */
export async function collectExpensesForRange(
  fetchMonth: MonthExpenseFetcher,
  range: ExportRange,
  todaySeoul: string,
  options: { maxRows?: number; custom?: Partial<CustomExportRange> | null } = {}
): Promise<CollectExpensesResult> {
  const maxRows = options.maxRows ?? EXPORT_MAX_ROWS;
  const collected: Expense[] = [];
  let monthsFetched = 0;
  let truncated = false;

  if (range === "all") {
    let yearMonth = todaySeoul.slice(0, 7);
    let emptyStreak = 0;
    // Newest-first walk; sorted ascending below. When the row cap hits, the walk stops early,
    // so a capped "전체" export keeps the most recent rows.
    for (let step = 0; step < ALL_MAX_MONTHS; step += 1) {
      const pageExpenses = await fetchMonth(yearMonth);
      monthsFetched += 1;
      if (pageExpenses.length === 0) {
        emptyStreak += 1;
        if (emptyStreak >= ALL_EMPTY_MONTH_STOP) break;
      } else {
        emptyStreak = 0;
        collected.push(...pageExpenses);
        if (collected.length >= maxRows) {
          // 라운드 57 QA(P2-12) — 세 갈래가 **한 규칙**을 쓴다(위 `truncated` 주석). 실제로 버린
          // 행이 있거나(> maxRows), 상한 때문에 걷기를 멈춘 시점에 **아직 열어 보지 않은 과거
          // 달**이 남아 있으면 true다. "전체"는 언제 끝날지 모르는 뒤로 걷기라, 마지막 걸음
          // (step === ALL_MAX_MONTHS - 1)에서 상한에 닿은 경우에만 남은 달이 없다.
          truncated = collected.length > maxRows || step < ALL_MAX_MONTHS - 1;
          collected.length = maxRows;
          break;
        }
      }
      yearMonth = previousYearMonth(yearMonth);
    }
  } else if (range === "custom") {
    /**
     * GAP-054 라운드 54 P2-10 — 사용자 지정 기간에도 **연속 빈 달 중단**을 적용한다.
     *
     * 이 구간은 최대 `CUSTOM_RANGE_MAX_MONTHS`(120)개월까지 고를 수 있고, 예전에는 그 달을
     * 하나도 빠짐없이 요청했다. "작년 1월~올해 12월"처럼 넓게 고른 사용자가 실제로는 6개월치
     * 기록만 갖고 있어도 120번의 왕복이 그대로 나간다 -- 느린 회선에서는 내보내기 한 번이
     * 몇 분이 되고, 그 사이 화면은 "내보내는 중..."만 말한다.
     *
     * 그래서 "전체" 구간이 이미 쓰는 규칙을 그대로 가져온다: **최신 달부터 거슬러 올라가며**
     * 연속으로 `ALL_EMPTY_MONTH_STOP`(12)개월이 비면 멈춘다. 방향이 중요하다 -- 오래된 쪽부터
     * 올라오며 멈추면 아직 안 본 최신 달의 기록이 통째로 빠지지만(그것이야말로 조용한 데이터
     * 손실이다), 최신 쪽부터 내려가며 멈추는 것은 "기록이 시작되기 전"에 도달했다는 뜻이다.
     *
     * 감수하는 것은 "전체"와 **정확히 같은 트레이드오프**다: 기록 이력 한가운데에 12개월보다
     * 긴 공백이 있으면 그 너머는 따라가지 않는다. 두 구간이 같은 상수·같은 근거를 쓰므로
     * 한쪽만 바뀌어 서로 다른 답을 내놓는 일이 없다.
     *
     * 행 상한에 걸렸을 때 **최근 달을 남기는** 것도 "전체"와 같다(그리고 `normalizeCustomRange`가
     * 길이를 자를 때 끝 쪽을 남기는 것과 같은 규칙이다).
     */
    const customRange = normalizeCustomRange(options.custom, todaySeoul);
    const months = yearMonthsBetween(customRange);
    let emptyStreak = 0;
    for (let index = months.length - 1; index >= 0; index -= 1) {
      // GAP-054 D#11 행 필터: 월별 페처가 "그 달 전량"만 준다는 전제가 깨져도 사용자가 고르지
      // 않은 달의 기록이 CSV에 실리지 않는다.
      const pageExpenses = (await fetchMonth(months[index])).filter((expense) =>
        isExpenseInCustomRange(expense, customRange)
      );
      monthsFetched += 1;
      if (pageExpenses.length === 0) {
        emptyStreak += 1;
        if (emptyStreak >= ALL_EMPTY_MONTH_STOP) break;
        continue;
      }
      emptyStreak = 0;
      collected.push(...pageExpenses);
      if (collected.length >= maxRows) {
        // 세 갈래 공통 규칙(위 `truncated` 주석): 행을 실제로 버렸거나(>), 상한 때문에 멈춘
        // 시점에 아직 **열어 보지 않은** 과거 달이 남아 있으면(index > 0) true다.
        truncated = collected.length > maxRows || index > 0;
        collected.length = maxRows;
        break;
      }
    }
  } else {
    /**
     * Closed-form pages (이번 달 1개, 올해 = 최대 12개).
     *
     * GAP-056 #9 — 이 구간도 **최신 달부터 거슬러** 모은다.
     *
     * 예전에는 1월부터 오름차순으로 전부 받은 뒤 `collected.length = maxRows`로 잘랐다. 그
     * 방향이면 상한에 걸렸을 때 남는 것이 **1월·2월**이고 버려지는 것이 이번 달이다 — 사용자가
     * "올해"를 내보내는 이유(가장 최근까지의 기록)와 정반대의 파일이 나간다. "전체"·"직접 선택"은
     * 이미 최신 달부터 걸으므로 같은 앱 안에서 두 구간이 서로 반대로 잘리고 있었다.
     *
     * 이제 세 구간이 한 규칙이다: **상한에 닿으면 오래된 쪽이 빠진다.** 잘림 사실은 아래
     * `truncated`로 나가고, 어느 쪽이 빠졌는지는 화면 문구가 말한다(share-payload.ts의
     * `csvShareToastMessage`).
     *
     * 빈 달 중단은 여기에 들이지 않는다 — 두 구간 모두 최대 12개월이라 아낄 왕복이 없고, 그
     * 규칙은 "기록이 시작되기 전"을 찾는 장치라 한 해 안에서는 의미가 없다. 상한에 닿는 순간
     * 걷기를 멈추는 것은 "전체"·"직접 선택"과 같다(더 받아 봐야 버릴 행이다).
     */
    const months = yearMonthsForRange(range, todaySeoul, options.custom);
    for (let index = months.length - 1; index >= 0; index -= 1) {
      const pageExpenses = await fetchMonth(months[index]);
      monthsFetched += 1;
      if (pageExpenses.length === 0) continue;
      collected.push(...pageExpenses);
      if (collected.length >= maxRows) {
        // "전체"·"직접 선택"과 **같은 규칙**(위 `truncated` 주석): 행을 실제로 버렸거나(>),
        // 상한 때문에 멈춘 시점에 아직 열어 보지 않은 과거 달이 남아 있으면(index > 0) true다.
        truncated = collected.length > maxRows || index > 0;
        collected.length = maxRows;
        break;
      }
    }
  }

  return { expenses: sortBySpentOnAscending(collected), truncated, monthsFetched };
}
