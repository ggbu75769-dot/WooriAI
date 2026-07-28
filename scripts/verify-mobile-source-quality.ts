import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { analyzeMobileSourceText } from "./lib/mobile-source-quality";

const root = resolve(import.meta.dirname, "..");
const files = [
  "apps/mobile/app/(onboarding)/child-status.tsx",
  "apps/mobile/src/onboarding/PathFormScreens.tsx",
  "apps/mobile/src/onboarding/PreparedItemsV2Screen.tsx",
  "apps/mobile/src/onboarding/ReviewScreen.tsx",
  "apps/mobile/app/(tabs)/index.tsx",
  "apps/mobile/src/preparation/Release4PreparationScreen.tsx",
  "apps/mobile/src/preparation/Release4ItemDetailScreen.tsx",
  "apps/mobile/app/(tabs)/records.tsx",
  "apps/mobile/app/(tabs)/reports.tsx",
  "apps/mobile/app/notifications.tsx",
  "apps/mobile/app/family/index.tsx",
  "apps/mobile/app/settings/index.tsx",
  "apps/mobile/app/settings/privacy.tsx",
  "packages/domain/src/onboarding.ts"
];

const findings = files.flatMap((file) => {
  const absolute = resolve(root, file);
  return analyzeMobileSourceText(relative(root, absolute).replace(/\\/g, "/"), readFileSync(absolute, "utf8"));
});
const result = {
  schemaVersion: 1,
  verifier: "TypeScript AST",
  filesChecked: files.length,
  status: findings.length === 0 ? "PASS" : "FAIL",
  findings
};
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
if (outputArg) writeFileSync(resolve(root, outputArg.slice("--output=".length)), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (findings.length > 0) process.exitCode = 1;
