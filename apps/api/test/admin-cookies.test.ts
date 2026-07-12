import { describe, expect, it } from "vitest";
import { generateCsrfToken, parseCookieHeader } from "../src/admin/admin-cookies";

describe("parseCookieHeader", () => {
  it("parses a standard multi-cookie header", () => {
    expect(parseCookieHeader("admin_session=abc123; admin_csrf=def456")).toEqual({
      admin_session: "abc123",
      admin_csrf: "def456"
    });
  });

  it("returns an empty object for undefined/null/empty input", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });

  it("skips malformed segments without throwing", () => {
    expect(parseCookieHeader("no-equals-sign; admin_session=abc123")).toEqual({ admin_session: "abc123" });
  });

  it("URL-decodes values", () => {
    expect(parseCookieHeader("admin_csrf=a%2Fb%3Dc")).toEqual({ admin_csrf: "a/b=c" });
  });
});

describe("generateCsrfToken", () => {
  it("generates sufficiently long, unique tokens", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(/^[0-9a-f]+$/.test(a)).toBe(true);
  });
});
