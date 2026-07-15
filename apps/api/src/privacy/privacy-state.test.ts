import { describe, expect, it } from "vitest";
import { canTransitionPrivacyRequest } from "./privacy-state";

describe("privacy request state machine", () => {
  it("allows the deletion happy path and retry from failed", () => {
    expect(canTransitionPrivacyRequest("requested", "access_revoked")).toBe(true);
    expect(canTransitionPrivacyRequest("access_revoked", "processor_delete_queued")).toBe(true);
    expect(canTransitionPrivacyRequest("processor_delete_queued", "purging")).toBe(true);
    expect(canTransitionPrivacyRequest("purging", "completed")).toBe(true);
    expect(canTransitionPrivacyRequest("failed", "processor_delete_queued")).toBe(true);
  });

  it("rejects terminal-state and skipped transitions", () => {
    expect(canTransitionPrivacyRequest("completed", "purging")).toBe(false);
    expect(canTransitionPrivacyRequest("requested", "completed")).toBe(false);
    expect(canTransitionPrivacyRequest("cancelled", "requested")).toBe(false);
  });
});
