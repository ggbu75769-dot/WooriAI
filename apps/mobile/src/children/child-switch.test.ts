import { describe, expect, it } from "vitest";
import { CHILD_SCOPED_QUERY_KEY_PREFIXES, planChildSwitch } from "./child-switch";

describe("MOB-118 child switch planning", () => {
  it("is a no-op when tapping the already selected child (keeps warm caches)", () => {
    expect(planChildSwitch("child-1", { id: "child-1", nickname: "다온이" })).toBeNull();
  });

  it("switches to a different child with an announcement and full child-scoped invalidation", () => {
    const plan = planChildSwitch("child-1", { id: "child-2", nickname: "튼튼이" });
    expect(plan).not.toBeNull();
    expect(plan!.childId).toBe("child-2");
    expect(plan!.announcement).toBe("튼튼이(으)로 전환했어요.");
    expect(plan!.invalidateKeys).toBe(CHILD_SCOPED_QUERY_KEY_PREFIXES);
  });

  it("switches even when nothing was selected yet", () => {
    const plan = planChildSwitch(null, { id: "child-1", nickname: "다온이" });
    expect(plan?.childId).toBe("child-1");
  });

  it("covers every child-scoped query key family used by the app's screens", () => {
    // Keys per the queryKey inventory across app/**: home, expenses (list) + expense (detail),
    // budget, items + item-detail, report. household-members/children are child-independent.
    const prefixes = CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => key[0]);
    expect(prefixes).toEqual(["home", "expenses", "expense", "budget", "items", "item-detail", "report"]);
  });
});
