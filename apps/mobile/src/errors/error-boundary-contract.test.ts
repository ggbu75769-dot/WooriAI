import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * MOB-108 source contract for the global ErrorBoundary (source-grep convention — see
 * a11y-contract.test.ts / design-foundation.test.ts: react-native components aren't
 * runtime-rendered under this repo's plain-node vitest setup). The boundary's reset/log
 * logic is runtime-tested in error-boundary-core.test.ts.
 */
describe("MOB-108 global ErrorBoundary source contract", () => {
  it("is a class component wired through componentDidCatch/getDerivedStateFromError", () => {
    const src = source("src/errors/ErrorBoundary.tsx");
    expect(src).toContain("export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState>");
    expect(src).toContain("static getDerivedStateFromError(thrown: unknown)");
    expect(src).toContain("componentDidCatch(error: Error, info: React.ErrorInfo)");
    expect(src).toContain("console.error(...formatBoundaryLog(error, info.componentStack));");
  });

  it("keeps imports minimal — no hooks/stores/query/api deps that could themselves be broken", () => {
    const src = source("src/errors/ErrorBoundary.tsx");
    const importSources = [...src.matchAll(/from "([^"]+)";/g)].map((match) => match[1]);
    expect(importSources.sort()).toEqual(["../theme", "./error-boundary-core", "react", "react-native"]);
    // Belt-and-braces: nothing stateful sneaks in beyond those four (prose comments excluded).
    expect(src).not.toMatch(/import[^;]*from "(zustand|@tanstack\/react-query|[^"]*\/stores\/[^"]*)";/);
  });

  it("renders the warm in-theme fallback copy with a themed retry button", () => {
    const src = source("src/errors/ErrorBoundary.tsx");
    expect(src).toContain("앗, 문제가 생겼어요");
    // True thanks to the offline-first store (src/offline) — records persist locally pre-sync.
    expect(src).toContain("기록은 안전하게 저장되어 있어요");
    expect(src).toContain("다시 시도");
    // Cream background + coral accent from theme tokens (no hardcoded hexes).
    expect(src).toContain("backgroundColor: theme.colors.cream.bg");
    expect(src).toContain("backgroundColor: theme.colors.coral[500]");
    // A11Y-101 convention: the retry pressable announces as a labeled button.
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toContain('accessibilityLabel="다시 시도"');
  });

  it("resets via setState + retryKey bump so children remount, and gates stack detail to __DEV__", () => {
    const src = source("src/errors/ErrorBoundary.tsx");
    expect(src).toContain("this.setState((previous) => resetBoundaryState(previous));");
    expect(src).toContain("<React.Fragment key={retryKey}>{this.props.children}</React.Fragment>");
    expect(src).toContain("devErrorDetail(error, __DEV__)");
  });

  it("mounts once at the app root wrapping the Stack and both lifecycle mounts", () => {
    const layoutSource = source("app/_layout.tsx");
    expect(layoutSource).toContain('import { ErrorBoundary } from "../src/errors/ErrorBoundary";');

    const open = layoutSource.indexOf("<ErrorBoundary>");
    const close = layoutSource.indexOf("</ErrorBoundary>");
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);

    // Inside the provider shell (theme is a literal import so the fallback needs no provider),
    // but wrapping OfflineSyncLifecycle, the navigator, and PurchaseFollowupLifecycle so a
    // crash in any of them lands on the recovery screen instead of a white screen.
    expect(open).toBeGreaterThan(layoutSource.indexOf("<QueryClientProvider"));
    for (const child of ["<OfflineSyncLifecycle />", "<Stack", "<PurchaseFollowupLifecycle />"]) {
      const childIndex = layoutSource.indexOf(child);
      expect(childIndex, `${child} should be inside the ErrorBoundary`).toBeGreaterThan(open);
      expect(childIndex, `${child} should be inside the ErrorBoundary`).toBeLessThan(close);
    }
    expect(close).toBeLessThan(layoutSource.indexOf("</QueryClientProvider>"));
  });
});
