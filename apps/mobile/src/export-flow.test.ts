import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { csvShareToastMessage } from "./export/share-payload";

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
    expect(cardSource).toContain('controller.busy ? "내보내는 중..." : EXPORT_SHARE_BUTTON_LABEL');
    expect(cardSource).toContain("disabled={controller.busy}");
  });

  /**
   * 라운드 45 UX-AA(후보 7): 이 흐름은 파일을 만들지 않는다(share-csv.ts의 경로 결정 주석 --
   * expo-file-system/expo-sharing이 없어 Share.share({ message })로 본문 텍스트를 보낸다).
   * "CSV로 내보내기"만 보고 첨부 파일을 기다리면 아무 파일도 오지 않으므로, 화면이 그 사실과
   * 다음 행동(붙여 넣고 .csv로 저장)을 먼저 말한다.
   */
  it("says the CSV goes out as text, not a file, and names the next step", () => {
    const cardSource = source(sharedExportModule);
    expect(cardSource).toContain(
      '"파일이 아니라 텍스트로 공유돼요. 메일·메모에 붙여 넣고 .csv로 저장하면 엑셀에서 열 수 있어요."'
    );
    expect(cardSource).toContain('export const EXPORT_SHARE_BUTTON_LABEL = "CSV 텍스트로 공유"');
    expect(cardSource).toContain("<Text style={exportCardNoticeStyle}>{EXPORT_TEXT_SHARE_NOTICE}</Text>");
    // 공유 시트 제목도 같은 사실을 말한다(받는 쪽이 첨부 파일을 기대하지 않도록).
    expect(source("src/export/share-csv.ts")).toContain('const CSV_SHARE_TITLE = "우리아이 지출 내역 (CSV 텍스트)"');
  });

  it("fetches via the existing listExpenses pager, builds the CSV, shares it, and toasts", () => {
    const hookSource = source(sharedExportModule);
    expect(hookSource).toContain("collectExpensesForRange(");
    expect(hookSource).toContain("listExpenses(authToken, childId, yearMonth, {");
    expect(hookSource).toContain("getSeoulToday()");
    expect(hookSource).toContain("buildExpenseCsv(collected.expenses, {");
    expect(hookSource).toContain("shareExpenseCsv(built.csv)");
    // Success, truncation, and error outcomes all surface through the Toast component.
    expect(hookSource).toContain("csvShareToastMessage({ outcomeKnown: outcome.outcomeKnown");
    expect(hookSource).toContain('"내보내기에 실패했어요. 잠시 후 다시 시도해주세요."');
    expect(hookSource).toContain("<Toast message={controller.toast.message} tone={controller.toast.tone} />");
  });

  // CSV-124: API-124가 목록 응답을 한 페이지(기본 200 · 상한 500건)로 자른 뒤로, 월별 페처가
  // listExpenses를 한 번만 부르면 월 200건 초과 사용자의 CSV가 첫 페이지만 담고 조용히 잘린다.
  it("walks every cursor page per month so a 200건 초과 month is exported in full (CSV-124)", () => {
    const hookSource = source(sharedExportModule);
    expect(hookSource).toContain("collectExpensePages((cursor) =>");
    // 서버 상한까지 올려 요청 수를 최소화한다(월 500건 이하면 종전과 같이 요청 한 번).
    expect(hookSource).toContain("limit: EXPENSE_LIST_MAX_LIMIT, cursor");
    // 전량을 모으지 못한 실패는 부분 CSV가 아니라 오류 토스트로 드러난다.
    expect(hookSource).toContain("error instanceof ExpensePageCollectionError");
    expect(hookSource).toContain("기록이 너무 많아 한 번에 내보낼 수 없어요");
  });

  /**
   * 라운드 45 O-8: `Share.dismissedAction`은 iOS 전용이라 Android는 시트를 그냥 닫아도
   * `sharedAction`으로 resolve한다. 그 자리에서 "내보냈어요"라고 단정하면 아무것도 안 보낸
   * 사람에게 성공을 알리는 허위 표시다.
   */
  it("only claims a completed export on the platform that reports it (O-8)", () => {
    const shareSource = source("src/export/share-csv.ts");
    expect(shareSource).toContain('import { Platform, Share } from "react-native"');
    expect(shareSource).toContain('outcomeKnown: Platform.OS === "ios"');

    const hookSource = source(sharedExportModule);
    expect(hookSource).toContain("csvShareToastMessage({ outcomeKnown: outcome.outcomeKnown");
    // 성공 단정 문구가 화면 모듈에 하드코딩돼 있으면 플랫폼 분기를 우회한다.
    expect(hookSource).not.toContain("건을 내보냈어요.`");

    // 문구 판정은 순수 모듈에 있고(share-payload.ts), 두 문장이 서로 다른 사실을 말한다.
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 12, truncated: false })).toBe(
      "기록 12건을 내보냈어요."
    );
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 12, truncated: false })).toBe(
      "기록 12건으로 공유 화면을 열었어요."
    );
    // 잘림 안내는 어느 쪽이든 사실이라 그대로 붙는다.
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 3, truncated: true })).toBe(
      "기록 3건으로 공유 화면을 열었어요. (용량 제한으로 일부만 포함됐어요)"
    );
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 3, truncated: true })).toContain(
      "용량 제한으로 일부만 포함됐어요"
    );
  });

  it("shares through RN's built-in Share (documented fallback), never expo-file-system/expo-sharing", () => {
    const shareSource = source("src/export/share-csv.ts");
    expect(shareSource).toContain('Share } from "react-native"');
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
    // CAT-124: CSV 카테고리 열도 이름 해석이라 전량(includeAll=1)이 필요하다.
    expect(hookSource).toContain("listCategories(authToken!, { includeAll: true })");
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
