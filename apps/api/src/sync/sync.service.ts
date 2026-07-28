import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { toExpenseSnapshot } from "../finance/expense-snapshot";
import {
  decodeCursor,
  decodeCursorV2,
  encodeCursor,
  encodeCursorV2,
  InvalidCursorError,
  type SyncCursorV2
} from "./cursor";
import { idempotencyRequestHash } from "../common/idempotency/idempotency-request";
import type { LegacyOfflineMutationDto } from "./dto/legacy-reconcile.dto";
import { SYNC_DEFAULT_LIMIT } from "./dto/sync-query.dto";

export type SyncChange =
  | { type: "expense"; op: "upsert"; data: ReturnType<typeof toExpenseSnapshot> }
  | { type: "expense"; op: "delete"; id: string; version: number; deletedAt: string };

export type SyncChangesResult = {
  changes: SyncChange[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SyncChangeV2 =
  | {
      type: "expense";
      op: "upsert";
      householdId: string;
      childId: string;
      data: ReturnType<typeof toExpenseSnapshot>;
    }
  | {
      type: "expense";
      op: "delete";
      householdId: string;
      childId: string;
      id: string;
      version: number;
      deletedAt: string;
    };

function cursorPositionAfterBaseline(
  position: { updatedAt: Date; id: string },
  baseline: { updatedAt: Date; id: string }
): boolean {
  const timeDifference = position.updatedAt.getTime() - baseline.updatedAt.getTime();
  return timeDifference > 0 || (timeDifference === 0 && position.id > baseline.id);
}

/**
 * Delta sync (MOB-103, design doc §2.3): `GET /v1/sync/changes` for the caller's
 * household(s), keyset-paginated by the stable `(updatedAt, id)` sort key so a
 * client can page through every change exactly once, regardless of concurrent
 * writes landing mid-page. Soft-deleted expenses come back as `delete`
 * tombstones instead of being silently dropped, so an offline client that
 * missed the live delete still converges.
 *
 * Reads Expense rows directly via PrismaService rather than going through
 * OnboardingStoreService -- this module is new and self-contained, and (like
 * finance/expenses.service.ts) is deliberately kept out of
 * onboarding/onboarding-store.service.ts, which concurrent work this sprint
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

  async getChangesV2(
    user: AuthenticatedUser,
    householdId: string,
    cursor: string | undefined,
    limit: number | undefined
  ) {
    if (!user.households.some((household) => household.id === householdId)) {
      throw new ForbiddenException({
        code: "SYNC_HOUSEHOLD_FORBIDDEN",
        message: "이 가구의 동기화 데이터를 볼 권한이 없어요."
      });
    }

    const effectiveLimit = limit ?? SYNC_DEFAULT_LIMIT;
    const decoded = cursor ? this.decodeV2OrThrow(cursor, householdId) : null;
    const completedPreviousBaseline =
      decoded &&
      decoded.updatedAt.getTime() === decoded.baselineUpdatedAt.getTime() &&
      decoded.id === decoded.baselineId;

    let baseline: { updatedAt: Date; id: string } | null =
      decoded && !completedPreviousBaseline
        ? { updatedAt: decoded.baselineUpdatedAt, id: decoded.baselineId }
        : null;

    if (!baseline) {
      baseline = await this.prisma.expense.findFirst({
        where: { householdId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { updatedAt: true, id: true }
      });
    }

    if (!baseline) {
      return { changes: [], nextCursor: null, hasMore: false };
    }

    const position = decoded
      ? { updatedAt: decoded.updatedAt, id: decoded.id }
      : null;
    if (position && cursorPositionAfterBaseline(position, baseline)) {
      throw new BadRequestException({
        code: "SYNC_CURSOR_INVALID",
        message: "동기화 커서가 올바르지 않아요."
      });
    }
    const where: Prisma.ExpenseWhereInput = {
      householdId,
      AND: [
        ...(position
          ? [{
              OR: [
                { updatedAt: { gt: position.updatedAt } },
                { updatedAt: position.updatedAt, id: { gt: position.id } }
              ]
            }]
          : []),
        {
          OR: [
            { updatedAt: { lt: baseline.updatedAt } },
            { updatedAt: baseline.updatedAt, id: { lte: baseline.id } }
          ]
        }
      ]
    };

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: effectiveLimit + 1
    });
    const hasMore = rows.length > effectiveLimit;
    const page = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const changes: SyncChangeV2[] = page.map((row) =>
      row.deletedAt
        ? {
            type: "expense",
            op: "delete",
            householdId: row.householdId,
            childId: row.childId,
            id: row.id,
            version: row.version,
            deletedAt: row.deletedAt.toISOString()
          }
        : {
            type: "expense",
            op: "upsert",
            householdId: row.householdId,
            childId: row.childId,
            data: toExpenseSnapshot(row)
          }
    );

    const last = page[page.length - 1];
    // A baseline row can be updated after the high-watermark lookup and therefore
    // disappear from this frozen page. A terminal page still advances exactly to
    // the immutable baseline so the next request starts a fresh run instead of
    // pinning this cursor to the last older row forever.
    const nextPosition = hasMore ? (last ?? position ?? baseline) : baseline;
    const nextCursor = encodeCursorV2({
      householdId,
      baselineUpdatedAt: baseline.updatedAt,
      baselineId: baseline.id,
      updatedAt: nextPosition.updatedAt,
      id: nextPosition.id
    });
    return { changes, nextCursor, hasMore };
  }

  async reconcileLegacy(user: AuthenticatedUser, mutations: LegacyOfflineMutationDto[]) {
    const results = [];
    for (const mutation of mutations) {
      const reservations = await this.prisma.idempotencyKey.findMany({
        where: { userId: user.id, idemKey: mutation.idempotencyKey },
        select: {
          endpoint: true,
          requestHash: true,
          responseJson: true,
          statusCode: true,
          expiresAt: true
        }
      });
      const allowedEndpoint = reservations.find((row) => {
        if (!row.endpoint.startsWith(`${mutation.method}:`)) return false;
        return mutation.method === "POST"
          ? row.endpoint.includes("children/:childId/expenses")
          : row.endpoint.includes("expenses/:expenseId");
      });
      if (!allowedEndpoint || allowedEndpoint.expiresAt < new Date()) {
        results.push({
          sourceLocalId: mutation.sourceLocalId,
          sourceMutationId: mutation.sourceMutationId,
          disposition: "ambiguous" as const,
          reasonCode: "CURRENT_USER_IDEMPOTENCY_PROOF_NOT_FOUND"
        });
        continue;
      }
      const candidatePaths = [mutation.path, `/api/v1${mutation.path}`];
      if (!candidatePaths.some((path) =>
        idempotencyRequestHash(path, mutation.body) === allowedEndpoint.requestHash
      )) {
        results.push({
          sourceLocalId: mutation.sourceLocalId,
          sourceMutationId: mutation.sourceMutationId,
          disposition: "ambiguous" as const,
          reasonCode: "IDEMPOTENCY_REQUEST_HASH_MISMATCH"
        });
        continue;
      }
      results.push({
        sourceLocalId: mutation.sourceLocalId,
        sourceMutationId: mutation.sourceMutationId,
        disposition: allowedEndpoint.statusCode == null ? "attributable" as const : "already_synced" as const,
        reasonCode: allowedEndpoint.statusCode == null
          ? "CURRENT_USER_PENDING_RESERVATION_MATCH"
          : "CURRENT_USER_COMPLETED_REQUEST_MATCH",
        response: allowedEndpoint.statusCode == null ? null : allowedEndpoint.responseJson
      });
    }
    return { results };
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

  private decodeV2OrThrow(cursor: string, householdId: string): SyncCursorV2 {
    try {
      return decodeCursorV2(cursor, householdId);
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        throw new BadRequestException({
          code: "SYNC_CURSOR_INVALID",
          message: "동기화 커서가 만료되었거나 현재 가구와 맞지 않아요.",
          resetRequired: true
        });
      }
      throw error;
    }
  }
}
