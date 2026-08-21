import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { toExpenseSnapshot } from "../finance/expense-snapshot";
import { decodeCursor, encodeCursor, InvalidCursorError } from "./cursor";
import { SYNC_DEFAULT_LIMIT } from "./dto/sync-query.dto";

export type SyncChange =
  | { type: "expense"; op: "upsert"; data: ReturnType<typeof toExpenseSnapshot> }
  | { type: "expense"; op: "delete"; id: string; version: number; deletedAt: string };

export type SyncChangesResult = {
  changes: SyncChange[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Delta sync (MOB-103, design doc §2.3): `GET /v1/sync/changes` for the caller's
 * household(s), keyset-paginated by the stable `(updatedAt, id)` sort key so a
 * client can page through every change exactly once, regardless of concurrent
 * writes landing mid-page. Soft-deleted expenses come back as `delete`
 * tombstones instead of being silently dropped, so an offline client that
 * missed the live delete still converges.
 *
 * Reads Expense rows directly via PrismaService rather than going through
 * the onboarding store services -- this module is new and self-contained, and (like
 * finance/expenses.service.ts) is deliberately kept out of
 * onboarding/ store services, which concurrent work this sprint
 * owns.
 */
@Injectable()
export class SyncService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getChanges(user: AuthenticatedUser, cursor: string | undefined, limit: number | undefined) {
    const householdIds = user.households.map((household) => household.id);
    const effectiveLimit = limit ?? SYNC_DEFAULT_LIMIT;

    if (householdIds.length === 0) {
      return { changes: [], nextCursor: cursor ?? null, hasMore: false };
    }

    const decoded = cursor ? this.decodeOrThrow(cursor) : null;

    const where: Prisma.ExpenseWhereInput = {
      householdId: { in: householdIds },
      ...(decoded
        ? {
            OR: [
              { updatedAt: { gt: decoded.updatedAt } },
              { updatedAt: decoded.updatedAt, id: { gt: decoded.id } }
            ]
          }
        : {})
    };

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: effectiveLimit + 1
    });

    const hasMore = rows.length > effectiveLimit;
    const page = hasMore ? rows.slice(0, effectiveLimit) : rows;

    const changes: SyncChange[] = page.map((row) =>
      row.deletedAt
        ? { type: "expense", op: "delete", id: row.id, version: row.version, deletedAt: row.deletedAt.toISOString() }
        : { type: "expense", op: "upsert", data: toExpenseSnapshot(row) }
    );

    const last = page[page.length - 1];
    const nextCursor = last ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : (cursor ?? null);

    return { changes, nextCursor, hasMore };
  }

  private decodeOrThrow(cursor: string) {
    try {
      return decodeCursor(cursor);
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        throw new BadRequestException({ code: "SYNC_CURSOR_INVALID", message: "동기화 커서가 올바르지 않아요." });
      }
      throw error;
    }
  }
}
