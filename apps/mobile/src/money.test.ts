import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { amountDigitsOnly, formatAmountDigits, formatKrw } from "./money";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("formatKrw", () => {
  it("comma-groups thousands", () => {
    expect(formatKrw(12000)).toBe("12,000원");
    expect(formatKrw(1234567)).toBe("1,234,567원");
  });

  it("suffixes with 원 (not ₩)", () => {
    expect(formatKrw(500)).toBe("500원");
    expect(formatKrw(500)).not.toContain("₩");
  });

  it("renders zero as 0원", () => {
    expect(formatKrw(0)).toBe("0원");
  });

  it("never renders a negative sign -- amount is always shown as its absolute value", () => {
    expect(formatKrw(-12000)).toBe("12,000원");
    expect(formatKrw(-12000)).not.toContain("-");
  });

  it("falls back to 0원 for non-finite input", () => {
    expect(formatKrw(Number.NaN)).toBe("0원");
    expect(formatKrw(Number.POSITIVE_INFINITY)).toBe("0원");
  });
});

// R19-E: formatKrwParts/MoneyKrwParts의 계약 블록은 해당 export와 함께 제거됐다 —
// 유일한 소비자였던 D0 MoneyText가 MOB-121에서 삭제되면서 dead export가 됐다.

describe("FMT-127 amountDigitsOnly", () => {
  it("숫자만 남긴다", () => {
    expect(amountDigitsOnly("38500")).toBe("38500");
    expect(amountDigitsOnly("38,500원")).toBe("38500");
    expect(amountDigitsOnly("₩ 38,500")).toBe("38500");
    expect(amountDigitsOnly("abc")).toBe("");
    expect(amountDigitsOnly("")).toBe("");
  });

  it("부호·소수점도 떨군다 (DNC-013 정수 원화 규칙)", () => {
    expect(amountDigitsOnly("-1000")).toBe("1000");
    expect(amountDigitsOnly("1000.55")).toBe("100055");
  });
});

describe("FMT-127 formatAmountDigits", () => {
  it("digits를 콤마로 묶는다", () => {
    expect(formatAmountDigits("38500")).toBe("38,500");
    expect(formatAmountDigits("1234567")).toBe("1,234,567");
    expect(formatAmountDigits("500")).toBe("500");
  });

  it("빈 입력은 빈 문자열 -- placeholder가 계속 보여야 한다 ('비워두면 현재 예산 유지')", () => {
    expect(formatAmountDigits("")).toBe("");
  });

  it("'원'도 '₩'도 붙이지 않는다 -- 호출부가 형제 <Text>로 '원'을 그린다", () => {
    expect(formatAmountDigits("38500")).not.toContain("원");
    expect(formatAmountDigits("38500")).not.toContain("₩");
  });

  it("기존 3곳의 사본(Number(digits).toLocaleString('ko-KR'))과 같은 결과다", () => {
    for (const digits of ["0", "1", "999", "1000", "38500", "1234567"]) {
      expect(formatAmountDigits(digits)).toBe(Number(digits).toLocaleString("ko-KR"));
    }
  });
});

/**
 * FMT-127 재인라인 가드.
 *
 * 예산 수정·온보딩 예산·지출 수정 세 화면이 `toDigits`/`formatAmount`를 바이트 단위로 똑같이
 * 복제하고 있었다. 사본이 다시 생기면 세 금액 필드의 표기가 조용히 갈리므로, 사본이 돌아왔는지를
 * 소스에서 직접 막는다(src/offline/ui-wiring.test.ts의 소스 검증 관례).
 */
describe("FMT-127 금액 표기 단일화 (재인라인 가드)", () => {
  const screens = ["app/budget.tsx", "app/(onboarding)/budget.tsx", "app/expenses/[expenseId].tsx"];

  it("세 화면 모두 src/money.ts에서 가져다 쓴다", () => {
    for (const screen of screens) {
      const text = source(screen);
      expect(text, screen).toContain("amountDigitsOnly");
      expect(text, screen).toContain("formatAmountDigits");
      expect(text, screen).toMatch(/from "\.\.?\/(\.\.\/)?src\/money"/);
    }
  });

  it("지역 사본이 돌아오지 않았다", () => {
    for (const screen of screens) {
      const text = source(screen);
      expect(text, screen).not.toContain("function toDigits(");
      expect(text, screen).not.toContain("function formatAmount(");
      expect(text, screen).not.toContain('toLocaleString("ko-KR")');
    }
  });

  it("빠른 지출 기록 화면도 '₩'를 직접 조립하지 않는다 (EXP-001 캡처 리터럴만 예외)", () => {
    const quickExpense = source("app/expenses/new.tsx");

    // 캡처 밖 경로는 money.ts를 탄다.
    expect(quickExpense).toContain('from "../../src/money"');
    expect(quickExpense).toContain("formatKrw(Number(amountText || 0))");
    // 예전의 인라인 '₩ ...' 조립은 사라졌다.
    expect(quickExpense).not.toContain('`₩ ${Number(amountText || 0).toLocaleString("ko-KR")}`');
    expect(quickExpense).not.toContain('toLocaleString("ko-KR")');

    // 코드(주석 제외)에 남은 '₩'는 EXP-001 픽셀 락 캡처에 실제로 찍혀 있는 고정 문자열
    // 하나뿐이고, 그 예외는 캡처 조건(세션 없음 + 고정 시드)으로 좁혀져 있다.
    const codeLines = quickExpense
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .filter((line) => line.includes("₩"));
    expect(codeLines).toHaveLength(1);
    expect(codeLines[0]).toContain('const quickExpenseAmountPreview = "₩ 38,500";');
    expect(quickExpense).toContain('const quickExpenseAmountPreview = "₩ 38,500";');
    expect(quickExpense).toContain('const isPixelLockAmountCapture = !authToken && amountText === "38500";');
  });
});
