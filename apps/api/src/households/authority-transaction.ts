import type { Prisma } from "@prisma/client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortedUniqueIds(ids: readonly string[]) {
  const canonical = ids.map((id) => {
    assertUuid(id);
    return id.toLowerCase();
  });
  return [...new Set(canonical)].sort();
}

function assertUuid(id: string) {
  if (!UUID_PATTERN.test(id)) throw new Error("Authority lock id must be a UUID.");
}

/**
 * Global authority-write order:
 *   users (sorted) -> households (sorted) -> operation-specific invite/member rows.
 *
 * Callers may perform non-locking reads only to discover ids. Every security or
 * state predicate must be re-read after this helper returns.
 */
export async function lockAuthorityRows(
  tx: Prisma.TransactionClient,
  input: { userIds?: readonly string[]; householdIds?: readonly string[] }
) {
  for (const userId of sortedUniqueIds(input.userIds ?? [])) {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
  }
  for (const householdId of sortedUniqueIds(input.householdIds ?? [])) {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM households
      WHERE id = ${householdId}::uuid
      FOR UPDATE
    `;
  }
}

export async function writeAuthorityAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId?: string | null;
    householdId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }
) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      householdId: input.householdId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      beforeJson: input.before,
      afterJson: input.after
    }
  });
}
