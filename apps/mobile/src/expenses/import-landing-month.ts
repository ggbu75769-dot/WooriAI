/**
 * 라운드 51 C-#11 — 엑셀 가져오기 확정 후 **어느 달의 기록 탭에 내려놓을지**의 순수 계산.
 *
 * 고치는 것: 확정 완료 카드의 "가계부에서 확인하기"가 `router.replace("/(tabs)/records")`로
 * 무조건 **이번 달**을 열었다. 가져오기의 절대다수는 지난 몇 달치 가계부라, 128건을 확정한
 * 사용자가 곧바로 "가져왔는데 아무것도 안 보이는" 빈 목록을 보게 된다(기록은 멀쩡히 들어갔고,
 * 화면만 다른 달을 보고 있는 것이다). 사용자는 그 사실을 알 방법이 없다.
 *
 * 그래서 확정한 행들의 날짜에서 **대표 월**을 뽑아 기록 탭에 `month=YYYY-MM`으로 넘기고,
 * 기록 탭은 그 파라미터를 방어적으로 읽어 초기 월 오프셋만 정한다.
 *
 * 설계 규칙 세 가지:
 *  1. **최신 월**을 고른다. 여러 달에 걸친 파일이면 사용자가 가장 먼저 확인하고 싶은 것은
 *     가장 최근 기록이고, 거기서 ‹ 버튼으로 과거로 내려가는 것이 자연스럽다(반대 방향은
 *     "다음 달" 상한 때문에 답답하다).
 *  2. **파라미터는 초기값에만 쓴다.** 기록 탭은 첫 렌더에서 한 번만 읽고, 그 뒤 화면 안의 월
 *     이동은 종전 로직 그대로다 — 재렌더마다 다시 적용하면 사용자가 ‹ 로 옮긴 달이 딥링크
 *     파라미터 때문에 계속 되돌아간다.
 *  3. **모르면 종전대로.** 파라미터가 없거나 형식이 깨졌거나 미래 월이면 오프셋 0(이번 달)이다.
 *     추측해서 엉뚱한 달을 열지 않는다.
 *
 * react / react-native / expo-router 의존 없음 — vitest에서 바로 단위 테스트한다.
 */

/** 기록 탭이 읽는 라우트 파라미터 이름. 화면 두 곳이 같은 문자열을 쓰도록 여기 한 번만 적는다. */
export const RECORDS_MONTH_PARAM = "month";

/** `ImportRow`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ImportLandingRow = {
  /** 지출 발생일(ISO `YYYY-MM-DD`). 파싱하지 못한 행에는 없다. */
  parsedDate?: string;
};

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * 아무리 과거라도 여기까지만 따라간다(20년). 파일이나 파라미터가 1970-01 같은 값을 들고 와도
 * 기록 탭이 그 달을 열어 빈 화면 + 무의미한 요청을 만드는 대신, 종전대로 이번 달에 선다.
 */
const MAX_PAST_MONTH_OFFSET = 240;

function parseYearMonth(value: string): { year: number; month: number } | null {
  if (!YEAR_MONTH_PATTERN.test(value)) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

/**
 * 확정한 행들에서 대표 월(`YYYY-MM`)을 뽑는다. 뽑을 근거가 없으면 null —
 * 그러면 호출부는 파라미터를 붙이지 않고 종전 그대로(이번 달) 이동한다.
 *
 * 날짜 문자열은 `YYYY-MM-DD` 형태만 인정한다. 서버가 파싱하지 못한 행(`parsedDate` 없음)이나
 * 형식이 다른 값은 조용히 건너뛴다 — 억지로 해석해서 없는 달을 만들지 않는다.
 * `YYYY-MM` 문자열 비교는 사전순이 곧 시간순이라 그대로 최댓값을 취한다.
 */
export function resolveImportLandingMonth(rows: readonly ImportLandingRow[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    const iso = row?.parsedDate?.trim();
    if (!iso || !ISO_DATE_PATTERN.test(iso)) continue;
    const yearMonth = iso.slice(0, 7);
    if (latest === null || yearMonth > latest) latest = yearMonth;
  }
  return latest;
}

export type InitialMonthOffsetInput = {
  /** 라우트 파라미터 원본. expo-router는 같은 키가 여러 번 오면 배열을 준다. */
  monthParam?: string | string[] | null;
  /** 오늘(서울 기준) `YYYY-MM-DD`. */
  todayIso: string;
};

/**
 * `month=YYYY-MM` 파라미터를 기록 탭의 **초기** 월 오프셋(0 = 이번 달, 음수 = 과거)으로 바꾼다.
 *
 * 종전 동작(오프셋 0)으로 떨어지는 경우: 파라미터 없음 · 배열의 첫 값도 문자열이 아님 ·
 * 형식 오염("2026-13", "abc", "2026-3", 빈 문자열) · **미래 월**(기록 탭은 이번 달 이후로
 * 넘어가지 못한다 — canGoToNextPeriod와 같은 규칙) · 20년보다 먼 과거.
 */
export function resolveInitialMonthOffset({ monthParam, todayIso }: InitialMonthOffsetInput): number {
  const raw = Array.isArray(monthParam) ? monthParam[0] : monthParam;
  if (typeof raw !== "string") return 0;
  const target = parseYearMonth(raw.trim());
  if (!target) return 0;
  const today = parseYearMonth(todayIso.slice(0, 7));
  if (!today) return 0;
  const offset = (target.year - today.year) * 12 + (target.month - today.month);
  if (offset > 0) return 0;
  if (offset < -MAX_PAST_MONTH_OFFSET) return 0;
  return offset;
}

export type ImportLandingNoticeInput = {
  /** resolveImportLandingMonth의 결과. */
  landingMonth: string | null;
  /** 오늘(서울 기준) `YYYY-MM-DD`. */
  todayIso: string;
};

/**
 * 완료 카드에 붙는 한 줄 안내. **이동해 갈 달이 이번 달과 다를 때만** 말한다(DNC-018 해요체).
 *
 * 이번 달로 가는 경우에는 아무 말도 하지 않는다 — 종전과 똑같은 자리로 가는데 굳이 설명하면
 * 사용자가 없는 변화를 찾게 된다. 미래 월·형식 오염도 같은 이유로 침묵한다(기록 탭이 그런
 * 값에서는 이번 달에 서므로, 안내가 사실과 어긋나면 안 된다 — 두 판정이 같은 규칙을 쓴다).
 * 해가 다르면 연도까지 말한다("3월"만으로는 어느 3월인지 알 수 없다).
 */
export function importLandingMonthNotice({ landingMonth, todayIso }: ImportLandingNoticeInput): string | null {
  if (!landingMonth) return null;
  const target = parseYearMonth(landingMonth);
  if (!target) return null;
  if (resolveInitialMonthOffset({ monthParam: landingMonth, todayIso }) === 0) return null;
  const today = parseYearMonth(todayIso.slice(0, 7));
  const label = today && today.year === target.year ? `${target.month}월` : `${target.year}년 ${target.month}월`;
  return `${label} 기록으로 이동해요`;
}
