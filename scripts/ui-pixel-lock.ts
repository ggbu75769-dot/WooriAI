import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

type CropEntry = {
  id: string;
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes: string;
};

type CropMap = {
  sourceResolution: {
    width: number;
    height: number;
  };
  crops: CropEntry[];
};

type CardTone = "coral" | "mint" | "peach" | "white";

type ScreenSpec = {
  id: string;
  label: string;
  referenceCropId: string;
  route: string;
  normalizeLiveScreenshot?: boolean;
  preserveLiveScreenshotAspect?: boolean;
  headline: string;
  subtitle: string;
  cards: Array<{
    title: string;
    value: string;
    tone: CardTone;
  }>;
};

type DiffResult = {
  screenId: string;
  label: string;
  reference: string;
  screenshot: string;
  screenshotMode: "generated" | "live-browser";
  diff: string;
  width: number;
  height: number;
  pixelMismatchRatio: number;
  status: "PASS" | "VISUAL QA NOT PROVEN";
  remainingMismatch: string;
};

type PixelLockFinalStatus = "PASS" | "FAIL" | "BLOCKED";
type NativeProofStatus = "captured" | "waived" | "missing";
type PixelLockEvaluationResult = {
  finalStatus: PixelLockFinalStatus;
  generatedFallbackCount: number;
  hasMaterialVisualMismatch: boolean;
  nativeProofSatisfied: boolean;
  visualMismatchThreshold: number;
  visualQaCompleted: boolean;
  worstMismatch: number;
};

type PixelLockEvaluationInput = {
  pixelMismatchRatio: number;
  screenshotMode?: "generated" | "live-browser";
};

type LiveScreenshotManifestEntry = {
  id: string;
  requestedUrl: string;
  filePath: string;
  captureMode?: string;
  info?: {
    href?: string;
    innerHeight?: number;
    innerWidth?: number;
  };
};

type ScreenshotManifestEntry = {
  screenId: string;
  screenshot: string;
  referenceCropId: string;
  mode: "generated";
  liveScreenshot?: string;
  liveScreenshotAvailable: boolean;
  liveImageWidth?: number;
  liveImageHeight?: number;
  liveRequestedUrl?: string;
  liveCaptureMode?: string;
};

const repoRoot = process.cwd();
const outputContracts = {
  cropMap: "docs/ui-pixel-lock/reference-crop-map.json",
  screenshots: "docs/ui-pixel-lock/app-screenshots",
  diffs: "docs/ui-pixel-lock/diffs",
  finalReport: "docs/ui-pixel-lock/reports/ui-pixel-lock-final-report.md"
} as const;

function contractPath(contract: string) {
  return join(repoRoot, ...contract.split("/"));
}

const uiRoot = join(repoRoot, "docs", "ui-pixel-lock");
const cropMapPath = contractPath(outputContracts.cropMap);
const cropDir = join(uiRoot, "reference-crops");
const screenshotDir = contractPath(outputContracts.screenshots);
const screenshotManifestPath = join(screenshotDir, "manifest.json");
const liveScreenshotDir = join(uiRoot, "live-screenshots");
const liveScreenshotManifestPath = join(liveScreenshotDir, "manifest.json");
const diffDir = contractPath(outputContracts.diffs);
const reportDir = join(uiRoot, "reports");
const resultPath = join(reportDir, "ui-pixel-lock-results.json");
const finalReportPath = contractPath(outputContracts.finalReport);
const visualQaReportPath = join(uiRoot, "visual-qa-report.md");
const mismatchLogPath = join(uiRoot, "mismatch-log.md");
const maxLiveScreenshotWidth = 430;
const maxVisualMismatchRatio = 0.05;
const nativeScreenshotManifestPath = join(uiRoot, "native-screenshots", "manifest.json");
const nativeProofWaiverPath = join(uiRoot, "native-proof-waiver.md");

const colors = {
  mainCoral: "#FF6B52",
  subCoral: "#FF8E72",
  peach: "#FFE4D6",
  mint: "#E8F6F1",
  sky: "#E8F1FF",
  brown: "#4A3F35",
  gray900: "#1F1F1F",
  gray600: "#666666",
  gray300: "#E5E5E5",
  beige: "#FFF7ED",
  white: "#FFFFFF"
};

const screenSpecs: ScreenSpec[] = [
  {
    id: "splash",
    label: "Splash / launch",
    referenceCropId: "1_png_splash",
    route: "/launch-animation",
    headline: "WooriAI",
    subtitle: "Growth-stage launch animation",
    cards: [
      { title: "Logo", value: "Warm family mark", tone: "peach" },
      { title: "Animation", value: "fetus to high school", tone: "mint" },
      { title: "Action", value: "skip or start", tone: "coral" }
    ]
  },
  {
    id: "home",
    label: "Home",
    referenceCropId: "1_png_home",
    route: "/(tabs)",
    headline: "Today for Daon",
    subtitle: "Record what your family prepared",
    cards: [
      { title: "This month", value: "KRW 1,245,700 / 78%", tone: "coral" },
      { title: "Next item", value: "24 month growth prep", tone: "mint" },
      { title: "Recent", value: "Diaper KRW 25,900", tone: "white" }
    ]
  },
  {
    id: "quick-expense",
    label: "Quick expense",
    referenceCropId: "1_png_quick_expense",
    route: "/expenses/new",
    normalizeLiveScreenshot: true,
    headline: "Quick record",
    subtitle: "Amount, category, date, memo",
    cards: [
      { title: "Amount", value: "KRW 18,500", tone: "white" },
      { title: "Category", value: "diaper / formula / food / clothes", tone: "peach" },
      { title: "Save", value: "expense_created", tone: "coral" }
    ]
  },
  {
    id: "recommendation",
    label: "Recommendation",
    referenceCropId: "2_png_recommendation_list",
    route: "/(tabs)/items",
    preserveLiveScreenshotAspect: true,
    headline: "Recommendations",
    subtitle: "Items matched to child stage",
    cards: [
      { title: "Best", value: "Baby bath chair", tone: "white" },
      { title: "Required", value: "Diaper subscription", tone: "peach" },
      { title: "New", value: "Wood block set", tone: "mint" }
    ]
  },
  {
    id: "product-detail",
    label: "Product detail",
    referenceCropId: "2_png_product_detail",
    route: "/items/[itemTemplateId]",
    headline: "Diaper party pack",
    subtitle: "Compare price and product detail",
    cards: [
      { title: "Price range", value: "KRW 32,900 - 48,900", tone: "white" },
      { title: "Affiliate notice", value: "Commission disclosed near CTA", tone: "peach" },
      { title: "CTA", value: "purchase link + log expense", tone: "coral" }
    ]
  },
  {
    id: "family",
    label: "Family",
    referenceCropId: "2_png_family_invite",
    route: "/family",
    preserveLiveScreenshotAspect: true,
    headline: "Family sharing",
    subtitle: "Parents and caregivers together",
    cards: [
      { title: "Invite code", value: "DAON2026", tone: "white" },
      { title: "Link", value: "copy and share", tone: "mint" },
      { title: "Roles", value: "owner / member", tone: "peach" }
    ]
  },
  {
    id: "excel-preview",
    label: "Excel preview",
    referenceCropId: "2_png_excel_preview",
    route: "/import",
    preserveLiveScreenshotAspect: true,
    headline: "Excel preview",
    subtitle: "Preview before saving to expenses",
    cards: [
      { title: "Upload", value: "may-expenses.xlsx", tone: "mint" },
      { title: "AI preview", value: "128 rows / KRW 1,245,700", tone: "white" },
      { title: "Apply", value: "only approved rows are saved", tone: "coral" }
    ]
  },
  {
    id: "report",
    label: "Report",
    referenceCropId: "2_png_report_detail",
    route: "/(tabs)/reports",
    preserveLiveScreenshotAspect: true,
    headline: "Report",
    subtitle: "Monthly, quarterly, yearly",
    cards: [
      { title: "Total", value: "KRW 1,245,700 / +12.5%", tone: "white" },
      { title: "Category", value: "diaper 34% / food 24%", tone: "mint" },
      { title: "Insight", value: "KRW 112,000 under target", tone: "peach" }
    ]
  },
  {
    id: "more",
    label: "More / settings",
    referenceCropId: "3_png_more_menu",
    route: "/(tabs)/more",
    preserveLiveScreenshotAspect: true,
    headline: "More",
    subtitle: "Family, import, settings",
    cards: [
      { title: "Family", value: "invite and role management", tone: "white" },
      { title: "Import", value: "preview before save", tone: "mint" },
      { title: "Privacy", value: "terms and consent", tone: "peach" }
    ]
  }
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readNativeProofStatus(): NativeProofStatus {
  if (existsSync(nativeScreenshotManifestPath)) {
    return "captured";
  }
  if (existsSync(nativeProofWaiverPath)) {
    return "waived";
  }
  return "missing";
}

export function evaluatePixelLockStatus(
  results: PixelLockEvaluationInput[],
  options: { nativeProofStatus: NativeProofStatus; visualMismatchThreshold?: number }
): PixelLockEvaluationResult {
  const visualMismatchThreshold = options.visualMismatchThreshold ?? maxVisualMismatchRatio;
  const worstMismatch = results.length > 0 ? Math.max(...results.map((result) => result.pixelMismatchRatio)) : 1;
  const generatedFallbackCount = results.filter((result) => result.screenshotMode !== "live-browser").length;
  const hasMaterialVisualMismatch = worstMismatch > visualMismatchThreshold;
  const nativeProofSatisfied = options.nativeProofStatus !== "missing";
  const visualQaCompleted = !hasMaterialVisualMismatch && generatedFallbackCount === 0 && nativeProofSatisfied;
  const finalStatus: PixelLockFinalStatus = visualQaCompleted
    ? "PASS"
    : hasMaterialVisualMismatch
      ? "FAIL"
      : "BLOCKED";

  return {
    finalStatus,
    generatedFallbackCount,
    hasMaterialVisualMismatch,
    nativeProofSatisfied,
    visualMismatchThreshold,
    visualQaCompleted,
    worstMismatch
  };
}

function toneColor(tone: CardTone) {
  if (tone === "coral") return colors.mainCoral;
  if (tone === "mint") return colors.mint;
  if (tone === "peach") return colors.peach;
  return colors.white;
}

function textColor(tone: CardTone) {
  return tone === "coral" ? colors.white : colors.brown;
}

async function ensureDirs() {
  await Promise.all([screenshotDir, diffDir, reportDir, cropDir].map((directory) => mkdir(directory, { recursive: true })));
}

async function readCropMap() {
  const raw = await readFile(cropMapPath, "utf8");
  return JSON.parse(raw) as CropMap;
}

function cropPath(cropId: string) {
  return join(cropDir, `${cropId}.png`);
}

async function readLiveScreenshotManifest() {
  if (!existsSync(liveScreenshotManifestPath)) {
    throw new Error(`LIVE_SCREENSHOT_MANIFEST_MISSING ${liveScreenshotManifestPath}`);
  }

  const raw = await readFile(liveScreenshotManifestPath, "utf8");
  const entries = JSON.parse(raw) as LiveScreenshotManifestEntry[];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

async function readScreenshotManifest() {
  if (!existsSync(screenshotManifestPath)) {
    return new Map<string, ScreenshotManifestEntry>();
  }

  const raw = await readFile(screenshotManifestPath, "utf8");
  const entries = JSON.parse(raw) as ScreenshotManifestEntry[];
  return new Map(entries.map((entry) => [entry.screenId, entry]));
}

async function resolveCropSourcePath(crop: CropEntry) {
  const declaredPath = contractPath(crop.source);
  if (existsSync(declaredPath)) {
    return declaredPath;
  }

  const fileName = basename(crop.source);
  const docsDir = join(repoRoot, "docs");
  const sourceDirs = await readdir(docsDir);
  const fallbackPath = sourceDirs
    .filter((entry) => entry.startsWith("0_"))
    .map((entry) => join(docsDir, entry, fileName))
    .find((candidate) => existsSync(candidate));

  if (!fallbackPath) {
    throw new Error(`Missing reference source image for ${crop.id}: ${crop.source}`);
  }
  return fallbackPath;
}

async function writeReferenceCrops(cropMap: CropMap) {
  await ensureDirs();
  for (const crop of cropMap.crops) {
    const sourcePath = await resolveCropSourcePath(crop);
    await sharp(sourcePath)
      .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
      .png()
      .toFile(cropPath(crop.id));
  }
}

async function getReferenceSize(cropId: string) {
  const metadata = await sharp(cropPath(cropId)).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Reference crop has no dimensions: ${cropId}`);
  }
  return { width: metadata.width, height: metadata.height };
}

function cardRows(spec: ScreenSpec, width: number, height: number, phoneX: number, phoneWidth: number) {
  const cardWidth = phoneWidth - 28;
  const cardX = phoneX + 14;
  const navY = height - 72;
  const availableHeight = Math.max(120, navY - 136);
  const cardGap = 10;
  const cardHeight = Math.max(46, Math.min(82, Math.floor(availableHeight / spec.cards.length) - cardGap));

  return spec.cards
    .map((card, index) => {
      const y = 126 + index * (cardHeight + cardGap);
      const background = toneColor(card.tone);
      const foreground = textColor(card.tone);
      const valueColor = card.tone === "coral" ? colors.white : colors.gray900;
      const valueSize = width < 220 ? 10 : 13;
      return `
        <rect x="${cardX}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="${background}" stroke="${colors.gray300}" />
        <text x="${cardX + 14}" y="${y + 22}" font-size="11" font-weight="700" fill="${foreground}">${escapeXml(card.title)}</text>
        <text x="${cardX + 14}" y="${y + 42}" font-size="${valueSize}" font-weight="800" fill="${valueColor}">${escapeXml(card.value)}</text>
      `;
    })
    .join("");
}

function renderScreenSvg(spec: ScreenSpec, width: number, height: number) {
  const phoneWidth = Math.max(160, Math.min(width - 20, 252));
  const phoneX = Math.round((width - phoneWidth) / 2);
  const navY = height - 72;
  const cardWidth = phoneWidth - 28;
  const cardX = phoneX + 14;
  const headlineSize = width < 220 ? 14 : 18;
  const subtitleSize = width < 220 ? 8 : 10;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${colors.beige}" />
      <rect x="${phoneX}" y="8" width="${phoneWidth}" height="${height - 16}" rx="30" fill="${colors.beige}" stroke="rgba(74,63,53,0.10)" />
      <text x="${phoneX + 20}" y="25" font-size="9" font-weight="700" fill="${colors.gray900}">9:41</text>
      <circle cx="${phoneX + phoneWidth - 38}" cy="21" r="3" fill="${colors.gray900}" />
      <rect x="${phoneX + phoneWidth - 29}" y="17" width="16" height="7" rx="2" fill="${colors.gray900}" />
      <circle cx="${phoneX + 32}" cy="61" r="20" fill="${colors.peach}" />
      <text x="${phoneX + 22}" y="69" font-size="20" font-weight="800" fill="${colors.mainCoral}">W</text>
      <text x="${phoneX + 60}" y="60" font-size="${headlineSize}" font-weight="800" fill="${colors.brown}">${escapeXml(spec.headline)}</text>
      <text x="${phoneX + 60}" y="81" font-size="${subtitleSize}" fill="${colors.gray600}">${escapeXml(spec.subtitle)}</text>
      ${cardRows(spec, width, height, phoneX, phoneWidth)}
      <rect x="${cardX}" y="${navY}" width="${cardWidth}" height="54" rx="20" fill="${colors.white}" stroke="rgba(74,63,53,0.10)" />
      <text x="${cardX + 12}" y="${navY + 33}" font-size="9" fill="${colors.mainCoral}">Home</text>
      <text x="${cardX + 56}" y="${navY + 33}" font-size="9" fill="${colors.gray600}">Log</text>
      <circle cx="${cardX + cardWidth / 2}" cy="${navY + 26}" r="21" fill="${colors.mainCoral}" />
      <text x="${cardX + cardWidth / 2 - 6}" y="${navY + 34}" font-size="24" fill="${colors.white}">+</text>
      <text x="${cardX + cardWidth - 80}" y="${navY + 33}" font-size="9" fill="${colors.gray600}">Report</text>
      <text x="${cardX + cardWidth - 35}" y="${navY + 33}" font-size="9" fill="${colors.gray600}">More</text>
      <text x="${phoneX + 16}" y="${height - 22}" font-size="7" fill="${colors.gray600}">${escapeXml(spec.route)} / generated screenshot</text>
    </svg>
  `;
}

async function verifyReferenceCrops() {
  const cropMap = await readCropMap();
  const missing = cropMap.crops
    .map((crop) => crop.id)
    .filter((cropId) => !existsSync(cropPath(cropId)));
  if (missing.length > 0) {
    throw new Error(`Missing reference crop files: ${missing.join(", ")}`);
  }
  return cropMap;
}

async function runAnalyze() {
  const cropMap = await readCropMap();
  const report = [
    "# UI Pixel Lock Reference Crop Audit",
    "",
    `- Source resolution: ${cropMap.sourceResolution.width}x${cropMap.sourceResolution.height}`,
    `- Crop entries: ${cropMap.crops.length}`,
    `- Reference crops present: ${cropMap.crops.every((crop) => existsSync(cropPath(crop.id))) ? "yes" : "no"}`,
    "",
    "| Crop ID | Source | Size | Notes |",
    "| --- | --- | ---: | --- |",
    ...cropMap.crops.map((crop) => `| ${crop.id} | ${crop.source} | ${crop.width}x${crop.height} | ${crop.notes} |`)
  ].join("\n");
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "reference-crop-audit.md"), report, "utf8");
  console.log(`[ui:ref:analyze] audited ${cropMap.crops.length} crop entries`);
}

async function runCropCheck() {
  const cropMap = await readCropMap();
  await writeReferenceCrops(cropMap);
  await verifyReferenceCrops();
  console.log(`[ui:ref:crop] ${cropMap.crops.length} reference crop files generated`);
}

async function runScreenshots() {
  await ensureDirs();
  await verifyReferenceCrops();
  const liveScreenshotManifestEntries = await readLiveScreenshotManifest();
  const outputs: ScreenshotManifestEntry[] = [];

  for (const spec of screenSpecs) {
    const { width, height } = await getReferenceSize(spec.referenceCropId);
    const svg = renderScreenSvg(spec, width, height);
    const outputPath = join(screenshotDir, `${spec.id}.png`);
    const liveEntry = liveScreenshotManifestEntries.get(spec.id);
    const liveScreenshot = liveEntry?.filePath ?? join(liveScreenshotDir, `${spec.id}.png`);
    const liveScreenshotAvailable = existsSync(liveScreenshot);
    const liveMetadata = liveScreenshotAvailable ? await sharp(liveScreenshot).metadata() : undefined;
    await sharp(Buffer.from(svg)).png().toFile(outputPath);
    outputs.push({
      screenId: spec.id,
      screenshot: outputPath,
      referenceCropId: spec.referenceCropId,
      mode: "generated",
      liveScreenshot: liveScreenshotAvailable ? liveScreenshot : undefined,
      liveScreenshotAvailable,
      liveImageWidth: liveMetadata?.width,
      liveImageHeight: liveMetadata?.height,
      liveRequestedUrl: liveEntry?.requestedUrl,
      liveCaptureMode: liveMetadata?.width && liveMetadata.height ? `image-${liveMetadata.width}x${liveMetadata.height}` : liveEntry?.captureMode
    });
  }

  await writeFile(screenshotManifestPath, JSON.stringify(outputs, null, 2), "utf8");
  const liveCount = outputs.filter((output) => output.liveScreenshotAvailable).length;
  console.log(`[ui:screenshot] wrote ${outputs.length} generated app screenshots to ${screenshotDir}; live screenshots available ${liveCount}/${outputs.length}`);
}

async function rawRgba(path: string, width: number, height: number) {
  return sharp(path).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
}

async function trailingBlankCropHeight(path: string, width: number, height: number) {
  const raw = await sharp(path).ensureAlpha().raw().toBuffer();
  const bottomRow = height - 1;
  let backgroundRed = 0;
  let backgroundGreen = 0;
  let backgroundBlue = 0;

  for (let x = 0; x < width; x += 1) {
    const offset = (bottomRow * width + x) * 4;
    backgroundRed += raw[offset];
    backgroundGreen += raw[offset + 1];
    backgroundBlue += raw[offset + 2];
  }

  backgroundRed /= width;
  backgroundGreen /= width;
  backgroundBlue /= width;

  for (let y = height - 1; y >= 0; y -= 1) {
    let nonBackgroundPixels = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const delta =
        Math.abs(raw[offset] - backgroundRed) +
        Math.abs(raw[offset + 1] - backgroundGreen) +
        Math.abs(raw[offset + 2] - backgroundBlue);
      if (delta > 12) {
        nonBackgroundPixels += 1;
      }
    }

    if (nonBackgroundPixels / width > 0.01) {
      return y + 1;
    }
  }

  return height;
}

export async function normalizeLiveScreenshotForReference(screenshotPath: string, referencePath: string) {
  const referenceMetadata = await sharp(referencePath).metadata();
  const screenshotMetadata = await sharp(screenshotPath).metadata();
  if (!referenceMetadata.width || !referenceMetadata.height || !screenshotMetadata.width || !screenshotMetadata.height) {
    throw new Error(`Cannot normalize screenshot without dimensions: ${screenshotPath}`);
  }

  const detectedContentHeight = await trailingBlankCropHeight(screenshotPath, screenshotMetadata.width, screenshotMetadata.height);
  const bottomMargin = Math.round(Math.min(48, Math.max(24, screenshotMetadata.height * 0.04)));
  const cropHeight =
    detectedContentHeight < screenshotMetadata.height * 0.9
      ? Math.min(screenshotMetadata.height, detectedContentHeight + bottomMargin)
      : screenshotMetadata.height;

  return sharp(screenshotPath)
    .extract({ left: 0, top: 0, width: screenshotMetadata.width, height: cropHeight })
    .resize(referenceMetadata.width, referenceMetadata.height, { fit: "fill" })
    .png()
    .toBuffer();
}

export async function containLiveScreenshotForReference(screenshotPath: string, referencePath: string) {
  const referenceMetadata = await sharp(referencePath).metadata();
  if (!referenceMetadata.width || !referenceMetadata.height) {
    throw new Error(`Cannot contain screenshot without reference dimensions: ${referencePath}`);
  }

  return sharp(screenshotPath)
    .resize(referenceMetadata.width, referenceMetadata.height, { fit: "contain", background: colors.beige })
    .png()
    .toBuffer();
}

async function validateLiveScreenshotSize(path: string, screenId: string) {
  const metadata = await sharp(path).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`LIVE_SCREENSHOT_DIMENSION_MISMATCH ${screenId}: missing screenshot dimensions`);
  }
  if (metadata.width > maxLiveScreenshotWidth) {
    throw new Error(
      `LIVE_SCREENSHOT_DIMENSION_MISMATCH ${screenId}: expected mobile-width screenshot <= ${maxLiveScreenshotWidth}px, got ${metadata.width}x${metadata.height}`
    );
  }
}

async function runDiffs() {
  await ensureDirs();
  await verifyReferenceCrops();
  const liveScreenshotManifestEntries = existsSync(liveScreenshotManifestPath) ? await readLiveScreenshotManifest() : new Map<string, LiveScreenshotManifestEntry>();
  const results: DiffResult[] = [];

  for (const spec of screenSpecs) {
    const referencePath = cropPath(spec.referenceCropId);
    const liveEntry = liveScreenshotManifestEntries.get(spec.id);
    const manifestLiveScreenshotPath = liveEntry?.filePath;
    const defaultLiveScreenshotPath = join(liveScreenshotDir, `${spec.id}.png`);
    const liveScreenshotPath =
      manifestLiveScreenshotPath && existsSync(manifestLiveScreenshotPath) ? manifestLiveScreenshotPath : defaultLiveScreenshotPath;
    const generatedScreenshotPath = join(screenshotDir, `${spec.id}.png`);
    const screenshotPath = existsSync(liveScreenshotPath) ? liveScreenshotPath : generatedScreenshotPath;
    const screenshotMode = existsSync(liveScreenshotPath) ? "live-browser" : "generated";
    if (!existsSync(screenshotPath)) {
      throw new Error(`Missing app screenshot for ${spec.id}; run pnpm ui:screenshot first.`);
    }
    if (screenshotMode === "live-browser") {
      await validateLiveScreenshotSize(screenshotPath, spec.id);
    }

    const { width, height } = await getReferenceSize(spec.referenceCropId);
    const referenceRaw = await rawRgba(referencePath, width, height);
    const normalizedScreenshotPng =
      screenshotMode === "live-browser" && spec.normalizeLiveScreenshot
        ? await normalizeLiveScreenshotForReference(screenshotPath, referencePath)
        : screenshotMode === "live-browser" && spec.preserveLiveScreenshotAspect
          ? await containLiveScreenshotForReference(screenshotPath, referencePath)
        : await sharp(screenshotPath).resize(width, height, { fit: "fill" }).png().toBuffer();
    const screenshotRaw = await sharp(normalizedScreenshotPng).ensureAlpha().raw().toBuffer();
    const diffRaw = Buffer.alloc(width * height * 4);
    let mismatchedPixels = 0;

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const delta =
        Math.abs(referenceRaw[offset] - screenshotRaw[offset]) +
        Math.abs(referenceRaw[offset + 1] - screenshotRaw[offset + 1]) +
        Math.abs(referenceRaw[offset + 2] - screenshotRaw[offset + 2]);

      if (delta > 95) {
        mismatchedPixels += 1;
        diffRaw[offset] = 255;
        diffRaw[offset + 1] = 82;
        diffRaw[offset + 2] = 70;
        diffRaw[offset + 3] = 220;
      } else {
        diffRaw[offset] = screenshotRaw[offset];
        diffRaw[offset + 1] = screenshotRaw[offset + 1];
        diffRaw[offset + 2] = screenshotRaw[offset + 2];
        diffRaw[offset + 3] = 80;
      }
    }

    const pixelMismatchRatio = mismatchedPixels / (width * height);
    const diffPng = await sharp(diffRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const referencePng = await sharp(referencePath).resize(width, height, { fit: "fill" }).png().toBuffer();
    const gap = 16;
    const labelHeight = 36;
    const diffOutputPath = join(diffDir, `${spec.id}.png`);
    const labelSvg = Buffer.from(`
      <svg width="${width * 3 + gap * 2}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${colors.beige}" />
        <text x="8" y="24" font-size="16" font-weight="700" fill="${colors.brown}">Reference</text>
        <text x="${width + gap + 8}" y="24" font-size="16" font-weight="700" fill="${colors.brown}">App screenshot (${screenshotMode})</text>
        <text x="${(width + gap) * 2 + 8}" y="24" font-size="16" font-weight="700" fill="${colors.brown}">Diff ${pixelMismatchRatio.toFixed(3)}</text>
      </svg>
    `);

    await sharp({
      create: {
        width: width * 3 + gap * 2,
        height: height + labelHeight,
        channels: 4,
        background: colors.beige
      }
    })
      .composite([
        { input: labelSvg, left: 0, top: 0 },
        { input: referencePng, left: 0, top: labelHeight },
        { input: normalizedScreenshotPng, left: width + gap, top: labelHeight },
        { input: diffPng, left: (width + gap) * 2, top: labelHeight }
      ])
      .png()
      .toFile(diffOutputPath);

    results.push({
      screenId: spec.id,
      label: spec.label,
      reference: referencePath,
      screenshot: screenshotPath,
      screenshotMode,
      diff: diffOutputPath,
      width,
      height,
      pixelMismatchRatio,
      status: pixelMismatchRatio <= maxVisualMismatchRatio ? "PASS" : "VISUAL QA NOT PROVEN",
      remainingMismatch:
        pixelMismatchRatio <= maxVisualMismatchRatio
          ? "Live browser screenshot is within the strict pixel-lock threshold."
          : screenshotMode === "live-browser"
          ? "Live browser screenshot still differs from reference crop; visual iteration required."
          : "Generated renderer only; live Expo/device screenshot comparison still required."
    });
  }

  await writeFile(resultPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`[ui:visual-diff] wrote ${results.length} diff artifacts to ${diffDir}`);
  return results;
}

async function readResults() {
  if (!existsSync(resultPath)) {
    return runDiffs();
  }
  return JSON.parse(await readFile(resultPath, "utf8")) as DiffResult[];
}

function liveProofLabel(result: DiffResult, captureProofByScreen: Map<string, ScreenshotManifestEntry>) {
  const proof = captureProofByScreen.get(result.screenId);
  if (!proof?.liveScreenshotAvailable) {
    return "missing-live-proof";
  }

  const dimensions =
    proof.liveImageWidth && proof.liveImageHeight ? `${proof.liveImageWidth}x${proof.liveImageHeight}` : "dimensions-missing";
  const captureMode = proof.liveCaptureMode ?? `image-${dimensions}`;
  const url = proof.liveRequestedUrl ?? "url-missing";
  return `${captureMode}; ${dimensions}; ${url}`;
}

function markdownTable(results: DiffResult[], captureProofByScreen = new Map<string, ScreenshotManifestEntry>()) {
  return [
    "| Screen | Reference | Screenshot | Live proof | Diff | Iterations | Status | Remaining mismatch |",
    "|---|---|---|---|---|---:|---|---|",
    ...results.map((result) => {
      const reference = basename(result.reference);
      const screenshot = basename(result.screenshot);
      const diff = basename(result.diff);
      const liveProof = liveProofLabel(result, captureProofByScreen);
      return `| ${result.label} | ${reference} | ${screenshot} (${result.screenshotMode}) | ${liveProof} | ${diff} | 1 | ${result.status} | ${result.remainingMismatch} pixelMismatchRatio=${result.pixelMismatchRatio.toFixed(4)} |`;
    })
  ].join("\n");
}

function mismatchLog(results: DiffResult[], captureProofByScreen = new Map<string, ScreenshotManifestEntry>()) {
  const liveCount = results.filter((result) => result.screenshotMode === "live-browser").length;
  return [
    "# UI Pixel Lock Mismatch Log",
    "",
    "- Status: VISUAL QA NOT PROVEN",
    `- Live browser screenshots compared: ${liveCount}/${results.length}`,
    "- Reason: current diff artifacts still show material visual mismatch against the locked reference crops.",
    "",
    markdownTable(results, captureProofByScreen),
    "",
    "## Required next loop",
    "- Capture live rendered Expo screenshots for each target route.",
    "- Replace generated screenshots in docs/ui-pixel-lock/app-screenshots.",
    "- Rerun pnpm ui:visual-diff and close critical/high mismatches."
  ].join("\n");
}

async function runReport() {
  await ensureDirs();
  const results = await readResults();
  const captureProofByScreen = await readScreenshotManifest();
  const nativeProofStatus = readNativeProofStatus();
  const evaluation = evaluatePixelLockStatus(results, { nativeProofStatus });
  const liveCount = results.filter((result) => result.screenshotMode === "live-browser").length;
  const mismatchLabel = liveCount === results.length ? "live" : "generated/live";
  const remainingNativeIssue =
    nativeProofStatus === "missing"
      ? "- Critical: native iOS/Android device screenshot capture has not been proven; current proof is live Expo web only."
      : "- Native proof: Android native screenshot proof is captured or a native proof waiver exists.";
  const finalJudgment = (() => {
    if (evaluation.finalStatus === "PASS") {
      return "PASS is allowed because runtime proof, native proof, and pixel thresholds are all satisfied.";
    }
    if (nativeProofStatus === "missing" && evaluation.hasMaterialVisualMismatch) {
      return "Do not say PASS. VISUAL QA NOT PROVEN until native screenshot proof is captured or waived and all critical/high mismatches are closed.";
    }
    if (nativeProofStatus === "missing") {
      return "Do not say PASS. VISUAL QA NOT PROVEN until native screenshot proof is captured or waived.";
    }
    if (evaluation.hasMaterialVisualMismatch) {
      return "Do not say PASS. VISUAL QA NOT PROVEN until all critical/high visual mismatches are closed.";
    }
    return "Do not say PASS. VISUAL QA NOT PROVEN until generated screenshot fallbacks and remaining proof gaps are closed.";
  })();
  const summary = [
    "# UI Pixel Lock Final Report",
    "",
    "## Summary",
    `- Status: ${evaluation.finalStatus}`,
    "- Reference images checked: yes",
    `- Screens implemented: ${results.map((result) => result.label).join(", ")}`,
    "- Buttons connected: partially; source-level route/action contracts are covered by mobile tests.",
    "- Animation implemented: yes; generated source route and extracted stage assets exist.",
    `- Visual QA completed: ${evaluation.visualQaCompleted ? "yes" : "no"}`,
    `- Native screenshot proof: ${nativeProofStatus}`,
    `- Runtime screenshot proof: ${liveCount}/${results.length} live browser screenshots captured; dimensions are listed in the Live proof column`,
    `- Generated screenshot fallback count: ${evaluation.generatedFallbackCount}`,
    `- Visual mismatch threshold: ${evaluation.visualMismatchThreshold.toFixed(4)}`,
    `- Worst ${mismatchLabel} pixelMismatchRatio: ${evaluation.worstMismatch.toFixed(4)}`,
    "",
    "## Screen-by-screen Result",
    markdownTable(results, captureProofByScreen),
    "",
    "## Commands Run",
    "- pnpm ui:screenshot",
    "- pnpm ui:visual-diff",
    "- pnpm ui:visual-report",
    "",
    "## Remaining Issues",
    remainingNativeIssue,
    evaluation.hasMaterialVisualMismatch
      ? "- High: live screenshots still differ materially from the image crops; continue visual iteration before any PASS claim."
      : "- High: no screen exceeds the strict pixel mismatch threshold.",
    "- Medium: family, Excel preview, onboarding, and settings should get the same depth of pixel tuning as home/items/report.",
    "- Low: crop coordinates can be tightened after the first live screenshots.",
    "",
    "## Final Judgment",
    finalJudgment
  ].join("\n");

  await writeFile(finalReportPath, summary, "utf8");
  await writeFile(visualQaReportPath, summary.replace("# UI Pixel Lock Final Report", "# UI Pixel Lock Visual QA Report"), "utf8");
  await writeFile(mismatchLogPath, mismatchLog(results, captureProofByScreen), "utf8");
  console.log(`[ui:visual-report] wrote ${finalReportPath}`);
  return evaluation;
}

async function runAll() {
  await runAnalyze();
  await runCropCheck();
  await runScreenshots();
  await runDiffs();
  const evaluation = await runReport();
  console.log(`[ui:pixel-lock] status=${evaluation.finalStatus} reason=${evaluation.visualQaCompleted ? "VISUAL_QA_COMPLETE" : "VISUAL_QA_NOT_PROVEN"}`);
}

async function main() {
  const command = process.argv[2] ?? "all";
  if (command === "analyze") return runAnalyze();
  if (command === "crop") return runCropCheck();
  if (command === "screenshot") return runScreenshots();
  if (command === "diff") return runDiffs();
  if (command === "report") return runReport();
  if (command === "all") return runAll();
  throw new Error(`Unknown ui-pixel-lock command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
