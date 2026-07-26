import type { TodayActionContract } from "@wooriai/contracts";

export type TodayActionHref =
  | "/notifications"
  | "/preparation-calendar"
  | "/sync-status"
  | `/items/${string}`
  | `/items/${string}?contextType=child&contextId=${string}`;

const kindCopy: Record<
  TodayActionContract["kind"],
  { label: string; fallbackTitle: string; subtitle: string }
> = {
  safety_acknowledgement: {
    label: "안전 확인",
    fallbackTitle: "안전 안내",
    subtitle: "공식 안전 안내를 확인해 주세요"
  },
  sync_conflict: {
    label: "동기화 충돌",
    fallbackTitle: "기록 동기화",
    subtitle: "다른 기기의 변경 내용을 확인해 주세요"
  },
  overdue_assigned: {
    label: "기한 지남",
    fallbackTitle: "늦어진 준비",
    subtitle: "준비 기한이 지났어요"
  },
  replacement_due: {
    label: "교체 시기",
    fallbackTitle: "교체할 준비템",
    subtitle: "교체할 시기를 확인해 주세요"
  },
  recurring_due: {
    label: "반복 구매",
    fallbackTitle: "다시 살 준비템",
    subtitle: "반복 구매 시기를 확인해 주세요"
  },
  due_this_week: {
    label: "이번 주 준비",
    fallbackTitle: "이번 주 준비",
    subtitle: "이번 주 안에 준비해 주세요"
  },
  planned_cost_unassigned: {
    label: "비용 담당",
    fallbackTitle: "비용 담당 정하기",
    subtitle: "가족과 비용 담당을 정해 주세요"
  },
  recommendation: {
    label: "추천 확인",
    fallbackTitle: "추천 준비템",
    subtitle: "지금 필요한 준비템을 확인해 주세요"
  }
};

function itemName(action: TodayActionContract) {
  const value = action.reasonParams.itemName;
  return typeof value === "string" && value.trim() ? value.trim() : kindCopy[action.kind].fallbackTitle;
}

export function todayActionPresentation(action: TodayActionContract) {
  const copy = kindCopy[action.kind];
  const name = itemName(action);
  const title = `${name} · ${copy.label}`;
  return {
    title,
    subtitle: action.dueDate ? `${copy.subtitle} · ${action.dueDate}` : copy.subtitle,
    managementLabel: `${name} ${copy.label} 알림 관리`
  };
}

export function isTodayActionDismissible(action: TodayActionContract) {
  return action.kind !== "safety_acknowledgement";
}

export function todayActionHref(action: TodayActionContract): TodayActionHref {
  switch (action.navigation.kind) {
    case "calendar":
      return "/preparation-calendar";
    case "notifications":
      return "/notifications";
    case "sync":
      return "/sync-status";
    case "item": {
      const targetItemId = action.navigation.itemId ?? action.sourceId;
      const targetChildId = action.navigation.childId ?? action.childId;
      return targetChildId
        ? `/items/${targetItemId}?contextType=child&contextId=${targetChildId}`
        : `/items/${targetItemId}`;
    }
  }
}
