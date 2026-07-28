import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("Batch 11 release readiness artifacts", () => {
  it("exposes a root release gate script with the required automated checks", () => {
    const rootPackage = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(rootPackage.scripts["release:gate"]).toBe("tsx scripts/release-gate.ts");

    const releaseGatePath = join(repoRoot, "scripts/release-gate.ts");
    expect(existsSync(releaseGatePath)).toBe(true);
    const releaseGate = read("scripts/release-gate.ts");
    for (const requiredText of [
      "pnpm install --frozen-lockfile",
      "pnpm check:env:example",
      "prisma:validate",
      "prisma:generate",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "test:e2e",
      "pnpm build",
      "pnpm install --frozen-lockfile --strict-peer-dependencies --lockfile-only",
      "pnpm.cmd",
      "docs/qa/evidence/latest-release-gate.md"
    ]) {
      expect(releaseGate).toContain(requiredText);
    }
  });

  it("exposes UI Pixel Lock automation scripts and output contracts", () => {
    const rootPackage = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(rootPackage.scripts["ui:screenshot"]).toBe("tsx scripts/ui-pixel-lock.ts screenshot");
    expect(rootPackage.scripts["ui:visual-diff"]).toBe("tsx scripts/ui-pixel-lock.ts diff");
    expect(rootPackage.scripts["ui:visual-report"]).toBe("tsx scripts/ui-pixel-lock.ts report");
    expect(rootPackage.scripts["ui:pixel-lock"]).toBe("tsx scripts/ui-pixel-lock.ts all");

    const script = read("scripts/ui-pixel-lock.ts");
    for (const requiredText of [
      "docs/ui-pixel-lock/reference-crop-map.json",
      "docs/ui-pixel-lock/app-screenshots",
      "docs/ui-pixel-lock/diffs",
      "docs/ui-pixel-lock/reports/ui-pixel-lock-final-report.md",
      "pixelMismatchRatio",
      "validateLiveScreenshotSize",
      "LIVE_SCREENSHOT_DIMENSION_MISMATCH",
      "maxLiveScreenshotWidth",
      "liveScreenshotManifestPath",
      "readLiveScreenshotManifest",
      "LIVE_SCREENSHOT_MANIFEST_MISSING",
      "liveScreenshotAvailable",
      "liveImageWidth",
      "liveImageHeight",
      "sharp(liveScreenshot).metadata()",
      "captureMode",
      "readScreenshotManifest",
      "captureProofByScreen",
      "Live proof",
      "writeReferenceCrops",
      "extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })",
      "toFile(cropPath(crop.id))",
      "reference crop files generated",
      "VISUAL QA NOT PROVEN"
    ]) {
      expect(script).toContain(requiredText);
    }

    const androidScript = read("scripts/pixel-lock/android-pixel-lock.ts");
    expect(androidScript).toContain('process.env.PIXEL_ANDROID_COLD_EACH === "1"');
  });

  it("publishes QA runbook, release checklist, rollback, accessibility, and coverage evidence docs", () => {
    const requiredDocs = [
      "docs/qa/manual-runbook.md",
      "docs/qa/release-checklist.md",
      "docs/qa/rollback-plan.md",
      "docs/qa/accessibility-offline-checklist.md",
      "docs/qa/test-coverage.md",
      "docs/qa/functional-verification-report.md",
      "docs/qa/completion-audit.md",
      "docs/qa/evidence/release-owner-evidence-template.md",
      "docs/operations/github-integration-plan-2026-07-23.md",
      "docs/ui-pixel-lock/native-screenshots/manifest.json"
    ];
    for (const relativePath of requiredDocs) {
      expect(existsSync(join(repoRoot, relativePath)), `${relativePath} should exist`).toBe(true);
    }

    const runbook = read("docs/qa/manual-runbook.md");
    for (let index = 0; index <= 15; index += 1) {
      expect(runbook).toContain(`QR-${String(index).padStart(2, "0")}`);
    }
    expect(runbook).toContain("S0 Blocker");
    expect(runbook).toContain("S1 Critical");

    const releaseChecklist = read("docs/qa/release-checklist.md");
    for (const releaseId of [
      "REL-PRE-001",
      "REL-INFRA-002",
      "REL-BUILD-001",
      "REL-QA-001",
      "REL-LAUNCH-003",
      "REL-POST-001"
    ]) {
      expect(releaseChecklist).toContain(releaseId);
    }
    expect(releaseChecklist).toContain("Local verification status");
    expect(releaseChecklist).toContain("Waiver required");

    expect(read("docs/qa/rollback-plan.md")).toContain("API 5xx > 2%");
    expect(read("docs/qa/accessibility-offline-checklist.md")).toContain("44px");
    expect(read("docs/qa/test-coverage.md")).toContain("QA-002");

    const functionalVerification = read("docs/qa/functional-verification-report.md");
    expect(functionalVerification).toContain("Local functional verification is PASS");
    expect(functionalVerification).toContain("Feature Verification Matrix");
    expect(functionalVerification).toContain("Android Pixel Lock is PASS");
    expect(functionalVerification).toContain("9/9");

    const completionAudit = read("docs/qa/completion-audit.md");
    expect(completionAudit).toContain("Local MVP implementation and release-candidate code gates are verified");
    expect(completionAudit).toContain("docs/qa/functional-verification-report.md");
    expect(completionAudit).toContain("Production release approval is NOT PROVEN");
    expect(completionAudit).toContain("Android Pixel Lock final report is PASS");
    expect(completionAudit).toContain("all 9 screens");
    expect(completionAudit).toContain("internal-only");
    expect(completionAudit).toContain("REL-BUILD-002");

    expect(releaseChecklist).toContain("codex/sprint2-catalog-payments");
    expect(releaseChecklist).toContain("Android emulator install and adb screenshot proof");

    const githubIntegrationPlan = read("docs/operations/github-integration-plan-2026-07-23.md");
    expect(githubIntegrationPlan).toContain("Batch 1");
    expect(githubIntegrationPlan).toContain("Batch 5");
    expect(githubIntegrationPlan).toContain("Do not stage");

    const nativeProofManifest = read("docs/ui-pixel-lock/native-screenshots/manifest.json");
    expect(nativeProofManifest).toContain("com.anonymous.wooriai");
    expect(nativeProofManifest).toContain("launch-animation-native");
    expect(nativeProofManifest).toContain("auth-001-native");
    expect(nativeProofManifest).toContain("local Android debug APK evidence");

    const releaseOwnerEvidence = read("docs/qa/evidence/release-owner-evidence-template.md");
    for (const unresolvedReleaseId of [
      "REL-PRE-001",
      "REL-PRE-003",
      "REL-PRE-005",
      "REL-INFRA-001",
      "REL-INFRA-002",
      "REL-INFRA-003",
      "REL-BUILD-002",
      "REL-QA-001",
      "REL-STORE-001",
      "REL-LAUNCH-001",
      "REL-LAUNCH-002",
      "REL-POST-001"
    ]) {
      expect(releaseOwnerEvidence).toContain(unresolvedReleaseId);
    }
    for (const requiredField of ["Owner", "Status", "Evidence link", "Waiver approver"]) {
      expect(releaseOwnerEvidence).toContain(requiredField);
    }
    expect(releaseOwnerEvidence).toContain("remote branch exists");
    expect(releaseOwnerEvidence).not.toContain("Workspace is not a git repository");
  });
});
