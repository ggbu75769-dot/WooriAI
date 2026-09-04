import { calculateChildStage, isChildStageCode } from "@wooriai/domain";
import { addDays, daysBetween, isDateOnly } from "../home/day-math";
import { objectParticle } from "../text/korean-particles";
import { bandForStage, type StageBandLabel } from "./stage-bands";

/**
 * 기능 라운드 1 트랙 F — **다음 시기 D-day 예고 배너**의 순수 판정 + 문구.
 *
 * 지금 "다음 시기" 안내는 준비율 100% *완료 트리거*뿐이다(prep-milestones의 축하 배너).
 * 준비가 덜 된 사용자일수록 시기 전환에 미리 대비할 안내가 필요한데, *달력 트리거*가 없다 —
 * 이 모듈이 그 트리거다: 다음 시기 밴드 시작이 14일 이내로 다가오면 배너 한 장을 세우고,
 * 탭하면 **기존 시기 칩 선택**으로 그 밴드를 미리 연다(새 화면 없음, 새 요청 0건).
 *
 * ## 날짜 규칙 — 도메인 판정 재사용, 산술 복제 금지
 *
 * "언제 시기가 바뀌는가"를 이 파일이 다시 계산하지 않는다. 개월 산술은
 * `calculateChildStage`(@wooriai/domain — 서버와 같은 한 벌)가, 스테이지 → 밴드는
 * `bandForStage`(src/items/stage-bands.ts)가 이미 답하고 있으므로, 여기서는 **오늘부터
 * 14일 뒤까지 하루씩 그 두 판정에 물어** 밴드가 처음 갈라지는 날을 찾는다. 경계식(생후
 * 7개월의 시작일·24개월 겹침 밴드의 갈림)을 옮겨 적으면 두 곳이 조용히 갈라진다 —
 * 창이 14일이라 물음은 최대 15번이고 전부 순수 함수다.
 *
 * **임신 중이면 다음 경계는 출산 예정일이다**(설계 §트랙 F). 임신 스테이지 셋은 전부
 * "0-6개월" 밴드라 스캔으로는 경계가 보이지 않고, 출산이 곧 시기 전환이다. 그날의 밴드도
 * 지어내지 않는다 — 출생 당일의 도메인 판정(생년월일 = 예정일, 오늘 = 예정일)에 묻는다.
 *
 * **시계를 읽지 않는다**: 오늘은 `todayIso`로 주입받는다(라운드 90의 KST 월 경계 교훈 —
 * 서울 오늘은 화면이 만들어 넘기고, 테스트는 고정 날짜를 넘긴다).
 *
 * ## 숨김 규칙 (설계 §트랙 F — 판정은 이 모듈이 소유)
 *
 *  - `stageMode === "manual"` 또는 날짜 없음/형식 오류 → 숨김(지어내지 않는다. 수동 입력
 *    아이에게는 설계상 날짜가 없다 — stage-bands.ts의 라운드 74 B-1 주석).
 *  - 마지막 밴드(더 갈 밴드가 없음) → 숨김. 스테이지가 바뀌어도 **밴드가 같으면** 예고하지
 *    않는다(예: 47→48개월은 toddler→kid 전환이지만 둘 다 "24개월+" 칩이다 — 준비물 목록이
 *    바뀌지 않는 전환을 예고하면 소음이다).
 *  - **출생 갈래에서** 이미 다음 밴드를 보고 있는 중 → 숨김(권할 일이 이미 일어났고, 밴드
 *    전환 자체는 카탈로그 라벨의 일이라 그 밴드를 보는 중엔 남길 정보가 없다).
 *  - ⚠️ **임신 갈래는 그 억제의 예외다** — 기능 라운드 1 리뷰 H-1(두 시점). 임신 스테이지
 *    셋은 전부 "0-6개월" 밴드라 기본 칩이 곧 목적지 밴드이고, 종전 판정(밴드 동일성 억제를
 *    임신 갈래에도 적용)은 이 배너를 **기본 상태에서 구조적으로 절대 세우지 못했다** —
 *    설계 약속("임신 중이면 다음 경계는 출산 예정일")이 실동작에 없던 자리다. 출산 예정일
 *    D-day는 지금 보는 칩과 무관한 달력 사실이라 배너는 서되, 이미 그 밴드를 보는 중이면
 *    "미리 볼까요" 버튼만 접는다(`previewActionLabel: null` — 이미 선택된 칩을 다시 고르는
 *    버튼은 거짓 어포던스다).
 *  - **100% 축하 배너가 서 있으면 숨김** — 한 자리에 배너는 하나다(임신 갈래 포함: 행선지가
 *    달라도 같은 슬롯에 배너 둘이 서면 소음이다).
 *  - 전환 당일(D-0)과 지난 날 → 숨김: 그날부터는 기본 칩이 이미 새 시기를 말한다.
 *
 * ## 문구 원칙
 *
 *  - **정보 제공만** — 시기 전환을 재촉하거나 구매를 권하지 않는다
 *    (prep-milestones 머리말의 규율을 그대로 문다: "구매를 재촉하지 않는다").
 *  - 제목은 milestone-countdown의 카운트다운 관례를 문다(리뷰 M-2 두 시점): 보이는 제목은
 *    명사구 "…까지 D-N"(종전 "D-N일 뒤에 시작돼요"는 D-N과 "일 뒤"가 같은 사실을 겹쳐
 *    적는 이중 표기였다), 낭독은 `spokenTitle`이 D-를 소리로 푼다("…까지 N일 남았어요" —
 *    해요체 DNC-018). 버튼은 행동만 말한다.
 *  - 수와 조사는 값에서 파생한다: D-N의 N은 판정이 낸 일수이고, 밴드 라벨 뒤의 을/를은
 *    `objectParticle`(src/text/korean-particles.ts)이 받침에서 고른다("6-12개월**을**" ·
 *    "24개월+**를**"). 임신 갈래 버튼의 "준비물을"은 고정 명사 꼬리라 분기가 없다
 *    (korean-particle-guard의 ⓐ 형식).
 *  - 발달·의료 정보 0글자(DNC-020) — "시기"는 카탈로그의 밴드 라벨일 뿐이다.
 */

/** 예고 창(일). 이 안으로 다가와야 배너가 선다 — 설계 §트랙 F의 "14일 이내". */
const PREVIEW_WINDOW_DAYS = 14;

export type NextStagePreviewInput = {
  /** Child.stageMode — "pregnant"·"born"만 판정 대상이다(그 밖은 전부 숨김). */
  stageMode: unknown;
  /** Child.dueDate ("YYYY-MM-DD") — 임신 갈래의 유일한 경계 입력. */
  dueDate?: unknown;
  /** Child.birthDate ("YYYY-MM-DD") — 출생 갈래의 유일한 경계 입력. */
  birthDate?: unknown;
  /** 서울 기준 오늘("YYYY-MM-DD") — 화면이 주입한다(모듈은 시계를 읽지 않는다). */
  todayIso: string;
  /** 지금 화면에 선택돼 있는 시기 밴드 칩. */
  selectedBand: StageBandLabel;
  /** 100% 축하 배너가 서 있는가 — 서 있으면 이 배너는 양보한다. */
  celebrationVisible: boolean;
};

export type NextStagePreview = {
  /** 다가오는 시기 밴드 — 버튼을 탭하면 이 칩을 선택한다(기존 칩 선택, 새 화면 없음). */
  band: StageBandLabel;
  /** 시작까지 남은 날(1~14). */
  daysUntil: number;
  /** 그 밴드가 시작되는 날("YYYY-MM-DD"). */
  startDateIso: string;
  /** 배너 제목 — "6-12개월 시기 시작까지 D-13" / "출산 예정일까지 D-11" (카운트다운 명사구). */
  title: string;
  /**
   * 제목의 낭독 형 — "D-"를 소리로 풀어 읽는다("… 13일 남았어요", milestone-countdown의
   * spokenTitle 관례). 화면은 이것을 제목 Text의 accessibilityLabel로 건다(리뷰 M-2 —
   * 종전에는 제목이 "D-6일"을 원문 그대로 낭독하고 버튼 라벨이 같은 문장을 반복했다).
   */
  spokenTitle: string;
  /**
   * 미리보기 버튼 라벨 — "6-12개월을 미리 볼까요?" (조사는 값에서 갈린다). **null이면 버튼이
   * 서지 않는다**: 임신 갈래에서 이미 목적지 밴드(0-6개월)를 보는 중 — D-day 제목만 남는다
   * (리뷰 H-1의 판정, 머리말 숨김 규칙 참고).
   */
  previewActionLabel: string | null;
};

/**
 * 그날의 밴드 — 도메인 스테이지 판정을 지나 밴드 하나로 접는다. 판정이 서지 않으면 null
 * (형식 오류·모르는 스테이지 — 지어내지 않는다).
 */
function bandOnDate(
  input: { stageMode: "pregnant"; dueDate: string } | { stageMode: "born"; birthDate: string },
  dateIso: string
): StageBandLabel | null {
  try {
    const calculated =
      input.stageMode === "pregnant"
        ? calculateChildStage({ stageMode: "pregnant", dueDate: input.dueDate, today: dateIso })
        : calculateChildStage({ stageMode: "born", birthDate: input.birthDate, today: dateIso });
    if (!isChildStageCode(calculated.stageCode)) return null;
    return bandForStage(calculated.stageCode, "ageMonths" in calculated ? calculated.ageMonths : null);
  } catch {
    return null;
  }
}

/**
 * 창 안(내일~14일 뒤)에 다가온 다음 밴드 경계. 없으면 null.
 *
 * 출생 갈래는 하루씩 도메인 판정에 물어 **밴드가 처음 달라지는 날**을 찾는다 — 마지막
 * 밴드에서는 달라지는 날이 없어 자연히 null이고, 같은 밴드 안의 스테이지 전환도 세지 않는다.
 * 임신 갈래의 경계는 출산 예정일 하나이고, 그날의 밴드는 출생 당일의 도메인 판정이 정한다.
 */
function upcomingBandBoundary(input: {
  stageMode: unknown;
  dueDate?: unknown;
  birthDate?: unknown;
  todayIso: string;
}): { kind: "birth" | "band"; band: StageBandLabel; daysUntil: number; startDateIso: string } | null {
  if (!isDateOnly(input.todayIso)) return null;

  if (input.stageMode === "pregnant") {
    if (!isDateOnly(input.dueDate)) return null;
    const daysUntil = daysBetween(input.todayIso, input.dueDate);
    if (daysUntil === null || daysUntil < 1 || daysUntil > PREVIEW_WINDOW_DAYS) return null;
    // 출생 직후의 밴드 — 하드코딩하지 않고 출생 당일의 판정(생년월일 = 예정일)에 묻는다.
    const band = bandOnDate({ stageMode: "born", birthDate: input.dueDate }, input.dueDate);
    if (band === null) return null;
    // kind "birth": 경계가 출산 예정일 그 자체다 — 밴드 동일성 억제의 예외 갈래(머리말 H-1).
    return { kind: "birth", band, daysUntil, startDateIso: input.dueDate };
  }

  if (input.stageMode === "born") {
    if (!isDateOnly(input.birthDate)) return null;
    const todayBand = bandOnDate({ stageMode: "born", birthDate: input.birthDate }, input.todayIso);
    if (todayBand === null) return null;
    for (let day = 1; day <= PREVIEW_WINDOW_DAYS; day += 1) {
      const dateIso = addDays(input.todayIso, day);
      if (dateIso === null) return null;
      const band = bandOnDate({ stageMode: "born", birthDate: input.birthDate }, dateIso);
      if (band !== null && band !== todayBand) {
        return { kind: "band", band, daysUntil: day, startDateIso: dateIso };
      }
    }
    return null;
  }

  // 수동 단계(사용자가 직접 고른 시기)와 모르는 값 — 달력 경계를 지어낼 근거가 없다.
  return null;
}

/** 다음 시기 D-day 예고 배너를 만든다. 세울 이유가 없으면 null. */
export function buildNextStagePreview(input: NextStagePreviewInput): NextStagePreview | null {
  // 한 자리에 배너는 하나다 — 축하 배너가 양보받는 쪽이다(임신 갈래 포함, 머리말 숨김 규칙).
  if (input.celebrationVisible) return null;

  const boundary = upcomingBandBoundary(input);
  if (boundary === null) return null;

  if (boundary.kind === "birth") {
    // 리뷰 H-1(두 시점): 종전에는 여기도 아래 밴드 동일성 억제를 지나서, 임신 기본 칩(0-6개월)
    // = 목적지 밴드라 기본 상태에서 배너가 절대 서지 않았다. 출산 예정일 D-day는 보는 칩과
    // 무관한 달력 사실이라 배너는 서고, 이미 그 밴드를 보는 중이면 버튼만 접는다(타입 주석).
    return {
      band: boundary.band,
      daysUntil: boundary.daysUntil,
      startDateIso: boundary.startDateIso,
      title: `출산 예정일까지 D-${boundary.daysUntil}`,
      spokenTitle: `출산 예정일까지 ${boundary.daysUntil}일 남았어요`,
      previewActionLabel:
        boundary.band === input.selectedBand ? null : `${boundary.band} 준비물을 미리 볼까요?`
    };
  }

  // 출생 갈래: 이미 다음 밴드를 보고 있는 중 — 권할 일이 이미 일어났고, 밴드 라벨 전환은
  // 그 자체가 사건이 아니라 남길 정보도 없다(임신 갈래와 갈리는 근거 — 머리말 숨김 규칙).
  if (boundary.band === input.selectedBand) return null;

  return {
    band: boundary.band,
    daysUntil: boundary.daysUntil,
    startDateIso: boundary.startDateIso,
    // 리뷰 M-2(두 시점): 종전 "…시기가 D-N일 뒤에 시작돼요"는 D-N과 "일 뒤"의 이중 표기.
    // milestone-countdown의 카운트다운 제목 관례("100일까지 D-13")를 그대로 문다.
    title: `${boundary.band} 시기 시작까지 D-${boundary.daysUntil}`,
    spokenTitle: `${boundary.band} 시기 시작까지 ${boundary.daysUntil}일 남았어요`,
    previewActionLabel: `${boundary.band}${objectParticle(boundary.band)} 미리 볼까요?`
  };
}
