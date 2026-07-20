import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const artifactsRoot = resolve(repoRoot, "artifacts");
const outputDir = resolve(artifactsRoot, "release4-production-safe-export");
const evidencePath = resolve(repoRoot, "docs/qa/evidence/release4-production-export-contamination.json");
const validationApiBaseUrl =
  process.env.RELEASE4_VALIDATION_API_BASE_URL ?? "https://api.wooriai.test/api/v1";

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
}

function main() {
  if (dirname(outputDir) !== artifactsRoot || !outputDir.startsWith(`${artifactsRoot}${sep}`)) {
    throw new Error(`UNSAFE_EXPORT_TARGET ${outputDir}`);
  }
  if (!/^https:\/\//.test(validationApiBaseUrl)) {
    throw new Error("RELEASE4_VALIDATION_API_BASE_URL_HTTPS_REQUIRED");
  }
  if (existsSync(outputDir)) rmSync(outputDir, { force: true, recursive: true });

  const env = {
    ...process.env,
    NODE_ENV: "production",
    WOORIAI_BUILD_PROFILE: "production",
    EXPO_PUBLIC_TEST_LOGIN: "0",
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    EXPO_PUBLIC_API_BASE_URL: validationApiBaseUrl,
    EXPO_ROUTER_APP_ROOT: "app"
  };
  const exported = run(
    "pnpm",
    ["--dir", "apps/mobile", "exec", "expo", "export", "--platform", "android", "--output-dir", outputDir, "--clear"],
    env
  );
  const bundles = filesUnder(outputDir).filter((path) => path.endsWith(".hbc"));
  if (bundles.length !== 1) throw new Error(`EXPECTED_ONE_ANDROID_BUNDLE found=${bundles.length}`);

  const verified = run("pnpm", ["exec", "tsx", "scripts/verify-release4-contamination.ts"], {
    ...env,
    RELEASE4_PRODUCTION_BUNDLE_PATH: bundles[0],
    RELEASE4_CONTAMINATION_OUTPUT: evidencePath
  });
  console.log(exported.stdout.trim());
  console.log(verified.stdout.trim());
  console.log(`Production-safe export: ${outputDir}`);
}

main();
