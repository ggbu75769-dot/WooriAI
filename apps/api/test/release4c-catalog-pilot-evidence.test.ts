import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(__dirname, "../../..");
const evidenceScript = readFileSync(resolve(workspaceRoot, "apps/api/scripts/release4c-evidence.ts"), "utf8");
const catalogAuditScript = readFileSync(resolve(workspaceRoot, "apps/api/scripts/catalog.ts"), "utf8");

describe("Release 4C catalog pilot evidence", () => {
  it("selects only deterministic low-risk review candidates without approving or publishing", () => {
    expect(evidenceScript).toContain('item.status === "in_review"');
    expect(evidenceScript).toContain('item.risk === "normal"');
    expect(evidenceScript).toContain('item.sourceReadiness === "evidence_attached_review_required"');
    expect(evidenceScript).toContain("!item.duplicateSuspicion");
    expect(evidenceScript).toContain("onboardingPriority ?? 0");
    expect(evidenceScript).toContain("approvalExecuted: false");
    expect(evidenceScript).toContain("publishExecuted: false");
    expect(evidenceScript).toContain("CANDIDATES_PREPARED_EXTERNAL_APPROVAL_REQUIRED");
    expect(evidenceScript).toContain("independentlyCapturedAndReviewedSources");
    expect(evidenceScript).toContain("preserve the canonical public URLs as draft intake records only");
    expect(evidenceScript).toContain("It never grants editorial/domain approval and never publishes content.");
    expect(evidenceScript).not.toContain("id: item.id");
    expect(evidenceScript).not.toContain("id: row.id");
  });

  it("uses the measured inventory total instead of a stale hard-coded count", () => {
    expect(evidenceScript).toContain("${inventorySummary.total}/${inventorySummary.total} classified");
    expect(evidenceScript).not.toContain("/408 classified");
  });

  it("fails the structural DB audit when canonical source rows are missing", () => {
    expect(catalogAuditScript).toContain('(evidenceByItem.get(item.id) ?? []).length === 0 && "evidenceSource"');
    expect(catalogAuditScript).toContain("itemsWithEvidence");
    expect(catalogAuditScript).toContain("independentlyCapturedAndReviewedEvidenceSources");
  });
});
