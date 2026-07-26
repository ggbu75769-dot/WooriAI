import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { lockAuthorityRows, writeAuthorityAudit } from "../households/authority-transaction";
import { PrismaService } from "../prisma/prisma.service";
import { canTransitionPrivacyRequest, type PrivacyState } from "./privacy-state";

const OPEN_STATES: PrivacyState[] = [
  "requested",
  "access_revoked",
  "processor_delete_queued",
  "purging",
  "retained_exception",
  "failed"
];
const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function statusSecret(): string {
  return process.env.PRIVACY_STATUS_TOKEN_SECRET ?? "wooriai-dev-privacy-status-token-secret";
}

function statusToken(requestId: string): string {
  return createHmac("sha256", statusSecret()).update(requestId).digest("base64url");
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function statusDto(request: {
  id: string;
  requestType: string;
  state: string;
  requestedAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  failureCode: string | null;
  exportExpiresAt: Date | null;
}) {
  return {
    id: request.id,
    requestType: request.requestType,
    state: request.state,
    requestedAt: request.requestedAt.toISOString(),
    dueAt: request.dueAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    failureCode: request.failureCode,
    exportExpiresAt: request.exportExpiresAt?.toISOString() ?? null
  };
}

@Injectable()
export class PrivacyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requestDeletion(user: AuthenticatedUser) {
    const request = await this.prisma.$transaction(async (tx) => {
      await lockAuthorityRows(tx, { userIds: [user.id] });
      await this.requireActiveUserTx(tx, user.id);
      const existing = await tx.privacyRequest.findFirst({
        where: { userId: user.id, requestType: "deletion", state: { in: OPEN_STATES } },
        orderBy: { requestedAt: "desc" }
      });
      if (existing) return existing;

      const discovered = await tx.householdMember.findMany({
        where: { userId: user.id, role: "owner", status: "active" }
      });
      await lockAuthorityRows(tx, { householdIds: discovered.map((membership) => membership.householdId) });
      const ownedMemberships = await tx.householdMember.findMany({
        where: { userId: user.id, role: "owner", status: "active" }
      });
      for (const membership of ownedMemberships) {
        const activeMembers = await tx.householdMember.count({
          where: { householdId: membership.householdId, status: "active" }
        });
        if (activeMembers > 1) {
          throw new ConflictException({
            code: "OWNER_TRANSFER_REQUIRED",
            message: "계정 삭제 전에 공동 양육자에게 가족 소유권을 이전해 주세요.",
            details: { householdId: membership.householdId }
          });
        }
      }

      const now = new Date();
      const dueAt = new Date(now.getTime() + DELETION_GRACE_MS);
      const rawRequest = await tx.privacyRequest.create({
        data: { userId: user.id, requestType: "deletion", dueAt }
      });
      const hashedStatusToken = tokenHash(statusToken(rawRequest.id));
      const created = await tx.privacyRequest.update({
        where: { id: rawRequest.id },
        data: { statusTokenHash: hashedStatusToken }
      });

      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: created.id,
          previousState: null,
          nextState: "requested",
          actorType: "user",
          eventCode: "DELETION_REQUESTED",
          metadataJson: { graceEndsAt: dueAt.toISOString(), graceDays: 7 }
        }
      });
      await tx.jobOutbox.create({
        data: {
          topic: "privacy.delete",
          aggregateType: "privacy_request",
          aggregateId: created.id,
          dedupeKey: created.id,
          payloadJson: { privacyRequestId: created.id, userId: user.id },
          visibleAt: dueAt
        }
      });
      return created;
    });

    return { ...statusDto(request), statusToken: statusToken(request.id) };
  }

  async cancelDeletion(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      await lockAuthorityRows(tx, { userIds: [user.id] });
      const current = await tx.privacyRequest.findFirst({
        where: { id: requestId, userId: user.id, requestType: "deletion" }
      });
      if (!current) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "삭제 요청을 찾을 수 없어요." });
      if (current.state === "cancelled") return current;
      const isOwnershipBlocked = current.state === "failed" && current.failureCode === "OWNER_TRANSFER_REQUIRED";
      if ((!isOwnershipBlocked && current.state !== "requested") || (!isOwnershipBlocked && (!current.dueAt || current.dueAt <= new Date()))) {
        throw new ConflictException({ code: "DELETION_GRACE_ENDED", message: "삭제 유예 기간이 지나 취소할 수 없어요." });
      }
      const changed = await tx.privacyRequest.updateMany({
        where: { id: requestId, state: current.state, failureCode: current.failureCode },
        data: { state: "cancelled", failureCode: null }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "PRIVACY_STATE_RACE", message: "삭제 요청 상태가 변경됐어요." });
      await tx.jobOutbox.deleteMany({
        where: { topic: "privacy.delete", aggregateId: requestId, publishedAt: null }
      });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: requestId,
          previousState: current.state,
          nextState: "cancelled",
          actorType: "user",
          eventCode: "DELETION_CANCELLED_DURING_GRACE"
        }
      });
      return await tx.privacyRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
    return statusDto(request);
  }

  async currentDeletion(user: AuthenticatedUser) {
    const request = await this.prisma.privacyRequest.findFirst({
      where: {
        userId: user.id,
        requestType: "deletion",
        OR: [{ state: "requested" }, { state: "failed", failureCode: "OWNER_TRANSFER_REQUIRED" }]
      },
      orderBy: { requestedAt: "desc" }
    });
    if (!request) return null;
    return { ...statusDto(request), details: await this.blockingDetails(request.id, request.failureCode) };
  }

  async activateDueDeletion(requestId: string, now = new Date()) {
    const discovered = await this.prisma.privacyRequest.findUnique({ where: { id: requestId } });
    if (!discovered || discovered.requestType !== "deletion") {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "삭제 요청을 찾을 수 없어요." });
    }
    return await this.prisma.$transaction(async (tx) => {
      await lockAuthorityRows(tx, { userIds: [discovered.userId] });
      const discoveredMemberships = await tx.householdMember.findMany({
        where: { userId: discovered.userId, status: { in: ["active", "pending"] } }
      });
      await lockAuthorityRows(tx, { householdIds: discoveredMemberships.map((membership) => membership.householdId) });
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM privacy_requests WHERE id = ${requestId}::uuid FOR UPDATE
      `;
      const request = await tx.privacyRequest.findUnique({ where: { id: requestId } });
      if (!request || request.requestType !== "deletion") {
        throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "삭제 요청을 찾을 수 없어요." });
      }
      if (request.state !== "requested") return request;
      if (!request.dueAt || request.dueAt > now) {
        throw new ConflictException({ code: "DELETION_GRACE_ACTIVE", message: "삭제 유예 기간이 아직 끝나지 않았어요." });
      }

      const ownedMemberships = await tx.householdMember.findMany({
        where: { userId: request.userId, role: "owner", status: "active" }
      });
      for (const membership of ownedMemberships) {
        const activeMembers = await tx.householdMember.count({ where: { householdId: membership.householdId, status: "active" } });
        if (activeMembers > 1) {
          await tx.privacyRequest.update({
            where: { id: request.id },
            data: { state: "failed", failureCode: "OWNER_TRANSFER_REQUIRED" }
          });
          await tx.privacyRequestEvent.create({
            data: {
              privacyRequestId: request.id,
              previousState: "requested",
              nextState: "failed",
              actorType: "system",
              eventCode: "DELETION_BLOCKED_OWNER_TRANSFER_REQUIRED",
              metadataJson: { householdId: membership.householdId, accessRevoked: false }
            }
          });
          return await tx.privacyRequest.findUniqueOrThrow({ where: { id: request.id } });
        }
      }

      const changed = await tx.privacyRequest.updateMany({
        where: { id: requestId, state: request.state, failureCode: request.failureCode, dueAt: { lte: now } },
        data: { state: "access_revoked", accessRevokedAt: now, failureCode: null }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "PRIVACY_STATE_RACE", message: "삭제 요청 상태가 변경됐어요." });
      await tx.privacyRequestEvent.create({
        data: { privacyRequestId: requestId, previousState: "requested", nextState: "access_revoked", actorType: "system", eventCode: "DELETION_GRACE_ENDED_ACCESS_REVOKED" }
      });
      await tx.refreshToken.updateMany({ where: { userId: request.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.userDevice.updateMany({ where: { userId: request.userId, disabledAt: null }, data: { disabledAt: now, pushToken: null, notificationEnabled: false } });
      await tx.householdMember.updateMany({ where: { userId: request.userId, status: { in: ["active", "pending"] } }, data: { status: "left" } });
      for (const membership of ownedMemberships) {
        await tx.household.update({
          where: { id: membership.householdId },
          data: { status: "archived", deletedAt: now, ownershipVersion: { increment: 1 } }
        });
      }
      await tx.user.update({ where: { id: request.userId }, data: { status: "withdrawn", deletedAt: now } });
      await writeAuthorityAudit(tx, {
        actorUserId: request.userId,
        action: "privacy.deletion.access-revoked",
        targetType: "privacy_request",
        targetId: request.id,
        before: { state: request.state, userStatus: "active" },
        after: {
          state: "access_revoked",
          userStatus: "withdrawn",
          archivedHouseholdIds: ownedMemberships.map((membership) => membership.householdId)
        }
      });
      return await tx.privacyRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }

  async retryBlockedDeletion(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      await lockAuthorityRows(tx, { userIds: [user.id] });
      await this.requireActiveUserTx(tx, user.id);
      const current = await tx.privacyRequest.findFirst({
        where: {
          id: requestId,
          userId: user.id,
          requestType: "deletion",
          state: "failed",
          failureCode: "OWNER_TRANSFER_REQUIRED"
        }
      });
      if (!current) {
        throw new ConflictException({ code: "PRIVACY_RETRY_NOT_ALLOWED", message: "다시 시도할 수 있는 삭제 요청이 아니에요." });
      }
      const discoveredMemberships = await tx.householdMember.findMany({
        where: { userId: user.id, status: { in: ["active", "pending"] } }
      });
      await lockAuthorityRows(tx, { householdIds: discoveredMemberships.map((membership) => membership.householdId) });
      const blockingHouseholdId = await this.findBlockingOwnedHouseholdTx(tx, user.id);
      if (blockingHouseholdId) {
        throw new ConflictException({
          code: "OWNER_TRANSFER_REQUIRED",
          message: "계정 삭제 전에 공동 양육자에게 가족 소유권을 이전해 주세요.",
          details: { householdId: blockingHouseholdId }
        });
      }
      const now = new Date();
      await tx.privacyRequest.update({
        where: { id: current.id },
        data: { state: "requested", failureCode: null, dueAt: now }
      });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: current.id,
          previousState: "failed",
          nextState: "requested",
          actorType: "user",
          eventCode: "DELETION_OWNER_BLOCKER_RESOLVED_RETRY"
        }
      });
      await tx.jobOutbox.create({
        data: {
          topic: "privacy.delete",
          aggregateType: "privacy_request",
          aggregateId: current.id,
          dedupeKey: `${current.id}:owner-retry:${now.getTime()}`,
          payloadJson: { privacyRequestId: current.id, userId: user.id },
          visibleAt: now
        }
      });
      return await tx.privacyRequest.findUniqueOrThrow({ where: { id: current.id } });
    });
    return statusDto(request);
  }

  async requestExport(user: AuthenticatedUser) {
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`export:${user.id}`})::bigint)`;
      const existing = await tx.privacyRequest.findFirst({
        where: { userId: user.id, requestType: "export", state: { in: OPEN_STATES } },
        orderBy: { requestedAt: "desc" }
      });
      if (existing) return existing;
      const created = await tx.privacyRequest.create({ data: { userId: user.id, requestType: "export" } });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: created.id,
          previousState: null,
          nextState: "requested",
          actorType: "user",
          eventCode: "EXPORT_REQUESTED"
        }
      });
      await tx.jobOutbox.create({
        data: {
          topic: "privacy.export",
          aggregateType: "privacy_request",
          aggregateId: created.id,
          dedupeKey: created.id,
          payloadJson: { privacyRequestId: created.id, userId: user.id }
        }
      });
      return created;
    });
    return statusDto(request);
  }

  async statusForUser(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId: user.id } });
    if (!request) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
    return statusDto(request);
  }

  async publicDeletionStatus(requestId: string, token: string) {
    const request = await this.prisma.privacyRequest.findUnique({ where: { id: requestId } });
    if (!request?.statusTokenHash || request.requestType !== "deletion") {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
    }
    const presented = Buffer.from(tokenHash(token));
    const expected = Buffer.from(request.statusTokenHash);
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw new ForbiddenException({ code: "PRIVACY_STATUS_TOKEN_INVALID", message: "상태 조회 토큰이 올바르지 않아요." });
    }
    return statusDto(request);
  }

  async transition(
    requestId: string,
    nextState: PrivacyState,
    eventCode: string,
    options: { actorType?: string; failureCode?: string; metadata?: Prisma.InputJsonValue } = {}
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const request = await tx.privacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
      if (
        request.state === "failed" &&
        request.failureCode === "OWNER_TRANSFER_REQUIRED" &&
        nextState !== "requested" &&
        nextState !== "cancelled"
      ) {
        throw new ConflictException({
          code: "OWNER_TRANSFER_REQUIRED",
          message: "가족 소유권을 이전한 뒤 삭제를 다시 시도해 주세요."
        });
      }
      if (!canTransitionPrivacyRequest(request.state, nextState)) {
        throw new BadRequestException({ code: "PRIVACY_STATE_TRANSITION_INVALID", message: "허용되지 않은 상태 변경이에요." });
      }
      const changed = await tx.privacyRequest.updateMany({
        where: { id: requestId, state: request.state },
        data: {
          state: nextState,
          failureCode: options.failureCode,
          completedAt: nextState === "completed" ? new Date() : undefined
        }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "PRIVACY_STATE_RACE", message: "요청 상태가 변경됐어요." });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: requestId,
          previousState: request.state,
          nextState,
          actorType: options.actorType ?? "worker",
          eventCode,
          metadataJson: options.metadata
        }
      });
      return await tx.privacyRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }

  private async requireActiveUserTx(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "active") {
      throw new ConflictException({ code: "PRIVACY_USER_STATE_CHANGED", message: "계정 상태가 이미 변경됐어요." });
    }
    return user;
  }

  private async findBlockingOwnedHouseholdTx(tx: Prisma.TransactionClient, userId: string) {
    const ownedMemberships = await tx.householdMember.findMany({
      where: { userId, role: "owner", status: "active" },
      orderBy: { householdId: "asc" }
    });
    for (const membership of ownedMemberships) {
      const activeMembers = await tx.householdMember.count({
        where: { householdId: membership.householdId, status: "active" }
      });
      if (activeMembers > 1) return membership.householdId;
    }
    return null;
  }

  private async blockingDetails(requestId: string, failureCode: string | null) {
    if (failureCode !== "OWNER_TRANSFER_REQUIRED") return undefined;
    const event = await this.prisma.privacyRequestEvent.findFirst({
      where: { privacyRequestId: requestId, eventCode: "DELETION_BLOCKED_OWNER_TRANSFER_REQUIRED" },
      orderBy: { createdAt: "desc" }
    });
    const metadata = event?.metadataJson;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
    const householdId = (metadata as Record<string, unknown>).householdId;
    return typeof householdId === "string" ? { householdId, accessRevoked: false } : undefined;
  }
}
