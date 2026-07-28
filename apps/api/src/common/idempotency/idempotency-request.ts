import { createHash } from "node:crypto";

export function canonicalIdempotencyTarget(actualTarget: string): string {
  const parsed = new URL(actualTarget, "http://idempotency.local");
  const entries = [...parsed.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyOrder = leftKey.localeCompare(rightKey);
    return keyOrder !== 0 ? keyOrder : leftValue.localeCompare(rightValue);
  });
  const query = new URLSearchParams();
  for (const [key, value] of entries) query.append(key, value);
  const encoded = query.toString();
  return `${parsed.pathname}${encoded ? `?${encoded}` : ""}`;
}

export function idempotencyRequestHash(actualTarget: string, body: unknown): string {
  return createHash("sha256")
    .update(`${canonicalIdempotencyTarget(actualTarget)}\n${JSON.stringify(body ?? {})}`)
    .digest("hex");
}
