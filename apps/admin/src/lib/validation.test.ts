import { describe, expect, it } from "vitest";
import { isBlank, isEmailLike, isHttpUrl } from "./validation";

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://example.com/product")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects non-http protocols and malformed input", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl("   ")).toBe(false);
  });
});

describe("isBlank", () => {
  it("treats empty and whitespace-only strings as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(" hello ")).toBe(false);
  });
});

describe("isEmailLike", () => {
  it("accepts ordinary email shapes (with surrounding whitespace trimmed)", () => {
    expect(isEmailLike("admin@example.com")).toBe(true);
    expect(isEmailLike("  editor.kim+cms@woori-ai.co.kr  ")).toBe(true);
  });

  it("rejects blank, at-less, and domain-less input", () => {
    expect(isEmailLike("")).toBe(false);
    expect(isEmailLike("   ")).toBe(false);
    expect(isEmailLike("not-an-email")).toBe(false);
    expect(isEmailLike("missing-domain@")).toBe(false);
    expect(isEmailLike("@no-local-part.com")).toBe(false);
    expect(isEmailLike("no-tld@example")).toBe(false);
    expect(isEmailLike("two@@example.com")).toBe(false);
    expect(isEmailLike("spaces in@example.com")).toBe(false);
  });
});
