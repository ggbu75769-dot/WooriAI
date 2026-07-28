import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const evidenceIds = [
  "PAY-001",
  "PAY-002",
  "EXP-PAY-001",
  "PROFILE-GENDER-001",
  "ITEM-CATALOG-001",
  "ITEM-COVERAGE-001"
] as const;
const androidRoot = join(repoRoot, "artifacts", "pixel-lock", "android");
const screenshotDir = join(androidRoot, "screenshots", "sprint2-evidence");
const logDir = join(androidRoot, "logs", "sprint2-evidence");
const reportPath = join(androidRoot, "reports", "sprint2-evidence.json");

function run(command: string, args: string[], allowFailure = false) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 90_000 });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed: ${String(result.stderr || result.stdout)}`);
  }
  return result;
}

function commandPath(command: string): string {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  const result = run(finder, [command], true);
  return result.status === 0 ? String(result.stdout).trim().split(/\r?\n/)[0] : "";
}

function findAdb(): string {
  const candidates = [
    process.env.ADB_PATH,
    commandPath("adb"),
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb.exe") : "",
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe") : "",
    join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe"),
    "C:\\Users\\nj970\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"
  ].filter(Boolean) as string[];
  const adb = candidates.find((candidate) => existsSync(candidate));
  if (!adb) throw new Error("ADB_NOT_FOUND");
  return adb;
}

const adbPath = findAdb();

function adb(args: string[], allowFailure = false) {
  return run(adbPath, args, allowFailure);
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function packageName(): string {
  const app = JSON.parse(readFileSync(join(repoRoot, "apps", "mobile", "app.json"), "utf8"));
  const value = app?.expo?.android?.package;
  if (typeof value !== "string" || !value) throw new Error("PACKAGE_NOT_FOUND");
  return value;
}

function dumpUi(): string {
  adb(["shell", "rm", "-f", "/sdcard/wooriai-sprint2-window.xml"], true);
  adb(["shell", "uiautomator", "dump", "/sdcard/wooriai-sprint2-window.xml"], true);
  return String(adb(["shell", "cat", "/sdcard/wooriai-sprint2-window.xml"], true).stdout || "");
}

function waitForEvidence(evidenceId: string): string {
  const startedAt = Date.now();
  let xml = "";
  while (Date.now() - startedAt < 60_000) {
    xml = dumpUi();
    if (xml.includes(evidenceId)) return xml;
    sleep(750);
  }
  throw new Error(`${evidenceId}: UI sentinel not found`);
}

async function capture(evidenceId: string, appPackage: string) {
  adb(["logcat", "-c"], true);
  adb(["shell", "am", "force-stop", appPackage], true);
  const route = `'wooriai://pixel-lock?screen=${evidenceId}'`;
  adb(["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", route, appPackage]);
  const xml = waitForEvidence(evidenceId);
  sleep(1200);

  const remotePath = `/sdcard/wooriai-sprint2-${evidenceId}.png`;
  const screenshotPath = join(screenshotDir, `${evidenceId}.png`);
  adb(["shell", "screencap", "-p", remotePath]);
  adb(["pull", remotePath, screenshotPath]);
  adb(["shell", "rm", "-f", remotePath], true);

  const image = sharp(screenshotPath).ensureAlpha();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${evidenceId}: invalid PNG`);
  const statistics = await image.stats();
  const channelDeviation = Math.max(...statistics.channels.slice(0, 3).map((channel) => channel.stdev));
  if (channelDeviation < 5) throw new Error(`${evidenceId}: likely blank capture`);

  const xmlPath = join(logDir, `${evidenceId}-window.xml`);
  const logcatPath = join(logDir, `${evidenceId}-logcat.txt`);
  const logcat = String(adb(["logcat", "-d", "-t", "800"], true).stdout || "");
  writeFileSync(xmlPath, xml, "utf8");
  writeFileSync(logcatPath, logcat, "utf8");
  const fatalLines = logcat
    .split(/\r?\n/)
    .filter((line) => /Unable to load script|ReactNativeJS.*(?:Error|Exception)|FATAL EXCEPTION|JavascriptException/i.test(line));
  if (fatalLines.length) throw new Error(`${evidenceId}: React Native/logcat error: ${fatalLines[0]}`);

  return {
    evidenceId,
    status: "PASS",
    screenshot: screenshotPath,
    uiAutomator: xmlPath,
    logcat: logcatPath,
    width: metadata.width,
    height: metadata.height,
    channelDeviation: Number(channelDeviation.toFixed(3))
  };
}

async function main(): Promise<void> {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  mkdirSync(join(androidRoot, "reports"), { recursive: true });
  const devices = String(adb(["devices"], true).stdout || "");
  if (!devices.split(/\r?\n/).some((line) => /\tdevice$/.test(line))) throw new Error("ADB_DEVICE_NOT_FOUND");
  const appPackage = packageName();
  const results = [];
  for (const evidenceId of evidenceIds) {
    const result = await capture(evidenceId, appPackage);
    results.push(result);
    console.log(`[sprint2-evidence] ${evidenceId} PASS ${result.width}x${result.height}`);
  }
  const report = { generatedAt: new Date().toISOString(), packageName: appPackage, results };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[sprint2-evidence] report ${reportPath}`);
}

void main();
