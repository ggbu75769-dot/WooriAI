import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { householdIdForSelectedChildScope } from "./stores/selected-child.store";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("selected child household boundary", () => {
  it("fails closed instead of using household A while child B's household is unresolved", () => {
    const requestedHouseholds: string[] = [];
    const resolved = householdIdForSelectedChildScope("child-b", null, "household-a");
    if (resolved) requestedHouseholds.push(resolved);

    expect(resolved).toBeNull();
    expect(requestedHouseholds).toEqual([]);
  });

  it("routes every offline, preset, and purchase-followup scope consumer through the fail-closed helper", () => {
    for (const relativePath of [
      "src/offline/OfflineSyncLifecycle.tsx",
      "src/offline/sync-controller.ts",
      "src/stores/session.store.ts",
      "app/expenses/new.tsx",
      "app/receipts/new.tsx"
    ]) {
      const file = source(relativePath);
      expect(file, relativePath).toContain("householdIdForSelectedChildScope(");
      expect(file, relativePath).not.toContain("selectedChildHouseholdId ??");
    }
    const receipt = source("app/receipts/new.tsx");
    expect(receipt).toContain("readReceiptOfflineDraft(scopeKey)");
    expect(receipt).toContain("scopeKey,");
    expect(receipt).toContain("draft.scopeKey !== scopeKey");
    expect(receipt).toContain("operation.assertActive()");
    expect(receipt).toContain("createReceiptDraft(owner.token");
    expect(receipt).toContain("confirmReceiptDraft(");
    expect(receipt).toContain("operation.signal");
    expect(receipt).toContain("clearReceiptOfflineDraft(owner.scopeKey)");
  });
});
