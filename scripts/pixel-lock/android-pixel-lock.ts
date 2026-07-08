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
  screenshot: string;
  diff: string;
  heatmap: string;
  zones?: Record<string, number>;
  error?: string;
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
const cropPolicy = process.env.PIXEL_ANDROID_CROP
  ? `shared-device-crop:${process.env.PIXEL_ANDROID_CROP}`
  : "full-adb-screencap-resized-to-reference";

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

function run(command: string, args: string[], options: { binary?: boolean; allowFailure?: boolean } = {}) {
  const result = spawnSync(command, args, {
    encoding: options.binary ? "buffer" : "utf8",
    maxBuffer: 1024 * 1024 * 32
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

function openScreen(screenId: string, screens = readScreens()) {
  const screen = screens[screenId];
  if (!screen) throw new Error(`UNKNOWN_SCREEN ${screenId}`);
  const packageName = discoverPackageName();
  if (!packageName) throw new Error("PACKAGE_NOT_FOUND");
  if (!hasDevice()) throw new Error("ADB_DEVICE_NOT_FOUND");

  const result = adb(
    ["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", screen.route, packageName],
    { allowFailure: true }
  );
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
  const result = adb(["exec-out", "screencap", "-p"], { binary: true });
  const buffer = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || "");
  writeFileSync(outputPath, buffer);
  return outputPath;
}

function parseCrop() {
  const raw = process.env.PIXEL_ANDROID_CROP;
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("PIXEL_ANDROID_CROP must be x,y,width,height");
  }
  return { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
}

async function normalizedScreenshotBuffer(screenshotPath: string, referencePath: string) {
  const reference = await sharp(referencePath).metadata();
  if (!reference.width || !reference.height) throw new Error(`BAD_REFERENCE ${referencePath}`);
  let image = sharp(screenshotPath);
  const crop = parseCrop();
  if (crop) image = image.extract(crop);
  return image.resize(reference.width, reference.height, { fit: "fill" }).png().toBuffer();
}

function zoneForY(y: number, height: number) {
  const ratio = y / height;
  if (ratio < 0.15) return "top/status/header";
  if (ratio < 0.38) return "hero/main-card";
  if (ratio < 0.72) return "content/list/cards";
  if (ratio < 0.88) return "bottom-cta";
  return "bottom-tab/footer";
}

async function diffScreen(screenId: string, screens = readScreens()): Promise<ScreenResult> {
  const screen = screens[screenId];
  if (!screen) throw new Error(`UNKNOWN_SCREEN ${screenId}`);
  const screenshotPath = join(screenshotDir, `${screenId}.png`);
  const referencePath = resolve(repoRoot, screen.referenceImagePath);
  const diffPath = join(diffDir, `${screenId}.png`);
  const heatmapPath = join(heatmapDir, `${screenId}.png`);
  if (!existsSync(screenshotPath)) throw new Error(`SCREENSHOT_MISSING ${screenshotPath}`);
  if (!existsSync(referencePath)) throw new Error(`REFERENCE_MISSING ${referencePath}`);

  const referenceMeta = await sharp(referencePath).metadata();
  if (!referenceMeta.width || !referenceMeta.height) throw new Error(`BAD_REFERENCE ${referencePath}`);
  const width = referenceMeta.width;
  const height = referenceMeta.height;
  const referenceRaw = await sharp(referencePath).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const screenshotPng = await normalizedScreenshotBuffer(screenshotPath, referencePath);
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
    screenshot: screenshotPath,
    diff: diffPath,
    heatmap: heatmapPath,
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
    "| Screen | Score | Pass | Top zones |",
    "| --- | ---: | --- | --- |",
    ...results.map((result) => {
      const zones = result.zones
        ? Object.entries(result.zones)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([zone, score]) => `${zone}:${score.toFixed(4)}`)
            .join(", ")
        : result.error || "";
      return `| ${result.screenId} ${result.name} | ${result.score.toFixed(4)} | ${result.pass ? "PASS" : "FAIL"} | ${zones} |`;
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

  for (const targetId of targetIds) {
    const currentHash = sourceHash(targetId);
    const screenshotPath = join(screenshotDir, `${targetId}.png`);
    const canSkipCapture = !force && existsSync(screenshotPath) && cache[targetId] === currentHash;
    if (!canSkipCapture) {
      openScreen(targetId, screens);
      const waitMs = Number(process.env.PIXEL_ANDROID_WAIT_MS || 700);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
      captureScreen(targetId);
      cache[targetId] = currentHash;
    }
    results.push(await diffScreen(targetId, screens));
  }

  writeCache(cache);
  writeReports(device, results, results.every((result) => result.pass) ? "PASS" : "FAIL");
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
      const result = await diffScreen(screenId);
      writeReports(deviceInfo(discoverPackageName()), [result], result.pass ? "PASS" : "FAIL");
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
