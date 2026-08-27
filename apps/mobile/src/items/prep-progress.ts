import { shouldShowInNeededNow, type ChildStageCode, type ItemStatus, type NecessityLevel } from "@wooriai/domain";
import { itemMatchesBand, type StageBandLabel } from "./stage-bands";

/**
 * ITEM-114: 시기(스테이지 밴드)별 "필수 준비물 준비율" 계산.
 *
 * 상태 의미 근거 -- 어떤 상태를 "해결됨"으로 집계하는가:
 * 도메인 규칙(packages/domain/src/recommendation.ts)의 EXCLUDED_NOW_NEEDED_STATUSES가
 * prepared / gifted / not_needed 세 상태를 "지금 필요" 추천에서 제외한다. 즉 도메인상 이
 * 세 상태는 "사용자가 더 이상 준비 행동을 할 필요가 없는" 상태이므로 준비율의 분자
 * (해결됨)로 집계한다. 여기서는 같은 규칙을 shouldShowInNeededNow()를 반전해 재사용한다
 * (별도 상태 목록을 복제하면 도메인 enum 변경 시 어긋날 수 있다).
 * not_prepared / interested는 아직 행동이 남은 미해결 상태다(관심 표시는 준비가 아니다).
 *
 * ITEM-123 (B4) 해소: 예전에는 items 목록 API의 4개 탭(now/soon/prepared/not_needed)이
 * gifted 항목을 어느 탭에도 반환하지 않아, 탭 응답 합집합으로 계산하면 gifted 필수템이
 * 분자·분모에서 함께 빠졌다. 이제 서버가 gifted를 prepared 탭에 담고(TAB_STATUSES), 화면은
 * 상태로 거르지 않는 tab="all" 스냅샷 하나로 준비율을 계산한다(B5). 여기 계산은 처음부터
 * gifted를 해결됨으로 취급했으므로 이 파일의 규칙은 그대로 둬도 정합이 맞는다 —
 * 그 약속이 실제로 성립하는지는 prep-progress.test.ts의 gifted 케이스가 고정한다.
 */
export type PrepProgressItem = {
  id: string;
  necessityLevel: NecessityLevel;
  status: ItemStatus;
  stageCodes?: ChildStageCode[];
  timingLabel?: string;
};

export type EssentialPrepProgress = {
  /** 선택된 시기 밴드의 필수(essential) 준비물 총 개수. */
  totalCount: number;
  /** 그중 해결됨(prepared/gifted/not_needed)으로 처리된 개수. */
  resolvedCount: number;
  /** 0-100 정수. 진행 바 폭과 접근성 라벨에 함께 쓴다. */
  percent: number;
  /** 화면·accessibilityLabel 공용 요약 문구 -- 색이 아니라 텍스트로 동일 정보를 전달한다. */
  summaryText: string;
};

/** 도메인 규칙 기준 "해결됨"(더 이상 준비 행동이 필요 없는) 상태인지. */
export function isResolvedItemStatus(status: ItemStatus): boolean {
  return !shouldShowInNeededNow(status);
}

/**
 * 여러 탭 응답의 합집합(items)에서 선택된 시기 밴드의 필수템 준비율을 계산한다.
 *
 * - 탭 응답들은 상태 기준으로 서로소지만, 같은 항목이 중복 전달돼도 안전하도록 id로
 *   중복을 제거한다(같은 id가 여러 번 오면 첫 항목이 이긴다).
 * - 필수(essential) 항목이 0개인 밴드에서는 null을 반환한다 -- 섹션 자체를 숨긴다.
 *   ("0개 중 0개 준비됨"은 정보가 없고 0% 바는 오히려 불안만 준다.)
 */
export function computeEssentialPrepProgress(
  items: PrepProgressItem[],
  stageLabel: StageBandLabel
): EssentialPrepProgress | null {
  const seenIds = new Set<string>();
  const essentials = items.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return item.necessityLevel === "essential" && itemMatchesBand(item, stageLabel);
  });

  const totalCount = essentials.length;
  if (totalCount === 0) return null;

  const resolvedCount = essentials.filter((item) => isResolvedItemStatus(item.status)).length;
  const percent = Math.round((resolvedCount / totalCount) * 100);

  return {
    totalCount,
    resolvedCount,
    percent,
    summaryText: `이번 시기 필수 준비물 ${totalCount}개 중 ${resolvedCount}개 준비됨`
  };
}
