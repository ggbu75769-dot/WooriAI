import { randomBytes } from "node:crypto";
import { isDevOrTestEnv } from "../common/config/require-secret";

/**
 * SEC-102: cookie names shared by the guard (reads), the auth controller (writes),
 * and the frontend admin-api.ts client (reads the non-HttpOnly CSRF cookie to echo
 * it back as a header). Kept as exported constants so all four call sites agree.
 */
export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_CSRF_COOKIE = "admin_csrf";
export const ADMIN_CSRF_HEADER = "x-csrf-token";

/**
 * Minimal `Cookie` request-header parser. The project does not install
 * `cookie-parser` (no other route needs cookie auth), so this reads the raw
 * `Cookie` header directly rather than adding a new middleware dependency for a
 * single admin-only concern. Malformed segments are skipped rather than throwing.
 */
export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) {
    return result;
  }
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!name) {
      continue;
    }
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * `Secure` is dropped outside development/test so `next dev`/local HTTP testing
 * (no TLS) can still receive the cookie -- matches the plan's explicit dev
 * exception ("dev 환경은 Secure 예외 허용"). Any other NODE_ENV (including unset)
 * is treated as production-like, same convention as require-secret.ts.
 */
export function cookieSecureFlag(): boolean {
  return !isDevOrTestEnv();
}
