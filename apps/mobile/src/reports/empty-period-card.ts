/**
 * GAP-072 트랙 C(#3) — 리포트 탭의 **빈 기간 카드**(제목 + 액션)의 단일 소스.
 *
 * ## 무엇이 문제였나
 *
 * `app/(tabs)/reports.tsx`의 `categoryData.length === 0` 가지는 라운드 39 **이전** 문장을 그대로
 * 들고 있었다("첫 기록을 남기면 **이번 달** … 보여드릴게요." + [지출 기록하기] → `/expenses/new`).
 *
 * 형제 화면(기록 탭)은 같은 자리를 두 번 고쳤다(`src/expenses/records-list-view.ts`의
 * `buildRecordsEmptyMonthState` 머리말). 그 두 판정의 전제가 리포트 탭에도 **이미 성립한다**:
 *
 *  1. 라운드 66 A(#2)가 이 화면의 기간 라벨을 월 선택 시트 입구로 만들었다 — 시트는 **21개월**을
 *     건넌다. 즉 "빈 기간 = 이번 달"이라는 라운드 39 이전의 전제가 깨졌다.
 *  2. "첫 기록"은 기록이 800건 있는 사람에게 **거짓**이다.
 *  3. [지출 기록하기]가 여는 것은 파라미터 없는 `/expenses/new`라 **오늘 날짜**로 저장한다 —
 *     작년 11월을 보려던 사람이 오늘 지출을 하나 만든다.
 *  4. 이 카드는 **월간·분기·연간 세 탭이 함께** 쓴다(`categoryData`는 `activeCategory`를 따른다).
 *     연간 탭에서 뜨면 화면은 바로 위 `categoryCardTitle`("2025년 카테고리 비중")과 이 카드
 *     ("이번 달")로 **서로 다른 기간**을 동시에 말한다.
 *
 * ## 이 모듈이 하는 일
 *
 * **끝난 기간에는 약속이 아니라 사실**을 놓고, 액션은 그 기간에서 실제로 할 수 있는 일을
 * 가리킨다. 현재 기간은 **한 글자도 바뀌지 않는다**.
 *
 * ### 문장을 두 벌로 만들지 않는다
 *
 * 제목은 이 모듈이 짓지 않는다 — 형제 모듈 `buildRecordsEmptyMonthState`를 **그대로 불러** 그
 * `title`만 읽는다(그 파일은 기록 탭의 소유물이고 이번 라운드가 열지 않는다 · 읽기 전용).
 * 그래서 세 갈래의 문장이 저장소에 한 벌씩만 존재한다:
 *
 *  - 보기 전용 세션        → `EXPENSE_VIEW_ONLY_EMPTY_TITLE`(라운드 40 J-5)
 *  - 현재 기간 / 라벨 없음 → 종전의 "첫 기록을 남기면 …" 약속 한 줄(글자 그대로)
 *  - 끝난 기간             → 라운드 67 A의 **사실 한 줄** 틀(기간 라벨 + "… 기록이 없어요.")
 *
 * 형제 모듈의 인자 이름이 `monthLabel`·`isCurrentMonth`인 것은 그 화면이 달 단위 화면이기
 * 때문이고, 그 함수가 라벨에 하는 일은 **문자열 조립 하나뿐**이다. 그래서 분기·연간 라벨을
 * 그대로 넘겨도 "2025년 3분기 …" · "2025년 …"으로 그 틀이 성립한다 — 리포트 고유의 기간
 * 단위는 이 모듈이 더하고, 문장 틀은 형제 모듈에서 온다.
 *
 * ### 날짜를 지어내지 않는다 — 끝난 기간의 액션은 `/expenses/new`가 아니다
 *
 * 기록 탭이 세운 그 규칙 그대로다(`records-list-view.ts`의 "날짜를 지어내지 않는다" 문단 ·
 * DNC-013). 끝난 기간에서 할 수 있는 정직한 일은 **현재 기간으로 되돌아가기** 하나다:
 * 카테고리 응답이 0건이라는 것은 그 기간에 기록이 **정말로 없다**는 뜻이라, 그 기간의 어느 달을
 * 기록 탭에서 열어도 같은 빈 화면이 나온다(보낼 곳이 없다 — 기록 탭이 달력 보기에서 "이번 달
 * 보기"를 남긴 것과 같은 판정이다). 그래서 액션 키는 둘뿐이고, 그중 `/expenses/new`로 가는
 * 것은 **현재 기간 갈래 하나**다.
 *
 * ## 남는 사실 하나(값으로 적어 둔다 — 다음 라운드가 다시 세지 않게)
 *
 * **현재 분기·현재 연도**에서는 종전 문장이 그대로 서므로 카드가 여전히 "이번 달"이라고 말한다.
 * 그 자리를 이번 라운드가 건드리지 않는 이유는 두 가지다: ⓐ 그 문장은 홈·기록 탭의 현재 달
 * 카드와 **한 벌**이고(`src/refresh-wiring-contract.test.ts`가 홈↔기록의 일치를 고정한다),
 * 리포트만 기간별 변형을 새로 지으면 저장소에 **네 번째 문장**이 생긴다. ⓑ 진행 중인 기간의
 * 그 약속은 아직 **지킬 수 있는 약속**이라 거짓이 아니다(끝난 기간에서만 거짓이 된다).
 * 즉 남은 것은 지시대명사의 단위 불일치이지 허위 표시가 아니다.
 */

import { buildRecordsEmptyMonthState, RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL } from "../expenses/records-list-view";
import type { PeriodUnit } from "../period-navigation";

/** 빈 기간 카드가 제안하는 다음 행동 — 화면은 이 키로 무엇을 배선할지 정한다. */
export type ReportEmptyPeriodAction = "record" | "go-current-period";

export type ReportEmptyPeriodCard = {
  /** 0건 카드 제목. */
  title: string;
  /** 기본 액션 버튼 라벨. */
  actionLabel: string;
  /** 그 버튼이 실제로 하는 일. */
  action: ReportEmptyPeriodAction;
};

/**
 * 현재 기간 갈래의 액션 라벨 — 리포트 탭의 종전 문자열 그대로다(기록 탭의 [기록하기]와 글자가
 * 다른 것도 종전 그대로다: 이 화면의 버튼은 라운드 초기부터 "지출 기록하기"였다).
 */
export const REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL = "지출 기록하기";

/**
 * 끝난 기간에서 되돌아갈 곳의 라벨. 월간은 기록 탭이 **이미 쓰는 그 문구**를 읽어 쓰고
 * (새 문구 0건), 분기·연간만 이 모듈이 같은 문법("이번 … 보기")으로 더한다.
 */
export const REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS: Readonly<Record<PeriodUnit, string>> = {
  month: RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL,
  quarter: "이번 분기 보기",
  year: "올해 보기"
};

/**
 * "기록이 0건인 기간"을 사용자에게 보여 주는 화면 목록 — **상황**의 단일 소스.
 *
 * 이번 라운드의 결함이 여섯 라운드를 살아남은 이유가 여기 있다: 라운드 39·67이 기록 탭에서 고친
 * 것과 **글자 그대로 같은 문장**이 리포트 탭에 남아 있었는데, 두 화면이 같은 상황을 만난다는
 * 사실이 저장소 어디에도 적혀 있지 않았다. 그래서 계약이 물어야 할 것은 "이 문장을 쓰는 모듈이
 * 몇 개인가"가 아니라 **"이 상황을 만나는 화면이 몇 개인가"**다.
 *
 * 오늘은 셋이다:
 *  - `app/(tabs)/index.tsx`   — 홈의 "최근 지출" 빈 카드(MOB-117). 언제나 **현재 달**이다.
 *  - `app/(tabs)/records.tsx` — 기록 탭의 빈 달 카드(`buildRecordsEmptyMonthState`).
 *  - `app/(tabs)/reports.tsx` — 리포트 탭의 빈 기간 카드(이 모듈).
 *
 * `src/reports/empty-period-card.test.ts`가 `app/**`을 훑어 이 목록과 **정확히 일치**하는지 본다 —
 * 같은 상황을 그리는 화면이 새로 생기면 그 테스트가 먼저 깨지며 여기 한 줄을 추가하라고 말한다.
 */
export const EMPTY_RECORD_PERIOD_SCREENS: ReadonlyArray<string> = [
  "app/(tabs)/index.tsx",
  "app/(tabs)/records.tsx",
  "app/(tabs)/reports.tsx"
];

/**
 * 그 기간의 카테고리 응답이 0건일 때 서는 카드.
 *
 * @param unit          보고 있는 세그먼트(월간/분기/연간). 화면이 이미 계산해 둔 `periodUnit`.
 * @param periodLabel   화면이 이미 계산해 둔 기간 라벨("2025년 11월"·"2025년 3분기"·"2025년").
 *                      바로 위 `categoryCardTitle`이 가리키는 **그 기간**이다.
 * @param isCurrentPeriod 지금 보고 있는 기간이 현재 기간인가(`!canGoToNextPeriod(offset)`).
 * @param expenseEntryLocked 보기 전용 세션인가(라운드 40 J-5 — 이 갈래는 무변경이다).
 */
export function buildReportEmptyPeriodCard(input: {
  unit: PeriodUnit;
  periodLabel: string;
  isCurrentPeriod: boolean;
  expenseEntryLocked?: boolean;
}): ReportEmptyPeriodCard {
  // 문장은 형제 모듈이 고른다(위 머리말 — 저장소에 문장 한 벌씩만 둔다). 라벨을 모르는 경우까지
  // 그쪽 규칙 그대로다: 기간 이름을 지어내지 않고 종전 문장으로 되돌아간다.
  const sentence = buildRecordsEmptyMonthState({
    monthLabel: input.periodLabel,
    isCurrentMonth: input.isCurrentPeriod,
    expenseEntryLocked: input.expenseEntryLocked
  });

  // 종전 카드가 그대로 서는 세 경우(보기 전용 · 현재 기간 · 기간 이름을 모름)를 형제 모듈이 한
  // 번에 가른다 — 그 셋에서 `action`이 "record"다. 제목·라벨·액션 모두 종전과 바이트 단위로 같다.
  if (sentence.action === "record") {
    return {
      title: sentence.title,
      actionLabel: REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL,
      action: "record"
    };
  }

  // 끝난 기간: 약속 대신 사실. 액션은 오늘 날짜 기록 시트가 아니라 현재 기간으로 되돌아가기다.
  return {
    title: sentence.title,
    actionLabel: REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS[input.unit],
    action: "go-current-period"
  };
}
