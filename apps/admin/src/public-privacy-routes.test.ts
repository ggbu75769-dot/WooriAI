import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("public legal and privacy routes", () => {
  it.each(["privacy", "terms", "account-deletion", "data-export", "support"])("exposes /%s", (route) => {
    expect(existsSync(join(root, "app", route, "page.tsx"))).toBe(true);
  });

  it("bypasses the client admin session gate for every public route", () => {
    const shell = readFileSync(join(root, "src/components/AdminShell.tsx"), "utf8");
    for (const route of ["/privacy", "/terms", "/account-deletion", "/data-export", "/support"]) {
      expect(shell).toContain(`"${route}"`);
    }
    expect(shell.indexOf("PUBLIC_PATHS.has(pathname)")).toBeLessThan(shell.indexOf("if (!isReady)"));
  });
});
