import type { ChildStageCode } from "@wooriai/domain";

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
