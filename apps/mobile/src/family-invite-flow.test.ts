import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 08 mobile family invite contract", () => {
  it("exposes household member and invite API client functions", async () => {
    const client = await import("./api/client");

    expect(client.listHouseholdMembers).toEqual(expect.any(Function));
    expect(client.createInvite).toEqual(expect.any(Function));
    expect(client.getInvite).toEqual(expect.any(Function));
    expect(client.acceptInvite).toEqual(expect.any(Function));
  });

  it("creates the locked family routes without changing the bottom tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "프로필"],
      ["app/family/index.tsx", "FAM-001"],
      ["app/family/index.tsx", "listHouseholdMembers"],
      ["app/family/index.tsx", "createInvite"],
      ["app/family/invite.tsx", "FAM-002"],
      ["app/family/invite.tsx", "createInvite"],
      ["app/family/accept/[token].tsx", "FAM-003"],
      ["app/family/accept/[token].tsx", "getInvite"],
      ["app/family/accept/[token].tsx", "acceptInvite"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});
