import { isMonthJumpSelectable } from "../month-jump";

/**
 * GAP-066 트랙 A(#2 후속) — **리포트 탭의 달 착지 파라미터**(값 + 회차)의 단일 소스.
 *
 * ## 왜 이 모듈인가
 * 리포트 탭은 지금까지 라우트 파라미터를 하나도 읽지 않았다. 그래서 "지난달 리포트를 보여 줘"라고
 * 말할 수 있는 접점(알림·카드·딥링크)이 생겨도 **착지할 자리가 없었다** — 탭을 열어 주고 사용자가
 * ‹ 를 직접 누르게 하는 것이 전부였고, 그건 record_gap 알림이 라운드 63에서 겪은 막다른 길과 같은
 * 모양이다. 링크를 **만드는 쪽**과 **읽는 쪽**이 같은 모듈을 쓰도록 규약을 여기 한 번만 적는다.
 *
 * ## 관례는 카테고리 드릴다운과 **같다** (값 + 회차)
 * 기록 탭이 드릴다운에서 배운 것(라운드 52 QA P1-1/P2-1)이 여기에도 그대로 적용된다: 탭 화면은
 * 한 번 열리면 계속 마운트된 채 남으므로, 파라미터를 **값 단위로만** 가드하면 같은 달을 두 번째로
 * 누를 때 아무 일도 일어나지 않는다(링크가 죽은 것처럼 보인다). 그래서 링크가 **누를 때마다
 * 달라지는 회차**를 함께 싣고, 리포트 탭은 그 회차가 바뀔 때 달을 다시 적용한다.
 * 회차 값의 의미는 "몇 번째인가" 하나뿐이다 — 화면에 표시되지도, 저장되지도, 서버로 나가지도
 * 않는다(`RECORDS_DRILLDOWN_NONCE_PARAM`과 같은 규약).
 *
 * ## 만드는 쪽은 아직 이 트랙이 아니다
 * 읽는 쪽(리포트 탭)은 이 라운드가 배선한다. 링크를 **만드는** 첫 소비자는 라운드 66 E("지난달
 * 정리" 알림)이고, 그 트랙은 `buildReportsMonthLandingTarget`을 부르기만 한다 — 파라미터 이름·
 * 형식·방어를 그쪽에서 다시 적지 않게 하는 것이 이 모듈의 목적이다.
 *
 * react/react-native/expo-router 의존 없음 — vitest 단위 테스트 대상이다.
 */

/** 착지 화면. expo-router의 탭 라우트 이름. */
export const REPORTS_TAB_PATHNAME = "/(tabs)/reports";

/**
 * 착지 월을 싣는 파라미터 이름. 기록 탭의 `month`(RECORDS_MONTH_PARAM)와 **같은 글자**를 쓴다 —
 * 두 탭이 같은 뜻의 파라미터를 다른 이름으로 받으면 링크를 만드는 쪽이 목적지마다 규약을 외워야
 * 한다. 값 형식도 같다: `YYYY-MM`.
 */
export const REPORTS_MONTH_PARAM = "month";

/** 착지 회차를 싣는 파라미터 이름. 값은 숫자 문자열이고 의미는 "몇 번째인가" 하나뿐이다. */
export const REPORTS_MONTH_NONCE_PARAM = "monthJump";

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 딥링크로 들어온 긴 쓰레기 값이 눌러앉지 않게 자릿수를 묶는다(드릴다운 nonce와 같은 형식). */
const NONCE_PATTERN = /^\d{1,12}$/;

export type ReportsMonthLandingTarget = {
  pathname: typeof REPORTS_TAB_PATHNAME;
  params: {
    /** 착지 월 `YYYY-MM`. */
    [REPORTS_MONTH_PARAM]: string;
    /** 이번 착지의 회차. 리포트 탭은 이 값이 바뀌면 달을 다시 적용한다. */
    [REPORTS_MONTH_NONCE_PARAM]: string;
  };
};

/**
 * 리포트 탭의 그 달로 가는 링크. 말이 되지 않으면 null이다 — 호출부는 그때 링크를 만들지 않는다
 * (엉뚱한 달에 내려놓느니 이동하지 않는 편이 낫다).
 *
 * 고를 수 있는 달인지의 판정은 **시트와 같은 함수**다(`isMonthJumpSelectable`): 미래 달·20년보다
 * 먼 과거는 리포트 탭이 어차피 이번 달로 떨어뜨리므로, 그런 링크는 애초에 만들지 않는다.
 * 하한(아이 날짜)은 링크를 만드는 쪽이 알 수 없으므로 여기서는 걸지 않는다 — 화면이 쥔 사실을
 * 링크 빌더가 지어내지 않는다.
 */
export function buildReportsMonthLandingTarget(input: {
  yearMonth: string;
  /** 이번 착지의 회차(단조 증가 정수). 정수가 아니면 링크를 만들지 않는다. */
  nonce: number;
  /** 오늘(서울 기준) `YYYY-MM-DD`. */
  todayIso: string;
}): ReportsMonthLandingTarget | null {
  if (!isMonthJumpSelectable(input.yearMonth, { todayIso: input.todayIso })) return null;
  if (!Number.isInteger(input.nonce) || input.nonce < 0) return null;
  const nonce = String(input.nonce);
  if (!NONCE_PATTERN.test(nonce)) return null;
  return {
    pathname: REPORTS_TAB_PATHNAME,
    params: {
      [REPORTS_MONTH_PARAM]: input.yearMonth,
      [REPORTS_MONTH_NONCE_PARAM]: nonce
    }
  };
}

/**
 * 리포트 탭이 받은 `month` 파라미터를 화면 상태로 옮길 값으로 좁힌다.
 *
 * expo-router의 `useLocalSearchParams`는 같은 키가 여러 번 오면 배열을 준다 — 첫 값만 본다
 * (기록 탭의 기존 관례). 형식이 어긋나면 null이고, 그때 화면은 이 파라미터가 없던 때와 똑같이
 * 동작한다(미래 월·먼 과거의 처리는 오프셋 환산이 맡는다 — resolveMonthJumpOffset).
 */
export function resolveReportsMonthLandingParam(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && YEAR_MONTH_PATTERN.test(value) ? value : null;
}

/**
 * 리포트 탭이 받은 회차 파라미터. 숫자 문자열이 아니면 null이고, 그때 화면은 **회차가 없던
 * 때처럼** 첫 진입에서 정확히 한 번만 적용한다(기록 탭 `viewNonce`와 같은 관례).
 *
 * 비교는 **문자열 그대로** 한다 — 화면이 알아야 하는 것은 "지난번과 다른가" 하나뿐이고, 크기를
 * 비교하는 순간 "더 작은 회차는 무시" 같은 규칙이 생겨 두 곳이 카운터의 의미에 합의해야 한다.
 */
export function resolveReportsMonthLandingNonceParam(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && NONCE_PATTERN.test(value) ? value : null;
}
