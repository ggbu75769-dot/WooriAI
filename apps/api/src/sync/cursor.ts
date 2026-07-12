/**
 * Opaque delta-sync cursor: base64("<updatedAt ISO 8601>|<id>"), matching design
 * doc docs/5차/round5a-sprint1-plan.md §2.3. Encodes the (updatedAt, id) stable
 * sort key of the last row a client has already consumed.
 */

export type SyncCursor = {
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
