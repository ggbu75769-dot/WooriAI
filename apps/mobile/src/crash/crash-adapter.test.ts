import { describe, expect, it, vi } from "vitest";
import { configureCrashAdapter, installGlobalCrashHandlers, reportCrash } from "./crash-adapter";

describe("mobile crash adapter", () => {
  it("defaults to no-op and sends only a normalized code to an optional adapter", () => {
    expect(() => reportCrash(new Error("person@example.com token=secret"), false)).not.toThrow();
    const capture = vi.fn();
    configureCrashAdapter({ capture });
    reportCrash(new Error("person@example.com token=secret"), true);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ fatal: true, errorName: "Error" }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("person@example.com");
  });

  it("installs a PII-safe unhandled rejection bridge", () => {
    const capture = vi.fn();
    configureCrashAdapter({ capture });
    installGlobalCrashHandlers();
    const handler = (globalThis as typeof globalThis & { onunhandledrejection?: (event: { reason: unknown }) => void }).onunhandledrejection;
    handler?.({ reason: new Error("person@example.com token=secret") });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ fatal: false }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("person@example.com");
    expect(JSON.stringify(capture.mock.calls)).not.toContain("token=secret");
  });
});
