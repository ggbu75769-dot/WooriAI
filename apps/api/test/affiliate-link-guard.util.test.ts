import { afterEach, describe, expect, it } from "vitest";
import { hashClickIp, isAllowedAffiliateUrl, isDomainAllowed, PRODUCT_LINK_NOT_FOUND_ERROR } from "../src/items-commerce/affiliate-link-guard.util";

describe("isDomainAllowed", () => {
  const allowed = ["coupang.com", "smartstore.naver.com"];

  it("matches an exact allowed domain", () => {
    expect(isDomainAllowed("coupang.com", allowed)).toBe(true);
  });

  it("matches a subdomain of an allowed domain", () => {
    expect(isDomainAllowed("link.coupang.com", allowed)).toBe(true);
    expect(isDomainAllowed("m.smartstore.naver.com", allowed)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isDomainAllowed("Link.Coupang.COM", allowed)).toBe(true);
  });

  it("rejects a lookalike domain that merely contains the allowed domain as a substring", () => {
    expect(isDomainAllowed("evil-coupang.com", allowed)).toBe(false);
    expect(isDomainAllowed("coupang.com.evil.com", allowed)).toBe(false);
    expect(isDomainAllowed("notcoupang.com", allowed)).toBe(false);
  });

  it("rejects an unrelated domain", () => {
    expect(isDomainAllowed("example.org", allowed)).toBe(false);
  });
});

describe("isAllowedAffiliateUrl", () => {
  const originalAllowedDomains = process.env.AFFILIATE_ALLOWED_DOMAINS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAllowedDomains === undefined) {
      delete process.env.AFFILIATE_ALLOWED_DOMAINS;
    } else {
      process.env.AFFILIATE_ALLOWED_DOMAINS = originalAllowedDomains;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows a URL whose host is on the allowlist (env-configured)", () => {
    process.env.NODE_ENV = "test";
    process.env.AFFILIATE_ALLOWED_DOMAINS = "coupang.com,link.coupang.com";

    expect(isAllowedAffiliateUrl("https://link.coupang.com/a/b?x=1")).toBe(true);
  });

  it("rejects a URL whose host is not on the allowlist", () => {
    process.env.NODE_ENV = "test";
    process.env.AFFILIATE_ALLOWED_DOMAINS = "coupang.com";

    expect(isAllowedAffiliateUrl("https://evil-coupang.com/a")).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    process.env.NODE_ENV = "test";
    process.env.AFFILIATE_ALLOWED_DOMAINS = "coupang.com";

    expect(isAllowedAffiliateUrl("not-a-url")).toBe(false);
  });

  it("falls back to the dev allowlist (including example.com for seeded fixtures) when unset in test/dev", () => {
    process.env.NODE_ENV = "test";
    delete process.env.AFFILIATE_ALLOWED_DOMAINS;

    expect(isAllowedAffiliateUrl("https://example.com/dev/affiliate/car-seat")).toBe(true);
    expect(isAllowedAffiliateUrl("https://link.coupang.com/a")).toBe(true);
    expect(isAllowedAffiliateUrl("https://evil.example.net/a")).toBe(false);
  });
});

describe("hashClickIp", () => {
  const originalSalt = process.env.AFFILIATE_CLICK_IP_SALT;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSalt === undefined) {
      delete process.env.AFFILIATE_CLICK_IP_SALT;
    } else {
      process.env.AFFILIATE_CLICK_IP_SALT = originalSalt;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns null when no IP is available", () => {
    expect(hashClickIp(undefined)).toBeNull();
    expect(hashClickIp(null)).toBeNull();
    expect(hashClickIp("")).toBeNull();
  });

  it("returns a deterministic sha256 hex digest that never contains the raw IP", () => {
    process.env.NODE_ENV = "test";
    process.env.AFFILIATE_CLICK_IP_SALT = "unit-test-salt";

    const hash = hashClickIp("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
    expect(hashClickIp("203.0.113.7")).toBe(hash);
  });

  it("produces a different hash for a different IP or a different salt", () => {
    process.env.NODE_ENV = "test";
    process.env.AFFILIATE_CLICK_IP_SALT = "unit-test-salt";
    const baseline = hashClickIp("203.0.113.7");

    expect(hashClickIp("198.51.100.9")).not.toBe(baseline);

    process.env.AFFILIATE_CLICK_IP_SALT = "different-salt";
    expect(hashClickIp("203.0.113.7")).not.toBe(baseline);
  });
});

describe("PRODUCT_LINK_NOT_FOUND_ERROR", () => {
  it("is a stable { code, message } shape reused for both not-found and domain-blocked cases", () => {
    expect(PRODUCT_LINK_NOT_FOUND_ERROR).toEqual({
      code: "PRODUCT_LINK_NOT_FOUND",
      message: expect.any(String)
    });
  });
});
