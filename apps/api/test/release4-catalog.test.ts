import { describe, expect, it } from "vitest";
import {
  childLifecycleCodes,
  catalogScenarioCodes,
  motherLifecycleCodes,
  release4CatalogItems,
  release4CatalogMetrics,
  release4CatalogNodes,
  release4SearchAcceptanceCorpus,
  validateRelease4Catalog
} from "@wooriai/domain";

describe("Release 4 canonical catalog", () => {
  it("meets the structural completeness floor without duplicate canonical rows", () => {
    const metrics = release4CatalogMetrics();
    expect(metrics).toMatchObject({
      domains: 24,
      categories: 120,
      subcategories: 360,
      canonicalItems: 408,
      aliases: 3278,
      highRiskItemsAwaitingProfessionalReview: 84,
      lifecycleGaps: []
    });
    expect(validateRelease4Catalog()).toEqual([]);
    expect(new Set(release4CatalogItems.map((item) => item.code)).size).toBe(release4CatalogItems.length);
    expect(new Set(release4CatalogItems.map((item) => item.nameKo)).size).toBe(release4CatalogItems.length);
  });

  it("keeps mother and child lifecycle axes independent", () => {
    const covered = new Set(
      release4CatalogItems.flatMap((item) => item.lifecycles.map((lifecycle) => `${lifecycle.axis}:${lifecycle.code}`))
    );
    for (const code of motherLifecycleCodes) expect(covered).toContain(`mother:${code}`);
    for (const code of childLifecycleCodes) expect(covered).toContain(`child:${code}`);
    expect(covered).not.toContain("mother:newborn_0_3m");
    expect(covered).not.toContain("child:pregnancy_early");
  });

  it("uses the 24 named domains as primary roots and never creates an other domain", () => {
    const domains = release4CatalogNodes.filter((node) => node.level === "domain");
    expect(domains.every((domain) => domain.parentCode === null)).toBe(true);
    expect(domains.some((domain) => domain.nameKo.includes("기타"))).toBe(false);
    expect(release4CatalogItems.every((item) => /^C\d{2}$/.test(item.domainCode))).toBe(true);
  });

  it("does not mark pending high-risk content as reviewed or directly recommended", () => {
    const highRisk = release4CatalogItems.filter((item) => item.safetyTier === "high");
    expect(highRisk).toHaveLength(84);
    expect(highRisk.every((item) => item.recommendationState === "professional_review_required")).toBe(true);
  });

  it("covers every optional scenario while keeping medical context non-recommended", () => {
    const covered = new Set(release4CatalogItems.flatMap((item) => item.scenarioCodes));
    expect([...catalogScenarioCodes].filter((code) => !covered.has(code))).toEqual([]);
    const medical = release4CatalogItems.filter((item) => item.scenarioCodes.includes("preterm_or_nicu"));
    expect(medical.length).toBeGreaterThan(0);
    expect(medical.every((item) => item.safetyTier === "high" && item.recommendationState === "professional_review_required")).toBe(true);
  });

  it("locks a 200-query Korean acceptance corpus including common synonyms", () => {
    expect(release4SearchAcceptanceCorpus).toHaveLength(200);
    expect(release4SearchAcceptanceCorpus).toEqual(expect.arrayContaining([
      { query: "베이비캐리어", expectedNameKo: "신생아 아기띠" },
      { query: "젖병솔", expectedNameKo: "젖병 세척솔" },
      { query: "코흡인기", expectedNameKo: "코 관리 흡입기" }
    ]));
  });
});
