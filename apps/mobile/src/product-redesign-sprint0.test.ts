import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

function source(relativePath: string) {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

describe("product redesign Sprint 0 source contract", () => {
  it("keeps test login inside the same child onboarding flow as a real account", () => {
    const login = source("app/(auth)/login.tsx");

    expect(login).toContain('router.replace("/onboarding/child-status")');
    expect(login).toContain("resetOnboarding");
    expect(login).not.toContain("markHomeReached");
  });

  it("uses vector icons for the five MOD_V1 tabs", () => {
    const layout = source("app/(tabs)/_layout.tsx");

    for (const label of ["홈", "기록", "준비템", "리포트", "프로필"]) {
      expect(layout).toContain(label);
    }
    for (const icon of ["home", "notebook", "basket", "chart-box", "account-circle"]) {
      expect(layout).toContain(icon);
    }
    expect(layout).toContain("AppIcon");
  });

  it("keeps sample home data visibly separated and removes duplicate quick actions", () => {
    const home = source("app/(tabs)/index.tsx");

    expect(home).toContain("isPixelLockMode ? previewHome : null");
    expect(home).toContain("SampleDataBanner");
    expect(home).toContain("quickActions");
    expect(home).toContain("BudgetSummary");
    expect(home).not.toContain("QuickActionIconButton");
    expect(home).not.toContain("FloatingActionButton");
    expect(home).not.toContain("다온이");
    expect(home).toContain("<ChildSwitcher");
    expect(source("src/design-system/components/CorePrimitives.tsx")).toContain(". 아이 전환");
    expect(home).toContain('router.push("/children" as Href)');
  });

  it("separates frequent expense items from accounting categories and uses registered payment methods", () => {
    const expense = source("app/expenses/new.tsx");
    const categories = source("src/categories.ts");

    expect(expense).toContain("quickExpenseItems");
    expect(expense).toContain("quickExpenseCategories");
    expect(expense).toContain('{ id: null, type: "unknown" as const, label: "미지정", isDefault: false }');
    expect(expense).toContain("listPaymentMethods");
    expect(expense).toContain("method.active");
    expect(expense).not.toContain("카카오뱅크");
    expect(expense).not.toContain("₩");
    expect(categories).toContain("보험·저축");
    expect(categories).not.toContain("약품/교통");
    expect(expense).toContain("빠른 품목");
    expect(expense).toContain("validateExpenseForm({ itemName, amountText, spentOn: expenseDate.iso })");
  });

  it("makes preparation status primary and removes unsupported commerce claims", () => {
    const items = source("app/(tabs)/items.tsx");
    const detail = source("app/items/[itemTemplateId].tsx");

    for (const label of ["지금 필요", "곧 필요", "준비 완료", "필요 없음"]) {
      expect(items).toContain(label);
    }
    expect(items).not.toContain("BEST");
    expect(items).not.toContain("괜찮아요");
    expect(detail).not.toContain("장바구니");
    expect(detail).toContain("visibleDetail.productLinks.length > 0");
    expect(detail).toContain("AffiliateDisclosure");
    expect(detail).toContain("검수된 구매 링크가 아직 없어요");
    expect(items).toContain("필요도와 준비 시기를 먼저 확인하고");
    expect(items).toContain("준비 시기 ·");
  });

  it("provides a real child switcher backed by the selected-child store", () => {
    const home = source("app/(tabs)/index.tsx");
    const switcher = source("app/children/index.tsx");
    const client = source("src/api/client.ts");

    expect(home).toContain('router.push("/children" as Href)');
    expect(switcher).toContain("listChildren");
    expect(switcher).toContain("setSelectedChildId(childId)");
    expect(switcher).toContain('router.replace("/(tabs)")');
    expect(client).toContain('requestJson<{ children: OnboardingChildSummary[] }>("/children"');
  });

  it("hides empty report charts and keeps import sample rows pixel-lock-only", () => {
    const reports = source("app/(tabs)/reports.tsx");
    const importScreen = source("app/import/index.tsx");

    expect(reports).toContain('(activeTotal ?? 0) === 0');
    expect(reports).toContain("개 더 기록하면 카테고리 분석을 보여드려요");
    expect(reports).not.toContain("₩");
    expect(importScreen).toContain("showPixelPreview = isPixelLockMode && !canUpload");
    expect(importScreen).toContain("엑셀 파일 선택하기");
    expect(importScreen).toContain("승인하기 전에는 지출로 저장하지 않아요");
  });
});
