import { describe, expect, it } from "vitest";
import { formatKrw, formatKrwParts } from "./money";

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

describe("formatKrwParts", () => {
  it("splits the comma-grouped number from the 원 suffix", () => {
    expect(formatKrwParts(12000)).toEqual({ number: "12,000", suffix: "원" });
  });

  it("matches formatKrw when concatenated", () => {
    const parts = formatKrwParts(38500);
    expect(`${parts.number}${parts.suffix}`).toBe(formatKrw(38500));
  });

  it("also drops negative signs and non-finite input", () => {
    expect(formatKrwParts(-500)).toEqual({ number: "500", suffix: "원" });
    expect(formatKrwParts(Number.NaN)).toEqual({ number: "0", suffix: "원" });
  });
});
