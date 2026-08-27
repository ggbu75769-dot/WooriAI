import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const sharedExportModule = "src/export/ExpenseCsvExport.tsx";

describe("EXP-106 데이터 내보내기(CSV) wiring (source verification -- follows the\n  import-flow.test.ts / offline ui-wiring.test.ts source-grep convention; more.tsx isn't\n  runtime-rendered because react-native has no native binding under vitest)", () => {
  it("adds the export menu row to the more tab, active only with a session", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("EXPORT_MENU_TITLE");
    expect(moreSource).toContain("csvExport.toggleCard");
    // Logged-out preview: disabled row (caption + no onPress) with a login notice. (Originally
    // mirrored the "알림 설정 · 준비 중" row, which NOTI-102 turned into a live /notifications link.)
    expect(moreSource).toContain("caption: EXPORT_SIGNED_OUT_CAPTION, onPress: undefined");
    expect(source(sharedExportModule)).toContain('export const EXPORT_SIGNED_OUT_CAPTION = "로그인 후 이용 가능"');
    expect(source(sharedExportModule)).toContain('export const EXPORT_MENU_TITLE = "데이터 내보내기(CSV)"');
  });

  it("renders the three range chips and a progress-aware export button", () => {
    const cardSource = source(sharedExportModule);
    expect(cardSource).toContain("EXPORT_RANGE_OPTIONS.map((option)");
    expect(cardSource).toContain("selected={controller.range === option.value}");
    expect(cardSource).toContain('controller.busy ? "내보내는 중..." : "CSV로 내보내기"');
    expect(cardSource).toContain("disabled={controller.busy}");
  });

  it("fetches via the existing listExpenses pager, builds the CSV, shares it, and toasts", () => {
    const hookSource = source(sharedExportModule);
    expect(hookSource).toContain("collectExpensesForRange(");
    expect(hookSource).toContain("listExpenses(authToken, childId, yearMonth)");
    expect(hookSource).toContain("getSeoulToday()");
    expect(hookSource).toContain("buildExpenseCsv(collected.expenses, {");
    expect(hookSource).toContain("shareExpenseCsv(built.csv)");
    // Success, truncation, and error outcomes all surface through the Toast component.
    expect(hookSource).toContain("용량 제한으로 일부만 포함됐어요");
    expect(hookSource).toContain('showToast("내보내기에 실패했어요. 잠시 후 다시 시도해주세요.", "error")');
    expect(hookSource).toContain("<Toast message={controller.toast.message} tone={controller.toast.tone} />");
  });

  it("shares through RN's built-in Share (documented fallback), never expo-file-system/expo-sharing", () => {
    const shareSource = source("src/export/share-csv.ts");
    expect(shareSource).toContain('import { Share } from "react-native"');
    expect(shareSource).toContain("Share.share(");
    expect(shareSource).toContain("capCsvForShare(csv)");
    // Neither package is resolvable without adding a new dependency (pnpm strict layout;
    // expo-file-system is only transitive inside the store, expo-sharing isn't installed).
    for (const file of [
      "src/export/share-csv.ts",
      "src/export/expense-csv.ts",
      "src/export/export-range.ts",
      sharedExportModule,
      "app/(tabs)/more.tsx",
      "app/settings/index.tsx"
    ]) {
      expect(source(file)).not.toMatch(/from "expo-file-system"|from "expo-sharing"/);
    }
  });

  it("resolves the CSV's category column through the server category list, not only the 8 static tiles", () => {
    // 정식 시드 카테고리 12개는 서버 DB마다 id가 달라 정적 매핑으로는 전부 "기타"가 됐다.
    const hookSource = source(sharedExportModule);
    expect(hookSource).toContain('queryKey: ["categories"]');
    expect(hookSource).toContain("listCategories(authToken!)");
    expect(hookSource).toContain("categoryName: buildCategoryNameLookup(categories.data?.categories)");
  });

  it("keeps the CSV builder off src/money.ts formatting and on the shared category labels", () => {
    const csvSource = source("src/export/expense-csv.ts");
    expect(csvSource).toContain('import { categoryNameFor, type CategoryNameLookup } from "../categories"');
    expect(csvSource).not.toContain("formatKrw");
    expect(csvSource).not.toContain('from "../money"');
    // Type-only client import: the builder must stay pure (no network module at runtime).
    expect(csvSource).toContain('import type { Expense } from "../api/client"');
  });
});

/**
 * CLEAN-123(A3) 데이터 이동성 대칭: 설정 화면에 "데이터 가져오기"만 있고 CSV 내보내기는 더보기
 * 탭에만 있었다. 두 화면이 같은 공용 모듈(src/export/ExpenseCsvExport.tsx)을 쓰도록 추출했으므로,
 * 내보내기 로직이 화면 안에서 다시 갈라지지 않는지까지 함께 잠근다.
 */
describe("CLEAN-123(A3) data-portability symmetry", () => {
  it("offers the export row next to 데이터 가져오기 on the settings screen", () => {
    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain('title="데이터 가져오기"');
    // FIX/F5: 두 화면의 메뉴 제목은 EXPORT_MENU_TITLE 한 벌 -- 설정 화면이 다시 문자열을
    // 인라인하면(예전의 "CSV 내보내기") 같은 기능이 화면마다 다른 이름으로 보인다.
    expect(settingsSource).toContain("title={EXPORT_MENU_TITLE}");
    expect(settingsSource).not.toContain('title="CSV 내보내기"');
    expect(settingsSource).toContain("<ExpenseCsvExportCard controller={csvExport} />");
    expect(settingsSource).toContain("<ExpenseCsvExportToast controller={csvExport} />");
    // 세션이 없으면 더보기 탭과 같은 비활성 행 패턴(안내 문구 + onPress 없음).
    expect(settingsSource).toContain("csvExport.canExport ? csvExport.toggleCard : undefined");
    expect(settingsSource).toContain("EXPORT_SIGNED_OUT_CAPTION");
  });

  it("has both screens drive the one shared export module instead of duplicating the flow", () => {
    for (const screen of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} should use the shared hook`).toContain("useExpenseCsvExport()");
      expect(screenSource, `${screen} should import from the shared module`).toContain(
        'from "../../src/export/ExpenseCsvExport"'
      );
      // 화면은 수집·CSV 생성·공유를 직접 호출하지 않는다 (중복 구현 금지).
      for (const movedCall of ["collectExpensesForRange", "buildExpenseCsv", "shareExpenseCsv", "buildCategoryNameLookup"]) {
        expect(screenSource, `${screen} must not re-implement ${movedCall}`).not.toContain(movedCall);
      }
    }
  });

  it("keeps the export card on the SET-001 pixel tokens both screens share", () => {
    const cardSource = source(sharedExportModule);
    expect(cardSource).toContain("MoreSettingsPixelStyles.cardRadius");
    // 추출 후에도 더보기 탭이 카드 스타일을 따로 들고 있지 않아야 한다.
    expect(source("app/(tabs)/more.tsx")).not.toContain("exportCardStyle");
  });
});
