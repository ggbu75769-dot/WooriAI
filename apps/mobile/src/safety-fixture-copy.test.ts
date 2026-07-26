import { afterEach, describe, expect, it, vi } from "vitest";

describe("installed safety-alternative fixture copy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not label every accepted evidence type as official evidence", async () => {
    vi.stubEnv("EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE", "1");
    const localBackend = await import("./api/local-backend");
    const childId = localBackend.listChildren().children[0]!.id;
    const alert = localBackend.getCatalogSafetyAlerts(childId).alerts[0]!;

    expect(alert.actionGuidance).toContain("검증 근거");
    expect(alert.actionGuidance).not.toContain("공식 근거");
  });
});
