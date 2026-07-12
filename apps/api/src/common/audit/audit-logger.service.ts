import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type AuditLogInput = {
  actorUserId?: string | null;
  householdId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipHash?: string | null;
};

export type AuditLogEntry = AuditLogInput & {
  id: string;
  createdAt: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

/**
 * Records audit trail entries.
 *
 * Entries are kept in an in-memory array (existing tests read `.entries`
 * synchronously) AND best-effort persisted to the `audit_logs` Postgres table via
 * Prisma, which is the durable store admin RBAC actions rely on. Persistence
 * failures (DB unreachable, FK/type mismatches for values that aren't real UUIDs)
 * are logged and swallowed rather than thrown — the in-memory record always
 * succeeds, so callers (many of which are on hot domain-action paths) are never
 * blocked or broken by an audit-log persistence problem.
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private readonly recordedEntries: AuditLogEntry[] = [];

  // Optional so unit tests can construct this service directly (`new
  // AuditLoggerService()`) without a Nest DI container or a live database, same as
  // before this class gained Prisma persistence.
  constructor(@Inject(PrismaService) private readonly prisma?: PrismaService) {}

  get entries() {
    return [...this.recordedEntries];
  }

  async record(input: AuditLogInput): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      createdAt: new Date(),
      ...input
    };
    this.recordedEntries.push(entry);
    await this.persist(entry);
    return entry;
  }

  private async persist(entry: AuditLogEntry) {
    if (!this.prisma) {
      return;
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          id: entry.id,
          actorUserId: asUuidOrNull(entry.actorUserId),
          householdId: asUuidOrNull(entry.householdId),
          action: entry.action,
          targetType: entry.targetType,
          targetId: asUuidOrNull(entry.targetId),
          beforeJson: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
          afterJson: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
          ipHash: entry.ipHash ?? undefined,
          createdAt: entry.createdAt
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit log entry "${entry.action}" (kept in-memory only): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
