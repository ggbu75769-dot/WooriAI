import { describe, expect, it } from "vitest";
import { importCompletionSummary } from "./completion-summary";

describe("import completion summary", () => {
  it("counts every row not imported as excluded from the final ledger", () => {
    expect(importCompletionSummary(3, 2)).toEqual({ importedCount: 2, excludedCount: 1 });
  });

  it("clamps inconsistent server counts instead of showing negative values", () => {
    expect(importCompletionSummary(2, 4)).toEqual({ importedCount: 2, excludedCount: 0 });
    expect(importCompletionSummary(-1, -2)).toEqual({ importedCount: 0, excludedCount: 0 });
  });
});
