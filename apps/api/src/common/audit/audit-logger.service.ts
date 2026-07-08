import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

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

@Injectable()
export class AuditLoggerService {
  private readonly recordedEntries: AuditLogEntry[] = [];

  get entries() {
    return [...this.recordedEntries];
  }

  async record(input: AuditLogInput): Promise<AuditLogEntry> {
    const entry = {
      id: randomUUID(),
      createdAt: new Date(),
      ...input
    };
    this.recordedEntries.push(entry);
    return entry;
  }
}
