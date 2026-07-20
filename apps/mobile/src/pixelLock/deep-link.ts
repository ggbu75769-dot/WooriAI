const pixelLockScreenIds = new Set([
  "SPL-001",
  "HOME-001",
  "EXP-001",
  "ITEM-001",
  "ITEM-002",
  "REP-001",
  "FAM-001",
  "IMP-003",
  "SET-001",
  "PAY-001",
  "PAY-002",
  "EXP-PAY-001",
  "PROFILE-GENDER-001",
  "ITEM-CATALOG-001",
  "ITEM-COVERAGE-001"
]);

export type PixelLockRequest = { overrides?: string; screen: string };

export function parsePixelLockRequest(url: string): PixelLockRequest | null {
  try {
    const parsed = new URL(url);
    const isPixelLockRoute =
      parsed.protocol === "wooriai:" &&
      (parsed.hostname === "pixel-lock" || (!parsed.hostname && parsed.pathname === "/pixel-lock"));
    if (!isPixelLockRoute) return null;
    const screen = parsed.searchParams.get("screen");
    if (!screen || !pixelLockScreenIds.has(screen)) return null;
    const overrides = parsed.searchParams.get("overrides");
    return { screen, ...(overrides ? { overrides } : {}) };
  } catch {
    return null;
  }
}

export function resolvePixelLockHref(url: string): string | null {
  const request = parsePixelLockRequest(url);
  if (!request) return null;
  return `/pixel-lock?screen=${encodeURIComponent(request.screen)}${
    request.overrides ? `&overrides=${encodeURIComponent(request.overrides)}` : ""
  }`;
}
