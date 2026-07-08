import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 09 mobile import beta contract", () => {
  it("exposes import API client functions", async () => {
    const client = await import("./api/client");

    expect(client.createExcelImport).toEqual(expect.any(Function));
    expect(client.getImportJob).toEqual(expect.any(Function));
    expect(client.listImportRows).toEqual(expect.any(Function));
    expect(client.updateImportRow).toEqual(expect.any(Function));
    expect(client.confirmImport).toEqual(expect.any(Function));
  });

  it("creates import upload, progress, preview, and confirm routes without changing tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "Tabs.Screen"],
      ["app/import/index.tsx", "IMP-001"],
      ["app/import/index.tsx", "IMP-002"],
      ["app/import/index.tsx", "createExcelImport"],
      ["app/import/[importJobId].tsx", "IMP-003"],
      ["app/import/[importJobId].tsx", "IMP-004"],
      ["app/import/[importJobId].tsx", "listImportRows"],
      ["app/import/[importJobId].tsx", "updateImportRow"],
      ["app/import/[importJobId].tsx", "confirmImport"],
      ["app/import/[importJobId].tsx", "selectedRowIds"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});
