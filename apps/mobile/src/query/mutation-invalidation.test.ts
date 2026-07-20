import { describe, expect, it } from "vitest";
import {
  financialMutationQueryRoots,
  invalidateFinancialMutationQueries,
  invalidatePreparationMutationQueries,
  preparationMutationQueryRoots
} from "./mutation-invalidation";

function createClientSpy() {
  const calls: Array<{ predicate: (query: { queryKey: readonly unknown[] }) => boolean }> = [];
  return {
    client: {
      async invalidateQueries(filters: { predicate: (query: { queryKey: readonly unknown[] }) => boolean }) {
        calls.push(filters);
      }
    },
    calls
  };
}

describe("cross-feature mutation invalidation", () => {
  it("refreshes every expense-derived view after the server confirms an offline mutation", async () => {
    const { client, calls } = createClientSpy();

    await invalidateFinancialMutationQueries(client, "child-a");

    expect(calls).toHaveLength(financialMutationQueryRoots.length);
    expect(calls[0]!.predicate({ queryKey: ["expenses", "child-a", "2026-07"] })).toBe(true);
    expect(calls[0]!.predicate({ queryKey: ["expenses", "child-b", "2026-07"] })).toBe(false);
    expect(calls[0]!.predicate({ queryKey: ["report-v3", "child-a"] })).toBe(false);
    expect(financialMutationQueryRoots).toContain("report-v3");
    expect(financialMutationQueryRoots).toContain("report-v3-sources");
    expect(financialMutationQueryRoots).toContain("budget");
    expect(financialMutationQueryRoots).toContain("expense-shortcuts");
  });

  it("refreshes planned-cost reports after an item plan changes", async () => {
    const { client, calls } = createClientSpy();

    await invalidatePreparationMutationQueries(client, ["child:child-a", "child-a"]);

    expect(calls).toHaveLength(preparationMutationQueryRoots.length);
    expect(calls[0]!.predicate({ queryKey: ["catalog-v2", "timeline", "child:child-a"] })).toBe(true);
    expect(calls[0]!.predicate({ queryKey: ["catalog-v2", "timeline", "child:child-b"] })).toBe(false);
    expect(calls[4]!.predicate({ queryKey: ["report-v3", "household-a", "child-a"] })).toBe(true);
    expect(preparationMutationQueryRoots).toContain("catalog-v2");
    expect(preparationMutationQueryRoots).toContain("report-v3");
    expect(preparationMutationQueryRoots).toContain("report-v3-sources");
  });
});
