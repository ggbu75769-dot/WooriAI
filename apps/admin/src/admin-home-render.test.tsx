import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminHomePage from "../app/page";

describe("Admin home rendered security guidance", () => {
  it("renders the real cookie-session, MFA, and CMS navigation contract", () => {
    const html = renderToStaticMarkup(<AdminHomePage />);
    expect(html).toContain("HttpOnly 세션 쿠키");
    expect(html).toContain("MFA");
    expect(html).toContain("CSRF");
    expect(html).not.toContain("x-admin-token");
    expect(html).toContain('href="/items"');
    expect(html).toContain('href="/reviews"');
  });
});
