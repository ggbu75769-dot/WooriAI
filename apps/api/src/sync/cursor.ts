/**
 * Opaque delta-sync cursor: base64("<updatedAt ISO 8601>|<id>"), matching design
 * doc docs/5차/round5a-sprint1-plan.md §2.3. Encodes the (updatedAt, id) stable
 * sort key of the last row a client has already consumed.
 */

export type SyncCursor = {
  updatedAt: Date;
  id: string;
};

export const SYNC_CURSOR_V2_PROTOCOL = 2 as const;

export type SyncCursorV2 = {
  protocolVersion: typeof SYNC_CURSOR_V2_PROTOCOL;
  householdId: string;
  baselineUpdatedAt: Date;
  baselineId: string;
  updatedAt: Date;
  id: string;
};

const SEPARATOR = "|";

export function encodeCursor(cursor: SyncCursor): string {
  const raw = `${cursor.updatedAt.toISOString()}${SEPARATOR}${cursor.id}`;
  return Buffer.from(raw, "utf8").toString("base64");
}

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid sync cursor");
    this.name = "InvalidCursorError";
  }
}

export function decodeCursor(value: string): SyncCursor {
  let raw: string;
  try {
    raw = Buffer.from(value, "base64").toString("utf8");
  } catch {
    throw new InvalidCursorError();
  }
  const separatorIndex = raw.lastIndexOf(SEPARATOR);
  if (separatorIndex === -1) {
    throw new InvalidCursorError();
  }
  const isoDate = raw.slice(0, separatorIndex);
  const id = raw.slice(separatorIndex + 1);
  const updatedAt = new Date(isoDate);
  if (!id || Number.isNaN(updatedAt.getTime())) {
    throw new InvalidCursorError();
  }
  return { updatedAt, id };
}

type SerializedSyncCursorV2 = {
  v: number;
  h: string;
  bu: string;
  bi: string;
  u: string;
  i: string;
  s: string;
};

type UnsignedSerializedSyncCursorV2 = Omit<SerializedSyncCursorV2, "s">;

function cursorSignature(cursor: UnsignedSerializedSyncCursorV2): string {
  const payload = JSON.stringify(cursor);
  const secret = requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
  return createHmac("sha256", secret)
    .update(`wooriai-sync-cursor-v2\u0000${payload}`)
    .digest("base64url");
}

function validSignature(
  cursor: UnsignedSerializedSyncCursorV2,
  signature: unknown
): signature is string {
  if (typeof signature !== "string" || signature.length === 0) return false;
  const expected = Buffer.from(cursorSignature(cursor), "base64url");
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encodeCursorV2(cursor: Omit<SyncCursorV2, "protocolVersion">): string {
  const unsigned: UnsignedSerializedSyncCursorV2 = {
    v: SYNC_CURSOR_V2_PROTOCOL,
    h: cursor.householdId,
    bu: cursor.baselineUpdatedAt.toISOString(),
    bi: cursor.baselineId,
    u: cursor.updatedAt.toISOString(),
    i: cursor.id
  };
  const serialized: SerializedSyncCursorV2 = {
    ...unsigned,
    s: cursorSignature(unsigned)
  };
  return Buffer.from(JSON.stringify(serialized), "utf8").toString("base64url");
}

function keyIsAfter(
  left: { updatedAt: Date; id: string },
  right: { updatedAt: Date; id: string }
): boolean {
  const timeDifference = left.updatedAt.getTime() - right.updatedAt.getTime();
  return timeDifference > 0 || (timeDifference === 0 && left.id > right.id);
}

export function decodeCursorV2(value: string, expectedHouseholdId: string): SyncCursorV2 {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<SerializedSyncCursorV2>;
    const unsigned: UnsignedSerializedSyncCursorV2 = {
      v: parsed.v ?? Number.NaN,
      h: parsed.h ?? "",
      bu: parsed.bu ?? "",
      bi: parsed.bi ?? "",
      u: parsed.u ?? "",
      i: parsed.i ?? ""
    };
    const baselineUpdatedAt = new Date(parsed.bu ?? "");
    const updatedAt = new Date(parsed.u ?? "");
    if (
      !validSignature(unsigned, parsed.s) ||
      parsed.v !== SYNC_CURSOR_V2_PROTOCOL ||
      parsed.h !== expectedHouseholdId ||
      typeof parsed.bi !== "string" ||
      parsed.bi.length === 0 ||
      typeof parsed.i !== "string" ||
      parsed.i.length === 0 ||
      Number.isNaN(baselineUpdatedAt.getTime()) ||
      Number.isNaN(updatedAt.getTime()) ||
      keyIsAfter(
        { updatedAt, id: parsed.i },
        { updatedAt: baselineUpdatedAt, id: parsed.bi }
      )
    ) {
      throw new InvalidCursorError();
    }
    return {
      protocolVersion: SYNC_CURSOR_V2_PROTOCOL,
      householdId: parsed.h,
      baselineUpdatedAt,
      baselineId: parsed.bi,
      updatedAt,
      id: parsed.i
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error;
    throw new InvalidCursorError();
  }
}
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSecret } from "../common/config/require-secret";
