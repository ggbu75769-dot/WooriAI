import { createHash } from "node:crypto";
import { requireSecret } from "../common/config/require-secret";

/**
 * Error shape shared by every affiliate-link entry point (the opaque GET /r/:code
 * redirect and the existing POST /product-links/:id/click endpoint) whenever a link
 * cannot be resolved, whether because it truly doesn't exist or because its target
 * domain isn't on the allowlist. Both cases return the same 404 code so an attacker
 * probing redirect codes can't distinguish "unknown code" from "known code, blocked
 * domain" (round5a-sprint2-plan.md §4).
 */
export const PRODUCT_LINK_NOT_FOUND_ERROR = {
  code: "PRODUCT_LINK_NOT_FOUND",
  message: "상품 링크를 찾을 수 없어요."
} as const;

/**
 * Dev/test fallback keeps the seeded example.com product-link fixtures (see
 * prisma/seed-data.ts) working without an explicit AFFILIATE_ALLOWED_DOMAINS env var.
 * Any real deployment must set the env var (requireSecret enforces this outside
 * development/test) to the actual affiliate partner domains.
 */
const DEV_ALLOWED_DOMAINS_FALLBACK =
  "coupang.com,link.coupang.com,smartstore.naver.com,shopping.naver.com,brand.naver.com,example.com";

const DEV_CLICK_IP_SALT_FALLBACK = "wooriai-dev-affiliate-click-ip-salt";

function getAllowedDomains(): string[] {
  return requireSecret("AFFILIATE_ALLOWED_DOMAINS", DEV_ALLOWED_DOMAINS_FALLBACK)
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Subdomain-inclusive allowlist match: "link.coupang.com" matches an allowed entry of
 * "coupang.com" (hostname === domain, or hostname ends with ".domain"). A lookalike
 * domain like "evil-coupang.com" does NOT match "coupang.com" — it is neither equal
 * nor a dot-separated suffix of it.
 */
export function isDomainAllowed(hostname: string, allowedDomains: string[]): boolean {
  const normalizedHost = hostname.trim().toLowerCase();
  return allowedDomains.some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`));
}

/**
 * Parses the target URL's hostname and checks it against AFFILIATE_ALLOWED_DOMAINS.
 * Returns false (not allowed) for unparsable URLs rather than throwing, so callers can
 * treat "malformed URL" and "disallowed domain" the same way (404).
 */
export function isAllowedAffiliateUrl(targetUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return false;
  }
  return isDomainAllowed(hostname, getAllowedDomains());
}

/**
 * sha256(ip + salt) — never store a raw client IP. Returns null when no IP is
 * available (e.g. some test harnesses) instead of hashing an empty string, so callers
 * can distinguish "no IP captured" from a real (hashed) value.
 */
export function hashClickIp(ip: string | undefined | null): string | null {
  if (!ip) {
    return null;
  }
  const salt = requireSecret("AFFILIATE_CLICK_IP_SALT", DEV_CLICK_IP_SALT_FALLBACK);
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}
