import { calculateChildStage, isChildStageCode } from "@wooriai/domain";
import { bandForStage, type StageBandLabel } from "../items/stage-bands";
import { formatKrw } from "../money";
import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { countPermanentlyFailedRows } from "../offline/permission-denied";
import { cumulativeTotalPendingNoticeText } from "./cumulative-total";
import { addDays, daysBetween, isDateOnly } from "./day-math";
import { homeGuideSpeaksForEmptyHome, type HomeFirstRunGuideVariant } from "./first-run-guide";

/**
 * 라운드 101 트랙 F5 — **시기 전환 회고 카드**의 순수 판정 + 문구.
 *
 * 시기가 방금 바뀐 홈에 "지난 {시기} 정리" 카드 한 장을 세운다: 그 구간의 지출 합계와 기록
 * 건수를 **사실만**(DNC-018 관측 톤 — 축하·평가·조언 0글자) 말하고, 닫으면 그 전환에 대해
 * 다시 서지 않는다.
 *
 * ## 판정 — 도메인 판정 재사용, 산술 복제 금지
 *
 * "언제 시기가 바뀌었는가"를 이 파일이 계산하지 않는다. next-stage-preview(src/items/
 * next-stage-preview.ts)가 앞으로 14일을 하루씩 도메인에 묻듯, 여기는 **지난 7일을 하루씩**
 * 같은 두 판정(`calculateChildStage` + `bandForStage`)에 물어 밴드가 갈라진 날을 찾는다.
 * 경계식(개월 산술·밴드 매핑)은 한 줄도 옮겨 적지 않는다 — 물음은 최대 7번이고 전부 순수
 * 함수다. **임신 → 출생 전환**은 밴드 스캔으로 보이지 않으므로(임신 스테이지 셋과 신생아가
 * 전부 "0-6개월" 밴드다) 출생일 자체를 전환일로 읽는다 — 지난 시기의 이름은 밴드 라벨이
 * 아니라 달력 사실("임신")이다. 임신 **중**에는 회고가 없다(early→mid→late는 준비물 목록이
 * 갈리지 않는 내부 전환이라 정리할 "지난 시기"가 아니다).
 *
 * ## 창 — 전환일을 1일째로 세어 7일째까지, 그 뒤엔 소멸
 *
 * 회고는 전환 직후에만 정보다: 일주일이 지나면 홈은 이미 새 시기의 이야기(기본 칩·준비템)를
 * 하고 있고, 지나간 구간의 요약이 상시 카드로 남으면 소음이다(주간 요약처럼 매주 갱신되는
 * 사실이 아니라 한 번 지나가면 끝나는 사실이다). "태어난 날을 1일로 센다"는 홈 카운터의
 * 관례(day-math.ts 머리말)를 그대로 문다 — 전환일이 1일째, 7일째까지 서고 8일째부터 null.
 *
 * ## 데이터 — 홈이 이미 가진 캐시만 (새 요청 0건), 그래서 문장이 구간을 스스로 밝힌다
 *
 * 지출 행은 홈이 주간 카드·지난달 비교를 위해 이미 들고 있는 **두 달치**(이번 달 + 지난달
 * `["expenses", childId, yearMonth]` 캐시의 재조정 결과)가 전부다. 지난 시기는 대개 그보다
 * 길므로(밴드 하나가 6개월 이상, 임신은 아홉 달) **"그 시기 동안"이라는 합계 주장은 이
 * 캐시로 만들 수 없다** — 만들면 시기 앞부분의 지출이 조용히 빠진 허위 합계가 된다. 그래서
 * 이 카드는 기간 전체를 주장하는 대신 **문장이 구간을 명시한다**("8월 1일부터 9월 2일까지
 * 지출 …"): 언제나 참인 달력 사실이고, 캐시가 덮는 범위(coverageStartIso)와 지난 시기의
 * 교집합만 센다. 시기 시작이 커버리지 안에 있으면(생년월일 수정 등 드문 경우) 되짚기 스캔이
 * 창을 시기 시작으로 좁혀 이전 시기의 행이 섞이지 않게 한다.
 *
 * ## 준비템 완료 개수는 싣지 않는다 (설계에서의 의도된 이탈 — 근거)
 *
 * 설계는 "준비템 완료 개수"를 카드에 실으라 했지만, 홈이 가진 준비템 스냅숏은 `/home`의
 * `recommendedItems` — **지금(새) 시기의 미해결 상위 3건 슬라이스**다(prep-nudge.ts 머리말:
 * "개수를 제목에 넣지 않는다 — 서버가 3건으로 자른 일부"). 지난 시기의 준비템 목록도, 상태
 * 변경의 시점도 이 화면에는 없으므로 "지난 시기 동안 완료 N개"는 이 캐시로 셀 수 없는
 * 주장이다(허위 표시 금지). 새 요청 0 원칙과 정면 충돌이라 지출 사실 둘(합계·건수)만 싣고,
 * 이 한계를 여기 기록한다 — 준비율 화면(prep-progress)이 같은 숫자를 정직하게 말하는 자리다.
 *
 * ## 합계 술어 — 다른 표면과 같은 한 벌 + 대기 고지
 *
 * 기간 합류는 `countsTowardMonthlyTotal`(offline/expense-list-reconciliation.ts) 그대로다 —
 * 선물·환불 제외, 필드 없는 레거시 행 포함(지난달 비교·리포트 고지와 같은 술어). 합계에는
 * **서버가 확정한 행만** 더한다: 회고는 지나간 구간의 정리라, 아직 실패·폐기될 수 있는 대기
 * 행을 조용히 섞으면 그 행이 사라진 날 카드가 말했던 숫자가 거짓이 된다. 대신 그 행들의
 * 존재를 pending-scope-notice 관례로 밝힌다 — 문장은 누적 카드와 **같은 함수**
 * (`cumulativeTotalPendingNoticeText`)다: 지시어("이 금액에")가 바로 위 합계를 짚고, 영구
 * 실패(4xx) 행의 어휘 분리("보낼 수 없는 기록")까지 그 한 벌이 진다.
 *
 * ## 빈 홈 게이트 · 닫음 멱등
 *
 * - 빈 홈의 안내(first-expense/view-only)가 서 있으면 회고도 접는다 — 빈 홈에는 "다음 한
 *   걸음"이 하나만 서야 한다(DNC-002). 판정은 first-run-guide.ts의
 *   `homeGuideSpeaksForEmptyHome` **하나**다(prep-nudge·주간 카드가 접히는 그 판정).
 * - 닫음 키는 `stage_retrospective:{childId}:{전환일}` — stage_transition 알림 멱등 키 규약
 *   (전환 식별자만, 오늘을 넣지 않는다)을 문되 **접두는 별도**다: D-7 예고(알림함,
 *   `stage_transition_d7:`)·전환 알림(`stage_transition:`)과 표면이 다르고(홈 카드) 문구도
 *   겹치지 않는다. 생년월일이 수정돼 전환일이 달라지면 키가 갈리며 새 사실로 다시 선다
 *   (stage-preview-d7과 같은 성질). 닫음의 저장은 화면 몫이다(first-run-guide.store).
 *
 * ## standalone 패리티 · 시계 주입
 *
 * 순수 함수다: 시계를 읽지 않고(`todayIso` 주입), 요청을 내지 않는다. 입력은 전부 화면이
 * 이미 구독 중인 캐시(["children"] 행 · 두 달 지출 캐시 · 오프라인 스냅숏)에서 온다.
 */

/** 표시 창(일). 전환일을 1일째로 세어 7일째까지 — 8일째부터 소멸(머리말 "창" 절). */
const RETROSPECTIVE_WINDOW_DAYS = 7;

/**
 * 지난 시기 시작 되짚기 스캔의 상한(일). 커버리지가 최대 두 달(≤62일)이라 그보다 넉넉하면
 * 충분하다 — 스캔은 커버리지 첫날에서 어차피 멈춘다(그 앞은 셀 행이 없다).
 */
const PERIOD_SCAN_CAP_DAYS = 70;

const STAGE_RETROSPECTIVE_TEST_ID = "home-stage-retrospective";

/** 닫기 버튼 문구 — 첫 기록 축하 배너의 닫기와 같은 성질(한 번 닫으면 끝)이라 같은 낱말이다. */
const STAGE_RETROSPECTIVE_DISMISS_LABEL = "닫기";

/** 임신 → 출생 전환의 지난 시기 이름. 밴드 라벨이 아니라 달력 사실이다(머리말 "판정" 절). */
const PREGNANCY_PERIOD_LABEL = "임신";

/**
 * `stage_retrospective:{childId}:{전환 시작일}` — 키를 만드는 자리가 여기 하나다
 * (stagePreviewD7DedupeKey와 같은 관례: 형식을 두 번 적지 않는다).
 */
export function stageRetrospectiveDismissKey(childId: string, transitionIso: string): string {
  return `stage_retrospective:${childId}:${transitionIso}`;
}

/**
 * 그날의 밴드 — 출생 갈래의 도메인 스테이지 판정을 밴드 하나로 접는다. 판정이 서지 않으면
 * null(형식 오류·모르는 스테이지 — 지어내지 않는다). next-stage-preview의 bandOnDate와 같은
 * 소비 방식이다(같은 두 판정에 묻기만 한다 — 그쪽 모듈의 화면 상태 입력이 여기 없어 import
 * 대신 같은 원천 둘을 직접 부른다).
 */
function bandOnBornDate(birthDate: string, dateIso: string): StageBandLabel | null {
  try {
    const calculated = calculateChildStage({ stageMode: "born", birthDate, today: dateIso });
    if (!isChildStageCode(calculated.stageCode)) return null;
    return bandForStage(calculated.stageCode, "ageMonths" in calculated ? calculated.ageMonths : null);
  } catch {
    return null;
  }
}

export type RecentStageTransition = {
  /** 어느 갈래의 전환인가 — 출생("birth") / 밴드 갈림("band"). */
  kind: "birth" | "band";
  /** 카드 제목이 부르는 지난 시기의 이름 — 밴드 라벨 또는 "임신". */
  previousLabel: string;
  /** 새 시기가 시작된 날("YYYY-MM-DD"). 닫음 키의 전환 식별자다. */
  transitionIso: string;
  /** band 갈래에서 지난 시기의 밴드(되짚기 스캔용). birth 갈래는 null — 임신 시작을 되짚지 않는다. */
  previousBand: StageBandLabel | null;
  /** 전환일로부터 오늘까지의 일수(0 = 전환 당일 = 1일째). 항상 0..6이다. */
  daysSinceTransition: number;
};

/**
 * 창(전환일 포함 7일) 안에서 방금 지나간 시기 전환. 없으면 null — 수동 단계·임신 중·날짜
 * 없음/형식 오류·창 밖 전부(지어내지 않는다).
 */
export function findRecentStageTransition(input: {
  stageMode: unknown;
  birthDate?: unknown;
  todayIso: string;
}): RecentStageTransition | null {
  if (!isDateOnly(input.todayIso)) return null;
  // 임신 중에는 회고가 없다(머리말 "판정" 절 — 내부 전환은 정리할 지난 시기가 아니다).
  // 수동 단계에는 달력 경계 자체가 없다(next-stage-preview의 숨김 규칙 그대로).
  if (input.stageMode !== "born" || !isDateOnly(input.birthDate)) return null;

  const daysSinceBirth = daysBetween(input.birthDate, input.todayIso);
  if (daysSinceBirth === null || daysSinceBirth < 0) return null;
  if (daysSinceBirth < RETROSPECTIVE_WINDOW_DAYS) {
    return {
      kind: "birth",
      previousLabel: PREGNANCY_PERIOD_LABEL,
      transitionIso: input.birthDate,
      previousBand: null,
      daysSinceTransition: daysSinceBirth
    };
  }

  const todayBand = bandOnBornDate(input.birthDate, input.todayIso);
  if (todayBand === null) return null;
  for (let day = 1; day <= RETROSPECTIVE_WINDOW_DAYS; day += 1) {
    const dateIso = addDays(input.todayIso, -day);
    if (dateIso === null) return null;
    const band = bandOnBornDate(input.birthDate, dateIso);
    // 판정이 서지 않는 날이 나오면 멈춘다 — 모르는 것 위에 전환을 지어내지 않는다.
    if (band === null) return null;
    if (band !== todayBand) {
      const transitionIso = addDays(dateIso, 1);
      if (transitionIso === null) return null;
      return {
        kind: "band",
        previousLabel: band,
        transitionIso,
        previousBand: band,
        daysSinceTransition: day - 1
      };
    }
  }
  return null;
}

/**
 * 회고가 읽는 지출 행 — 화면의 재조정 결과(reconcileMonthlyExpenses)와 구조 호환.
 * `pendingSync`가 참인 행은 이 기기에만 있고 서버 확정 전인 갈래(offlinePendingRows)다 —
 * 합계에서 빼고 고지로 밝힌다(머리말 "합계 술어" 절). 실패 사유 칸 셋은 영구 실패 어휘
 * 분리(`countPermanentlyFailedRows`)가 읽는다 — 전부 선택이라 모르는 호출부는 일시 갈래로 읽힌다.
 */
export type StageRetrospectiveExpenseRow = {
  amountKrw: number;
  /** "YYYY-MM-DD" (서버 toExpenseDto의 date-only 포맷). */
  spentOn: string;
  expenseType?: string | null;
  pendingSync?: boolean;
  syncState?: string | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
};

export type StageRetrospectiveCard = {
  kind: "birth" | "band";
  /** 닫음 persist의 키(`stage_retrospective:{childId}:{전환일}`). */
  dismissKey: string;
  /** "지난 0-6개월 시기 정리" / "지난 임신 시기 정리". */
  title: string;
  /** 구간을 스스로 밝히는 사실 한 줄 — "8월 1일부터 9월 2일까지 지출 45,000원 · 12건을 기록했어요." */
  summaryText: string;
  /** 동기화 대기 행이 있을 때만 서는 한 줄(누적 카드와 같은 문장 소스). 없으면 null. */
  pendingNoticeText: string | null;
  dismissLabel: string;
  dismissAccessibilityLabel: string;
  testID: string;
  /** TalkBack이 카드 전체를 한 덩어리로 읽을 문장(제목 → 사실 → 고지 순 — 화면 읽기 순서와 같다). */
  accessibilityLabel: string;
};

export type StageRetrospectiveInput = {
  /** 지금 보고 있는 아이. 모르면 카드도 없다(누구의 회고인지 모른 채 말하지 않는다). */
  childId: string | null | undefined;
  /** Child.stageMode — "born"만 판정 대상이다(임신 중·수동은 침묵). */
  stageMode: unknown;
  /** Child.birthDate ("YYYY-MM-DD") — 전환 판정의 유일한 날짜 입력. */
  birthDate?: unknown;
  /** 서울 기준 오늘("YYYY-MM-DD") — 주입한다(이 모듈은 시계를 읽지 않는다). */
  todayIso: string;
  /** 지금 홈에 떠 있는 첫 실행 안내 카드의 종류(`firstRunGuide?.variant ?? null`) — 빈 홈 게이트. */
  guideVariant: HomeFirstRunGuideVariant | null | undefined;
  /** 이 기기에서 닫은 회고 키들(first-run-guide.store의 dismissedStageRetrospectiveKeys). */
  dismissedKeys: readonly string[];
  /** 두 달치 재조정 지출 행(이번 달 + 지난달). 아직 안 불러왔으면 null — 그때는 카드도 없다. */
  records: readonly StageRetrospectiveExpenseRow[] | null | undefined;
  /** `records`가 1일부터 온전히 덮는 가장 이른 날("YYYY-MM-01") — 합계 창의 바닥이다. */
  coverageStartIso: string | null | undefined;
};

/** "YYYY-MM-DD" → "9월 2일" (형식은 호출부가 이미 보증했다 — stage-preview-d7과 같은 되읽기). */
function monthDayText(dateIso: string): string {
  const month = Number(dateIso.slice(5, 7));
  const day = Number(dateIso.slice(8, 10));
  return `${month}월 ${day}일`;
}

/**
 * 지난 밴드가 시작된 날을 커버리지 안에서 되짚는다. 커버리지 첫날까지 내려가도 같은 밴드면
 * null(시작이 커버리지 밖 — 창은 커버리지 첫날에서 시작한다). 판정이 서지 않는 날을 만나도
 * null — 모르는 경계로 창을 좁히지 않는다.
 */
function scanPreviousBandStart(
  birthDate: string,
  periodEndIso: string,
  previousBand: StageBandLabel,
  floorIso: string
): string | null {
  for (let day = 1; day <= PERIOD_SCAN_CAP_DAYS; day += 1) {
    const dateIso = addDays(periodEndIso, -day);
    if (dateIso === null || dateIso < floorIso) return null;
    const band = bandOnBornDate(birthDate, dateIso);
    if (band === null) return null;
    if (band !== previousBand) return addDays(dateIso, 1);
  }
  return null;
}

/**
 * 시기 전환 회고 카드 한 장. 세울 이유가 없으면 null — 창 밖·닫음·빈 홈 안내 활성·데이터
 * 미도착·창 안 확정 기록 0건(0건을 "0건"이라 말하려고 카드를 세우지 않는다 — 홈 관례이고,
 * 기록이 적던 구간의 회고는 질책으로 읽힐 여지가 있다: DNC-018).
 */
export function evaluateStageRetrospective(input: StageRetrospectiveInput): StageRetrospectiveCard | null {
  if (!input.childId) return null;
  // 빈 홈에는 "다음 한 걸음" CTA가 하나만 서야 한다(DNC-002) — 판정은 한 곳이다(머리말).
  if (homeGuideSpeaksForEmptyHome(input.guideVariant)) return null;

  const transition = findRecentStageTransition(input);
  if (transition === null) return null;

  const dismissKey = stageRetrospectiveDismissKey(input.childId, transition.transitionIso);
  if (input.dismissedKeys.includes(dismissKey)) return null;

  if (!input.records) return null;
  if (!isDateOnly(input.coverageStartIso)) return null;

  // 지난 시기의 마지막 날 — 전환일 자체는 새 시기의 1일째라 창에 넣지 않는다.
  const periodEndIso = addDays(transition.transitionIso, -1);
  if (periodEndIso === null) return null;

  let windowStartIso: string = input.coverageStartIso;
  if (transition.kind === "band" && transition.previousBand !== null && isDateOnly(input.birthDate)) {
    const periodStartIso = scanPreviousBandStart(
      input.birthDate,
      periodEndIso,
      transition.previousBand,
      windowStartIso
    );
    // 시기 시작이 커버리지 안이면 창을 거기서 시작한다 — 이전 시기의 행이 섞이지 않게(두 끝 가드).
    if (periodStartIso !== null && periodStartIso > windowStartIso) windowStartIso = periodStartIso;
  }
  // 창의 두 끝이 뒤집히면(지난달 캐시가 없는 월초 전환 등) 셀 수 있는 날이 없다 — 지어내지 않는다.
  if (windowStartIso > periodEndIso) return null;

  let totalKrw = 0;
  let settledCount = 0;
  const pendingRows: StageRetrospectiveExpenseRow[] = [];
  for (const row of input.records) {
    if (!isDateOnly(row.spentOn)) continue;
    // 슬라이스 두 끝 가드: 시작(커버리지/시기 시작)과 끝(전환 전날) 둘 다 포함 경계로 명시한다.
    if (row.spentOn < windowStartIso || row.spentOn > periodEndIso) continue;
    // 합계 합류는 다른 표면과 같은 술어 하나다(선물·환불 제외 — DNC-015, 레거시 행 포함).
    if (!countsTowardMonthlyTotal(row.expenseType)) continue;
    if (row.pendingSync) {
      pendingRows.push(row);
      continue;
    }
    if (!Number.isFinite(row.amountKrw)) continue;
    totalKrw += row.amountKrw;
    settledCount += 1;
  }
  if (settledCount === 0) return null;

  const title = `지난 ${transition.previousLabel} 시기 정리`;
  const summaryText = `${monthDayText(windowStartIso)}부터 ${monthDayText(periodEndIso)}까지 지출 ${formatKrw(totalKrw)} · ${settledCount}건을 기록했어요.`;
  // 대기 행은 합계에서 뺐으므로 누적 카드의 문장("이 금액에 아직 반영되지 않았어요")이 그대로
  // 참이다 — 지시어가 바로 위 합계를 짚고, 영구 실패 어휘 분리까지 같은 한 벌이 진다(머리말).
  const pendingNoticeText =
    pendingRows.length > 0
      ? cumulativeTotalPendingNoticeText(pendingRows.length, countPermanentlyFailedRows(pendingRows))
      : null;

  return {
    kind: transition.kind,
    dismissKey,
    title,
    summaryText,
    pendingNoticeText,
    dismissLabel: STAGE_RETROSPECTIVE_DISMISS_LABEL,
    dismissAccessibilityLabel: `${title} ${STAGE_RETROSPECTIVE_DISMISS_LABEL}`,
    testID: STAGE_RETROSPECTIVE_TEST_ID,
    accessibilityLabel: pendingNoticeText ? `${title}. ${summaryText} ${pendingNoticeText}` : `${title}. ${summaryText}`
  };
}
