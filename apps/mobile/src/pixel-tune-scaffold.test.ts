import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTuneScaffold,
  type PixelOverrideMap
} from "../../../scripts/pixel-lock/tune-scaffold";

const repoRoot = resolve(__dirname, "../../..");
const styleDir = join(repoRoot, "apps/mobile/src/pixelLock/styles");
const styleSources = readdirSync(styleDir)
  .filter((name) => name.endsWith("PixelStyles.ts"))
  .map((name) => readFileSync(join(styleDir, name), "utf8"));
const generatedOverrides = JSON.parse(
  readFileSync(join(repoRoot, "apps/mobile/src/pixelLock/generated-overrides.json"), "utf8")
) as PixelOverrideMap;

describe("Pixel tune scaffold", () => {
  it("uses the effective IMP-003 contract and labels candidate values as absolute", () => {
    const scaffold = buildTuneScaffold(
      "IMP-003",
      { name: "Excel preview", siblings: ["REP-001"], moreSettingsGuardRequired: true },
      styleSources,
      generatedOverrides
    );
    const cta = scaffold.candidates.find((candidate) => candidate.key === "ctaBottomInset");

    expect(cta).toEqual({
      key: "ctaBottomInset",
      unit: "dp",
      valueSemantics: "absolute",
      baseline: 40,
      baselineSource: "generated-override",
      deltas: [-8, -6, -4, -2, 2, 4, 6, 8],
      values: [32, 34, 36, 38, 42, 44, 46, 48]
    });
    expect(scaffold.requiredChecks).toEqual(["IMP-003", "REP-001", "SET-001"]);
    expect(scaffold.candidates.map((candidate) => candidate.key)).not.toContain("cardGap");
    expect(scaffold.candidates.map((candidate) => candidate.key)).not.toContain("cardHeight");
    expect(scaffold.candidates.map((candidate) => candidate.key)).not.toContain("rowHeight");
    expect(scaffold.excludedParameters).toEqual([
      { key: "rowHeight", reason: "zero-height-sentinel-has-no-declared-effective-baseline" }
    ]);
    expect(scaffold.candidates.every((candidate) => candidate.valueSemantics === "absolute")).toBe(true);
    expect(scaffold.candidates.find((candidate) => candidate.key === "scaleY")?.unit).toBe("ratio");
  });

  it("uses ratio-sized deltas for scale values and preserves negative offset candidates", () => {
    const scaffold = buildTuneScaffold(
      "REP-001",
      { name: "Report", siblings: [], moreSettingsGuardRequired: true },
      styleSources,
      generatedOverrides
    );
    const scale = scaffold.candidates.find((candidate) => candidate.key === "scale");
    const topOffset = scaffold.candidates.find((candidate) => candidate.key === "topOffset");

    expect(scale?.baseline).toBe(0.98);
    expect(scale?.unit).toBe("ratio");
    expect(scale?.values).toEqual([0.9, 0.92, 0.94, 0.96, 1, 1.02, 1.04, 1.06]);
    expect(topOffset?.baseline).toBe(-8);
    expect(topOffset?.values).toContain(-16);
  });
});
