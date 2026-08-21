import { describe, expect, it } from "vitest";
import { formatKrw } from "./money";

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
