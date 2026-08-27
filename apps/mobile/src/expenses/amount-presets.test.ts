import { describe, expect, it } from "vitest";
import {
  addAmountPreset,
  canAddAmountPreset,
  clearAmountText,
  formatPresetAmountKorean,
  formatPresetChipLabel,
  parseAmountText,
  presetChipAccessibilityLabel,
  QUICK_AMOUNT_MAX_KRW,
  QUICK_AMOUNT_PRESETS_KRW
} from "./amount-presets";

describe("QUICK_AMOUNT_PRESETS_KRW (UX-121)", () => {
  it("offers the +1천 / +5천 / +1만 / +5만 units in ascending order", () => {
    expect([...QUICK_AMOUNT_PRESETS_KRW]).toEqual([1000, 5000, 10000, 50000]);
  });

  it("keeps every preset a positive KRW integer (DNC-013)", () => {
    for (const preset of QUICK_AMOUNT_PRESETS_KRW) {
      expect(Number.isInteger(preset)).toBe(true);
      expect(preset).toBeGreaterThan(0);
    }
  });
});

describe("parseAmountText", () => {
  it("reads a plain digit string", () => {
    expect(parseAmountText("38500")).toBe(38500);
  });

  it("treats an empty or digit-free value as 0", () => {
    expect(parseAmountText("")).toBe(0);
    expect(parseAmountText("원")).toBe(0);
  });

  it("ignores formatting characters and leading zeros", () => {
    expect(parseAmountText("₩ 38,500")).toBe(38500);
    expect(parseAmountText("007000")).toBe(7000);
    expect(parseAmountText("000")).toBe(0);
  });

  it("treats digit strings beyond the safe-integer range as over the cap", () => {
    expect(parseAmountText("9".repeat(30))).toBe(Number.MAX_SAFE_INTEGER);
    expect(canAddAmountPreset("9".repeat(30))).toBe(false);
  });
});

describe("addAmountPreset", () => {
  it("starts from the preset value when the field is empty", () => {
    expect(addAmountPreset("", 1000)).toBe("1000");
    expect(addAmountPreset("", 50000)).toBe("50000");
  });

  it("accumulates onto the current amount", () => {
    expect(addAmountPreset("1000", 1000)).toBe("2000");
    expect(addAmountPreset("38500", 5000)).toBe("43500");
  });

  it("always returns a bare positive integer string (DNC-013 정수 규칙)", () => {
    for (const preset of QUICK_AMOUNT_PRESETS_KRW) {
      const next = addAmountPreset("12345", preset);
      expect(next).toMatch(/^\d+$/);
      expect(Number.isInteger(Number(next))).toBe(true);
      expect(Number(next)).toBeGreaterThan(0);
    }
  });

  it("normalizes a formatted or zero-padded current value before adding", () => {
    expect(addAmountPreset("₩ 38,500", 1000)).toBe("39500");
    expect(addAmountPreset("007000", 1000)).toBe("8000");
    expect(addAmountPreset("0", 10000)).toBe("10000");
  });

  it("clamps the result at the cap instead of overshooting it", () => {
    expect(addAmountPreset(String(QUICK_AMOUNT_MAX_KRW - 1), 50000)).toBe(String(QUICK_AMOUNT_MAX_KRW));
    expect(addAmountPreset(String(QUICK_AMOUNT_MAX_KRW - 50000), 50000)).toBe(String(QUICK_AMOUNT_MAX_KRW));
    expect(addAmountPreset(String(QUICK_AMOUNT_MAX_KRW), 1000)).toBe(String(QUICK_AMOUNT_MAX_KRW));
  });

  it("never shrinks an over-cap amount the user typed by hand", () => {
    const typed = "999999999";
    expect(Number(typed)).toBeGreaterThan(QUICK_AMOUNT_MAX_KRW);
    expect(addAmountPreset(typed, 50000)).toBe(typed);
    // 안전 정수 범위를 넘는 자릿수도 그대로 보존된다(정밀도 깨진 값으로 덮어쓰지 않는다).
    const huge = "9".repeat(30);
    expect(addAmountPreset(huge, 50000)).toBe(huge);
  });

  it("leaves the amount untouched for a non-positive or non-integer preset", () => {
    expect(addAmountPreset("38500", 0)).toBe("38500");
    expect(addAmountPreset("38500", -1000)).toBe("38500");
    expect(addAmountPreset("38500", 1000.5)).toBe("38500");
    expect(addAmountPreset("38500", Number.NaN)).toBe("38500");
    expect(addAmountPreset("", 0)).toBe("");
  });

  it("supports mixing chip taps with keypad edits in any order", () => {
    // 빈 값 -> +1만 -> +5천 -> 키패드로 전체 수정 -> +1천 -> 키패드 백스페이스 -> +5만
    let amount = "";
    amount = addAmountPreset(amount, 10000);
    expect(amount).toBe("10000");
    amount = addAmountPreset(amount, 5000);
    expect(amount).toBe("15000");
    amount = "23000"; // 키패드로 직접 수정
    amount = addAmountPreset(amount, 1000);
    expect(amount).toBe("24000");
    amount = amount.slice(0, -1); // 백스페이스 -> "2400"
    expect(amount).toBe("2400");
    amount = addAmountPreset(amount, 50000);
    expect(amount).toBe("52400");
  });

  it("reaches the cap by repeated taps without ever exceeding it", () => {
    let amount = "";
    for (let tap = 0; tap < 5000; tap += 1) {
      amount = addAmountPreset(amount, 50000);
      expect(parseAmountText(amount)).toBeLessThanOrEqual(QUICK_AMOUNT_MAX_KRW);
    }
    expect(amount).toBe(String(QUICK_AMOUNT_MAX_KRW));
    expect(canAddAmountPreset(amount)).toBe(false);
  });
});

describe("clearAmountText / canAddAmountPreset", () => {
  it("resets the field to empty (rendered as ₩ 0, save stays disabled)", () => {
    expect(clearAmountText()).toBe("");
    expect(parseAmountText(clearAmountText())).toBe(0);
  });

  it("re-enables accumulation right after a reset", () => {
    const cleared = clearAmountText();
    expect(canAddAmountPreset(cleared)).toBe(true);
    expect(addAmountPreset(cleared, 5000)).toBe("5000");
  });

  it("reports whether a chip tap can still change the amount", () => {
    expect(canAddAmountPreset("")).toBe(true);
    expect(canAddAmountPreset(String(QUICK_AMOUNT_MAX_KRW - 1))).toBe(true);
    expect(canAddAmountPreset(String(QUICK_AMOUNT_MAX_KRW))).toBe(false);
    expect(canAddAmountPreset("999999999")).toBe(false);
  });
});

describe("preset labels", () => {
  it("renders the Korean short units used on the chips", () => {
    expect(formatPresetAmountKorean(1000)).toBe("1천");
    expect(formatPresetAmountKorean(5000)).toBe("5천");
    expect(formatPresetAmountKorean(10000)).toBe("1만");
    expect(formatPresetAmountKorean(50000)).toBe("5만");
  });

  it("composes 만/천 and the remainder for off-unit values", () => {
    expect(formatPresetAmountKorean(15000)).toBe("1만 5천");
    expect(formatPresetAmountKorean(500)).toBe("500");
    expect(formatPresetAmountKorean(10500)).toBe("1만 500");
    expect(formatPresetAmountKorean(0)).toBe("0");
    expect(formatPresetAmountKorean(-1000)).toBe("0");
  });

  it("shows a leading + on the visible chip label", () => {
    expect(QUICK_AMOUNT_PRESETS_KRW.map(formatPresetChipLabel)).toEqual(["+1천", "+5천", "+1만", "+5만"]);
  });

  it("spells the action out for screen readers", () => {
    expect(QUICK_AMOUNT_PRESETS_KRW.map(presetChipAccessibilityLabel)).toEqual([
      "1천 원 더하기",
      "5천 원 더하기",
      "1만 원 더하기",
      "5만 원 더하기"
    ]);
  });
});
