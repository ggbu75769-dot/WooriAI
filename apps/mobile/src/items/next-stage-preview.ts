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
 *  - 이미 다음 밴드를 보고 있는 중 → 숨김(권할 일이 이미 일어났다).
 *  - **100% 축하 배너가 서 있으면 숨김** — 같은 행선지(다음 시기 칩)를 두 배너가 말하지 않는다.
 *  - 전환 당일(D-0)과 지난 날 → 숨김: 그날부터는 기본 칩이 이미 새 시기를 말한다.
 *
 * ## 문구 원칙
 *
 *  - 해요체(DNC-018) · **정보 제공만** — 시기 전환을 재촉하거나 구매를 권하지 않는다
 *    (prep-milestones 머리말의 규율을 그대로 문다: "구매를 재촉하지 않는다").
 *  - 수와 조사는 값에서 파생한다: D-N의 N은 판정이 낸 일수이고, 밴드 라벨 뒤의 을/를은
 *    `objectParticle`(src/text/korean-particles.ts)이 받침에서 고른다("6-12개월**을**" ·
 *    "24개월+**를**").
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
  /** 다가오는 시기 밴드 — 탭하면 이 칩을 선택한다(기존 칩 선택, 새 화면 없음). */
  band: StageBandLabel;
  /** 시작까지 남은 날(1~14). */
  daysUntil: number;
  /** 그 밴드가 시작되는 날("YYYY-MM-DD"). */
  startDateIso: string;
  /** 배너 제목 — "6-12개월 시기가 D-13일 뒤에 시작돼요". */
  title: string;
  /** 미리보기 버튼 라벨 — "6-12개월을 미리 볼까요?" (조사는 값에서 갈린다). */
  previewActionLabel: string;
  /** TalkBack 문장 — "D-"를 소리로 풀어 읽고, 눌렀을 때 무슨 일이 생기는지까지 말한다. */
  accessibilityLabel: string;
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
}): { band: StageBandLabel; daysUntil: number; startDateIso: string } | null {
  if (!isDateOnly(input.todayIso)) return null;

  if (input.stageMode === "pregnant") {
    if (!isDateOnly(input.dueDate)) return null;
    const daysUntil = daysBetween(input.todayIso, input.dueDate);
    if (daysUntil === null || daysUntil < 1 || daysUntil > PREVIEW_WINDOW_DAYS) return null;
    // 출생 직후의 밴드 — 하드코딩하지 않고 출생 당일의 판정(생년월일 = 예정일)에 묻는다.
    const band = bandOnDate({ stageMode: "born", birthDate: input.dueDate }, input.dueDate);
    if (band === null) return null;
    return { band, daysUntil, startDateIso: input.dueDate };
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
        return { band, daysUntil: day, startDateIso: dateIso };
      }
    }
    return null;
  }

  // 수동 단계(사용자가 직접 고른 시기)와 모르는 값 — 달력 경계를 지어낼 근거가 없다.
  return null;
}

/** 다음 시기 D-day 예고 배너를 만든다. 세울 이유가 없으면 null. */
export function buildNextStagePreview(input: NextStagePreviewInput): NextStagePreview | null {
  // 같은 행선지(다음 시기 칩)를 두 배너가 말하지 않는다 — 축하 배너가 양보받는 쪽이다.
  if (input.celebrationVisible) return null;

  const boundary = upcomingBandBoundary(input);
  if (boundary === null) return null;
  // 이미 다음 밴드를 보고 있는 중 — 권할 일이 이미 일어났다.
  if (boundary.band === input.selectedBand) return null;

  const title = `${boundary.band} 시기가 D-${boundary.daysUntil}일 뒤에 시작돼요`;
  const previewActionLabel = `${boundary.band}${objectParticle(boundary.band)} 미리 볼까요?`;

  return {
    band: boundary.band,
    daysUntil: boundary.daysUntil,
    startDateIso: boundary.startDateIso,
    title,
    previewActionLabel,
    // "D-13"을 소리로 풀어 읽는다(milestone-countdown의 spokenTitle 관례).
    accessibilityLabel: `${boundary.band} 시기가 ${boundary.daysUntil}일 뒤에 시작돼요. ${previewActionLabel}`
  };
}
