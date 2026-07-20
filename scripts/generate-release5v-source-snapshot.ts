import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { computeRelease5vSourceSnapshot } from "./lib/release5v-source-snapshot";

const repoRoot = process.cwd();
const outputPath = resolve(repoRoot, "docs", "qa", "evidence", "release5v-source-snapshot.json");

function main() {
  const report = computeRelease5vSourceSnapshot(repoRoot);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ output: outputPath, fileCount: report.fileCount, nativeExplicitFileCount: report.nativeExplicitFileCount, sourceSnapshotSha256: report.sourceSnapshotSha256 }, null, 2)}\n`);
}

main();
