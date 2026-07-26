import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { JobHandlersService } from "../src/jobs/job-handlers.service";
import { PrivacyService } from "../src/privacy/privacy.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";

type AuthorityFixture = {
  householdId: string;
  owner: AuthenticatedUser;
  target: AuthenticatedUser;
  ownerMemberId: string;
  targetMemberId: string;
};

type AuditBarrier = {
  waitForWinner: () => Promise<void>;
  waitForLoser: () => Promise<void>;
  release: () => Promise<void>;
  cleanup: () => Promise<void>;
};

describe("household authority lifecycle serialization", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let runtime: HouseholdRuntimeService;
  let privacy: PrivacyService;
  let jobs: JobHandlersService;
  let barrierIndex = 0;
  const userIds = new Set<string>();
  const householdIds = new Set<string>();
  const privacyRequestIds = new Set<string>();

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_ACCESS_SECRET = "cycle6-test-access";
    process.env.JWT_REFRESH_SECRET = "cycle6-test-refresh";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = new PrismaClient();
    runtime = app.get(HouseholdRuntimeService);
    privacy = app.get(PrivacyService);
    jobs = app.get(JobHandlersService);
  });

  afterAll(async () => {
    const households = [...householdIds];
    const users = [...userIds];
    const requests = [...privacyRequestIds];
    if (requests.length) {
      await prisma.privacyRequestEvent.deleteMany({ where: { privacyRequestId: { in: requests } } });
      await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: requests } } });
      await prisma.privacyRequest.deleteMany({ where: { id: { in: requests } } });
    }
    if (households.length) {
      await prisma.auditLog.deleteMany({ where: { householdId: { in: households } } });
      await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: households } } });
      await prisma.householdInvite.deleteMany({ where: { householdId: { in: households } } });
      await prisma.householdMember.deleteMany({ where: { householdId: { in: households } } });
      await prisma.household.deleteMany({ where: { id: { in: households } } });
    }
    if (users.length) {
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: users } } });
      await prisma.userDevice.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  function context(user: { id: string; displayName: string | null }, householdId: string, role: "owner" | "co_parent"): AuthenticatedUser {
    return {
      id: user.id,
      displayName: user.displayName ?? "Cycle 6",
      email: null,
      status: "active",
      households: [{ id: householdId, name: "Cycle 6 family", role }]
    };
  }

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: {
        authProvider: "kakao",
        providerUserId: `cycle6-${label}-${randomUUID()}`,
        displayName: label,
        status: "active"
      }
    });
    userIds.add(user.id);
    return user;
  }

  async function createFixture(label: string, targetActive = true): Promise<AuthorityFixture> {
    const ownerRow = await createUser(`${label}-owner`);
    const targetRow = await createUser(`${label}-target`);
    const household = await prisma.household.create({
      data: { name: `Cycle 6 ${label}`, ownerUserId: ownerRow.id }
    });
    householdIds.add(household.id);
    const ownerMember = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: ownerRow.id,
        role: "owner",
        status: "active",
        joinedAt: new Date()
      }
    });
    const targetMember = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: targetRow.id,
        role: "co_parent",
        status: targetActive ? "active" : "pending",
        joinedAt: targetActive ? new Date() : null
      }
    });
    return {
      householdId: household.id,
      owner: context(ownerRow, household.id, "owner"),
      target: context(targetRow, household.id, "co_parent"),
      ownerMemberId: ownerMember.id,
      targetMemberId: targetMember.id
    };
  }

  async function createOwnerOnly(label: string) {
    const ownerRow = await createUser(`${label}-owner`);
    const household = await prisma.household.create({
      data: { name: `Cycle 6 ${label}`, ownerUserId: ownerRow.id }
    });
    householdIds.add(household.id);
    const member = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: ownerRow.id,
        role: "owner",
        status: "active",
        joinedAt: new Date()
      }
    });
    return { householdId: household.id, owner: context(ownerRow, household.id, "owner"), ownerMemberId: member.id };
  }

  async function pendingInvite(owner: AuthenticatedUser, householdId: string) {
    const target = await createUser("invite-target");
    const created = await runtime.createInvite(owner, householdId, "co_parent", "link");
    const token = new URL(created.inviteUrl).pathname.split("/").pop()!;
    const invite = await prisma.householdInvite.findUniqueOrThrow({
      where: { inviteTokenHash: await inviteHash(token) }
    });
    return { target, targetContext: context(target, householdId, "co_parent"), token, inviteId: invite.id };
  }

  async function inviteHash(token: string) {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(token).digest("hex");
  }

  async function expectCode(promise: Promise<unknown>, code: string) {
    try {
      await promise;
      throw new Error(`Expected ${code} rejection.`);
    } catch (error) {
      if (error instanceof Error && error.message === `Expected ${code} rejection.`) throw error;
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code });
    }
  }

  async function waitUntil(check: () => Promise<boolean>, label: string, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for ${label}.`);
  }

  async function lockWaitCount(waitEvent: "advisory" | "row") {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND (
          (${waitEvent} = 'advisory' AND wait_event = 'advisory')
          OR
          (${waitEvent} = 'row' AND wait_event_type = 'Lock' AND wait_event <> 'advisory')
        )
    `;
    return rows[0]?.count ?? 0;
  }

  async function installAuditBarrier(input: {
    action: string;
    householdId?: string;
    targetId?: string;
  }): Promise<AuditBarrier> {
    barrierIndex += 1;
    const suffix = `${process.pid}_${barrierIndex}`;
    const trigger = `cycle6_barrier_trigger_${suffix}`;
    const fn = `cycle6_barrier_fn_${suffix}`;
    const key = 6_260_000 + barrierIndex;
    const coordinator = new PrismaClient();
    let released = false;
    const scope = input.householdId
      ? `NEW.household_id = '${input.householdId}'::uuid`
      : `NEW.target_id = '${input.targetId}'::uuid`;
    await coordinator.$connect();
    await coordinator.$executeRawUnsafe(`SELECT pg_advisory_lock(${key}::bigint)`);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${fn}() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = '${input.action}' AND ${scope} THEN
          PERFORM pg_advisory_xact_lock(${key}::bigint);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER ${trigger}
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION ${fn}()
    `);
    return {
      waitForWinner: () => waitUntil(async () => (await lockWaitCount("advisory")) > 0, "winner advisory wait"),
      waitForLoser: () => waitUntil(async () => (await lockWaitCount("row")) > 0, "loser row-lock wait"),
      release: async () => {
        if (released) return;
        released = true;
        await coordinator.$executeRawUnsafe(`SELECT pg_advisory_unlock(${key}::bigint)`);
      },
      cleanup: async () => {
        if (!released) {
          await coordinator.$executeRawUnsafe(`SELECT pg_advisory_unlock(${key}::bigint)`).catch(() => undefined);
          released = true;
        }
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON audit_logs`).catch(() => undefined);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`).catch(() => undefined);
        await coordinator.$disconnect();
      }
    };
  }

  async function installAuditFailure(input: { action: string; householdId?: string; targetId?: string }) {
    barrierIndex += 1;
    const suffix = `${process.pid}_${barrierIndex}`;
    const trigger = `cycle6_failure_trigger_${suffix}`;
    const fn = `cycle6_failure_fn_${suffix}`;
    const scope = input.householdId
      ? `NEW.household_id = '${input.householdId}'::uuid`
      : `NEW.target_id = '${input.targetId}'::uuid`;
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${fn}() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = '${input.action}' AND ${scope} THEN
          RAISE EXCEPTION 'cycle6 injected audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER ${trigger}
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION ${fn}()
    `);
    return async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON audit_logs`).catch(() => undefined);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`).catch(() => undefined);
    };
  }

  async function runOrdered(
    barrier: AuditBarrier,
    winner: () => Promise<unknown>,
    loser: () => Promise<unknown>
  ) {
    const winnerPromise = winner();
    await barrier.waitForWinner();
    const loserPromise = loser();
    await barrier.waitForLoser();
    await barrier.release();
    return await Promise.allSettled([winnerPromise, loserPromise]);
  }

  async function expectHouseholdInvariant(householdId: string) {
    const household = await prisma.household.findUniqueOrThrow({ where: { id: householdId } });
    const activeMembers = await prisma.householdMember.findMany({ where: { householdId, status: "active" } });
    const activeOwners = activeMembers.filter((member) => member.role === "owner");
    if (household.status === "active" && !household.deletedAt) {
      expect(activeOwners).toEqual([expect.objectContaining({ userId: household.ownerUserId })]);
    } else {
      expect(activeMembers).toHaveLength(0);
    }
  }

  async function auditCount(householdId: string, action: string) {
    return await prisma.auditLog.count({ where: { householdId, action } });
  }

  it("forces both transfer/remove winner orders with uppercase UUID input without violating ownership", async () => {
    for (const first of ["transfer", "remove"] as const) {
      const fixture = await createFixture(`transfer-remove-${first}`);
      const barrier = await installAuditBarrier({
        action: first === "transfer" ? "household.ownership.transfer" : "household.member.remove",
        householdId: fixture.householdId
      });
      try {
        const transfer = () => runtime.transferOwnership(fixture.owner, fixture.householdId, fixture.target.id.toUpperCase());
        const remove = () => runtime.removeMember(fixture.owner, fixture.householdId, fixture.targetMemberId);
        const results = await runOrdered(barrier, first === "transfer" ? transfer : remove, first === "transfer" ? remove : transfer);
        expect(results[0].status).toBe("fulfilled");
        expect(results[1].status).toBe("rejected");
        const rejected = results[1] as PromiseRejectedResult;
        expect((rejected.reason as HttpException).getResponse()).toMatchObject({
          code: first === "transfer" ? "OWNERSHIP_CHANGED" : "OWNER_TRANSFER_TARGET_CHANGED"
        });
        await expectHouseholdInvariant(fixture.householdId);
        expect(await prisma.auditLog.count({
          where: {
            householdId: fixture.householdId,
            action: { in: ["household.ownership.transfer", "household.member.remove"] }
          }
        })).toBe(1);
        expect(await auditCount(fixture.householdId, "household.ownership.transfer")).toBe(first === "transfer" ? 1 : 0);
        expect(await auditCount(fixture.householdId, "household.member.remove")).toBe(first === "remove" ? 1 : 0);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("forces both transfer/leave winner orders without leaving a promoted owner", async () => {
    for (const first of ["transfer", "leave"] as const) {
      const fixture = await createFixture(`transfer-leave-${first}`);
      const barrier = await installAuditBarrier({
        action: first === "transfer" ? "household.ownership.transfer" : "household.member.leave",
        householdId: fixture.householdId
      });
      try {
        const transfer = () => runtime.transferOwnership(fixture.owner, fixture.householdId, fixture.target.id);
        const leave = () => runtime.leaveHousehold(fixture.target, fixture.householdId);
        const results = await runOrdered(barrier, first === "transfer" ? transfer : leave, first === "transfer" ? leave : transfer);
        expect(results[0].status).toBe("fulfilled");
        expect(results[1].status).toBe("rejected");
        const rejected = results[1] as PromiseRejectedResult;
        expect((rejected.reason as HttpException).getResponse()).toMatchObject({
          code: first === "transfer" ? "OWNER_TRANSFER_REQUIRED" : "OWNER_TRANSFER_TARGET_CHANGED"
        });
        await expectHouseholdInvariant(fixture.householdId);
        expect(await auditCount(fixture.householdId, "household.ownership.transfer")).toBe(first === "transfer" ? 1 : 0);
        expect(await auditCount(fixture.householdId, "household.member.leave")).toBe(first === "leave" ? 1 : 0);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("forces both delete/accept orders and never activates a member under an archive", async () => {
    for (const first of ["delete", "accept"] as const) {
      const fixture = await createOwnerOnly(`delete-accept-${first}`);
      const invite = await pendingInvite(fixture.owner, fixture.householdId);
      const barrier = await installAuditBarrier({
        action: first === "delete" ? "household.delete.request" : "household.invite.accept",
        householdId: fixture.householdId
      });
      try {
        const removeHousehold = () => runtime.deleteHousehold(fixture.owner, fixture.householdId);
        const accept = () => runtime.acceptInvite(invite.targetContext, invite.token);
        const results = await runOrdered(
          barrier,
          first === "delete" ? removeHousehold : accept,
          first === "delete" ? accept : removeHousehold
        );
        expect(results[0].status).toBe("fulfilled");
        expect(results[1].status).toBe("rejected");
        const rejected = results[1] as PromiseRejectedResult;
        expect((rejected.reason as HttpException).getResponse()).toMatchObject({
          code: first === "delete" ? "HOUSEHOLD_NOT_FOUND" : "OWNER_TRANSFER_REQUIRED"
        });
        await expectHouseholdInvariant(fixture.householdId);
        expect(await auditCount(fixture.householdId, "household.delete.request")).toBe(first === "delete" ? 1 : 0);
        expect(await auditCount(fixture.householdId, "household.invite.accept")).toBe(first === "accept" ? 1 : 0);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("serializes invite creation with deletion in both orders", async () => {
    for (const first of ["invite", "delete"] as const) {
      const fixture = await createOwnerOnly(`invite-delete-${first}`);
      const barrier = await installAuditBarrier({
        action: first === "invite" ? "household.invite.create" : "household.delete.request",
        householdId: fixture.householdId
      });
      try {
        const invite = () => runtime.createInvite(fixture.owner, fixture.householdId, "viewer", "link");
        const removeHousehold = () => runtime.deleteHousehold(fixture.owner, fixture.householdId);
        const results = await runOrdered(
          barrier,
          first === "invite" ? invite : removeHousehold,
          first === "invite" ? removeHousehold : invite
        );
        expect(results[0].status).toBe("fulfilled");
        if (first === "delete") {
          expect(results[1].status).toBe("rejected");
          expect(((results[1] as PromiseRejectedResult).reason as HttpException).getResponse())
            .toMatchObject({ code: "HOUSEHOLD_NOT_FOUND" });
        } else {
          expect(results[1].status).toBe("fulfilled");
        }
        expect(await prisma.householdInvite.count({
          where: { householdId: fixture.householdId, status: "pending" }
        })).toBe(0);
        await expectHouseholdInvariant(fixture.householdId);
        expect(await auditCount(fixture.householdId, "household.invite.create")).toBe(first === "invite" ? 1 : 0);
        expect(await auditCount(fixture.householdId, "household.delete.request")).toBe(1);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("rejects expired invite acceptance and never rewrites an accepted invite as expired", async () => {
    const expiredFixture = await createOwnerOnly("invite-expired");
    const expired = await pendingInvite(expiredFixture.owner, expiredFixture.householdId);
    const expiredCreatedAt = new Date(Date.now() - 2_000);
    await prisma.householdInvite.update({
      where: { id: expired.inviteId },
      data: { createdAt: expiredCreatedAt, expiresAt: new Date(expiredCreatedAt.getTime() + 1_000) }
    });
    await expectCode(runtime.acceptInvite(expired.targetContext, expired.token), "INVITE_NOT_PENDING");
    await expectCode(runtime.getInvite(expired.token), "INVITE_NOT_PENDING");
    expect(await prisma.householdInvite.findUniqueOrThrow({ where: { id: expired.inviteId } }))
      .toMatchObject({ status: "expired", acceptedByUserId: null });

    const acceptedFixture = await createOwnerOnly("invite-accepted-past-expiry");
    const accepted = await pendingInvite(acceptedFixture.owner, acceptedFixture.householdId);
    await runtime.acceptInvite(accepted.targetContext, accepted.token);
    const acceptedCreatedAt = new Date(Date.now() - 2_000);
    await prisma.householdInvite.update({
      where: { id: accepted.inviteId },
      data: { createdAt: acceptedCreatedAt, expiresAt: new Date(acceptedCreatedAt.getTime() + 1_000) }
    });
    await expectCode(runtime.getInvite(accepted.token), "INVITE_NOT_PENDING");
    expect(await prisma.householdInvite.findUniqueOrThrow({ where: { id: accepted.inviteId } }))
      .toMatchObject({ status: "accepted", acceptedByUserId: accepted.target.id });
  });

  async function dueDeletion(owner: AuthenticatedUser) {
    const request = await privacy.requestDeletion(owner);
    privacyRequestIds.add(request.id);
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: { dueAt: new Date(Date.now() - 1_000) }
    });
    return request.id;
  }

  it("serializes privacy activation with invite acceptance in both orders", async () => {
    for (const first of ["privacy", "accept"] as const) {
      const deleting = await createOwnerOnly(`privacy-accept-deleting-${first}`);
      const host = await createOwnerOnly(`privacy-accept-host-${first}`);
      const invite = await pendingInvite(host.owner, host.householdId);
      await prisma.householdInvite.update({
        where: { id: invite.inviteId },
        data: { acceptedByUserId: null }
      });
      const tokenHash = await inviteHash(invite.token);
      const inviteRow = await prisma.householdInvite.findUniqueOrThrow({ where: { inviteTokenHash: tokenHash } });
      const requestId = await dueDeletion(deleting.owner);
      const acceptingContext: AuthenticatedUser = {
        ...deleting.owner,
        households: []
      };
      const barrier = await installAuditBarrier({
        action: first === "privacy" ? "privacy.deletion.access-revoked" : "household.invite.accept",
        ...(first === "privacy" ? { targetId: requestId } : { householdId: host.householdId })
      });
      try {
        const activate = () => privacy.activateDueDeletion(requestId);
        const accept = () => runtime.acceptInvite(acceptingContext, invite.token);
        const results = await runOrdered(barrier, first === "privacy" ? activate : accept, first === "privacy" ? accept : activate);
        expect(results[0].status).toBe("fulfilled");
        if (first === "privacy") {
          expect(results[1].status).toBe("rejected");
        } else {
          expect(results[1].status).toBe("fulfilled");
        }
        const hostMember = await prisma.householdMember.findUnique({
          where: { householdId_userId: { householdId: inviteRow.householdId, userId: deleting.owner.id } }
        });
        expect(hostMember?.status ?? "absent").not.toBe("active");
        await expectHouseholdInvariant(deleting.householdId);
        await expectHouseholdInvariant(host.householdId);
        expect(await auditCount(host.householdId, "household.invite.accept")).toBe(first === "accept" ? 1 : 0);
        expect(await prisma.auditLog.count({
          where: { targetId: requestId, action: "privacy.deletion.access-revoked" }
        })).toBe(1);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("serializes privacy activation with ownership promotion in both orders", async () => {
    for (const first of ["privacy", "transfer"] as const) {
      const deleting = await createOwnerOnly(`privacy-transfer-deleting-${first}`);
      const host = await createFixture(`privacy-transfer-host-${first}`);
      await prisma.householdMember.update({
        where: { id: host.targetMemberId },
        data: { userId: deleting.owner.id }
      });
      const requestId = await dueDeletion(deleting.owner);
      const barrier = await installAuditBarrier({
        action: first === "privacy" ? "privacy.deletion.access-revoked" : "household.ownership.transfer",
        ...(first === "privacy" ? { targetId: requestId } : { householdId: host.householdId })
      });
      try {
        const activate = () => privacy.activateDueDeletion(requestId);
        const transfer = () => runtime.transferOwnership(host.owner, host.householdId, deleting.owner.id);
        const results = await runOrdered(barrier, first === "privacy" ? activate : transfer, first === "privacy" ? transfer : activate);
        expect(results[0].status).toBe("fulfilled");
        if (first === "privacy") {
          expect(results[1].status).toBe("rejected");
        } else {
          expect(results[1].status).toBe("fulfilled");
          expect((await prisma.privacyRequest.findUniqueOrThrow({ where: { id: requestId } }))).toMatchObject({
            state: "failed",
            failureCode: "OWNER_TRANSFER_REQUIRED"
          });
          expect(await prisma.household.findUniqueOrThrow({ where: { id: host.householdId } })).toMatchObject({
            ownerUserId: deleting.owner.id,
            ownershipVersion: 2
          });
          expect(await prisma.householdMember.findUniqueOrThrow({
            where: { householdId_userId: { householdId: host.householdId, userId: deleting.owner.id } }
          })).toMatchObject({ role: "owner", status: "active" });
        }
        await expectHouseholdInvariant(deleting.householdId);
        await expectHouseholdInvariant(host.householdId);
        expect(await auditCount(host.householdId, "household.ownership.transfer")).toBe(first === "transfer" ? 1 : 0);
        expect(await prisma.auditLog.count({
          where: { targetId: requestId, action: "privacy.deletion.access-revoked" }
        })).toBe(first === "privacy" ? 1 : 0);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("serializes privacy activation with direct household deletion in both orders", async () => {
    for (const first of ["privacy", "delete"] as const) {
      const fixture = await createOwnerOnly(`privacy-delete-${first}`);
      const requestId = await dueDeletion(fixture.owner);
      const barrier = await installAuditBarrier({
        action: first === "privacy" ? "privacy.deletion.access-revoked" : "household.delete.request",
        ...(first === "privacy" ? { targetId: requestId } : { householdId: fixture.householdId })
      });
      try {
        const activate = () => privacy.activateDueDeletion(requestId);
        const removeHousehold = () => runtime.deleteHousehold(fixture.owner, fixture.householdId);
        const results = await runOrdered(
          barrier,
          first === "privacy" ? activate : removeHousehold,
          first === "privacy" ? removeHousehold : activate
        );
        expect(results[0].status).toBe("fulfilled");
        if (first === "privacy") expect(results[1].status).toBe("rejected");
        else expect(results[1].status).toBe("fulfilled");
        await expectHouseholdInvariant(fixture.householdId);
        expect(await auditCount(fixture.householdId, "household.delete.request")).toBe(first === "delete" ? 1 : 0);
        expect(await prisma.auditLog.count({
          where: { targetId: requestId, action: "privacy.deletion.access-revoked" }
        })).toBe(1);
      } finally {
        await barrier.cleanup();
      }
    }
  });

  it("rolls back grant, revoke, promotion, deletion and privacy revocation on audit failure", async () => {
    const grant = await createOwnerOnly("audit-grant");
    const invite = await pendingInvite(grant.owner, grant.householdId);
    let cleanup = await installAuditFailure({ action: "household.invite.accept", householdId: grant.householdId });
    try {
      await expect(runtime.acceptInvite(invite.targetContext, invite.token)).rejects.toThrow("cycle6 injected audit failure");
      expect(await prisma.householdInvite.findUniqueOrThrow({ where: { id: invite.inviteId } })).toMatchObject({ status: "pending" });
      expect(await prisma.householdMember.count({
        where: { householdId: grant.householdId, userId: invite.target.id, status: "active" }
      })).toBe(0);
      expect(await auditCount(grant.householdId, "household.invite.accept")).toBe(0);
    } finally {
      await cleanup();
    }

    const revoke = await createFixture("audit-revoke");
    cleanup = await installAuditFailure({ action: "household.member.remove", householdId: revoke.householdId });
    try {
      await expect(runtime.removeMember(revoke.owner, revoke.householdId, revoke.targetMemberId))
        .rejects.toThrow("cycle6 injected audit failure");
      expect(await prisma.householdMember.findUniqueOrThrow({ where: { id: revoke.targetMemberId } })).toMatchObject({ status: "active" });
      expect(await auditCount(revoke.householdId, "household.member.remove")).toBe(0);
    } finally {
      await cleanup();
    }

    const promotion = await createFixture("audit-promotion");
    cleanup = await installAuditFailure({ action: "household.ownership.transfer", householdId: promotion.householdId });
    try {
      await expect(runtime.transferOwnership(promotion.owner, promotion.householdId, promotion.target.id))
        .rejects.toThrow("cycle6 injected audit failure");
      expect(await prisma.household.findUniqueOrThrow({ where: { id: promotion.householdId } }))
        .toMatchObject({ ownerUserId: promotion.owner.id });
      expect(await prisma.householdMember.findUniqueOrThrow({ where: { id: promotion.ownerMemberId } }))
        .toMatchObject({ role: "owner", status: "active" });
      expect(await prisma.householdMember.findUniqueOrThrow({ where: { id: promotion.targetMemberId } }))
        .toMatchObject({ role: "co_parent", status: "active" });
      expect(await auditCount(promotion.householdId, "household.ownership.transfer")).toBe(0);
      await expectHouseholdInvariant(promotion.householdId);
    } finally {
      await cleanup();
    }

    const deletion = await createOwnerOnly("audit-delete");
    const deletionInvite = await pendingInvite(deletion.owner, deletion.householdId);
    cleanup = await installAuditFailure({ action: "household.delete.request", householdId: deletion.householdId });
    try {
      await expect(runtime.deleteHousehold(deletion.owner, deletion.householdId)).rejects.toThrow("cycle6 injected audit failure");
      expect(await prisma.household.findUniqueOrThrow({ where: { id: deletion.householdId } })).toMatchObject({
        status: "active",
        deletedAt: null
      });
      expect(await prisma.jobOutbox.count({
        where: { topic: "household.deletion.requested", aggregateId: deletion.householdId }
      })).toBe(0);
      expect(await prisma.householdInvite.findUniqueOrThrow({ where: { id: deletionInvite.inviteId } }))
        .toMatchObject({ status: "pending" });
      expect(await prisma.householdMember.findUniqueOrThrow({ where: { id: deletion.ownerMemberId } }))
        .toMatchObject({ status: "active", role: "owner" });
      expect(await auditCount(deletion.householdId, "household.delete.request")).toBe(0);
    } finally {
      await cleanup();
    }

    const privacyFixture = await createOwnerOnly("audit-privacy");
    const requestId = await dueDeletion(privacyFixture.owner);
    const refresh = await prisma.refreshToken.create({
      data: {
        userId: privacyFixture.owner.id,
        familyId: randomUUID(),
        jti: randomUUID(),
        tokenHash: randomUUID().replaceAll("-", ""),
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    const device = await prisma.userDevice.create({
      data: {
        userId: privacyFixture.owner.id,
        platform: "android",
        deviceIdHash: randomUUID().replaceAll("-", ""),
        pushToken: "cycle6-push-token",
        notificationEnabled: true
      }
    });
    cleanup = await installAuditFailure({ action: "privacy.deletion.access-revoked", targetId: requestId });
    try {
      await expect(privacy.activateDueDeletion(requestId)).rejects.toThrow("cycle6 injected audit failure");
      expect(await prisma.privacyRequest.findUniqueOrThrow({ where: { id: requestId } })).toMatchObject({ state: "requested" });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: privacyFixture.owner.id } })).toMatchObject({ status: "active" });
      expect(await prisma.refreshToken.findUniqueOrThrow({ where: { id: refresh.id } })).toMatchObject({ revokedAt: null });
      expect(await prisma.userDevice.findUniqueOrThrow({ where: { id: device.id } })).toMatchObject({
        disabledAt: null,
        pushToken: "cycle6-push-token",
        notificationEnabled: true
      });
      expect(await prisma.householdMember.findUniqueOrThrow({ where: { id: privacyFixture.ownerMemberId } }))
        .toMatchObject({ status: "active", role: "owner" });
      expect(await prisma.household.findUniqueOrThrow({ where: { id: privacyFixture.householdId } }))
        .toMatchObject({ status: "active", deletedAt: null });
      expect(await prisma.privacyRequestEvent.count({ where: { privacyRequestId: requestId } })).toBe(1);
      expect(await prisma.jobOutbox.count({
        where: { topic: "privacy.delete", aggregateId: requestId }
      })).toBe(1);
      expect(await prisma.auditLog.count({
        where: { targetId: requestId, action: "privacy.deletion.access-revoked" }
      })).toBe(0);
    } finally {
      await cleanup();
    }
  }, 60_000);

  it("keeps a blocked due deletion visible, cancellable and retryable only after transfer", async () => {
    const deleting = await createOwnerOnly("blocked-retry-deleting");
    const coParent = await createUser("blocked-retry-coparent");
    const requestId = await dueDeletion(deleting.owner);
    await prisma.householdMember.create({
      data: {
        householdId: deleting.householdId,
        userId: coParent.id,
        role: "co_parent",
        status: "active",
        joinedAt: new Date()
      }
    });

    await expect(privacy.activateDueDeletion(requestId)).resolves.toMatchObject({
      state: "failed",
      failureCode: "OWNER_TRANSFER_REQUIRED"
    });
    await expect(jobs.handle("privacy.delete", { privacyRequestId: requestId }))
      .resolves.toEqual({ code: "OWNER_TRANSFER_REQUIRED" });
    expect(await prisma.privacyRequestEvent.count({ where: { privacyRequestId: requestId } })).toBe(2);
    await expect(privacy.currentDeletion(deleting.owner)).resolves.toMatchObject({
      state: "failed",
      failureCode: "OWNER_TRANSFER_REQUIRED",
      details: { householdId: deleting.householdId, accessRevoked: false }
    });
    await expectCode(privacy.retryBlockedDeletion(deleting.owner, requestId), "OWNER_TRANSFER_REQUIRED");
    expect(await prisma.user.findUniqueOrThrow({ where: { id: deleting.owner.id } })).toMatchObject({ status: "active" });

    await runtime.transferOwnership(deleting.owner, deleting.householdId, coParent.id);
    await expect(privacy.retryBlockedDeletion(deleting.owner, requestId)).resolves.toMatchObject({ state: "requested" });
    await expect(privacy.activateDueDeletion(requestId)).resolves.toMatchObject({ state: "access_revoked" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: deleting.owner.id } })).toMatchObject({ status: "withdrawn" });

    const cancellable = await createOwnerOnly("blocked-cancel");
    const cancelTarget = await createUser("blocked-cancel-target");
    const cancelRequestId = await dueDeletion(cancellable.owner);
    await prisma.householdMember.create({
      data: {
        householdId: cancellable.householdId,
        userId: cancelTarget.id,
        role: "co_parent",
        status: "active",
        joinedAt: new Date()
      }
    });
    await privacy.activateDueDeletion(cancelRequestId);
    await expect(privacy.cancelDeletion(cancellable.owner, cancelRequestId)).resolves.toMatchObject({ state: "cancelled" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: cancellable.owner.id } })).toMatchObject({ status: "active" });
  });
});
