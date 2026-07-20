import { describe, expect, it } from "vitest";
import {
  evaluateArtifactSourceBinding,
  verifyBuildSourceSnapshots
} from "./release5v-source-binding";

const A = "A".repeat(64);
const B = "B".repeat(64);

describe("release5v source binding", () => {
  it("rejects a caller-provided snapshot that does not match current source", () => {
    expect(() => verifyBuildSourceSnapshots(A, B, B)).toThrow(
      `SOURCE_SNAPSHOT_EXPECTED_MISMATCH expected=${A} current=${B}`
    );
  });

  it("rejects source changes that occur while Gradle is building", () => {
    expect(() => verifyBuildSourceSnapshots(undefined, A, B)).toThrow(
      `SOURCE_CHANGED_DURING_ANDROID_BUILD before=${A} after=${B}`
    );
  });

  it("records a stable internally computed source snapshot", () => {
    expect(verifyBuildSourceSnapshots(undefined, A, A)).toEqual({
      expectedSha256: null,
      beforeSha256: A,
      afterSha256: A,
      status: "VERIFIED_STABLE"
    });
  });

  it("reports BOUND only for a verified build that still matches current source", () => {
    expect(evaluateArtifactSourceBinding(A, "VERIFIED_STABLE", A)).toBe("BOUND");
    expect(evaluateArtifactSourceBinding(A, "VERIFIED_STABLE", B)).toBe("STALE");
    expect(evaluateArtifactSourceBinding(A, undefined, A)).toBe("UNVERIFIED");
    expect(evaluateArtifactSourceBinding(undefined, "VERIFIED_STABLE", A)).toBe("UNBOUND");
  });
});
