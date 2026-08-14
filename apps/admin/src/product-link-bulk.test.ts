import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  PRODUCT_LINK_BULK_CSV_HEADER,
  bulkApplyProductLinks,
  bulkPreviewProductLinks,
  type ProductLinkBulkPreviewResult
} from "./lib/admin-api";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const SAMPLE_PREVIEW: ProductLinkBulkPreviewResult = {
  rows: [
    {
      rowNumber: 2,
      status: "valid",
      matchedProductLinkId: "9b2e8a76-1234-4cde-8f00-aabbccddeeff",
      matchedTitle: "카시트",
      currentAffiliateUrl: "https://example.com/dev/affiliate/car-seat",
      newAffiliateUrl: "https://link.coupang.com/a/abc123"
    },
    {
      rowNumber: 3,
      status: "error",
      matchedProductLinkId: null,
      matchedTitle: null,
      currentAffiliateUrl: null,
      newAffiliateUrl: null,
      errorCode: "BULK_ROW_LINK_NOT_FOUND",
      errorMessage: "대상 상품 링크를 찾을 수 없어요."
    }
  ],
  summary: { total: 2, valid: 1, errors: 1 }
};

// COM-107-prep bulk-replace endpoints: exercise the real request() wrapper
// (URL, method, CSRF double-submit header, credentials, error envelope
// mapping) against a stubbed fetch, mirroring admin-api.test.ts's style.
describe("product-link bulk replace API client (COM-107-prep)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123; other=1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST /admin/product-links/bulk-preview sends {csv} with the CSRF header and returns per-row results", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PREVIEW));

    const csv = `${PRODUCT_LINK_BULK_CSV_HEADER}\nid-1,,,https://link.coupang.com/a/abc123,`;
    const result = await bulkPreviewProductLinks(csv);

    expect(result).toEqual(SAMPLE_PREVIEW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/product-links/bulk-preview");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(JSON.parse(init.body as string)).toEqual({ csv });
  });

  it("POST /admin/product-links/bulk-apply returns {applied, skipped, errors} counts", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { applied: 2, skipped: 1, errors: 0 }));

    const result = await bulkApplyProductLinks("productLinkId,affiliateUrl\nid-1,https://link.coupang.com/a/x");

    expect(result).toEqual({ applied: 2, skipped: 1, errors: 0 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/product-links/bulk-apply");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
  });

  it("maps the API error envelope (e.g. invalid CSV header) to AdminApiError with its code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: { code: "ADMIN_BULK_CSV_HEADER_INVALID", message: "CSV 헤더에 affiliateUrl 열과 productLinkId 또는 itemTemplate 열이 필요해요." }
      })
    );

    const failure = await bulkPreviewProductLinks("foo,bar\n1,2").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(400);
    expect((failure as AdminApiError).code).toBe("ADMIN_BULK_CSV_HEADER_INVALID");
  });

  it("exports the CSV 템플릿 헤더 the UI shows for download/copy", () => {
    expect(PRODUCT_LINK_BULK_CSV_HEADER).toBe("productLinkId,itemTemplate,platform,affiliateUrl,priceSnapshotKrw");
  });
});

// House-style source checks (same pattern as admin-cms-pages.test.ts): the
// links page gains an admin-only CSV 일괄 교체 panel with preview -> apply flow.
describe("CSV 일괄 교체 panel wiring (COM-107-prep)", () => {
  it("renders a bulk-replace panel with CSV input, 미리보기, and gated 적용", () => {
    const panel = readSource("src/components/ProductLinkBulkReplace.tsx");
    expect(panel).toContain("use client");
    expect(panel).toContain("CSV 일괄 교체");
    expect(panel).toContain("미리보기");
    expect(panel).toContain("bulkPreviewProductLinks");
    expect(panel).toContain("bulkApplyProductLinks");
    // 적용 is disabled until a preview reports at least one valid row.
    expect(panel).toContain("preview.summary.valid === 0");
    // Applied/skipped/error counts are surfaced after apply.
    expect(panel).toContain("applyResult.applied");
    expect(panel).toContain("applyResult.skipped");
    expect(panel).toContain("applyResult.errors");
    // Session-expiry handling matches the rest of the CMS.
    expect(panel).toContain("isAuthError");
    expect(panel).toContain("clearSession");
  });

  it("shows a copyable CSV 템플릿 헤더 in the panel", () => {
    const panel = readSource("src/components/ProductLinkBulkReplace.tsx");
    expect(panel).toContain("PRODUCT_LINK_BULK_CSV_HEADER");
    expect(panel).toContain("CSV 템플릿");
    expect(panel).toContain("clipboard");
  });

  it("mounts the panel on the links page for admin sessions only (endpoints are admin-only)", () => {
    const page = readSource("app/links/page.tsx");
    expect(page).toContain("ProductLinkBulkReplace");
    expect(page).toContain('session.admin.role === "admin"');
  });
});
