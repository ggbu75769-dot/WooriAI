import { createHash } from "node:crypto";

export function idempotencyRequestHash(actualPath: string, body: unknown): string {
  return createHash("sha256")
    .update(`${actualPath.split("?")[0]}\n${JSON.stringify(body ?? {})}`)
    .digest("hex");
}

