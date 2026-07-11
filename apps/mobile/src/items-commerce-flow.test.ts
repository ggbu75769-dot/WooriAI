import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 07 mobile items and commerce contract", () => {
  it("exposes item, status, and product-link API client functions", async () => {
    const client = await import("./api/client");

    expect(client.listItems).toEqual(expect.any(Function));
    expect(client.getItemDetail).toEqual(expect.any(Function));
    expect(client.updateItemStatus).toEqual(expect.any(Function));
    expect(client.clickProductLink).toEqual(expect.any(Function));
  });

  it("creates locked item/commerce route files while preserving the fixed tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"],
      ["app/(tabs)/items.tsx", "ITEM-001"],
      ["app/(tabs)/items.tsx", "listItems"],
      ["app/(tabs)/items.tsx", "updateItemStatus"],
      ["app/items/[itemTemplateId].tsx", "ITEM-002"],
      ["app/items/[itemTemplateId].tsx", "ITEM-003"],
      ["app/items/[itemTemplateId].tsx", "ITEM-004"],
      ["app/items/[itemTemplateId].tsx", "getItemDetail"],
      ["app/items/[itemTemplateId].tsx", "clickProductLink"],
      ["app/items/[itemTemplateId].tsx", "disclosureText"],
      ["app/items/[itemTemplateId].tsx", "스폰서"],
      ["app/items/[itemTemplateId].tsx", "제휴"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});
