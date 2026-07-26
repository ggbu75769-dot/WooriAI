import { describe, expect, it } from "vitest";
import { normalizePublicHttpsUrl, PublicHttpsUrlError } from "./public-https-url";

describe("public HTTPS URL policy", () => {
  it("normalizes ordinary public HTTPS URLs", () => {
    expect(normalizePublicHttpsUrl("https://WWW.WOORIAI.KR/safety?q=1")).toBe("https://www.wooriai.kr/safety?q=1");
    expect(normalizePublicHttpsUrl("https://[2606:4700:4700::1111]/notice")).toBe("https://[2606:4700:4700::1111]/notice");
  });

  it.each([
    "http://www.wooriai.kr/notice",
    "https://user:secret@www.wooriai.kr/notice",
    "https://localhost/notice",
    "https://127.0.0.1/notice",
    "https://10.0.0.1/notice",
    "https://100.64.0.1/notice",
    "https://169.254.1.1/notice",
    "https://192.168.0.1/notice",
    "https://192.0.2.1/notice",
    "https://198.51.100.1/notice",
    "https://203.0.113.1/notice",
    "https://[::1]/notice",
    "https://[::ffff:127.0.0.1]/notice",
    "https://[fc00::1]/notice",
    "https://[fe80::1]/notice",
    "https://[2001:db8::1]/notice",
    "https://example.com/notice",
    "https://evidence.test/notice"
  ])("rejects non-public or credentialed URL %s", (value) => {
    expect(() => normalizePublicHttpsUrl(value)).toThrow(PublicHttpsUrlError);
  });
});
