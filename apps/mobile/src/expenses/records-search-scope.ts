import { isYearMonth, yearMonthLabel, yearMonthsBetween } from "../export/export-range";
import { monthJumpFloorYearMonth } from "../month-jump";
import { LOAD_ERROR_RETRY_LABEL } from "../offline/messages";

/**
 * 라운드 101 트랙 A — 기록 탭 검색의 **전체 기간 스코프** 순수 판정.
 *
 * ## 무엇이 문제였나
 * 기록 탭 검색은 `["expenses", childId, 보는 달]` 캐시 — 즉 **보고 있는 한 달치 응답**에만
 * 걸린다(범위 고지 줄이 그 사실을 정직하게 말하고, 0건 카드가 "지난달에서 찾기"·"다른 달에서
 * 찾기"를 내민다). 그런데 그 두 탈출구는 전부 **달 단위 되감기**다: "조리원 비용이 언제였더라"를
 * 찾는 사용자는 달을 하나씩(또는 시트로 하나 골라) 옮기며 같은 검색을 반복해야 하고, 한 번의
 * 이동이 한 번의 조회다. 서버에 전 기간 검색 API는 없고 로컬 미러는 synced 90일 파기라, 클라
 * 전 기간은 **월별 수집**으로만 가능하다.
 *
 * ## 설계 규칙 (S3 확정)
 *  - **자동 전환 금지.** 검색어를 쳤다고 21개월치 조회를 몰래 사지 않는다 — 범위 고지 줄의
 *    "[전체 기간에서 찾기]" 액션(+0건 카드의 세 번째 탈출구)을 사용자가 눌렀을 때만 수집한다.
 *    탭 한 번 = 수집 한 번이고, 검색어를 지우면 월 스코프로 복귀한다(`resolveRecordsSearchScope`).
 *  - **하한은 월 선택 시트와 같은 규칙 — 새 판정 0.** 화면이 이미 계산해 둔
 *    `resolveMonthJumpEarliestMonth`(아이 생년월일/예정일 → 전년 1월)를 그대로 받고, 여기서는
 *    시트가 실제 하한을 정할 때 쓰는 그 함수(`monthJumpFloorYearMonth` — 미래 오타 보정 + 20년
 *    절대 바닥)를 지난다. **하한을 모르면(null) 달 목록이 비고, 화면은 토글 자체를 내밀지
 *    않는다** — "전체"라고 말해 놓고 어디까지인지 모르는 수집은 범위를 지어내는 것이다.
 *  - **월 열거는 내보내기와 같은 한 벌.** `yearMonthsBetween`(src/export/export-range.ts)을
 *    재사용한다 — 닫힌 달 구간을 걷는 규칙이 두 벌이 되면 CSV와 검색이 서로 다른 달 목록을
 *    "전체"라고 부른다.
 *  - **부분을 전체로 위장하지 않는다.** 수집이 달 단위로 실패할 수 있으므로(느린 회선·서버 오류)
 *    실패한 달 목록을 그대로 돌려주고, 화면은 그 달들을 **이름으로** 말하며 재시도를 제안한다
 *    (`buildSearchScopePartialNotice`).
 *
 * react/react-native 의존 없음 — 화면을 띄우지 않고 vitest로 고정한다
 * (src/expenses/records-search-scope.test.ts).
 */

export type RecordsSearchScope = "month" | "all";

/**
 * 지금 검색이 걷는 범위. **검색어가 비면 언제나 월 스코프다** — 전체 스코프는 검색의 속성이지
 * 화면의 상태가 아니라서, 검색어를 지우는 순간 참이 아니게 된다(화면은 이 판정에 따라 수집물도
 * 함께 버린다 — 다시 치면 월 스코프에서 시작한다: 자동 전환 금지의 다른 얼굴).
 */
export function resolveRecordsSearchScope(input: {
  /** 검색어 원본(트림 전). */
  searchText?: string | null;
  /** 전체 기간 수집이 끝나 결과를 들고 있는가(화면의 수집 상태). */
  fullScopeCollected: boolean;
}): RecordsSearchScope {
  const query = input.searchText?.trim() ?? "";
  if (query.length === 0) return "month";
  return input.fullScopeCollected ? "all" : "month";
}

/**
 * 전체 기간 수집이 걷을 달 목록(`YYYY-MM` 오름차순, 하한~이번 달 양끝 포함).
 *
 * 하한을 모르면(`earliestYearMonth`가 null/형식 오염) **빈 배열**이다 — 화면은 이 길이로 토글
 * 노출을 판정하므로, 하한 없는 계정에는 전체 검색 자체가 서지 않는다(모르면 지어내지 않는다).
 * 실제 하한은 월 선택 시트와 **같은 함수**(`monthJumpFloorYearMonth`)가 정한다: 예정일 오타로
 * 하한이 미래를 가리키면 시트와 같은 보정(앵커를 오늘로 당겨 전년 1월)을 받고, 20년 절대
 * 바닥도 시트 그대로다 — 시트에서 고를 수 있는 달과 전체 검색이 걷는 달이 갈릴 수 없다.
 */
export function resolveSearchScopeMonths(input: {
  /** 화면이 이미 들고 있는 `resolveMonthJumpEarliestMonth(...)` 결과. */
  earliestYearMonth: string | null | undefined;
  /** 오늘(서울) `YYYY-MM-DD` — 화면의 `getSeoulToday()` 값을 그대로 주입한다(시계를 읽지 않는다). */
  todayIso: string;
}): string[] {
  if (!isYearMonth(input.earliestYearMonth)) return [];
  const floor = monthJumpFloorYearMonth({ todayIso: input.todayIso, earliestYearMonth: input.earliestYearMonth });
  if (floor === null) return [];
  const currentYearMonth = input.todayIso.slice(0, 7);
  if (!isYearMonth(currentYearMonth)) return [];
  return yearMonthsBetween({ startYearMonth: floor, endYearMonth: currentYearMonth });
}

/** 수집이 모은 한 달치 — 서버 목록 원본이다(재조정은 화면이 보고 있는 달과 같은 한 벌로 한다). */
export type SearchScopeMonthExpenses<TExpense> = { yearMonth: string; expenses: TExpense[] };

export type SearchScopeCollectionResult<TExpense> = {
  /** 불러온 달들(최신 달부터 — 걷는 방향 그대로). */
  months: SearchScopeMonthExpenses<TExpense>[];
  /** 불러오지 못한 달들(`YYYY-MM` 오름차순) — 화면이 이름으로 말하고 재시도를 제안한다. */
  failedMonths: string[];
};

/**
 * 달 목록을 **최신 달부터** 걷어 한 달씩 모은다(CSV 수집기 `collectExpensesForRange`와 같은
 * 방향 — 실패로 걷다 멈춰도 최근 기록이 먼저 담긴다). 한 달의 실패는 수집 전체를 죽이지 않고
 * `failedMonths`로 남는다 — 부분 결과를 전체로 위장하지 않는 대신, 무엇이 빠졌는지를 값으로
 * 돌려준다.
 *
 * `ensureMonth`는 주입받는다(화면은 `queryClient.ensureQueryData(["expenses", childId, ym], …)`를
 * 넘긴다 — 이미 캐시된 달은 요청 0건). 그래서 이 루프는 네트워크를 모르는 순수 함수이고, 같은
 * 달 목록으로 다시 부르면 성공해 둔 달은 캐시에서 즉시 돌아와 **재시도 = 같은 호출**이 된다.
 */
export async function collectSearchScopeMonths<TExpense>(
  months: readonly string[],
  ensureMonth: (yearMonth: string) => Promise<{ expenses: TExpense[] }>
): Promise<SearchScopeCollectionResult<TExpense>> {
  const collected: SearchScopeMonthExpenses<TExpense>[] = [];
  const failed: string[] = [];
  for (let index = months.length - 1; index >= 0; index -= 1) {
    const yearMonth = months[index];
    try {
      const month = await ensureMonth(yearMonth);
      collected.push({ yearMonth, expenses: month.expenses });
    } catch {
      failed.push(yearMonth);
    }
  }
  // "YYYY-MM"은 사전순이 곧 시간순이다 — 고지 문장이 이른 달부터 읽히게 오름차순으로 넘긴다.
  return { months: collected, failedMonths: failed.sort() };
}

/**
 * 전체 스코프의 **부분 실패 고지** — 불러오지 못한 달이 없으면 null(화면이 아무것도 그리지
 * 않는다). 달 이름은 내보내기와 같은 표기(`yearMonthLabel` — "2026년 3월")이고, 재시도 라벨은
 * 조회 실패 카드와 같은 단어(`LOAD_ERROR_RETRY_LABEL`)다 — 같은 상황을 자리마다 다른 말로
 * 부르지 않는다.
 */
export function buildSearchScopePartialNotice(
  failedMonths: readonly string[]
): { text: string; retryLabel: string; retryAccessibilityLabel: string } | null {
  if (failedMonths.length === 0) return null;
  const labels = [...failedMonths].sort().map((yearMonth) => yearMonthLabel(yearMonth));
  return {
    text: `${labels.join(", ")}의 기록은 아직 불러오지 못했어요`,
    retryLabel: LOAD_ERROR_RETRY_LABEL,
    // 버튼만 따로 들으면 무엇을 다시 시도하는지 알 수 없다 — 고지가 말한 대상을 붙여 읽는다.
    retryAccessibilityLabel: `아직 불러오지 못한 달 ${LOAD_ERROR_RETRY_LABEL}`
  };
}

/**
 * 전체 스코프 목록의 날짜 헤더 라벨 — **연도**를 붙인다("2025년 8월 27일 (수)").
 *
 * 여러 해의 기록이 한 목록에 서므로 연 없는 "8월 27일"은 반쪽 사실이다. 규칙은 파생이지
 * 재작성이 아니다: `formatSpentOn`·`groupExpensesByDate`는 한 글자도 손대지 않고, 이미 만들어진
 * 그룹의 라벨 앞에 그룹 키(`YYYY-MM-DD`)에서 읽은 연도만 붙인다.
 *
 *  - `headerLabel`이 `dateLabel`과 다른 그룹("오늘"/"어제")은 그대로 통과한다 — 그 두 낱말은
 *    연도가 자명하고, 여기서 그 낱말을 다시 적으면 규칙이 두 벌이 된다.
 *  - 키에서 연도를 읽을 수 없는 그룹(레거시·손상 `spentOn`)도 그대로 통과한다 — 그럴듯한
 *    연도를 지어내지 않는다(records-date-groups의 원본 통과 규칙 유지).
 */
export function fullScopeDateHeaderLabel(group: { key: string; dateLabel: string; headerLabel: string }): string {
  if (group.headerLabel !== group.dateLabel) return group.headerLabel;
  const parts = group.key.split("-");
  if (parts.length !== 3) return group.headerLabel;
  const year = Number(parts[0]);
  if (!Number.isInteger(year) || parts[0].length !== 4) return group.headerLabel;
  return `${year}년 ${group.headerLabel}`;
}
