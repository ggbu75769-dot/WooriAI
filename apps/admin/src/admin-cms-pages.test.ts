import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("Admin CMS token gate", () => {
  it("gates the app behind an admin token stored in sessionStorage and sent as x-admin-token", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("use client");
    expect(gate).toContain("입장");
    const tokenContext = readSource("src/lib/admin-token-context.tsx");
    expect(tokenContext).toContain("sessionStorage");
    expect(tokenContext).not.toContain("localStorage");
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("x-admin-token");
  });
});

describe("Admin CMS item templates page", () => {
  it("exposes create and update flows against the admin item-templates API", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createItemTemplate");
    expect(source).toContain("updateItemTemplate");
    expect(source).toContain("necessityLevel");
  });
});

describe("Admin CMS product links page", () => {
  it("exposes create and update flows against the admin product-links API with URL validation", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createProductLink");
    expect(source).toContain("updateProductLink");
    expect(source).toContain("isHttpUrl");
  });
});

describe("Admin CMS disclosures page", () => {
  it("exposes read and update flows against the admin disclosures API", () => {
    const source = readSource("app/disclosures/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listDisclosures");
    expect(source).toContain("updateDisclosure");
  });
});

describe("Admin CMS click summary page", () => {
  it("reads the affiliate click summary endpoint", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAffiliateClickSummary");
  });
});
