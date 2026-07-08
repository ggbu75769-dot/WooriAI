import { describe, expect, it } from "vitest";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";

describe("AuditLoggerService", () => {
  it("records structured audit events without requiring a live database", async () => {
    const logger = new AuditLoggerService();

    const event = await logger.record({
      actorUserId: "user-1",
      householdId: "household-1",
      action: "auth.login",
      targetType: "users",
      targetId: "user-1",
      after: { provider: "kakao" },
      ipHash: "hash"
    });

    expect(event).toMatchObject({
      actorUserId: "user-1",
      householdId: "household-1",
      action: "auth.login",
      targetType: "users",
      targetId: "user-1",
      after: { provider: "kakao" },
      ipHash: "hash"
    });
    expect(event.id).toEqual(expect.any(String));
    expect(event.createdAt).toEqual(expect.any(Date));
    expect(logger.entries).toHaveLength(1);
  });
});
