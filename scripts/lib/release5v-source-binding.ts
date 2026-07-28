const SHA256 = /^[A-F0-9]{64}$/;

function normalizedSha256(value: string, label: string) {
  const normalized = value.toUpperCase();
  if (!SHA256.test(normalized)) throw new Error(`INVALID_${label}_SHA256 ${value}`);
  return normalized;
}

export function verifyBuildSourceSnapshots(
  expectedSha256: string | undefined,
  beforeSha256: string,
  afterSha256: string
) {
  const before = normalizedSha256(beforeSha256, "SOURCE_SNAPSHOT_BEFORE");
  const after = normalizedSha256(afterSha256, "SOURCE_SNAPSHOT_AFTER");
  const expected = expectedSha256
    ? normalizedSha256(expectedSha256, "SOURCE_SNAPSHOT_EXPECTED")
    : null;

  if (expected && expected !== before) {
    throw new Error(`SOURCE_SNAPSHOT_EXPECTED_MISMATCH expected=${expected} current=${before}`);
  }
  if (before !== after) {
    throw new Error(`SOURCE_CHANGED_DURING_ANDROID_BUILD before=${before} after=${after}`);
  }

  return {
    expectedSha256: expected,
    beforeSha256: before,
    afterSha256: after,
    status: "VERIFIED_STABLE" as const
  };
}

export function evaluateArtifactSourceBinding(
  reportedSha256: string | null | undefined,
  verificationStatus: string | null | undefined,
  currentSha256: string
): "BOUND" | "STALE" | "UNVERIFIED" | "UNBOUND" {
  if (!reportedSha256) return "UNBOUND";
  if (verificationStatus !== "VERIFIED_STABLE") return "UNVERIFIED";
  const reported = normalizedSha256(reportedSha256, "REPORTED_SOURCE_SNAPSHOT");
  const current = normalizedSha256(currentSha256, "CURRENT_SOURCE_SNAPSHOT");
  return reported === current ? "BOUND" : "STALE";
}
