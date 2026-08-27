/**
 * Opaque delta-sync cursor: base64("<updatedAt ISO 8601>|<id>"), matching design
 * doc docs/5차/round5a-sprint1-plan.md §2.3. Encodes the (updatedAt, id) stable
 * sort key of the last row a client has already consumed.
 *
 * `id`는 언제나 `expenses.id`(Prisma `@db.Uuid`)이고, `updatedAt`은 `@updatedAt`이
 * 채우는 Prisma 클라이언트 `Date`(밀리초)다 — 아래 두 검증이 그 두 불변식을 지킨다.
 */

import { isUuid } from "../common/validation/uuid";

export type SyncCursor = {
  updatedAt: Date;
  id: string;
};

const SEPARATOR = "|";

/**
 * R24-L4: `toISOString()`이 찍는 UTC 밀리초 3자리 형태 — 인코더가 만들 수 있는
 * 유일한 날짜 모양이다. `expenses.updated_at`은 `timestamptz(6)`지만 Prisma
 * 클라이언트가 쓰는 값은 JS `Date`(ms)라 왕복이 무손실이고, 그래서 디코더가 이
 * 형태만 받아들여도 정상 커서는 하나도 거절되지 않는다. sub-ms 정밀도가 들어오면
 * `new Date()`가 조용히 잘라 경계 행을 흘릴 수 있으므로 손상 커서로 본다.
 */
const ISO_MS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

/**
 * R24-M2: `id`는 UUID 형식까지 확인한다. 구조는 맞지만 id가 UUID가 아닌 커서
 * (`base64("2026-07-06T00:00:00.000Z|not-a-uuid")`)를 통과시키면 그 값이 그대로
 * `expenses.id`(@db.Uuid) 술어에 들어가 Prisma 드라이버 예외 → GlobalExceptionFilter
 * 에서 **500**이 된다. 사용자 입력이 원인인 오류이므로 여기서 InvalidCursorError로
 * 잡아 400 `SYNC_CURSOR_INVALID`로 내보낸다(sync.service.ts decodeOrThrow).
 */
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
  if (!isUuid(id) || !ISO_MS_PATTERN.test(isoDate) || Number.isNaN(updatedAt.getTime())) {
    throw new InvalidCursorError();
  }
  return { updatedAt, id };
}
