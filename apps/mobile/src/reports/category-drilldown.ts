/**
 * 라운드 52 C-03: 리포트 → 기록 **드릴다운**의 단일 소스(순수 모듈).
 *
 * ## 무엇이 문제였나
 * 리포트 탭의 카테고리 비중 카드는 "기저귀/위생 34% · 340,000원"까지 말해 놓고 거기서 끝난다.
 * 그 34%가 **어떤 기록들**인지 보려면 사용자가 기록 탭으로 건너가 달을 맞추고 같은 이름의 칩을
 * 직접 찾아 눌러야 했다 — 앱의 핵심 루프(지출 기록 → 총액 확인 → …)에서 "확인"과 "기록"이 서로를
 * 가리키지 않는 상태였다. 게다가 화면은 `categoryId`를 이미 들고 있으면서 범례를 만들 때
 * 이름만 남기고 버렸다(reports.tsx의 categorySegments).
 *
 * ## 착지 월 규칙 — 왜 한 달인가
 * 기록 탭은 **한 달치 응답**(`["expenses", childId, yearMonth]`) 위에서 도는 화면이다. 분기·연간
 * 비중을 그 화면에 그대로 펼칠 방법은 없다(그러려면 여러 달을 합치는 새 목록 화면이 필요하고,
 * 그건 이 변경의 범위가 아니다). 그래서 **기간 안의 한 달**로 착지하고, 어느 달인지는 규칙으로
 * 못 박는다:
 *
 * - 기간이 **이미 끝났으면** 그 기간의 **마지막 달**(2025년 연간 → 2025-12).
 * - 기간이 **진행 중이면** **현재 달**(2026년 연간을 2026-08에 보고 있으면 → 2026-08).
 * - 월간 탭은 달이 하나뿐이라 두 규칙이 같은 답을 낸다(보고 있는 그 달).
 *
 * 즉 "그 기간에서 기록이 있을 수 있는 마지막 달"이다. 아직 오지 않은 달로 보내면 빈 화면이
 * 나오고(C-02가 차트에서 없앤 것과 같은 종류의 거짓 신호다), 기간의 첫 달로 보내면 방금 본
 * 비중과 가장 먼 달에 내려놓게 된다.
 *
 * **착지 월은 숨기지 않는다**: 화면이 이 모듈의 라벨로 접근성 힌트와 캡션을 만들어, 누르기 전에
 * 어느 달로 가는지 말한다. 기록 탭도 도착하자마자 자기 월 라벨과 선택된 칩을 그대로 보여준다.
 *
 * ## 파라미터 규약
 * 링크를 **만드는 쪽**(리포트)과 **읽는 쪽**(기록 탭)이 같은 모듈을 쓴다. 예전 `month` 파라미터
 * 하나만 있던 시절에는 파싱 규칙이 두 파일에 흩어져 있었고, 그 상태로 `categoryId`를 더하면
 * "리포트는 보냈는데 기록 탭이 못 읽는" 조합이 생긴다. 읽기 쪽 방어는
 * `resolveDrilldownCategoryIdParam` 하나뿐이다 — 형식이 어긋난 값은 통째로 무시한다.
 *
 * ## 라운드 52 QA P1-1/P2-1 — 왜 nonce가 필요한가
 * 기록 탭은 딥링크 파라미터를 **값이 바뀔 때 한 번만** 적용한다(라운드 51 C-#11의 appliedRef
 * 관례). 가져오기 착지에는 그 규칙이 맞다 — 사용자가 ‹ 로 옮겨 둔 달을 재렌더가 되돌리면 안
 * 되기 때문이다. 그런데 드릴다운은 파라미터가 **둘**이고, 각자 자기 값만 보고 가드하는 순간
 * 두 구멍이 생겼다.
 *
 *  - **P1-1**: 8월에 연간 탭에서 A 카테고리를 눌러 착지 → 기록 탭에서 ‹ 로 6월을 보다가 →
 *    다시 리포트에서 B 카테고리를 누르면, `categoryId`만 바뀌고 `month`는 같은 "2026-08"이라
 *    월이 재적용되지 않는다. 화면은 6월에 선 채 B 필터만 걸리고, 카드가 누르기 전에 한
 *    **"2026년 8월 기록을 보여드려요"** 약속이 깨진다(= 사용자가 보는 숫자와 방금 본 비중이
 *    다른 달의 것이다).
 *  - **P2-1**: 같은 카테고리를 다시 누르면 두 값 모두 그대로라 **아무 일도 일어나지 않는다.**
 *    필터를 "전체"로 풀어 둔 뒤 다시 눌러도 마찬가지다 — 버튼이 죽은 것처럼 보인다.
 *
 * 그래서 링크에 **누를 때마다 달라지는 값**(nonce)을 하나 더 싣고, 기록 탭은 그 nonce가 바뀌면
 * `month`와 `categoryId`를 **한 묶음으로** 다시 적용한다. nonce는 리포트 화면이 들고 있는 단조
 * 증가 카운터다 — `Date.now()`가 아니다: 시계에 기대면 같은 밀리초의 두 번째 탭이 조용히 무시되고,
 * 무엇보다 테스트에서 값이 고정되지 않는다(이 앱의 순수 모듈 관례가 시계를 인자로 받는 것과 같은
 * 이유다).
 *
 * **가져오기 경로는 그대로다**: nonce가 없는 링크(`month`만 실은 app/import/[importJobId].tsx)는
 * 종전 가드 그대로 동작한다 — 이 라운드가 바꾸는 것은 nonce가 실린 링크뿐이다.
 */

import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 드릴다운이 착지하는 화면. expo-router의 탭 라우트 이름. */
export const RECORDS_TAB_PATHNAME = "/(tabs)/records";

/**
 * 파라미터로 실어 보낼 수 있는 categoryId의 형태.
 *
 * 서버 시드 카테고리는 UUID이고 모바일 퀵타일 별칭은 `mobile_etc` 같은 스네이크 문자열이라
 * (apps/api/prisma/seed-data.ts의 `mobileCategoryAliasSeeds`), 둘 다 통과하는 최소 집합만 허용한다.
 * 길이 상한은 딥링크로 들어온 쓰레기 값이 화면 상태에 눌러앉는 것을 막는 선이다.
 */
const CATEGORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 드릴다운 착지 회차를 싣는 파라미터 이름.
 *
 * 값은 숫자 문자열이고 **의미는 "몇 번째 탭인가" 하나뿐이다** — 기록 탭은 이 값을 표시하지도,
 * 저장하지도, 서버에 보내지도 않는다. 바뀌었는지만 본다.
 */
export const RECORDS_DRILLDOWN_NONCE_PARAM = "drilldown";

/** nonce로 실을 수 있는 값의 형태. 딥링크로 들어온 긴 쓰레기 값이 눌러앉지 않게 자릿수를 묶는다. */
const DRILLDOWN_NONCE_PATTERN = /^\d{1,12}$/;

export type CategoryDrilldownTarget = {
  pathname: typeof RECORDS_TAB_PATHNAME;
  /**
   * 키 이름은 **상수에서 온다**(라운드 52 QA P3-6). 예전에는 이 타입과 아래 빌더가 `"month"`를
   * 각자 문자열로 적어, 가져오기 착지가 쓰는 `RECORDS_MONTH_PARAM`과 이중 소스였다 — 한쪽만
   * 바뀌면 리포트는 보내는데 기록 탭이 못 읽는 조합이 조용히 생긴다.
   */
  params: {
    /** 착지 월 "YYYY-MM" — 기록 탭의 기존 month 파라미터 규약 그대로(라운드 51 C-#11). */
    [RECORDS_MONTH_PARAM]: string;
    categoryId: string;
    /** 이번 탭의 회차. 기록 탭은 이 값이 바뀌면 위 둘을 한 묶음으로 다시 적용한다. */
    [RECORDS_DRILLDOWN_NONCE_PARAM]: string;
  };
};

export type CategoryDrilldownPeriod = {
  /** 보고 있는 기간의 **첫 달** "YYYY-MM"(월간이면 그 달, 분기면 분기 시작 달, 연간이면 1월). */
  startYearMonth: string;
  /** 그 기간의 달 수 — 월간 1, 분기 3, 연간 12. */
  monthCount: number;
  /** 서울 기준 오늘 "YYYY-MM-DD". */
  todayIso: string;
};

function monthOrdinal(yearMonth: string): number | null {
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) return null;
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

function yearMonthFromOrdinal(ordinal: number): string {
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * 착지 월 "YYYY-MM". 기간이나 오늘 날짜를 해석할 수 없으면 null(드릴다운 없음 — 어림짐작으로
 * 엉뚱한 달에 내려놓지 않는다).
 */
export function resolveDrilldownMonth(period: CategoryDrilldownPeriod): string | null {
  const startOrdinal = monthOrdinal(period.startYearMonth);
  if (startOrdinal === null) return null;
  if (!Number.isInteger(period.monthCount) || period.monthCount < 1) return null;
  if (!DATE_ONLY_PATTERN.test(period.todayIso)) return null;
  const todayOrdinal = monthOrdinal(period.todayIso.slice(0, 7));
  if (todayOrdinal === null) return null;

  const lastOrdinal = startOrdinal + period.monthCount - 1;
  // 진행 중이면 현재 달, 끝났으면 마지막 달. (기간이 통째로 미래면 첫 달 — 화면의 "다음" 이동이
  // 막혀 있어 정상 경로로는 오지 않지만, 기간 밖으로 나가지는 않게 한다.)
  const landingOrdinal = Math.min(Math.max(todayOrdinal, startOrdinal), lastOrdinal);
  return yearMonthFromOrdinal(landingOrdinal);
}

/** "2026-08" → "2026년 8월". 형식이 어긋나면 null. */
export function drilldownMonthLabel(yearMonth: string): string | null {
  const ordinal = monthOrdinal(yearMonth);
  if (ordinal === null) return null;
  return `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5, 7))}월`;
}

/** 파라미터에 실을 수 있는 값인지. */
export function isDrilldownCategoryId(value: unknown): value is string {
  return typeof value === "string" && CATEGORY_ID_PATTERN.test(value);
}

/**
 * 리포트가 누른 범례 한 줄 → 기록 탭으로 가는 링크. 말이 되지 않으면 null(화면은 이동하지 않는다).
 *
 * `nonce`는 **이번 탭의 회차**다(리포트 화면의 단조 증가 카운터). 착지 월·카테고리가 지난번과
 * 똑같아도 이 값이 달라지므로, 기록 탭이 "같은 값이니 할 일 없음"으로 넘기지 않는다.
 * 정수가 아니면 링크를 만들지 않는다 — 읽는 쪽이 무시할 값을 실어 보내면 착지가 조용히
 * 종전 가드로 되돌아가고, 그건 이 라운드가 고친 바로 그 증상이다.
 */
export function buildCategoryDrilldownTarget(
  input: CategoryDrilldownPeriod & { categoryId: string | null | undefined; nonce: number }
): CategoryDrilldownTarget | null {
  if (!isDrilldownCategoryId(input.categoryId)) return null;
  if (!Number.isInteger(input.nonce) || input.nonce < 0) return null;
  const month = resolveDrilldownMonth(input);
  if (month === null) return null;
  const nonce = String(input.nonce);
  if (!DRILLDOWN_NONCE_PATTERN.test(nonce)) return null;
  return {
    pathname: RECORDS_TAB_PATHNAME,
    params: {
      [RECORDS_MONTH_PARAM]: month,
      categoryId: input.categoryId,
      [RECORDS_DRILLDOWN_NONCE_PARAM]: nonce
    }
  };
}

/**
 * 범례 줄의 접근성 힌트 — **누르기 전에** 어디로 가는지 말한다.
 *
 * 스크린리더 사용자는 화면 전환 뒤에야 "여기가 어디지"를 되짚을 수 없으므로, 분기·연간에서
 * 한 달로 좁혀 간다는 사실이 힌트 안에 있어야 한다. 달 라벨을 모르면 힌트를 만들지 않는다
 * (없는 달 이름을 지어내지 않는다 — 이 앱의 허위 표시 금지 관례).
 */
export function categoryDrilldownHint(landingMonth: string): string | null {
  const label = drilldownMonthLabel(landingMonth);
  if (!label) return null;
  return `두 번 누르면 ${label} 기록에서 이 카테고리만 볼 수 있어요`;
}

/**
 * 기간이 여러 달일 때 카드 아래에 붙는 **보이는** 한 줄. 월간 탭에서는 착지 월이 보고 있는 달
 * 그대로라 말할 것이 없으므로 null이다(같은 사실을 두 번 말하지 않는다).
 */
export function categoryDrilldownNote(landingMonth: string, monthCount: number): string | null {
  if (!Number.isInteger(monthCount) || monthCount <= 1) return null;
  const label = drilldownMonthLabel(landingMonth);
  if (!label) return null;
  return `카테고리를 누르면 ${label} 기록을 보여드려요`;
}

/**
 * 기록 탭이 받은 `categoryId` 파라미터를 화면 상태로 옮길 값으로 좁힌다.
 *
 * expo-router의 `useLocalSearchParams`는 같은 키가 여러 번 오면 배열을 준다 — 첫 값만 본다
 * (기존 `month` 파라미터 처리와 같은 관례). 형식이 어긋나면 null이라 필터가 걸리지 않고,
 * 화면은 이 파라미터가 없던 때와 똑같이 동작한다.
 *
 * **알 수 없는(형식은 맞지만 이 가구에 없는) id는 여기서 걸러낼 수 없다** — 카테고리 목록은
 * 비동기로 오고, 목록이 오기 전에 파라미터를 버리면 정상 드릴다운까지 사라진다. 그런 값이
 * 들어오면 기록 탭의 칩 폴백(src/expenses/records-list-view.ts의 buildRecordsCategoryChips)이
 * 그 id로 칩 하나를 만들어 0건을 보여주고, 그 칩의 "필터 해제" 버튼이 곧 탈출구다 —
 * 즉 최악의 경우도 "빈 목록 + 해제 버튼"이지 잘못된 기록이 보이는 상태가 아니다.
 */
export function resolveDrilldownCategoryIdParam(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isDrilldownCategoryId(value) ? value : null;
}

/**
 * 기록 탭이 받은 `drilldown`(회차) 파라미터.
 *
 * 배열이면 첫 값만 본다(`month`·`categoryId`와 같은 관례). 숫자 문자열이 아니면 null이고,
 * 그때 화면은 **nonce가 없던 때와 똑같이** 동작한다 — 즉 값별 가드(가져오기 착지의 규칙)로
 * 떨어질 뿐, 엉뚱한 재적용을 만들지 않는다.
 *
 * 비교는 **문자열 그대로** 한다(숫자로 바꾸지 않는다). 기록 탭이 알아야 하는 것은 "지난번과
 * 다른가" 하나뿐이고, 크기를 비교하는 순간 "더 작은 nonce는 무시" 같은 규칙이 생겨 화면 두
 * 곳이 카운터의 의미에 합의해야 한다.
 */
export function resolveDrilldownNonceParam(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && DRILLDOWN_NONCE_PATTERN.test(value) ? value : null;
}
