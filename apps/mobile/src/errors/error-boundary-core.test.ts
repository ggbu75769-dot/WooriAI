import { describe, expect, it } from "vitest";
import {
  ERROR_BOUNDARY_LOG_PREFIX,
  caughtBoundaryState,
  devErrorDetail,
  formatBoundaryLog,
  initialBoundaryState,
  resetBoundaryState
} from "./error-boundary-core";

// MOB-108 — unit tests for the ErrorBoundary's pure logic. The RN class component itself is
// pinned by error-boundary-contract.test.ts (source-contract convention: react-native is not
// runtime-executable under this repo's plain-node vitest setup).
describe("MOB-108 error boundary core logic", () => {
  it("starts healthy: no error, retryKey 0", () => {
    expect(initialBoundaryState()).toEqual({ error: null, retryKey: 0 });
  });

  it("captures a thrown Error as-is", () => {
    const boom = new Error("boom");
    expect(caughtBoundaryState(boom).error).toBe(boom);
  });

  it("normalizes non-Error throwables (strings/objects) into an Error", () => {
    const fromString = caughtBoundaryState("문자열 throw").error;
    expect(fromString).toBeInstanceOf(Error);
    expect(fromString?.message).toBe("문자열 throw");

    const fromNull = caughtBoundaryState(null).error;
    expect(fromNull).toBeInstanceOf(Error);
  });

  it("retry resets the error and bumps retryKey so children remount", () => {
    const caught = { ...initialBoundaryState(), ...caughtBoundaryState(new Error("crash")) };
    expect(caught.error).not.toBeNull();

    const afterRetry = resetBoundaryState(caught);
    expect(afterRetry.error).toBeNull();
    expect(afterRetry.retryKey).toBe(caught.retryKey + 1);

    // A second crash + retry keeps incrementing — every retry forces a fresh subtree.
    const afterSecondRetry = resetBoundaryState({ ...afterRetry, ...caughtBoundaryState(new Error("again")) });
    expect(afterSecondRetry).toEqual({ error: null, retryKey: 2 });
  });

  it("formats console.error args with the structured [MOB-108][ErrorBoundary] prefix", () => {
    const error = new Error("렌더 크래시");
    const [line, payload] = formatBoundaryLog(error, "\n    in BrokenScreen\n    in RootLayout");

    expect(ERROR_BOUNDARY_LOG_PREFIX).toBe("[MOB-108][ErrorBoundary]");
    expect(line).toBe("[MOB-108][ErrorBoundary] render crash: 렌더 크래시");
    expect(payload).toMatchObject({
      name: "Error",
      message: "렌더 크래시",
      componentStack: "\n    in BrokenScreen\n    in RootLayout"
    });
    expect(payload.stack).toBe(error.stack ?? null);
  });

  it("tolerates a missing componentStack (older RN paths pass undefined)", () => {
    const [, payload] = formatBoundaryLog(new Error("x"), undefined);
    expect(payload.componentStack).toBeNull();
  });

  describe("devErrorDetail (__DEV__-only stack snippet)", () => {
    it("returns null outside dev builds, whatever the error", () => {
      expect(devErrorDetail(new Error("boom"), false)).toBeNull();
      expect(devErrorDetail(null, false)).toBeNull();
    });

    it("returns null in dev when there is no error", () => {
      expect(devErrorDetail(null, true)).toBeNull();
    });

    it("truncates the stack to the first N lines in dev", () => {
      const error = new Error("boom");
      error.stack = ["Error: boom", ...Array.from({ length: 20 }, (_, i) => `    at frame${i}`)].join("\n");

      const detail = devErrorDetail(error, true, 6);
      expect(detail).not.toBeNull();
      const lines = (detail as string).split("\n");
      expect(lines).toHaveLength(6);
      expect(lines[0]).toBe("Error: boom");
      expect(detail).not.toContain("frame10");
    });

    it("falls back to name+message when the error has no stack", () => {
      const error = new Error("스택 없음");
      error.stack = undefined;
      expect(devErrorDetail(error, true)).toBe("Error: 스택 없음");
    });
  });
});
