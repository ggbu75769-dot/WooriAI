import { describe, expect, it } from "vitest";
import {
  childLifecycleCodes,
  catalogScenarioCodes,
  comparePreparationTimelineRank,
  motherLifecycleCodes,
  release4CatalogItems,
  release4CatalogAuditVersion,
  release4CatalogEditorialAudit,
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
      canonicalItems: 409,
      aliases: 3287,
      highRiskItemsAwaitingProfessionalReview: 85,
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
    expect(highRisk).toHaveLength(85);
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
      { query: "코흡인기", expectedNameKo: "코 관리 흡입기" },
      { query: "역방쿠", expectedNameKo: "역류방지쿠션" }
    ]));
  });

  it("uses explicit editorial priority and keeps records out of personalized discovery", () => {
    expect(release4CatalogItems.every((item) => item.editorialReviewedAt === "2026-07-20" && item.evidenceClass.length > 0)).toBe(true);
    const ranked = [...release4CatalogItems].sort((left, right) => left.displayOrder - right.displayOrder);
    expect(ranked.slice(0, 12).map((item) => item.nameKo)).toEqual([
      "신생아 기저귀", "신생아 침대", "단단한 아기 매트리스", "고정형 매트리스 시트", "아기 체온계", "신생아 아기띠",
      "신생아 욕조", "후드형 아기 타월", "신생아 배냇저고리", "신생아 유모차", "젖병", "신생아용 카시트"
    ]);
    expect(ranked.slice(0, 20).some((item) => /(계획표|일정표|파일|서류|기록)/.test(item.nameKo))).toBe(false);
    const refluxCushion = release4CatalogItems.find((item) => item.nameKo === "역류방지쿠션");
    expect(refluxCushion).toMatchObject({ personalizedDiscovery: false, editorialPriority: 0, necessity: "conditional", safetyTier: "high", recommendationState: "professional_review_required" });
    expect(refluxCushion?.lifecycles.every((rule) => rule.priorityWeight === 0)).toBe(true);
  });

  it("stores a versioned evidence decision for every canonical item", () => {
    expect(release4CatalogAuditVersion).toBe("preparation-necessity-v2-2026-07-20");
    expect(release4CatalogEditorialAudit).toHaveLength(409);
    expect(new Set(release4CatalogEditorialAudit.map((entry) => entry.itemCode)).size).toBe(409);
    expect(release4CatalogEditorialAudit.every((entry) => entry.sources.length > 0 && entry.sources.every((source) => source.url.startsWith("https://") && source.checkedAt === "2026-07-20"))).toBe(true);
    expect(release4CatalogEditorialAudit.find((entry) => entry.itemCode === "R4-C09-018")).toMatchObject({
      judgement: "optional_search_only",
      evidenceClass: "safety_guidance",
      confidence: "medium"
    });
  });

  it("shares one deterministic server/local ranking comparator without commerce inputs", () => {
    const base = {
      bucket: "this_week" as const,
      hasPlan: false,
      userDueTime: null,
      lifecyclePriority: 100,
      contextWeight: 0,
      necessity: "recommended" as const,
      displayOrder: 100,
      code: "R4-C10-001"
    };
    expect(comparePreparationTimelineRank({ ...base, hasPlan: true, userDueTime: 1 }, base)).toBeLessThan(0);
    expect(comparePreparationTimelineRank({ ...base, bucket: "next_stage", hasPlan: true, code: "R4-C10-002" }, base)).toBeLessThan(0);
    expect(comparePreparationTimelineRank({ ...base, bucket: "this_month", code: "R4-C10-002" }, { ...base, bucket: "next_stage" })).toBeLessThan(0);
    expect(comparePreparationTimelineRank({ ...base, contextWeight: 220, code: "R4-C17-001" }, base)).toBeLessThan(0);
    expect(comparePreparationTimelineRank({ ...base, necessity: "optional", displayOrder: 1, code: "R4-C24-001" }, base)).toBeGreaterThan(0);
    expect(Object.keys(base)).not.toEqual(expect.arrayContaining(["offer", "price", "affiliate", "commission", "sponsor"]));
  });
});
