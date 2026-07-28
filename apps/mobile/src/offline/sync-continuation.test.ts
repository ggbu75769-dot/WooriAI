import { describe, expect, it, vi } from "vitest";
import { resumeAfterActiveScopeFlight } from "./sync-continuation";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("bounded sync continuation", () => {
  it("does not start the next run until the active scope flight has completed", async () => {
    const active = deferred();
    const resume = vi.fn(async () => undefined);
    const continuation = resumeAfterActiveScopeFlight(() => active.promise, resume);

    await Promise.resolve();
    expect(resume).not.toHaveBeenCalled();
    active.resolve();
    await continuation;
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("starts immediately when no scope flight is active", async () => {
    const resume = vi.fn(async () => undefined);
    await resumeAfterActiveScopeFlight(() => undefined, resume);
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
