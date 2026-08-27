import type { ChildStageCode } from "@wooriai/domain";
import { STAGE_BAND_LABELS, type StageBandLabel } from "@wooriai/contracts";

export type { StageBandLabel };
export { STAGE_BAND_LABELS };

/**
 * ITEM-121: 준비템 목록의 시기 칩(밴드) -> 스테이지 코드 매핑 (서버 쪽 정의).
 *
 * 왜 서버에 있어야 하나: 칩을 고르면 서버가 그 밴드 기준으로 목록을 만든다
 * (GET /children/:childId/items?stageBand=...). 예전에는 서버가 "아이의 현재 단계"만
 * 필터하고 클라이언트가 그 위에 밴드 필터를 한 번 더 걸어서, 현재 단계가 속한 칩
 * 하나(들)만 같은 목록을 보여주고 나머지 칩은 전부 빈 화면이 됐다. 이제 밴드를
 * 서버가 이해하므로 예비 부모가 다음 시기 준비물을 미리 볼 수 있다.
 *
 * 클라이언트(apps/mobile/src/items/stage-bands.ts)도 준비율 계산 등에 같은 표를
 * 들고 있다 — 모바일은 별도 RN/Expo TS 프로젝트라 이 패키지를 import 하지 않는다.
 * 두 표가 어긋나면 apps/api/test/mobile-stage-band-contract.test.ts가 깨진다.
 *
 * `toddler_1_3`이 "12-24개월"과 "24개월+" 양쪽에 들어있는 것은 의도된 중복이다
 * (24개월+ 칩에서도 걸음마기 준비물이 이어 보이게 한다). 밴드 집합은 서로소가 아니다.
 */
export const STAGE_BAND_STAGES: Record<StageBandLabel, ChildStageCode[]> = {
  "0-6개월": ["pregnancy_early", "pregnancy_mid", "pregnancy_late", "newborn_0_3", "infant_4_6"],
  "6-12개월": ["infant_7_12"],
  "12-24개월": ["toddler_1_3"],
  "24개월+": ["toddler_1_3", "kid_4_7", "elementary", "middle_school"]
};

export function isStageBandLabel(value: unknown): value is StageBandLabel {
  return typeof value === "string" && (STAGE_BAND_LABELS as readonly string[]).includes(value);
}

/** 밴드에 속한 스테이지 코드들. 알 수 없는 라벨이면 빈 배열(호출자가 필터를 건너뛴다). */
export function stagesForBand(label: StageBandLabel): ChildStageCode[] {
  return STAGE_BAND_STAGES[label] ?? [];
}

/** 준비템의 스테이지 코드 중 하나라도 밴드에 걸치면 그 밴드의 항목으로 본다. */
export function itemStagesMatchBand(stageCodes: ChildStageCode[], label: StageBandLabel): boolean {
  const bandStages = stagesForBand(label);
  return stageCodes.some((code) => bandStages.includes(code));
}
