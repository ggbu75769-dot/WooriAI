import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// COM-103 (round5a-sprint2-plan.md §3): editor sessions route items/links/
// disclosures saves through the content-revisions draft -> submit flow instead
// of the direct create/update endpoints (admin-only now); admin sessions keep
// the pre-existing direct-save behavior (see admin-cms-pages.test.ts, which
// this suite doesn't duplicate).
describe("Admin content-revisions API client", () => {
  it("exposes the full draft -> review -> publish surface", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("createContentRevision");
    expect(api).toContain("updateContentRevisionDraft");
    expect(api).toContain("submitContentRevision");
    expect(api).toContain("approvePublishContentRevision");
    expect(api).toContain("rejectContentRevision");
    expect(api).toContain("rollbackContentRevision");
    expect(api).toContain("listContentRevisions");
    expect(api).toContain("getContentRevision");
    expect(api).toContain("/admin/content-revisions");
  });
});

describe("Admin CMS editor draft -> review flow", () => {
  it("routes item template saves through a draft+submit flow for editor sessions", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain('session.admin.role === "editor"');
    expect(source).toContain("draftAndSubmitContentRevision");
    expect(source).toContain("entityType: \"item_template\"");
    // Admin sessions must still be able to save directly (solo-admin flow, round5a-sprint2-plan.md §3).
    expect(source).toContain("createItemTemplate");
    expect(source).toContain("updateItemTemplate");
  });

  it("routes product link saves through a draft+submit flow for editor sessions", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).toContain('session.admin.role === "editor"');
    expect(source).toContain("draftAndSubmitContentRevision");
    expect(source).toContain("entityType: \"product_link\"");
    expect(source).toContain("createProductLink");
    expect(source).toContain("updateProductLink");
  });

  it("routes disclosure saves through a draft+submit flow for editor sessions", () => {
    const source = readSource("app/disclosures/page.tsx");
    expect(source).toContain('session.admin.role === "editor"');
    expect(source).toContain("draftAndSubmitContentRevision");
    expect(source).toContain("entityType: \"disclosure\"");
    expect(source).toContain("updateDisclosure");
  });
});

describe("Admin CMS content review page", () => {
  it("lists in-review drafts, shows a live-vs-payload diff, and gates approve/reject/rollback to admin", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listContentRevisions");
    expect(source).toContain("getContentRevision");
    expect(source).toContain("approvePublishContentRevision");
    expect(source).toContain("rejectContentRevision");
    expect(source).toContain("rollbackContentRevision");
    expect(source).toContain('session.admin.role === "admin"');
  });

  it("is reachable from the admin nav", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("/reviews");
  });
});
