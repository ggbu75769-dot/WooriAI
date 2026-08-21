import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ONB-105 onboarding step progress indicator + save-failure retry contract.
// Like src/onboarding-flow.test.ts and src/child-profile-manual-stage-and-date-guard.test.ts,
// these are raw-source contract checks: the screens (and the shared step-ui component) import
// "react-native" transitively, whose untranspiled Flow syntax Vitest cannot parse.
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const stepScreens: Array<[string, string]> = [
  ["app/(onboarding)/child-status.tsx", "ONB-001"],
  ["app/(onboarding)/child-profile.tsx", "ONB-002"],
  ["app/(onboarding)/prepared-items.tsx", "ONB-003"],
  ["app/(onboarding)/budget.tsx", "ONB-004"]
];

const savingStepScreens = [
  "app/(onboarding)/child-profile.tsx",
  "app/(onboarding)/prepared-items.tsx",
  "app/(onboarding)/budget.tsx"
];

describe("ONB-105 step progress indicator", () => {
  it("ships one shared indicator component derived from the pinned onboardingSteps list", () => {
    const stepUiPath = "src/onboarding/step-ui.tsx";
    expect(existsSync(join(mobileRoot, stepUiPath)), `${stepUiPath} should exist`).toBe(true);

    const stepUiSource = source(stepUiPath);
    expect(stepUiSource).toContain("export function OnboardingStepProgress");
    // Step number and total must come from src/onboarding/steps.ts, not hardcoded per screen.
    expect(stepUiSource).toContain('from "./steps"');
    expect(stepUiSource).toContain("onboardingSteps.findIndex");
    expect(stepUiSource).toContain("onboardingSteps.length");
    // A11y: announced as "온보딩 4단계 중 N단계" with a progressbar role.
    expect(stepUiSource).toContain("accessibilityLabel={`온보딩 ${totalSteps}단계 중 ${stepNumber}단계`}");
    expect(stepUiSource).toContain('accessibilityRole="progressbar"');
    // Visual: dot bar + "N/4" text, colored with theme tokens (no raw hex literals).
    expect(stepUiSource).toContain("{stepNumber}/{totalSteps}");
    expect(stepUiSource).toContain("theme.colors.mainCoral");
    expect(stepUiSource).toContain("theme.colors.gray300");
    expect(stepUiSource).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  });

  it("renders the indicator with the right screenId on all four onboarding steps", () => {
    for (const [relativePath, screenId] of stepScreens) {
      const screenSource = source(relativePath);
      expect(screenSource, `${relativePath} should import the shared step-ui`).toContain(
        "../../src/onboarding/step-ui"
      );
      expect(screenSource, `${relativePath} should render its step indicator`).toContain(
        `<OnboardingStepProgress screenId="${screenId}" />`
      );
    }
  });

  it("(steps contract) the indicator's source list still has exactly the four ONB step screens", async () => {
    const { onboardingSteps } = await import("./onboarding/steps");
    expect(onboardingSteps.map((step) => step.screenId)).toEqual(["ONB-001", "ONB-002", "ONB-003", "ONB-004"]);
  });
});

describe("ONB-105 save-failure recovery", () => {
  it("ships a shared inline error card with an explicit 재시도 button", () => {
    const stepUiSource = source("src/onboarding/step-ui.tsx");
    expect(stepUiSource).toContain("export function OnboardingSaveErrorCard");
    expect(stepUiSource).toContain('accessibilityRole="alert"');
    expect(stepUiSource).toContain('label="재시도"');
    expect(stepUiSource).toContain("저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    expect(stepUiSource).toContain("onRetry");
  });

  it("wires the error card to retry the save mutation on every server-saving step", () => {
    for (const relativePath of savingStepScreens) {
      const screenSource = source(relativePath);
      expect(screenSource, `${relativePath} should show the retry card on save failure`).toContain(
        "{save.isError ? <OnboardingSaveErrorCard onRetry={() => save.mutate()} /> : null}"
      );
      // The passive error toast is replaced by the actionable card -- it must not linger.
      expect(screenSource, `${relativePath} should not keep the passive error Toast`).not.toContain("<Toast");
    }
  });

  it("un-sticks ONB-001 when the user navigates back after choosing a stage", () => {
    const childStatusSource = source("app/(onboarding)/child-status.tsx");
    expect(childStatusSource).toContain("useFocusEffect");
    expect(childStatusSource).toContain("setIsNavigating(false)");
  });

  it("keeps the MOB-101 child-create idempotency wiring intact across the retry path", () => {
    const childProfileSource = source("app/(onboarding)/child-profile.tsx");
    // A retried createChild must reuse the same Idempotency-Key (cleared only on success), so
    // tapping 재시도 can never create a duplicate child.
    expect(childProfileSource).toContain("getOrCreateChildCreateIdempotencyKey()");
    expect(childProfileSource).toContain("clearChildCreateIdempotencyKey()");
  });
});
