import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

describe("Batch 10 admin CMS shell", () => {
  it("exposes admin CMS sections with the current cookie-session and MFA boundary", () => {
    const expectations = [
      ["app/page.tsx", "ADM-001"],
      ["app/page.tsx", "ADM-002"],
      ["app/page.tsx", "ADM-003"],
      ["app/page.tsx", "ADM-004"],
      ["app/page.tsx", "HttpOnly 세션 쿠키"],
      ["app/page.tsx", "MFA"],
      ["app/page.tsx", "Item templates"],
      ["app/page.tsx", "Product links"],
      ["app/page.tsx", "Disclosures"],
      ["app/page.tsx", "Click summary"]
    ];

    for (const [relativePath, expectedText] of expectations) {
      const filePath = join(adminRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
    expect(readFileSync(join(adminRoot, "app/page.tsx"), "utf8")).not.toContain("Admin auth placeholder");
    expect(readFileSync(join(adminRoot, "app/page.tsx"), "utf8")).not.toContain("x-admin-token");
  });
});
