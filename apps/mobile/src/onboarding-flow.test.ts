import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 05 mobile onboarding contract", () => {
  it("defines the fixed theme tokens and four onboarding routes", async () => {
    const { theme } = await import("./theme");
    const { onboardingSteps } = await import("./onboarding/steps");

    expect(theme.colors).toMatchObject({
      primary500: "#FF8A7A",
      primary100: "#FFE6E0",
      secondary500: "#7DDCC7",
      background: "#FFF8F1",
      textPrimary: "#242424"
    });
    expect(onboardingSteps.map((step) => step.screenId)).toEqual([
      "ONB-001",
      "ONB-002",
      "ONB-003",
      "ONB-004"
    ]);
    expect(onboardingSteps.map((step) => step.route)).toEqual([
      "/onboarding/child-status",
      "/onboarding/child-profile",
      "/onboarding/prepared-items",
      "/onboarding/budget"
    ]);
  });

  it("persists session, selected child, and onboarding progress stores", async () => {
    const { useSessionStore } = await import("./stores/session.store");
    const { useSelectedChildStore } = await import("./stores/selected-child.store");
    const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");

    useSessionStore.getState().setSession({
      accessToken: "access",
      refreshToken: "refresh",
      userId: "user-1"
    });
    useSelectedChildStore.getState().setSelectedChildId("child-1");
    useOnboardingProgressStore.getState().completeStep("ONB-001");

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      userId: "user-1"
    });
    expect(useSelectedChildStore.getState().selectedChildId).toBe("child-1");
    expect(useOnboardingProgressStore.getState().completedStepIds).toContain("ONB-001");
  });

  it("creates AUTH-001 and ONB-001 through ONB-004 route files with the image-locked visual tabs", () => {
    const routeExpectations = [
      ["app/(auth)/login.tsx", "AUTH-001"],
      ["app/(onboarding)/child-status.tsx", "ONB-001"],
      ["app/(onboarding)/child-profile.tsx", "ONB-002"],
      ["app/(onboarding)/prepared-items.tsx", "ONB-003"],
      ["app/(onboarding)/budget.tsx", "ONB-004"],
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });

  it("shows a clear login connection error instead of leaving Kakao start stuck", () => {
    const loginPath = join(mobileRoot, "app/(auth)/login.tsx");
    const loginSource = readFileSync(loginPath, "utf8");

    expect(loginSource).toContain("loginError");
    expect(loginSource).toContain("로그인 중");
    expect(loginSource).toContain("서버에 연결할 수 없어요");
  });

  it("registers /onboarding routes so login does not land on an unmatched route", () => {
    const routeAliases = [
      ["app/onboarding/child-status.tsx", "../(onboarding)/child-status"],
      ["app/onboarding/child-profile.tsx", "../(onboarding)/child-profile"],
      ["app/onboarding/prepared-items.tsx", "../(onboarding)/prepared-items"],
      ["app/onboarding/budget.tsx", "../(onboarding)/budget"]
    ];

    for (const [relativePath, expectedExport] of routeAliases) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(readFileSync(filePath, "utf8")).toContain(expectedExport);
    }
  });
});
