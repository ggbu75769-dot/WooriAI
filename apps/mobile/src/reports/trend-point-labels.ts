import { formatKrw } from "../money";

/**
 * 라운드 85 트랙 C: 추이 차트가 **어느 달의 얼마인지** 말하게 하는 순수 모듈.
 *
 * ## 무엇이 문제였나
 * 서버의 추이 응답은 달마다 `{ yearMonth, totalExpenseKrw }` **둘**을 준다
 * (`TrendReport.months` · `YearlyReport.monthlyTotals` — src/api/client.ts). 그런데 화면
 * (app/(tabs)/reports.tsx)은 `totalExpenseKrw`만 뽑아 `number[]`로 접어 카드에 넘겼고,
 * `yearMonth`는 그 자리에서 버려졌다. 그래서 차트에는
 *
 * - **x축 라벨이 0건**이었다 — 점 여섯 개가 어느 달인지 그림 어디에도 적혀 있지 않았다.
 * - **낭독에도 계열이 0건**이었다 — TalkBack은 "총 지출 추이 차트, 합계 …"까지만 읽고
 *   멈췄다. 접근성 체크리스트 13행의 "추세를 문장으로 듣는다"는 그만큼 과장이었다.
 *
 * 데이터는 이미 응답 안에 있었다. 새 요청도, 새 집계도 필요 없다 — 버리지만 않으면 된다.
 *
 * ## 이 모듈이 지는 규칙
 * - **라벨은 `yearMonth`에서만 나온다.** 인덱스로 "1월, 2월 …"을 지어내지 않는다. 읽을 수 없는
 *   달이 하나라도 있으면 **전체를 포기한다**(반쯤 지어낸 축은 없는 축보다 나쁘다).
 * - **달 키는 두 모양이 온다**(`MONTH_KEY_PATTERN` 머리말) — 추이 응답의 `YYYY-MM-01`과 연간
 *   응답의 `YYYY-MM`. 둘 다 읽는다.
 * - **라벨 수 ≠ 점 수면 그리지 않는다.** 분기·연간은 라운드 52 C-02가 미래 달을 잘라 내므로
 *   (src/reports/period-trend-points.ts) 잘린 뒤의 점과 라벨이 어긋날 수 있다. 어긋나면
 *   그리지 않는 쪽이 정직하다 — 8월 점 위에 12월이라 적힌 축은 허위 표시다.
 * - **금액 표기는 `formatKrw` 하나**다(src/money.ts의 D0 규칙 — 새 표기 규칙 0건).
 *
 * 순수 모듈인 이유: 리포트 탭과 `src/ui.tsx`는 vitest에서 렌더되지 않는다(react-native
 * 네이티브 바인딩 없음). 월간·분기·연간 **세 갈래가 같은 이 모듈**을 지난다.
 */

/**
 * 달 키 한 개가 실제로 오는 **두 모양**: `YYYY-MM`과 `YYYY-MM-01`.
 *
 * 종전 이 자리는 `/^\d{4}-\d{2}$/` 하나였다 — **그때는 연간 응답만 보고 참이었다.** 서버는 두
 * 리포트의 달 키를 서로 다른 형식으로 낸다:
 *
 * - 추이 `GET /reports/trend` → `months[].yearMonth`는 내부 **`YYYY-MM-01`**(date-only).
 *   근거: apps/api/src/onboarding/reporting-store.service.ts의 `trailingYearMonths`가 `-01`을
 *   붙여 만들고, 계약도 `dateOnlySchema`로 못박았다(packages/contracts/src/schemas.ts
 *   `reportTrendSchema`). 데모 백엔드(src/api/local-backend.ts `getTrendReport`)도 같다.
 * - 연간 `GET /reports/yearly` → `monthlyTotals[].yearMonth`는 **`YYYY-MM`**.
 *   근거: 같은 파일의 `reportYearlySchema`가 `/^\d{4}-\d{2}$/`다.
 *
 * 그래서 종전 규칙에서는 월간(6점)·분기(3점) 탭의 달이 **전부** "읽을 수 없는 값"이 되어 아래
 * 포기 규칙에 걸렸고, 두 탭은 축도 낭독 계열도 **0건**이었다(연간 탭만 고쳐져 있었다). 틀린
 * 달을 적지는 않았지만 — 포기 규칙이 그것만은 막았다 — 라운드 85 트랙 C가 없애려던 결함이 세
 * 탭 중 둘에서 그대로 살아 있었다.
 *
 * 이제 두 모양을 모두 읽는다. 근거: 라벨에 필요한 것은 **달**뿐이고 두 응답 다 그 달을 정확히
 * 말한다 — 형식 차이는 전송 표기일 뿐이라, 여기서 달을 읽는 것은 지어내는 것이 아니다.
 * 두 형식이 갈린 것 자체(계약)는 이 모듈이 고칠 수 있는 자리가 아니다.
 */
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

export type TrendPointLabels = {
  /**
   * x축에 점 순서대로 그릴 달 라벨("8월"). 만들 수 없으면 null이고, 그때 카드는 축을
   * **그리지 않는다**(종전 렌더 그대로).
   */
  labels: string[] | null;
  /**
   * 낭독 라벨 뒤에 이어 붙일 계열 한 조각("3월 120,000원, 4월 98,000원, …").
   * `labels`가 null이면 이것도 null이다.
   */
  accessibilitySeries: string | null;
};

/** 라벨을 만들 수 없을 때의 값. 카드가 이 값을 받으면 종전과 한 픽셀도 다르지 않게 그린다. */
export const EMPTY_TREND_POINT_LABELS: TrendPointLabels = { labels: null, accessibilitySeries: null };

/** "2026-08" · "2026-08-01" → "8월". 읽을 수 없으면 null(지어내지 않는다). */
function monthLabelOf(yearMonth: string): string | null {
  if (typeof yearMonth !== "string") return null;
  const matched = MONTH_KEY_PATTERN.exec(yearMonth);
  // 종전에는 `YYYY-MM`이 아니면 여기서 끝났다(그때는 연간 탭에서만 참) → 이제 `YYYY-MM-01`도
  // 읽는다. 포기 규칙 자체는 그대로다: 두 모양 어느 쪽도 아닌 값("2026-3" · "26-03" · 빈 값 ·
  // "2026-03-01T00:00:00Z" 같은 타임스탬프 · 자릿수 어긋남)은 여전히 null로 떨어진다.
  if (!matched) return null;
  const month = Number(matched[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  // 일(day)은 라벨에 쓰지 않지만 **읽히기는 해야 한다**. 서버·데모가 내는 값은 언제나 01이고,
  // 달력에 없는 일이 붙은 값("2026-03-00" · "2026-03-99")은 깨진 값이다 — 달만 떼어 읽으면
  // 그 깨진 값을 정상인 척 통과시키게 되므로, 그때도 종전처럼 포기한다.
  if (matched[3] !== undefined) {
    const day = Number(matched[3]);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  }
  return `${month}월`;
}

export type TrendPointLabelsInput = {
  /**
   * 차트가 그리는 점과 **같은 순서·같은 개수**의 달 키 목록. 종전 주석은 "YYYY-MM 목록"이라고
   * 적었는데(그때는 연간 응답만 보고 참) → 이제 응답이 주는 대로 `YYYY-MM`·`YYYY-MM-01` 둘 다
   * 받는다(`MONTH_KEY_PATTERN` 머리말). 아직 못 받았거나(로딩·실패·비세션) 화면이 자른 뒤의
   * 목록을 만들 수 없으면 null/undefined.
   */
  yearMonths: readonly string[] | null | undefined;
  /** 차트가 실제로 그리는 값들(자른 뒤). 카드에 넘기지 않는 경우와 같은 조건으로 비운다. */
  points: readonly number[] | null | undefined;
};

/**
 * 추이 차트의 달 라벨과 낭독 계열을 만든다.
 *
 * 입력이 없거나 라벨과 점이 1:1로 맞지 않으면 두 값 모두 null이라, 호출부는 종전과 똑같이
 * 동작한다(점 2개 미만 갈래·비세션 갈래는 애초에 여기까지 오지 않는다).
 */
export function buildTrendPointLabels(input: TrendPointLabelsInput): TrendPointLabels {
  const { yearMonths, points } = input;
  if (!yearMonths || !points) return EMPTY_TREND_POINT_LABELS;
  // 점이 없으면 라벨도 없다. 그리고 수가 다르면 **어느 쪽도** 그리지 않는다 — 짝이 맞지 않는
  // 축은 어느 점이 어느 달인지 틀리게 말한다(C-02가 잘라 낸 미래 달이 정확히 이 자리다).
  if (points.length === 0 || yearMonths.length !== points.length) return EMPTY_TREND_POINT_LABELS;

  const labels: string[] = [];
  for (const yearMonth of yearMonths) {
    const label = monthLabelOf(yearMonth);
    // 한 달이라도 읽을 수 없으면 축 전체를 포기한다(부분 축은 나머지 점의 달을 틀리게 만든다).
    if (label === null) return EMPTY_TREND_POINT_LABELS;
    labels.push(label);
  }

  return {
    labels,
    // 낭독은 "달 + 금액"의 되풀이다. 델타·평가·예측은 여기에 들어가지 않는다(DNC-018).
    accessibilitySeries: labels.map((label, index) => `${label} ${formatKrw(points[index])}`).join(", ")
  };
}
