import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SEC-102 §6 CSP, nonce-based (per-request) rather than the static header
 * originally attempted in next.config.js. Next.js's App Router injects many
 * inline `<script>self.__next_f.push(...)</script>` tags to stream RSC
 * hydration data to the client -- a static `script-src 'self'` with no
 * 'unsafe-inline'/nonce blocks every one of them, so the client never
 * hydrates and the app hangs on the initial loading state forever (confirmed
 * by hand while smoke-testing this change). This is the CSP approach Next.js
 * documents for the App Router: generate a nonce per request, put it in both
 * the `x-nonce` request header (Next reads this and applies the nonce to the
 * scripts it renders, including the RSC push scripts) and the response's
 * `Content-Security-Policy` header.
 *
 * `style-src` still needs 'unsafe-inline' (not a nonce) because the existing
 * admin pages use React's inline `style={{...}}` prop extensively -- nonces
 * only cover `<script>`/`<style>` elements, not inline style *attributes*.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // `next dev` bundles modules with an eval-based devtool (fast incremental
  // rebuilds), so the dev bundle itself calls eval() to run application code
  // -- without 'unsafe-eval', the client bundle throws on load and hydration
  // never happens (confirmed by hand: the loading screen hung forever in dev
  // until this was added). Next.js's own CSP docs call this out as a
  // development-only requirement; production builds don't eval-wrap modules,
  // so this stays out of the policy there.
  const isDev = process.env.NODE_ENV !== "production";
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  // Skips the API rewrite proxy (no HTML to protect, and no reason to pay the
  // nonce-generation cost on every proxied JSON call) and Next's own static
  // asset routes.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
