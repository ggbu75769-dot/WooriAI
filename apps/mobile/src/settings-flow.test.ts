import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 10 mobile settings contract", () => {
  it("exposes settings API client functions", async () => {
    const client = await import("./api/client");

    expect(client.getPrivacySettings).toEqual(expect.any(Function));
    expect(client.previewChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.confirmChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.previewHouseholdLeave).toEqual(expect.any(Function));
    expect(client.previewAccountDeletion).toEqual(expect.any(Function));
    expect(client.confirmAccountDeletion).toEqual(expect.any(Function));
    expect(client.requestDataExport).toEqual(expect.any(Function));
    expect(client.getPrivacyRequest).toEqual(expect.any(Function));
    expect(client.getPrivacyExportPayload).toEqual(expect.any(Function));
  });

  it("creates settings and privacy routes without changing the fixed tabs", () => {
    const expectations = [
      ["app/(tabs)/_layout.tsx", "Tabs.Screen"],
      ["app/settings/index.tsx", "SET-001"],
      ["app/settings/index.tsx", "SET-002"],
      ["app/settings/index.tsx", "router.push(\"/settings/privacy\")"],
      ["app/settings/privacy.tsx", "SET-003"],
      ["app/settings/privacy.tsx", "SET-004"],
      ["app/settings/privacy.tsx", "previewChildProfileDeletion"],
      ["app/settings/privacy.tsx", "confirmChildProfileDeletion"],
      ["app/settings/privacy.tsx", "previewAccountDeletion"],
      ["app/settings/privacy.tsx", "confirmAccountDeletion"],
      ["app/settings/privacy.tsx", "내 데이터 내보내기"],
      ["app/settings/privacy.tsx", "JSON 파일 저장·공유"],
      ["app/settings/privacy.tsx", "accessibilityLiveRegion=\"polite\""],
      ["app/settings/privacy.tsx", "필수 약관 동의 내역"],
      ["app/settings/privacy.tsx", "privacy.data.consents.map"],
      ["app/settings/privacy.tsx", "requiresSecondStep"]
    ];

    for (const [relativePath, expectedText] of expectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });

  it("keeps nested settings tools reversible without exposing evidence ids as normal UI copy", () => {
    const nestedRoutes = [
      "app/settings/index.tsx",
      "app/settings/privacy.tsx",
      "app/payment-methods.tsx",
      "app/preparation-calendar.tsx",
      "app/custom-bundles.tsx",
      "app/weekly-briefing.tsx",
      "app/receipts/new.tsx",
      "app/profile.tsx",
      "app/children/new.tsx",
      "app/children/[childId].tsx"
    ];

    for (const relativePath of nestedRoutes) {
      const source = readFileSync(join(mobileRoot, relativePath), "utf8");
      expect(source, `${relativePath} should expose a visible back action`).toContain("onBack={() => router.back()}");
    }

    expect(readFileSync(join(mobileRoot, "app/payment-methods.tsx"), "utf8")).toContain('isPixelLockBuild() ? evidenceId : "기록 설정"');
    expect(readFileSync(join(mobileRoot, "app/payment-methods.tsx"), "utf8")).toContain("reactivatePaymentMethod");
    expect(readFileSync(join(mobileRoot, "app/payment-methods.tsx"), "utf8")).toContain("다시 사용");
    expect(readFileSync(join(mobileRoot, "app/children/new.tsx"), "utf8")).not.toContain('eyebrow="CHILD-001"');
    expect(readFileSync(join(mobileRoot, "app/children/[childId].tsx"), "utf8")).not.toContain('eyebrow="CHILD-002"');
    expect(readFileSync(join(mobileRoot, "app/profile.tsx"), "utf8")).not.toContain('eyebrow="PROFILE-001"');
  });

  it("keeps report evidence and import preview routes visibly reversible", () => {
    const reportSources = readFileSync(join(mobileRoot, "app/reports/sources.tsx"), "utf8");
    const importUpload = readFileSync(join(mobileRoot, "app/import/index.tsx"), "utf8");
    const importPreview = readFileSync(join(mobileRoot, "app/import/[importJobId].tsx"), "utf8");

    expect(reportSources).toContain('onBack={() => router.back()}');
    expect(reportSources).toContain("예정 제외 완료 기록");
    expect(importUpload).toContain('accessibilityLabel="뒤로"');
    expect(importPreview).toContain('onBack={() => router.back()}');
  });

  it("keeps pushed utility routes visibly reversible", () => {
    for (const relativePath of [
      "app/notifications.tsx",
      "app/children/index.tsx",
      "app/family/invite.tsx",
      "app/sync-status.tsx"
    ]) {
      const source = readFileSync(join(mobileRoot, relativePath), "utf8");
      expect(source, `${relativePath} should expose a visible back action`).toContain("onBack={() => router.back()}");
    }
  });

  it("supports month navigation and avoids dead-end test-mode tools", () => {
    const calendar = readFileSync(join(mobileRoot, "app/preparation-calendar.tsx"), "utf8");
    const settings = readFileSync(join(mobileRoot, "app/settings/index.tsx"), "utf8");
    const more = readFileSync(join(mobileRoot, "app/(tabs)/more.tsx"), "utf8");

    expect(calendar).toContain('accessibilityLabel="이전 달"');
    expect(calendar).toContain('accessibilityLabel="다음 달"');
    expect(calendar).toContain("이번 달로 돌아가기");
    expect(settings).toContain('badgeLabel={isTestSession ? "실제 계정" : undefined}');
    expect(more).toContain('disabled={isTestSession} icon="bell-outline"');
  });

  it("protects unsaved budget, payment-method, and child-profile edits", () => {
    const budget = readFileSync(join(mobileRoot, "app/budget.tsx"), "utf8");
    const paymentMethods = readFileSync(join(mobileRoot, "app/payment-methods.tsx"), "utf8");
    const editChild = readFileSync(join(mobileRoot, "app/children/[childId].tsx"), "utf8");
    const newChild = readFileSync(join(mobileRoot, "app/children/new.tsx"), "utf8");
    const profileFields = readFileSync(join(mobileRoot, "src/children/ChildProfileFields.tsx"), "utf8");

    expect(budget).toContain("useConfirmDiscardChanges(hasChanges && !allowExit)");
    expect(budget).toContain('eyebrow="예산 · 데이터"');
    expect(budget).toContain('hasChanges ? "저장하기" : "변경 없음"');
    expect(paymentMethods).toContain("useConfirmDiscardChanges(hasUnsavedInput)");
    expect(paymentMethods).toContain('accessibilityLabel={`${method.label} 수정`}');
    expect(paymentMethods).toContain('accessibilityLabel={`${method.label} 기본 결제수단으로 설정`}');
    expect(paymentMethods).toContain('accessibilityLabel={`${method.label} 사용 중지`}');
    expect(editChild).toContain("useConfirmDiscardChanges(hasUnsavedChanges && !allowExit && !update.isPending)");
    expect(editChild).toContain("submitOnlyWhenChanged");
    expect(newChild).toContain("useConfirmDiscardChanges(hasUnsavedChanges && !allowExit && !create.isPending)");
    expect(newChild).toContain("showValidationInitially={false}");
    expect(profileFields).toContain('submitOnlyWhenChanged && !hasChanges ? "변경 없음"');
    expect(profileFields).toContain('<DateField');
    expect(profileFields).toContain('maximumDate={dateOnlyToLocalDate(getSeoulToday())}');
    expect(profileFields).not.toContain('placeholder="YYYY-MM-DD"');
  });
});
