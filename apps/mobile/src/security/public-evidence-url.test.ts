import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn(async () => true) }
}));

import { openPublicEvidenceUrl, verifiedPublicEvidenceUrl } from "./public-evidence-url";

describe("mobile public evidence URL guard", () => {
  it("opens only a revalidated public HTTPS URL", async () => {
    const opener = vi.fn(async () => true);
    await openPublicEvidenceUrl("https://www.wooriai.kr/evidence", opener);
    expect(opener).toHaveBeenCalledWith("https://www.wooriai.kr/evidence");
  });

  it.each([
    "http://www.wooriai.kr/evidence",
    "https://user:secret@www.wooriai.kr/evidence",
    "https://127.0.0.1/evidence",
    "https://100.64.0.1/evidence",
    "https://192.0.2.1/evidence",
    "https://198.51.100.1/evidence",
    "https://203.0.113.1/evidence",
    "https://224.0.0.1/evidence",
    "https://[::1]/evidence",
    "https://[::ffff:127.0.0.1]/evidence",
    "https://[fc00::1]/evidence",
    "https://[fe80::1]/evidence",
    "https://[ff00::1]/evidence",
    "https://[2001:db8::1]/evidence",
    "https://evidence.test/path"
  ])("rejects unsafe evidence URL %s", (value) => {
    expect(() => verifiedPublicEvidenceUrl(value)).toThrow("PUBLIC_EVIDENCE_URL_BLOCKED");
  });
});
