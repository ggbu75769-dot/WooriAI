import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  containLiveScreenshotForReference,
  evaluatePixelLockStatus,
  normalizeLiveScreenshotForReference
} from "../../../scripts/ui-pixel-lock";

describe("UI Pixel Lock screenshot normalization", () => {
  it("derives final status from visual thresholds and native proof instead of hardcoding FAIL", () => {
    const passingResults = [
      { pixelMismatchRatio: 0.01, screenshotMode: "live-browser" as const },
      { pixelMismatchRatio: 0.019, screenshotMode: "live-browser" as const }
    ];

    expect(evaluatePixelLockStatus(passingResults, { nativeProofStatus: "captured" })).toMatchObject({
      finalStatus: "PASS",
      visualQaCompleted: true
    });
    expect(evaluatePixelLockStatus(passingResults, { nativeProofStatus: "missing" })).toMatchObject({
      finalStatus: "BLOCKED",
      visualQaCompleted: false
    });
    expect(
      evaluatePixelLockStatus([{ pixelMismatchRatio: 0.051, screenshotMode: "live-browser" as const }], {
        nativeProofStatus: "captured"
      })
    ).toMatchObject({
      finalStatus: "FAIL",
      visualQaCompleted: false
    });
  });

  it("only applies live screenshot tail-cropping to explicitly opted-in screen specs", () => {
    const script = readFileSync(join(process.cwd(), "..", "..", "scripts", "ui-pixel-lock.ts"), "utf8");

    expect(script).toContain("normalizeLiveScreenshot?: boolean");
    expect(script).toContain("normalizeLiveScreenshot: true");
    expect(script).toContain("spec.normalizeLiveScreenshot");
  });

  it("only applies aspect-preserving live screenshot comparison to explicitly opted-in screen specs", () => {
    const script = readFileSync(join(process.cwd(), "..", "..", "scripts", "ui-pixel-lock.ts"), "utf8");

    expect(script).toContain("preserveLiveScreenshotAspect?: boolean");
    expect(script).toContain("preserveLiveScreenshotAspect: true");
    expect(script).toContain("spec.preserveLiveScreenshotAspect");
    expect(script).not.toContain('id: "product-detail",\n    label: "Product detail",\n    referenceCropId: "2_png_product_detail",\n    route: "/items/[itemTemplateId]",\n    preserveLiveScreenshotAspect: true');
  });

  it("uses manifest-declared live screenshot files during diff generation", () => {
    const script = readFileSync(join(process.cwd(), "..", "..", "scripts", "ui-pixel-lock.ts"), "utf8");

    expect(script).toContain("liveScreenshotManifestEntries.get(spec.id)");
    expect(script).toContain("manifestLiveScreenshotPath && existsSync(manifestLiveScreenshotPath)");
  });

  it("compares the More route against a single more-menu reference crop, not the full mini-sample strip", () => {
    const script = readFileSync(join(process.cwd(), "..", "..", "scripts", "ui-pixel-lock.ts"), "utf8");
    const cropMap = readFileSync(join(process.cwd(), "..", "..", "docs", "ui-pixel-lock", "reference-crop-map.json"), "utf8");

    expect(script).toContain('referenceCropId: "3_png_more_menu"');
    expect(script).not.toContain('label: "More / settings",\n    referenceCropId: "3_png_mobile_samples"');
    expect(cropMap).toContain('"id": "3_png_more_menu"');
  });

  it("crops extra live-browser document height before resizing to the reference", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "wooriai-pixel-lock-"));
    try {
      const livePath = join(tempDir, "live.png");
      const referencePath = join(tempDir, "reference.png");

      await sharp({
        create: {
          width: 430,
          height: 900,
          channels: 4,
          background: "#FFF7ED"
        }
      })
        .composite([
          {
            input: Buffer.from(
              '<svg width="430" height="640" xmlns="http://www.w3.org/2000/svg"><rect width="430" height="640" fill="#FFFFFF"/></svg>'
            ),
            left: 0,
            top: 0
          }
        ])
        .png()
        .toFile(livePath);

      await sharp({
        create: {
          width: 230,
          height: 600,
          channels: 4,
          background: "#FFFFFF"
        }
      })
        .png()
        .toFile(referencePath);

      const normalized = await normalizeLiveScreenshotForReference(livePath, referencePath);
      const metadata = await sharp(normalized).metadata();
      const sample = await sharp(normalized).ensureAlpha().raw().toBuffer();
      const lowerContentOffset = 500 * (metadata.width ?? 0) * 4;

      expect(metadata).toMatchObject({ width: 230, height: 600 });
      expect(sample[lowerContentOffset]).toBe(255);
      expect(sample[lowerContentOffset + 1]).toBe(255);
      expect(sample[lowerContentOffset + 2]).toBe(255);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves live screenshot aspect ratio with beige letterboxing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "wooriai-pixel-lock-"));
    try {
      const livePath = join(tempDir, "wide-live.png");
      const referencePath = join(tempDir, "square-reference.png");

      await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 4,
          background: "#FF6B52"
        }
      })
        .png()
        .toFile(livePath);

      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: "#FFFFFF"
        }
      })
        .png()
        .toFile(referencePath);

      const normalized = await containLiveScreenshotForReference(livePath, referencePath);
      const metadata = await sharp(normalized).metadata();
      const sample = await sharp(normalized).ensureAlpha().raw().toBuffer();
      const topPixelOffset = 10 * (metadata.width ?? 0) * 4;
      const centerPixelOffset = 50 * (metadata.width ?? 0) * 4;

      expect(metadata).toMatchObject({ width: 100, height: 100 });
      expect(sample[topPixelOffset]).toBe(255);
      expect(sample[topPixelOffset + 1]).toBe(247);
      expect(sample[topPixelOffset + 2]).toBe(237);
      expect(sample[centerPixelOffset]).toBe(255);
      expect(sample[centerPixelOffset + 1]).toBe(107);
      expect(sample[centerPixelOffset + 2]).toBe(82);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
