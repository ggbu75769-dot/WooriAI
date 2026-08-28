import { describe, expect, it } from "vitest";
import { protectKoreanWordBoundaries } from "./korean-word-boundaries";

describe("protectKoreanWordBoundaries", () => {
  it("keeps each Korean word atomic while preserving spaces and newlines", () => {
    expect(protectKoreanWordBoundaries("개인정보 처리방침\n다시 보기")).toBe(
      "개\u2060인\u2060정\u2060보 처\u2060리\u2060방\u2060침\n다\u2060시 보\u2060기"
    );
  });

  it("does not alter non-Korean copy or add a joiner at word boundaries", () => {
    expect(protectKoreanWordBoundaries("WooriAI 2026 / 우리 아이")).toBe(
      "WooriAI 2026 / 우\u2060리 아\u2060이"
    );
  });

  it("is stable when applied more than once", () => {
    const once = protectKoreanWordBoundaries("처리방침");
    expect(protectKoreanWordBoundaries(once)).toBe(once);
  });
});
