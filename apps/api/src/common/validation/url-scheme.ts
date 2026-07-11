const ALLOWED_URL_SCHEMES = new Set(["http:", "https:"]);

/**
 * Returns true only for absolute http(s) URLs. Used to reject dangerous or unexpected
 * schemes (javascript:, data:, file:, vbscript:, etc.) in product link URLs, both at
 * DTO validation time and defensively wherever a stored URL is used for a redirect.
 */
export function isHttpOrHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return ALLOWED_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}
