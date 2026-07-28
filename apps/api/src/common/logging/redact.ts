const SENSITIVE_KEY = /(?:token|authorization|cookie|password|secret|oauthCode|codeVerifier|nonce|signedUrl|memo|itemName|email|phone|userAgent|ipAddress)/i;
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactForLog(entry)
      ])
    );
  }
  if (typeof value === "string" && EMAIL_VALUE.test(value)) return "[REDACTED]";
  return value;
}
