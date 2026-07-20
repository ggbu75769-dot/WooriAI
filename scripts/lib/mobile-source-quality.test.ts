import { describe, expect, it } from "vitest";
import { analyzeMobileSourceText } from "./mobile-source-quality";

describe("mobile source-quality AST verifier", () => {
  it("accepts semantic Design System usage and a documented domain-widget exception", () => {
    const source = `
      import { AppScreen, PrimaryButton } from "../design-system";
      // release5v-source-quality-exception: chart remains domain-specific; owner=mobile-design-system; review=2026-10-01.
      import { DonutChartCard } from "../ui";
      export function Screen() { return <AppScreen><PrimaryButton label="계속" /></AppScreen>; }
    `;
    expect(analyzeMobileSourceText("apps/mobile/app/good.tsx", source)).toEqual([]);
  });

  it("reports user-outcome and source-contract violations with symbol context", () => {
    const source = `
      import { PrimaryButton } from "../ui";
      import { Ionicons } from "@expo/vector-icons";
      const selectedChild = null; const syntheticChild = { id: "fixture" };
      export function Screen({ error, queryClient, router }) {
        createChild({});
        queryClient.invalidateQueries();
        router.push(("/untyped") as any);
        return <><IconButton icon="✅" size={32} /><Text style={{ color: "#fff" }}>{error.message}</Text>{selectedChild ?? syntheticChild}<PrimaryButton numberOfLines={1} /></>;
      }
    `;
    const rules = new Set(analyzeMobileSourceText("apps/mobile/app/bad.tsx", source).map((finding) => finding.rule));
    expect(rules).toEqual(new Set([
      "LEGACY_FACADE_IMPORT",
      "MIXED_ICON_FAMILY",
      "SYNTHETIC_CHILD_FALLBACK",
      "SCREEN_CREATE_CHILD",
      "ROOT_QUERY_INVALIDATION",
      "UNTYPED_DEEP_LINK",
      "UNSAFE_ANY_CAST",
      "ICON_BUTTON_LABEL",
      "TOUCH_TARGET",
      "FUNCTIONAL_EMOJI_ICON",
      "RAW_HEX_COLOR",
      "RAW_ERROR_EXPOSURE",
      "CTA_SINGLE_LINE"
    ]));
  });

  it("rejects implicit time and randomness in the onboarding domain", () => {
    const findings = analyzeMobileSourceText(
      "packages/domain/src/onboarding.ts",
      "export const value = [Date.now(), new Date(), Math.random()];"
    );
    expect(findings.map((finding) => finding.rule)).toEqual([
      "DOMAIN_IMPLICIT_CLOCK",
      "DOMAIN_IMPLICIT_CLOCK",
      "DOMAIN_IMPLICIT_CLOCK"
    ]);
  });
});
