import { isYearMonth, yearMonthLabel, yearMonthsBetween } from "../export/export-range";
import { monthJumpFloorYearMonth } from "../month-jump";
import { LOAD_ERROR_NOTICE, LOAD_ERROR_RETRY_LABEL } from "../offline/messages";

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

/**
 * 라운드 104 트랙 SEARCH(#2) — 검색어 **확정 시점**(디바운스) 판정.
 *
 * ## 무엇이 문제였나
 * 기록 탭의 검색은 keystroke마다 즉시 확정됐다(`onChangeText={setSearchText}` — 디바운스 없음).
 * 월 스코프에서는 그 달의 수십~수백 행이라 티가 나지 않지만, 위 전체 기간 스코프에서는 모집단이
 * 21~33개월치(월 200건이면 4,000~6,000행)라 **키 한 번마다** 그 전량에
 * `matchRecordSearch`(행당 정규식 4회 + `toLowerCase` 최대 4회)가 다시 돌고 목록·날짜 그룹·
 * 섹션·소계가 전부 다시 조립됐다 — 저사양 기기에서 글자가 늦게 따라오던 그 구간이다.
 *
 * ## 왜 이 모듈인가
 * 이 파일이 이미 "검색어가 무엇을 세우는가"의 단일 판정처다(`resolveRecordsSearchScope`가 같은
 * 검색어로 스코프를 정한다). 확정 시점도 같은 성질의 판정이라 여기 두고, 화면은 타이머 배선만
 * 진다 — 준비템 탭이 순수 판정(`pendingSearchSubmission`) + 화면 타이머로 나눈 그 관례 그대로다.
 *
 * ## 규칙
 *  - **입력은 기다리지 않는다.** 이 판정은 *파생*을 미룰 뿐이고, 입력칸이 그리는 값은 화면의
 *    즉시 state다(글자가 늦게 뜨는 일은 이 판정으로 생기지 않는다).
 *  - **350ms는 새 값이 아니다.** 준비템 탭 검색의 디바운스와 **같은 수**다
 *    (src/preparation/PreparationListParity.tsx) — 한 앱 안에서 검색 확정 시점이 자리마다
 *    갈리면 같은 조작이 화면마다 다른 속도로 반응한다.
 *  - **비우기는 즉시 확정한다(0ms).** 결과를 *넓히는* 조작이라 파생이 오히려 싸지고, 0건 카드의
 *    [검색어 지우기]·최근 검색어 칩 줄 복귀가 350ms 늦게 반응하면 버튼이 죽은 것으로 보인다.
 *    판정 기준은 `trim()`이다 — 공백만 남은 입력은 아무것도 좁히지 않는다.
 *  - **이미 확정된 값에는 아무 일도 없다**(null) — 화면은 타이머 자체를 걸지 않는다.
 */
export function recordsSearchCommitDelayMs(input: {
  /** 입력칸이 지금 들고 있는 값(즉시 state). */
  searchText: string;
  /** 무거운 파생이 지금 보고 있는 값(확정 검색어). */
  appliedSearchText: string;
}): number | null {
  if (input.searchText === input.appliedSearchText) return null;
  if (input.searchText.trim().length === 0) return 0;
  return 350;
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
 * 라운드 104 트랙 SEARCH(#1) — 수집이 한 번에 띄우는 달 수(고정 동시성 워커 풀의 폭).
 *
 * **왜 4인가**(무한 병렬이 아니라 이 수인 근거 셋):
 *  1. **클라이언트 천장이 거기다.** iOS NSURLSession의 `HTTPMaximumConnectionsPerHost` 기본값이
 *     4, 안드로이드 OkHttp `Dispatcher.maxRequestsPerHost` 기본값이 5다. 그 위로 더 띄워도
 *     소켓이 없어 클라 큐에서 기다리므로 **벽시계는 줄지 않고** 떠 있는 약속만 늘어난다.
 *  2. **서버 한도는 공유 버킷이다.** 레이트 리밋은 IP당 300req/60초인데
 *     (apps/api/src/common/security/rate-limit.middleware.ts), 한국 이동통신의 CGNAT 뒤에서는
 *     그 버킷을 수많은 기기가 나눠 쓴다. 수집 한 번의 총량은 달 수(21~33 · retry 1까지 최악
 *     42~66)라 **어떤 동시성에서도 버킷을 혼자 채우지 못하지만**, 폭이 넓을수록 그 총량이 짧은
 *     순간에 몰려 남의 몫까지 밀어낸다 — 총 왕복이 같다면 순간 폭은 좁은 쪽이 옳다.
 *  3. **얻는 것은 이미 충분하다.** 33개월이 33단계에서 `ceil(33/4)=9`단계로, 21개월이 6단계로
 *     줄어든다(4배 가까이). 8로 넓혀 봐야 1번 때문에 실제 단계 수는 거의 그대로다.
 */
const SEARCH_SCOPE_COLLECT_CONCURRENCY = 4;

/**
 * 달 목록을 **최신 달부터** 걷어 한 달씩 모은다(CSV 수집기 `collectExpensesForRange`와 같은
 * 방향 — 실패로 걷다 멈춰도 최근 기록이 먼저 담긴다). 한 달의 실패는 수집 전체를 죽이지 않고
 * `failedMonths`로 남는다 — 부분 결과를 전체로 위장하지 않는 대신, 무엇이 빠졌는지를 값으로
 * 돌려준다.
 *
 * `ensureMonth`는 주입받는다(화면은 `queryClient.ensureQueryData(["expenses", childId, ym], …)`를
 * 넘긴다 — 이미 캐시된 달은 요청 0건). 그래서 이 루프는 네트워크를 모르는 순수 함수이고, 같은
 * 달 목록으로 다시 부르면 성공해 둔 달은 캐시에서 즉시 돌아와 **재시도 = 같은 호출**이 된다.
 *
 * ## 두 시점 — 라운드 104 트랙 SEARCH(#1): 직렬 `for` → 고정 동시성 워커 풀
 * 종전에는 몸통이 `await ensureMonth()` 하나뿐인 `for` 루프였다(동시성 1). 21~33개월이 한 줄로
 * 서서 앞 달이 끝나야 뒷 달이 출발했고, 진행 라벨("불러오는 중 3/21")이 붙어 있다는 사실 자체가
 * 그 대기를 화면이 이미 인정하고 있었다는 증거다. 지금은 워커 넷이 같은 달 목록을 **앞에서부터
 * 나눠** 집는다. 바뀐 것은 **동시에 떠 있는 요청 수뿐**이고, 아래 셋은 그대로다:
 *  - **서버 왕복 수 무변경**: 달마다 `ensureMonth` 정확히 한 번(캐시된 달은 여전히 0회).
 *  - **호출 순서 무변경**: 워커는 최신 달부터 내려가며 집으므로 먼저 출발하는 달의 순서가 같다.
 *  - **결과 순서 무변경**: 끝나는 순서가 아니라 **자리(index)** 에 써 넣고 최신 달부터 훑어
 *    담는다 — `rebuildSearchScopeResult`와 화면 고지가 읽는 그 순서다.
 * `onProgress`만 뜻이 한 겹 좁아진다: `done`은 여전히 1씩 단조 증가하지만 "몇 번째 달"이 아니라
 * **"끝난 달 수"**다(동시에 끝나면 끝난 순서대로 센다) — 라벨이 세는 것은 원래 그 수였다.
 */
export async function collectSearchScopeMonths<TExpense>(
  months: readonly string[],
  ensureMonth: (yearMonth: string) => Promise<{ expenses: TExpense[] }>,
  /**
   * 라운드 101 리뷰 M-A2 — 달 하나가 끝날 때마다(성공·실패 모두) `(끝난 수, 전체 수)`로 부른다.
   * 화면은 이 값으로 수집 중 버튼 라벨("불러오는 중 n/21")을 갱신한다 — 21개월 수집은 느린
   * 회선에서 수 초를 넘고, 잠긴 버튼 하나만 남으면 멈춘 것과 구별되지 않는다.
   */
  onProgress?: (done: number, total: number) => void
): Promise<SearchScopeCollectionResult<TExpense>> {
  const total = months.length;
  // 자리에 써 넣는다 — 병렬이라 **끝나는 순서**는 뒤섞이지만 목록의 순서는 걷는 순서여야 한다.
  const slots: (SearchScopeMonthExpenses<TExpense> | undefined)[] = new Array(total);
  const failed: string[] = [];
  // 다음에 집을 달. 최신 달(마지막 인덱스)에서 시작해 내려간다 — 종전 for 루프의 그 방향이다.
  let nextIndex = total - 1;
  let done = 0;

  const runWorker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      if (index < 0) return;
      // 자바스크립트는 단일 스레드라 이 두 줄 사이에 다른 워커가 끼어들 수 없다(await 없음) —
      // 그래서 한 달을 두 워커가 집는 일도, 건너뛰는 일도 없다(왕복 수가 정확히 달 수인 근거).
      nextIndex = index - 1;
      const yearMonth = months[index];
      try {
        const month = await ensureMonth(yearMonth);
        slots[index] = { yearMonth, expenses: month.expenses };
      } catch {
        failed.push(yearMonth);
      }
      done += 1;
      onProgress?.(done, total);
    }
  };

  // 달보다 많은 워커는 만들지 않는다(빈 목록이면 워커가 0 — 한 번도 부르지 않는다).
  await Promise.all(
    Array.from({ length: Math.min(SEARCH_SCOPE_COLLECT_CONCURRENCY, total) }, () => runWorker())
  );

  const collected: SearchScopeMonthExpenses<TExpense>[] = [];
  for (let index = total - 1; index >= 0; index -= 1) {
    const month = slots[index];
    if (month) collected.push(month);
  }
  // "YYYY-MM"은 사전순이 곧 시간순이다 — 고지 문장이 이른 달부터 읽히게 오름차순으로 넘긴다.
  return { months: collected, failedMonths: failed.sort() };
}

/**
 * 라운드 101 리뷰 H-2(A-1) — 수집 완료 달 목록으로 **소비 시점에 캐시를 다시 읽어** 결과를
 * 재조립한다.
 *
 * 종전 훅은 수집이 끝난 순간의 지출 배열을 **동결 스냅숏**으로 들고 있었다: 전체 스코프를 보는
 * 동안 flush가 확정되면(삭제가 서버에 닿고, 대기 행이 synced가 되고, 캐시가 refetch로 갈리면)
 * 오프라인 행 재조정이 걷히면서 스냅숏 속 **낡은 서버 행이 되살아났다**(방금 지운 행 부활 ·
 * 수정 되돌림 · flush 직후 신규 증발). 이제 훅은 "수집이 성공한 달 목록"만 들고, 결과는 매
 * 소비 시점에 이 함수가 그 달들의 캐시(`["expenses", childId, ym]`)를 읽어 다시 세운다 —
 * 캐시가 갈리면(무효화 후 refetch) 같은 렌더 경로로 새 사실이 선다.
 *
 * 수집이 성공한 달은 캐시에 실재하는 것이 정상이다(ensureQueryData가 채웠다). 그 사이 캐시가
 * 비워진 달(gc 등)은 **그럴듯한 빈 달로 위장하지 않고** failedMonths로 합류한다 — 부분을
 * 전체로 위장하지 않는 규칙 그대로다.
 */
export function rebuildSearchScopeResult<TExpense>(
  collectedMonths: readonly string[],
  failedMonths: readonly string[],
  readMonth: (yearMonth: string) => { expenses: TExpense[] } | undefined
): SearchScopeCollectionResult<TExpense> {
  const months: SearchScopeMonthExpenses<TExpense>[] = [];
  const missing: string[] = [];
  for (const yearMonth of collectedMonths) {
    const cached = readMonth(yearMonth);
    if (cached) months.push({ yearMonth, expenses: cached.expenses });
    else missing.push(yearMonth);
  }
  return { months, failedMonths: [...new Set([...failedMonths, ...missing])].sort() };
}

/**
 * 라운드 101 리뷰 M-A2 — 수집이 도는 동안 진입/재시도 버튼에 서는 진행 라벨("불러오는 중 3/21").
 * 라벨이 곧 낭독이다(TextButton은 라벨을 접근성 라벨로도 쓴다) — 진행 없이 잠긴 버튼은
 * 스크린리더에게도 멈춘 버튼으로 들린다. 진행값을 아직 모르면(첫 달 이전) 수사 없이 사실만 말한다.
 */
export function searchScopeCollectingProgressLabel(progress: { done: number; total: number } | null): string {
  if (!progress || progress.total <= 0) return "불러오는 중";
  return `불러오는 중 ${progress.done}/${progress.total}`;
}

/**
 * 라운드 101 리뷰 M-2 — 수집 **완료 낭독** 한 문장.
 *
 *  - 전량 실패(`all-failed`): 스코프는 전환되지 않았으므로 "전체 기간의 …에서 찾아요"를 읽으면
 *    거짓이다 — 조회 실패 카드와 같은 문장(LOAD_ERROR_NOTICE)만 읽는다(모듈 문장 재사용).
 *  - 부분 실패: 전환 고지 뒤에 부분 실패 고지(buildSearchScopePartialNotice — 화면에 그려지는
 *    그 문장)를 **같은 낭독에 합류**시킨다. 전환 고지만 읽으면 눈으로 부분 고지를 못 보는
 *    사용자에게 부분이 전체로 위장된다.
 */
export function searchScopeCollectionAnnouncement(input: {
  outcome: "collected" | "all-failed";
  /** buildRecordsSearchScopeNotice(allPeriods: true)가 만든 전환 고지(검색어가 비면 null). */
  scopeNotice: string | null;
  failedMonths: readonly string[];
}): string | null {
  if (input.outcome === "all-failed") return LOAD_ERROR_NOTICE;
  const partial = buildSearchScopePartialNotice(input.failedMonths);
  if (!input.scopeNotice) return partial?.text ?? null;
  return partial ? `${input.scopeNotice} ${partial.text}` : input.scopeNotice;
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
