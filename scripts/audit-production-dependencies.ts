import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

type AuditAdvisory = {
  module_name: string;
  severity: string;
  github_advisory_id: string;
  vulnerable_versions: string;
  patched_versions: string;
  findings?: Array<{ version: string; paths: string[] }>;
};

type AuditResult = {
  advisories?: Record<string, AuditAdvisory>;
  metadata?: { vulnerabilities?: Record<string, number> };
};

const IMAGE_SIZE_ADVISORIES = new Set([
  "GHSA-5p2g-fcmc-qvqq",
  "GHSA-w3rx-r6r6-pgpr"
]);

function runPnpm(args: string[]) {
  const cli = process.env.npm_execpath;
  if (cli) {
    return spawnSync(process.execPath, [cli, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true
    });
  }

  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true
    });
  }

  return spawnSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function fail(message: string): never {
  console.error(`[security:audit] ${message}`);
  process.exit(1);
}

function verifyImageSizePatch() {
  const root = process.cwd();
  const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");
  const patch = readFileSync(resolve(root, "patches/image-size@1.2.1.patch"), "utf8");

  if (!workspace.includes("image-size@1.2.1: patches/image-size@1.2.1.patch")) {
    fail("image-size advisory is present but the audited pnpm patch is not registered");
  }
  if (!patch.includes("boxSize < 8 || input.length - offset < boxSize")) {
    fail("image-size box parser guard is missing from the registered patch");
  }
  if (!patch.includes("assertValidEntryLength(imageHeader[1])")) {
    fail("image-size ICNS entry-length guard is missing from the registered patch");
  }

  const require = createRequire(import.meta.url);
  const metroPackage = require.resolve("metro/package.json", { paths: [root] });
  const imageSizeEntry = require.resolve("image-size", { paths: [dirname(metroPackage)] });
  const packageRoot = resolve(dirname(imageSizeEntry), "..");
  const installedUtils = readFileSync(resolve(packageRoot, "dist/types/utils.js"), "utf8");
  const installedIcns = readFileSync(resolve(packageRoot, "dist/types/icns.js"), "utf8");

  if (!installedUtils.includes("boxSize < 8 || input.length - offset < boxSize")) {
    fail("installed image-size package does not contain the box-size security guard");
  }
  if (!installedIcns.includes("assertValidEntryLength(imageHeader[1])")) {
    fail("installed image-size package does not contain the ICNS security guard");
  }

  const payloads = [
    [
      0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70,
      0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x24, 0x6d, 0x65, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x08, 0x69, 0x70, 0x72, 0x70,
      0x00, 0x00, 0x00, 0x14, 0x69, 0x70, 0x63, 0x6f,
      0x00, 0x00, 0x00, 0x00, 0x69, 0x73, 0x70, 0x65,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ],
    [
      0x69, 0x63, 0x6e, 0x73,
      0x00, 0x00, 0x00, 0x10,
      0x69, 0x73, 0x33, 0x32,
      0x00, 0x00, 0x00, 0x00
    ]
  ];

  for (const payload of payloads) {
    const probe = spawnSync(
      process.execPath,
      [
        "-e",
        `const imageSize=require(${JSON.stringify(imageSizeEntry)});try{imageSize(Uint8Array.from(${JSON.stringify(payload)}))}catch{};process.stdout.write('completed')`
      ],
      { encoding: "utf8", timeout: 1500, windowsHide: true }
    );

    if (probe.error || probe.status !== 0 || probe.stdout !== "completed") {
      fail(`image-size denial-of-service regression probe did not complete: ${probe.error?.message ?? probe.stderr}`);
    }
  }
}

const auditProcess = runPnpm(["audit", "--prod", "--audit-level", "high", "--json"]);
if (auditProcess.error) {
  fail(`pnpm audit could not start: ${auditProcess.error.message}`);
}

let audit: AuditResult;
try {
  audit = JSON.parse(auditProcess.stdout) as AuditResult;
} catch {
  fail(`pnpm audit returned invalid JSON: ${auditProcess.stderr || auditProcess.stdout}`);
}

const advisories = Object.values(audit.advisories ?? {});
const blocking = advisories.filter((entry) => entry.severity === "high" || entry.severity === "critical");
const unmitigated = blocking.filter(
  (entry) => entry.module_name !== "image-size" || !IMAGE_SIZE_ADVISORIES.has(entry.github_advisory_id)
);

if (unmitigated.length > 0) {
  for (const entry of unmitigated) {
    console.error(
      `[security:audit] ${entry.severity} ${entry.module_name} ${entry.github_advisory_id} ` +
      `(affected ${entry.vulnerable_versions}; patched ${entry.patched_versions})`
    );
  }
  process.exit(1);
}

if (blocking.length > 0) {
  verifyImageSizePatch();
  console.log(
    "[security:audit] PASS with local patch: image-size upstream has no published fixed release; " +
    "both known infinite-loop PoCs terminate and all other high/critical advisories are absent"
  );
} else {
  console.log("[security:audit] PASS: no high or critical production advisories");
}

console.log(`[security:audit] registry summary ${JSON.stringify(audit.metadata?.vulnerabilities ?? {})}`);
