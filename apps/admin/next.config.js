/**
 * SEC-102 §3/§6: the admin web app proxies `/api/v1/*` to the NestJS API as a
 * same-origin rewrite (rather than the browser calling the API cross-origin).
 * This lets the `admin_session` HttpOnly cookie set by POST /admin/auth/login
 * be scoped to the admin app's own origin with a plain `SameSite=Lax` cookie —
 * no cross-site cookie config (`SameSite=None; Secure` + CORS credentials)
 * needed for local HTTP dev. `ADMIN_API_PROXY_TARGET` points at the API's own
 * origin (server-side only; not exposed to the browser).
 */
const API_PROXY_TARGET = process.env.ADMIN_API_PROXY_TARGET ?? "http://localhost:3000";

/**
 * SEC-102 §6 baseline security headers for the admin web app. The
 * Content-Security-Policy header itself is set per-request in middleware.ts
 * instead (it needs a per-request nonce for Next.js App Router's inline RSC
 * hydration scripts to work at all -- see the comment there). Setting a
 * second, non-nonce'd CSP here as well would not "layer" on top of it: when a
 * response carries multiple Content-Security-Policy headers, browsers
 * enforce the *intersection* of all of them, so a plain `script-src 'self'`
 * here would still block the nonce'd scripts middleware.ts allows.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" }
        ]
      }
    ];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_PROXY_TARGET}/api/v1/:path*` }];
  }
};

module.exports = nextConfig;
