import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const productionApkPath = resolve(
  repoRoot,
  process.env.RELEASE4_PRODUCTION_APK_PATH ?? "wooriai-0.0.0-release-production.apk"
);
const productionBundlePath = process.env.RELEASE4_PRODUCTION_BUNDLE_PATH
  ? resolve(repoRoot, process.env.RELEASE4_PRODUCTION_BUNDLE_PATH)
  : null;
const standaloneApkPath = resolve(
  repoRoot,
  process.env.RELEASE4_STANDALONE_APK_PATH ?? "wooriai-0.0.0-release-standalone.apk"
);
const outputPath = resolve(
  repoRoot,
  process.env.RELEASE4_CONTAMINATION_OUTPUT ?? "docs/qa/evidence/release4-production-contamination.json"
);

const signatures = [
  { id: "demo-data-leakage", needles: ["wooriai-local-backend", "local-child-daon", "local-household-daon", "local-child-qualification", "local-household-qualification", "검증용 아이"] },
  { id: "forced-auth-bypass", needles: ["wooriai-local-session", "LOCAL_SESSION_TOKEN"] },
  { id: "pixel-fixture", needles: ["pixel-screen-", "__WOORIAI_PIXEL_LOCK_OVERRIDES__"] },
  { id: "development-server", needles: ["http://localhost:3000", "http://10.0.2.2:3000"] },
  { id: "development-oauth-provider", needles: ["dev-oauth", "mock-oauth"] },
  { id: "sample-affiliate-url", needles: ["example.com/catalog-test-affiliate"] },
  { id: "debug-menu", needles: ["WOORIAI_DEBUG_MENU", "debug-menu-route"] },
  { id: "mock-push-provider", needles: ["mock-push-provider"] },
  { id: "test-only-endpoint", needles: ["/test-only/", "/__test__/"], },
  { id: "placeholder-legal-text", needles: ["LEGAL_TEXT_PLACEHOLDER", "약관 문구 준비 중"] }
] as const;

function normalizePath(path: string) {
  return path.split(sep).join("/");
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function embeddedBundle(apkPath: string) {
  if (!existsSync(apkPath)) throw new Error(`APK_NOT_FOUND ${apkPath}`);
  const result = spawnSync("tar", ["-xOf", apkPath, "assets/index.android.bundle"], {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 1024 * 1024 * 128
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error(`EMBEDDED_BUNDLE_READ_FAILED ${apkPath}\n${String(result.stderr ?? "")}`);
  }
  return result.stdout;
}

function scanBundle(bundlePath: string) {
  if (!existsSync(bundlePath)) throw new Error(`BUNDLE_NOT_FOUND ${bundlePath}`);
  const bundle = readFileSync(bundlePath);
  return scanBundleBytes(bundle, {
    artifactType: "bundle",
    bundlePath: normalizePath(relative(repoRoot, bundlePath))
  });
}

function scanBundleBytes(bundle: Buffer, artifact: Record<string, string | number>) {
  const bundleText = bundle.toString("utf8");
  const findings = signatures.flatMap((signature) => {
    const matchedNeedles = signature.needles.filter((needle) => bundleText.includes(needle));
    return matchedNeedles.length ? [{ id: signature.id, matchedNeedles }] : [];
  });
  return {
    ...artifact,
    bundleBytes: bundle.length,
    bundleSha256: sha256(bundle),
    findings
  };
}

function scanApk(apkPath: string) {
  const apk = readFileSync(apkPath);
  return scanBundleBytes(embeddedBundle(apkPath), {
    artifactType: "apk",
    apkPath: normalizePath(relative(repoRoot, apkPath)),
    apkBytes: apk.length,
    apkSha256: sha256(apk)
  });
}

function main() {
  const production = productionBundlePath ? scanBundle(productionBundlePath) : scanApk(productionApkPath);
  const standalone = existsSync(standaloneApkPath) ? scanApk(standaloneApkPath) : null;
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rule: "A production-profile embedded JS bundle fails when any forbidden runtime signature is present.",
    production: { ...production, passed: production.findings.length === 0 },
    standalone: standalone
      ? {
          ...standalone,
          profile: "internal-standalone",
          intentionalAllowlist: [
            "demo-data-leakage",
            "forced-auth-bypass",
            "pixel-fixture",
            "development-server"
          ],
          note: "This internal APK deliberately supports an on-device fixture backend. It is not a production/store artifact."
        }
      : null,
    signatures: signatures.map((signature) => ({ id: signature.id, needles: [...signature.needles] }))
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
  console.log(`Production contamination: ${evidence.production.passed ? "PASS" : "FAIL"}`);
  for (const finding of production.findings) {
    console.log(`- ${finding.id}: ${finding.matchedNeedles.join(", ")}`);
  }
  if (!evidence.production.passed) process.exitCode = 1;
}

main();
