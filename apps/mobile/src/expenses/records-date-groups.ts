import { getSeoulToday } from "@wooriai/domain";
import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { formatSpentOn } from "./records-list-view";

/**
 * UX-B: 기록 탭을 "평평한 지출 나열"이 아니라 **가계부처럼** 읽히게 만드는 날짜 그룹핑.
 *
 * 왜 필요한가: 기록 탭은 한 달치 행을 날짜 구분 없이 한 줄씩 이어 그렸다. 행마다 "8월 27일"이
 * 부제에 들어 있긴 했지만, 같은 날 5건을 적어도 그 다섯 줄이 하루라는 사실이 눈에 들어오지
 * 않았고 "그날 얼마 썼는지"는 사용자가 직접 더해야만 알 수 있었다. 스크롤만으로 그날의 합이
 * 보이면 핵심 루프(지출 기록 → 총액 확인)의 "총액 확인"이 월 단위 한 숫자에서 일 단위까지
 * 내려온다.
 *
 * React / React Native를 import하지 않는 **순수 모듈**이다(같은 폴더 records-list-view.ts,
 * offline/expense-list-reconciliation.ts와 같은 규율) — 그래야 라벨·정렬·소계 규칙을 화면을
 * 띄우지 않고 그대로 단위 테스트할 수 있다.
 *
 * 소계 규칙(DNC-015)은 **새로 만들지 않는다**: 화면 상단 월 합계가 쓰는 바로 그 술어
 * `countsTowardMonthlyTotal`(선물·환불 제외)을 그대로 import한다. 규칙이 두 벌이 되면 같은
 * 화면 안에서 "일별 소계의 합 ≠ 월 합계"가 되고, 그 불일치 자체가 허위 표시다.
 */

/** 일(요일) 표기 — Date의 요일 인덱스(일=0)와 같은 순서. */
const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** `groupExpensesByDate`가 행에서 필요로 하는 구조적 최소치. */
export type GroupableExpenseRow = {
  /** "YYYY-MM-DD"(서버 toExpenseDto의 date-only 포맷). */
  spentOn: string;
  amountKrw: number;
  /** 없으면 일반 지출로 본다 — `countsTowardMonthlyTotal`의 레거시 관례와 동일. */
  expenseType?: string | null;
};

export type RecordsDateGroup<TRow> = {
  /** 원본 `spentOn` 문자열. SectionList의 섹션 key로 그대로 쓴다. */
  key: string;
  /** 달력 표기 "8월 27일 (수)". 파싱할 수 없는 값은 원본을 그대로 통과시킨다. */
  dateLabel: string;
  /** 실제로 헤더에 그릴 문자열 — 오늘/어제는 "오늘"·"어제", 그 밖에는 `dateLabel`. */
  headerLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  /** 합산 대상 행(선물·환불 제외)의 합. `hasSubtotal`이 false면 의미가 없는 0이다. */
  subtotalKrw: number;
  /**
   * 그날 **합산 대상 행이 하나라도** 있는지. 선물·환불만 있는 날에 "0원"을 찍으면 "그날 아무것도
   * 안 썼다"는 뜻으로 읽히는데, 그 날에는 선물이 두 건 있었을 수도 있다. 화면은 이 값이 false면
   * 소계를 **숨기고 행만** 그린다(선물·환불 행 자체는 구분 접두 그대로 계속 보인다).
   */
  hasSubtotal: boolean;
  rows: TRow[];
};

/** "YYYY-MM-DD" → {year, month, day}, 아니면 null. */
function parseIsoDateParts(spentOn: string): { year: number; month: number; day: number } | null {
  const parts = spentOn.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * 서울 달력 날짜의 요일 라벨, 파싱 불가면 null.
 *
 * `spentOn`은 **시각이 없는 달력 날짜**이므로 UTC 자정으로 만들어 `getUTCDay()`로 읽는다.
 * `new Date("2026-08-27")`(로컬 파싱)나 `getDay()`를 쓰면 기기 타임존이 KST가 아닐 때
 * 하루가 밀려 "8월 27일 (화)" 같은 **틀린 요일**이 나온다 — 날짜 헤더에서 그건 곧 허위 표시다.
 */
export function weekdayLabelKo(spentOn: string): string | null {
  const parts = parseIsoDateParts(spentOn);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  // 실재하지 않는 날짜(2026-02-31 등)는 Date가 조용히 다음 달로 넘겨 버린다 — 그런 값에
  // 그럴듯한 요일을 붙이느니 요일을 생략한다.
  if (utc.getUTCMonth() !== parts.month - 1 || utc.getUTCDate() !== parts.day) return null;
  return WEEKDAY_LABELS_KO[utc.getUTCDay()];
}

/**
 * 날짜 헤더의 달력 표기 — "8월 27일 (수)".
 *
 * 월/일 포맷은 홈·기록 행 부제와 같은 `formatSpentOn`을 그대로 쓴다(두 곳이 갈리지 않도록).
 * 요일을 붙일 수 없으면 `formatSpentOn`의 결과를 그대로 돌려준다 — 원본 통과 규칙 유지.
 */
export function formatSpentOnWithWeekday(spentOn: string): string {
  const base = formatSpentOn(spentOn);
  const weekday = weekdayLabelKo(spentOn);
  return weekday ? `${base} (${weekday})` : base;
}

/** "YYYY-MM-DD"에서 `days`일 이동한 같은 포맷 문자열, 파싱 불가면 null. */
export function shiftIsoDate(iso: string, days: number): string | null {
  const parts = parseIsoDateParts(iso);
  if (!parts) return null;
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  const year = String(shifted.getUTCFullYear()).padStart(4, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 기록 탭 목록 행을 **날짜별 그룹**으로 묶는다.
 *
 * 규칙:
 *  - 그룹 키는 행의 `spentOn` 원본. 최신 날짜가 먼저다(기존 목록 정렬과 같은 방향);
 *  - 그룹 **안**의 행 순서는 입력 순서를 그대로 보존한다 — 화면이 오프라인 대기 행을 서버 행
 *    앞에 두는 기존 순서가 날짜 안에서도 유지된다;
 *  - 소계는 `countsTowardMonthlyTotal`을 통과한 행만 더한다(DNC-015: 선물·환불 제외). 통과한
 *    행이 하나도 없으면 `hasSubtotal: false` — 화면이 소계를 숨긴다(0원을 찍지 않는다);
 *  - 필터(카테고리 칩·검색)가 걸린 목록을 그대로 넘겨도 된다. 그때 소계는 "그날 그 카테고리의
 *    합"이 되는데, 그것이 사용자가 필터를 건 이유 그대로다;
 *  - 행이 없는 날은 그룹이 만들어지지 않는다(빈 섹션 없음);
 *  - `spentOn`을 파싱할 수 없는 값(레거시·손상 데이터)은 라벨을 원본 그대로 두고 **맨 뒤**에
 *    첫 등장 순서로 모은다 — 그럴듯한 날짜로 둔갑시키지 않는다.
 *
 * @param todayIso "오늘"/"어제" 판정 기준일(서울). 생략하면 `getSeoulToday()`.
 */
export function groupExpensesByDate<TRow extends GroupableExpenseRow>(
  rows: readonly TRow[],
  todayIso: string = getSeoulToday()
): RecordsDateGroup<TRow>[] {
  const yesterdayIso = shiftIsoDate(todayIso, -1);

  const byDate = new Map<string, TRow[]>();
  for (const row of rows) {
    const key = row.spentOn;
    const group = byDate.get(key);
    if (group) group.push(row);
    else byDate.set(key, [row]);
  }

  const groups = [...byDate.entries()].map(([key, groupRows]): RecordsDateGroup<TRow> => {
    const counted = groupRows.filter((row) => countsTowardMonthlyTotal(row.expenseType));
    const dateLabel = formatSpentOnWithWeekday(key);
    const isToday = key === todayIso;
    const isYesterday = yesterdayIso !== null && key === yesterdayIso;
    return {
      key,
      dateLabel,
      headerLabel: isToday ? "오늘" : isYesterday ? "어제" : dateLabel,
      isToday,
      isYesterday,
      subtotalKrw: counted.reduce((sum, row) => sum + row.amountKrw, 0),
      hasSubtotal: counted.length > 0,
      rows: groupRows
    };
  });

  // 파싱 가능한 날짜는 최신순, 파싱 불가한 값은 첫 등장 순서대로 맨 뒤.
  const sortable = groups.filter((group) => parseIsoDateParts(group.key) !== null);
  const unparsed = groups.filter((group) => parseIsoDateParts(group.key) === null);
  sortable.sort((left, right) => (left.key < right.key ? 1 : left.key > right.key ? -1 : 0));
  return [...sortable, ...unparsed];
}
