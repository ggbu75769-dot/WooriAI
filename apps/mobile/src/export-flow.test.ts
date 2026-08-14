import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("EXP-106 데이터 내보내기(CSV) wiring (source verification -- follows the\n  import-flow.test.ts / offline ui-wiring.test.ts source-grep convention; more.tsx isn't\n  runtime-rendered because react-native has no native binding under vitest)", () => {
  it("adds the export menu row to the more tab, active only with a session", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("데이터 내보내기(CSV)");
    expect(moreSource).toContain("setExportCardOpen");
    // Logged-out preview: disabled row (caption + no onPress) with a login notice, mirroring
    // the "알림 설정 · 준비 중" disabled-row pattern.
    expect(moreSource).toContain('caption: "로그인 후 이용 가능", onPress: undefined');
  });

  it("renders the three range chips and a progress-aware export button", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("EXPORT_RANGE_OPTIONS.map((option)");
    expect(moreSource).toContain("selected={exportRange === option.value}");
    expect(moreSource).toContain('exportBusy ? "내보내는 중..." : "CSV로 내보내기"');
    expect(moreSource).toContain("disabled={exportBusy}");
  });

  it("fetches via the existing listExpenses pager, builds the CSV, shares it, and toasts", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("collectExpensesForRange(");
    expect(moreSource).toContain("listExpenses(authToken, childId, yearMonth)");
    expect(moreSource).toContain("getSeoulToday()");
    expect(moreSource).toContain("buildExpenseCsv(collected.expenses)");
    expect(moreSource).toContain("shareExpenseCsv(built.csv)");
    // Success, truncation, and error outcomes all surface through the Toast component.
    expect(moreSource).toContain("용량 제한으로 일부만 포함됐어요");
    expect(moreSource).toContain('showExportToast("내보내기에 실패했어요. 잠시 후 다시 시도해주세요.", "error")');
    expect(moreSource).toContain("<Toast message={exportToast.message} tone={exportToast.tone} />");
  });

  it("shares through RN's built-in Share (documented fallback), never expo-file-system/expo-sharing", () => {
    const shareSource = source("src/export/share-csv.ts");
    expect(shareSource).toContain('import { Share } from "react-native"');
    expect(shareSource).toContain("Share.share(");
    expect(shareSource).toContain("capCsvForShare(csv)");
    // Neither package is resolvable without adding a new dependency (pnpm strict layout;
    // expo-file-system is only transitive inside the store, expo-sharing isn't installed).
    for (const file of ["src/export/share-csv.ts", "src/export/expense-csv.ts", "src/export/export-range.ts", "app/(tabs)/more.tsx"]) {
      expect(source(file)).not.toMatch(/from "expo-file-system"|from "expo-sharing"/);
    }
  });

  it("keeps the CSV builder off src/money.ts formatting and on the shared category labels", () => {
    const csvSource = source("src/export/expense-csv.ts");
    expect(csvSource).toContain('import { categoryNameFor } from "../categories"');
    expect(csvSource).not.toContain("formatKrw");
    expect(csvSource).not.toContain('from "../money"');
    // Type-only client import: the builder must stay pure (no network module at runtime).
    expect(csvSource).toContain('import type { Expense } from "../api/client"');
  });
});
