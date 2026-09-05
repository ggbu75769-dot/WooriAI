import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "..");

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return productionTsxFiles(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("Korean text policy", () => {
  it("routes every production Text through the shared Korean primitive without clipping caps", () => {
    const wrapper = join(mobileRoot, "src", "design-system", "components", "KoreanText.tsx");
    const files = [join(mobileRoot, "app"), join(mobileRoot, "src")]
      .flatMap(productionTsxFiles)
      .filter((path) => path !== wrapper);
    const violations = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const nativeImport = source.split(/\r?\n/).find((line) => line.includes("react-native"));
      const importsNativeText = nativeImport?.split("{")[1]?.split("}")[0]
        ?.split(",")
        .some((entry) => entry.trim() === "Text") ?? false;
      const capsText = source.includes("numberOfLines=") || source.includes("maxFontSizeMultiplier=");
      return importsNativeText || capsText ? [relative(mobileRoot, path)] : [];
    });
    expect(violations).toEqual([]);
  });

  it("defines native Korean word wrapping and uncapped dynamic type", () => {
    const source = readFileSync(
      join(mobileRoot, "src", "design-system", "components", "KoreanText.tsx"),
      "utf8"
    );
    expect(source).toContain('android_hyphenationFrequency = "none"');
    expect(source).toContain('lineBreakStrategyIOS = "hangul-word"');
    expect(source).toContain('textBreakStrategy = "highQuality"');
    expect(source).toContain("protectKoreanWordBoundaries");
    expect(source).not.toContain("maxFontSizeMultiplier");
    expect(source).not.toContain("numberOfLines");
  });

  it("uses explicit word-boundary layout where compact Korean copy needs deterministic wrapping", () => {
    const launch = readFileSync(join(mobileRoot, "app", "launch-animation.tsx"), "utf8");
    const cards = readFileSync(
      join(mobileRoot, "src", "design-system", "components", "ModV1Primitives.tsx"),
      "utf8"
    );
    const balance = readFileSync(
      join(mobileRoot, "src", "design-system", "compact-korean-label.ts"),
      "utf8"
    );

    expect(launch).toContain(">아이의 모든 순간,</Text>");
    expect(launch).toContain(">우리가 함께 기록하고 응원할게요.</Text>");
    expect(cards).toContain('displayTitle.split("\\n").map');
    expect(balance).toContain("balanceCompactKoreanLabel");
    expect(balance).toContain('split(/\\s+/)');
    expect(balance).not.toContain("\\u2060");
  });
});
