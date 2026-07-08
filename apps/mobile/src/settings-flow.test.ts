import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 10 mobile settings contract", () => {
  it("exposes settings API client functions", async () => {
    const client = await import("./api/client");

    expect(client.getPrivacySettings).toEqual(expect.any(Function));
    expect(client.previewChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.confirmChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.previewHouseholdLeave).toEqual(expect.any(Function));
    expect(client.previewAccountDeletion).toEqual(expect.any(Function));
    expect(client.confirmAccountDeletion).toEqual(expect.any(Function));
  });

  it("creates settings and privacy routes without changing the fixed tabs", () => {
    const expectations = [
      ["app/(tabs)/_layout.tsx", "Tabs.Screen"],
      ["app/settings/index.tsx", "SET-001"],
      ["app/settings/index.tsx", "SET-002"],
      ["app/settings/index.tsx", "router.push(\"/settings/privacy\")"],
      ["app/settings/privacy.tsx", "SET-003"],
      ["app/settings/privacy.tsx", "SET-004"],
      ["app/settings/privacy.tsx", "previewChildProfileDeletion"],
      ["app/settings/privacy.tsx", "confirmChildProfileDeletion"],
      ["app/settings/privacy.tsx", "previewAccountDeletion"],
      ["app/settings/privacy.tsx", "confirmAccountDeletion"],
      ["app/settings/privacy.tsx", "requiresSecondStep"]
    ];

    for (const [relativePath, expectedText] of expectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});
