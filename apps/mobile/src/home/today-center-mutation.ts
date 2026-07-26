import type {
  TodayActionContract,
  TodayPreferenceContract,
  TodayPreferenceResolutionContract
} from "@wooriai/contracts";
import { ApiClientError, isApiErrorCode } from "../api/client";

export type TodaySnoozeOutcome = {
  kind: "saved" | "saved_refresh_failed" | "changed" | "rejected" | "current_deferred" | "refresh_required";
  message: string;
  canRetryMutation: boolean;
};

type TodaySnoozeOperation = {
  action: TodayActionContract;
  write: () => Promise<TodayPreferenceContract>;
  resolveExact: () => Promise<TodayPreferenceResolutionContract>;
  refetchActions: () => Promise<TodayActionContract[]>;
};

function sameBaseline(left: TodayActionContract, right: TodayActionContract) {
  return left.actionKey === right.actionKey &&
    left.preferenceVersion === right.preferenceVersion &&
    left.preferenceScope.kind === right.preferenceScope.kind &&
    left.preferenceScope.childId === right.preferenceScope.childId;
}

function isIndeterminate(error: unknown) {
  if (error instanceof ApiClientError) return error.status >= 500;
  return !(error && typeof error === "object" && "code" in error && typeof error.code === "string");
}

async function refetchAfterKnownChange(
  refetchActions: TodaySnoozeOperation["refetchActions"],
  message: string
): Promise<TodaySnoozeOutcome> {
  try {
    await refetchActions();
    return { kind: "changed", message, canRetryMutation: false };
  } catch {
    return {
      kind: "refresh_required",
      message: "알림 상태가 달라졌지만 최신 목록을 불러오지 못했어요. 다시 불러와 주세요.",
      canRetryMutation: false
    };
  }
}

export async function executeTodaySnooze({
  action,
  write,
  resolveExact,
  refetchActions
}: TodaySnoozeOperation): Promise<TodaySnoozeOutcome> {
  try {
    await write();
    try {
      await refetchActions();
      return { kind: "saved", message: "내일까지 미뤘어요.", canRetryMutation: false };
    } catch {
      return {
        kind: "saved_refresh_failed",
        message: "저장됐지만 목록을 새로 불러오지 못했어요. 다시 불러와 주세요.",
        canRetryMutation: false
      };
    }
  } catch (error) {
    if (isApiErrorCode(error, "TODAY_PREFERENCE_CONFLICT")) {
      return refetchAfterKnownChange(refetchActions, "알림 상태가 달라져 최신 목록을 불러왔어요.");
    }
    if (!isIndeterminate(error)) {
      return {
        kind: "rejected",
        message: "알림을 미루지 못했어요. 다시 시도해 주세요.",
        canRetryMutation: true
      };
    }
    let resolution: TodayPreferenceResolutionContract;
    try {
      resolution = await resolveExact();
    } catch {
      return {
        kind: "refresh_required",
        message: "저장 여부를 확인하지 못했어요. 먼저 최신 상태를 불러와 주세요.",
        canRetryMutation: false
      };
    }
    const exact = resolution.preference;
    if (exact && exact.version > action.preferenceVersion && exact.mode === "snooze") {
      try {
        await refetchActions();
      } catch {
        return {
          kind: "refresh_required",
          message: "알림은 현재 미뤄진 상태지만 목록을 불러오지 못했어요.",
          canRetryMutation: false
        };
      }
      return {
        kind: "current_deferred",
        message: "이 알림은 현재 내일 이후로 미뤄져 있어요.",
        canRetryMutation: false
      };
    }
    const exactUnchanged = action.preferenceVersion === 0
      ? exact === null
      : exact?.version === action.preferenceVersion;
    if (!exactUnchanged) {
      return refetchAfterKnownChange(refetchActions, "알림 상태가 달라져 최신 목록을 불러왔어요.");
    }
    try {
      const refreshed = await refetchActions();
      const stillActionable = refreshed.some((candidate) => sameBaseline(candidate, action));
      return stillActionable
        ? {
            kind: "rejected",
            message: "저장되지 않았어요. 다시 시도할 수 있어요.",
            canRetryMutation: true
          }
        : {
            kind: "changed",
            message: "목록 상태가 달라져 이 알림은 더 이상 처리할 수 없어요.",
            canRetryMutation: false
          };
    } catch {
      return {
        kind: "refresh_required",
        message: "저장되지 않았지만 최신 목록을 불러오지 못했어요.",
        canRetryMutation: false
      };
    }
  }
}
