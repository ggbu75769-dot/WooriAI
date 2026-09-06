import { formatKrw } from "../money";
import { buildCategoryDrilldownTarget, type CategoryDrilldownTarget } from "./category-drilldown";

/**
 * 라운드 100 트랙 T5 — **카테고리 추이 막대 → 그 달의 기록 드릴다운**(순수 모듈).
 *
 * 기능 라운드 1 트랙 C가 이월한 후속이다: category-trend.ts는 "추이 점 → 기록 드릴다운"을
 * 명시적으로 범위 밖에 두었고("기존 드릴다운은 기간 카드 소유 — 후속"), 이 모듈이 그 자리를
 * 진다. **category-trend.ts·category-drilldown.ts는 비접촉**이다 — 판정 재료(막대)는 앞의
 * 산출을 그대로 받고, 링크 규약은 뒤의 빌더를 그대로 부른다.
 *
 * ## 파라미터 규약 — 새 규약 0건
 * 기록 탭이 받는 것은 라운드 52가 못 박은 삼요소 한 묶음(month·categoryId·drilldown 회차)
 * 그대로다 — 수신부(records.tsx)는 한 글자도 바뀌지 않는다. "그 막대의 달"은 기존 규약의
 * 언어로 **한 달짜리 기간**(startYearMonth = 그 달, monthCount = 1)이고, 착지 월 규칙
 * (resolveDrilldownMonth의 기간 안 클램프)은 한 달짜리 기간에서 언제나 그 달 자신을 낸다 —
 * 추이 창은 보고 있는 달로 끝나므로(미래 달 없음) 어림짐작 갈래가 없다. 회차(nonce)는
 * 도넛 범례와 **같은 화면 카운터**를 실어야 한다(카운터가 둘이면 서로의 회차를 되감아
 * "같은 값이니 할 일 없음"이 되살아난다 — QA P1-1/P2-1이 고친 바로 그 증상).
 */
export function buildCategoryTrendMonthDrilldownTarget(input: {
  /** 눌린 막대의 달 "YYYY-MM" — category-trend.ts가 만든 창의 원소라 형식은 이미 맞다. */
  yearMonth: string;
  categoryId: string | null | undefined;
  /** 이번 탭의 회차 — 도넛 발신과 공유하는 화면의 단조 증가 카운터. */
  nonce: number;
  /** 서울 기준 오늘 "YYYY-MM-DD" — 기존 빌더의 방어(형식 검증)를 그대로 지난다. */
  todayIso: string;
}): CategoryDrilldownTarget | null {
  return buildCategoryDrilldownTarget({
    startYearMonth: input.yearMonth,
    monthCount: 1,
    todayIso: input.todayIso,
    categoryId: input.categoryId,
    nonce: input.nonce
  });
}

/**
 * 막대 버튼 하나의 낭독 라벨 — "8월 기저귀/위생 12,000원, 기록 보기".
 *
 * 막대가 버튼이 되면 차트 한 덩어리 낭독(view.accessibilityLabel) 안에는 살 수 없다
 * (RN의 accessible 그룹은 안쪽 버튼을 삼킨다 — UX-H가 공유 버튼을 그룹 **형제**로 둔
 * 그 이유). 그래서 낭독 단위가 막대 여섯으로 갈라지는데, 라운드 85 낭독 규율(시각 전용
 * 정보 금지)은 그대로여야 하므로 각 라벨이 자기 달의 사실 전부를 말한다:
 * - 금액은 차트 낭독 계열과 같은 표기(formatKrw — "N월 X원"의 그 X원)다.
 * - 기록 자체가 없는 달은 0원 대신 **"기록 없음"** — 낭독 계열·구분 문구와 같은 사실을
 *   같은 말로 한다(기록 있는 0원과 갈린다).
 * - "기록 보기"는 눌렀을 때 일어나는 일이고, **몇 년의 몇 월인지**는 힌트가 말한다
 *   (categoryDrilldownHint — 도넛 범례와 같은 문장. 창이 해를 넘으면 "11월"만으로는
 *   2025년인지 모호해서, 착지 월을 누르기 전에 말하는 규율은 힌트의 연 표기가 진다).
 * - 조사 유틸이 필요 없다: 카테고리 라벨 뒤에 조사가 붙는 자리가 없고(공백 나열),
 *   문장이 아니라 라벨이라 해요체 종결도 없다 — 해요체 문장은 힌트("…볼 수 있어요") 몫이다.
 */
export function categoryTrendBarDrilldownLabel(
  bar: { monthLabel: string; amountKrw: number; hasRecords: boolean },
  categoryLabel: string
): string {
  const fact = bar.hasRecords ? formatKrw(bar.amountKrw) : "기록 없음";
  return `${bar.monthLabel} ${categoryLabel} ${fact}, 기록 보기`;
}
