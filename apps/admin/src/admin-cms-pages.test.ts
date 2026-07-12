import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// SEC-102: the admin app no longer holds a Bearer token in sessionStorage/memory.
// Auth is an HttpOnly `admin_session` cookie set by the API; the frontend only
// ever reads the non-HttpOnly `admin_csrf` cookie (to echo it back as a header)
// and never persists a secret in browser storage.
describe("Admin CMS cookie session gate", () => {
  it("gates the app behind a cookie session (no client-held Bearer/localStorage token) and forces MFA enrollment", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("use client");
    expect(gate).toContain("로그인");
    expect(gate).toContain("MfaSetupScreen");

    const sessionContext = readSource("src/lib/admin-token-context.tsx");
    expect(sessionContext).not.toContain("sessionStorage");
    expect(sessionContext).not.toContain("localStorage");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).not.toContain("Authorization");
    expect(api).not.toContain("x-admin-token");
    expect(api).toContain("credentials: \"include\"");
    expect(api).toContain("X-CSRF-Token");
  });
});

describe("Admin CMS two-step login + forced MFA enrollment (SEC-101)", () => {
  it("logs in with password then TOTP/recovery code before establishing a session", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("adminLogin");
    expect(gate).toContain("mfaRequired");
    expect(gate).toContain("adminVerifyMfaLogin");
  });

  it("renders a QR/manual-key MFA setup screen and shows recovery codes exactly once", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("adminMfaSetupStart");
    expect(gate).toContain("adminMfaSetupVerify");
    expect(gate).toContain("recoveryCodes");
    expect(gate).toContain("qrcode");
  });

  it("wires session-expiry to a login redirect via clearSession on 401", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("clearSession");
    const api = readSource("src/lib/admin-api.ts");
    // 403 (RBAC/CSRF/MFA-required) must not be treated as "log the admin out" --
    // only a real 401 (invalid/expired session) should trigger isAuthError.
    expect(api).toContain("error.status === 401");
  });
});

describe("Admin web security headers + same-origin API proxy", () => {
  it("proxies /api/v1 same-origin and sets baseline static security headers", () => {
    const config = readSource("next.config.js");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("rewrites");
    expect(config).toContain("/api/v1/:path*");
  });

  // CSP is set per-request in middleware.ts (not next.config.js) because
  // Next.js App Router's inline RSC hydration scripts require a per-request
  // nonce to run at all under a script-src that isn't 'unsafe-inline'.
  it("sets a nonce-based CSP with frame-ancestors 'none' in middleware", () => {
    const middleware = readSource("middleware.ts");
    expect(middleware).toContain("Content-Security-Policy");
    expect(middleware).toContain("frame-ancestors 'none'");
    expect(middleware).toContain("nonce");
    expect(middleware).toContain("x-nonce");
  });
});

describe("Admin CMS item templates page", () => {
  it("exposes create and update flows against the admin item-templates API", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createItemTemplate");
    expect(source).toContain("updateItemTemplate");
    expect(source).toContain("necessityLevel");
  });
});

describe("Admin CMS product links page", () => {
  it("exposes create and update flows against the admin product-links API with URL validation", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createProductLink");
    expect(source).toContain("updateProductLink");
    expect(source).toContain("isHttpUrl");
  });
});

describe("Admin CMS disclosures page", () => {
  it("exposes read and update flows against the admin disclosures API", () => {
    const source = readSource("app/disclosures/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listDisclosures");
    expect(source).toContain("updateDisclosure");
  });
});

describe("Admin CMS click summary page", () => {
  it("reads the affiliate click summary endpoint", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAffiliateClickSummary");
  });
});
