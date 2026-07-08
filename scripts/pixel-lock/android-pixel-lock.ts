import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";

type ScreenConfig = {
  name: string;
  referenceImagePath: string;
  route: string;
  expectedState: string;
  androidNormalization?: "fill" | "tailCropFill" | "containAspect";
  siblings: string[];
  moreSettingsGuardRequired: boolean;
};

type DeviceInfo = {
  model: string;
  androidVersion: string;
  resolution: string;
  density: string;
  packageName: string;
};

type ScreenResult = {
  screenId: string;
  name: string;
  score: number;
  pass: boolean;
  status: "PASS" | "FAIL" | "INVALID" | "BLOCKED";
  renderValid: boolean;
  screenshot: string;
  diff: string;
  heatmap: string;
  zones?: Record<string, number>;
  render?: RenderValidation;
  error?: string;
};

type RenderValidation = {
  renderValid: boolean;
  invalidReasons: string[];
  whitePixelRatio: number;
  uniqueColorCount: number;
  nonBackgroundAreaRatio: number;
  sentinelsExpected: string[];
  sentinelsFound: string[];
  uiautomatorXml: string;
  logcatPath: string;
  logcatErrors: string[];
};

const repoRoot = process.cwd();
const threshold = 0.05;
const configPath = join(repoRoot, "scripts", "pixel-lock", "pixel-lock-screens.json");
const androidRoot = join(repoRoot, "artifacts", "pixel-lock", "android");
const screenshotDir = join(androidRoot, "screenshots");
const diffDir = join(androidRoot, "diffs");
const heatmapDir = join(androidRoot, "heatmaps");
const logDir = join(androidRoot, "logs");
const reportDir = join(androidRoot, "reports");
const latestJsonPath = join(reportDir, "latest.json");
const latestMdPath = join(reportDir, "latest.md");
const cachePath = join(reportDir, "cache.json");
const normalizationBackground = "#FFF7ED";
const cropPolicy = process.env.PIXEL_ANDROID_CROP
  ? `shared-device-crop:${process.env.PIXEL_ANDROID_CROP}`
  : "shared-device-content-area:exclude-status-and-navigation-bars";
const sentinelText: Record<string, string[]> = {
  "SPL-001": ["pixel-screen-SPL-001", "SPL-001", "우리아이"],
  "HOME-001": ["pixel-screen-HOME-001", "HOME-001", "우리아이", "뽀미", "3,482,000원", "+ 지출 기록하기"],
  "EXP-001": ["pixel-screen-EXP-001", "EXP-001", "지출", "기록"],
  "ITEM-001": ["pixel-screen-ITEM-001", "ITEM-001", "추천", "우리아이"],
  "ITEM-002": ["pixel-screen-ITEM-002", "ITEM-002", "제휴", "구매"],
  "REP-001": ["pixel-screen-REP-001", "REP-001", "리포트"],
  "FAM-001": ["pixel-screen-FAM-001", "FAM-001", "가족", "초대"],
  "IMP-003": ["pixel-screen-IMP-003", "IMP-003", "미리보기", "저장"],
  "SET-001": ["pixel-screen-SET-001", "SET-001", "설정", "개인정보", "제휴 고지", "데이터 삭제"]
};
const asciiSentinelText: Record<string, string[]> = {
  "SPL-001": ["pixel-screen-SPL-001", "SPL-001"],
  "HOME-001": ["pixel-screen-HOME-001", "HOME-001"],
  "EXP-001": ["pixel-screen-EXP-001", "EXP-001"],
  "ITEM-001": ["pixel-screen-ITEM-001", "ITEM-001"],
  "ITEM-002": ["pixel-screen-ITEM-002", "ITEM-002"],
  "REP-001": ["pixel-screen-REP-001", "REP-001"],
  "FAM-001": ["pixel-screen-FAM-001", "FAM-001"],
  "IMP-003": ["pixel-screen-IMP-003", "IMP-003"],
  "SET-001": ["pixel-screen-SET-001", "SET-001"]
};

const logcatErrorPattern =
  /Unable to load script|Failed to connect to development server|Exception in native call|ReactNativeJS.*(?:Error|Invariant|TypeError|ReferenceError|Unable to resolve|Cannot read|undefined is not|No routes found)|JavascriptException|FATAL EXCEPTION|Invariant Violation|Unable to resolve module|Failed to construct transformer|Metro.*(?:404|500)|BUNDLE.*ERROR|RedBox|Could not get BatchedBridge/i;

function ensureDirs() {
  for (const dir of [screenshotDir, diffDir, heatmapDir, logDir, reportDir]) {
    mkdirSync(dir, { recursive: true });
  }
}

function readScreens() {
  return JSON.parse(readFileSync(configPath, "utf8")) as Record<string, ScreenConfig>;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        index += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { args, positional };
}

function run(command: string, args: string[], options: { binary?: boolean; allowFailure?: boolean; timeoutMs?: number } = {}) {
  const result = spawnSync(command, args, {
    encoding: options.binary ? "buffer" : "utf8",
    maxBuffer: 1024 * 1024 * 32,
    timeout: options.timeoutMs ?? 60_000
  });
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new Error(`${command} ${args.join(" ")} failed: ${stderr || result.status}`);
  }
  return result;
}

function commandExists(command: string) {
  const where = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(where, [command], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : "";
}

function findAdb() {
  const candidates = [
    process.env.ADB_PATH,
    commandExists("adb"),
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb.exe") : "",
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe") : "",
    join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),
    "C:\\Users\\nj970\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"
  ].filter(Boolean) as string[];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("ADB_NOT_FOUND: set ADB_PATH or install Android SDK platform-tools.");
  return found;
}

function adb(args: string[], options: { binary?: boolean; allowFailure?: boolean } = {}) {
  return run(findAdb(), args, options);
}

function adbText(args: string[], allowFailure = false) {
  const result = adb(args, { allowFailure });
  return String(result.stdout || "").trim();
}

function hasDevice() {
  const output = adbText(["devices"], true);
  return output.split(/\r?\n/).some((line) => /\tdevice$/.test(line));
}

function readPackageFromAppJson() {
  const appJsonPath = join(repoRoot, "apps", "mobile", "app.json");
  if (!existsSync(appJsonPath)) return "";
  const app = JSON.parse(readFileSync(appJsonPath, "utf8"));
  return app?.expo?.android?.package || "";
}

function discoverPackageName() {
  const fromAppJson = readPackageFromAppJson();
  if (fromAppJson) return fromAppJson;

  const gradlePath = join(repoRoot, "apps", "mobile", "android", "app", "build.gradle");
  if (existsSync(gradlePath)) {
    const gradle = readFileSync(gradlePath, "utf8");
    const match = gradle.match(/applicationId\s+['"]([^'"]+)['"]/);
    if (match) return match[1];
  }

  if (hasDevice()) {
    const packages = adbText(["shell", "pm", "list", "packages"], true);
    const match = packages.match(/package:(.*wooriai.*)/);
    if (match) return match[1].trim();
  }

  return "";
}

function deviceInfo(packageName: string): DeviceInfo {
  if (!hasDevice()) {
    return { model: "", androidVersion: "", resolution: "", density: "", packageName };
  }
  return {
    model: adbText(["shell", "getprop", "ro.product.model"], true),
    androidVersion: adbText(["shell", "getprop", "ro.build.version.release"], true),
    resolution: adbText(["shell", "wm", "size"], true).replace("Physical size: ", ""),
    density: adbText(["shell", "wm", "density"], true).replace("Physical density: ", ""),
    packageName
  };
}

function sourceHash(screenId: string) {
  const hash = createHash("sha256");
  for (const relativePath of [
    "package.json",
    "scripts/pixel-lock/pixel-lock-screens.json",
    "apps/mobile/app",
    "apps/mobile/src",
    "apps/mobile/assets"
  ]) {
    const absolute = join(repoRoot, relativePath);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isFile()) hash.update(readFileSync(absolute));
    else {
      const entries = readdirSync(absolute, { recursive: true }) as string[];
      const files = entries
        .map((file: string) => join(absolute, file))
        .filter((file: string) => statSync(file).isFile())
        .sort();
      for (const file of files) {
        hash.update(file);
        hash.update(readFileSync(file));
      }
    }
  }
  hash.update(screenId);
  return hash.digest("hex");
}

function readCache() {
  if (!existsSync(cachePath)) return {};
  return JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, string>;
}

function writeCache(cache: Record<string, string>) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

function openScreen(screenId: string, screens = readScreens(), options: { coldStart?: boolean } = {}) {
  const screen = screens[screenId];
  if (!screen) throw new Error(`UNKNOWN_SCREEN ${screenId}`);
  const packageName = discoverPackageName();
  if (!packageName) throw new Error("PACKAGE_NOT_FOUND");
  if (!hasDevice()) throw new Error("ADB_DEVICE_NOT_FOUND");

  if (options.coldStart) {
    adb(["shell", "am", "force-stop", packageName], { allowFailure: true });
  }
  const route = process.env.PIXEL_ANDROID_OVERRIDES
    ? `${screen.route}${screen.route.includes("?") ? "&" : "?"}overrides=${encodeURIComponent(process.env.PIXEL_ANDROID_OVERRIDES)}`
    : screen.route;
  const shellRoute = `'${route.replace(/'/g, "'\\''")}'`;
  const result = adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", shellRoute, packageName], { allowFailure: true });
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  if (result.status !== 0 || /Error|Exception/i.test(stdout + stderr)) {
    adb(["shell", "monkey", "-p", packageName, "1"], { allowFailure: true });
    throw new Error(`OPEN_SCREEN_FAILED ${screenId}: ${stdout}\n${stderr}`);
  }
}

function captureScreen(screenId: string) {
  if (!hasDevice()) throw new Error("ADB_DEVICE_NOT_FOUND");
  const outputPath = join(screenshotDir, `${screenId}.png`);
  const remotePath = `/sdcard/wooriai-pixel-${screenId}.png`;
  adb(["shell", "screencap", "-p", remotePath]);
  adb(["pull", remotePath, outputPath]);
  adb(["shell", "rm", remotePath], { allowFailure: true });
  return outputPath;
}

async function captureStableScreen(screenId: string) {
  const outputPath = join(screenshotDir, `${screenId}.png`);
  const timeoutMs = Number(process.env.PIXEL_ANDROID_CAPTURE_READY_TIMEOUT_MS || 45_000);
  const intervalMs = Number(process.env.PIXEL_ANDROID_CAPTURE_READY_POLL_MS || 1_000);
  const startedAt = Date.now();

  while (true) {
    captureScreen(screenId);
    const metrics = await imageBlanknessMetrics(outputPath);
    if (!isLikelyBlankOrShell(metrics)) return outputPath;
    if (Date.now() - startedAt >= timeoutMs) return outputPath;
    sleepMs(intervalMs);
  }
}

function clearLogcat() {
  adb(["logcat", "-c"], { allowFailure: true });
}

function captureLogcat(screenId: string) {
  const logcatPath = join(logDir, `${screenId}-logcat.txt`);
  const result = adb(["logcat", "-d", "-t", "1200"], { allowFailure: true });
  const text = String(result.stdout || result.stderr || "");
  writeFileSync(logcatPath, text, "utf8");
  return { logcatPath, text };
}

function dumpWindowXmlText() {
  adb(["shell", "rm", "-f", "/sdcard/window.xml"], { allowFailure: true });
  adb(["shell", "uiautomator", "dump", "/sdcard/window.xml"], { allowFailure: true });
  const result = adb(["shell", "cat", "/sdcard/window.xml"], { allowFailure: true });
  const text = String(result.stdout || "");
  return text.includes("<hierarchy") ? text : "";
}

function dumpUiAutomator(screenId: string) {
  const xmlPath = join(logDir, `${screenId}-window.xml`);
  const expected = asciiSentinelText[screenId] ?? [`pixel-screen-${screenId}`, screenId];
  let text = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    text = dumpWindowXmlText();
    if (expected.some((sentinel) => text.includes(sentinel))) break;
    if (attempt < 4) sleepMs(500);
  }
  writeFileSync(xmlPath, text, "utf8");
  return { xmlPath, text };
}

function readWindowXml() {
  return dumpWindowXmlText();
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sleepMs(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForScreenReady(screenId: string) {
  const expected = asciiSentinelText[screenId] ?? [`pixel-screen-${screenId}`, screenId];
  const timeoutMs = Number(process.env.PIXEL_ANDROID_READY_TIMEOUT_MS || 90_000);
  const intervalMs = Number(process.env.PIXEL_ANDROID_READY_POLL_MS || 1_000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const xml = compactText(readWindowXml());
    if (expected.some((sentinel) => xml.includes(sentinel))) return true;
    sleepMs(intervalMs);
  }
  return false;
}

async function imageBlanknessMetrics(screenshotPath: string) {
  const image = sharp(screenshotPath).ensureAlpha();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`BAD_SCREENSHOT ${screenshotPath}`);
  const raw = await image.raw().toBuffer();
  const total = metadata.width * metadata.height;
  const colors = new Set<number>();
  const quantizedCounts = new Map<number, number>();
  let white = 0;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    const red = raw[offset];
    const green = raw[offset + 1];
    const blue = raw[offset + 2];
    if (red >= 245 && green >= 245 && blue >= 245) white += 1;
    colors.add((red << 16) | (green << 8) | blue);
    const quantized = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    quantizedCounts.set(quantized, (quantizedCounts.get(quantized) || 0) + 1);
  }

  const dominantCount = Math.max(...quantizedCounts.values());
  return {
    whitePixelRatio: Number((white / total).toFixed(6)),
    uniqueColorCount: colors.size,
    nonBackgroundAreaRatio: Number((1 - dominantCount / total).toFixed(6))
  };
}

function isLikelyBlankOrShell(metrics: { whitePixelRatio: number; uniqueColorCount: number; nonBackgroundAreaRatio: number }) {
  return (
    (metrics.whitePixelRatio > 0.82 &&
      metrics.uniqueColorCount < 2500 &&
      metrics.nonBackgroundAreaRatio < 0.2) ||
    (metrics.whitePixelRatio > 0.93 && metrics.nonBackgroundAreaRatio < 0.08) ||
    (metrics.uniqueColorCount < 500 && metrics.nonBackgroundAreaRatio < 0.04)
  );
}

async function validateRender(screenId: string, screenshotPath = join(screenshotDir, `${screenId}.png`)): Promise<RenderValidation> {
  const expected = asciiSentinelText[screenId] ?? [`pixel-screen-${screenId}`, screenId];
  const metrics = await imageBlanknessMetrics(screenshotPath);
  const { xmlPath, text: xmlText } = dumpUiAutomator(screenId);
  const { logcatPath, text: logcatText } = captureLogcat(screenId);
  const searchable = compactText(`${xmlText}\n${logcatText}`);
  const sentinelsFound = expected.filter((sentinel) => searchable.includes(sentinel));
  const logcatErrors = logcatText
    .split(/\r?\n/)
    .filter((line) => logcatErrorPattern.test(line))
    .slice(0, 20);
  const invalidReasons: string[] = [];
  const likelyBlank = isLikelyBlankOrShell(metrics);

  if (likelyBlank) {
    invalidReasons.push(
      `blank_or_shell white=${metrics.whitePixelRatio.toFixed(4)} unique=${metrics.uniqueColorCount} nonBg=${metrics.nonBackgroundAreaRatio.toFixed(4)}`
    );
  }
  if (sentinelsFound.length === 0) {
    invalidReasons.push(`missing_sentinel expected=${expected.join("|")}`);
  }
  if (logcatErrors.length > 0) {
    invalidReasons.push("logcat_js_or_bundle_error");
  }

  return {
    renderValid: invalidReasons.length === 0,
    invalidReasons,
    ...metrics,
    sentinelsExpected: expected,
    sentinelsFound,
    uiautomatorXml: xmlPath,
    logcatPath,
    logcatErrors
  };
}

function parseBounds(value: string) {
  const match = value.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!match) return null;
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4])
  };
}

function parseCrop(screenId?: string) {
  const raw = process.env.PIXEL_ANDROID_CROP;
  if (raw) {
    const parts = raw.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      throw new Error("PIXEL_ANDROID_CROP must be x,y,width,height");
    }
    return { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
  }
  if (!screenId) return null;
  const xmlPath = join(logDir, `${screenId}-window.xml`);
  if (!existsSync(xmlPath)) return null;
  const xml = readFileSync(xmlPath, "utf8");
  const statusMatch = xml.match(/<node[^>]+resource-id="android:id\/statusBarBackground"[^>]+>/);
  const navMatch = xml.match(/<node[^>]+resource-id="android:id\/navigationBarBackground"[^>]+>/);
  const statusBounds = statusMatch ? parseBounds(statusMatch[0]) : null;
  const navBounds = navMatch ? parseBounds(navMatch[0]) : null;
  if (!statusBounds || !navBounds) return null;
  return {
    left: 0,
    top: statusBounds.bottom,
    width: navBounds.right,
    height: navBounds.top - statusBounds.bottom
  };
}

async function trailingBlankCropHeight(input: Buffer) {
  const image = sharp(input).ensureAlpha();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("BAD_NORMALIZED_SCREENSHOT");
  const raw = await image.raw().toBuffer();
  const bottomRow = metadata.height - 1;
  let backgroundRed = 0;
  let backgroundGreen = 0;
  let backgroundBlue = 0;

  for (let x = 0; x < metadata.width; x += 1) {
    const offset = (bottomRow * metadata.width + x) * 4;
    backgroundRed += raw[offset];
    backgroundGreen += raw[offset + 1];
    backgroundBlue += raw[offset + 2];
  }

  backgroundRed /= metadata.width;
  backgroundGreen /= metadata.width;
  backgroundBlue /= metadata.width;

  for (let y = metadata.height - 1; y >= 0; y -= 1) {
    let nonBackgroundPixels = 0;
    for (let x = 0; x < metadata.width; x += 1) {
      const offset = (y * metadata.width + x) * 4;
      const delta =
        Math.abs(raw[offset] - backgroundRed) +
        Math.abs(raw[offset + 1] - backgroundGreen) +
        Math.abs(raw[offset + 2] - backgroundBlue);
      if (delta > 12) nonBackgroundPixels += 1;
    }

    if (nonBackgroundPixels / metadata.width > 0.01) return y + 1;
  }

  return metadata.height;
}

async function normalizedScreenshotBuffer(screenId: string, screenshotPath: string, referencePath: string, screen: ScreenConfig) {
  const reference = await sharp(referencePath).metadata();
  if (!reference.width || !reference.height) throw new Error(`BAD_REFERENCE ${referencePath}`);
  let image = sharp(screenshotPath);
  const crop = parseCrop(screenId);
  if (crop) image = image.extract(crop);
  const cropped = await image.png().toBuffer();
  const normalization = screen.androidNormalization ?? "fill";

  if (normalization === "containAspect") {
    return sharp(cropped)
      .resize(reference.width, reference.height, { fit: "contain", background: normalizationBackground })
      .png()
      .toBuffer();
  }

  if (normalization === "tailCropFill") {
    const metadata = await sharp(cropped).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`BAD_SCREENSHOT ${screenshotPath}`);
    const detectedContentHeight = await trailingBlankCropHeight(cropped);
    const bottomMargin = Math.round(Math.min(48, Math.max(24, metadata.height * 0.04)));
    const cropHeight =
      detectedContentHeight < metadata.height * 0.9
        ? Math.min(metadata.height, detectedContentHeight + bottomMargin)
        : metadata.height;

    return sharp(cropped)
      .extract({ left: 0, top: 0, width: metadata.width, height: cropHeight })
      .resize(reference.width, reference.height, { fit: "fill" })
      .png()
      .toBuffer();
  }

  return sharp(cropped).resize(reference.width, reference.height, { fit: "fill" }).png().toBuffer();
}

function zoneForY(y: number, height: number) {
  const ratio = y / height;
  if (ratio < 0.15) return "top/status/header";
  if (ratio < 0.38) return "hero/main-card";
  if (ratio < 0.72) return "content/list/cards";
  if (ratio < 0.88) return "bottom-cta";
  return "bottom-tab/footer";
}

async function diffScreen(screenId: string, screens = readScreens(), render?: RenderValidation): Promise<ScreenResult> {
  const screen = screens[screenId];
  if (!screen) throw new Error(`UNKNOWN_SCREEN ${screenId}`);
  const screenshotPath = join(screenshotDir, `${screenId}.png`);
  const referencePath = resolve(repoRoot, screen.referenceImagePath);
  const diffPath = join(diffDir, `${screenId}.png`);
  const heatmapPath = join(heatmapDir, `${screenId}.png`);
  if (!existsSync(screenshotPath)) throw new Error(`SCREENSHOT_MISSING ${screenshotPath}`);
  if (!existsSync(referencePath)) throw new Error(`REFERENCE_MISSING ${referencePath}`);

  if (render && !render.renderValid) {
    return {
      screenId,
      name: screen.name,
      score: 1,
      pass: false,
      status: "INVALID",
      renderValid: false,
      screenshot: screenshotPath,
      diff: diffPath,
      heatmap: heatmapPath,
      render,
      error: render.invalidReasons.join("; ")
    };
  }

  const referenceMeta = await sharp(referencePath).metadata();
  if (!referenceMeta.width || !referenceMeta.height) throw new Error(`BAD_REFERENCE ${referencePath}`);
  const width = referenceMeta.width;
  const height = referenceMeta.height;
  const referenceRaw = await sharp(referencePath).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const screenshotPng = await normalizedScreenshotBuffer(screenId, screenshotPath, referencePath, screen);
  const screenshotRaw = await sharp(screenshotPng).ensureAlpha().raw().toBuffer();
  const diffRaw = Buffer.alloc(width * height * 4);
  const heatRaw = Buffer.alloc(width * height * 4);
  const zoneTotals: Record<string, number> = {};
  const zoneBad: Record<string, number> = {};
  let bad = 0;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const y = Math.floor(index / width);
    const zone = zoneForY(y, height);
    zoneTotals[zone] = (zoneTotals[zone] || 0) + 1;
    const distance =
      Math.abs(referenceRaw[offset] - screenshotRaw[offset]) +
      Math.abs(referenceRaw[offset + 1] - screenshotRaw[offset + 1]) +
      Math.abs(referenceRaw[offset + 2] - screenshotRaw[offset + 2]);
    const mismatch = distance > 95;
    if (mismatch) {
      bad += 1;
      zoneBad[zone] = (zoneBad[zone] || 0) + 1;
      diffRaw[offset] = 255;
      diffRaw[offset + 1] = 93;
      diffRaw[offset + 2] = 74;
      diffRaw[offset + 3] = 255;
      heatRaw[offset] = 255;
      heatRaw[offset + 1] = 93;
      heatRaw[offset + 2] = 74;
      heatRaw[offset + 3] = 220;
    } else {
      diffRaw[offset] = screenshotRaw[offset];
      diffRaw[offset + 1] = screenshotRaw[offset + 1];
      diffRaw[offset + 2] = screenshotRaw[offset + 2];
      diffRaw[offset + 3] = 255;
      heatRaw[offset] = 255;
      heatRaw[offset + 1] = 247;
      heatRaw[offset + 2] = 237;
      heatRaw[offset + 3] = 255;
    }
  }

  await sharp(diffRaw, { raw: { width, height, channels: 4 } }).png().toFile(diffPath);
  await sharp(heatRaw, { raw: { width, height, channels: 4 } }).png().toFile(heatmapPath);

  const zones = Object.fromEntries(
    Object.keys(zoneTotals).map((zone) => [zone, Number(((zoneBad[zone] || 0) / zoneTotals[zone]).toFixed(6))])
  );
  const score = Number((bad / (width * height)).toFixed(6));
  return {
    screenId,
    name: screen.name,
    score,
    pass: score <= threshold,
    status: score <= threshold ? "PASS" : "FAIL",
    renderValid: render?.renderValid ?? true,
    screenshot: screenshotPath,
    diff: diffPath,
    heatmap: heatmapPath,
    render,
    zones
  };
}

function targetsFor(command: string, screenId?: string) {
  const screens = readScreens();
  if (command === "android" || command === "all") return Object.keys(screens);
  if (!screenId) throw new Error("SCREEN_REQUIRED");
  if (command === "guard") return Array.from(new Set([screenId, "SET-001"]));
  if (command === "screen") {
    const target = screens[screenId];
    const withGuard = target?.moreSettingsGuardRequired ? [screenId, "SET-001"] : [screenId];
    return Array.from(new Set(withGuard));
  }
  if (command === "validate-render") return [screenId];
  return [screenId];
}

function writeReports(device: DeviceInfo, results: ScreenResult[], status = "OK") {
  const report = {
    status,
    generatedAt: new Date().toISOString(),
    device,
    cropPolicy,
    threshold,
    screens: results
  };
  writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");
  const lines = [
    "# Android Pixel Lock Latest",
    "",
    `- Status: ${status}`,
    `- Package: ${device.packageName}`,
    `- Device: ${device.model || "(none)"} / Android ${device.androidVersion || "(unknown)"}`,
    `- Resolution: ${device.resolution || "(unknown)"}`,
    `- Density: ${device.density || "(unknown)"}`,
    `- Crop policy: ${cropPolicy}`,
    `- Threshold: ${threshold.toFixed(4)}`,
    "",
    "| Screen | Render | Score | Status | Evidence |",
    "| --- | --- | ---: | --- | --- |",
    ...results.map((result) => {
      const evidence = result.status === "INVALID"
        ? [
            result.error || "invalid render",
            result.render?.sentinelsFound.length ? `sentinel:${result.render.sentinelsFound.join(",")}` : "",
            result.render
              ? `white:${result.render.whitePixelRatio.toFixed(4)} unique:${result.render.uniqueColorCount} nonBg:${result.render.nonBackgroundAreaRatio.toFixed(4)}`
              : ""
          ]
            .filter(Boolean)
            .join("; ")
        : result.zones
        ? Object.entries(result.zones)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([zone, score]) => `${zone}:${score.toFixed(4)}`)
            .join(", ")
        : result.error || "";
      return `| ${result.screenId} ${result.name} | ${result.renderValid ? "valid" : "invalid"} | ${result.score.toFixed(4)} | ${result.status} | ${evidence} |`;
    })
  ];
  writeFileSync(latestMdPath, `${lines.join("\n")}\n`, "utf8");
}

function blockedTargetIds(command: string, screenId: string) {
  try {
    if (["screen", "guard", "capture", "open", "diff"].includes(command) && screenId) {
      return targetsFor(command === "capture" || command === "open" || command === "diff" ? "screen" : command, screenId);
    }
    return targetsFor(command, screenId || undefined);
  } catch {
    return Object.keys(readScreens());
  }
}

function blockedReport(error: unknown, targetIds?: string[]) {
  ensureDirs();
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(join(logDir, "latest-error.log"), `${new Date().toISOString()}\n${message}\n`, "utf8");
  const packageName = discoverPackageName();
  const device = deviceInfo(packageName);
  const screens = readScreens();
  const ids = targetIds && targetIds.length > 0 ? targetIds : Object.keys(screens);
  const results = ids.map((screenId) => ({
    screenId,
    name: screens[screenId]?.name ?? screenId,
    score: 1,
    pass: false,
    status: "BLOCKED" as const,
    renderValid: false,
    screenshot: join(screenshotDir, `${screenId}.png`),
    diff: join(diffDir, `${screenId}.png`),
    heatmap: join(heatmapDir, `${screenId}.png`),
    error: message
  }));
  writeReports(device, results, "BLOCKED");
}

async function runValidation(command: string, screenId?: string, force = false) {
  ensureDirs();
  const screens = readScreens();
  const packageName = discoverPackageName();
  const device = deviceInfo(packageName);
  const targetIds = targetsFor(command, screenId);
  const cache = readCache();
  const results: ScreenResult[] = [];

  for (const [index, targetId] of targetIds.entries()) {
    const currentHash = sourceHash(targetId);
    const screenshotPath = join(screenshotDir, `${targetId}.png`);
    const canSkipCapture = command !== "validate-render" && !force && existsSync(screenshotPath) && cache[targetId] === currentHash;
    if (!canSkipCapture) {
      clearLogcat();
      const coldStart =
        process.env.PIXEL_ANDROID_WARM_FIRST === "1"
          ? process.env.PIXEL_ANDROID_COLD_EACH === "1"
          : index === 0 || process.env.PIXEL_ANDROID_COLD_EACH === "1";
      openScreen(targetId, screens, { coldStart });
      const waitMs = Number(process.env.PIXEL_ANDROID_WAIT_MS || 700);
      sleepMs(waitMs);
      waitForScreenReady(targetId);
      const settleMs = Number(process.env.PIXEL_ANDROID_SETTLE_MS || 1500);
      if (settleMs > 0) sleepMs(settleMs);
      await captureStableScreen(targetId);
      cache[targetId] = currentHash;
    }
    const render = await validateRender(targetId, screenshotPath);
    results.push(await diffScreen(targetId, screens, render));
  }

  writeCache(cache);
  const status = results.some((result) => result.status === "INVALID")
    ? "INVALID"
    : results.every((result) => result.pass)
      ? "PASS"
      : "FAIL";
  writeReports(device, results, status);
  return results;
}

function printLatest() {
  ensureDirs();
  if (!existsSync(latestMdPath)) {
    writeReports(deviceInfo(discoverPackageName()), [], "NO_REPORT");
  }
  console.log(readFileSync(latestMdPath, "utf8"));
}

function writeTuneScaffold(screenId: string) {
  ensureDirs();
  const screens = readScreens();
  const screen = screens[screenId];
  if (!screen) throw new Error(`UNKNOWN_SCREEN ${screenId}`);
  const candidates = [
    { key: "topOffset", values: [-8, -6, -4, -2, 2, 4, 6, 8] },
    { key: "cardGap", values: [-8, -6, -4, -2, 2, 4, 6, 8] },
    { key: "cardHeight", values: [-12, -8, -4, 4, 8, 12] },
    { key: "ctaBottomInset", values: [-8, -6, -4, -2, 2, 4, 6, 8] }
  ];
  const output = {
    screenId,
    name: screen.name,
    strategy: "Apply one candidate through debug-only pixel style override, reload Metro/dev client, run target + SET guard.",
    candidates
  };
  const outputPath = join(reportDir, `tune-${screenId}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${outputPath}`);
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || "report";
  const screenId = String(args.screen || positional[1] || "");
  const force = Boolean(args.force);

  try {
    if (command === "open") {
      ensureDirs();
      openScreen(screenId);
      return;
    }
    if (command === "capture") {
      ensureDirs();
      if (screenId) openScreen(screenId);
      captureScreen(screenId);
      return;
    }
    if (command === "diff") {
      ensureDirs();
      const result = await diffScreen(screenId, readScreens(), await validateRender(screenId));
      writeReports(deviceInfo(discoverPackageName()), [result], result.status);
      printLatest();
      return;
    }
    if (command === "tune") {
      writeTuneScaffold(screenId);
      return;
    }
    if (command === "report") {
      printLatest();
      return;
    }
    const results = await runValidation(command, screenId, force);
    printLatest();
    if (results.some((result) => !result.pass)) process.exitCode = 1;
  } catch (error) {
    blockedReport(error, blockedTargetIds(command, screenId));
    printLatest();
    process.exitCode = 1;
  }
}

main();
