import { describe, expect, it } from "vitest";
import { balanceCompactKoreanLabel } from "./compact-korean-label";

describe("balanceCompactKoreanLabel", () => {
  it("keeps short labels unchanged", () => {
    expect(balanceCompactKoreanLabel("신생아 욕조")).toBe("신생아 욕조");
  });

  it("breaks long labels only at word boundaries", () => {
    expect(balanceCompactKoreanLabel("후드형 아기 타월")).toBe("후드형\n아기 타월");
    expect(balanceCompactKoreanLabel("아기 바디 세정제")).toBe("아기 바디\n세정제");
  });

  it("never changes a long single word", () => {
    expect(balanceCompactKoreanLabel("배냇저고리")).toBe("배냇저고리");
  });
});
