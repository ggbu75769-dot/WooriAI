import { isChildStageCode, type ChildStageCode } from "@wooriai/domain";

export type StageBandLabel = "0-6개월" | "6-12개월" | "12-24개월" | "24개월+";

export type StageBandDefinition = {
  label: StageBandLabel;
  stages: ChildStageCode[];
};

export const bandDefinitions: StageBandDefinition[] = [
  { label: "0-6개월", stages: ["pregnancy_early", "pregnancy_mid", "pregnancy_late", "newborn_0_3", "infant_4_6"] },
  { label: "6-12개월", stages: ["infant_7_12"] },
  { label: "12-24개월", stages: ["toddler_1_3"] },
  { label: "24개월+", stages: ["toddler_1_3", "kid_4_7", "elementary", "middle_school"] }
];

const stageToBandLabel: Record<ChildStageCode, StageBandLabel> = {
  pregnancy_early: "0-6개월",
  pregnancy_mid: "0-6개월",
  pregnancy_late: "0-6개월",
  newborn_0_3: "0-6개월",
  infant_4_6: "0-6개월",
  infant_7_12: "6-12개월",
  toddler_1_3: "12-24개월",
  kid_4_7: "24개월+",
  elementary: "24개월+",
  middle_school: "24개월+"
};

export function bandForStage(stage: ChildStageCode): StageBandLabel {
  return stageToBandLabel[stage];
}

export function bandStages(label: StageBandLabel): ChildStageCode[] {
  return bandDefinitions.find((band) => band.label === label)?.stages ?? [];
}

export function itemMatchesBand(
  item: { stageCodes?: ChildStageCode[]; timingLabel?: string },
  label: StageBandLabel
): boolean {
  if (item.stageCodes && item.stageCodes.length > 0) {
    const stages = bandStages(label);
    return item.stageCodes.some((code) => stages.includes(code));
  }
  return !item.timingLabel || item.timingLabel === label;
}

export type ResolveDefaultStageLabelInput = {
  /** The child's current stage code, typically sourced from a home-summary API response. */
  currentStage: unknown;
  /** True while a pixel-lock capture run is in progress -- must render deterministically. */
  isPixelLockMode: boolean;
  /** True once the user has tapped a chip -- their choice must not be overridden. */
  hasManualSelection: boolean;
  /** Returned whenever the child's stage can't (or shouldn't) be resolved. */
  fallback: StageBandLabel;
};

/**
 * Resolves which stage-band chip should be selected by default. Prefers the band matching the
 * child's actual current stage, but always defers to `fallback` during pixel-lock capture or
 * once the user has made a manual chip selection.
 *
 * 라운드 51 #3 — `isTestSession` 폴백을 **제거했다**.
 *
 * 왜 있었나: 데모(로그인 없는 테스트) 세션에는 자동으로 만들어지는 픽스처 아이가 있었고
 * (생후 24개월 "다온이"), 그 아이가 항상 걸음마기라 기본 칩이 늘 "12-24개월"이었다. 폴백은
 * 그 사실을 굳혀 데모 렌더를 결정적으로 만드는 장치였다.
 *
 * 왜 지웠나: 그 픽스처가 사라졌다. 실기기 피드백 이후 `ensureSeeded`(src/api/local-backend.ts)는
 * **사용자 데이터를 하나도 만들지 않고**, 데모도 실계정 신규 가입과 똑같이 온보딩에서 아이를
 * 직접 입력한다. 즉 데모 아이의 시기는 사용자가 넣은 출산예정일/생년월일이 정하는 값이지
 * 고정값이 아니다. 그런데도 폴백이 남아 있어서, 임신 중인 아이를 만든 데모 사용자에게 기본
 * 칩이 "12-24개월"로 뜨고 -- 그 칩에는 임신 시기가 없으므로(bandDefinitions) -- "출산 전"
 * 칩(src/items/pre-birth-filter.ts의 shouldOfferPreBirthFilter)이 **구조적으로 절대 뜨지 않았다**.
 * 근거가 사라진 결정성 장치가 실제 기능 하나를 데모에서 통째로 가리고 있었던 셈이다.
 *
 * `isPixelLockMode` 폴백은 그대로다: ITEM-001 캡처는 세션 자체가 없어 아이도 없고, 그 렌더는
 * 한 픽셀도 흔들리면 안 된다.
 */
export function resolveDefaultStageLabel(input: ResolveDefaultStageLabelInput): StageBandLabel {
  if (input.isPixelLockMode || input.hasManualSelection) {
    return input.fallback;
  }
  if (!isChildStageCode(input.currentStage)) {
    return input.fallback;
  }
  return bandForStage(input.currentStage);
}
