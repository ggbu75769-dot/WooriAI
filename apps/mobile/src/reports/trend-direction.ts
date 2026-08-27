import { formatKrw } from "../money";
import type { MonthlyInsightMonthStatus } from "./monthly-insight";

/**
 * UX-F: 6개월 추이 차트의 **전월 대비 방향 표시** — 순수 조립 모듈.
 *
 * 차트는 달마다 막대(점) 하나씩 6개를 그리지만, 마지막 두 달이 오르내렸는지는 눈대중으로 읽어야
 * 했다. 여기서는 **이미 화면에 있는 값**(`getTrendReport`의 월별 totalExpenseKrw 배열, 마지막
 * 원소가 선택한 달)의 마지막 두 개만 비교해 화살표·퍼센트를 만든다. 새 요청도, 새 집계도 없다.
 *
 * ## 비교 의미를 문구로 못 박는다 (허위 표시 금지)
 * 선택한 달이 **진행 중**이면 마지막 막대는 아직 자라는 중이라, 지난달 **전체**와의 비교는
 * "지금까지 vs 한 달 전체"다. 그 사실을 캡션에 그대로 적고("지난달 전체 대비 지금까지"),
 * 그 경우에는 감소에도 긍정 톤을 주지 않는다 — 달이 끝나기 전의 감소는 아직 결과가 아니다.
 * 끝난 달을 보고 있을 때만 월 전체 대 월 전체 비교이고, 캡션도 "지난달 대비"가 된다.
 *
 * ## 색·톤 규칙 (DNC-017/018)
 * 톤 값만 돌려주고 색은 화면이 기존 토큰에서 고른다. **증가는 중립**이다 — 아이에게 쓴 돈이
 * 늘었다는 사실에 빨간 경고를 찍어 죄책감을 주지 않는다. 감소만 긍정 톤을 받는다.
 *
 * ## 퍼센트 규칙 (홈 비교 문구와 동일한 보수적 규칙)
 * - 내림(floor): 12.9%는 12%로 말한다 — 표시값이 실제 변화보다 커지지 않는다.
 * - 분모(지난달)가 0이거나 내림 결과가 1% 미만이면 퍼센트 대신 금액을 말한다("0% 늘었어요" 금지).
 */

export type TrendDirectionKind = "up" | "down" | "same";

/** 화면이 색 토큰으로 옮기는 톤. 증가·보합·진행 중 비교는 중립. */
export type TrendDirectionTone = "neutral" | "positive";

export type TrendDirection = {
  kind: TrendDirectionKind;
  tone: TrendDirectionTone;
  /** 비교 대상 두 달의 차이(절대값). */
  differenceKrw: number;
  /** 내림한 변화율(%). 분모가 0이거나 1% 미만이면 null. */
  percent: number | null;
  /** 방향 글리프. */
  arrow: "▲" | "▼" | "―";
  /** 화살표 옆 값 텍스트("12%" 또는 "48,000원", 보합은 "변화 없음"). */
  valueText: string;
  /** 값 앞 캡션 — 무엇과 무엇을 비교했는지 그대로 적는다. */
  captionText: string;
  /** 행 전체를 한 요소로 읽어 주는 TalkBack 라벨. */
  accessibilityLabel: string;
};

export type TrendDirectionInput = {
  /** 오름차순 월별 합계. 마지막 원소가 선택한 달. 2개 미만이면 방향을 말할 수 없다. */
  points: readonly number[] | null | undefined;
  /** 선택한 달의 상태(monthly-insight의 resolveMonthStatus 결과). */
  monthStatus: MonthlyInsightMonthStatus | null;
};

/** 캡션은 비교의 의미를 숨기지 않는다. */
export const TREND_CAPTION_COMPLETE = "지난달 대비";
export const TREND_CAPTION_IN_PROGRESS = "지난달 전체 대비 지금까지";

function isUsableAmount(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * 추이 차트 아래 한 줄을 만든다. 말할 근거가 없으면 null(행 미렌더).
 */
export function evaluateTrendDirection(input: TrendDirectionInput): TrendDirection | null {
  const points = input.points;
  if (!points || points.length < 2) return null;
  if (input.monthStatus !== "in-progress" && input.monthStatus !== "complete") return null;

  const current = points[points.length - 1]!;
  const previous = points[points.length - 2]!;
  if (!isUsableAmount(current) || !isUsableAmount(previous)) return null;
  // 두 달 모두 0원이면 방향이랄 것이 없다.
  if (current === 0 && previous === 0) return null;

  const inProgress = input.monthStatus === "in-progress";
  const captionText = inProgress ? TREND_CAPTION_IN_PROGRESS : TREND_CAPTION_COMPLETE;
  const differenceKrw = Math.abs(current - previous);

  if (differenceKrw === 0) {
    return {
      kind: "same",
      tone: "neutral",
      differenceKrw: 0,
      percent: null,
      arrow: "―",
      valueText: "변화 없음",
      captionText,
      accessibilityLabel: inProgress
        ? "지난달 전체와 지금까지의 지출이 같아요."
        : "지난달과 지출이 같아요."
    };
  }

  const kind: TrendDirectionKind = current > previous ? "up" : "down";
  // 진행 중인 달의 감소는 아직 결과가 아니므로 긍정 톤을 주지 않는다.
  const tone: TrendDirectionTone = kind === "down" && !inProgress ? "positive" : "neutral";

  const flooredPercent = previous > 0 ? Math.floor((differenceKrw * 100) / previous) : 0;
  const percent = previous > 0 && flooredPercent >= 1 ? flooredPercent : null;
  // 퍼센트를 말할 수 없으면(지난달 0원·1% 미만) 같은 사실을 금액으로 말한다.
  const valueText = percent === null ? formatKrw(differenceKrw) : `${percent}%`;
  const changeWord = kind === "up" ? "늘었어요" : "줄었어요";

  return {
    kind,
    tone,
    differenceKrw,
    percent,
    arrow: kind === "up" ? "▲" : "▼",
    valueText,
    captionText,
    accessibilityLabel: inProgress
      ? `지난달 전체 대비 지금까지 ${valueText} ${changeWord}. 이번 달은 아직 진행 중이에요.`
      : `지난달 대비 ${valueText} ${changeWord}.`
  };
}
