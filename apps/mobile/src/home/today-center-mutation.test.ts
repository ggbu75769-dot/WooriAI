import { describe, expect, it, vi } from "vitest";
import type { TodayActionContract, TodayPreferenceResolutionContract } from "@wooriai/contracts";
import { ApiClientError } from "../api/client";
import { executeTodaySnooze } from "./today-center-mutation";

const childId = "5d2a79d4-cc9d-4e78-898d-64d889802031";
const action: TodayActionContract = {
  actionKey: "plan:5d2a79d4-cc9d-4e78-898d-64d889802099:recurring",
  kind: "recurring_due",
  sourceId: "20ca11fe-0000-4a01-8a01-f1c7deb0a001",
  childId,
  dueDate: "2026-07-27",
  assignedUserId: null,
  reasonCode: "recurring_due",
  reasonParams: { itemName: "기저귀" },
  navigation: { kind: "item" },
  preferenceScope: { kind: "child", childId },
  preferenceVersion: 0
};

const unchangedResolution: TodayPreferenceResolutionContract = {
  actionKey: action.actionKey,
  preferenceScope: action.preferenceScope,
  preference: null
};

describe("Today snooze outcome truth", () => {
  it("never retries a committed write when only the Home refetch fails", async () => {
    const result = await executeTodaySnooze({
      action,
      write: vi.fn().mockResolvedValue({
        actionKey: action.actionKey,
        mode: "snooze",
        snoozedUntil: "2026-07-28",
        version: 1
      }),
      resolveExact: vi.fn(),
      refetchActions: vi.fn().mockRejectedValue(new Error("offline"))
    });
    expect(result).toMatchObject({ kind: "saved_refresh_failed", canRetryMutation: false });
  });

  it("handles a confirmed CAS conflict through refetch only", async () => {
    const write = vi.fn().mockRejectedValue(new ApiClientError(409, "TODAY_PREFERENCE_CONFLICT"));
    const result = await executeTodaySnooze({
      action,
      write,
      resolveExact: vi.fn(),
      refetchActions: vi.fn().mockResolvedValue([])
    });
    expect(result).toMatchObject({ kind: "changed", canRetryMutation: false });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not call an unrelated top-three disappearance a saved write", async () => {
    const result = await executeTodaySnooze({
      action,
      write: vi.fn().mockRejectedValue(new Error("Network request failed")),
      resolveExact: vi.fn().mockResolvedValue(unchangedResolution),
      refetchActions: vi.fn().mockResolvedValue([])
    });
    expect(result).toMatchObject({ kind: "changed", canRetryMutation: false });
    expect(result.message).not.toContain("저장");
  });

  it("allows retry after an unknown outcome only when exact and Home baselines remain", async () => {
    const result = await executeTodaySnooze({
      action,
      write: vi.fn().mockRejectedValue(new Error("Network request failed")),
      resolveExact: vi.fn().mockResolvedValue(unchangedResolution),
      refetchActions: vi.fn().mockResolvedValue([action])
    });
    expect(result).toMatchObject({ kind: "rejected", canRetryMutation: true });
  });

  it("reports current deferral without attributing an indeterminate commit", async () => {
    const result = await executeTodaySnooze({
      action,
      write: vi.fn().mockRejectedValue(new ApiClientError(503, "UPSTREAM_UNAVAILABLE")),
      resolveExact: vi.fn().mockResolvedValue({
        actionKey: action.actionKey,
        preferenceScope: action.preferenceScope,
        preference: {
          actionKey: action.actionKey,
          mode: "snooze",
          snoozedUntil: "2026-07-28",
          version: 1
        }
      }),
      refetchActions: vi.fn().mockResolvedValue([])
    });
    expect(result).toMatchObject({ kind: "current_deferred", canRetryMutation: false });
  });
});
