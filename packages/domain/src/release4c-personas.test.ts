import { describe, expect, it } from "vitest";
import { release4BundleDefinitions, release4CatalogItems } from "./release4-catalog";
import { release4cPersonas } from "./release4c-personas";

describe("Release 4C persona fixtures", () => {
  it("covers all 20 required personas with real lifecycle items and bundles", () => {
    expect(release4cPersonas).toHaveLength(20);
    expect(new Set(release4cPersonas.map((persona) => persona.id)).size).toBe(20);
    for (const persona of release4cPersonas) {
      const lifecycleItems = release4CatalogItems.filter((item) => item.lifecycles.some((rule) => rule.axis === persona.lifecycleAxis && rule.code === persona.lifecycleCode));
      expect(lifecycleItems.length, persona.id).toBeGreaterThan(0);
      expect(release4BundleDefinitions.some((bundle) => bundle.nameKo === persona.expectedBundleNameKo), persona.id).toBe(true);
      if (persona.expectedContextMatch) {
        expect(lifecycleItems.some((item) => item.scenarioCodes.some((code) => persona.contextCodes.includes(code))), persona.id).toBe(true);
      }
    }
  });

  it("keeps medical-risk personas explicitly review constrained", () => {
    for (const persona of release4cPersonas.filter((entry) => entry.safetyConstraint)) {
      expect(persona.safetyConstraint).toBe("professional_review_required");
    }
  });
});
