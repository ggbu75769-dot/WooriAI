import { calculateChildStage, type ChildStageCode } from "@wooriai/domain";
import { STAGE_BAND_LABELS, STAGE_BAND_STAGES, type StageBandLabel } from "../items-commerce/stage-bands";

/**
 * 라운드 76 트랙 E — **"준비 시기"(`timingLabel`)와 `stageCodes`가 같은 나이를 말하는지 판정한다.**
 *
 * 이 판정은 라운드 74 트랙 B가 만들었지만 `apps/api/test/seed-data.test.ts` **안에서만** 살아서
 * 시드만 물었다. 어드민 CMS가 넣는 값(자유 입력)은 어떤 대조도 지나지 않았고, 그래서 운영자가
 * `push_walker`의 준비 시기를 `"12~24개월"`로 고치면 `6-12개월` 칩에서 그 준비템을 연 부모가
 * 목록과 상세에서 **서로 다른 나이**를 듣는 자리가 그대로 남아 있었다. 그 판정을 여기로 꺼내서
 * 저장 경로(`items-catalog.service.ts`)와 검토(초안) 경로(`admin/content-revisions.service.ts`)가
 * 함께 지나게 한다. `seed-data.test.ts`는 지역 사본을 지우고 이 모듈을 import한다 — 단언은 그대로다.
 *
 * ⚠️ **개월 수를 이 파일에 손으로 적지 않는다.** 스테이지의 개월 경계는 `packages/domain`의
 * `calculateChildStage`를 **나이로 훑어** 파생시키고(`stageNotationRanges`), 밴드의 개월 경계는
 * 밴드 라벨 네 문자열 자신에서 파싱한다(`parseBandLabelMonths`). 도메인이 경계를 옮기면 이
 * 판정이 따라 옮긴다.
 *
 * ⚠️ **CMS의 자유도를 줄이는 것이 목적이 아니다.** 파싱되지 않는 라벨(`"출산 전후"`·`"돌 무렵"`
 * 같은 서술 표기, 임신·세(歲) 표기)과 빈 라벨은 **판정 대상이 아니라 그대로 통과한다**. 막는 것은
 * 라벨이 스스로 개월을 말하면서 그 개월이 `stageCodes`와 **명백히 어긋나는** 경우뿐이다.
 */

const PROBE_TODAY = "2100-01-15";
/** 훑는 상한(개월). 스테이지 경계값이 아니라 탐침 범위다 — 마지막 스테이지는 열린 구간으로 본다. */
const PROBE_MAX_AGE_MONTHS = 600;

export type MonthRange = { from: number; to: number };

function probeBirthDate(ageMonths: number): string {
  const [year, month, day] = PROBE_TODAY.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) - ageMonths;
  const probeYear = Math.floor(totalMonths / 12);
  const probeMonth = (totalMonths % 12) + 1;
  return [
    String(probeYear).padStart(4, "0"),
    String(probeMonth).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function stageForAgeMonths(ageMonths: number): ChildStageCode {
  return calculateChildStage({ stageMode: "born", birthDate: probeBirthDate(ageMonths), today: PROBE_TODAY })
    .stageCode;
}

/**
 * 출생 이후 스테이지의 **표기 구간**(개월). 카탈로그와 밴드 라벨이 쓰는 표기 관례를 그대로 따른다:
 * 구간의 시작 숫자는 "그 달이 되는 시점"이라 앞 스테이지의 마지막 개월과 같다
 * (밴드 `"6-12개월"`이 완료 개월 7~12인 `infant_7_12` 하나인 것이 그 관례의 증거다).
 * 그래서 시작값은 완료 개월 최소값 - 1이고, 마지막 스테이지의 끝은 열려 있다.
 *
 * 훑기는 601회의 순수 계산이라 요청마다 다시 돌 이유가 없다(저장 경로가 부른다) — 첫 호출에서
 * 한 번 파생시키고 그 결과를 돌려준다. 결과 Map은 호출자가 상하게 하지 않도록 사본으로 준다.
 */
let notationCache: Map<ChildStageCode, MonthRange> | null = null;

export function stageNotationRanges(): Map<ChildStageCode, MonthRange> {
  if (notationCache) {
    return new Map([...notationCache].map(([stage, range]) => [stage, { ...range }]));
  }

  const completed = new Map<ChildStageCode, MonthRange>();
  for (let ageMonths = 0; ageMonths <= PROBE_MAX_AGE_MONTHS; ageMonths += 1) {
    const stage = stageForAgeMonths(ageMonths);
    const seen = completed.get(stage);
    completed.set(stage, { from: seen?.from ?? ageMonths, to: ageMonths });
  }

  const openEndedStage = stageForAgeMonths(PROBE_MAX_AGE_MONTHS);
  const notation = new Map<ChildStageCode, MonthRange>();
  for (const [stage, range] of completed) {
    notation.set(stage, {
      from: range.from === 0 ? 0 : range.from - 1,
      to: stage === openEndedStage ? Number.POSITIVE_INFINITY : range.to
    });
  }
  notationCache = notation;
  return new Map([...notation].map(([stage, range]) => [stage, { ...range }]));
}

/** `timingLabel`이 개월 구간을 말하면 그 구간을. 임신·연령(세)·서술 표기는 null(판정 대상 아님). */
export function parseTimingLabelMonths(label: string): MonthRange | null {
  const span = /^(\d+)~(\d+)개월(?: 전후)?$/.exec(label);
  if (span) return { from: Number(span[1]), to: Number(span[2]) };
  const openEnded = /^(\d+)개월 이후$/.exec(label);
  if (openEnded) return { from: Number(openEnded[1]), to: Number.POSITIVE_INFINITY };
  return null;
}

/** 두 구간이 한 달이라도 겹치는가(표기 관례상 경계값은 앞뒤 구간이 함께 갖는다). */
export function overlaps(a: MonthRange, b: MonthRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * 구간들의 **합집합**(맞물리는 것끼리 이어 붙인다).
 *
 * 라운드 74 리뷰(제안 채택): 종전 검사는 `min(from)`·`max(to)` 하나로 뭉쳐서, 불연속한
 * `stageCodes` 조합(예: 신생아 + 네 살)의 **사이 빈 구간까지** 덮은 것으로 셌다.
 */
export function mergeRanges(ranges: MonthRange[]): MonthRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: MonthRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

/**
 * 밴드 라벨 네 문자열이 스스로 말하는 개월 구간(`"24개월+"`는 열린 구간).
 *
 * 테스트 안에 있을 때는 파싱 실패를 `expect(...).not.toBeNull()`로 물었다. 모듈로 나온 뒤에도
 * 조용히 NaN 구간을 만들지 않도록 같은 자리에서 던진다 — 네 문자열은 `packages/contracts`가
 * 잠근 상수라 실제로 여기 닿을 일은 없고, 닿았다면 판정이 헐거워진 것이 아니라 계약이 깨진 것이다.
 */
export function parseBandLabelMonths(label: string): MonthRange {
  const span = /^(\d+)-(\d+)개월$/.exec(label);
  if (span) return { from: Number(span[1]), to: Number(span[2]) };
  const openEnded = /^(\d+)개월\+$/.exec(label);
  if (!openEnded) {
    throw new Error(`band label ${label} must state a month range`);
  }
  return { from: Number(openEnded[1]), to: Number.POSITIVE_INFINITY };
}

/** 어긋남의 종류. 저장·검토 경로는 종류가 아니라 `message`를 그대로 운영자에게 돌려준다. */
export type TimingLabelMismatchReason =
  /** 라벨이 개월을 말하는데 품목이 출생 이후 스테이지를 하나도 지지 않는다. */
  | "no_born_stage"
  /** 라벨 구간이 `stageCodes`가 덮는 구간(합집합의 한 조각) 밖에 있다. */
  | "outside_stage_months"
  /** 품목이 지는 스테이지 하나가 라벨과 한 달도 겹치지 않는다(뒤 방향 · 대칭 겹침). */
  | "stage_not_overlapped"
  /** 라벨이 칩 이름을 그대로 말하는데 품목이 **그 칩과 겹치지 않는** 더 이른 칩에도 선다. */
  | "earlier_band_than_label";

export type TimingLabelMismatch = {
  reason: TimingLabelMismatchReason;
  /** 어긋난 구간을 그대로 말하는 한국어 문장. 운영자가 고칠 수 있는 실패라 재시도를 권하지 않는다. */
  message: string;
};

/** 구간을 카탈로그 표기 그대로 읽는다(열린 구간은 `"N개월 이후"`). */
export function formatMonthRange(range: MonthRange): string {
  return Number.isFinite(range.to) ? `${range.from}~${range.to}개월` : `${range.from}개월 이후`;
}

function formatSegments(segments: MonthRange[]): string {
  return segments.map(formatMonthRange).join(", ");
}

/**
 * 라운드 74 B · 74 리뷰 B-2가 세운 판정 셋을 그대로 적용한다.
 *
 * ① 라벨 구간이 `stageCodes` 합집합의 **한 조각 안에** 있을 것,
 * ② 품목이 지는 스테이지 **하나하나가** 라벨과 겹칠 것(대칭),
 * ③ 라벨이 밴드 칩 이름을 그대로 말하면 **그 칩과 겹치지 않는 더 이른 칩에 서 있지 않을** 것
 *    — 이름을 말한 칩에 **함께 서 있는** 스테이지(밴드 표의 의도된 중복)는 이른 칩의 증거가
 *    아니다(라운드 76 적대적 리뷰 M-2).
 *
 * 어긋나면 첫 어긋남 하나를, 아니면 `null`을 돌려준다. **모르면 지어내지 않는다** — 빈 라벨과
 * 파싱되지 않는 라벨(서술·임신·세 표기)은 판정 대상이 아니라 언제나 `null`이다.
 */
export function judgeTimingLabelAgainstStages(
  timingLabel: string | null | undefined,
  stageCodes: readonly string[]
): TimingLabelMismatch | null {
  const label = timingLabel?.trim();
  if (!label) return null;

  const labelRange = parseTimingLabelMonths(label);
  if (!labelRange) return null;

  const notation = stageNotationRanges();
  const bornStages = stageCodes.filter((code): code is ChildStageCode => notation.has(code as ChildStageCode));

  if (bornStages.length === 0) {
    return {
      reason: "no_born_stage",
      message:
        `준비 시기 "${label}"은 ${formatMonthRange(labelRange)}를 말하는데, 이 준비템이 선택한 시기에는 ` +
        `출생 이후 시기가 하나도 없어요. 준비 시기 표기나 시기 선택 중 하나를 바꿔 주세요.`
    };
  }

  // ① 라벨은 스테이지들이 실제로 덮는 구간의 **한 조각** 안에 들어와야 한다. 불연속한 조합
  // (예: 신생아 + 네 살)의 사이 빈 구간은 덮은 것이 아니다.
  const covered = mergeRanges(bornStages.map((stage) => notation.get(stage) as MonthRange));
  const withinSegment = covered.some((segment) =>
    Number.isFinite(labelRange.to)
      ? labelRange.from >= segment.from && labelRange.to <= segment.to
      : labelRange.from >= segment.from && labelRange.from < segment.to
  );
  if (!withinSegment) {
    return {
      reason: "outside_stage_months",
      message:
        `준비 시기 "${label}"은 ${formatMonthRange(labelRange)}를 말하는데, 선택한 시기가 덮는 구간은 ` +
        `${formatSegments(covered)}예요. 준비 시기 표기나 시기 선택 중 하나를 바꿔 주세요.`
    };
  }

  // ② 반대 방향: 품목이 지는 스테이지 하나하나가 라벨과 겹쳐야 한다. 그러지 않으면 그 시기의
  // 목록에 서면서 상세는 다른 나이를 말하게 된다(라운드 74 리뷰 B-2가 잡은 그 모양).
  for (const stage of bornStages) {
    const stageRange = notation.get(stage) as MonthRange;
    if (overlaps(labelRange, stageRange)) continue;
    return {
      reason: "stage_not_overlapped",
      message:
        `준비 시기 "${label}"(${formatMonthRange(labelRange)})이 선택한 시기 ${stage}` +
        `(${formatMonthRange(stageRange)})와 한 달도 겹치지 않아요. 그 시기의 목록에 서면서 상세는 ` +
        `다른 나이를 말하게 돼요. 준비 시기 표기나 시기 선택 중 하나를 바꿔 주세요.`
    };
  }

  // ③ 사용자는 상세의 "준비 시기: 12~24개월"을 칩 이름으로 읽는다(물결표/하이픈 차이는 눈에
  // 띄지 않는다). 라벨이 어떤 칩의 개월 구간과 정확히 같은데 품목이 그보다 이른 칩에도 서 있으면,
  // 그 이른 칩에서 연 사용자는 목록과 상세에서 다른 나이를 듣는다.
  //
  // ⚠️ **겹치는 칩은 이른 칩이 아니다**(라운드 76 적대적 리뷰 M-2). 밴드 집합은 서로소가 아니고
  // (`items-commerce/stage-bands.ts`: `toddler_1_3`이 `"12-24개월"`과 `"24개월+"` 양쪽에 서는 것은
  // **의도된 중복**이다), 그 중복 때문에 종전 규칙은 `"24개월 이후"` 라벨을 **어떤 조합으로도**
  // 통과시키지 못했다: ①을 지나려면 24개월을 덮는 `toddler_1_3`이 있어야 하는데, `toddler_1_3`이
  // 있으면 ③이 `"12-24개월"` 칩을 "더 이른 칩"으로 세어 거절했다. 이름을 말한 칩에 **함께 서 있는**
  // 스테이지는 "더 이른 칩에 선다"는 증거가 아니라 그 중복 자신이므로 세지 않는다. 이른 칩에만
  // 있는 스테이지(예: `"6~12개월"` 라벨 × `infant_4_6`)는 종전 그대로 걸린다.
  const bandOrder = [...STAGE_BAND_LABELS];
  const bandMonths = bandOrder.map((band) => parseBandLabelMonths(band));
  const namedBandIndex = bandMonths.findIndex(
    (range) => range.from === labelRange.from && range.to === labelRange.to
  );
  if (namedBandIndex >= 0) {
    const stagesInNamedBand = STAGE_BAND_STAGES[bandOrder[namedBandIndex] as StageBandLabel];
    for (const earlierBand of bandOrder.slice(0, namedBandIndex)) {
      const stagesInEarlierBand = STAGE_BAND_STAGES[earlierBand as StageBandLabel];
      const standsEarlier = stageCodes.some(
        (code) =>
          stagesInEarlierBand.includes(code as ChildStageCode) &&
          !stagesInNamedBand.includes(code as ChildStageCode)
      );
      if (!standsEarlier) continue;
      return {
        reason: "earlier_band_than_label",
        message:
          `준비 시기 "${label}"은 ${bandOrder[namedBandIndex]} 칩의 이름인데, 이 준비템은 더 이른 ` +
          `${earlierBand} 칩에도 서요. 그 칩에서 연 사용자는 목록과 상세에서 다른 나이를 듣게 돼요. ` +
          `준비 시기 표기나 시기 선택 중 하나를 바꿔 주세요.`
      };
    }
  }

  return null;
}

/** 저장·검토 경로가 함께 쓰는 거절 코드. 어드민이 이 코드로 사유를 가려낼 수 있어야 한다. */
export const ITEM_TIMING_LABEL_MISMATCH_CODE = "ITEM_TIMING_LABEL_MISMATCH";
