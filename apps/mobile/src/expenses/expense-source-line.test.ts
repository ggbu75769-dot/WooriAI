import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_SOURCE_LINE_LABEL, expenseSourceLine, expenseSourceLineText } from "./expense-source-line";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("라운드 41 UX-U(B-ⓐ) 지출 상세의 기록 방식 한 줄", () => {
  it("엑셀 가져오기와 구매 확인 기록에만 문구를 붙인다", () => {
    expect(expenseSourceLineText("excel_import")).toBe("엑셀로 가져온 기록");
    expect(expenseSourceLineText("purchase_followup")).toBe("구매 확인으로 남긴 기록");
  });

  it("손으로 적은 기록에는 아무 말도 하지 않는다(기본값이라 알려 줄 것이 없다)", () => {
    expect(expenseSourceLineText("manual")).toBeNull();
    expect(expenseSourceLine("manual")).toBeNull();
  });

  it("모르는 값 · 빈 값 · 값 없음에는 설명을 지어내지 않는다", () => {
    for (const unknown of ["admin", "", "   ", "excel", "EXCEL_IMPORT", null, undefined, 3 as unknown as string]) {
      expect(expenseSourceLineText(unknown as string | null | undefined)).toBeNull();
    }
  });

  it("라벨/값 한 쌍은 '기록한 사람' 줄과 같은 구조다", () => {
    expect(expenseSourceLine("excel_import")).toEqual({
      label: EXPENSE_SOURCE_LINE_LABEL,
      value: "엑셀로 가져온 기록"
    });
    expect(EXPENSE_SOURCE_LINE_LABEL).toBe("기록 방식");
  });
});

/**
 * 화면 배선은 소스 그렙으로 확인한다(react-native 화면은 vitest에서 렌더할 수 없다 --
 * import-flow/export-flow 테스트와 같은 관례).
 */
describe("라운드 41 UX-U(B-ⓐ) 지출 상세 배선", () => {
  const screen = () => source("app/expenses/[expenseId].tsx");

  it("응답의 source를 순수 모듈에 통과시켜 읽기 전용 줄로 그린다", () => {
    expect(screen()).toContain('import { expenseSourceLine } from "../../src/expenses/expense-source-line"');
    expect(screen()).toContain("const sourceLine = expenseSourceLine(expense.data?.source);");
    expect(screen()).toContain("{sourceLine ? (");
    expect(screen()).toContain("{sourceLine.label}");
    expect(screen()).toContain("{sourceLine.value}");
  });

  it("authorLabel 줄과 같은 라벨/값 스타일을 쓴다(새 표기 관례를 만들지 않는다)", () => {
    const screenSource = screen();
    const blockStart = screenSource.indexOf("{sourceLine ? (");
    const sourceBlock = screenSource.slice(blockStart, screenSource.indexOf("품목", blockStart));
    expect(sourceBlock).toContain("color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize");
    expect(sourceBlock).toContain("color: theme.colors.brown, fontSize: theme.typography.body1.fontSize");
    // DNC-018 / 새 hex 금지: 이 줄은 토큰만 쓴다.
    expect(sourceBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
